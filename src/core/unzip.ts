import JSZip from 'jszip';
import { LIMITS } from '@/types';
import type {
  ArchiveEntryMeta,
  BombGuardDecision,
  PathValidation,
  ScanConfig,
} from '@/types';
import { ClsError } from '@/core/errors';
import {
  comparePathAsc,
  isIllegalArchivePath,
  normalizeArchivePath,
  toDisplayPath,
} from '@/core/path';

interface ZipEntryData {
  readonly uncompressedSize?: number;
  readonly compressedSize?: number;
}

interface ZipEntryInternals {
  readonly _data?: ZipEntryData;
}

export interface ArchiveReadOptions {
  readonly jobId: string;
  readonly config: ScanConfig;
  readonly onEntryChecked?: (checked: number, total: number) => void;
}

export interface ArchiveReader {
  readonly kind: 'zip' | 'folder';
  readonly entries: readonly ArchiveEntryMeta[];
  readonly totalUncompressedBytes: number;
  readEntry(entry: ArchiveEntryMeta): Promise<Uint8Array>;
  dispose(): void;
}

export interface FolderInputFile {
  readonly path: string;
  readonly file: File;
}

export function validateArchivePath(rawPath: string): PathValidation {
  return isIllegalArchivePath(rawPath);
}

function readInternals(file: JSZip.JSZipObject): ZipEntryInternals {
  return file as unknown as ZipEntryInternals;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/**
 * 直接从 zip 中央目录读取原始条目名。
 * JSZip 在 loadAsync 时会剥离 `../` 段，导致无法登记路径穿越；这里保留原始名用于安全判定。
 */
export function readCentralDirectoryNames(data: ArrayBuffer): string[] | null {
  const view = new DataView(data);
  const length = data.byteLength;
  if (length < 22) return null;

  const searchLimit = Math.min(length, 65_557);
  let eocdOffset = -1;
  for (let offset = length - 22; offset >= length - searchLimit; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return null;

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (entryCount === 0xffff || centralOffset === 0xffffffff) return null;
  if (centralOffset + centralSize > length) return null;

  const decoder = new TextDecoder('utf-8');
  const names: string[] = [];
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > length) return null;
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return null;

    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const nameStart = cursor + 46;
    if (nameStart + nameLength > length) return null;

    const nameBytes = new Uint8Array(data, nameStart, nameLength);
    names.push(decoder.decode(nameBytes));
    cursor = nameStart + nameLength + extraLength + commentLength;
  }

  return names;
}

function buildMeta(
  rawName: string,
  isDirectory: boolean,
  readIndex: number,
  file: JSZip.JSZipObject | null,
): ArchiveEntryMeta {
  const validation = validateArchivePath(rawName);
  const internals = file ? readInternals(file) : null;
  const uncompressedSize =
    internals?._data?.uncompressedSize !== undefined
      ? internals._data.uncompressedSize
      : null;
  const compressedSize =
    internals?._data?.compressedSize !== undefined
      ? internals._data.compressedSize
      : null;
  return {
    path: validation.legal ? validation.normalized : normalizeArchivePath(rawName),
    displayName: toDisplayPath(validation.normalized),
    isDirectory,
    compressedSize,
    uncompressedSize,
    encrypted: false,
    pathValidation: validation,
    readIndex,
  };
}

export interface BombGuard {
  inspectMetadata(meta: ArchiveEntryMeta): BombGuardDecision;
  accountRead(meta: ArchiveEntryMeta, actualBytes: number): BombGuardDecision;
}

class BombGuardImpl implements BombGuard {
  private readonly totalLimit: number;
  private metadataTotal = 0;
  private actualTotal = 0;
  private abortDecision: BombGuardDecision | null = null;

  constructor(private readonly entryCount: number, config: ScanConfig) {
    this.totalLimit = Math.min(config.maxTotalUnzipBytes, LIMITS.maxTotalUnzipBytes);
    if (entryCount > LIMITS.maxEntries) {
      this.abortDecision = {
        action: 'abort',
        reason: 'entry-count',
        observed: entryCount,
        limit: LIMITS.maxEntries,
      };
    }
  }

  private abort(
    reason: BombGuardDecision['reason'],
    observed: number,
    limit: number,
  ): BombGuardDecision {
    this.abortDecision = { action: 'abort', reason, observed, limit };
    return this.abortDecision;
  }

  inspectMetadata(meta: ArchiveEntryMeta): BombGuardDecision {
    if (this.abortDecision) return this.abortDecision;

    if (meta.uncompressedSize !== null) {
      this.metadataTotal += meta.uncompressedSize;
      if (this.metadataTotal > this.totalLimit) {
        return this.abort('total-bytes', this.metadataTotal, this.totalLimit);
      }
      if (
        meta.compressedSize !== null &&
        meta.compressedSize > 0 &&
        meta.uncompressedSize > LIMITS.maxCompressionRatioFloorBytes &&
        meta.uncompressedSize / meta.compressedSize > LIMITS.maxCompressionRatio
      ) {
        return this.abort(
          'compression-ratio',
          Math.round(meta.uncompressedSize / meta.compressedSize),
          LIMITS.maxCompressionRatio,
        );
      }
    }

    return {
      action: 'continue',
      reason: null,
      observed: this.metadataTotal,
      limit: this.totalLimit,
    };
  }

  accountRead(meta: ArchiveEntryMeta, actualBytes: number): BombGuardDecision {
    if (this.abortDecision) return this.abortDecision;
    this.actualTotal += actualBytes;
    const observed = Math.max(this.metadataTotal, this.actualTotal);
    if (observed > this.totalLimit) {
      return this.abort('total-bytes', observed, this.totalLimit);
    }
    if (
      meta.compressedSize !== null &&
      meta.compressedSize > 0 &&
      actualBytes > LIMITS.maxCompressionRatioFloorBytes &&
      actualBytes / meta.compressedSize > LIMITS.maxCompressionRatio
    ) {
      return this.abort(
        'compression-ratio',
        Math.round(actualBytes / meta.compressedSize),
        LIMITS.maxCompressionRatio,
      );
    }
    return {
      action: 'continue',
      reason: null,
      observed,
      limit: this.totalLimit,
    };
  }
}

export function createBombGuard(config: ScanConfig, entryCount: number): BombGuard {
  return new BombGuardImpl(entryCount, config);
}

export async function openZipArchive(
  data: ArrayBuffer,
  options: ArchiveReadOptions,
): Promise<ArchiveReader> {
  if (data.byteLength > options.config.maxArchiveBytes) {
    throw new ClsError('CLS-E-1002');
  }
  if (data.byteLength === 0) {
    throw new ClsError('CLS-E-1006');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data, { checkCRC32: false });
  } catch {
    throw new ClsError('CLS-E-1003');
  }

  const objects: JSZip.JSZipObject[] = [];
  const metas: ArchiveEntryMeta[] = [];
  const rawNames = readCentralDirectoryNames(data);
  let readIndex = 0;
  let checked = 0;
  let centralIndex = 0;

  for (const name of Object.keys(zip.files)) {
    const file = zip.files[name];
    if (!file) continue;
    const rawName = rawNames?.[centralIndex] ?? name;
    centralIndex += 1;
    if (file.dir || name.endsWith('/')) continue;
    objects.push(file);
    metas.push(buildMeta(rawName, false, readIndex, file));
    readIndex += 1;
    checked += 1;
    options.onEntryChecked?.(checked, readIndex);
  }

  if (metas.length > LIMITS.maxEntries) {
    throw new ClsError('CLS-E-1005');
  }

  const guard = createBombGuard(options.config, metas.length);
  for (const meta of metas) {
    const decision = guard.inspectMetadata(meta);
    if (decision.action === 'abort') {
      throw new ClsError('CLS-E-1005');
    }
  }

  const sorted = metas.slice().sort((a, b) => comparePathAsc(a.path, b.path));
  const totalUncompressedBytes = metas.reduce(
    (sum, meta) => sum + (meta.uncompressedSize ?? 0),
    0,
  );

  let disposed = false;
  let archive: JSZip | null = zip;

  return {
    kind: 'zip',
    entries: sorted,
    totalUncompressedBytes,
    async readEntry(entry: ArchiveEntryMeta): Promise<Uint8Array> {
      if (disposed || archive === null) {
        throw new ClsError('CLS-E-1003');
      }
      const target = archive.files[entry.path];
      const object = target ?? objects[entry.readIndex];
      if (!object) {
        throw new ClsError('CLS-E-1010');
      }
      try {
        const bytes = await object.async('uint8array');
        const decision = guard.accountRead(entry, bytes.byteLength);
        if (decision.action === 'abort') {
          throw new ClsError('CLS-E-1005');
        }
        return bytes;
      } catch (error) {
        if (error instanceof ClsError) throw error;
        const message =
          error instanceof Error ? error.message : String(error);
        if (/encrypt/i.test(message)) {
          throw new ClsError('CLS-E-1004');
        }
        throw new ClsError('CLS-E-1003');
      }
    },
    dispose() {
      disposed = true;
      archive = null;
      objects.length = 0;
    },
  };
}

export function buildFolderReader(
  files: readonly FolderInputFile[],
  options: ArchiveReadOptions,
): ArchiveReader {
  if (typeof File === 'undefined' && files.length > 0) {
    throw new ClsError('CLS-E-1009');
  }
  if (files.length === 0) {
    throw new ClsError('CLS-E-1006');
  }

  const byPath = new Map<string, ArchiveEntryMeta>();
  let readIndex = 0;

  for (const input of files) {
    const validation = validateArchivePath(input.path);
    const path = validation.legal ? validation.normalized : input.path;
    if (byPath.has(path)) continue;
    const meta: ArchiveEntryMeta = {
      path,
      displayName: toDisplayPath(validation.normalized),
      isDirectory: false,
      compressedSize: null,
      uncompressedSize: input.file.size,
      encrypted: false,
      pathValidation: validation,
      readIndex,
    };
    byPath.set(path, meta);
    readIndex += 1;
    options.onEntryChecked?.(readIndex, files.length);
  }

  const metas = [...byPath.values()].sort((a, b) => comparePathAsc(a.path, b.path));
  const guard = createBombGuard(options.config, metas.length);
  for (const meta of metas) {
    if (guard.inspectMetadata(meta).action === 'abort') {
      throw new ClsError('CLS-E-1005');
    }
  }

  const fileByPath = new Map<string, File>();
  for (const input of files) {
    const validation = validateArchivePath(input.path);
    const path = validation.legal ? validation.normalized : input.path;
    if (!fileByPath.has(path)) fileByPath.set(path, input.file);
  }

  return {
    kind: 'folder',
    entries: metas,
    totalUncompressedBytes: metas.reduce(
      (sum, meta) => sum + (meta.uncompressedSize ?? 0),
      0,
    ),
    async readEntry(entry: ArchiveEntryMeta): Promise<Uint8Array> {
      const file = fileByPath.get(entry.path);
      if (!file) throw new ClsError('CLS-E-1010');
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (guard.accountRead(entry, bytes.byteLength).action === 'abort') {
          throw new ClsError('CLS-E-1005');
        }
        return bytes;
      } catch (error) {
        if (error instanceof ClsError) throw error;
        throw new ClsError('CLS-E-1010');
      }
    },
    dispose() {
      fileByPath.clear();
    },
  };
}