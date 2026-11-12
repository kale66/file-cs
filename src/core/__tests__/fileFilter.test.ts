import { describe, expect, it } from 'vitest';
import type { ArchiveEntryMeta } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import { classifyPath, decideScan, summarizeSkipReasons } from '@/core/fileFilter';

function entry(path: string, size: number | null = 1024, legal = true): ArchiveEntryMeta {
  return {
    path,
    displayName: path,
    isDirectory: false,
    compressedSize: size === null ? null : Math.floor(size / 2),
    uncompressedSize: size,
    encrypted: false,
    pathValidation: { legal, normalized: path, reason: legal ? null : 'parent-segment' },
    readIndex: 0,
  };
}

const config = createDefaultScanConfig();

describe('分类优先级', () => {
  it('.env 判为配置全文', () => {
    const classification = classifyPath('.env.local', config);
    expect(classification.kind).toBe('config');
    expect(classification.fullText).toBe(true);
    expect(classification.matchedRule).toBe('env-prefix');
  });

  it('README.js 按文档优先于扩展名', () => {
    const classification = classifyPath('src/README.js', config);
    expect(classification.kind).toBe('document');
    expect(classification.fullText).toBe(true);
    expect(classification.matchedRule).toBe('filename');
  });

  it('docs 目录文本按文档处理', () => {
    const classification = classifyPath('docs/guide/usage.rst', config);
    expect(classification.kind).toBe('document');
    expect(classification.matchedRule).toBe('docs-dir');
  });

  it('.BAT/.CMD 大小写不敏感命中代码类', () => {
    expect(classifyPath('scripts/run.BAT', config).kind).toBe('code');
    expect(classifyPath('scripts/run.CMD', config).kind).toBe('code');
  });

  it('未识别扩展名为 unknown', () => {
    expect(classifyPath('unknown.xyz', config).kind).toBe('unknown');
  });
});

describe('扫描/跳过决策', () => {
  it('node_modules 命中忽略目录', () => {
    const decision = decideScan(entry('node_modules/left-pad/index.js'), config);
    expect(decision.action).toBe('skip');
    expect(decision.skipReason).toBe('ignored-directory');
  });

  it('mybuild 不误判为 build', () => {
    const decision = decideScan(entry('mybuild/main.js'), config);
    expect(decision.action).toBe('scan');
  });

  it('.min.js 与 .map 命中忽略类型', () => {
    expect(decideScan(entry('app.min.js'), config).skipReason).toBe('ignored-type');
    expect(decideScan(entry('data.map'), config).skipReason).toBe('ignored-type');
    expect(decideScan(entry('yarn.lock'), config).skipReason).toBe('ignored-type');
  });

  it('图片命中非文本', () => {
    expect(decideScan(entry('logo.png'), config).skipReason).toBe('non-text');
  });

  it('超过 2MB 命中 too-large', () => {
    expect(decideScan(entry('big.js', 3 * 1024 * 1024), config).skipReason).toBe(
      'too-large',
    );
  });

  it('非法路径优先登记', () => {
    expect(
      decideScan(entry('../../etc/passwd.js', 100, false), config).skipReason,
    ).toBe('illegal-path');
  });

  it('未知扩展名登记 unsupported-extension', () => {
    expect(decideScan(entry('unknown.xyz'), config).skipReason).toBe(
      'unsupported-extension',
    );
  });

  it('合法代码文件进入扫描', () => {
    const decision = decideScan(entry('src/app.js'), config);
    expect(decision.action).toBe('scan');
    expect(decision.skipReason).toBeNull();
  });
});

describe('跳过原因汇总', () => {
  it('八类原因全部计数', () => {
    const counts = summarizeSkipReasons([
      { path: 'a', reason: 'ignored-directory', sizeBytes: null, detail: '' },
      { path: 'b', reason: 'ignored-type', sizeBytes: null, detail: '' },
      { path: 'c', reason: 'too-large', sizeBytes: null, detail: '' },
      { path: 'd', reason: 'unsupported-extension', sizeBytes: null, detail: '' },
      { path: 'e', reason: 'illegal-path', sizeBytes: null, detail: '' },
      { path: 'f', reason: 'parse-error', sizeBytes: null, detail: '' },
      { path: 'g', reason: 'non-text', sizeBytes: null, detail: '' },
      { path: 'h', reason: 'archive-encrypted', sizeBytes: null, detail: '' },
    ]);
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(8);
  });
});