import type { ConfigChangeNotice, IgnoreGroups, ScanConfig } from '@/types';
import { RULE_CATALOG } from '@/core/rules';
import { SeverityBadge } from '@/ui/SeverityBadge';

export interface ConfigPanelsProps {
  readonly config: ScanConfig;
  readonly notice: ConfigChangeNotice | null;
  readonly onConfigChange: (patch: Partial<Pick<ScanConfig, 'ignoreGroups' | 'scanPythonDocstring' | 'scanContactInfo'>>) => void;
}

const IGNORE_GROUP_LABELS: Readonly<Record<keyof IgnoreGroups, string>> = {
  ignoreDirectories: '忽略依赖/缓存目录（node_modules、.git 等）',
  ignoreBuildOutput: '忽略构建输出（dist、build、out、coverage）',
  ignoreLockFiles: '忽略锁文件与源码映射（*.lock、*.map）',
  ignoreBinaryTypes: '忽略二进制与压缩产物（*.min.js、图片等）',
  ignoreLargeFiles: '忽略超过 2MB 的单文件',
  ignoreUnknownExtensions: '忽略未识别的扩展名',
};

export function ConfigPanels({
  config,
  notice,
  onConfigChange,
}: ConfigPanelsProps): JSX.Element {
  const groups = Object.keys(IGNORE_GROUP_LABELS) as Array<keyof IgnoreGroups>;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cls-focus cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          扫描配置与忽略规则
        </summary>
        <div className="space-y-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          {groups.map((group) => (
            <label
              key={group}
              className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={config.ignoreGroups[group]}
                onChange={(event) =>
                  onConfigChange({
                    ignoreGroups: {
                      ...config.ignoreGroups,
                      [group]: event.target.checked,
                    },
                  })
                }
              />
              {IGNORE_GROUP_LABELS[group]}
            </label>
          ))}

          <div className="my-2 border-t border-slate-200 dark:border-slate-800" />

          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={config.scanPythonDocstring}
              onChange={(event) =>
                onConfigChange({ scanPythonDocstring: event.target.checked })
              }
            />
            扫描 Python 三引号 docstring（实践中最常藏凭证）
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={config.scanContactInfo}
              onChange={(event) =>
                onConfigChange({ scanContactInfo: event.target.checked })
              }
            />
            扫描邮箱/手机号等联系方式（默认关闭）
          </label>

          {notice ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {notice.message}
            </p>
          ) : null}

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            未识别扩展名与超过 2MB 的单文件始终跳过并计入“已跳过文件”。
          </p>
        </div>
      </details>

      <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cls-focus cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          检测规则说明（{RULE_CATALOG.length} 条）
        </summary>
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <ul className="space-y-2">
            {RULE_CATALOG.map((rule) => (
              <li key={rule.id} className="text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={rule.severity} />
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {rule.id}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {rule.name}
                  </span>
                  {!rule.enabledByDefault ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      默认关闭
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                  {rule.description}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  建议：{rule.suggestion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}