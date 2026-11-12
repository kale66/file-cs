import { LIMITS } from '@/types';
import type {
  ArchiveEntryMeta,
  FileClassification,
  IgnoreGroups,
  ScanConfig,
  ScanDecision,
  SkipReason,
  SkipReasonCounts,
  SkippedFile,
} from '@/types';
import { DEFAULT_IGNORE_GROUPS } from '@/core/config';
import { getLanguageSpec, lookupByExtension } from '@/core/commentExtractor/languageMap';

export { DEFAULT_IGNORE_GROUPS };

export const VENDOR_DIRECTORIES: readonly string[] = [
  'node_modules',
  '.git',
  'vendor',
  '.venv',
  '__pycache__',
  'target',
];

export const BUILD_DIRECTORIES: readonly string[] = [
  'dist',
  'build',
  'out',
  'coverage',
];

export const LOCK_FILE_NAMES: readonly string[] = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'bun.lockb',
];

export const BINARY_EXTENSIONS: readonly string[] = [
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'avif', 'svgz', 'tif', 'tiff',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'mp4', 'm4a', 'wav', 'flac', 'ogg', 'webm', 'avi', 'mov', 'mkv',
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'jar', 'war', 'whl', 'apk',
  'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'o', 'a', 'obj', 'lib',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'sqlite', 'db', 'pyc', 'pyo',
];

const DOCUMENT_NAME_RE = /^(readme|contributing|changelog|security)(\..*)?$/i;
const MINIFIED_RE = /\.min\.(js|css)$/i;

export function getExtension(relPath: string): string {
  const baseName = relPath.slice(relPath.lastIndexOf('/') + 1);
  const dot = baseName.lastIndexOf('.');
  return dot > 0 ? baseName.slice(dot + 1).toLowerCase() : '';
}

export function getBaseName(relPath: string): string {
  return relPath.slice(relPath.lastIndexOf('/') + 1);
}

export function classifyPath(relPath: string, _config: ScanConfig): FileClassification {
  const baseName = getBaseName(relPath);
  const extension = getExtension(relPath);
  const lowerName = baseName.toLowerCase();

  if (lowerName === '.env' || lowerName.startsWith('.env.')) {
    return {
      kind: 'config',
      language: null,
      fullText: true,
      matchedRule: 'env-prefix',
    };
  }

  if (DOCUMENT_NAME_RE.test(baseName)) {
    const markdownSpec = getLanguageSpec('markdown');
    const isMarkdown = extension === 'md' || extension === 'markdown' || extension === 'mdx';
    return {
      kind: 'document',
      language: isMarkdown ? markdownSpec : getLanguageSpec('text'),
      fullText: true,
      matchedRule: 'filename',
    };
  }

  const segments = relPath.split('/');
  if (segments.length > 1 && segments.slice(0, -1).includes('docs')) {
    const isMarkdown = extension === 'md' || extension === 'markdown' || extension === 'mdx';
    const spec = isMarkdown ? getLanguageSpec('markdown') : getLanguageSpec('text');
    if (spec) {
      return {
        kind: 'document',
        language: spec,
        fullText: true,
        matchedRule: 'docs-dir',
      };
    }
  }

  const spec = lookupByExtension(extension);
  if (!spec) {
    if (baseName.startsWith('.env')) {
      return {
        kind: 'config',
        language: null,
        fullText: true,
        matchedRule: 'env-prefix',
      };
    }
    return {
      kind: 'unknown',
      language: null,
      fullText: false,
      matchedRule: 'none',
    };
  }

  if (spec.fullText) {
    return {
      kind: 'document',
      language: spec,
      fullText: true,
      matchedRule: 'extension',
    };
  }

  return {
    kind: 'code',
    language: spec,
    fullText: false,
    matchedRule: 'extension',
  };
}

export function decideScan(entry: ArchiveEntryMeta, config: ScanConfig): ScanDecision {
  const classification = classifyPath(entry.path, config);
  const groups = config.ignoreGroups ?? DEFAULT_IGNORE_GROUPS;
  const skip = (reason: SkipReason, detail: string): ScanDecision => ({
    action: 'skip',
    classification,
    skipReason: reason,
    detail,
  });

  if (entry.pathValidation.legal === false) {
    return skip(
      'illegal-path',
      `条目路径被拒绝：${entry.pathValidation.reason ?? 'unknown'}`,
    );
  }

  if (entry.encrypted) {
    return skip('archive-encrypted', '压缩包包含加密条目，无法本地读取');
  }

  const size = entry.uncompressedSize;
  const hardLimit = Math.min(config.maxFileSizeBytes, LIMITS.maxFileSizeBytes);
  if (size !== null && size > hardLimit) {
    return skip('too-large', `单文件超过 ${formatBytes(hardLimit)} 上限`);
  }

  const baseName = getBaseName(entry.path);
  const extension = getExtension(entry.path);

  if (
    groups.ignoreBinaryTypes &&
    BINARY_EXTENSIONS.includes(extension)
  ) {
    return skip('non-text', '二进制或非文本扩展名');
  }

  if (groups.ignoreLockFiles && (LOCK_FILE_NAMES.includes(baseName.toLowerCase()) || extension === 'lock')) {
    return skip('ignored-type', '依赖锁文件不参与扫描');
  }

  if (groups.ignoreBinaryTypes && MINIFIED_RE.test(baseName)) {
    return skip('ignored-type', '压缩/混淆产物（*.min.js / *.min.css）');
  }

  if (groups.ignoreLockFiles && extension === 'map') {
    return skip('ignored-type', '源码映射文件（*.map）');
  }

  const segments = entry.path.split('/').slice(0, -1).map((segment) => segment.toLowerCase());

  if (groups.ignoreDirectories && segments.some((segment) => VENDOR_DIRECTORIES.includes(segment))) {
    return skip('ignored-directory', '位于依赖/缓存/版本控制目录');
  }

  if (groups.ignoreBuildOutput && segments.some((segment) => BUILD_DIRECTORIES.includes(segment))) {
    return skip('ignored-directory', '位于构建输出目录');
  }

  if (classification.kind === 'unknown') {
    return skip(
      'unsupported-extension',
      groups.ignoreUnknownExtensions
        ? '未识别的扩展名，已按忽略设置跳过'
        : '未识别的扩展名，没有可用的注释提取器',
    );
  }

  return {
    action: 'scan',
    classification,
    skipReason: null,
    detail:
      classification.kind === 'config'
        ? '配置文件全文扫描'
        : classification.kind === 'document'
          ? '文档全文扫描'
          : '仅提取注释',
  };
}

export function summarizeSkipReasons(skipped: readonly SkippedFile[]): SkipReasonCounts {
  const counts: Record<SkipReason, number> = {
    'ignored-directory': 0,
    'ignored-type': 0,
    'too-large': 0,
    'unsupported-extension': 0,
    'illegal-path': 0,
    'parse-error': 0,
    'non-text': 0,
    'archive-encrypted': 0,
  };
  for (const item of skipped) {
    counts[item.reason] += 1;
  }
  return counts;
}

export function isIgnoreGroupEnabled(config: ScanConfig, group: keyof IgnoreGroups): boolean {
  return config.ignoreGroups[group];
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}