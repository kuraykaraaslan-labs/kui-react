'use client';
import { cn } from '@/libs/utils/cn';

type CardDensity = 'default' | 'compact';

// `compact` is for narrow hosts (a 320-400 px side panel, an embedded view): 16 px sides instead of 24 px.
const densityClasses: Record<CardDensity, { header: string; body: string; footer: string }> = {
  default: { header: 'px-6 py-4', body: 'px-6 py-4', footer: 'px-6 py-3' },
  compact: { header: 'px-4 py-3', body: 'px-4 py-3', footer: 'px-4 py-2.5' },
};

type CardProps = {
  as?: React.ElementType;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  variant?: 'raised' | 'flat' | 'outline';
  density?: CardDensity;
  onClick?: () => void;
  hoverable?: boolean;
  loading?: boolean;
  className?: string;
} & Record<string, unknown>;

export function Card({
  as,
  title,
  subtitle,
  headerRight,
  footer,
  children,
  variant = 'raised',
  density = 'default',
  onClick,
  hoverable,
  loading = false,
  className,
  ...rest
}: CardProps) {
  const isInteractive = !!onClick;
  const isHoverable   = hoverable || isInteractive;
  const pad = densityClasses[density];

  // `as` overrides the auto-detected tag; fallback: button when interactive, div otherwise
  const Tag = as ?? (isInteractive ? 'button' : 'div');
  const isButton = Tag === 'button';

  return (
    <Tag
      {...(isButton && { type: 'button' })}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border overflow-hidden text-left',
        variant === 'raised'  && 'bg-surface-raised shadow-sm',
        variant === 'flat'    && 'bg-surface-base',
        variant === 'outline' && 'bg-transparent',
        isHoverable && 'transition-shadow hover:shadow-md hover:border-border-focus cursor-pointer',
        isInteractive && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus w-full',
        loading && 'pointer-events-none',
        className
      )}
      {...rest}
    >
      {loading ? (
        <div className={cn(pad.body, 'space-y-3 animate-pulse')}>
          <div className="h-4 bg-surface-sunken rounded w-2/3" />
          <div className="h-3 bg-surface-sunken rounded w-full" />
          <div className="h-3 bg-surface-sunken rounded w-4/5" />
          <div className="h-3 bg-surface-sunken rounded w-1/2" />
        </div>
      ) : (
        <>
          {(title || headerRight) && (
            <div className={cn('flex items-start justify-between gap-3 border-b border-border', pad.header)}>
              <div>
                {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
                {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
              </div>
              {headerRight && <div className="shrink-0">{headerRight}</div>}
            </div>
          )}
          {children && <div className={pad.body}>{children}</div>}
          {footer && (
            <div className={cn('border-t border-border bg-surface-base', pad.footer)}>
              {footer}
            </div>
          )}
        </>
      )}
    </Tag>
  );
}
