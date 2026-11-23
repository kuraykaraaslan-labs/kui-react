'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCircleCheck,
  faCircleQuestion,
  faComment,
  faEnvelope,
  faFileInvoiceDollar,
  faShieldHalved,
  faTriangleExclamation,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { ChatbotOutcome } from './types';
import { DEFAULT_CHATBOT_REPORT_MESSAGES, OUTCOME_LABEL_KEY } from './messages';

type Look = { icon: typeof faCircleCheck; classes: string };

/**
 * Each outcome's icon and tone. Status colours only where the outcome is a status: answered from pages (success),
 * could not answer and held back (warning), error (error); hand-offs and the rest stay neutral or brand.
 */
export const OUTCOME_LOOK: Record<ChatbotOutcome, Look> = {
  sourced: { icon: faCircleCheck, classes: 'bg-success-subtle text-success-fg' },
  unsourced: { icon: faComment, classes: 'bg-surface-sunken text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]' },
  forum: { icon: faUsers, classes: 'bg-primary-subtle text-primary' },
  quote: { icon: faFileInvoiceDollar, classes: 'bg-primary-subtle text-primary' },
  contact: { icon: faEnvelope, classes: 'bg-primary-subtle text-primary' },
  unanswered: { icon: faCircleQuestion, classes: 'bg-warning-subtle text-warning-fg' },
  refused: { icon: faBan, classes: 'bg-surface-sunken text-[color-mix(in_srgb,var(--text-secondary)_60%,var(--text-primary))]' },
  blocked: { icon: faShieldHalved, classes: 'bg-warning-subtle text-warning-fg' },
  error: { icon: faTriangleExclamation, classes: 'bg-error-subtle text-error-fg' },
};

type ChatbotOutcomeBadgeProps = {
  outcome: ChatbotOutcome;
  /** The outcome in words; default the English label. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

/** ChatbotOutcomeBadge — what one AI chat question ended in, as an icon and words (never colour alone). */
export function ChatbotOutcomeBadge({ outcome, label, size = 'md', className, ...rest }: ChatbotOutcomeBadgeProps) {
  const look = OUTCOME_LOOK[outcome];
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        look.classes,
        className,
      )}
      {...rest}
    >
      <FontAwesomeIcon icon={look.icon} className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label ?? DEFAULT_CHATBOT_REPORT_MESSAGES[OUTCOME_LABEL_KEY[outcome]]}</span>
    </span>
  );
}
