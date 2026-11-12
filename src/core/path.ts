import type { IllegalPathReason, PathValidation } from '@/types';

const DRIVE_LETTER_RE = /^[A-Za-z]:/;
const MAX_SEGMENT_LENGTH = 255;
const MAX_PATH_LENGTH = 1024;

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function normalizeArchivePath(rawPath: string): string {
  const unified = rawPath.replace(/\\/g, '/');
  const segments = unified.split('/').filter((segment) => segment !== '' && segment !== '.');
  return segments.join('/');
}

export function isIllegalArchivePath(rawPath: string): PathValidation {
  const unified = rawPath.replace(/\\/g, '/');
  const normalized = normalizeArchivePath(rawPath);
  const reject = (reason: IllegalPathReason): PathValidation => ({
    legal: false,
    normalized,
    reason,
  });

  if (hasControlCharacter(unified)) {
    return reject('control-character');
  }
  if (DRIVE_LETTER_RE.test(unified)) {
    return reject('drive-letter');
  }
  if (unified.startsWith('/')) {
    return reject('absolute-path');
  }

  const rawSegments = unified.split('/');
  if (rawSegments.some((segment) => segment === '..')) {
    return reject('parent-segment');
  }
  if (normalized.length === 0) {
    return reject('empty-segment');
  }
  if (normalized.length > MAX_PATH_LENGTH) {
    return reject('path-too-long');
  }
  if (normalized.split('/').some((segment) => segment.length > MAX_SEGMENT_LENGTH)) {
    return reject('path-too-long');
  }

  return { legal: true, normalized, reason: null };
}

export function comparePathAsc(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function toDisplayPath(path: string, maxLength = 64): string {
  if (path.length <= maxLength) return path;
  const dotIndex = path.lastIndexOf('.');
  const extension = dotIndex > 0 ? path.slice(dotIndex) : '';
  const tailLength = Math.max(12, Math.min(24, extension.length + 16));
  const headLength = Math.max(8, maxLength - tailLength - 1);
  return `${path.slice(0, headLength)}…${path.slice(-tailLength)}`;
}