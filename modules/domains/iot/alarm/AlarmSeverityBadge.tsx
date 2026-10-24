'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { cn } from '@/libs/utils/cn';
import type { AlarmSeverity } from '../types/alarm';
import { ALARM_SEVERITY_META } from './alarm-severity';
import { useIotText } from '../api/IotAdapterProvider';

/**
 * AlarmSeverityBadge — one of the five OD-9 levels (CRITICAL, MAJOR, MINOR, WARNING, INFO) with its own icon and tone from
 * `alarm-severity.ts`. Renamed from `AlertSeverityBadge` (OD-9); the old three-level values stay valid.
 */
export type AlarmSeverityBadgeProps = {
  severity: AlarmSeverity;
  size?: 'sm' | 'md';
  /** Translated labels per level; else the provider's texts, else English. */
  labels?: Partial<Record<AlarmSeverity, string>>;
  /** Icon only (the label stays for screen readers and as the tooltip). */
  iconOnly?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

export function AlarmSeverityBadge({ severity, size = 'md', labels, iconOnly = false, className, ...rest }: AlarmSeverityBadgeProps) {
  const meta = ALARM_SEVERITY_META[severity] ?? ALARM_SEVERITY_META.INFO;
  const { m } = useIotText();
  const label = labels?.[severity] ?? m.severity[severity] ?? meta.label;
  return (
    <span
      data-severity={severity}
      title={iconOnly ? label : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        meta.badgeClass,
        className,
      )}
      {...rest}
    >
      <FontAwesomeIcon icon={meta.icon} className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
