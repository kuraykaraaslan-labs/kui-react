'use client';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

type StaffBadgeProps = {
  /** Organisation the member verifiably works for (e.g. checked by their e-mail domain). */
  org: string;
  /**
   * The organisation's colour, any CSS colour (`var(--secondary-active)`, `oklch(…)`, a brand hex from the host's settings).
   * The text is always white, so pick a colour dark enough to carry it. Default `var(--primary-active)`.
   */
  colour?: string;
  /** Visible text. Default "<org> staff". */
  label?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

/** Verified-employee pill: check icon + "<Org> staff" on the organisation's colour, with a soft ring of the same colour. */
export function StaffBadge({ org, colour, label, className, style, title, ...rest }: StaffBadgeProps) {
  const text = label ?? `${org} staff`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full py-px pl-1.5 pr-2 text-[0.6875rem] font-bold whitespace-nowrap',
        'bg-[var(--staff)] text-white ring-2 ring-[color-mix(in_srgb,var(--staff)_25%,transparent)]',
        className,
      )}
      style={{ ['--staff' as string]: colour ?? 'var(--primary-active)', ...style }}
      title={title ?? text}
      {...rest}
    >
      <FontAwesomeIcon icon={faCheck} className="w-2.5 h-2.5" aria-hidden="true" />
      {text}
    </span>
  );
}
