import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';

const root = process.cwd();
const fixturesDir = join(root, 'fixtures');
mkdirSync(fixturesDir, { recursive: true });

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

const ACCEPTANCE_FILES = {
  'config.js': [
    'const url = "http://example.com/a"; // 正常注释',
    '// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"',
    '',
  ].join('\n'),
  'README.md': [
    '# 示例项目',
    '',
    '内部服务: 10.20.30.40:8080',
    '连接串: mysql://root:Passw0rd@10.1.2.3:3306/db',
    '',
    '```js',
    'const AWS_KEY = "AKIAABCDEFGHIJKLMNOP";',
    '```',
    '',
  ].join('\n'),
  'main.py': [
    '"""数据库密码: Admin@123"""',
    '',
    '# token = abcdef123456',
    'password: root',
    '',
  ].join('\n'),
  'main.go': [
    'package main',
    '',
    '// TODO: 测试账号 test/test 上线前删掉',
    'func main() {}',
    '',
  ].join('\n'),
  'app.min.js': '// password = "ShouldNotBeScanned"\n',
  'node_modules/left-pad/index.js': '// 依赖目录中的注释不应被扫描\n',
  'docs/guide/usage.rst': ['Usage', '=====', '', 'password=Admin@123', ''].join('\n'),
  'src/README.js': '// mysql://root:Passw0rd@10.1.2.3:3306/db\n',
  '.env.production': 'DB_PASSWORD=Admin@123\nAPI_KEY=your_api_key_here\n',
  'unknown.xyz': 'anything\n',
  '=SUM(A1).js': '// password=Admin@123\n',
  '<img src=x onerror=alert(1)>.js': '// password=Admin@123\n',
  'data.map': '{}',
  'yarn.lock': '# yarn lockfile v1\n',
};

async function writeZip(zip, fileName) {
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  writeFileSync(join(fixturesDir, fileName), buffer);
  console.info(
    `[fixtures] ${fileName} 已生成：${(buffer.length / 1024).toFixed(1)}KB`,
  );
}

const acceptance = new JSZip();
for (const [path, content] of Object.entries(ACCEPTANCE_FILES)) {
  acceptance.file(path, content, { date: FIXED_DATE });
}
acceptance.file('logo.png', PNG_1X1, { date: FIXED_DATE, binary: true });
await writeZip(acceptance, 'acceptance.zip');

const onlyImages = new JSZip();
onlyImages.file('logo.png', PNG_1X1, { date: FIXED_DATE, binary: true });
onlyImages.file('node_modules/left-pad/index.js', '// dependency\n', { date: FIXED_DATE });
await writeZip(onlyImages, 'only-images.zip');