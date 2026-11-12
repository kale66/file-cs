import type {
  CommentSnippet,
  SourceKind,
} from '@/types';
import { sliceByBytes } from '@/core/text';

export interface LineIndex {
  readonly starts: readonly number[];
  lineAt(offset: number): number;
}

export function buildLineIndex(text: string): LineIndex {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return {
    starts,
    lineAt(offset: number): number {
      let low = 0;
      let high = starts.length - 1;
      const safeOffset = Math.max(0, offset);
      while (low <= high) {
        const mid = (low + high) >> 1;
        const value = starts[mid] ?? 0;
        const next = starts[mid + 1];
        if (safeOffset < value) {
          high = mid - 1;
        } else if (next !== undefined && safeOffset >= next) {
          low = mid + 1;
        } else {
          return mid + 1;
        }
      }
      return Math.max(1, Math.min(low + 1, starts.length));
    },
  };
}

export interface SnippetBuilder {
  addLine(
    startLine: number,
    text: string,
    sourceKind: SourceKind,
    inCodeFence: boolean,
  ): void;
  addBlock(
    startLine: number,
    endLine: number,
    text: string,
    sourceKind: SourceKind,
    inCodeFence: boolean,
  ): void;
  finish(): readonly CommentSnippet[];
}

interface PendingLine {
  startLine: number;
  endLine: number;
  lines: string[];
  sourceKind: SourceKind;
  inCodeFence: boolean;
}

const MAX_PENDING_LINES = 200;

export function createSnippetBuilder(maxSnippetBytes: number): SnippetBuilder {
  const snippets: CommentSnippet[] = [];
  let pending: PendingLine | null = null;

  const pushSnippet = (
    startLine: number,
    endLine: number,
    raw: string,
    sourceKind: SourceKind,
    inCodeFence: boolean,
  ): void => {
    const sliced = sliceByBytes(raw, maxSnippetBytes);
    snippets.push({
      startLine,
      endLine,
      text: sliced.text,
      sourceKind,
      inCodeFence,
      truncated: sliced.truncated,
    });
  };

  const flush = (): void => {
    if (!pending) return;
    const body = pending.lines.join('\n');
    pushSnippet(
      pending.startLine,
      pending.endLine,
      body,
      pending.sourceKind,
      pending.inCodeFence,
    );
    pending = null;
  };

  return {
    addLine(startLine, text, sourceKind, inCodeFence) {
      if (
        pending &&
        sourceKind === 'line-comment' &&
        pending.inCodeFence === inCodeFence &&
        pending.endLine + 1 === startLine &&
        pending.lines.length < MAX_PENDING_LINES
      ) {
        pending.lines.push(text);
        pending.endLine = startLine;
        return;
      }
      flush();
      pending = {
        startLine,
        endLine: startLine,
        lines: [text],
        sourceKind,
        inCodeFence,
      };
    },
    addBlock(startLine, endLine, text, sourceKind, inCodeFence) {
      flush();
      pushSnippet(startLine, endLine, text, sourceKind, inCodeFence);
    },
    finish() {
      flush();
      return snippets;
    },
  };
}

export function trimCommentLine(value: string): string {
  return value.replace(/[ \t]+$/g, '');
}