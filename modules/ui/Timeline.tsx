'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';

/**
 * A chronological activity feed.
 *
 * There was no timeline at the `ui` or `app` layer. The only timeline-shaped
 * code lived in unexported domain verticals (`domains/food/order`,
 * `domains/iot/alert`, `domains/nft/activity`, `domains/travel/itinerary`),
 * none of which is reachable from the published package — four
 * implementations, zero available to a consumer.
 *
 * ## Grouping is by the viewer's local day
 *
 * An event at 23:50 UTC belongs to a different day depending on who is looking.
 * Grouping on the raw ISO date puts it under the wrong heading for anyone east
 * or west of the server, which reads as "the app lost my note" rather than as a
 * timezone bug. The grouping key comes from `Intl.DateTimeFormat` in the given
 * `timeZone` — the viewer's own by default.
 */

export type TimelineItem = {
  /** Stable identity. Never the array index. */
  id: string;
  /** When it happened. A Date, or anything `new Date()` accepts. */
  at: Date | string | number;
  /** Short label — the verb. */
  title: ReactNode;
  /** The detail, if there is any worth showing inline. */
  body?: ReactNode;
  /** Small leading marker: an icon, an avatar, a coloured dot. */
  icon?: ReactNode;
  /** Tone of the marker. */
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /** Rendered at the right of the header row — a status chip, a menu. */
  meta?: ReactNode;
};

export type TimelineProps = {
  items: TimelineItem[];
  /**
   * IANA zone used for day grouping and time display.
   * Defaults to the viewer's own.
   */
  timeZone?: string;
  /** BCP 47 tag for the date and time formatting. */
  locale?: string;
  /** Hide the sticky day headings. */
  groupByDay?: boolean;
  emptyMessage?: string;
  className?: string;
};

const TONE_CLASS: Record<NonNullable<TimelineItem['tone']>, string> = {
  default: 'bg-surface-sunken text-text-secondary',
  success: 'bg-success-subtle text-success-fg',
  warning: 'bg-warning-subtle text-warning-fg',
  error: 'bg-error-subtle text-error-fg',
  info: 'bg-info-subtle text-info-fg',
};

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function Timeline({
  items,
  timeZone,
  locale,
  groupByDay = true,
  emptyMessage = 'Nothing here yet.',
  className,
}: TimelineProps) {
  if (items.length === 0) {
    return (
      <p className={cn('py-8 text-center text-sm text-text-secondary', className)}>
        {emptyMessage}
      </p>
    );
  }

  const dayFormat = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const timeFormat = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    // `hourCycle` rather than `hour12: false`: the latter renders midnight as
    // hour "24" on some ICU builds.
    hourCycle: 'h23',
  });

  // Grouping is computed before rendering rather than by mutating a variable
  // inside the map. React 19 may restart a render, and a closure variable that
  // survives the restart puts the day headings in the wrong places — a bug that
  // appears only under concurrent rendering and looks like data corruption.
  const sorted = [...items]
    .sort((a, b) => toDate(b.at).getTime() - toDate(a.at).getTime())
    .map((item) => ({ item, at: toDate(item.at) }));

  const rendered = sorted.map((entry, index) => {
    const day = dayFormat.format(entry.at);
    const previousDay = index === 0 ? null : dayFormat.format(sorted[index - 1].at);
    return { ...entry, day, showDay: groupByDay && day !== previousDay };
  });

  return (
    <ol className={cn('flex flex-col', className)}>
      {rendered.map(({ item, at, day, showDay }, index) => {
        const last = index === rendered.length - 1;
        return (
          <Fragment key={item.id}>
            {showDay && (
              <li className="sticky top-0 z-10 bg-surface-base/95 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary backdrop-blur">
                {day}
              </li>
            )}

            <li className="relative flex gap-3 pb-5 pl-1">
              {/*
                The connector is drawn on the item rather than the list so the
                last one can stop short — a line running past the final event
                reads as "more below" and there is nothing below. It is left out
                in code: a `last:` variant on the span would test the span (the
                li's first child), never the li.
              */}
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute left-[1.0625rem] top-8 bottom-0 w-px bg-border"
                />
              )}

              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full',
                  TONE_CLASS[item.tone ?? 'default'],
                )}
              >
                {item.icon}
              </span>

              <div className="min-w-0 flex-1 pt-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm text-text-primary">{item.title}</span>
                  <time
                    dateTime={at.toISOString()}
                    className="text-xs text-text-secondary tabular-nums"
                  >
                    {timeFormat.format(at)}
                  </time>
                  {item.meta && <span className="ml-auto">{item.meta}</span>}
                </div>

                {item.body && (
                  <div className="mt-1 text-sm text-text-secondary">{item.body}</div>
                )}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
