'use client';
// Small building blocks the editor's panels share: a labelled field with its hint and message, a badge, a control class.
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';

/** The look of a text input, select or number input (the same as the schema form's). */
export const CONTROL =
  'w-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-disabled ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:opacity-50 aria-[invalid=true]:border-error';

/** A flat button for the panels' small actions. */
export const SMALL_BUTTON =
  'rounded px-1.5 py-0.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-30 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

export function PanelField({
  id, label, hint, error, tag, children, className,
}: { id: string; label: string; hint?: string; error?: string; tag?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} data-field={id}>
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={id} className="text-xs font-medium text-text-secondary">{label}</label>
        {tag && <span id={`${id}-tag`} className="rounded bg-surface-sunken px-1 text-[10px] text-text-secondary">{tag}</span>}
      </div>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-[11px] leading-snug text-text-secondary">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

const TONES = {
  success: 'bg-success-subtle text-success-fg',
  warning: 'bg-warning-subtle text-warning-fg',
  error: 'bg-error-subtle text-error-fg',
  info: 'bg-info-subtle text-info-fg',
  neutral: 'bg-surface-sunken text-text-secondary',
} as const;

export function Badge({ tone = 'neutral', children, title }: { tone?: keyof typeof TONES; children: ReactNode; title?: string }) {
  return <span title={title} className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium', TONES[tone])}>{children}</span>;
}
