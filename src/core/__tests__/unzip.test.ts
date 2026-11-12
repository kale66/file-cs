import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import zlib from 'node:zlib';
import { createDefaultScanConfig } from '@/core/config';
import { openZipArchive } from '@/core/unzip';

async function makeZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

const config = createDefaultScanConfig();

function buildStoredZip(name: string, contentText: string): ArrayBuffer {
  const content = Buffer.from(contentText, 'utf8');
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = zlib.crc32(content) >>> 0;

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  nameBytes.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + content.length, 16);

  const result = Buffer.concat([local, content, central, eocd]);
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength,
  ) as ArrayBuffer;
}

describe('zip 读取与防护', () => {
  it('按需读取条目并返回规范化路径', async () => {
    const data = await makeZip({
      'src/a.js': '// password=Admin@123',
      'README.md': '# title',
    });
    const reader = await openZipArchive(data, { jobId: 'job-zip', config });
    expect(reader.kind).toBe('zip');
    expect(reader.entries.map((entry) => entry.path)).toEqual([
      'README.md',
      'src/a.js',
    ]);
    const first = reader.entries[1];
    expect(first).toBeDefined();
    if (!first) return;
    const bytes = await reader.readEntry(first);
    expect(new TextDecoder().decode(bytes)).toContain('password=Admin@123');
    reader.dispose();
  });

  it('ACC-11：高压缩比条目触发 CLS-E-1005', async () => {
    const zip = new JSZip();
    zip.file('bomb/zeros.bin', '0'.repeat(11 * 1024 * 1024));
    const data = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    await expect(
      openZipArchive(data, { jobId: 'job-bomb', config }),
    ).rejects.toMatchObject({ code: 'CLS-E-1005' });
  });

  it('ACC-12：父目录条目被拒绝并登记 legal=false', async () => {
    const data = buildStoredZip('../../etc/passwd.js', '// password=x');
    const reader = await openZipArchive(data, { jobId: 'job-path', config });
    const entry = reader.entries[0];
    expect(entry?.pathValidation.legal).toBe(false);
    expect(entry?.pathValidation.reason).toBe('parent-segment');
    reader.dispose();
  });

  it('空 zip 返回空条目，由作业层判定 empty', async () => {
    const data = await makeZip({});
    const reader = await openZipArchive(data, { jobId: 'job-empty', config });
    expect(reader.entries).toHaveLength(0);
    reader.dispose();
  });
});