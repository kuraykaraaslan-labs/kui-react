'use client';
import { cn } from '@/libs/utils/cn';

type ActionVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'danger' | 'ghost';

const variantMap: Record<ActionVariant, string> = {
  primary:   'bg-primary text-primary-fg hover:bg-primary-hover',
  // As Button: `secondary` is neutral, `accent` carries the brand's second colour.
  secondary: 'bg-surface-overlay text-text-primary hover:bg-border-strong',
  accent:    'bg-accent text-accent-fg hover:bg-accent-hover',
  outline:   'border border-border text-text-primary hover:bg-surface-overlay',
  danger:    'bg-error text-text-inverse hover:opacity-90',
  ghost:     'bg-transparent text-text-primary hover:bg-surface-overlay',
};

export type PageHeaderAction = {
  label: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: ActionVariant;
  disabled?: boolean;
  /** A guided-tour anchor, rendered as `data-tour` (modules/app/Tour targets it with `[data-tour="…"]`). */
  dataTour?: string;
};

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: PageHeaderAction[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 pb-3',
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-text-primary leading-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>

      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {actions.map((action, i) => {
            const cls = cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variantMap[action.variant ?? 'primary']
            );
            if (action.href) {
              return (
                <a key={i} href={action.href} className={cls} data-tour={action.dataTour}>
                  {action.label}
                </a>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cls}
                data-tour={action.dataTour}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
