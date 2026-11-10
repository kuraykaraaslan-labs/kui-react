'use client';
import { cn } from '@/libs/utils/cn';

const sizeMap = {
  sm: { track: 'h-4 w-7',   thumb: 'h-3 w-3',     on: 'translate-x-3.5' },
  md: { track: 'h-5 w-9',   thumb: 'h-3.5 w-3.5', on: 'translate-x-4'   },
  lg: { track: 'h-6 w-11',  thumb: 'h-4 w-4',     on: 'translate-x-5'   },
};

export function Toggle({
  id,
  label,
  ariaLabel,
  description,
  checked,
  onChange,
  disabled,
  size = 'md',
  pending = false,
  mismatch = false,
  describedBy,
  className,
}: {
  id: string;
  label: string;
  /** Accessible name to use when `label` is empty (e.g. the visible text
   * lives in a sibling element instead, like a settings-row layout). */
  ariaLabel?: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** An asynchronous write is in flight: the thumb shows a spinner, the input is disabled and `aria-busy` is set. No layout shift. */
  pending?: boolean;
  /** The other side reports a different value than was requested: a warning ring on the track. Pair with `describedBy`. */
  mismatch?: boolean;
  /** Id of a consumer-rendered hint element (e.g. the mismatch explanation). */
  describedBy?: string;
  className?: string;
}) {
  const { track, thumb, on } = sizeMap[size];

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : pending ? 'cursor-progress' : 'cursor-pointer',
        className
      )}
    >
      <div className="relative shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || pending}
          aria-busy={pending || undefined}
          aria-describedby={describedBy}
          aria-invalid={mismatch || undefined}
          aria-checked={checked}
          aria-label={!label && ariaLabel ? ariaLabel : undefined}
          data-testid={`toggle-${id}`}
          className="sr-only"
        />
        <div
          className={cn(
            'rounded-full transition-colors duration-200',
            track,
            checked ? 'bg-primary' : 'bg-surface-sunken border border-border',
            mismatch && 'ring-2 ring-warning ring-offset-1 ring-offset-surface-base'
          )}
        />
        <div
          className={cn(
            'absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            thumb,
            checked ? on : 'translate-x-0'
          )}
        >
          {pending && (
            <span
              aria-hidden="true"
              className="absolute inset-0 m-auto h-[70%] w-[70%] animate-spin rounded-full border border-primary border-t-transparent motion-reduce:animate-none"
            />
          )}
        </div>
      </div>
      {/* No empty text box next to a switch without label or description: it only added the gap-3 (12px). */}
      {(label || description) && (
        <div>
          {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
          {description && (
            <p className="text-xs text-text-secondary mt-0.5">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
