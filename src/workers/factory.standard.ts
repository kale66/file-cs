import type { WorkerFactory } from '@/workers/workerFactory';

export const createScanWorker: WorkerFactory = () =>
  new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'classic' });