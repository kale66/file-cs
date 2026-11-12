import { LIMITS } from '@/types';
import type { SkipReason, SkipReasonCounts, SkippedFile } from '@/types';

export interface SkippedFilesPanelProps {
  readonly skippedFiles: readonly SkippedFile[];
  readonly skipReasonCounts: SkipReasonCounts | null;
}

const REASON_LABELS: Readonly<Record<SkipReason, string>> = {
  'ignored-directory': '忽略目录',
  'ignored-type': '忽略类型',
  'too-large': '体积过大',
  'unsupported-extension': '未知扩展名',
  'illegal-path': '非法路径',
  'parse-error': '解析失败',
  'non-text': '非文本文件',
  'archive-encrypted': '加密条目',
};

const REASON_HINTS: Readonly<Record<SkipReason, string>> = {
  'ignored-directory': '位于 node_modules、.git、dist、build 等目录。',
  'ignored-type': '压缩产物、锁文件或源码映射等无需扫描的类型。',
  'too-large': `单个文件超过 2MB 上限，未读取正文。`,
  'unsupported-extension': '扩展名不在支持的文本类型列表内。',
  'illegal-path': '路径包含父目录段、绝对路径或控制字符，已拒绝。',
  'parse-error': '读取或解析该文件时发生异常，已跳过并继续扫描。',
  'non-text': '图片、字体、音视频、二进制或归档文件。',
  'archive-encrypted': '压缩包包含加密条目，无法在本地读取。',
};

const REASONS: readonly SkipReason[] = [
  'ignored-directory',
  'ignored-type',
  'too-large',
  'unsupported-extension',
  'illegal-path',
  'parse-error',
  'non-text',
  'archive-encrypted',
];

export function SkippedFilesPanel({
  skippedFiles,
  skipReasonCounts,
}: SkippedFilesPanelProps): JSX.Element | null {
  if (skippedFiles.length === 0) return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <summary className="cls-focus cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        已跳过文件（{skippedFiles.length}） · 查看原因
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        {REASONS.map((reason) => {
          const items = skippedFiles.filter((item) => item.reason === reason);
          if (items.length === 0) return null;
          const count = skipReasonCounts?.[reason] ?? items.length;
          return (
            <div key={reason}>
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {REASON_LABELS[reason]}（{count}）
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {REASON_HINTS[reason]}
              </p>
              <ul className="mt-1 space-y-0.5">
                {items.slice(0, LIMITS.skippedPreviewCount).map((item) => (
                  <li
                    key={`${item.path}-${item.reason}`}
                    className="flex flex-wrap items-baseline gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300"
                  >
                    <span className="break-all">{item.path}</span>
                    {item.sizeBytes !== null ? (
                      <span className="text-slate-400 dark:text-slate-500">
                        {formatSize(item.sizeBytes)}
                      </span>
                    ) : null}
                    <span className="text-slate-400 dark:text-slate-500">
                      {item.detail.slice(0, 200)}
                    </span>
                  </li>
                ))}
              </ul>
              {count > LIMITS.skippedPreviewCount ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  仅展示前 {LIMITS.skippedPreviewCount} 条，完整清单请导出 JSON。
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}