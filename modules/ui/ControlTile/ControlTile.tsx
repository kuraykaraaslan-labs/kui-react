'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Tooltip } from '../Tooltip';
import type { AsyncControlState } from '@/libs/hooks/useAsyncControl';

export type ControlMessages = {
  pending: string;
  confirmed: string;
  mismatch: string;
  failed: string;
  readOnly: string;
  retry: string;
};

export const DEFAULT_CONTROL_MESSAGES: ControlMessages = {
  pending: 'Sending…',
  confirmed: 'Done',
  mismatch: 'The device reports a different value.',
  failed: 'The change failed.',
  readOnly: 'You do not have permission to use this control.',
  retry: 'Retry',
};

export type ControlTileProps = {
  title?: string;
  state: AsyncControlState;
  /** Failure text; falls back to `messages.failed`. */
  error?: string | null;
  /** Show the read-only notice (the user may not use the control). */
  readOnly?: boolean;
  /** The value the other side reports, shown as a quiet line under the control. */
  reportedText?: string;
  /** Wired to the state line's "Retry" button on failure / mismatch. Omit to hide the button. */
  onRetry?: () => void;
  messages?: Partial<ControlMessages>;
  /**
   * Draw the tile's own frame (border, background, padding). Default `true`. Pass `false` when
   * the control sits inside a host card (e.g. a dashboard `WidgetCard`) that already frames it.
   */
  framed?: boolean;
  /**
   * Why the control is disabled (no command, old data, unknown state …). Shown in a tooltip over
   * the control (its text stays in the accessibility tree). The control itself must also be disabled.
   */
  disabledReason?: string;
  /** Unframed only: centre the control in the space (default) or put it at the bottom. */
  bodyAlign?: 'center' | 'end';
  /** Unframed only: the control slot takes the whole height the status line leaves (a tile that fills its card). */
  fill?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * ControlTile — the frame every async control shares: title, the control slot, and one
 * live status line (pending / confirmed / mismatch / failed / read-only). One place, so
 * the controls cannot drift on what "pending" or "failed" looks like. The status line takes
 * room only while it has something to say, so a control can centre in (or fill) its space;
 * its live region stays mounted (out of the flow) so the next status is still announced.
 */
export function ControlTile({
  title, state, error, readOnly, reportedText, onRetry, messages, framed = true, disabledReason, bodyAlign = 'center', fill = false, children, className,
}: ControlTileProps) {
  const m = { ...DEFAULT_CONTROL_MESSAGES, ...messages };
  // A host-written failure text leads; the reason the write failed follows it.
  const failText = messages?.failed ? (error ? `${messages.failed} (${error})` : messages.failed) : error || m.failed;
  const hasStatus = state !== 'idle' || !!readOnly;
  const fills = fill && !framed;
  return (
    <div
      className={cn(framed ? 'rounded-lg border border-border bg-surface-raised p-3' : 'flex h-full min-h-0 flex-col', className)}
      data-disabled-reason={disabledReason || undefined}
    >
      {title && <h3 className="mb-2 text-sm font-semibold text-text-primary">{title}</h3>}
      <div className={cn('flex flex-col', framed ? 'gap-2' : 'min-h-0 flex-1 gap-1.5', !framed && (bodyAlign === 'end' ? 'justify-end' : 'justify-center'))}>
        {disabledReason ? (
          <Tooltip
            content={disabledReason}
            className={cn(
              'flex w-full [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1',
              fills && 'min-h-0 flex-1 items-stretch [&>span:first-child]:flex [&>span:first-child]:flex-col',
            )}
          >
            {children}
          </Tooltip>
        ) : children}
        {reportedText && <p className="text-xs text-text-secondary">{reportedText}</p>}
        <div
          className={cn(!hasStatus ? 'sr-only' : framed ? 'flex min-h-5 items-center gap-2 text-xs' : 'flex min-h-4 items-center gap-2 text-[11px] leading-4')}
          aria-live="polite"
        >
          {state === 'pending' && (
            <>
              <span aria-hidden="true" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
              <span className="text-text-secondary">{m.pending}</span>
            </>
          )}
          {state === 'confirmed' && <span className="text-success">{m.confirmed}</span>}
          {state === 'mismatch' && <span className="text-warning">{m.mismatch}</span>}
          {state === 'failed' && <span role="alert" className="text-error">{failText}</span>}
          {(state === 'failed' || state === 'mismatch') && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              {m.retry}
            </button>
          )}
          {readOnly && state === 'idle' && <span className="text-text-secondary">{m.readOnly}</span>}
        </div>
      </div>
    </div>
  );
}
