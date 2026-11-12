import { PROTOCOL_VERSION } from '@/types';
import type {
  ChannelPhase,
  ScanConfig,
  StartPayload,
  WorkerCancelRequest,
  WorkerPingRequest,
  WorkerRequest,
  WorkerResponse,
  WorkerStartRequest,
} from '@/types';

export { PROTOCOL_VERSION };

const KNOWN_RESPONSE_TYPES = new Set([
  'job:progress',
  'job:findings',
  'job:skipped',
  'job:done',
  'job:error',
  'job:cancelled',
  'job:pong',
]);

export type InboundClassification =
  | { readonly kind: 'accepted'; readonly response: WorkerResponse }
  | { readonly kind: 'stale'; readonly jobId: string | null }
  | { readonly kind: 'protocol-mismatch'; readonly received: number }
  | { readonly kind: 'invalid'; readonly detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function createJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function newJobId(): string {
  return createJobId();
}

export function createStartRequest(
  payload: StartPayload,
  config: ScanConfig,
): WorkerStartRequest {
  return {
    protocol: PROTOCOL_VERSION,
    type: 'job:start',
    jobId: createJobId(),
    config,
    payload,
  };
}

export function createStartRequestWithId(
  jobId: string,
  payload: StartPayload,
  config: ScanConfig,
): WorkerStartRequest {
  return {
    protocol: PROTOCOL_VERSION,
    type: 'job:start',
    jobId,
    config,
    payload,
  };
}

export function createCancelRequest(jobId: string): WorkerCancelRequest {
  return {
    protocol: PROTOCOL_VERSION,
    type: 'job:cancel',
    jobId,
  };
}

export function createPingRequest(jobId: string): WorkerPingRequest {
  return {
    protocol: PROTOCOL_VERSION,
    type: 'job:ping',
    jobId,
  };
}

function isStartPayload(value: unknown): value is StartPayload {
  if (!isRecord(value)) return false;
  if (value.source === 'zip') {
    return (
      typeof value.fileName === 'string' &&
      typeof value.sizeBytes === 'number' &&
      (value.data instanceof ArrayBuffer || ArrayBuffer.isView(value.data))
    );
  }
  if (value.source === 'folder') {
    return (
      typeof value.folderName === 'string' &&
      Array.isArray(value.files) &&
      typeof value.totalBytes === 'number'
    );
  }
  return false;
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value)) return false;
  if (value.protocol !== PROTOCOL_VERSION) return false;
  if (typeof value.jobId !== 'string' || value.jobId.length === 0) return false;

  switch (value.type) {
    case 'job:start':
      return isRecord(value.config) && isStartPayload(value.payload);
    case 'job:cancel':
    case 'job:ping':
      return true;
    default:
      return false;
  }
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value)) return false;
  if (value.protocol !== PROTOCOL_VERSION) return false;

  switch (value.type) {
    case 'job:progress':
      return isRecord(value.event) && typeof value.event.jobId === 'string';
    case 'job:findings':
      return (
        isRecord(value.batch) &&
        typeof value.batch.jobId === 'string' &&
        Array.isArray(value.batch.findings)
      );
    case 'job:skipped':
      return (
        isRecord(value.batch) &&
        typeof value.batch.jobId === 'string' &&
        Array.isArray(value.batch.items)
      );
    case 'job:done':
      return isRecord(value.completion) && typeof value.completion.jobId === 'string';
    case 'job:error':
      return (
        typeof value.jobId === 'string' &&
        value.jobId.length > 0 &&
        isRecord(value.failure) &&
        typeof value.failure.code === 'string'
      );
    case 'job:cancelled':
    case 'job:pong':
      return typeof value.jobId === 'string' && value.jobId.length > 0;
    default:
      return false;
  }
}

export function responseJobId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'job:progress':
      return isRecord(value.event) ? asString(value.event.jobId) : null;
    case 'job:findings':
    case 'job:skipped':
      return isRecord(value.batch) ? asString(value.batch.jobId) : null;
    case 'job:done':
      return isRecord(value.completion) ? asString(value.completion.jobId) : null;
    case 'job:error':
    case 'job:cancelled':
    case 'job:pong':
      return asString(value.jobId);
    default:
      return null;
  }
}

/**
 * 收件归因：区分 accepted / stale（旧作业串扰）/ protocol-mismatch / invalid。
 * 判定顺序：类型 → 协议版本 → 结构 → 作业归属。
 */
export function classifyInbound(
  value: unknown,
  activeJobId: string,
): InboundClassification {
  if (!isRecord(value)) {
    return { kind: 'invalid', detail: 'not-an-object' };
  }
  if (typeof value.type !== 'string' || !KNOWN_RESPONSE_TYPES.has(value.type)) {
    return { kind: 'invalid', detail: 'unknown-type' };
  }
  if (typeof value.protocol === 'number' && value.protocol !== PROTOCOL_VERSION) {
    return { kind: 'protocol-mismatch', received: value.protocol };
  }
  if (!isWorkerResponse(value)) {
    return { kind: 'invalid', detail: 'shape' };
  }
  const jobId = responseJobId(value);
  if (jobId !== activeJobId) {
    return { kind: 'stale', jobId };
  }
  return { kind: 'accepted', response: value };
}

export function isProtocolMismatch(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    KNOWN_RESPONSE_TYPES.has(value.type) &&
    typeof value.protocol === 'number' &&
    value.protocol !== PROTOCOL_VERSION
  );
}

export type { ChannelPhase };