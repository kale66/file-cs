import InlineScanWorker from '@/workers/scan.worker?worker&inline';
import type { WorkerFactory } from '@/workers/workerFactory';

export const createScanWorker: WorkerFactory = () => new InlineScanWorker();