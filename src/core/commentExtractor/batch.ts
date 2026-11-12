import type { CommentSnippet, ExtractOptions } from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

export function extractBatch(text: string, options: ExtractOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const lines = text.split('\n');
  let lineNumber = options.startLine ?? 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.replace(/^\s+/, '');
    let content: string | null = null;

    const remMatch = /^@?rem(?:\s|$)/i.exec(trimmed);
    if (remMatch) {
      content = trimmed.slice(remMatch[0].length);
    } else if (trimmed.startsWith('::')) {
      content = trimmed.slice(2);
    }

    if (content !== null) {
      builder.addLine(lineNumber, trimCommentLine(content), 'line-comment', false);
    }
    lineNumber += 1;
  }

  return [...builder.finish()];
}