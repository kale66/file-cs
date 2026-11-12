import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ChannelIssue,
  ScanConfig,
  StartPayload,
  WorkerResponse,
} from '@/types';
import { PROTOCOL_VERSION } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import { ScanWorkerClient } from '@/workers/workerClient';
import type { ScanHandlers } from '@/workers/workerClient';
import type { ClsError } from '@/core/errors';

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn();

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  fail(): void {
    this.onerror?.({
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent);
  }

  messageError(): void {
    this.onmessageerror?.();
  }
}

function createHandlers(): ScanHandlers & {
  onChannelIssue: ReturnType<typeof vi.fn>;
} {
  return {
    onProgress: vi.fn(),
    onFindings: vi.fn(),
    onSkipped: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onCancelled: vi.fn(),
    onChannelIssue: vi.fn(),
  };
}

const config: ScanConfig = createDefaultScanConfig();

function createPayload(): StartPayload {
  return {
    source: 'zip',
    fileName: 'fixture.zip',
    sizeBytes: 8,
    data: new ArrayBuffer(8),
  };
}

function createClient(): {
  client: ScanWorkerClient;
  worker: FakeWorker;
  factory: ReturnType<typeof vi.fn>;
} {
  const worker = new FakeWorker();
  const factory = vi.fn(() => worker as unknown as Worker);
  const client = new ScanWorkerClient(factory);
  return { client, worker, factory };
}

function issueOf(handlers: ReturnType<typeof createHandlers>): ChannelIssue {
  const call = handlers.onChannelIssue.mock.calls[0];
  return call?.[0] as ChannelIssue;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ScanWorkerClient 通道归因', () => {
  it('构造时不创建 Worker（懒创建）', () => {
    const { factory } = createClient();
    expect(factory).not.toHaveBeenCalled();
  });

  it('500ms 无任何消息 → CLS-E-1014 就绪超时', () => {
    const { client, factory } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);

    expect(factory).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);

    expect(handlers.onChannelIssue).toHaveBeenCalledTimes(1);
    const issue = issueOf(handlers);
    expect(issue.failure.code).toBe('CLS-E-1014');
    expect(issue.failure.category).toBe('timeout');
    expect(issue.failure.phase).toBe('ready');
    expect(issue.failure.fatal).toBe(false);
    expect(issue.needsReacquire).toBe(true);
    client.dispose();
  });

  it('首条消息后清除就绪看门狗', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:progress',
      event: {
        jobId,
        phase: 'unzipping',
        percent: 10,
        processed: 1,
        total: 10,
        currentPath: null,
        elapsedMs: 10,
      },
    });
    vi.advanceTimersByTime(500);
    expect(handlers.onChannelIssue).not.toHaveBeenCalled();
    client.dispose();
  });

  it('零有效消息时 onerror → CLS-E-1011 加载失败，且不重建', () => {
    const { client, worker, factory } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);
    worker.fail();

    expect(issueOf(handlers).failure.code).toBe('CLS-E-1011');
    expect(issueOf(handlers).failure.category).toBe('load');
    expect(worker.terminate).toHaveBeenCalled();
    expect(factory).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  it('已有有效消息后 onerror → CLS-E-1016 引擎异常', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:skipped',
      batch: { jobId, sequence: 0, items: [] },
    });
    worker.fail();

    expect(issueOf(handlers).failure.code).toBe('CLS-E-1016');
    expect(issueOf(handlers).failure.category).toBe('engine');
    client.dispose();
  });

  it('协议版本不匹配 → CLS-E-1013', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: 1,
      type: 'job:progress',
      event: {
        jobId: 'old-job',
        phase: 'scanning',
        percent: 1,
        processed: 1,
        total: 1,
        currentPath: null,
        elapsedMs: 1,
      },
    });

    expect(issueOf(handlers).failure.code).toBe('CLS-E-1013');
    expect(issueOf(handlers).failure.category).toBe('protocol');
    expect(client.protocolVersion).toBe(1);
    client.dispose();
  });

  it('就绪阶段的非法消息 → CLS-E-1012', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);
    worker.emit({ protocol: PROTOCOL_VERSION, type: 'unknown:type' });

    expect(issueOf(handlers).failure.code).toBe('CLS-E-1012');
    expect(issueOf(handlers).failure.category).toBe('parse');
    expect(client.snapshotCounters().invalid).toBe(1);
    client.dispose();
  });

  it('旧 jobId 消息只计数，不回调也不报错', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:progress',
      event: {
        jobId: 'stale-job',
        phase: 'scanning',
        percent: 50,
        processed: 1,
        total: 2,
        currentPath: null,
        elapsedMs: 1,
      },
    });

    expect(client.snapshotCounters().staleJob).toBe(1);
    expect(handlers.onProgress).not.toHaveBeenCalled();
    expect(handlers.onChannelIssue).not.toHaveBeenCalled();
    client.dispose();
  });

  it('postMessage 抛错 → start 抛 CLS-E-1017，后续仍可重新提交', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    worker.postMessage.mockImplementationOnce(() => {
      throw new DOMException('detached', 'DataCloneError');
    });

    let code = '';
    try {
      client.start(createPayload(), handlers, config);
    } catch (error) {
      code = (error as ClsError).code;
    }
    expect(code).toBe('CLS-E-1017');
    expect(client.currentPhase).toBe('idle');

    const jobId = client.start(createPayload(), handlers, config);
    expect(jobId.length).toBeGreaterThan(0);
    client.dispose();
  });

  it('并发提交 → CLS-E-1018', () => {
    const { client } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);

    let code = '';
    try {
      client.start(createPayload(), handlers, config);
    } catch (error) {
      code = (error as ClsError).code;
    }
    expect(code).toBe('CLS-E-1018');
    client.dispose();
  });

  it('8s 无活性且 ping 连续无应答 → CLS-E-1015', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:progress',
      event: {
        jobId,
        phase: 'scanning',
        percent: 40,
        processed: 1,
        total: 10,
        currentPath: null,
        elapsedMs: 1,
      },
    });

    vi.advanceTimersByTime(8_000);

    const issue = issueOf(handlers);
    expect(issue.failure.code).toBe('CLS-E-1015');
    expect(issue.failure.category).toBe('timeout');
    expect(issue.failure.phase).toBe('running');
    expect(client.snapshotCounters().ping).toBeGreaterThanOrEqual(3);
    client.dispose();
  });

  it('pong 心跳正常时不因 8s 静默降级', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    const progress = {
      protocol: PROTOCOL_VERSION,
      type: 'job:progress',
      event: {
        jobId,
        phase: 'unzipping',
        percent: 10,
        processed: 1,
        total: 10,
        currentPath: null,
        elapsedMs: 1,
      },
    } as const;
    worker.emit(progress);

    for (let index = 0; index < 5; index += 1) {
      vi.advanceTimersByTime(2_000);
      worker.emit({
        protocol: PROTOCOL_VERSION,
        type: 'job:pong',
        jobId,
        phase: 'running',
      });
    }

    expect(handlers.onChannelIssue).not.toHaveBeenCalled();
    expect(client.snapshotCounters().pong).toBeGreaterThanOrEqual(3);
    client.dispose();
  });

  it('终态 done 不产生通道提示', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:done',
      completion: {
        jobId,
        summary: {
          totalFiles: 0,
          scannedFiles: 0,
          skippedFiles: 0,
          riskFiles: 0,
          severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
          durationMs: 1,
          status: 'empty',
        },
        skippedTotal: 0,
        skipReasonCounts: {
          'ignored-directory': 0,
          'ignored-type': 0,
          'too-large': 0,
          'unsupported-extension': 0,
          'illegal-path': 0,
          'parse-error': 0,
          'non-text': 0,
          'archive-encrypted': 0,
        },
        diagnostics: [],
        diagnosticTotal: 0,
      },
    } as WorkerResponse);

    expect(handlers.onDone).toHaveBeenCalledTimes(1);
    expect(handlers.onChannelIssue).not.toHaveBeenCalled();
    client.dispose();
  });

  it('取消收到 cancelled 只回调取消，不报错', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    const jobId = client.start(createPayload(), handlers, config);
    client.cancel(jobId);
    worker.emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:cancelled',
      jobId,
    });

    expect(handlers.onCancelled).toHaveBeenCalledWith(jobId);
    expect(handlers.onChannelIssue).not.toHaveBeenCalled();
    client.dispose();
  });

  it('dispose 后 start 抛 CLS-E-1008 兜底', () => {
    const { client } = createClient();
    const handlers = createHandlers();
    client.dispose();

    let code = '';
    try {
      client.start(createPayload(), handlers, config);
    } catch (error) {
      code = (error as ClsError).code;
    }
    expect(code).toBe('CLS-E-1008');
  });

  it('同一类别只提示一次', () => {
    const { client, worker } = createClient();
    const handlers = createHandlers();
    client.start(createPayload(), handlers, config);
    worker.messageError();
    worker.messageError();

    expect(handlers.onChannelIssue).toHaveBeenCalledTimes(1);
    client.dispose();
  });
});