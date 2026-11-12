import type { ReactNode } from 'react';

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly className?: string;
}

const VARIANTS: Readonly<Record<NonNullable<ButtonProps['variant']>, string>> = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:border-emerald-500',
  secondary:
    'bg-white text-slate-800 hover:bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:border-slate-600',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white hover:bg-red-700 border-red-600 dark:bg-red-500 dark:hover:bg-red-400 dark:border-red-500',
};

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  ariaLabel,
  title,
  className = '',
}: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={`cls-focus inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}