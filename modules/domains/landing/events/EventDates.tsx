'use client';
import { useSyncExternalStore } from 'react';
import { cn } from '@/libs/utils/cn';

export type EventDate = {
  /** `YYYY-MM-DD`. */
  date: string;
  time?: string;
  title: string;
  venue?: string;
  city?: string;
  /** "Sold out", "Few left", "Cancelled"… A gone status dims the row and drops its link. */
  status?: string;
  href?: string;
};

type EventDatesProps = {
  title?: string;
  subtitle?: string;
  dates: EventDate[];
  /** Keep past dates (a results list). By default they drop off once the page has loaded. */
  showPast?: boolean;
  /** BCP 47 locale for the month and weekday. Default: the browser's. */
  locale?: string;
  labels?: Partial<{ tickets: string; none: string }>;
  className?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const GONE = /^(sold out|cancelled|canceled|postponed|full|tükendi|iptal|ertelendi)$/i;
const noSubscribe = () => () => {};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Dated rows with a title, sorted by date and time; past ones left out when `from` is given. */
export function sortedDates(dates: EventDate[], from?: string | null): EventDate[] {
  return dates
    .filter((d) => d.title?.trim() && ISO.test(d.date) && (!from || d.date >= from))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
}

/**
 * Event dates for a website: a band's tour, a club's fixtures, a theatre's performances. Each row has a calendar
 * badge, the title, the time, venue and city, a status and a ticket link that names the event. Past dates drop off in
 * the visitor's browser after load. Mirrors next-boilerplate's dynamic_page Event dates block; the record-shaped
 * EventCard (event domain) stays for event platforms.
 */
export function EventDates({ title, subtitle, dates, showPast = false, locale, labels, className }: EventDatesProps) {
  // The visitor's day, read in the browser only: the server snapshot is null, so the server never guesses it.
  const from = useSyncExternalStore(noSubscribe, today, () => null);
  const list = sortedDates(dates, showPast ? null : from);
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => { try { return new Intl.DateTimeFormat(locale, o).format(new Date(`${iso}T12:00:00`)); } catch { return ''; } };
  return (
    <section className={cn('w-full text-text-primary', className)}>
      {(title || subtitle) && (
        <div className="mx-auto mb-10 max-w-2xl text-center">
          {title && <h2 className="text-3xl font-bold">{title}</h2>}
          {subtitle && <p className="mt-3 text-text-secondary">{subtitle}</p>}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-center text-text-secondary">{labels?.none ?? 'No dates announced yet.'}</p>
      ) : (
        <ul className="mx-auto flex max-w-4xl flex-col divide-y divide-border rounded-xl border border-border bg-surface-raised">
          {list.map((d, i) => {
            const gone = d.status ? GONE.test(d.status.trim()) : false;
            return (
              <li key={i} className={cn('flex flex-wrap items-center gap-4 p-4', gone && 'opacity-60')}>
                <time dateTime={d.date} className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-primary-subtle py-2 text-primary">
                  <span className="text-xs font-semibold uppercase">{fmt(d.date, { month: 'short' })}</span>
                  <span className="text-2xl font-bold leading-none tabular-nums">{Number(d.date.slice(8, 10))}</span>
                  <span className="text-[0.65rem] uppercase">{fmt(d.date, { weekday: 'short' })}</span>
                </time>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold [overflow-wrap:anywhere]">{d.title}</p>
                  {(d.time || d.venue || d.city) && <p className="text-sm text-text-secondary">{[d.time, d.venue, d.city].filter(Boolean).join(' · ')}</p>}
                </div>
                {d.status && <span className={cn('rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide', gone ? 'bg-text-primary text-surface-base' : 'bg-primary-subtle text-primary')}>{d.status}</span>}
                {d.href && !gone && (
                  <a href={d.href} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                    {labels?.tickets ?? 'Tickets'}<span className="sr-only">: {d.title}, {d.date}</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
