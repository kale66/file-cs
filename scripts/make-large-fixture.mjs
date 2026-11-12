import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';

const root = process.cwd();
const fixturesDir = join(root, 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');
const CHUNK = 'A'.repeat(20 * 1024 - 64);

async function writeLargeMany() {
  const zip = new JSZip();
  for (let index = 0; index < 5000; index += 1) {
    const body =
      index === 0
        ? `// password = "AKIAABCDEFGHIJKLMNOP"\n${CHUNK}`
        : CHUNK;
    zip.file(`src/file-${String(index).padStart(5, '0')}.js`, body, {
      date: FIXED_DATE,
    });
  }
  const startedAt = Date.now();
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });
  writeFileSync(join(fixturesDir, 'large-many.zip'), buffer);
  console.info(
    `[fixtures] large-many.zip 已生成：${(buffer.length / (1024 * 1024)).toFixed(1)}MB，耗时 ${(
      (Date.now() - startedAt) / 1000
    ).toFixed(1)}s`,
  );
}

async function writeLargeOne() {
  const zip = new JSZip();
  const body = 'B'.repeat(2 * 1024 * 1024 - 128);
  for (let index = 0; index < 50; index += 1) {
    const comment = index === 0 ? '// 10.20.30.40:8080\n' : '';
    zip.file(`big/blob-${String(index).padStart(2, '0')}.js`, `${comment}${body}`, {
      date: FIXED_DATE,
      compression: 'STORE',
    });
  }
  const startedAt = Date.now();
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  writeFileSync(join(fixturesDir, 'large-one.zip'), buffer);
  console.info(
    `[fixtures] large-one.zip 已生成：${(buffer.length / (1024 * 1024)).toFixed(1)}MB，耗时 ${(
      (Date.now() - startedAt) / 1000
    ).toFixed(1)}s`,
  );
}

await writeLargeMany();
await writeLargeOne();