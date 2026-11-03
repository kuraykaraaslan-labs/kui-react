'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';

export type TimetableSession = {
  /** Index into `days`, 0 = the first column. */
  day: number;
  /** `HH:MM`. */
  start: string;
  end?: string;
  name: string;
  /** Who leads it. */
  who?: string;
  /** The room or studio. */
  where?: string;
};

type TimetableProps = {
  title?: string;
  subtitle?: string;
  sessions: TimetableSession[];
  /** Column headings, in order. A week from Monday by default. */
  days?: string[];
  /** Chips above the grid that show one class only. On by default when there are 2-12 classes. */
  filter?: boolean;
  hideEmptyDays?: boolean;
  note?: string;
  /** Visible words, for another language; English by default. */
  labels?: Partial<{ all: string; none: string; filter: string }>;
  className?: string;
};

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Container queries: the columns follow the space the timetable has, not the window.
const COLS: Record<number, string> = {
  1: '@2xl:grid-cols-1', 2: '@2xl:grid-cols-2', 3: '@2xl:grid-cols-3', 4: '@2xl:grid-cols-4', 5: '@3xl:grid-cols-5',
  6: '@2xl:grid-cols-3 @5xl:grid-cols-6', 7: '@2xl:grid-cols-4 @5xl:grid-cols-7',
};

/** The sessions in each day's column, sorted by start; sessions on a day that is not in `days` are left out. */
export function sessionsByDay(sessions: TimetableSession[], dayCount: number): TimetableSession[][] {
  const cols: TimetableSession[][] = Array.from({ length: dayCount }, () => []);
  for (const s of sessions) if (Number.isInteger(s.day) && s.day >= 0 && s.day < dayCount && s.name) cols[s.day].push(s);
  for (const c of cols) c.sort((a, b) => a.start.localeCompare(b.start));
  return cols;
}

/**
 * A weekly timetable: classes at a gym or studio, lessons at a school or course centre. One column per day on a
 * wide screen, one day under another on a phone; each session shows its time, name, who leads it and where. Chips
 * above the grid filter by class. Each day is a heading with a list under it, which a screen reader can walk day
 * by day. Mirrors next-boilerplate's dynamic_page Timetable block.
 */
export function Timetable({
  title,
  subtitle,
  sessions,
  days = WEEK,
  filter,
  hideEmptyDays = false,
  note,
  labels,
  className,
}: TimetableProps) {
  const [only, setOnly] = useState<string | null>(null);
  const cols = sessionsByDay(sessions, Math.min(days.length, 7));
  const names = [...new Set(cols.flat().map((s) => s.name))];
  if (names.length === 0 && !title) return null;
  const filterable = (filter ?? true) && names.length > 1 && names.length <= 12;
  const used = cols.map((_, i) => i).filter((i) => !hideEmptyDays || cols[i].length > 0);

  const chip = (label: string, value: string | null) => (
    <button
      key={label}
      type="button"
      aria-pressed={only === value}
      onClick={() => setOnly(value)}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        only === value ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-raised text-text-primary hover:border-primary',
      )}
    >
      {label}
    </button>
  );

  return (
    <section className={cn('@container w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-8 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      {filterable && (
        <div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label={labels?.filter ?? 'Show classes'}>
          {chip(labels?.all ?? 'All', null)}
          {names.map((n) => chip(n, n))}
        </div>
      )}
      {names.length > 0 && (
        <div className={cn('grid gap-4', COLS[used.length] ?? COLS[7])}>
          {used.map((d) => {
            const list = only ? cols[d].filter((s) => s.name === only) : cols[d];
            return (
              <section key={d} className="rounded-xl border border-border bg-surface-raised p-3">
                <h3 className="mb-3 border-b border-border pb-2 text-center text-sm font-bold uppercase tracking-wide">{days[d]}</h3>
                {list.length === 0 ? (
                  <p className="py-2 text-center text-sm text-text-disabled">{labels?.none ?? 'No classes'}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {list.map((s, i) => (
                      <li key={i} className="rounded-lg border-l-4 border-primary bg-surface-base px-3 py-2">
                        <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-primary">{s.start}{s.end ? `–${s.end}` : ''}</p>
                        <p className="font-semibold">{s.name}</p>
                        {(s.who || s.where) && <p className="text-xs text-text-secondary">{[s.who, s.where].filter(Boolean).join(' · ')}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      {note && <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-text-secondary">{note}</p>}
    </section>
  );
}
