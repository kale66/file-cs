import { PROTOCOL_VERSION } from '@/types';
import type {
  ChannelCounters,
  ChannelFailureCategory,
  DiagnosticsSnapshot,
  WorkerFailure,
} from '@/types';

export interface DiagnosticsInput {
  readonly diagnosticId: string;
  readonly generatedAt: string;
  readonly appVersion: string;
  readonly buildMode: 'standard' | 'single';
  readonly pageProtocol: 'http' | 'https' | 'file' | 'other';
  readonly engineAvailable: boolean;
  readonly engineSource: 'external' | 'inline' | 'none';
  readonly protocolVersion: number | null;
  readonly counters: ChannelCounters;
  readonly lastFailure: WorkerFailure | null;
  readonly degraded: boolean;
  readonly degradeReason: ChannelFailureCategory | null;
  readonly phase: string;
  readonly elapsedMs: number | null;
}

export const EMPTY_COUNTERS: ChannelCounters = {
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

export function createDiagnosticId(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `diag-${stamp}-${random}`;
}

export function currentPageProtocol(): 'http' | 'https' | 'file' | 'other' {
  if (typeof location === 'undefined') return 'other';
  const protocol = location.protocol;
  if (protocol === 'http:') return 'http';
  if (protocol === 'https:') return 'https';
  if (protocol === 'file:') return 'file';
  return 'other';
}

export function currentBuildMode(): 'standard' | 'single' {
  return typeof __SINGLE_FILE__ !== 'undefined' && __SINGLE_FILE__
    ? 'single'
    : 'standard';
}

export function buildDiagnosticsSnapshot(input: DiagnosticsInput): DiagnosticsSnapshot {
  const failure = input.lastFailure;
  return {
    schema: 1,
    diagnosticId: input.diagnosticId,
    generatedAt: input.generatedAt,
    appVersion: input.appVersion,
    buildMode: input.buildMode,
    pageProtocol: input.pageProtocol,
    engineAvailable: input.engineAvailable,
    engineSource: input.engineSource,
    protocolVersion: input.protocolVersion,
    protocolExpected: PROTOCOL_VERSION,
    counters: {
      progress: input.counters.progress,
      findings: input.counters.findings,
      skipped: input.counters.skipped,
      invalid: input.counters.invalid,
      staleJob: input.counters.staleJob,
      ping: input.counters.ping,
      pong: input.counters.pong,
      loadFailure: input.counters.loadFailure,
      rebuild: input.counters.rebuild,
      stalledAlive: input.counters.stalledAlive,
    },
    lastFailure:
      failure && failure.category
        ? {
            code: failure.code,
            category: failure.category,
            phase: failure.phase ?? 'ready',
            atMs: typeof input.elapsedMs === 'number' ? input.elapsedMs : 0,
          }
        : null,
    degraded: input.degraded,
    degradeReason: input.degradeReason,
    phase: input.phase,
    elapsedMs: input.elapsedMs,
  };
}

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /[A-Za-z]:\\/,
  /\/(home|Users)\//,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN/,
  /eyJ[A-Za-z0-9_-]{10,}\./,
  /"(jobId|fileName|filePath|rawSnippet|rawValue|maskedSnippet|snippetText)"/,
  /"stack"/,
];

export function assertSnapshotSafe(snapshot: DiagnosticsSnapshot): void {
  const json = JSON.stringify(snapshot);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(json)) {
      throw new Error('diagnostics snapshot contains forbidden content');
    }
  }
}

export function snapshotToJson(snapshot: DiagnosticsSnapshot): string {
  assertSnapshotSafe(snapshot);
  return JSON.stringify(snapshot, null, 2);
}