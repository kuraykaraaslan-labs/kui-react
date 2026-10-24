'use client';
import { cn } from '@/libs/utils/cn';
import type { AlarmStatus } from '../types/alarm';
import { ALARM_STATUS_META } from './alarm-severity';
import { useIotText } from '../api/IotAdapterProvider';

/** AlarmStatusPill — OPEN / ACKNOWLEDGED / RESOLVED as a pill (tones from `alarm-severity.ts`). */
export type AlarmStatusPillProps = {
  status: AlarmStatus;
  size?: 'sm' | 'md';
  labels?: Partial<Record<AlarmStatus, string>>;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

export function AlarmStatusPill({ status, size = 'md', labels, className, ...rest }: AlarmStatusPillProps) {
  const meta = ALARM_STATUS_META[status] ?? ALARM_STATUS_META.OPEN;
  const { m } = useIotText();
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs',
        meta.badgeClass,
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 rounded-full bg-current', status === 'RESOLVED' && 'opacity-60')}
      />
      {labels?.[status] ?? m.status[status] ?? meta.label}
    </span>
  );
}
