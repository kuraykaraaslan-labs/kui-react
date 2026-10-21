'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';

/* The small parts of the side bar's Errors, Busiest and Data tabs, value for value as the router draws them
 * (`.kui-flow-caps`, `.kui-flow-msg-node`, `.kui-badge` in roltek-automation-flow). */

/** a small heading above a block of a pane */
export const Caps = ({ children }: { children: ReactNode }) => (
  <p className="mb-1.5 mt-3.5 text-[0.6875rem] font-semibold uppercase leading-normal tracking-[.08em] text-text-secondary">{children}</p>
);

/** the name of a block as a link that shows the block on the canvas; in a table it wraps, so a narrow side bar never scrolls sideways */
export const NodeLink = ({ title, testid, onClick, children, className }: { title?: string; testid?: string; onClick?: () => void; children: ReactNode; className?: string }) => (
  <button type="button" title={title} data-testid={testid} onClick={onClick}
    className={cn('inline-flex max-w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-primary hover:underline', className)}>
    {children}
  </button>
);

const BADGE = { warning: 'bg-warning-subtle text-warning-fg', success: 'bg-success-subtle text-success-fg', error: 'bg-error-subtle text-error-fg' } as const;
const DOT = { warning: 'bg-warning', success: 'bg-success', error: 'bg-error' } as const;

export const Badge = ({ tone, dot, children }: { tone: keyof typeof BADGE; dot?: boolean; children: ReactNode }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-normal', BADGE[tone])}>
    {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} />}
    {children}
  </span>
);

/* the router's buttons and selects, value for value (theme: kui-form.css and kui-pages.css) */
export const selectCls = 'h-10 min-h-10 min-w-0 flex-[1_1_8rem] appearance-none rounded-[var(--radius-md)] border border-border bg-surface-base bg-[length:1.125rem] bg-[position:right_.625rem_center] bg-no-repeat px-3 py-2 text-sm leading-normal text-text-primary transition-colors focus-visible:border-border-focus focus-visible:outline-2 focus-visible:outline-border-focus';
export const chevron = "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path fill='%236b7280' d='M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4z'/></svg>\")";
export const iconBtn = 'inline-flex h-9 min-h-9 w-9 min-w-9 flex-none items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-base p-0 text-sm font-medium leading-[1.25] text-text-primary transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-border-focus';
/** a `.btn.cbi-button` of the router that is smaller than the tool row's: the caller sets padding and text size */
export const btnCls = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface-base font-medium leading-[1.25] text-text-primary transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-border-focus';
