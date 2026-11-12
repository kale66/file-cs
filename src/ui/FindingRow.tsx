import type { Finding, SourceKind } from '@/types';
import { SeverityBadge } from '@/ui/SeverityBadge';
import { rawSnippetStore } from '@/ui/hooks/rawSnippetStore';

export interface FindingRowProps {
  readonly finding: Finding;
  readonly onReveal: (finding: Finding) => void;
}

const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  'line-comment': '行注释',
  'block-comment': '块注释',
  docstring: '文档字符串',
  document: '文档正文',
  config: '配置文件',
  'fence-sample': '围栏示例',
};

export function FindingRow({ finding, onReveal }: FindingRowProps): JSX.Element {
  const canReveal = rawSnippetStore.get(finding.id) !== undefined;

  return (
    <tr className="cls-table-row border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800/70">
      <td className="px-3 py-2">
        <SeverityBadge severity={finding.severity} />
      </td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800 dark:text-slate-100">
          {finding.ruleName}
        </div>
        <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {finding.ruleId}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="break-all font-mono text-[11px] text-slate-700 dark:text-slate-200">
          {finding.filePath}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {finding.inCodeFence ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              疑似示例
            </span>
          ) : null}
          {finding.snippetTruncated ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              片段已截断
            </span>
          ) : null}
          {finding.suppressedRuleIds.length > 0 ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              合并 {finding.suppressedRuleIds.length} 条同族
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">
        {finding.line}
      </td>
      <td className="px-3 py-2">
        <pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
          {finding.maskedSnippet}
        </pre>
        {finding.context.before || finding.context.after ? (
          <div className="mt-1 space-y-0.5">
            {finding.context.before ? (
              <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                ↑ {finding.context.before}
              </p>
            ) : null}
            {finding.context.after ? (
              <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                ↓ {finding.context.after}
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onReveal(finding)}
          disabled={!canReveal}
          className="cls-focus mt-1 text-[11px] text-emerald-700 underline decoration-emerald-400 underline-offset-2 disabled:text-slate-400 disabled:no-underline dark:text-emerald-300"
        >
          {canReveal ? '我需要看完整内容' : '完整内容不可展开（超出内存预算）'}
        </button>
      </td>
      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
        {SOURCE_LABELS[finding.sourceKind]}
      </td>
    </tr>
  );
}