import { describe, expect, it } from 'vitest';
import type { ExtractDiagnostic } from '@/types';
import { extractPython } from '@/core/commentExtractor/python';
import { extractHashFamily } from '@/core/commentExtractor/hashFamily';
import { extractSql } from '@/core/commentExtractor/sql';
import { extractLua } from '@/core/commentExtractor/lua';
import { extractBatch } from '@/core/commentExtractor/batch';

const base = { maxSnippetBytes: 8192 };

describe('Python 注释与 docstring', () => {
  it('docstring 默认扫描并保留 sourceKind（ACC-04）', () => {
    const snippets = extractPython('"""数据库密码: Admin@123"""\n# token = abcdef123456', {
      ...base,
      scanDocstring: true,
    });
    expect(snippets.some((snippet) => snippet.sourceKind === 'docstring')).toBe(true);
    expect(snippets.some((snippet) => snippet.sourceKind === 'line-comment')).toBe(true);
  });

  it('关闭 docstring 后仅保留 # 注释（ACC-18）', () => {
    const snippets = extractPython('"""数据库密码: Admin@123"""\n# token = abcdef123456', {
      ...base,
      scanDocstring: false,
    });
    expect(snippets.every((snippet) => snippet.sourceKind !== 'docstring')).toBe(true);
    expect(snippets.some((snippet) => snippet.text.includes('abcdef123456'))).toBe(true);
  });

  it('支持 r""" 前缀与跨行内容', () => {
    const snippets = extractPython('x = r"""line1\npassword=123456\n"""', {
      ...base,
      scanDocstring: true,
    });
    expect(snippets[0]?.sourceKind).toBe('docstring');
    expect(snippets[0]?.text).toContain('123456');
    expect(snippets[0]?.startLine).toBe(1);
  });

  it('shebang 不产片段', () => {
    const snippets = extractPython('#!/usr/bin/env python\n# real', {
      ...base,
      scanDocstring: true,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('未闭合三引号产生诊断', () => {
    const diagnostics: ExtractDiagnostic[] = [];
    extractPython('"""未闭合 password=123456', {
      ...base,
      scanDocstring: true,
      onDiagnostic: (diagnostic: ExtractDiagnostic) => diagnostics.push(diagnostic),
    });
    expect(diagnostics.some((item) => item.code === 'unclosed-string')).toBe(true);
  });
});

describe('井号系提取', () => {
  it('字符串内 # 不误判', () => {
    const snippets = extractHashFamily('value: "a # b"\n# real', {
      ...base,
      ignoreShebang: true,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('Dockerfile 仅识别行首 #', () => {
    const snippets = extractHashFamily('# real\nRUN echo a # not-comment', {
      ...base,
      ignoreShebang: true,
      dockerfileStyle: true,
    });
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('shebang 整行丢弃', () => {
    const snippets = extractHashFamily('#!/bin/bash\n# real', {
      ...base,
      ignoreShebang: true,
    });
    expect(snippets).toHaveLength(1);
  });
});

describe('SQL 提取', () => {
  it("字符串内 -- 不产片段", () => {
    const snippets = extractSql("INSERT INTO t VALUES ('a--b');", base);
    expect(snippets).toHaveLength(0);
  });

  it('-- 与 /* */ 均可识别', () => {
    const snippets = extractSql('-- line\n/* block */', base);
    expect(snippets).toHaveLength(2);
  });
});

describe('Lua 与 Batch 提取', () => {
  it('Lua 长字符串内 -- 不产片段', () => {
    const snippets = extractLua('local s = [[ -- not comment ]]\n-- real', base);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
  });

  it('Lua --[[ ]] 块注释', () => {
    const snippets = extractLua('--[[ password=123456 ]]', base);
    expect(snippets[0]?.sourceKind).toBe('block-comment');
    expect(snippets[0]?.text).toContain('password=123456');
  });

  it('Batch REM 与 :: 识别，echo REM 不命中', () => {
    const snippets = extractBatch('REM real\n:: second\necho REM not-comment', base);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.text).toContain('real');
    expect(snippets[0]?.text).toContain('second');
    expect(snippets[0]?.text).not.toContain('not-comment');
  });
});