import { describe, expect, it } from 'vitest';
import type { ExtractDiagnostic } from '@/types';
import { extractCFamily } from '@/core/commentExtractor/cFamily';

function options(overrides: Record<string, unknown> = {}) {
  return {
    maxSnippetBytes: 8192,
    enableRegexLiteral: true,
    enableTemplateLiteral: true,
    ...overrides,
  };
}

describe('C 系注释状态机', () => {
  it('字符串中的 http:// 不被误判（ACC-02）', () => {
    const snippets = extractCFamily(
      'const url = "http://example.com/a"; // 正常注释',
      options(),
    );
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('正常注释');
    expect(snippets[0]?.sourceKind).toBe('line-comment');
    expect(snippets[0]?.startLine).toBe(1);
  });

  it('连续行注释合并，行号连续', () => {
    const snippets = extractCFamily(
      '// 第一行\n// 第二行\nconst a = 1;',
      options(),
    );
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('第一行');
    expect(snippets[0]?.text).toContain('第二行');
    expect(snippets[0]?.startLine).toBe(1);
    expect(snippets[0]?.endLine).toBe(2);
  });

  it('跨行块注释保留换行与行号', () => {
    const snippets = extractCFamily('/* 第一行\n第二行 password=123456\n*/\nconst a=1;', options());
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.startLine).toBe(1);
    expect(snippets[0]?.endLine).toBe(3);
    expect(snippets[0]?.text).toContain('\n');
  });

  it('转义引号不提前结束字符串', () => {
    const snippets = extractCFamily(`const s = 'it\\'s // not comment'; // real`, options());
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('模板字符串内 // 不产生注释', () => {
    const snippets = extractCFamily(
      'const t = `a // b ${value} c`; // real',
      options(),
    );
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('正则字面量内的 // 不产生注释', () => {
    const snippets = extractCFamily('const re = /\\/\\//; // real', options());
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('除法后的 // 正常识别', () => {
    const snippets = extractCFamily('const x = a / b; // real', options());
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('未闭合块注释产生诊断', () => {
    const diagnostics: ExtractDiagnostic[] = [];
    const snippets = extractCFamily('/* 未闭合 token=abcdef123456', {
      ...options(),
      onDiagnostic: (diagnostic: ExtractDiagnostic) => diagnostics.push(diagnostic),
    });
    expect(snippets).toHaveLength(1);
    expect(diagnostics.some((item) => item.code === 'unclosed-block-comment')).toBe(true);
  });

  it('Rust 嵌套块注释按深度结束', () => {
    const snippets = extractCFamily(
      '/* outer /* inner */ still */ // tail',
      options({ nestedBlockComments: true }),
    );
    expect(snippets).toHaveLength(2);
    expect(snippets[0]?.text).toContain('still');
    expect(snippets[1]?.text).toContain('tail');
  });

  it('未开启正则识别时除法不吞掉后续注释', () => {
    const snippets = extractCFamily('const x = a / b; // real', options({ enableRegexLiteral: false }));
    expect(snippets[0]?.text).toContain('real');
  });
});