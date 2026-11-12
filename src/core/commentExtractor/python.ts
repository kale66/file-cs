import type {
  CommentSnippet,
  PythonOptions,
} from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

const TRIPLE_START_RE = /^(?:[rRbBuUfF]{0,2})("""|''')/;

type PythonState = 'code' | 'single' | 'double';

export function extractPython(text: string, options: PythonOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const length = text.length;
  let index = 0;
  let line = options.startLine ?? 1;
  let state: PythonState = 'code';

  const emitUnclosed = (lineNumber: number, detail: string): void => {
    options.onDiagnostic?.({ code: 'unclosed-string', line: lineNumber, detail });
  };

  while (index < length) {
    const char = text[index] ?? '';

    if (state === 'single' || state === 'double') {
      if (char === '\\') {
        if (text[index + 1] === '\n') line += 1;
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
        emitUnclosed(line, '单/双引号字符串在行尾未闭合，已按保守策略结束');
        line += 1;
        state = 'code';
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

    if (char === '#') {
      const newline = text.indexOf('\n', index);
      const end = newline === -1 ? length : newline;
      if (line === 1 && index === 0 && text.startsWith('#!')) {
        // shebang 不作为注释片段
      } else {
        builder.addLine(
          line,
          trimCommentLine(text.slice(index + 1, end)),
          'line-comment',
          false,
        );
      }
      if (newline === -1) {
        index = length;
      } else {
        line += 1;
        index = newline + 1;
      }
      continue;
    }

    const precededByIdentifier =
      index > 0 && /[A-Za-z0-9_]/.test(text[index - 1] ?? '');

    if (char === '"' || char === "'" || (/[rRbBuUfF]/.test(char) && !precededByIdentifier)) {
      const triple = TRIPLE_START_RE.exec(text.slice(index));
      if (triple) {
        const delimiter = triple[1] ?? '"""';
        const contentStart = index + triple[0].length;
        const startLine = line;
        const end = text.indexOf(delimiter, contentStart);
        const contentEnd = end === -1 ? length : end;
        const content = text.slice(contentStart, contentEnd);
        const endLine = startLine + countNewlines(content);

        if (options.scanDocstring) {
          builder.addBlock(startLine, endLine, content, 'docstring', false);
        }
        if (end === -1) {
          emitUnclosed(startLine, '三引号字符串未在文件结束前闭合');
          line = endLine;
          index = length;
          continue;
        }
        line = endLine;
        index = end + delimiter.length;
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

  return [...builder.finish()];
}

function countNewlines(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) count += 1;
  }
  return count;
}