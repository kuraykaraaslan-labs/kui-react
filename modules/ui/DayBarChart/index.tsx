'use client';
// modules/ui/DayBarChart/index.tsx
//
// DayBarChart — one bar per day (the 90-day uptime strip of a status page), coloured by availability, with incident
// markers, a tooltip on hover/focus and a pinned details popover on click/Enter. Status is told four ways, not
// colour alone: bar height, an incident marker, the accessible name of each day, and the legend. Days are focusable
// with a roving tabindex (arrow keys, Home, End). Reusable per component and per region: pass a `label`.

import { useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { fillMessage, formatPercent } from '../_shared/format';
import { isRtlElement } from '../_shared/dom';
import {
  DEFAULT_DAY_THRESHOLDS, dayStatus, dayToUtcMs, meanAvailability,
  type DayBar, type DayIncident, type DayStatus, type DayThresholds,
} from './model';

export type { DayBar, DayIncident, DayStatus, DayThresholds, DayIncidentSeverity } from './model';
export { dayStatus, meanAvailability, statusCounts, fillDays, DEFAULT_DAY_THRESHOLDS } from './model';

export type DayBarChartMessages = {
  /** `{label}` */
  group: string;
  operational: string;
  degraded: string;
  outage: string;
  noData: string;
  incident: string;
  /** `{date}`, `{availability}`, `{status}`, `{incidents}` */
  dayLabel: string;
  noDataDay: string;
  /** `{count}` */
  incidentCount: string;
  /** `{count}` */
  moreIncidents: string;
  /** `{value}`, `{days}` */
  summary: string;
  noSummary: string;
  close: string;
  details: string;
  legend: string;
  /** `{value}` */
  atLeast: string;
  /** `{from}`, `{to}` */
  between: string;
  /** `{value}` */
  below: string;
  severity: Record<NonNullable<DayIncident['severity']>, string>;
};

export const DEFAULT_DAY_BAR_CHART_MESSAGES: DayBarChartMessages = {
  group: 'Daily availability for {label}',
  operational: 'Operational',
  degraded: 'Degraded',
  outage: 'Outage',
  noData: 'No data',
  incident: 'Incident',
  dayLabel: '{date}: {availability}, {status}{incidents}',
  noDataDay: 'no data',
  incidentCount: '{count} incidents',
  moreIncidents: '+{count} more',
  summary: '{value} uptime over {days} days',
  noSummary: 'No data for this period',
  close: 'Close details',
  details: 'Day details',
  legend: 'Legend',
  atLeast: '{value} or more',
  between: '{from} to {to}',
  below: 'below {value}',
  severity: { minor: 'Minor', major: 'Major', critical: 'Critical', maintenance: 'Maintenance' },
};

export type DayBarChartProps = {
  /** Oldest first. Use `fillDays` to pad gaps with no-data days. */
  days: DayBar[];
  /** Names the strip ("API", "EU region"); used in the accessible name and the heading. */
  label?: string;
  /** Show `label` as a visible heading with the summary beside it. Default = true when `label` is set. */
  showHeading?: boolean;
  thresholds?: DayThresholds;
  /** Overall figure under the strip. Default = true. */
  showSummary?: boolean;
  /** First and last date under the strip. Default = true. */
  showRange?: boolean;
  /** Legend of the four states and the incident marker. Default = true. */
  showLegend?: boolean;
  /** Height of the strip in px. Default = 40. */
  height?: number;
  /** Pinned day (controlled), by date. */
  selectedDate?: string | null;
  defaultSelectedDate?: string | null;
  onSelect?: (day: DayBar | null) => void;
  /** Extra content for the pinned popover, after the incidents. */
  renderDetails?: (day: DayBar) => React.ReactNode;
  locale?: string;
  /** Decimal places of the availability figures. Default = 2. */
  digits?: number;
  messages?: Partial<DayBarChartMessages>;
  className?: string;
};

const HEIGHT_PCT: Record<DayStatus, number> = { operational: 100, degraded: 78, outage: 56, nodata: 34 };
const FILL: Record<DayStatus, string> = {
  operational: 'bg-success',
  degraded: 'bg-warning',
  outage: 'bg-error',
  nodata: 'bg-surface-sunken',
};

function dateText(date: string, locale?: string, style: 'short' | 'long' = 'long'): string {
  const ms = dayToUtcMs(date);
  if (Number.isNaN(ms)) return date;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: style === 'long' ? 'medium' : 'short', timeZone: 'UTC' }).format(new Date(ms));
  } catch {
    return date;
  }
}

export function DayBarChart({
  days,
  label,
  showHeading,
  thresholds = DEFAULT_DAY_THRESHOLDS,
  showSummary = true,
  showRange = true,
  showLegend = true,
  height = 40,
  selectedDate,
  defaultSelectedDate = null,
  onSelect,
  renderDetails,
  locale,
  digits = 2,
  messages,
  className,
}: DayBarChartProps) {
  const msg = useMemo(() => ({ ...DEFAULT_DAY_BAR_CHART_MESSAGES, ...messages, severity: { ...DEFAULT_DAY_BAR_CHART_MESSAGES.severity, ...messages?.severity } }), [messages]);
  const uid = useId();
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [focusIdx, setFocusIdx] = useState(Math.max(0, days.length - 1));
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [localPinned, setLocalPinned] = useState<string | null>(defaultSelectedDate);
  const pinnedDate = selectedDate !== undefined ? selectedDate : localPinned;
  const pinnedIdx = pinnedDate ? days.findIndex((d) => d.date === pinnedDate) : -1;
  const [focused, setFocused] = useState(false);

  const mean = useMemo(() => meanAvailability(days), [days]);
  const statusText: Record<DayStatus, string> = { operational: msg.operational, degraded: msg.degraded, outage: msg.outage, nodata: msg.noData };
  const heading = showHeading ?? Boolean(label);

  const pin = (idx: number | null) => {
    const day = idx === null ? null : days[idx] ?? null;
    if (selectedDate === undefined) setLocalPinned(day?.date ?? null);
    onSelect?.(day);
  };

  const active = Math.min(Math.max(focusIdx, 0), Math.max(0, days.length - 1));
  const move = (idx: number) => {
    const i = Math.min(Math.max(idx, 0), days.length - 1);
    setFocusIdx(i);
    requestAnimationFrame(() => stripRef.current?.querySelectorAll<HTMLButtonElement>('button[data-day]')[i]?.focus());
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtlElement(stripRef.current);
    const next = rtl ? 'ArrowLeft' : 'ArrowRight';
    const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === next) move(active + 1);
    else if (e.key === prev) move(active - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(days.length - 1);
    else if (e.key === 'Escape' && pinnedIdx >= 0) { pin(null); }
    else return;
    e.preventDefault();
  };

  const shownIdx = pinnedIdx >= 0 ? pinnedIdx : hoverIdx ?? (focused ? active : null);
  const shownDay = shownIdx !== null ? days[shownIdx] : null;
  const pct = shownIdx !== null && days.length > 1 ? (shownIdx / (days.length - 1)) * 100 : 50;
  // Pinned popovers are interactive (incident links), so they are a dialog; hover/focus tips are plain tooltips.
  const popover = shownDay && (
    <div
      id={`${uid}-pop`}
      role={pinnedIdx >= 0 ? 'dialog' : 'tooltip'}
      aria-label={pinnedIdx >= 0 ? msg.details : undefined}
      className="absolute top-full z-20 mt-2 w-64 max-w-[90vw] rounded-md border border-border bg-surface-raised p-3 text-sm shadow-lg"
      style={{ insetInlineStart: `${pct}%`, transform: `translateX(-${pct}%)` }}
    >
      <DayDetails
        day={shownDay}
        status={dayStatus(shownDay.availability, thresholds)}
        statusText={statusText}
        msg={msg}
        locale={locale}
        digits={digits}
        pinned={pinnedIdx >= 0}
        onClose={() => { pin(null); move(shownIdx ?? 0); }}
        extra={pinnedIdx >= 0 && renderDetails ? renderDetails(shownDay) : null}
      />
    </div>
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {heading && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
          {showSummary && (
            <span className="text-sm text-text-secondary">
              {mean === null ? msg.noSummary : fillMessage(msg.summary, { value: formatPercent(mean, digits), days: days.length })}
            </span>
          )}
        </div>
      )}
      <div className="relative" onMouseLeave={() => setHoverIdx(null)}>
        <div
          ref={stripRef}
          role="group"
          aria-label={fillMessage(msg.group, { label: label ?? '' }).trim()}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
          className="flex items-end gap-px"
          style={{ height }}
        >
          {days.map((d, i) => {
            const status = dayStatus(d.availability, thresholds);
            const incidents = d.incidents ?? [];
            const name = fillMessage(msg.dayLabel, {
              date: dateText(d.date, locale),
              availability: d.availability === null ? msg.noDataDay : formatPercent(d.availability, digits),
              status: statusText[status],
              incidents: incidents.length ? `, ${fillMessage(msg.incidentCount, { count: incidents.length })}` : '',
            });
            return (
              <button
                key={d.date}
                type="button"
                data-day={d.date}
                data-status={status}
                tabIndex={i === active ? 0 : -1}
                aria-label={name}
                aria-describedby={shownIdx === i ? `${uid}-pop` : undefined}
                aria-expanded={pinnedIdx === i ? true : undefined}
                aria-haspopup="dialog"
                onClick={() => { setFocusIdx(i); pin(pinnedIdx === i ? null : i); }}
                onMouseEnter={() => setHoverIdx(i)}
                onFocus={() => setFocusIdx(i)}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-none"
              >
                {incidents.length > 0 && (
                  <span
                    aria-hidden="true"
                    data-part="incident-marker"
                    className="absolute -top-1 start-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-text-primary rtl:translate-x-1/2"
                  />
                )}
                <span
                  aria-hidden="true"
                  className={cn(
                    'block w-full rounded-[1px] transition-opacity group-hover:opacity-80',
                    'group-focus-visible:ring-2 group-focus-visible:ring-border-focus group-focus-visible:ring-offset-1',
                    FILL[status],
                    pinnedIdx === i && 'ring-2 ring-primary',
                  )}
                  style={{
                    height: `${HEIGHT_PCT[status]}%`,
                    backgroundImage: status === 'nodata'
                      ? 'repeating-linear-gradient(135deg, transparent 0 3px, var(--border) 3px 4px)'
                      : status === 'outage'
                        ? 'repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in srgb, var(--surface-base) 35%, transparent) 4px 5px)'
                        : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>
        {popover}
      </div>
      {showRange && days.length > 0 && (
        <div className="flex justify-between text-xs text-text-secondary" aria-hidden="true">
          <span>{dateText(days[0].date, locale, 'short')}</span>
          <span>{dateText(days[days.length - 1].date, locale, 'short')}</span>
        </div>
      )}
      {!heading && showSummary && (
        <p className="text-sm text-text-secondary">{mean === null ? msg.noSummary : fillMessage(msg.summary, { value: formatPercent(mean, digits), days: days.length })}</p>
      )}
      {showLegend && (
        <ul aria-label={msg.legend} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          {(['operational', 'degraded', 'outage', 'nodata'] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('inline-block w-2.5 rounded-[1px]', FILL[s])}
                style={{
                  height: Math.round(HEIGHT_PCT[s] / 100 * 12),
                  backgroundImage: s === 'nodata' ? 'repeating-linear-gradient(135deg, transparent 0 3px, var(--border) 3px 4px)' : undefined,
                }}
              />
              <span>
                {statusText[s]}
                <span className="text-text-disabled">{' '}({legendRange(s, thresholds, msg, digits)})</span>
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rotate-45 bg-text-primary" />
            {msg.incident}
          </li>
        </ul>
      )}
    </div>
  );
}

function legendRange(s: DayStatus, t: DayThresholds, msg: DayBarChartMessages, digits: number): string {
  if (s === 'operational') return fillMessage(msg.atLeast, { value: formatPercent(t.operational, digits) });
  if (s === 'degraded') return fillMessage(msg.between, { from: formatPercent(t.degraded, digits), to: formatPercent(t.operational, digits) });
  if (s === 'outage') return fillMessage(msg.below, { value: formatPercent(t.degraded, digits) });
  return msg.noDataDay;
}

function DayDetails({
  day, status, statusText, msg, locale, digits, pinned, onClose, extra,
}: {
  day: DayBar;
  status: DayStatus;
  statusText: Record<DayStatus, string>;
  msg: DayBarChartMessages;
  locale?: string;
  digits: number;
  pinned: boolean;
  onClose: () => void;
  extra: React.ReactNode;
}) {
  const incidents = day.incidents ?? [];
  const listed = pinned ? incidents : incidents.slice(0, 3);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-text-primary">{dateText(day.date, locale)}</p>
        {pinned && (
          <button type="button" aria-label={msg.close} onClick={onClose} className="-m-1 flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-text-secondary">
        {day.availability === null ? msg.noDataDay : formatPercent(day.availability, digits)} · {statusText[status]}
      </p>
      {listed.length > 0 && (
        <ul className="flex flex-col gap-1">
          {listed.map((inc) => (
            <li key={inc.id} className="flex items-start gap-1.5">
              <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 text-warning" />
              <span className="min-w-0">
                {inc.href && pinned
                  ? <a href={inc.href} className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{inc.title}</a>
                  : inc.title}
                {inc.severity && <span className="ms-1 text-xs text-text-secondary">({msg.severity[inc.severity]})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!pinned && incidents.length > listed.length && (
        <p className="text-xs text-text-secondary">{fillMessage(msg.moreIncidents, { count: incidents.length - listed.length })}</p>
      )}
      {extra}
    </div>
  );
}
