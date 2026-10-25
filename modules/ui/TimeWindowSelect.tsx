'use client';
import { useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Popover } from './Overlays/Popover';
import {
  DEFAULT_CALENDAR_PERIODS, DEFAULT_TIME_WINDOW_MESSAGES, zoneChoices,
  type TimeWindowValue, type TimeWindowMessages,
} from './TimeWindowPicker';

/**
 * TimeWindowSelect — a time window behind one button, the way dashboards (ThingsBoard and the like) do it: the button
 * names the window ("Realtime · Last 24h · avg 5m"), and a panel opens with two tabs.
 *
 * - Realtime: the last N minutes / hours / days (presets or any amount) sliding with now, or the current calendar
 *   period (today, this month...), optionally "so far".
 * - History: the last N anchored when it is applied, a fixed range typed in the window's zone, or a past calendar
 *   period (yesterday, previous month...).
 * - Both: aggregation, grouping interval (with how many buckets that makes, and a warning above `maxBuckets`) and
 *   time zone.
 *
 * Edits are a draft until Update; Cancel and Escape drop them. The value is the same structural `TimeWindowValue` as
 * `TimeWindowPicker` (relative / absolute / calendar), so a consumer can swap one for the other.
 */

const DEFAULT_PRESETS = ['5m', '15m', '30m', '1h', '6h', '12h', '24h', '3d', '7d', '30d'];
const DEFAULT_INTERVALS = ['auto', '1m', '5m', '10m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '7d'];
const DEFAULT_AGGREGATIONS = ['avg', 'min', 'max', 'sum', 'count', 'none'];
const DURATION = /^([1-9]\d{0,5})([mhd])$/;
const UNIT_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
const PERIOD_UNIT_MS: Record<string, number> = {
  hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, isoWeek: 7 * 86_400_000, month: 30 * 86_400_000,
  quarter: 91 * 86_400_000, halfYear: 182 * 86_400_000, year: 365 * 86_400_000,
};

export type TimeWindowSelectMessages = TimeWindowMessages & {
  realtime: string;
  history: string;
  last: string;
  currentPeriod: string;
  pastPeriod: string;
  fixedRange: string;
  /** `{zone}` is replaced. */
  fromIn: string;
  /** `{zone}` is replaced. */
  toIn: string;
  browserZone: string;
  update: string;
  cancel: string;
  /** `{count}` is replaced. */
  buckets: string;
  /** `{count}` is replaced. */
  bucketsTooMany: string;
  open: string;
  /** `{days}` is replaced. */
  tooLong: string;
};

export const DEFAULT_TIME_WINDOW_SELECT_MESSAGES: TimeWindowSelectMessages = {
  ...DEFAULT_TIME_WINDOW_MESSAGES,
  realtime: 'Realtime',
  history: 'History',
  last: 'Last',
  currentPeriod: 'Current period',
  pastPeriod: 'Period',
  fixedRange: 'Fixed range',
  fromIn: 'From ({zone})',
  toIn: 'To ({zone})',
  browserZone: 'browser',
  update: 'Update',
  cancel: 'Cancel',
  buckets: '≈ {count} buckets',
  bucketsTooMany: '≈ {count} buckets: the server will use a coarser interval',
  open: 'Change time window',
  tooLong: 'A window can be at most {days} days long',
};

// ── zoned wall-clock helpers: a `datetime-local` value is a wall time in the window's zone ──────────────────────

function wallParts(t: number, timeZone: string | undefined): Record<string, string> {
  const f = new Intl.DateTimeFormat('en-CA', {
    ...(timeZone ? { timeZone } : {}), hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(t))) p[part.type] = part.value;
  return p;
}

/** An instant as `YYYY-MM-DDTHH:mm` in a zone (the browser's when none), for a `datetime-local` input. */
export function toZonedInput(iso: string, timeZone?: string): string {
  const p = wallParts(Date.parse(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** A `datetime-local` value read as a wall time in a zone (the browser's when none), as an ISO instant. */
export function fromZonedInput(v: string, timeZone?: string): string {
  const [d, hm] = v.split('T');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = (hm ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, day, h, mi);
  const offset = (t: number) => {
    const p = wallParts(t, timeZone);
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
  };
  const first = guess - offset(guess);
  const second = guess - offset(first);
  // In a DST gap the wall time does not exist and the two readings disagree: the later one is the first real instant,
  // in every zone (review 2026-10-17: New York moved back, Berlin forward).
  return new Date(second === first ? second : Math.max(first, second)).toISOString();
}

/** The span a window covers, in ms (a calendar period approximately), or null when it cannot be told. */
export function windowSpanMs(w: TimeWindowValue): number | null {
  if (w.mode === 'relative') {
    const m = DURATION.exec(w.last);
    return m ? Number(m[1]) * UNIT_MS[m[2]] : null;
  }
  if (w.mode === 'absolute') {
    const s = Date.parse(w.to) - Date.parse(w.from);
    return Number.isFinite(s) && s > 0 ? s : null;
  }
  if (w.period === 'dayBeforeYesterday' || w.period === 'thisDayLastWeek') return 86_400_000;
  return PERIOD_UNIT_MS[w.period.split('.')[1]] ?? null;
}

const intervalMs = (i: string): number | null => {
  const m = /^([1-9]\d*)([mhd])$/.exec(i);
  return m ? Number(m[1]) * UNIT_MS[m[2]] : null;
};

const systemNow = (): number => Date.now();

type Tab = 'realtime' | 'history';
type RealtimeKind = 'last' | 'current';
type HistoryKind = 'last' | 'range' | 'period';

const tabOf = (w: TimeWindowValue | null): Tab =>
  !w || w.mode === 'relative' || (w.mode === 'calendar' && w.period.startsWith('current.')) ? 'realtime' : 'history';

const field = 'h-8 rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const chip = (active: boolean) => cn(
  'h-7 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  active ? 'bg-primary text-primary-fg' : 'bg-surface-sunken text-text-secondary hover:text-text-primary',
);
const tabClass = (active: boolean) => cn(
  'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
  active ? 'bg-primary text-primary-fg shadow-sm' : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary',
);

export function TimeWindowSelect({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  intervals = DEFAULT_INTERVALS,
  aggregations = DEFAULT_AGGREGATIONS,
  calendarPeriods = DEFAULT_CALENDAR_PERIODS,
  showInterval = true,
  showAggregation = true,
  showTimezone = true,
  tabs = ['realtime', 'history'],
  maxBuckets = 500,
  maxSpanMs = 366 * 86_400_000,
  idPrefix = 'tws',
  className,
  messages,
  now = systemNow,
}: {
  value: TimeWindowValue | null;
  onChange: (next: TimeWindowValue) => void;
  presets?: string[];
  intervals?: string[];
  aggregations?: string[];
  /** Current periods show under Realtime, past ones under History; empty hides both period options. */
  calendarPeriods?: string[];
  showInterval?: boolean;
  showAggregation?: boolean;
  showTimezone?: boolean;
  /** Which kinds of window may be picked (default both). With one, the panel shows only that one and no tab list. */
  tabs?: Array<'realtime' | 'history'>;
  /** Above this many buckets the panel says the server will coarsen the interval (match the server's cap). */
  maxBuckets?: number;
  /** The longest window a consumer accepts (default 366 days, the dashboard server's); a longer one cannot be applied. */
  maxSpanMs?: number;
  idPrefix?: string;
  className?: string;
  messages?: Partial<TimeWindowSelectMessages>;
  /** The clock "History · Last N" is anchored to (tests). */
  now?: () => number;
}) {
  const m: TimeWindowSelectMessages = { ...DEFAULT_TIME_WINDOW_SELECT_MESSAGES, ...messages, periods: { ...DEFAULT_TIME_WINDOW_MESSAGES.periods, ...messages?.periods } };
  const fallback: TimeWindowValue = { mode: 'relative', last: presets.includes('24h') ? '24h' : presets[0] };
  const currentPeriods = calendarPeriods.filter((p) => p.startsWith('current.'));
  const pastPeriods = calendarPeriods.filter((p) => !p.startsWith('current.'));

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TimeWindowValue>(value ?? fallback);
  const allowed = tabs.length > 0 ? tabs : (['realtime', 'history'] as Tab[]);
  const startTab = (v: TimeWindowValue | null): Tab => (allowed.includes(tabOf(v)) ? tabOf(v) : allowed[0]);
  const [tab, setTab] = useState<Tab>(startTab(value));
  const [rtKind, setRtKind] = useState<RealtimeKind>('last');
  const [hKind, setHKind] = useState<HistoryKind>('range');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('h');

  /** The aggregation shown and applied: the window's own when offered, else `avg` when offered, else the first one offered. */
  const aggregationFor = (a: string | undefined) => (a && aggregations.includes(a) ? a : aggregations.includes('avg') ? undefined : aggregations[0]);
  const begin = () => {
    const raw = value ?? fallback;
    // A board that does not offer the window's aggregation (or `avg`, the default) shows and applies one it offers.
    const agg = aggregationFor(raw.aggregation);
    const v = (agg === raw.aggregation ? raw : { ...raw, aggregation: agg }) as TimeWindowValue;
    setDraft(v);
    setTab(startTab(v));
    // A window of a kind this board does not offer opens on the kind it does, starting from a default of that kind.
    // Only the settings carry over: the old kind's own keys (`last`, `from`/`to`, `period`) must not ride along, a strict
    // consumer refuses a window with keys of two kinds.
    if (!allowed.includes(tabOf(v))) {
      const carry = { ...(v.interval ? { interval: v.interval } : {}), ...(v.aggregation ? { aggregation: v.aggregation } : {}), ...(v.timezone ? { timezone: v.timezone } : {}) };
      if (allowed[0] === 'realtime') setDraft({ ...fallback, ...carry } as TimeWindowValue);
      else { const to = new Date(now()); to.setSeconds(0, 0); setDraft({ mode: 'absolute', from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString(), ...carry }); }
    }
    setRtKind(v.mode === 'calendar' && v.period.startsWith('current.') ? 'current' : 'last');
    setHKind(v.mode === 'calendar' ? 'period' : 'range');
    const d = v.mode === 'relative' ? DURATION.exec(v.last) : null;
    setAmount(d ? d[1] : '1');
    setUnit(d ? d[2] : 'h');
  };
  const onOpenChange = (next: boolean) => { if (next) begin(); setOpen(next); };

  const extras = { interval: draft.interval, aggregation: draft.aggregation, timezone: draft.timezone };
  const put = (next: TimeWindowValue) => setDraft({ ...next, ...extras } as TimeWindowValue);
  const durationMs = DURATION.test(`${amount}${unit}`) ? Number(amount) * UNIT_MS[unit] : null;
  const durationValid = durationMs !== null && durationMs <= maxSpanMs;

  const switchTab = (next: Tab) => {
    setTab(next);
    if (next === 'realtime' && tabOf(draft) !== 'realtime') {
      // Back to the "Last" choice on the default preset, with the inputs showing it (review 2026-10-17: the current
      // period stayed ticked while Update stored the preset).
      const last = fallback.mode === 'relative' ? fallback.last : '24h';
      const d = DURATION.exec(last);
      setRtKind('last');
      if (d) { setAmount(d[1]); setUnit(d[2]); }
      put({ mode: 'relative', last });
    }
    if (next === 'history' && tabOf(draft) !== 'history') {
      const to = new Date(now()); to.setSeconds(0, 0);
      put({ mode: 'absolute', from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString() });
      setHKind('range');
    }
  };

  const historyLast = tab === 'history' && hKind === 'last';
  const realtimeLast = tab === 'realtime' && rtKind === 'last';
  const draftSpan = windowSpanMs(draft);
  const tooLong = historyLast || realtimeLast ? durationMs !== null && durationMs > maxSpanMs : draftSpan !== null && draftSpan > maxSpanMs;
  const canApply = historyLast || realtimeLast
    ? durationValid
    : !tooLong && !(draft.mode === 'absolute' && !(Date.parse(draft.to) > Date.parse(draft.from)));
  /** What Update stores: a History "last N" is anchored to the moment it is applied (the clock is read only here). */
  const apply = () => {
    if (!canApply) return;
    if (historyLast) {
      const to = now();
      onChange({ ...extras, mode: 'absolute', from: new Date(to - Number(amount) * UNIT_MS[unit]).toISOString(), to: new Date(to).toISOString() } as TimeWindowValue);
    } else {
      onChange(draft);
    }
    setOpen(false);
  };

  const span = historyLast ? (durationValid ? Number(amount) * UNIT_MS[unit] : null) : windowSpanMs(draft);
  const step = draft.interval && draft.interval !== 'auto' ? intervalMs(draft.interval) : null;
  const bucketCount = span && step ? Math.ceil(span / step) : null;

  const zoneName = draft.timezone ?? m.browserZone;
  const periodName = (p: string) => m.periods[p] ?? p;

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom"
      className="w-[26rem] max-w-[calc(100vw-2rem)] p-3"
      // The trigger is max-w-full with a truncating summary: in a narrow container it shrinks instead of overflowing.
      shrinkTrigger
      trigger={
        <button
          id={`${idPrefix}-trigger`}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${m.open}: ${summarize(value, m)}`}
          className={cn('inline-flex h-8 max-w-full items-center gap-2 rounded-md border border-border bg-surface-base px-3 text-sm text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', className)}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="10" cy="10" r="7.25" /><path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate">{summarize(value, m)}</span>
        </button>
      }
    >
      <div className="space-y-3" aria-label={m.label} role="group">
        {allowed.length > 1 && (
        <div role="tablist" aria-label={m.label} className="flex gap-1 rounded-lg bg-surface-sunken p-1">
          {(['realtime', 'history'] as const).map((t) => (
            <button
              key={t}
              id={`${idPrefix}-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`${idPrefix}-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => switchTab(t)}
              onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); switchTab(t === 'realtime' ? 'history' : 'realtime'); } }}
              className={tabClass(tab === t)}
            >
              {t === 'realtime' ? m.realtime : m.history}
            </button>
          ))}
        </div>
        )}

        {tab === 'realtime' && (
          <div id={`${idPrefix}-panel-realtime`} {...(allowed.length > 1 ? { role: 'tabpanel', 'aria-labelledby': `${idPrefix}-tab-realtime` } : {})} className="space-y-3">
            <Option name={`${idPrefix}-rt`} checked={rtKind === 'last'} label={m.last} onSelect={() => { setRtKind('last'); if (durationValid) put({ mode: 'relative', last: `${amount}${unit}` }); }}>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={m.presets}>
                {presets.map((p) => {
                  const active = rtKind === 'last' && draft.mode === 'relative' && draft.last === p;
                  return (
                    <button key={p} type="button" role="radio" aria-checked={active} className={chip(active)}
                      onClick={() => { setRtKind('last'); const d = DURATION.exec(p); if (d) { setAmount(d[1]); setUnit(d[2]); } put({ mode: 'relative', last: p }); }}>
                      {p}
                    </button>
                  );
                })}
              </div>
              <DurationInputs idPrefix={`${idPrefix}-rt`} m={m} amount={amount} unit={unit}
                onChange={(a, u) => { setAmount(a); setUnit(u); setRtKind('last'); if (DURATION.test(`${a}${u}`)) put({ mode: 'relative', last: `${a}${u}` }); }} />
            </Option>
            {currentPeriods.length > 0 && (
              <Option name={`${idPrefix}-rt`} checked={rtKind === 'current'} label={m.currentPeriod}
                onSelect={() => { setRtKind('current'); if (!(draft.mode === 'calendar' && draft.period.startsWith('current.'))) put({ mode: 'calendar', period: currentPeriods[0] }); }}>
                <div className="flex items-center gap-2">
                  <select id={`${idPrefix}-current`} aria-label={m.currentPeriod} className={field} disabled={rtKind !== 'current'}
                    value={draft.mode === 'calendar' && draft.period.startsWith('current.') ? draft.period : currentPeriods[0]}
                    onChange={(e) => put({ mode: 'calendar', period: e.target.value, ...(draft.mode === 'calendar' && draft.soFar ? { soFar: true } : {}) })}>
                    {currentPeriods.map((p) => <option key={p} value={p}>{periodName(p)}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <input type="checkbox" disabled={rtKind !== 'current'} className="rounded border-border focus-visible:ring-2 focus-visible:ring-border-focus"
                      checked={draft.mode === 'calendar' && draft.soFar === true}
                      onChange={(e) => draft.mode === 'calendar' && put({ mode: 'calendar', period: draft.period, ...(e.target.checked ? { soFar: true } : {}) })} />
                    {m.soFar}
                  </label>
                </div>
              </Option>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div id={`${idPrefix}-panel-history`} {...(allowed.length > 1 ? { role: 'tabpanel', 'aria-labelledby': `${idPrefix}-tab-history` } : {})} className="space-y-3">
            <Option name={`${idPrefix}-h`} checked={hKind === 'last'} label={m.last} onSelect={() => setHKind('last')}>
              <DurationInputs idPrefix={`${idPrefix}-h`} m={m} amount={amount} unit={unit} disabled={hKind !== 'last'}
                onChange={(a, u) => { setAmount(a); setUnit(u); }} />
            </Option>
            <Option name={`${idPrefix}-h`} checked={hKind === 'range'} label={m.fixedRange}
              onSelect={() => {
                setHKind('range');
                if (draft.mode !== 'absolute') {
                  const to = new Date(now()); to.setSeconds(0, 0);
                  put({ mode: 'absolute', from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString() });
                }
              }}>
              {draft.mode === 'absolute' && hKind === 'range' && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-text-secondary">
                    <span>{m.fromIn.replace('{zone}', zoneName)}</span>
                    <input id={`${idPrefix}-from`} type="datetime-local" className={cn(field, 'w-full')}
                      value={toZonedInput(draft.from, draft.timezone)} max={toZonedInput(draft.to, draft.timezone)}
                      onChange={(e) => e.target.value && setDraft({ ...draft, from: fromZonedInput(e.target.value, draft.timezone) })} />
                  </label>
                  <label className="space-y-1 text-xs text-text-secondary">
                    <span>{m.toIn.replace('{zone}', zoneName)}</span>
                    <input id={`${idPrefix}-to`} type="datetime-local" className={cn(field, 'w-full')}
                      value={toZonedInput(draft.to, draft.timezone)} min={toZonedInput(draft.from, draft.timezone)}
                      onChange={(e) => e.target.value && setDraft({ ...draft, to: fromZonedInput(e.target.value, draft.timezone) })} />
                  </label>
                </div>
              )}
            </Option>
            {pastPeriods.length > 0 && (
              <Option name={`${idPrefix}-h`} checked={hKind === 'period'} label={m.pastPeriod}
                onSelect={() => { setHKind('period'); if (!(draft.mode === 'calendar' && !draft.period.startsWith('current.'))) put({ mode: 'calendar', period: pastPeriods[0] }); }}>
                <select id={`${idPrefix}-past`} aria-label={m.pastPeriod} className={field} disabled={hKind !== 'period'}
                  value={draft.mode === 'calendar' && !draft.period.startsWith('current.') ? draft.period : pastPeriods[0]}
                  onChange={(e) => put({ mode: 'calendar', period: e.target.value })}>
                  {pastPeriods.map((p) => <option key={p} value={p}>{periodName(p)}</option>)}
                </select>
              </Option>
            )}
          </div>
        )}

        {(showAggregation || showInterval || showTimezone) && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {showAggregation && (
                <select aria-label={m.aggregation} className={field} value={draft.aggregation ?? (aggregations.includes('avg') ? 'avg' : aggregations[0])}
                  onChange={(e) => setDraft({ ...draft, aggregation: e.target.value })}>
                  {aggregations.map((a) => <option key={a} value={a}>{m.aggregationValue.replace('{value}', a)}</option>)}
                </select>
              )}
              {showInterval && (
                <select aria-label={m.interval} className={field} value={draft.interval ?? 'auto'}
                  onChange={(e) => setDraft({ ...draft, interval: e.target.value })}>
                  {intervals.map((i) => <option key={i} value={i}>{i === 'auto' ? m.intervalAuto : m.intervalValue.replace('{value}', i)}</option>)}
                </select>
              )}
              {showTimezone && (
                <select aria-label={m.timezone} className={cn(field, 'max-w-full')} value={draft.timezone ?? ''}
                  onChange={(e) => {
                    const { timezone: _drop, ...rest } = draft;
                    setDraft((e.target.value ? { ...rest, timezone: e.target.value } : rest) as TimeWindowValue);
                  }}>
                  <option value="">{m.timezoneDefault}</option>
                  {zoneChoices(draft.timezone).map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              )}
            </div>
            {tooLong && (
              <p className="text-xs text-error" role="alert">{m.tooLong.replace('{days}', String(Math.floor(maxSpanMs / 86_400_000)))}</p>
            )}
            {bucketCount !== null && (
              <p className={cn('text-xs', bucketCount > maxBuckets ? 'text-warning' : 'text-text-secondary')} role="status">
                {(bucketCount > maxBuckets ? m.bucketsTooMany : m.buckets).replace('{count}', String(bucketCount))}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)}
            className="h-8 rounded-md px-3 text-sm text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {m.cancel}
          </button>
          <button type="button" onClick={apply} disabled={!canApply}
            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            {m.update}
          </button>
        </div>
      </div>
    </Popover>
  );
}

function Option({ name, checked, label, onSelect, children }: { name: string; checked: boolean; label: string; onSelect: () => void; children?: React.ReactNode }) {
  return (
    <div className={cn('space-y-2 rounded-md border p-2', checked ? 'border-primary' : 'border-border')}>
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <input type="radio" name={name} checked={checked} onChange={onSelect} className="focus-visible:ring-2 focus-visible:ring-border-focus" />
        {label}
      </label>
      {children}
    </div>
  );
}

function DurationInputs({ idPrefix, m, amount, unit, disabled, onChange }: {
  idPrefix: string; m: TimeWindowSelectMessages; amount: string; unit: string; disabled?: boolean; onChange: (amount: string, unit: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input id={`${idPrefix}-amount`} type="number" inputMode="numeric" min={1} aria-label={m.durationAmount} disabled={disabled}
        className={cn(field, 'w-20')} value={amount} onChange={(e) => onChange(e.target.value, unit)} />
      <select id={`${idPrefix}-unit`} aria-label={m.durationUnit} disabled={disabled} className={field} value={unit}
        onChange={(e) => onChange(amount, e.target.value)}>
        {(['m', 'h', 'd'] as const).map((u) => <option key={u} value={u}>{m.durationUnits[u] ?? u}</option>)}
      </select>
    </div>
  );
}

/** The trigger's text: which tab, then the window, interval, aggregation and zone when set. */
export function summarize(w: TimeWindowValue | null, m: TimeWindowSelectMessages = DEFAULT_TIME_WINDOW_SELECT_MESSAGES): string {
  if (!w) return m.label;
  const tab = tabOf(w) === 'realtime' ? m.realtime : m.history;
  const what = w.mode === 'relative'
    ? `${m.last} ${w.last}`
    : w.mode === 'calendar'
      ? `${m.periods[w.period] ?? w.period}${w.soFar ? ` (${m.soFar.toLowerCase()})` : ''}`
      : `${toZonedInput(w.from, w.timezone).replace('T', ' ')} – ${toZonedInput(w.to, w.timezone).replace('T', ' ')}`;
  const parts = [tab, what];
  if (w.aggregation || (w.interval && w.interval !== 'auto')) parts.push([w.aggregation, w.interval && w.interval !== 'auto' ? w.interval : null].filter(Boolean).join(' '));
  if (w.timezone) parts.push(w.timezone);
  return parts.join(' · ');
}
