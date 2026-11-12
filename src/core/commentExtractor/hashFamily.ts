import type { CommentSnippet, HashFamilyOptions } from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

function findHashOutsideQuotes(line: string): number {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i] ?? '';
    if (quote !== null) {
      if (char === '\\') {
        i += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#') return i;
  }
  return -1;
}

export function extractHashFamily(
  text: string,
  options: HashFamilyOptions,
): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const lines = text.split('\n');
  const dockerfileStyle = options.dockerfileStyle === true;
  let lineNumber = options.startLine ?? 1;

  for (const rawLine of lines) {
    let content: string | null = null;

    if (dockerfileStyle) {
      const match = /^\s*#/.exec(rawLine);
      if (match) content = rawLine.slice(match[0].length);
    } else if (
      options.ignoreShebang &&
      lineNumber === 1 &&
      rawLine.startsWith('#!')
    ) {
      content = null;
    } else {
      const hashIndex = findHashOutsideQuotes(rawLine);
      if (hashIndex >= 0) content = rawLine.slice(hashIndex + 1);
    }

    if (content !== null) {
      builder.addLine(lineNumber, trimCommentLine(content), 'line-comment', false);
    }
    lineNumber += 1;
  }

  return [...builder.finish()];
}