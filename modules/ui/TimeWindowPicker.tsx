'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';

/**
 * TimeWindowPicker — relative presets ("1h", "7d"), an optional custom "last N minutes / hours / days", calendar
 * periods ("today", "previous month", optionally "so far"), an absolute UTC range, and the interval / aggregation /
 * time zone that go with a window (phase 9 §9.7; calendar and durations: next-boilerplate dashboard 20.1b/20.1c).
 * Day-granularity `DateRangePicker` has no presets or times; this is the dashboard / telemetry variant.
 * The value type is structural, so it carries no dashboard import.
 */

export type TimeWindowValue =
  | { mode: 'relative'; last: string; interval?: string; aggregation?: string; timezone?: string }
  | { mode: 'absolute'; from: string; to: string; interval?: string; aggregation?: string; timezone?: string }
  | { mode: 'calendar'; period: string; soFar?: boolean; interval?: string; aggregation?: string; timezone?: string };

const DEFAULT_PRESETS = ['15m', '1h', '6h', '24h', '7d', '30d', '90d', '365d'];
const DEFAULT_INTERVALS = ['auto', '1m', '5m', '1h', '1d'];
const DEFAULT_AGGREGATIONS = ['avg', 'min', 'max', 'sum', 'count', 'none'];

/** The calendar periods offered by default: the current and the previous of each unit, then two extras. */
export const DEFAULT_CALENDAR_PERIODS = [
  'current.hour', 'current.day', 'current.week', 'current.isoWeek', 'current.month', 'current.quarter', 'current.halfYear', 'current.year',
  'previous.hour', 'previous.day', 'previous.week', 'previous.isoWeek', 'previous.month', 'previous.quarter', 'previous.halfYear', 'previous.year',
  'dayBeforeYesterday', 'thisDayLastWeek',
];

/** `<n>m`, `<n>h` or `<n>d`: what a custom duration is written as. */
const DURATION = /^([1-9]\d{0,5})([mhd])$/;
const DURATION_UNITS = ['m', 'h', 'd'] as const;

/** A short list for a browser that cannot enumerate zones. */
const FALLBACK_ZONES = [
  'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles',
];

/** Every IANA zone the browser knows (UTC first), or a short list; the current value is always among them. */
export function zoneChoices(current?: string): string[] {
  let all: string[] = [];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch { /* an old browser: use the short list */ }
  const list = all.length > 0 ? ['UTC', ...all.filter((z) => z !== 'UTC')] : FALLBACK_ZONES;
  return current && !list.includes(current) ? [...list, current] : list;
}

/** `2026-10-06T12:00:00.000Z` → `2026-10-06T12:00` for a `datetime-local` input (UTC). */
const toInput = (iso: string): string => iso.slice(0, 16);
const fromInput = (v: string): string => new Date(`${v}:00.000Z`).toISOString();

export type TimeWindowMessages = {
  label: string;
  presets: string;
  custom: string;
  from: string;
  to: string;
  interval: string;
  intervalAuto: string;
  /** `{value}` is replaced. */
  intervalValue: string;
  aggregation: string;
  /** `{value}` is replaced. */
  aggregationValue: string;
  calendar: string;
  calendarPeriod: string;
  soFar: string;
  duration: string;
  durationAmount: string;
  durationUnit: string;
  /** Unit names for the custom duration, keyed `m` / `h` / `d`. */
  durationUnits: Record<string, string>;
  timezone: string;
  timezoneDefault: string;
  /** Period names, keyed by period (`current.day`, `previous.month`, ...); an unknown key shows as itself. */
  periods: Record<string, string>;
};

export const DEFAULT_TIME_WINDOW_MESSAGES: TimeWindowMessages = {
  label: 'Time window',
  presets: 'Quick ranges',
  custom: 'Custom',
  from: 'From (UTC)',
  to: 'To (UTC)',
  interval: 'Interval',
  intervalAuto: 'Interval: auto',
  intervalValue: 'Interval: {value}',
  aggregation: 'Aggregation',
  aggregationValue: 'Aggregate: {value}',
  calendar: 'Calendar',
  calendarPeriod: 'Calendar period',
  soFar: 'So far',
  duration: 'Last',
  durationAmount: 'Amount',
  durationUnit: 'Unit',
  durationUnits: { m: 'minutes', h: 'hours', d: 'days' },
  timezone: 'Time zone',
  timezoneDefault: 'Zone: default',
  periods: {
    'current.hour': 'This hour', 'current.day': 'Today', 'current.week': 'This week', 'current.isoWeek': 'This week (Mon)',
    'current.month': 'This month', 'current.quarter': 'This quarter', 'current.halfYear': 'This half year', 'current.year': 'This year',
    'previous.hour': 'Previous hour', 'previous.day': 'Yesterday', 'previous.week': 'Previous week', 'previous.isoWeek': 'Previous week (Mon)',
    'previous.month': 'Previous month', 'previous.quarter': 'Previous quarter', 'previous.halfYear': 'Previous half year', 'previous.year': 'Previous year',
    dayBeforeYesterday: 'Day before yesterday', thisDayLastWeek: 'This day last week',
  },
};

const field = 'h-8 rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const segment = (active: boolean) => cn(
  'h-8 shrink-0 px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
  active ? 'bg-primary text-primary-fg' : 'bg-surface-base text-text-secondary hover:bg-surface-sunken',
);

type Panel = 'preset' | 'duration' | 'calendar' | 'absolute';
const panelOf = (value: TimeWindowValue | null, presets: string[]): Panel =>
  !value ? 'preset'
    : value.mode === 'absolute' ? 'absolute'
      : value.mode === 'calendar' ? 'calendar'
        : presets.includes(value.last) ? 'preset' : 'duration';

export function TimeWindowPicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  intervals = DEFAULT_INTERVALS,
  aggregations = DEFAULT_AGGREGATIONS,
  allowAbsolute = true,
  allowDuration = false,
  calendarPeriods = [],
  showInterval = true,
  showAggregation = true,
  showTimezone = false,
  className,
  idPrefix = 'tw',
  messages,
}: {
  value: TimeWindowValue | null;
  onChange: (next: TimeWindowValue) => void;
  presets?: string[];
  intervals?: string[];
  aggregations?: string[];
  allowAbsolute?: boolean;
  /** Offer a custom "last N minutes / hours / days" next to the presets (default off). */
  allowDuration?: boolean;
  /** The calendar periods to offer (`DEFAULT_CALENDAR_PERIODS` for all); empty = no Calendar option (the default). */
  calendarPeriods?: string[];
  showInterval?: boolean;
  showAggregation?: boolean;
  /** Offer an explicit time zone for the window (default off). No zone means the consumer's own default. */
  showTimezone?: boolean;
  className?: string;
  idPrefix?: string;
  /** Visible and accessible text; every key is optional. */
  messages?: Partial<TimeWindowMessages>;
}) {
  const m = { ...DEFAULT_TIME_WINDOW_MESSAGES, ...messages };
  const periodName = (p: string) => m.periods[p] ?? DEFAULT_TIME_WINDOW_MESSAGES.periods[p] ?? p;
  const [panel, setPanel] = useState<Panel>(() => panelOf(value, presets));
  const extras = value ? { interval: value.interval, aggregation: value.aggregation, timezone: value.timezone } : {};
  const fallback = (): TimeWindowValue => ({ mode: 'relative', last: presets.includes('24h') ? '24h' : presets[0] });
  const set = (patch: Partial<Pick<TimeWindowValue, 'interval' | 'aggregation'>>) => {
    onChange({ ...(value ?? fallback()), ...patch } as TimeWindowValue);
  };
  const duration = value?.mode === 'relative' ? DURATION.exec(value.last) : null;
  const [amount, setAmount] = useState(duration ? duration[1] : '');
  const [unit, setUnit] = useState<string>(duration ? duration[2] : 'h');
  const emitDuration = (n: string, u: string) => {
    if (DURATION.test(`${n}${u}`)) onChange({ mode: 'relative', last: `${n}${u}`, ...extras } as TimeWindowValue);
  };
  const isCurrent = (p: string) => p.startsWith('current.');

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label={m.label}>
      {/* max-w-full overflow-x-auto: in a container narrower than the segments, they scroll inside the control. */}
      <div className="inline-flex max-w-full overflow-x-auto rounded-md border border-border [scrollbar-width:thin]" role="radiogroup" aria-label={m.presets}>
        {presets.map((p) => {
          const active = panel === 'preset' && value?.mode === 'relative' && value.last === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { setPanel('preset'); onChange({ mode: 'relative', last: p, ...extras } as TimeWindowValue); }}
              className={segment(active)}
            >
              {p}
            </button>
          );
        })}
        {allowDuration && (
          <button
            type="button"
            role="radio"
            aria-checked={panel === 'duration'}
            onClick={() => { setPanel('duration'); if (amount) emitDuration(amount, unit); }}
            className={segment(panel === 'duration')}
          >
            {m.duration}
          </button>
        )}
        {calendarPeriods.length > 0 && (
          <button
            type="button"
            role="radio"
            aria-checked={panel === 'calendar'}
            onClick={() => {
              setPanel('calendar');
              if (value?.mode !== 'calendar') onChange({ mode: 'calendar', period: calendarPeriods[0], ...extras } as TimeWindowValue);
            }}
            className={segment(panel === 'calendar')}
          >
            {m.calendar}
          </button>
        )}
        {allowAbsolute && (
          <button
            type="button"
            role="radio"
            aria-checked={panel === 'absolute'}
            onClick={() => {
              setPanel('absolute');
              if (value?.mode !== 'absolute') {
                const to = new Date(); to.setMinutes(0, 0, 0);
                onChange({ mode: 'absolute', from: new Date(to.getTime() - 24 * 3_600_000).toISOString(), to: to.toISOString(), ...extras } as TimeWindowValue);
              }
            }}
            className={segment(panel === 'absolute')}
          >
            {m.custom}
          </button>
        )}
      </div>

      {panel === 'duration' && (
        <div className="flex items-center gap-1.5">
          <input
            id={`${idPrefix}-amount`}
            type="number"
            inputMode="numeric"
            min={1}
            aria-label={m.durationAmount}
            className={cn(field, 'w-20')}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); emitDuration(e.target.value, unit); }}
          />
          <select
            id={`${idPrefix}-unit`}
            aria-label={m.durationUnit}
            className={field}
            value={unit}
            onChange={(e) => { setUnit(e.target.value); emitDuration(amount, e.target.value); }}
          >
            {DURATION_UNITS.map((u) => <option key={u} value={u}>{m.durationUnits[u] ?? u}</option>)}
          </select>
        </div>
      )}

      {panel === 'calendar' && value?.mode === 'calendar' && (
        <div className="flex items-center gap-2">
          <select
            id={`${idPrefix}-period`}
            aria-label={m.calendarPeriod}
            className={field}
            value={value.period}
            onChange={(e) => {
              const period = e.target.value;
              onChange({ ...value, period, ...(isCurrent(period) ? {} : { soFar: undefined }) });
            }}
          >
            {(calendarPeriods.includes(value.period) ? calendarPeriods : [...calendarPeriods, value.period]).map((p) => (
              <option key={p} value={p}>{periodName(p)}</option>
            ))}
          </select>
          <label className={cn('flex items-center gap-1.5 text-xs', isCurrent(value.period) ? 'text-text-secondary' : 'text-text-disabled')}>
            <input
              id={`${idPrefix}-so-far`}
              type="checkbox"
              className="rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus"
              checked={value.soFar === true}
              disabled={!isCurrent(value.period)}
              onChange={(e) => onChange({ ...value, soFar: e.target.checked || undefined })}
            />
            {m.soFar}
          </label>
        </div>
      )}

      {panel === 'absolute' && value?.mode === 'absolute' && (
        <div className="flex items-center gap-1.5">
          <input
            id={`${idPrefix}-from`}
            type="datetime-local"
            aria-label={m.from}
            className={field}
            value={toInput(value.from)}
            max={toInput(value.to)}
            onChange={(e) => e.target.value && onChange({ ...value, from: fromInput(e.target.value) })}
          />
          <span aria-hidden="true" className="text-text-secondary">–</span>
          <input
            id={`${idPrefix}-to`}
            type="datetime-local"
            aria-label={m.to}
            className={field}
            value={toInput(value.to)}
            min={toInput(value.from)}
            onChange={(e) => e.target.value && onChange({ ...value, to: fromInput(e.target.value) })}
          />
        </div>
      )}

      {showInterval && (
        <select
          aria-label={m.interval}
          className={field}
          value={value?.interval ?? 'auto'}
          onChange={(e) => set({ interval: e.target.value })}
        >
          {intervals.map((i) => (
            <option key={i} value={i}>
              {i === 'auto' ? m.intervalAuto : m.intervalValue.replace('{value}', i)}
            </option>
          ))}
        </select>
      )}
      {showTimezone && (
        <select
          aria-label={m.timezone}
          className={field}
          value={value?.timezone ?? ''}
          onChange={(e) => {
            const { timezone: _drop, ...rest } = value ?? fallback();
            onChange((e.target.value ? { ...rest, timezone: e.target.value } : rest) as TimeWindowValue);
          }}
        >
          <option value="">{m.timezoneDefault}</option>
          {zoneChoices(value?.timezone).map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      )}
      {showAggregation && (
        <select
          aria-label={m.aggregation}
          className={field}
          value={value?.aggregation ?? 'avg'}
          onChange={(e) => set({ aggregation: e.target.value })}
        >
          {aggregations.map((a) => (
            <option key={a} value={a}>{m.aggregationValue.replace('{value}', a)}</option>
          ))}
        </select>
      )}
    </div>
  );
}
