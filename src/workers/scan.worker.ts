import type { ChannelPhase, WorkerRequest, WorkerResponse } from '@/types';
import { PROTOCOL_VERSION, isWorkerRequest } from '@/workers/protocol';
import { createCancelSignal, runJob } from '@/workers/jobRunner';
import type { CancelSignal } from '@/workers/jobRunner';

interface WorkerScope {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  close(): void;
}

declare const self: WorkerScope;

let activeJobId: string | null = null;
let activeSignal: CancelSignal | null = null;
let activePhase: ChannelPhase = 'create';

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (!isWorkerRequest(request)) return;

  if (request.type === 'job:cancel') {
    if (request.jobId === activeJobId) {
      activeSignal?.cancel();
    }
    return;
  }

  if (request.type === 'job:ping') {
    if (request.jobId === activeJobId) {
      self.postMessage({
        protocol: PROTOCOL_VERSION,
        type: 'job:pong',
        jobId: request.jobId,
        phase: activePhase,
      });
    }
    return;
  }

  activeSignal?.cancel();
  const signal = createCancelSignal();
  const jobId = request.jobId;
  activeJobId = jobId;
  activeSignal = signal;
  activePhase = 'running';

  void runJob(request, (message) => self.postMessage(message), signal).finally(() => {
    if (activeJobId === jobId) {
      activeJobId = null;
      activeSignal = null;
      activePhase = 'finalize';
    }
  });
};