import type { Severity, SeverityCounts, SkipReasonCounts, ScanSummary } from '@/types';
import { SEVERITY_LABELS } from '@/ui/SeverityBadge';

export interface SummaryCardsProps {
  readonly summary: ScanSummary;
  readonly skipReasonCounts: SkipReasonCounts | null;
  readonly onSelectSeverity: (severity: Severity) => void;
}

const SEVERITY_TONE: Readonly<Record<Severity, string>> = {
  critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  high: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  low: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
};

const SKIP_LABELS: Readonly<Record<string, string>> = {
  'ignored-directory': '忽略目录',
  'ignored-type': '忽略类型',
  'too-large': '体积过大',
  'unsupported-extension': '未知扩展名',
  'illegal-path': '非法路径',
  'parse-error': '解析失败',
  'non-text': '非文本',
  'archive-encrypted': '加密条目',
};

function countRows(counts: SeverityCounts): Array<[Severity, number]> {
  return [
    ['critical', counts.critical],
    ['high', counts.high],
    ['medium', counts.medium],
    ['low', counts.low],
  ];
}

export function SummaryCards({
  summary,
  skipReasonCounts,
  onSelectSeverity,
}: SummaryCardsProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">扫描文件</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {summary.scannedFiles}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">命中文件</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {summary.riskFiles}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">跳过文件</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {summary.skippedFiles}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">总耗时</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {(summary.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {countRows(summary.severityCounts).map(([severity, count]) => (
          <button
            key={severity}
            type="button"
            onClick={() => onSelectSeverity(severity)}
            className={`cls-focus rounded-lg border px-3 py-2 text-left transition-opacity hover:opacity-85 ${SEVERITY_TONE[severity]}`}
            aria-label={`筛选${SEVERITY_LABELS[severity]}命中`}
          >
            <p className="text-xs opacity-80">{SEVERITY_LABELS[severity]}</p>
            <p className="text-xl font-semibold">{count}</p>
          </button>
        ))}
      </div>

      {skipReasonCounts ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(skipReasonCounts)
            .filter(([, count]) => count > 0)
            .map(([reason, count]) => (
              <span
                key={reason}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {SKIP_LABELS[reason] ?? reason}：{count}
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}