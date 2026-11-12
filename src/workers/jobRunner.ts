import { LIMITS, PROTOCOL_VERSION } from '@/types';
import type {
  ArchiveEntryMeta,
  Finding,
  FindingSeed,
  FileClassification,
  ScanConfig,
  ScanDiagnostic,
  ScanPhase,
  ScanProgress,
  ScanSummary,
  SkippedFile,
  WorkerFailure,
  WorkerResponse,
  WorkerStartRequest,
} from '@/types';
import { ClsError, isClsError, toErrorInfo } from '@/core/errors';
import { openZipArchive, buildFolderReader } from '@/core/unzip';
import type { ArchiveReader, FolderInputFile } from '@/core/unzip';
import { decideScan, summarizeSkipReasons } from '@/core/fileFilter';
import { getEnabledRules } from '@/core/rules';
import {
  buildSummary,
  dedupeMatches,
  finalizeFindings,
  scanFile,
  sortFindingSeeds,
} from '@/core/scanner';
import type { ScanContext } from '@/core/scanner';
import { decodeUtf8 } from '@/core/text';

export interface CancelSignal {
  readonly cancelled: boolean;
  cancel(): void;
}

export function createCancelSignal(): CancelSignal {
  let cancelled = false;
  return {
    get cancelled(): boolean {
      return cancelled;
    },
    cancel(): void {
      cancelled = true;
    },
  };
}

class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

const PHASE_RANGES: Readonly<Record<ScanPhase, readonly [number, number]>> = {
  idle: [0, 0],
  validating: [0, 5],
  unzipping: [5, 20],
  filtering: [20, 35],
  scanning: [35, 95],
  finalizing: [95, 100],
};

const FINDING_BATCH_SIZE = 100;
const SKIPPED_BATCH_SIZE = 100;

function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function toFailure(error: unknown): WorkerFailure {
  const info = toErrorInfo(error);
  return {
    code: info.code,
    message: info.message,
    hint: info.hint,
    fatal: info.fatal,
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

interface ScanTarget {
  readonly entry: ArchiveEntryMeta;
  readonly classification: FileClassification;
}

export async function runJob(
  request: WorkerStartRequest,
  emit: (message: WorkerResponse) => void,
  signal: CancelSignal,
): Promise<void> {
  const jobId = request.jobId;
  const config: ScanConfig = request.config;
  const startTime = performance.now();
  let reader: ArchiveReader | null = null;
  let lastEmitAt = 0;
  let lastPercent = 0;

  const emitProgress = (
    phase: ScanPhase,
    processed: number,
    total: number,
    currentPath: string | null,
    force = false,
  ): void => {
    const now = performance.now();
    if (!force && now - lastEmitAt < 100) return;
    lastEmitAt = now;
    const range = PHASE_RANGES[phase];
    const ratio = total > 0 ? Math.min(1, processed / total) : 1;
    const computed = range[0] + (range[1] - range[0]) * ratio;
    const percent = Math.min(100, Math.max(lastPercent, Math.round(computed * 10) / 10));
    lastPercent = percent;
    const event: ScanProgress = {
      jobId,
      phase,
      percent,
      processed,
      total,
      currentPath,
      elapsedMs: Math.round(now - startTime),
    };
    emit({ protocol: PROTOCOL_VERSION, type: 'job:progress', event });
  };

  const checkCancelled = (): void => {
    if (signal.cancelled) throw new CancelledError();
  };

  const skipped: SkippedFile[] = [];
  const diagnostics: ScanDiagnostic[] = [];
  let totalFiles = 0;
  let scannedFiles = 0;

  try {
    emitProgress('validating', 0, 0, null, true);

    if (request.payload.source === 'zip') {
      emitProgress('unzipping', 0, 0, null, true);
      reader = await openZipArchive(request.payload.data, {
        jobId,
        config,
        onEntryChecked: (checked, total) => {
          emitProgress('unzipping', checked, total, null);
        },
      });
    } else {
      const files: FolderInputFile[] = request.payload.files.map((item) => ({
        path: item.path,
        file: item.file,
      }));
      reader = buildFolderReader(files, { jobId, config });
    }

    const entries = reader.entries.filter((entry) => !entry.isDirectory);
    totalFiles = entries.length;

    emitProgress('filtering', 0, totalFiles, null, true);
    const targets: ScanTarget[] = [];

    for (let index = 0; index < entries.length; index += 1) {
      checkCancelled();
      const entry = entries[index];
      if (!entry) continue;
      const decision = decideScan(entry, config);
      if (decision.action === 'skip') {
        skipped.push({
          path: entry.path,
          reason: decision.skipReason ?? 'unsupported-extension',
          sizeBytes: entry.uncompressedSize,
          detail: decision.detail,
        });
      } else {
        targets.push({ entry, classification: decision.classification });
      }
      if (index % 200 === 0) {
        emitProgress('filtering', index + 1, totalFiles, entry.path);
        await yieldToLoop();
      }
    }

    emitProgress('filtering', totalFiles, totalFiles, null, true);

    const context: ScanContext = {
      config,
      rules: getEnabledRules(config),
      maxSnippetBytes: LIMITS.maxSnippetBytes,
    };
    const seeds: FindingSeed[] = [];

    emitProgress('scanning', 0, targets.length, null, true);

    for (let index = 0; index < targets.length; index += 1) {
      checkCancelled();
      const target = targets[index];
      if (!target) continue;
      const { entry, classification } = target;

      let bytes: Uint8Array | null = null;
      try {
        bytes = await reader.readEntry(entry);
        const decoded = decodeUtf8(bytes);
        bytes = null;

        const outcome = scanFile(
          {
            filePath: entry.path,
            text: decoded.text,
            classification,
          },
          context,
        );

        seeds.push(...dedupeMatches(outcome.matches, context));
        for (const diagnostic of outcome.diagnostics) {
          if (diagnostics.length < 5000) {
            diagnostics.push({
              filePath: entry.path,
              code: diagnostic.code,
              line: diagnostic.line,
              detail: diagnostic.detail,
            });
          }
        }
        scannedFiles += 1;
      } catch (error) {
        bytes = null;
        if (isClsError(error) && (error.code === 'CLS-E-1005' || error.code === 'CLS-E-1004')) {
          throw error;
        }
        if (isClsError(error) && error.code === 'CLS-E-1003') {
          throw error;
        }
        skipped.push({
          path: entry.path,
          reason: 'parse-error',
          sizeBytes: entry.uncompressedSize,
          detail: isClsError(error) ? error.hint : '读取或解析失败，已跳过该文件',
        });
      }

      emitProgress('scanning', index + 1, targets.length, entry.path);
      if (index % 5 === 0) await yieldToLoop();
    }

    emitProgress('finalizing', 0, 0, null, true);

    const sortedSeeds = sortFindingSeeds(seeds);
    const findings = finalizeFindings(sortedSeeds, jobId);

    let sequence = 0;
    let rawBudget = 0;

    for (let offset = 0; offset < findings.length; offset += FINDING_BATCH_SIZE) {
      checkCancelled();
      const chunk = findings.slice(offset, offset + FINDING_BATCH_SIZE);
      const rawByFindingId: Record<string, string> = {};
      chunk.forEach((finding: Finding, chunkIndex: number) => {
        const seed = sortedSeeds[offset + chunkIndex];
        if (!seed) return;
        const raw = seed.rawSnippet;
        if (raw.length === 0) return;
        const size = byteLength(raw);
        if (size > LIMITS.maxRevealBytesPerFinding) return;
        if (rawBudget + size > LIMITS.maxRevealTotalBytes) return;
        rawByFindingId[finding.id] = raw;
        rawBudget += size;
      });

      emit({
        protocol: PROTOCOL_VERSION,
        type: 'job:findings',
        batch: {
          jobId,
          sequence,
          findings: chunk,
          rawByFindingId,
        },
      });
      sequence += 1;
      await yieldToLoop();
    }

    for (let offset = 0; offset < skipped.length; offset += SKIPPED_BATCH_SIZE) {
      checkCancelled();
      const items = skipped.slice(offset, offset + SKIPPED_BATCH_SIZE);
      emit({
        protocol: PROTOCOL_VERSION,
        type: 'job:skipped',
        batch: { jobId, sequence, items },
      });
      sequence += 1;
      await yieldToLoop();
    }

    const status = targets.length === 0 ? 'empty' : 'completed';
    const summary: ScanSummary = buildSummary({
      totalFiles,
      scannedFiles,
      skippedFiles: skipped.length,
      findings,
      durationMs: performance.now() - startTime,
      status,
    });

    emitProgress('finalizing', 1, 1, null, true);

    emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:done',
      completion: {
        jobId,
        summary,
        skippedTotal: skipped.length,
        skipReasonCounts: summarizeSkipReasons(skipped),
        diagnostics: diagnostics.slice(0, 200),
        diagnosticTotal: diagnostics.length,
      },
    });
  } catch (error) {
    if (signal.cancelled || error instanceof CancelledError) {
      emit({ protocol: PROTOCOL_VERSION, type: 'job:cancelled', jobId });
      return;
    }

    if (error instanceof ClsError) {
      emit({
        protocol: PROTOCOL_VERSION,
        type: 'job:error',
        jobId,
        failure: toFailure(error),
      });
      return;
    }

    emit({
      protocol: PROTOCOL_VERSION,
      type: 'job:error',
      jobId,
      failure: toFailure(error),
    });
  } finally {
    reader?.dispose();
  }
}