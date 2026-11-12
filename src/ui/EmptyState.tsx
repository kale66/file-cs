import type { ScanSummary } from '@/types';
import { Button } from '@/ui/Button';

export interface EmptyStateProps {
  readonly kind: 'success' | 'no-scannable';
  readonly summary: ScanSummary;
  readonly onReset: () => void;
}

export function EmptyState({ kind, summary, onReset }: EmptyStateProps): JSX.Element {
  if (kind === 'no-scannable') {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950">
        <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          CLS-E-1007 · 压缩包内未找到可扫描的文本文件
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs text-amber-700 dark:text-amber-300">
          共发现 {summary.totalFiles} 个文件，全部被忽略或不属于支持的文本类型。请查看下方“已跳过文件”了解具体原因，可关闭部分忽略开关后重新扫描。
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="primary" onClick={onReset}>
            重新上传
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        ✓
      </div>
      <h2 className="mt-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        未发现风险
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-xs text-emerald-700 dark:text-emerald-300">
        已扫描 {summary.scannedFiles} 个文件，跳过 {summary.skippedFiles} 个文件，未发现敏感信息。仅扫描注释与指定文档，不代表代码整体安全。
      </p>
      <div className="mt-4 flex justify-center">
        <Button variant="primary" onClick={onReset}>
          重新上传
        </Button>
      </div>
    </section>
  );
}