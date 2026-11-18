'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCircleCheck } from '@fortawesome/free-solid-svg-icons';

/**
 * Accepted solution: the post a topic's author (or a moderator) marked as the answer.
 *
 * - `AcceptedSolutionBadge` is the "Accepted solution" chip shown on that post.
 * - `MarkSolutionButton` is the "Mark as solution" / "Unmark solution" action, shown only to the topic author or a moderator.
 * - `acceptedSolutionClasses` turns a post card green: add `card` to the card, `author` to its author column and `meta` to
 *   its meta row (merged with `cn()`, so they win over the card's own border and background classes).
 */
export const acceptedSolutionClasses = {
  card: cn(
    'border-[color-mix(in_srgb,var(--success)_55%,var(--border))]',
    'ring-1 ring-[color-mix(in_srgb,var(--success)_35%,transparent)]',
    'bg-[color-mix(in_srgb,var(--success)_6%,var(--surface-base))]',
  ),
  author: 'bg-[color-mix(in_srgb,var(--success)_10%,var(--surface-raised))]',
  meta: 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface-raised))] text-success-fg',
} as const;

type AcceptedSolutionBadgeProps = {
  /** Visible text. Default "Accepted solution". */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

export function AcceptedSolutionBadge({
  label = 'Accepted solution',
  size = 'sm',
  className,
  ...rest
}: AcceptedSolutionBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-success-subtle font-bold text-success-fg whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-[0.8125rem]',
        className,
      )}
      {...rest}
    >
      <FontAwesomeIcon icon={faCircleCheck} className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}

type MarkSolutionButtonProps = {
  /** True when this post is the topic's accepted solution: the button then offers to unmark it. */
  isSolution: boolean;
  onToggle?: (next: boolean) => void;
  labels?: { mark?: string; unmark?: string };
  size?: 'sm' | 'md';
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick' | 'type'>;

export function MarkSolutionButton({
  isSolution,
  onToggle,
  labels,
  size = 'sm',
  className,
  disabled,
  ...rest
}: MarkSolutionButtonProps) {
  const text = isSolution ? (labels?.unmark ?? 'Unmark solution') : (labels?.mark ?? 'Mark as solution');
  return (
    <button
      type="button"
      aria-pressed={isSolution}
      disabled={disabled}
      onClick={() => onToggle?.(!isSolution)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-base font-semibold text-text-secondary',
        'transition-colors hover:border-success hover:text-success-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-[0.8125rem]',
        isSolution && 'border-success text-success-fg',
        className,
      )}
      {...rest}
    >
      <FontAwesomeIcon icon={faCheck} className="w-3 h-3" aria-hidden="true" />
      {text}
    </button>
  );
}
