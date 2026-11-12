import type { CommentSnippet, ExtractOptions } from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

function matchLongBracket(
  text: string,
  index: number,
): { contentStart: number; close: string } | null {
  if (text[index] !== '[') return null;
  let cursor = index + 1;
  let equals = '';
  while (text[cursor] === '=') {
    equals += '=';
    cursor += 1;
    if (equals.length > 32) return null;
  }
  if (text[cursor] !== '[') return null;
  return { contentStart: cursor + 1, close: `]${equals}]` };
}

type LuaState = 'code' | 'line-comment' | 'block-comment' | 'single' | 'double' | 'long-string';

export function extractLua(text: string, options: ExtractOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const length = text.length;
  let index = 0;
  let line = options.startLine ?? 1;
  let state: LuaState = 'code';
  let contentStart = 0;
  let commentStartLine = 0;
  let blockClose = ']]';

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
      if (text.startsWith(blockClose, index)) {
        builder.addBlock(
          commentStartLine,
          line,
          text.slice(contentStart, index),
          'block-comment',
          false,
        );
        index += blockClose.length;
        state = 'code';
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'long-string') {
      if (text.startsWith(blockClose, index)) {
        index += blockClose.length;
        state = 'code';
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'single' || state === 'double') {
      if (char === '\\') {
        index += 2;
        continue;
      }
      const quote = state === 'single' ? "'" : '"';
      if (char === quote) {
        state = 'code';
        index += 1;
        continue;
      }
      if (char === '\n') {
        state = 'code';
        line += 1;
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (char === '\n') {
      line += 1;
      index += 1;
      continue;
    }

    if (char === '-' && text[index + 1] === '-') {
      const bracket = matchLongBracket(text, index + 2);
      if (bracket) {
        state = 'block-comment';
        contentStart = bracket.contentStart;
        blockClose = bracket.close;
        commentStartLine = line;
        index = bracket.contentStart;
        continue;
      }
      state = 'line-comment';
      contentStart = index + 2;
      commentStartLine = line;
      index += 2;
      continue;
    }

    if (char === '[') {
      const bracket = matchLongBracket(text, index);
      if (bracket) {
        state = 'long-string';
        blockClose = bracket.close;
        index = bracket.contentStart;
        continue;
      }
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
      detail: 'Lua 块注释未在文件结束前闭合',
    });
  }

  return [...builder.finish()];
}