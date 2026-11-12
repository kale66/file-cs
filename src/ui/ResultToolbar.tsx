import type { FilterState, Finding, Severity, WorkerFailure } from '@/types';
import { Button } from '@/ui/Button';
import { SEVERITY_LABELS } from '@/ui/SeverityBadge';

export interface ResultToolbarProps {
  readonly filter: FilterState;
  readonly findings: readonly Finding[];
  readonly onFilterChange: (filter: FilterState) => void;
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  readonly totalCount: number;
  readonly visibleCount: number;
  readonly onExportJson: () => void;
  readonly onExportCsv: () => void;
  readonly onCopyPaths: () => void;
  readonly copyFallback: string | null;
  readonly exportError: WorkerFailure | null;
}

const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low'];

export function ResultToolbar({
  filter,
  findings,
  onFilterChange,
  page,
  pageCount,
  onPageChange,
  totalCount,
  visibleCount,
  onExportJson,
  onExportCsv,
  onCopyPaths,
  copyFallback,
  exportError,
}: ResultToolbarProps): JSX.Element {
  const ruleOptions = [...new Set(findings.map((finding) => finding.ruleId))].sort();

  const toggleSeverity = (severity: Severity): void => {
    const next = filter.severities.includes(severity)
      ? filter.severities.filter((item) => item !== severity)
      : [...filter.severities, severity];
    onFilterChange({ ...filter, severities: next });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">级别</span>
        {SEVERITIES.map((severity) => (
          <button
            key={severity}
            type="button"
            onClick={() => toggleSeverity(severity)}
            className={`cls-focus rounded-full border px-2.5 py-1 text-xs font-medium ${
              filter.severities.includes(severity)
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            aria-pressed={filter.severities.includes(severity)}
          >
            {SEVERITY_LABELS[severity]}
          </button>
        ))}

        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">规则</span>
        <select
          className="cls-focus rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          value={filter.ruleIds[0] ?? ''}
          onChange={(event) =>
            onFilterChange({
              ...filter,
              ruleIds: event.target.value ? [event.target.value] : [],
            })
          }
          aria-label="按规则过滤"
        >
          <option value="">全部规则</option>
          {ruleOptions.map((ruleId) => (
            <option key={ruleId} value={ruleId}>
              {ruleId}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={filter.pathQuery}
          onChange={(event) =>
            onFilterChange({ ...filter, pathQuery: event.target.value })
          }
          placeholder="按路径过滤"
          aria-label="按路径过滤"
          className="cls-focus w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />

        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={filter.includeFenceSamples}
            disabled={filter.onlyFenceSamples}
            onChange={(event) =>
              onFilterChange({
                ...filter,
                includeFenceSamples: event.target.checked,
              })
            }
          />
          含围栏样本
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={filter.onlyFenceSamples}
            onChange={(event) =>
              onFilterChange({
                ...filter,
                onlyFenceSamples: event.target.checked,
              })
            }
          />
          仅围栏样本
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          共 {totalCount} 条，当前页 {visibleCount} 条 · 第 {page} / {pageCount} 页
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            ariaLabel="上一页"
          >
            上一页
          </Button>
          <Button
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            ariaLabel="下一页"
          >
            下一页
          </Button>
          <Button variant="primary" onClick={onExportJson}>
            导出 JSON
          </Button>
          <Button onClick={onExportCsv}>导出 CSV</Button>
          <Button onClick={onCopyPaths}>复制命中路径</Button>
        </div>
      </div>

      {exportError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {exportError.code} · {exportError.message}
        </p>
      ) : null}

      {copyFallback ? (
        <div className="space-y-1">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            CLS-E-3002 · 剪贴板不可用，请在下方文本框中手动复制。
          </p>
          <textarea
            readOnly
            value={copyFallback}
            rows={4}
            className="w-full rounded-md border border-slate-300 bg-slate-50 p-2 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            aria-label="命中文件路径清单"
          />
        </div>
      ) : null}
    </div>
  );
}