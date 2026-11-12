import { describe, expect, it } from 'vitest';
import type { ExtractDiagnostic } from '@/types';
import { extractMarkdown } from '@/core/commentExtractor/markdown';
import { extractMarkup } from '@/core/commentExtractor/markup';
import { extractPlainText } from '@/core/commentExtractor/plainText';

const base = { maxSnippetBytes: 8192, fenceChars: ['```', '~~~'] };

describe('Markdown 围栏追踪', () => {
  it('围栏内外标记正确', () => {
    const text = [
      '正文 password=Admin@123',
      '',
      '```js',
      'const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"',
      '```',
      '',
      '尾部正文',
    ].join('\n');

    const snippets = extractMarkdown(text, base);
    const outside = snippets.filter((snippet) => !snippet.inCodeFence);
    const inside = snippets.filter((snippet) => snippet.inCodeFence);
    expect(outside.length).toBeGreaterThanOrEqual(1);
    expect(inside.length).toBe(1);
    expect(inside[0]?.sourceKind).toBe('fence-sample');
    expect(inside[0]?.text).toContain('AKIAABCDEFGHIJKLMNOP');
    expect(outside.some((snippet) => snippet.text.includes('Admin@123'))).toBe(true);
  });

  it('波浪号围栏同样识别', () => {
    const snippets = extractMarkdown('~~~\npassword=123456\n~~~', base);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.inCodeFence).toBe(true);
  });

  it('未闭合围栏产生诊断', () => {
    const diagnostics: ExtractDiagnostic[] = [];
    extractMarkdown('```\npassword=123456', {
      ...base,
      onDiagnostic: (diagnostic: ExtractDiagnostic) => diagnostics.push(diagnostic),
    });
    expect(diagnostics.some((item) => item.code === 'unclosed-fence')).toBe(true);
  });

  it('行号映射精确', () => {
    const snippets = extractMarkdown('line1\nline2\npassword=123456', base);
    expect(snippets[0]?.startLine).toBe(1);
    expect(snippets[0]?.endLine).toBe(3);
  });
});

describe('HTML / XML / Vue 提取', () => {
  it('<!-- --> 注释不含定界符', () => {
    const snippets = extractMarkup('<!-- password=123456 -->', {
      ...base,
      extractEmbeddedScript: false,
      extractEmbeddedStyle: false,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toBe(' password=123456 ');
    expect(snippets[0]?.text).not.toContain('<!--');
  });

  it('Vue script 内注释映射到文件行号', () => {
    const text = ['<template><div /></template>', '<script>', '// password=123456', '</script>'].join('\n');
    const snippets = extractMarkup(text, {
      ...base,
      extractEmbeddedScript: true,
      extractEmbeddedStyle: true,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.startLine).toBe(3);
    expect(snippets[0]?.text).toContain('password=123456');
  });

  it('style 内仅识别块注释', () => {
    const text = ['<style>', '/* real */', 'a { color: red } // not-comment', '</style>'].join('\n');
    const snippets = extractMarkup(text, {
      ...base,
      extractEmbeddedScript: false,
      extractEmbeddedStyle: true,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });
});

describe('纯文本全文提取', () => {
  it('按块输出文档片段', () => {
    const lines = Array.from({ length: 450 }, (_, index) => `line ${index + 1}`);
    const snippets = extractPlainText(lines.join('\n'), base);
    expect(snippets).toHaveLength(3);
    expect(snippets[0]?.startLine).toBe(1);
    expect(snippets[1]?.startLine).toBe(201);
    expect(snippets.every((snippet) => snippet.sourceKind === 'document')).toBe(true);
  });

  it('配置全文使用 config 来源', () => {
    const snippets = extractPlainText('DB_PASSWORD=Admin@123', base, 'config');
    expect(snippets[0]?.sourceKind).toBe('config');
  });
});