'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleMinus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { InsightsSourceState } from '../types';

const STATE: Record<InsightsSourceState, { icon: typeof faCircleCheck; classes: string }> = {
  ok: { icon: faCircleCheck, classes: 'bg-success-subtle text-success-fg' },
  off: { icon: faCircleMinus, classes: 'bg-surface-sunken text-text-secondary' },
  error: { icon: faTriangleExclamation, classes: 'bg-error-subtle text-error-fg' },
};

type InsightsSourceBadgeProps = {
  /** The source's name ("Google Search"). */
  label: string;
  state: InsightsSourceState;
  /** The state in words ("Connected"), read with the name. */
  stateLabel: string;
  /** Shown as the badge's title (hover): the last fetch time, or why it failed. */
  detail?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

/** InsightsSourceBadge — a data source and whether it is connected, off or failing (icon + words, never colour alone). */
export function InsightsSourceBadge({ label, state, stateLabel, detail, className, ...rest }: InsightsSourceBadgeProps) {
  const s = STATE[state];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', s.classes, className)}
      title={detail || undefined}
      {...rest}
    >
      <FontAwesomeIcon icon={s.icon} className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
      <span className="sr-only">: {stateLabel}</span>
    </span>
  );
}
