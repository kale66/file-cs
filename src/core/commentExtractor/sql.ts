import type { CommentSnippet, ExtractOptions } from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

type SqlState = 'code' | 'line-comment' | 'block-comment' | 'single' | 'double' | 'backtick';

export function extractSql(text: string, options: ExtractOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const length = text.length;
  let index = 0;
  let line = options.startLine ?? 1;
  let state: SqlState = 'code';
  let contentStart = 0;
  let commentStartLine = 0;

  while (index < length) {
    const char = text[index] ?? '';

    if (state === 'line-comment') {
      const newline = text.indexOf('\n', index);
      const end = newline === -1 ? length : newline;
      builder.addLine(
        commentStartLine,
        trimCommentLine(text.slice(contentStart, end)),
        'line-comment',
        false,
      );
      if (newline === -1) {
        index = length;
      } else {
        line += 1;
        index = newline + 1;
      }
      state = 'code';
      continue;
    }

    if (state === 'block-comment') {
      if (char === '*' && text[index + 1] === '/') {
        builder.addBlock(
          commentStartLine,
          line,
          text.slice(contentStart, index),
          'block-comment',
          false,
        );
        state = 'code';
        index += 2;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"';
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        if (text[index + 1] === quote) {
          index += 2;
          continue;
        }
        state = 'code';
        index += 1;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'backtick') {
      if (char === '`') {
        state = 'code';
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }

    if (char === '-' && text[index + 1] === '-') {
      state = 'line-comment';
      contentStart = index + 2;
      commentStartLine = line;
      index += 2;
      continue;
    }

    if (char === '/' && text[index + 1] === '*') {
      state = 'block-comment';
      contentStart = index + 2;
      commentStartLine = line;
      index += 2;
      continue;
    }

    if (char === "'") {
      state = 'single';
      index += 1;
      continue;
    }

    if (char === '"') {
      state = 'double';
      index += 1;
      continue;
    }

    if (char === '`') {
      state = 'backtick';
      index += 1;
      continue;
    }

    index += 1;
  }

  if (state === 'block-comment') {
    builder.addBlock(
      commentStartLine,
      line,
      text.slice(contentStart, length),
      'block-comment',
      false,
    );
    options.onDiagnostic?.({
      code: 'unclosed-block-comment',
      line: commentStartLine,
      detail: 'SQL 块注释未在文件结束前闭合',
    });
  }

  return [...builder.finish()];
}