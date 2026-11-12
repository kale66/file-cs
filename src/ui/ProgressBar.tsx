export interface ProgressBarProps {
  readonly value: number;
  readonly label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps): JSX.Element {
  const percent = Math.min(100, Math.max(0, Math.round(value * 10) / 10));
  return (
    <div className="w-full">
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label ?? '扫描进度'}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-150 dark:bg-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}