import { useCallback, useEffect, useRef, useState } from 'react';
import { PROTOCOL_VERSION } from '@/types';
import type {
  AppPhase,
  ChannelIssue,
  DiagnosticsSnapshot,
  Finding,
  ScanConfig,
  ScanProgress,
  ScanResult,
  SkippedFile,
  StartPayload,
  WorkerFailure,
  WorkerResponse,
} from '@/types';
import { isClsError, toErrorInfo } from '@/core/errors';
import { snapshotConfig } from '@/core/config';
import {
  EMPTY_COUNTERS,
  buildDiagnosticsSnapshot,
  createDiagnosticId,
  currentBuildMode,
  currentPageProtocol,
} from '@/core/diagnostics';
import { createScanWorker } from '@worker-factory';
import { ScanWorkerClient } from '@/workers/workerClient';
import type { ScanHandlers } from '@/workers/workerClient';
import { createCancelSignal, runJob } from '@/workers/jobRunner';
import type { CancelSignal } from '@/workers/jobRunner';
import { newJobId } from '@/workers/protocol';
import { rawSnippetStore } from '@/ui/hooks/rawSnippetStore';

export interface UseScanJobOptions {
  readonly config: ScanConfig;
  readonly onResult: (result: ScanResult) => void;
  readonly onReset?: () => void;
}

export interface UseScanJobResult {
  readonly phase: AppPhase;
  readonly progress: ScanProgress | null;
  readonly error: WorkerFailure | null;
  readonly degraded: boolean;
  readonly channelIssue: ChannelIssue | null;
  readonly activeJobId: string | null;
  start(payload: StartPayload, acquire?: () => Promise<StartPayload>): void;
  cancel(): void;
  reset(): void;
  buildDiagnostics(): DiagnosticsSnapshot;
}

interface JobAccumulator {
  findings: Finding[];
  skipped: SkippedFile[];
  config: ScanConfig | null;
  jobId: string | null;
}

type JobMode = 'worker' | 'fallback';

function emptyAccumulator(): JobAccumulator {
  return { findings: [], skipped: [], config: null, jobId: null };
}

function failureFrom(error: unknown): WorkerFailure {
  const info = toErrorInfo(error);
  return {
    code: info.code,
    message: info.message,
    hint: info.hint,
    fatal: info.fatal,
  };
}

function reuploadFailure(failure: WorkerFailure, message: string): WorkerFailure {
  return {
    ...failure,
    message,
    retryable: 'reupload',
    fatal: false,
  };
}

export function useScanJob(options: UseScanJobOptions): UseScanJobResult {
  const [phase, setPhase] = useState<AppPhase>('idle');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<WorkerFailure | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [channelIssue, setChannelIssue] = useState<ChannelIssue | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const clientRef = useRef<ScanWorkerClient | null>(null);
  const cancelRef = useRef<CancelSignal | null>(null);
  const accumulatorRef = useRef<JobAccumulator>(emptyAccumulator());
  const modeRef = useRef<JobMode>('worker');
  const payloadRef = useRef<StartPayload | null>(null);
  const acquireRef = useRef<(() => Promise<StartPayload>) | null>(null);
  const configRef = useRef<ScanConfig | null>(null);

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setDegraded(true);
      return undefined;
    }
    try {
      const client = new ScanWorkerClient(createScanWorker);
      clientRef.current = client;
      if (!client.supported) setDegraded(true);
    } catch {
      setDegraded(true);
    }
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  const handleResponse = useCallback((message: WorkerResponse) => {
    const accumulator = accumulatorRef.current;

    switch (message.type) {
      case 'job:progress':
        setProgress(message.event);
        setPhase((current) =>
          current === 'idle' || current === 'validating' ? 'scanning' : current,
        );
        return;
      case 'job:findings':
        accumulator.findings.push(...message.batch.findings);
        for (const [findingId, raw] of Object.entries(message.batch.rawByFindingId)) {
          rawSnippetStore.set(findingId, raw);
        }
        return;
      case 'job:skipped':
        accumulator.skipped.push(...message.batch.items);
        return;
      case 'job:done': {
        const config = accumulator.config;
        if (!config) {
          setProgress(null);
          setError({
            code: 'CLS-E-2001',
            message: '扫描结果不完整（缺少配置快照）。',
            hint: '请重新上传后重试；若反复出现，请展开诊断信息反馈。',
            fatal: true,
            category: 'unclassified',
            phase: 'finalize',
            retryable: 'reupload',
          });
          setPhase('error');
          setActiveJobId(null);
          return;
        }
        const result: ScanResult = {
          jobId: accumulator.jobId ?? message.completion.jobId,
          config,
          summary: message.completion.summary,
          findings: accumulator.findings,
          skippedFiles: accumulator.skipped,
          skipReasonCounts: message.completion.skipReasonCounts,
          diagnostics: message.completion.diagnostics,
        };
        setProgress(null);
        setPhase(
          message.completion.summary.status === 'empty' ? 'empty' : 'result',
        );
        setActiveJobId(null);
        optionsRef.current.onResult(result);
        return;
      }
      case 'job:error':
        setProgress(null);
        setError(message.failure);
        setPhase('error');
        setActiveJobId(null);
        return;
      case 'job:cancelled':
        setProgress(null);
        setPhase('cancelled');
        setActiveJobId(null);
        return;
      case 'job:pong':
        return;
      default:
        return;
    }
  }, []);

  const runFallback = useCallback(
    async (payload: StartPayload, config: ScanConfig): Promise<void> => {
      modeRef.current = 'fallback';
      setDegraded(true);
      const jobId = newJobId();
      const signal = createCancelSignal();
      cancelRef.current = signal;
      accumulatorRef.current = {
        findings: [],
        skipped: [],
        config,
        jobId,
      };
      setActiveJobId(jobId);
      setPhase('scanning');
      setProgress(null);

      try {
        await runJob(
          {
            protocol: PROTOCOL_VERSION,
            type: 'job:start',
            jobId,
            config,
            payload,
          },
          handleResponse,
          signal,
        );
      } catch (caught) {
        setError(failureFrom(caught));
        setPhase('error');
        setActiveJobId(null);
      }
    },
    [handleResponse],
  );

  const handleChannelIssue = useCallback(
    (issue: ChannelIssue) => {
      setChannelIssue(issue);
      setActiveJobId(null);

      if (modeRef.current === 'fallback') return;

      const config = configRef.current;
      if (!config) return;

      if (!issue.needsReacquire) {
        const payload = payloadRef.current;
        if (payload) {
          setPhase('validating');
          void runFallback(payload, config);
        }
        return;
      }

      const acquire = acquireRef.current;
      if (!acquire) {
        setDegraded(true);
        setPhase('idle');
        setChannelIssue({
          ...issue,
          failure: reuploadFailure(
            issue.failure,
            `${issue.failure.message} 需要重新上传后继续扫描。`,
          ),
        });
        return;
      }

      setDegraded(true);
      setPhase('validating');
      void (async () => {
        try {
          const payload = await acquire();
          await runFallback(payload, config);
        } catch {
          setPhase('idle');
          setChannelIssue({
            ...issue,
            failure: reuploadFailure(
              issue.failure,
              `${issue.failure.message} 无法重新读取该文件，需要重新上传后继续扫描。`,
            ),
          });
        }
      })();
    },
    [runFallback],
  );

  const start = useCallback(
    (payload: StartPayload, acquire?: () => Promise<StartPayload>): void => {
      if (phase === 'scanning' || phase === 'validating') return;

      rawSnippetStore.clear();
      accumulatorRef.current = emptyAccumulator();
      modeRef.current = 'worker';
      payloadRef.current = payload;
      acquireRef.current = acquire ?? null;

      const config = snapshotConfig(optionsRef.current.config);
      configRef.current = config;

      setError(null);
      setProgress(null);
      setChannelIssue(null);
      setDegraded(false);
      setPhase('validating');

      const handlers: ScanHandlers = {
        onProgress: (event) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:progress', event }),
        onFindings: (batch) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:findings', batch }),
        onSkipped: (batch) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:skipped', batch }),
        onDone: (completion) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:done', completion }),
        onError: (failure) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:error', jobId: '', failure }),
        onCancelled: (jobId) =>
          handleResponse({ protocol: PROTOCOL_VERSION, type: 'job:cancelled', jobId }),
        onChannelIssue: handleChannelIssue,
      };

      const client = clientRef.current;
      if (client && client.supported) {
        try {
          const jobId = client.start(payload, handlers, config);
          accumulatorRef.current.config = config;
          accumulatorRef.current.jobId = jobId;
          setActiveJobId(jobId);
          setPhase('scanning');
          return;
        } catch (caught) {
          if (isClsError(caught) && caught.code === 'CLS-E-4001') {
            setDegraded(true);
            void runFallback(payload, config);
            return;
          }
          if (isClsError(caught) && caught.code === 'CLS-E-1017') {
            const acquireFn = acquireRef.current;
            if (acquireFn) {
              setPhase('validating');
              void (async () => {
                try {
                  const next = await acquireFn();
                  await runFallback(next, config);
                } catch {
                  setError(
                    reuploadFailure(
                      failureFrom(caught),
                      '扫描任务无法发送到后台引擎，且无法重新读取该文件；需要重新上传后重试。',
                    ),
                  );
                  setPhase('error');
                }
              })();
              return;
            }
            setError(
              reuploadFailure(
                failureFrom(caught),
                '扫描任务无法发送到后台引擎；需要重新上传后重试。',
              ),
            );
            setPhase('error');
            return;
          }
          setError(failureFrom(caught));
          setPhase('error');
          return;
        }
      }

      setDegraded(true);
      void runFallback(payload, config);
    },
    [phase, handleResponse, handleChannelIssue, runFallback],
  );

  const cancel = useCallback((): void => {
    const jobId = accumulatorRef.current.jobId;
    const client = clientRef.current;
    if (modeRef.current === 'worker' && jobId && client && client.supported) {
      client.cancel(jobId);
      return;
    }
    cancelRef.current?.cancel();
    setProgress(null);
    setPhase('cancelled');
    setActiveJobId(null);
  }, []);

  const reset = useCallback((): void => {
    rawSnippetStore.clear();
    cancelRef.current?.cancel();
    const jobId = accumulatorRef.current.jobId;
    if (jobId) clientRef.current?.cancel(jobId);
    accumulatorRef.current = emptyAccumulator();
    modeRef.current = 'worker';
    payloadRef.current = null;
    acquireRef.current = null;
    configRef.current = null;
    setProgress(null);
    setError(null);
    setChannelIssue(null);
    setDegraded(false);
    setPhase('idle');
    setActiveJobId(null);
    optionsRef.current.onReset?.();
  }, []);

  const buildDiagnostics = useCallback((): DiagnosticsSnapshot => {
    const client = clientRef.current;
    const failure = channelIssue?.failure ?? error ?? null;
    return buildDiagnosticsSnapshot({
      diagnosticId: createDiagnosticId(),
      generatedAt: new Date().toISOString(),
      appVersion: __APP_VERSION__,
      buildMode: currentBuildMode(),
      pageProtocol: currentPageProtocol(),
      engineAvailable: client?.sawEngineMessage ?? false,
      engineSource: client?.engineSource ?? 'none',
      protocolVersion: client?.protocolVersion ?? null,
      counters: channelIssue?.counts ?? client?.snapshotCounters() ?? EMPTY_COUNTERS,
      lastFailure: failure,
      degraded,
      degradeReason: failure?.category ?? null,
      phase,
      elapsedMs: client?.elapsedMs ?? null,
    });
  }, [channelIssue, degraded, error, phase]);

  return {
    phase,
    progress,
    error,
    degraded,
    channelIssue,
    activeJobId,
    start,
    cancel,
    reset,
    buildDiagnostics,
  };
}

export { failureFrom };