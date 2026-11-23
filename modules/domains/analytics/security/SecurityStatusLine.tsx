'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleExclamation, faCircleMinus, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { SecurityTone } from './summary';

const TONE: Record<SecurityTone, { icon: typeof faCircleCheck; classes: string }> = {
  ok: { icon: faCircleCheck, classes: 'border-success bg-success-subtle text-success-fg' },
  off: { icon: faCircleMinus, classes: 'border-border-strong bg-surface-sunken text-text-primary' },
  warning: { icon: faTriangleExclamation, classes: 'border-warning bg-warning-subtle text-warning-fg' },
  critical: { icon: faCircleExclamation, classes: 'border-error bg-error-subtle text-error-fg' },
};

type SecurityStatusLineProps = {
  tone: SecurityTone;
  /** The state in words ("No alerts open", "1 integrity alert open"). */
  text: string;
  /** A second, quieter line (the last server report). */
  detail?: React.ReactNode;
  /** Read before the words by screen readers ("Status"). */
  label?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

/**
 * SecurityStatusLine — the one-line verdict of the security summary: an icon and words for the state (no alerts, a
 * health alert open, an integrity alert open, the server not reporting), never colour alone. A live region, so a new
 * verdict is announced.
 */
export function SecurityStatusLine({ tone, text, detail, label, className, ...rest }: SecurityStatusLineProps) {
  const t = TONE[tone];
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', t.classes, className)} data-tone={tone} {...rest}>
      <FontAwesomeIcon icon={t.icon} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-semibold">
          {label && <span className="sr-only">{label}: </span>}
          {text}
        </p>
        {detail && <p className="text-xs text-text-secondary">{detail}</p>}
      </div>
    </div>
  );
}
