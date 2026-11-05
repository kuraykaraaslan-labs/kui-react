'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from './Button';

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
  /**
   * When it happened. A Date, or anything `new Date()` accepts. Missing or invalid: the entry is undated, drawn after
   * every dated one (whatever `order` says) without a time.
   */
  at?: Date | string | number | null;
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
  /**
   * A step of a process: `done` (the default look), `current` (ringed, `aria-current="step"`) or `upcoming` (not
   * reached yet: a hollow, dashed marker and muted text).
   */
  status?: TimelineStatus;
};

export type TimelineStatus = 'done' | 'current' | 'upcoming';

/** The surface a timeline sits on. */
export type TimelineSurface = 'base' | 'raised' | 'overlay' | 'sunken';

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
  /**
   * How precise an entry's time is: `minutes` (the default, `14:05`) or `seconds` (`14:05:09`, a log where several entries share a
   * minute). `showTimeZone` adds the zone's short name (`14:05:09 GMT+3`), so a time read beside another zone's is not taken for it.
   */
  timePrecision?: 'minutes' | 'seconds';
  showTimeZone?: boolean;
  /** `newest` first (a feed, the default) or `oldest` first (a process from its start). */
  order?: 'newest' | 'oldest';
  /** Day heading of the undated entries (with `groupByDay`); without it they follow the last day unheaded. */
  undatedLabel?: string;
  emptyMessage?: string;
  /** Older entries exist: a "Load more" button under the last entry calls `onLoadMore`. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** The next batch is loading (the button shows a spinner and is disabled). */
  loadingMore?: boolean;
  loadMoreLabel?: string;
  /**
   * The surface the timeline sits on (`raised` inside a card): the sticky day headings, the hollow marker of an upcoming step
   * and the gap of the current step's ring take its colour, so nothing reads as a band or a ring of another surface.
   */
  surface?: TimelineSurface;
  className?: string;
};

// Literal classes, so the stylesheet keeps them.
const SURFACE_CLASS: Record<TimelineSurface, { bg: string; ringOffset: string }> = {
  base: { bg: 'bg-surface-base', ringOffset: 'ring-offset-surface-base' },
  raised: { bg: 'bg-surface-raised', ringOffset: 'ring-offset-surface-raised' },
  overlay: { bg: 'bg-surface-overlay', ringOffset: 'ring-offset-surface-overlay' },
  sunken: { bg: 'bg-surface-sunken', ringOffset: 'ring-offset-surface-sunken' },
};

const TONE_CLASS: Record<NonNullable<TimelineItem['tone']>, string> = {
  default: 'bg-surface-sunken text-text-secondary',
  success: 'bg-success-subtle text-success-fg',
  warning: 'bg-warning-subtle text-warning-fg',
  error: 'bg-error-subtle text-error-fg',
  info: 'bg-info-subtle text-info-fg',
};

/** The entry's date, or null when it has none or it is not a real date (formatting one would throw a RangeError). */
function toDate(value: TimelineItem['at']): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function Timeline({
  items,
  timeZone,
  locale,
  groupByDay = true,
  timePrecision = 'minutes',
  showTimeZone = false,
  order = 'newest',
  undatedLabel,
  emptyMessage = 'Nothing here yet.',
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  loadMoreLabel = 'Load more',
  surface = 'base',
  className,
}: TimelineProps) {
  const surfaceClass = SURFACE_CLASS[surface] ?? SURFACE_CLASS.base;
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
    ...(timePrecision === 'seconds' ? { second: '2-digit' as const } : {}),
    ...(showTimeZone ? { timeZoneName: 'short' as const } : {}),
    // `hourCycle` rather than `hour12: false`: the latter renders midnight as
    // hour "24" on some ICU builds.
    hourCycle: 'h23',
  });

  // Grouping is computed before rendering rather than by mutating a variable
  // inside the map. React 19 may restart a render, and a closure variable that
  // survives the restart puts the day headings in the wrong places — a bug that
  // appears only under concurrent rendering and looks like data corruption.
  // Undated entries go last in either order, keeping the order they came in.
  const dir = order === 'oldest' ? 1 : -1;
  const sorted = items
    .map((item) => ({ item, at: toDate(item.at) }))
    .sort((a, b) => {
      if (!a.at || !b.at) return a.at ? -1 : b.at ? 1 : 0;
      return dir * (a.at.getTime() - b.at.getTime());
    });

  const dayOf = (at: Date | null) => (at ? dayFormat.format(at) : (undatedLabel ?? null));
  const rendered = sorted.map((entry, index) => {
    const day = dayOf(entry.at);
    const previousDay = index === 0 ? undefined : dayOf(sorted[index - 1].at);
    return { ...entry, day, showDay: groupByDay && day !== null && day !== previousDay };
  });

  return (
    <ol className={cn('flex flex-col', className)}>
      {rendered.map(({ item, at, day, showDay }, index) => {
        const last = index === rendered.length - 1;
        return (
          <Fragment key={item.id}>
            {/*
              The day heading is drawn in the timeline's own surface (opaque, so it stays readable while it sticks), lines up
              with the events' text (the item's 0.25rem + the marker's 2.125rem + the 0.75rem gap) and keeps a gap above the
              first marker.
            */}
            {showDay && (
              <li className={cn('sticky top-0 z-10 mb-2 py-2 pl-[3.125rem] text-xs font-medium uppercase tracking-wide text-text-secondary', surfaceClass.bg)}>
                {day}
              </li>
            )}

            {/* The last event ends at its text: no padding under it before whatever follows the timeline. */}
            <li
              className={cn('relative flex gap-3 pl-1', !last && 'pb-5')}
              aria-current={item.status === 'current' ? 'step' : undefined}
              data-status={item.status}
            >
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
                  className={cn(
                    'absolute left-[1.0625rem] top-8 bottom-0',
                    // The way to a step not reached yet is dashed.
                    rendered[index + 1]?.item.status === 'upcoming' ? 'border-l border-dashed border-border' : 'w-px bg-border',
                  )}
                />
              )}

              <span
                aria-hidden="true"
                className={cn(
                  'relative z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full',
                  item.status === 'upcoming'
                    ? cn('border-2 border-dashed border-border-strong text-text-disabled', surfaceClass.bg)
                    : TONE_CLASS[item.tone ?? 'default'],
                  item.status === 'current' && cn('ring-2 ring-primary ring-offset-2', surfaceClass.ringOffset),
                )}
              >
                {item.icon}
              </span>

              <div className="min-w-0 flex-1 pt-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={cn('text-sm', item.status === 'upcoming' ? 'text-text-secondary' : 'text-text-primary', item.status === 'current' && 'font-medium')}>
                    {item.title}
                  </span>
                  {at && (
                    <time
                      dateTime={at.toISOString()}
                      className="text-xs text-text-secondary tabular-nums"
                    >
                      {timeFormat.format(at)}
                    </time>
                  )}
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
      {hasMore && onLoadMore && (
        <li className="pl-12 pt-5" data-part="load-more">
          <Button variant="outline" size="sm" loading={loadingMore} disabled={loadingMore} onClick={onLoadMore}>
            {loadMoreLabel}
          </Button>
        </li>
      )}
    </ol>
  );
}
