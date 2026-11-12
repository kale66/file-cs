import { LIMITS } from '@/types';
import type { RawSnippetStore } from '@/types';

const encoder = new TextEncoder();

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

export function createRawSnippetStore(): RawSnippetStore {
  const entries = new Map<string, string>();
  let totalBytes = 0;

  return {
    get(findingId: string): string | undefined {
      return entries.get(findingId);
    },
    set(findingId: string, raw: string): boolean {
      const size = byteLength(raw);
      if (size > LIMITS.maxRevealBytesPerFinding) return false;
      const existing = entries.get(findingId);
      const existingSize = existing === undefined ? 0 : byteLength(existing);
      if (totalBytes - existingSize + size > LIMITS.maxRevealTotalBytes) {
        return false;
      }
      entries.set(findingId, raw);
      totalBytes = totalBytes - existingSize + size;
      return true;
    },
    delete(findingId: string): void {
      const existing = entries.get(findingId);
      if (existing === undefined) return;
      totalBytes -= byteLength(existing);
      entries.delete(findingId);
    },
    clear(): void {
      entries.clear();
      totalBytes = 0;
    },
    get totalBytes(): number {
      return totalBytes;
    },
    get count(): number {
      return entries.size;
    },
  };
}

export const rawSnippetStore: RawSnippetStore = createRawSnippetStore();