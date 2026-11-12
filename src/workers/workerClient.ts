import { PROTOCOL_VERSION } from '@/types';
import type {
  ChannelCounters,
  ChannelFailureCategory,
  ChannelIssue,
  ChannelPhase,
  FindingBatch,
  ScanCompletion,
  ScanConfig,
  ScanProgress,
  SkippedBatch,
  StartPayload,
  WorkerFailure,
  WorkerResponse,
} from '@/types';
import { CHANNEL_CATALOG, channelErrorInfo, ClsError } from '@/core/errors';
import {
  classifyInbound,
  createCancelRequest,
  createPingRequest,
  createStartRequestWithId,
  newJobId,
} from '@/workers/protocol';
import type { WorkerFactory } from '@/workers/workerFactory';

export const READY_TIMEOUT_MS = 500;
export const LIVENESS_QUIET_MS = 8_000;
export const LIVENESS_CHECK_INTERVAL_MS = 2_000;
export const PING_MISS_LIMIT = 3;
export const CANCEL_FALLBACK_MS = 800;

export interface ScanHandlers {
  onProgress(event: ScanProgress): void;
  onFindings(batch: FindingBatch): void;
  onSkipped(batch: SkippedBatch): void;
  onDone(result: ScanCompletion): void;
  onError(error: WorkerFailure): void;
  onCancelled(jobId: string): void;
  onChannelIssue(issue: ChannelIssue): void;
}

type ClientPhase = 'idle' | 'starting' | 'running' | 'settling' | 'disposed';

type MutableCounters = { -readonly [K in keyof ChannelCounters]: number };

function createCounters(): MutableCounters {
  return {
    progress: 0,
    findings: 0,
    skipped: 0,
    invalid: 0,
    staleJob: 0,
    ping: 0,
    pong: 0,
    loadFailure: 0,
    rebuild: 0,
    stalledAlive: 0,
  };
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function cloneCounters(counters: MutableCounters): ChannelCounters {
  return { ...counters };
}

export function assertChannelIssue(issue: ChannelIssue): void {
  if (issue.failure.fatal) {
    throw new Error('channel issue must be non-fatal');
  }
}

export class ScanWorkerClient {
  private worker: Worker | null = null;
  private generation = 0;
  private phase: ClientPhase = 'idle';
  private activeJobId: string | null = null;
  private handlers: ScanHandlers | null = null;
  private supportedFlag: boolean;
  private failureSettled = false;
  private reportedCategories = new Set<ChannelFailureCategory>();
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private livenessTimer: ReturnType<typeof setTimeout> | null = null;
  private cancelTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt = 0;
  private jobStartedAt = 0;
  private pingMisses = 0;
  private cancelRequested = false;
  private acceptedMessages = 0;
  private engineAvailable = false;
  private protocolVersionSeen: number | null = null;
  private currentPayloadSource: 'zip' | 'folder' | null = null;
  private lastFailure: ChannelIssue['failure'] | null = null;
  private readonly counters = createCounters();

  constructor(private readonly factory: WorkerFactory) {
    this.supportedFlag = true;
  }

  get supported(): boolean {
    return this.supportedFlag;
  }

  get engineSource(): 'external' | 'inline' | 'none' {
    if (!this.supportedFlag) return 'none';
    return typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__
      ? 'inline'
      : 'external';
  }

  get protocolVersion(): number | null {
    return this.protocolVersionSeen;
  }

  get sawEngineMessage(): boolean {
    return this.engineAvailable;
  }

  get lastChannelFailure(): WorkerFailure | null {
    return this.lastFailure;
  }

  get currentPhase(): string {
    return this.phase;
  }

  get elapsedMs(): number | null {
    if (this.jobStartedAt === 0) return null;
    return Math.round(now() - this.jobStartedAt);
  }

  snapshotCounters(): ChannelCounters {
    return cloneCounters(this.counters);
  }

  start(payload: StartPayload, handlers: ScanHandlers, config: ScanConfig): string {
    if (this.phase === 'disposed') {
      throw new ClsError('CLS-E-1008');
    }
    if (this.activeJobId !== null || this.phase === 'starting' || this.phase === 'running') {
      throw new ClsError('CLS-E-1018');
    }

    this.failureSettled = false;
    this.reportedCategories.clear();
    this.acceptedMessages = 0;
    this.cancelRequested = false;
    this.pingMisses = 0;
    this.lastFailure = null;
    this.handlers = handlers;
    this.currentPayloadSource = payload.source;

    const worker = this.ensureWorker();
    const jobId = newJobId();
    const request = createStartRequestWithId(jobId, payload, config);
    const transfer: Transferable[] = payload.source === 'zip' ? [payload.data] : [];

    try {
      worker.postMessage(request, transfer);
    } catch {
      this.counters.invalid += 0;
      this.handlers = null;
      this.currentPayloadSource = null;
      this.phase = 'idle';
      throw new ClsError('CLS-E-1017');
    }

    this.activeJobId = jobId;
    this.phase = 'starting';
    this.jobStartedAt = now();
    this.lastActivityAt = now();
    this.startReadyTimer();
    return jobId;
  }

  cancel(jobId: string): void {
    if (this.activeJobId === null || jobId !== this.activeJobId) return;
    this.cancelRequested = true;
    this.clearReadyTimer();
    this.clearLivenessTimer();

    const handlers = this.handlers;
    const worker = this.worker;
    if (worker) {
      try {
        worker.postMessage(createCancelRequest(jobId));
      } catch {
        // 投递取消失败时直接走超时收尾
      }
    }

    this.clearCancelTimer();
    this.cancelTimer = setTimeout(() => {
      this.cancelTimer = null;
      this.terminateWorker();
      this.finishJob();
      handlers?.onCancelled(jobId);
    }, CANCEL_FALLBACK_MS);
  }

  dispose(): void {
    this.clearTimers();
    this.terminateWorker();
    this.phase = 'disposed';
    this.activeJobId = null;
    this.handlers = null;
  }

  private ensureWorker(): Worker {
    if (!this.supportedFlag) {
      throw new ClsError('CLS-E-4001');
    }
    if (this.phase === 'disposed') {
      throw new ClsError('CLS-E-1008');
    }
    if (this.worker) return this.worker;

    let worker: Worker;
    try {
      worker = this.factory();
    } catch {
      this.supportedFlag = false;
      throw new ClsError('CLS-E-4001');
    }

    this.generation += 1;
    this.counters.rebuild += 1;
    this.worker = worker;
    this.bindWorker(worker, this.generation);
    return worker;
  }

  private bindWorker(worker: Worker, generation: number): void {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (generation !== this.generation) return;
      this.handleMessage(event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      if (generation !== this.generation) return;
      event.preventDefault?.();
      this.handleWorkerError();
    };
    worker.onmessageerror = () => {
      if (generation !== this.generation) return;
      this.handleMessageError();
    };
  }

  private handleMessage(data: unknown): void {
    if (this.phase === 'disposed') return;

    if (this.cancelRequested && this.activeJobId !== null) {
      const classification = classifyInbound(data, this.activeJobId);
      if (
        classification.kind === 'accepted' &&
        classification.response.type === 'job:cancelled'
      ) {
        const handlers = this.handlers;
        this.clearCancelTimer();
        this.finishJob();
        handlers?.onCancelled(classification.response.jobId);
      }
      return;
    }

    if (this.activeJobId === null || this.handlers === null) {
      this.counters.staleJob += 1;
      return;
    }

    const classification = classifyInbound(data, this.activeJobId);
    switch (classification.kind) {
      case 'stale':
        this.counters.staleJob += 1;
        return;
      case 'invalid':
        this.counters.invalid += 1;
        this.handleInvalidMessage();
        return;
      case 'protocol-mismatch':
        this.protocolVersionSeen = classification.received;
        this.settleWithIssue('protocol');
        return;
      case 'accepted':
        this.acceptResponse(classification.response);
        return;
      default:
        this.settleWithIssue('unclassified');
    }
  }

  private acceptResponse(response: WorkerResponse): void {
    const handlers = this.handlers;
    if (!handlers) return;

    if (response.type !== 'job:error') {
      this.acceptedMessages += 1;
      this.engineAvailable = true;
      this.clearReadyTimer();
      if (this.phase === 'starting') {
        this.phase = 'running';
        this.startLivenessTimer();
      }
    }

    if (
      response.type === 'job:progress' ||
      response.type === 'job:findings' ||
      response.type === 'job:skipped' ||
      response.type === 'job:pong'
    ) {
      this.markActivity();
    }

    switch (response.type) {
      case 'job:progress':
        this.counters.progress += 1;
        handlers.onProgress(response.event);
        return;
      case 'job:findings':
        this.counters.findings += response.batch.findings.length;
        handlers.onFindings(response.batch);
        return;
      case 'job:skipped':
        this.counters.skipped += response.batch.items.length;
        handlers.onSkipped(response.batch);
        return;
      case 'job:pong':
        this.counters.pong += 1;
        return;
      case 'job:done':
        this.finishJob();
        handlers.onDone(response.completion);
        return;
      case 'job:error':
        this.finishJob();
        handlers.onError(response.failure);
        return;
      case 'job:cancelled':
        this.clearCancelTimer();
        this.finishJob();
        handlers.onCancelled(response.jobId);
        return;
      default:
        return;
    }
  }

  private handleInvalidMessage(): void {
    if (this.acceptedMessages === 0 || this.counters.invalid >= 50) {
      this.settleWithIssue('parse');
      return;
    }
    this.emitChannelIssue('parse');
  }

  private handleMessageError(): void {
    if (this.acceptedMessages === 0) {
      this.settleWithIssue('parse');
      return;
    }
    this.emitChannelIssue('parse');
  }

  private handleWorkerError(): void {
    this.counters.loadFailure += 1;
    if (this.acceptedMessages === 0) {
      this.settleWithIssue('load');
      return;
    }
    this.settleWithIssue('engine');
  }

  private startReadyTimer(): void {
    this.clearReadyTimer();
    this.readyTimer = setTimeout(() => {
      this.readyTimer = null;
      if (
        this.activeJobId === null ||
        this.cancelRequested ||
        this.failureSettled
      ) {
        return;
      }
      if (this.acceptedMessages > 0) return;
      this.settleWithIssue('timeout');
    }, READY_TIMEOUT_MS);
  }

  private startLivenessTimer(): void {
    this.clearLivenessTimer();
    const tick = (): void => {
      this.livenessTimer = null;
      if (
        this.activeJobId === null ||
        this.cancelRequested ||
        this.failureSettled
      ) {
        return;
      }

      const quiet = now() - this.lastActivityAt;
      if (quiet >= LIVENESS_QUIET_MS && this.pingMisses >= PING_MISS_LIMIT) {
        this.settleWithIssue('timeout', 'running');
        return;
      }

      if (quiet >= LIVENESS_CHECK_INTERVAL_MS) {
        this.sendPing();
      }
      if (quiet >= LIVENESS_QUIET_MS) {
        this.counters.stalledAlive += 1;
      }

      this.livenessTimer = setTimeout(tick, LIVENESS_CHECK_INTERVAL_MS);
    };
    this.livenessTimer = setTimeout(tick, LIVENESS_CHECK_INTERVAL_MS);
  }

  private sendPing(): void {
    const worker = this.worker;
    const jobId = this.activeJobId;
    if (!worker || jobId === null) return;
    try {
      worker.postMessage(createPingRequest(jobId));
      this.counters.ping += 1;
      this.pingMisses += 1;
    } catch {
      this.pingMisses += 1;
    }
  }

  private markActivity(): void {
    this.lastActivityAt = now();
    this.pingMisses = 0;
    this.clearReadyTimer();
    if (this.phase === 'starting') {
      this.phase = 'running';
      this.startLivenessTimer();
    }
  }

  private settleWithIssue(
    category: ChannelFailureCategory,
    phaseOverride?: ChannelPhase,
  ): void {
    if (this.failureSettled) return;

    const phase: ChannelPhase =
      phaseOverride ??
      (this.acceptedMessages === 0 ? 'ready' : 'running');
    const info = channelErrorInfo(category);
    const entry = CHANNEL_CATALOG[category];
    const code =
      category === 'timeout' && phase === 'running' ? 'CLS-E-1015' : entry.code;

    const failure: WorkerFailure = {
      code,
      message: info.message,
      hint: info.hint,
      fatal: false,
      category,
      phase,
      recovered: entry.degradable,
      retryable: entry.retryable,
    };

    this.lastFailure = failure;
    const needsReacquire = this.currentPayloadSource === 'zip';
    const issue: ChannelIssue = {
      failure,
      needsReacquire,
      counts: cloneCounters(this.counters),
    };

    this.counters.loadFailure += category === 'load' ? 1 : 0;
    this.terminateWorker();
    this.clearTimers();
    this.failureSettled = true;

    const handlers = this.handlers;
    this.activeJobId = null;
    this.handlers = null;
    this.currentPayloadSource = null;
    this.phase = 'idle';
    this.jobStartedAt = 0;

    if (handlers && !this.reportedCategories.has(category)) {
      this.reportedCategories.add(category);
      handlers.onChannelIssue(issue);
    }
  }

  private emitChannelIssue(category: ChannelFailureCategory): void {
    if (this.reportedCategories.has(category)) return;
    const handlers = this.handlers;
    if (!handlers) return;

    const info = channelErrorInfo(category);
    const entry = CHANNEL_CATALOG[category];
    const failure: WorkerFailure = {
      code: entry.code,
      message: info.message,
      hint: info.hint,
      fatal: false,
      category,
      phase: this.acceptedMessages === 0 ? 'ready' : 'running',
      recovered: true,
      retryable: entry.retryable,
    };
    this.lastFailure = failure;
    this.reportedCategories.add(category);
    this.counters.stalledAlive += 0;
    handlers.onChannelIssue({
      failure,
      needsReacquire: this.currentPayloadSource === 'zip',
      counts: cloneCounters(this.counters),
    });
  }

  private finishJob(): void {
    this.clearTimers();
    this.failureSettled = true;
    this.activeJobId = null;
    this.handlers = null;
    this.currentPayloadSource = null;
    this.phase = 'idle';
    this.jobStartedAt = 0;
  }

  private terminateWorker(): void {
    if (!this.worker) return;
    try {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
    } catch {
      // 终止失败不影响后续重建
    }
    this.worker = null;
    this.generation += 1;
  }

  private clearReadyTimer(): void {
    if (this.readyTimer !== null) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private clearLivenessTimer(): void {
    if (this.livenessTimer !== null) {
      clearTimeout(this.livenessTimer);
      this.livenessTimer = null;
    }
  }

  private clearCancelTimer(): void {
    if (this.cancelTimer !== null) {
      clearTimeout(this.cancelTimer);
      this.cancelTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearReadyTimer();
    this.clearLivenessTimer();
    this.clearCancelTimer();
  }
}

export const PROTOCOL = PROTOCOL_VERSION;