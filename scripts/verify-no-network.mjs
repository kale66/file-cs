import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const DIST_ROOT = join(ROOT, 'dist');

const REQUEST_PATTERNS = [
  { name: 'fetch', pattern: /(^|[^A-Za-z0-9_$])fetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /(^|[^A-Za-z0-9_$])XMLHttpRequest([^A-Za-z0-9_$]|$)/ },
  { name: 'WebSocket', pattern: /(^|[^A-Za-z0-9_$])WebSocket([^A-Za-z0-9_$]|$)/ },
  { name: 'EventSource', pattern: /(^|[^A-Za-z0-9_$])EventSource([^A-Za-z0-9_$]|$)/ },
  { name: 'sendBeacon', pattern: /(^|[^A-Za-z0-9_$])sendBeacon([^A-Za-z0-9_$]|$)/ },

  { name: 'RTCPeerConnection', pattern: /(^|[^A-Za-z0-9_$])RTCPeerConnection([^A-Za-z0-9_$]|$)/ },
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html']);
const DIST_EXTENSIONS = new Set(['.html', '.js', '.css']);

const violations = [];

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
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function scanNetworkApis(filePath, isDist) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.includes('allow-network')) continue;
    for (const { name, pattern } of REQUEST_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: relative(ROOT, filePath),
          line: index + 1,
          message: `发现网络 API：${name}`,
        });
      }
    }

    if (!isDist) {
      const urlMatches = line.match(/https?:\/\/[^\s"'`)]+/g);
      if (urlMatches && !line.includes('allow-url')) {
        for (const url of urlMatches) {
          violations.push({
            file: relative(ROOT, filePath),
            line: index + 1,
            message: `发现外部 URL 字面量：${url}`,
          });
        }
      }
    }
  }
}

function scanHtmlExternalRefs(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const patterns = [
    /<script[^>]+src\s*=\s*["']https?:/i,
    /<link[^>]+href\s*=\s*["']https?:/i,
    /@import\s+url\(\s*["']?https?:/i,
    /url\(\s*["']?https?:/i,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      violations.push({
        file: relative(ROOT, filePath),
        line: null,
        message: '产物或页面包含外部资源引用',
      });
    }
  }
}

const isTestFile = (filePath) =>
  /[\\/]__tests__[\\/]/.test(filePath) || /\.test\.(ts|tsx|js|mjs)$/.test(filePath);

for (const filePath of walk(SRC_ROOT)) {
  if (!SOURCE_EXTENSIONS.has(extname(filePath))) continue;
  if (isTestFile(filePath)) continue;
  scanNetworkApis(filePath, false);
}

for (const filePath of walk(DIST_ROOT)) {
  const extension = extname(filePath);
  if (!DIST_EXTENSIONS.has(extension)) continue;
  if (extension === '.html') {
    scanHtmlExternalRefs(filePath);
  }
  scanNetworkApis(filePath, true);
}

if (violations.length > 0) {
  for (const violation of violations) {
    const location = violation.line === null ? violation.file : `${violation.file}:${violation.line}`;
    console.error(`[verify-no-network] ${location} ${violation.message}`);
  }
  console.error(`[verify-no-network] 共发现 ${violations.length} 处问题。`);
  process.exit(1);
}

console.info('[verify-no-network] 通过：未发现外部网络请求或外部资源引用。');