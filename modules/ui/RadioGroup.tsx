'use client';

import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';

export type RadioOption = {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  /** Disables this option only (the group's `disabled` disables all of them). */
  disabled?: boolean;
  /** Why the option is disabled; shown under it (after `hint`) while it is disabled. */
  disabledReason?: string;
};

type RadioGroupVariant = 'default' | 'card';
type RadioGroupColumns = 1 | 2 | 3;

export function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  disabled,
  className,
  optionClassName,
  variant = 'default',
  columns = 1,
}: {
  name: string;
  legend: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  optionClassName?: string;
  variant?: RadioGroupVariant;
  columns?: RadioGroupColumns;
}) {
  return (
    <fieldset className={cn('space-y-1', className)}>
      <legend className="mb-2 text-sm font-medium text-text-primary">
        {legend}
      </legend>

      <div
        className={cn(
          columns === 1 && 'space-y-2',
          columns > 1 && 'grid gap-2',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const isDisabled = !!disabled || !!opt.disabled;
          const reason = opt.disabled && opt.disabledReason ? opt.disabledReason : undefined;
          const hintId = opt.hint ? `${name}-${opt.value}-hint` : undefined;
          const reasonId = reason ? `${name}-${opt.value}-reason` : undefined;
          const describedBy = [hintId, reasonId].filter(Boolean).join(' ') || undefined;

          return (
            <label
              key={opt.value}
              className={cn(
                'flex items-start gap-2',
                isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',

                variant === 'card' && [
                  'rounded-lg border border-border bg-surface-base p-3 transition-colors',
                  !isDisabled && 'hover:border-border-focus',
                  isSelected && 'border-primary bg-primary/5',
                  error && 'border-error',
                ],

                optionClassName
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                disabled={isDisabled}
                aria-describedby={describedBy}
                // The native radio takes its colours from accent-color (app/globals.css);
                // aria-invalid switches it to the error accent and outline.
                aria-invalid={error ? true : undefined}
                onChange={() => { if (!isDisabled) onChange?.(opt.value); }}
                data-testid={`radio-${name}-${opt.value}`}
                className={cn(
                  'mt-0.5 h-4 w-4',
                  'focus-visible:ring-2 focus-visible:ring-border-focus'
                )}
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {opt.icon && (
                    <span className="text-lg leading-none text-text-secondary">
                      {opt.icon}
                    </span>
                  )}

                  <span className="text-sm text-text-primary">
                    {opt.label}
                  </span>
                </div>

                {opt.hint && (
                  <p id={hintId} className="mt-0.5 text-xs text-text-secondary">
                    {opt.hint}
                  </p>
                )}

                {reason && (
                  <p id={reasonId} className="mt-0.5 text-xs text-text-secondary">
                    {reason}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="mt-1 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}