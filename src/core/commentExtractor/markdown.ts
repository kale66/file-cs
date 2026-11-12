import type { CommentSnippet, MarkdownOptions } from '@/types';
import { createSnippetBuilder } from '@/core/commentExtractor/comments';

interface FenceInfo {
  readonly char: string;
  readonly length: number;
  readonly indent: number;
}

const FENCE_START_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const FENCE_END_RE = /^( {0,3})(`{3,}|~{3,})\s*$/;

function parseFenceStart(line: string): FenceInfo | null {
  const match = FENCE_START_RE.exec(line);
  if (!match) return null;
  const indent = (match[1] ?? '').length;
  const marker = match[2] ?? '';
  return {
    char: marker.charAt(0),
    length: marker.length,
    indent,
  };
}

function isFenceEnd(line: string, fence: FenceInfo): boolean {
  const match = FENCE_END_RE.exec(line);
  if (!match) return false;
  const marker = match[2] ?? '';
  return marker.charAt(0) === fence.char && marker.length >= fence.length;
}

export function extractMarkdown(
  text: string,
  options: MarkdownOptions,
): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const lines = text.split('\n');
  const startLine = options.startLine ?? 1;

  let inFence = false;
  let fence: FenceInfo | null = null;
  let fenceStartLine = startLine;
  let blockStartLine = startLine;
  let blockInFence = false;
  let blockLines: string[] = [];
  let previousLineNumber = startLine - 1;

  const flush = (endLine: number): void => {
    if (blockLines.length === 0) return;
    builder.addBlock(
      blockStartLine,
      endLine,
      blockLines.join('\n'),
      blockInFence ? 'fence-sample' : 'document',
      blockInFence,
    );
    blockLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const lineNumber = startLine + index;

    if (!inFence) {
      const opening = parseFenceStart(rawLine);
      if (opening) {
        flush(previousLineNumber);
        inFence = true;
        fence = opening;
        fenceStartLine = lineNumber;
        blockInFence = true;
        blockStartLine = lineNumber;
        blockLines = [rawLine];
        previousLineNumber = lineNumber;
        continue;
      }
    } else if (fence && isFenceEnd(rawLine, fence)) {
      blockLines.push(rawLine);
      flush(lineNumber);
      inFence = false;
      fence = null;
      blockInFence = false;
      blockStartLine = lineNumber + 1;
      previousLineNumber = lineNumber;
      continue;
    }

    if (blockLines.length === 0) {
      blockStartLine = lineNumber;
    }
    blockLines.push(rawLine);
    previousLineNumber = lineNumber;
  }

  flush(previousLineNumber);

  if (inFence) {
    options.onDiagnostic?.({
      code: 'unclosed-fence',
      line: fenceStartLine,
      detail: 'Markdown 代码围栏未闭合，后续内容已按围栏内处理',
    });
  }

  return [...builder.finish()];
}