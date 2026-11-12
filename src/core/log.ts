import type { ClsErrorCode, ScanPhase } from '@/types';

export type LogKind = 'phase' | 'progress' | 'skip-count' | 'duration' | 'error-code';

export interface LogRecord {
  readonly kind: LogKind;
  readonly count?: number;
  readonly durationMs?: number;
  readonly code?: ClsErrorCode;
  readonly phase?: ScanPhase;
}

export function logEvent(record: LogRecord): void {
  if (record.kind === 'error-code') {
    console.error(`[commentleak] error ${record.code ?? 'unknown'}`);
    return;
  }
  if (import.meta.env.DEV) {
    if (record.kind === 'duration') {
      console.info(`[commentleak] duration ${String(record.durationMs ?? 0)}ms`);
      return;
    }
    if (record.kind === 'phase') {
      console.info(`[commentleak] phase ${record.phase ?? 'unknown'}`);
      return;
    }
    console.info(`[commentleak] ${record.kind} ${String(record.count ?? 0)}`);
  }
}