import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SINGLE_ROOT = join(ROOT, 'dist-single');
const STANDARD_ROOT = join(ROOT, 'dist');
const SINGLE_INDEX = join(SINGLE_ROOT, 'index.html');

const problems = [];

function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

if (!existsSync(SINGLE_INDEX)) {
  problems.push('未找到 dist-single/index.html，请先执行 npm run build:single');
} else {
  const files = walk(SINGLE_ROOT);
  const others = files.filter((file) => file !== SINGLE_INDEX);
  if (others.length > 0) {
    problems.push(
      `单文件产物应仅包含 index.html，但发现额外文件：${others
        .map((file) => relative(ROOT, file))
        .join(', ')}`,
    );
  }

  const html = readFileSync(SINGLE_INDEX, 'utf8');
  const externalPatterns = [
    /<script[^>]+src\s*=\s*["']https?:/i,
    /<link[^>]+href\s*=\s*["']https?:/i,
    /@import\s+url\(\s*["']?https?:/i,
    /url\(\s*["']?https?:/i,
  ];
  for (const pattern of externalPatterns) {
    if (pattern.test(html)) {
      problems.push('单文件 HTML 中包含外部资源引用');
    }
  }

  if (!/(new Blob|blob:|Blob\()/i.test(html)) {
    problems.push('单文件 HTML 中未检测到 Worker 内联载荷（Blob/worker）');
  }

  const sizeMb = statSync(SINGLE_INDEX).size / (1024 * 1024);
  if (sizeMb > 2) {
    console.warn(
      `[verify-build] 提示：单文件体积 ${sizeMb.toFixed(2)}MB，超过 2MB 目标预算。`,
    );
  }
}

if (existsSync(STANDARD_ROOT)) {
  const assets = join(STANDARD_ROOT, 'assets');
  const maps = walk(assets).filter((file) => extname(file) === '.map');
  if (maps.length > 0) {
    problems.push(`标准构建产物包含 sourcemap：${maps.map((f) => relative(ROOT, f)).join(', ')}`);
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`[verify-build] ${problem}`);
  }
  process.exit(1);
}

console.info('[verify-build] 通过：单文件产物完整且无外部资源引用。');