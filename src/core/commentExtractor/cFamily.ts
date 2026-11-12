import type {
  CFamilyOptions,
  CommentSnippet,
  ExtractDiagnosticCode,
} from '@/types';
import {
  createSnippetBuilder,
  trimCommentLine,
} from '@/core/commentExtractor/comments';

type CState =
  | 'code'
  | 'line-comment'
  | 'block-comment'
  | 'single-quote'
  | 'double-quote'
  | 'template'
  | 'template-expr'
  | 'regex'
  | 'regex-class';

const REGEX_PREFIX_TOKENS = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '=>',
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
  '+', '-', '*', '%', '<', '>', '^', '~',
]);

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

function isDigit(char: string): boolean {
  return /[0-9]/.test(char);
}

function regexAllowed(previousToken: string): boolean {
  if (previousToken.length === 0) return true;
  return REGEX_PREFIX_TOKENS.has(previousToken);
}

export function extractCFamily(text: string, options: CFamilyOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const length = text.length;
  const nestedBlocks = options.nestedBlockComments === true;
  const enableRegex = options.enableRegexLiteral;
  const enableTemplate = options.enableTemplateLiteral;

  let index = 0;
  let line = options.startLine ?? 1;
  let state: CState = 'code';
  let contentStart = 0;
  let commentStartLine = 0;
  let blockDepth = 0;
  let templateExprDepth = 0;
  let previousToken = '';

  const emit = (code: ExtractDiagnosticCode, lineNumber: number, detail: string): void => {
    options.onDiagnostic?.({ code, line: lineNumber, detail });
  };

  while (index < length) {
    const char = text[index] ?? '';

    if (state === 'line-comment') {
      const newline = text.indexOf('\n', index);
      const end = newline === -1 ? length : newline;
      const content = trimCommentLine(text.slice(contentStart, end));
      builder.addLine(commentStartLine, content, 'line-comment', false);
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
      if (nestedBlocks && char === '/' && text[index + 1] === '*') {
        blockDepth += 1;
        index += 2;
        continue;
      }
      if (char === '*' && text[index + 1] === '/') {
        blockDepth -= 1;
        if (blockDepth <= 0) {
          const content = text.slice(contentStart, index);
          builder.addBlock(commentStartLine, line, content, 'block-comment', false);
          state = 'code';
          index += 2;
          previousToken = '/';
          continue;
        }
        index += 2;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'single-quote' || state === 'double-quote') {
      if (char === '\\') {
        if (text[index + 1] === '\n') line += 1;
        index += 2;
        continue;
      }
      const quote = state === 'single-quote' ? "'" : '"';
      if (char === quote) {
        state = 'code';
        previousToken = quote;
        index += 1;
        continue;
      }
      if (char === '\n') {
        emit('unclosed-string', line, '单/双引号字符串在行尾未闭合，已按保守策略结束');
        line += 1;
        state = 'code';
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (state === 'template') {
      if (char === '\\') {
        if (text[index + 1] === '\n') line += 1;
        index += 2;
        continue;
      }
      if (char === '`') {
        state = 'code';
        previousToken = '`';
        index += 1;
        continue;
      }
      if (char === '$' && text[index + 1] === '{') {
        state = 'template-expr';
        templateExprDepth = 1;
        index += 2;
        continue;
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'template-expr') {
      if (char === '{') templateExprDepth += 1;
      if (char === '}') {
        templateExprDepth -= 1;
        if (templateExprDepth === 0) {
          state = 'template';
          index += 1;
          continue;
        }
      }
      if (char === '\n') line += 1;
      index += 1;
      continue;
    }

    if (state === 'regex') {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === '[') {
        state = 'regex-class';
        index += 1;
        continue;
      }
      if (char === '/') {
        state = 'code';
        index += 1;
        while (index < length && /[a-z]/i.test(text[index] ?? '')) index += 1;
        previousToken = '/';
        continue;
      }
      if (char === '\n') {
        state = 'code';
        previousToken = '/';
        line += 1;
        index += 1;
        continue;
      }
      index += 1;
      continue;
    }

    if (state === 'regex-class') {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === ']') {
        state = 'regex';
        index += 1;
        continue;
      }
      if (char === '\n') {
        state = 'code';
        previousToken = '/';
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

    if (char === '/') {
      const next = text[index + 1];
      if (next === '/') {
        state = 'line-comment';
        contentStart = index + 2;
        commentStartLine = line;
        index += 2;
        continue;
      }
      if (next === '*') {
        state = 'block-comment';
        contentStart = index + 2;
        commentStartLine = line;
        blockDepth = 1;
        index += 2;
        continue;
      }
      if (enableRegex && regexAllowed(previousToken)) {
        state = 'regex';
        index += 1;
        continue;
      }
      previousToken = '/';
      index += 1;
      continue;
    }

    if (char === "'") {
      state = 'single-quote';
      index += 1;
      continue;
    }

    if (char === '"') {
      state = 'double-quote';
      index += 1;
      continue;
    }

    if (char === '`' && enableTemplate) {
      state = 'template';
      index += 1;
      continue;
    }

    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < length && isIdentifierPart(text[end] ?? '')) end += 1;
      previousToken = text.slice(index, end);
      index = end;
      continue;
    }

    if (isDigit(char)) {
      let end = index + 1;
      while (end < length && /[0-9a-fA-FxX._]/.test(text[end] ?? '')) end += 1;
      previousToken = text.slice(index, end);
      index = end;
      continue;
    }

    if (!/\s/.test(char)) {
      previousToken = char;
    }
    index += 1;
  }

  if (state === 'block-comment') {
    const content = text.slice(contentStart, length);
    builder.addBlock(commentStartLine, line, content, 'block-comment', false);
    emit('unclosed-block-comment', commentStartLine, '块注释未在文件结束前闭合');
  }

  return [...builder.finish()];
}