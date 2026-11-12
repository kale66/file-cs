import type { DiagnosticsSnapshot, WorkerFailure } from '@/types';
import { Button } from '@/ui/Button';
import { DiagnosticsPanel } from '@/ui/DiagnosticsPanel';

export interface ErrorStateProps {
  readonly failure: WorkerFailure;
  readonly onRetry: () => void;
  readonly diagnostics?: DiagnosticsSnapshot | null;
  readonly onShowDiagnostics?: () => void;
}

export function ErrorState({
  failure,
  onRetry,
  diagnostics,
  onShowDiagnostics,
}: ErrorStateProps): JSX.Element {
  return (
    <section
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">
            {failure.code} · {failure.message}
          </h2>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">{failure.hint}</p>
          {failure.retryable === 'reupload' ? (
            <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
              该错误需要重新上传文件后继续。
            </p>
          ) : null}
          <p className="mt-2 text-xs text-red-600/80 dark:text-red-400/80">
            提示：页面不会展示原始异常信息或文件内容，以避免二次泄露。
          </p>
        </div>
        <Button variant="primary" onClick={onRetry}>
          重新上传
        </Button>
      </div>

      <details
        className="mt-3"
        onToggle={(event) => {
          if (event.currentTarget.open) onShowDiagnostics?.();
        }}
      >
        <summary className="cls-focus cursor-pointer text-xs text-red-700 underline decoration-red-400 underline-offset-2 dark:text-red-300">
          查看诊断信息（不含文件名、路径与片段）
        </summary>
        {diagnostics ? <DiagnosticsPanel snapshot={diagnostics} compact /> : null}
      </details>
    </section>
  );
}