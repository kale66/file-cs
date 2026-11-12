import type { Severity } from '@/types';

export const SEVERITY_LABELS: Readonly<Record<Severity, string>> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
};

const SEVERITY_STYLES: Readonly<Record<Severity, string>> = {
  critical:
    'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950 dark:border-red-900',
  high: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950 dark:border-orange-900',
  medium:
    'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-900',
  low: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700',
};

export interface SeverityBadgeProps {
  readonly severity: Severity;
  readonly className?: string;
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[severity]} ${className}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}