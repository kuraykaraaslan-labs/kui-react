'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';

export type WeekDay = 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su';

export type OpeningHoursRow = {
  day: WeekDay;
  /** `HH:MM`. A day may have two rows (a lunch break); a close before the open runs past midnight. */
  open?: string;
  close?: string;
  closed?: boolean;
};

type OpeningHoursProps = {
  title?: string;
  hours: OpeningHoursRow[];
  /** IANA time zone of the business ("Europe/Istanbul"); the viewer's own zone when left out. */
  timeZone?: string;
  /** Show the "open now / closed now" line (worked out in the browser after load, so a cached page never freezes it). */
  showStatus?: boolean;
  /** `card`: a raised card. `plain`: the list alone. */
  variant?: 'card' | 'plain';
  note?: string;
  /** Visible words, for another language; English by default. */
  labels?: Partial<{ closed: string; openNow: string; closedNow: string } & Record<WeekDay, string>>;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>;

const DAYS: WeekDay[] = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const DAY_NAMES: Record<WeekDay, string> = {
  mo: 'Monday', tu: 'Tuesday', we: 'Wednesday', th: 'Thursday', fr: 'Friday', sa: 'Saturday', su: 'Sunday',
};
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

type Span = { day: WeekDay; open: string; close: string };

function spans(rows: OpeningHoursRow[]): Span[] {
  return rows
    .filter((r): r is Required<Pick<OpeningHoursRow, 'day' | 'open' | 'close'>> & OpeningHoursRow =>
      !r.closed && TIME.test(r.open ?? '') && (TIME.test(r.close ?? '') || r.close === '24:00') && r.open !== r.close)
    .map((r) => ({ day: r.day, open: r.open, close: r.close }))
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.open) - toMin(b.open));
}

function moment(at: Date, timeZone?: string): { day: WeekDay; minute: number } {
  let parts: Intl.DateTimeFormatPart[];
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  try {
    parts = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timeZone || undefined }).formatToParts(at);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(at);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').slice(0, 2).toLowerCase() as WeekDay;
  return { day: DAYS.includes(day) ? day : 'mo', minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** Whether the business is open at `at` in `timeZone`; a late span (22:00–02:00) counts after midnight too. */
export function isOpenAt(rows: OpeningHoursRow[], at: Date, timeZone?: string): boolean {
  const { day, minute } = moment(at, timeZone);
  const prev = DAYS[(DAYS.indexOf(day) + 6) % 7];
  return spans(rows).some((s) => {
    const o = toMin(s.open);
    const c = s.close === '24:00' ? 1440 : toMin(s.close);
    if (c > o) return s.day === day && minute >= o && minute < c;
    return (s.day === day && minute >= o) || (s.day === prev && minute < c);
  });
}

/**
 * A business's weekly opening hours: seven days, split days, spans past midnight, today marked and an optional
 * "open now" line in the business's own time zone. Mirrors next-boilerplate's dynamic_page Opening Hours block.
 */
export function OpeningHours({
  title = 'Opening hours',
  hours,
  timeZone,
  showStatus = true,
  variant = 'card',
  note,
  labels,
  className,
  ...rest
}: OpeningHoursProps) {
  const [now, setNow] = useState<{ open: boolean; day: WeekDay } | null>(null);

  useEffect(() => {
    if (!showStatus) return;
    const tick = () => {
      const at = new Date();
      setNow({ open: isOpenAt(hours, at, timeZone), day: moment(at, timeZone).day });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [hours, showStatus, timeZone]);

  const all = spans(hours);

  return (
    <div
      className={cn(
        variant === 'card' && 'rounded-xl border border-border bg-surface-raised p-6 shadow-sm',
        'text-text-primary',
        className,
      )}
      {...rest}
    >
      {title && <h3 className="text-xl font-bold">{title}</h3>}
      {now && (
        <p role="status" className={cn('mt-2 inline-flex items-center gap-2 text-sm font-medium', now.open ? 'text-success-fg' : 'text-text-secondary')}>
          <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', now.open ? 'bg-success' : 'bg-text-secondary')} />
          {now.open ? labels?.openNow ?? 'Open now' : labels?.closedNow ?? 'Closed now'}
        </p>
      )}
      <dl className="mt-4 divide-y divide-border">
        {DAYS.map((day) => {
          const today = now?.day === day;
          const list = all.filter((s) => s.day === day);
          return (
            <div
              key={day}
              aria-current={today ? 'date' : undefined}
              className={cn('flex items-baseline justify-between gap-4 py-2.5', today ? 'font-semibold text-text-primary' : 'text-text-secondary')}
            >
              <dt>{labels?.[day] ?? DAY_NAMES[day]}</dt>
              <dd className="text-right tabular-nums">
                {list.length === 0 ? labels?.closed ?? 'Closed' : list.map((s) => `${s.open}–${s.close}`).join(', ')}
              </dd>
            </div>
          );
        })}
      </dl>
      {note && <p className="mt-4 text-sm text-text-secondary">{note}</p>}
    </div>
  );
}
