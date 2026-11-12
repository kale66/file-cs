import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';

const root = process.cwd();
const fixturesDir = join(root, 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

// 200MB 全零条目：压缩后体积很小，用于验证解压总量/压缩比防护。
const zeros = Buffer.alloc(200 * 1024 * 1024);

const zip = new JSZip();
zip.file('bomb/zeros.bin', zeros, { date: FIXED_DATE, binary: true });

const startedAt = Date.now();
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});

writeFileSync(join(fixturesDir, 'bomb.zip'), buffer);
console.info(
  `[fixtures] bomb.zip 已生成：${(buffer.length / 1024).toFixed(1)}KB（解压后 200MB），耗时 ${(
    (Date.now() - startedAt) / 1000
  ).toFixed(1)}s。请勿提交到版本库。`,
);