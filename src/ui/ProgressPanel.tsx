import type { ChannelIssue, ScanPhase, ScanProgress } from '@/types';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';

export interface ProgressPanelProps {
  readonly progress: ScanProgress | null;
  readonly degraded: boolean;
  readonly channelIssue: ChannelIssue | null;
  readonly currentJobId: string | null;
  readonly onCancel: () => void;
  readonly busy: boolean;
  readonly onShowDiagnostics?: () => void;
}

const PHASE_LABELS: Readonly<Record<ScanPhase, string>> = {
  idle: '准备中',
  validating: '校验中',
  unzipping: '解压中',
  filtering: '筛选中',
  scanning: '扫描中',
  finalizing: '整理结果',
};

function shortenPath(path: string): string {
  if (path.length <= 64) return path;
  return `${path.slice(0, 28)}…${path.slice(-32)}`;
}

export function ProgressPanel({
  progress,
  degraded,
  channelIssue,
  currentJobId,
  onCancel,
  busy,
  onShowDiagnostics,
}: ProgressPanelProps): JSX.Element | null {
  if (!busy) return null;

  const phase = progress?.phase ?? 'validating';
  const percent = progress?.percent ?? 0;
  const processed = progress?.processed ?? 0;
  const total = progress?.total ?? 0;
  const elapsed = progress?.elapsedMs ?? 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {PHASE_LABELS[phase]} {percent.toFixed(1)}%
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {total > 0 ? `已处理 ${processed} / ${total}` : '正在准备数据'} · 用时{' '}
            {(elapsed / 1000).toFixed(1)} 秒
          </p>
        </div>
        <Button variant="danger" onClick={onCancel} disabled={!currentJobId}>
          取消扫描
        </Button>
      </div>

      <div className="mt-3">
        <ProgressBar value={percent} label={`${PHASE_LABELS[phase]}进度`} />
      </div>

      {progress?.currentPath ? (
        <p className="mt-2 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
          {shortenPath(progress.currentPath)}
        </p>
      ) : null}

      {channelIssue ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">
            {channelIssue.failure.code} · {channelIssue.failure.message}
          </p>
          <p className="mt-1">{channelIssue.failure.hint}</p>
          {onShowDiagnostics ? (
            <button
              type="button"
              onClick={onShowDiagnostics}
              className="cls-focus mt-1 underline decoration-amber-500 underline-offset-2"
            >
              查看诊断信息
            </button>
          ) : null}
        </div>
      ) : degraded ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          CLS-E-4001 · 当前浏览器不支持后台扫描，已降级为主线程处理；处理大文件时页面可能短暂卡顿。
        </p>
      ) : null}
    </section>
  );
}