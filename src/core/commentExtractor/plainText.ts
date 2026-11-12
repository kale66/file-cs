import type {
  CommentSnippet,
  ExtractOptions,
  SourceKind,
} from '@/types';
import { createSnippetBuilder } from '@/core/commentExtractor/comments';

const LINES_PER_BLOCK = 200;

export function extractPlainText(
  text: string,
  options: ExtractOptions,
  sourceKind: SourceKind = 'document',
): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const lines = text.split('\n');
  const startLine = options.startLine ?? 1;

  for (let index = 0; index < lines.length; index += LINES_PER_BLOCK) {
    const chunk = lines.slice(index, index + LINES_PER_BLOCK);
    if (chunk.length === 0) continue;
    const blockStart = startLine + index;
    const blockEnd = blockStart + chunk.length - 1;
    builder.addBlock(blockStart, blockEnd, chunk.join('\n'), sourceKind, false);
  }

  return [...builder.finish()];
}