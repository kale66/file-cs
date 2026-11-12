import type {
  CommentSnippet,
  MarkupOptions,
} from '@/types';
import {
  createSnippetBuilder,
} from '@/core/commentExtractor/comments';
import { buildLineIndex } from '@/core/commentExtractor/comments';
import { extractCFamily } from '@/core/commentExtractor/cFamily';

function extractCssComments(
  text: string,
  options: MarkupOptions,
  startLine: number,
): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const index = buildLineIndex(text);
  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf('/*', offset);
    if (start === -1) break;
    const end = text.indexOf('*/', start + 2);
    const contentEnd = end === -1 ? text.length : end;
    builder.addBlock(
      startLine + index.lineAt(start) - 1,
      startLine + index.lineAt(contentEnd) - 1,
      text.slice(start + 2, contentEnd),
      'block-comment',
      false,
    );
    if (end === -1) {
      options.onDiagnostic?.({
        code: 'unclosed-block-comment',
        line: startLine + index.lineAt(start) - 1,
        detail: '样式块注释未闭合',
      });
      break;
    }
    offset = end + 2;
  }
  return [...builder.finish()];
}

export function extractMarkup(text: string, options: MarkupOptions): CommentSnippet[] {
  const builder = createSnippetBuilder(options.maxSnippetBytes);
  const lineIndex = buildLineIndex(text);

  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf('<!--', offset);
    if (start === -1) break;
    const end = text.indexOf('-->', start + 4);
    const contentEnd = end === -1 ? text.length : end;
    builder.addBlock(
      lineIndex.lineAt(start),
      lineIndex.lineAt(contentEnd),
      text.slice(start + 4, contentEnd),
      'block-comment',
      false,
    );
    if (end === -1) {
      options.onDiagnostic?.({
        code: 'unclosed-block-comment',
        line: lineIndex.lineAt(start),
        detail: 'HTML/XML 注释未在文件结束前闭合',
      });
      break;
    }
    offset = end + 3;
  }

  if (options.extractEmbeddedScript) {
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
    let match: RegExpExecArray | null = scriptRe.exec(text);
    while (match !== null) {
      const inner = match[1] ?? '';
      const innerStart = match.index + match[0].indexOf('>') + 1;
      const snippets = extractCFamily(inner, {
        maxSnippetBytes: options.maxSnippetBytes,
        startLine: lineIndex.lineAt(innerStart),
        enableRegexLiteral: true,
        enableTemplateLiteral: true,
        onDiagnostic: options.onDiagnostic,
      });
      for (const snippet of snippets) {
        builder.addBlock(
          snippet.startLine,
          snippet.endLine,
          snippet.text,
          snippet.sourceKind,
          snippet.inCodeFence,
        );
      }
      match = scriptRe.exec(text);
    }
  }

  if (options.extractEmbeddedStyle) {
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
    let match: RegExpExecArray | null = styleRe.exec(text);
    while (match !== null) {
      const inner = match[1] ?? '';
      const innerStart = match.index + match[0].indexOf('>') + 1;
      const snippets = extractCssComments(inner, options, lineIndex.lineAt(innerStart));
      for (const snippet of snippets) {
        builder.addBlock(
          snippet.startLine,
          snippet.endLine,
          snippet.text,
          snippet.sourceKind,
          snippet.inCodeFence,
        );
      }
      match = styleRe.exec(text);
    }
  }

  return [...builder.finish()];
}