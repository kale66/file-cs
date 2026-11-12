import type { Finding, FindingGroup } from '@/types';
import { FindingRow } from '@/ui/FindingRow';

export interface FindingsTableProps {
  readonly groups: readonly FindingGroup[];
  readonly onReveal: (finding: Finding) => void;
}

export function FindingsTable({ groups, onReveal }: FindingsTableProps): JSX.Element {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        当前过滤条件下没有命中结果。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-left text-xs">
          <caption className="sr-only">敏感信息命中结果</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <th className="w-16 px-3 py-2 font-medium">级别</th>
              <th className="w-40 px-3 py-2 font-medium">规则</th>
              <th className="w-64 px-3 py-2 font-medium">文件路径</th>
              <th className="w-14 px-3 py-2 font-medium">行号</th>
              <th className="px-3 py-2 font-medium">脱敏片段</th>
              <th className="w-24 px-3 py-2 font-medium">来源</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.filePath}>
              <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60">
                <td colSpan={6} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                      {group.filePath}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      严重 {group.severityCounts.critical} · 高危 {group.severityCounts.high} ·
                      中危 {group.severityCounts.medium} · 低危 {group.severityCounts.low}
                    </span>
                  </div>
                </td>
              </tr>
              {group.findings.map((finding) => (
                <FindingRow key={finding.id} finding={finding} onReveal={onReveal} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}