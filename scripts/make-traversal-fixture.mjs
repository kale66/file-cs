import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';

const root = process.cwd();
const fixturesDir = join(root, 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

const ENTRY_NAME = '../../etc/passwd.js';
const ENTRY_CONTENT = Buffer.from('// password=Admin+123\n', 'utf8');
const DOS_TIME = 0;
const DOS_DATE = 0x21;

function buildStoredZip(name, content) {
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = zlib.crc32(content) >>> 0;

  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  nameBytes.copy(local, 30);

  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(0, 42);
  nameBytes.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + content.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, content, central, eocd]);
}

const buffer = buildStoredZip(ENTRY_NAME, ENTRY_CONTENT);
writeFileSync(join(fixturesDir, 'traversal.zip'), buffer);
console.info(
  `[fixtures] traversal.zip 已生成（条目名保持原样：${ENTRY_NAME}，${buffer.length} 字节）`,
);