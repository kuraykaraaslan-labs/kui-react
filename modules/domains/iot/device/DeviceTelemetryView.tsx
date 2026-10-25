'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { EmptyState } from '@/modules/ui/EmptyState';
import { AlertBanner } from '@/modules/ui/AlertBanner';
import { Select } from '@/modules/ui/Select';
import { useIotAdapter, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import type { IotAdapter, TelemetryLatest, TelemetryPoint, TelemetryValue } from '../api/adapter';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative } from '../format';
import type { IotMessagesInput } from '../messages';
import { TelemetryTimeSeriesChart, type TelemetrySeries } from '../telemetry/TelemetryTimeSeriesChart';

/**
 * DeviceTelemetryView — the device page's Telemetry tab: every key the device sends with its latest value and when it came, live (a
 * value changes in place as the device sends it; without a live source the table is read again every 30 s), searchable, sortable and
 * filterable by kind; and a trend of the numeric keys ticked in the table (up to `maxCharted`, the first numeric key to begin with) over a
 * window of the last hour to the last seven days. Needs the adapter's `telemetry`.
 */
export type DeviceTelemetryViewProps = {
  deviceId: string;
  /** How many keys the trend draws at once. Default 4. */
  maxCharted?: number;
  locale?: string;
  /** "Now" for relative times (tests). */
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

type Kind = 'number' | 'flag' | 'text' | 'json';
type Row = TelemetryLatest & { kind: Kind };
type WindowKey = '1h' | '6h' | '24h' | '7d';

const WINDOW_MS: Record<WindowKey, number> = { '1h': 3_600_000, '6h': 6 * 3_600_000, '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000 };
/** Series colours: distinct in light and dark, never the state colours of a lamp. */
const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

export function kindOf(v: TelemetryValue): Kind {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'flag';
  if (typeof v === 'string') return 'text';
  return 'json';
}

/** A value as the table shows it: numbers as the locale writes them, flags as On / Off, JSON compact. */
export function showValue(v: TelemetryValue, m: { on: string; off: string }, locale?: string): string {
  if (typeof v === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(v);
  if (typeof v === 'boolean') return v ? m.on : m.off;
  if (typeof v === 'string') return v;
  const text = JSON.stringify(v);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** Series on one time axis: the labels are every point's time, each series `null` where it has no point. */
export function alignSeries(series: Record<string, TelemetryPoint[]>, keys: readonly string[]): { times: number[]; data: Record<string, Array<number | null>> } {
  const times = [...new Set(keys.flatMap((k) => (series[k] ?? []).map((p) => p.ts)))].sort((a, b) => a - b);
  const index = new Map(times.map((t, i) => [t, i] as const));
  const data: Record<string, Array<number | null>> = {};
  for (const k of keys) {
    const row: Array<number | null> = times.map(() => null);
    for (const p of series[k] ?? []) row[index.get(p.ts)!] = p.value;
    data[k] = row;
  }
  return { times, data };
}

/** The series of `want` (`<window>|<key,key>`) up to now. */
async function readSeries(api: NonNullable<IotAdapter['telemetry']>, deviceId: string, want: string, signal: AbortSignal): Promise<Record<string, TelemetryPoint[]>> {
  const [win, keys] = want.split('|') as [WindowKey, string];
  const to = Date.now();
  return api.series(deviceId, { keys: keys.split(','), from: to - WINDOW_MS[win], to }, signal);
}

export function DeviceTelemetryView({ deviceId, maxCharted = 4, locale, now, messages, className }: DeviceTelemetryViewProps) {
  const adapter = useIotAdapter();
  const { m, locale: lc } = useIotText(messages, locale);
  const t = m.telemetry;
  const api = adapter.telemetry;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return;
    api.latest(deviceId, signal).then(
      (latest) => {
        if (signal?.aborted) return;
        setRows(latest.map((l) => ({ ...l, kind: kindOf(l.value) })));
        setError(null);
      },
      () => { if (!signal?.aborted) setError(t.loadError); },
    );
  }, [api, deviceId, t.loadError]);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // a live point changes its key in place (a new key joins the table)
  const patch = useCallback((p: { key?: unknown; ts?: unknown; value?: unknown }) => {
    if (typeof p.key !== 'string' || typeof p.ts !== 'number' || p.value === undefined || p.value === null) return;
    const value = p.value as TelemetryValue;
    setRows((prev) => {
      const list = prev ?? [];
      const at = list.findIndex((r) => r.key === p.key);
      const next: Row = { key: p.key as string, ts: p.ts as number, value, kind: kindOf(value) };
      if (at < 0) return [...list, next];
      if (list[at]!.ts > next.ts) return list;
      const copy = [...list];
      copy[at] = next;
      return copy;
    });
  }, []);
  const liveState = useLiveOrPoll({
    enabled: !!api,
    key: deviceId,
    poll: () => load(),
    subscribe: (live) => live.subscribe<{ key?: unknown; ts?: unknown; value?: unknown }, { values?: Record<string, { ts: number; value: unknown }> }>({
      ...iotTopics.telemetry(deviceId),
      onLive: patch,
      onSnapshot: (s) => { for (const [key, v] of Object.entries(s?.values ?? {})) patch({ key, ts: v.ts, value: v.value }); },
    }),
  });

  // the keys charted: the first numeric key until the viewer ticks others
  const numeric = useMemo(() => (rows ?? []).filter((r) => r.kind === 'number').map((r) => r.key).sort(), [rows]);
  const [ticked, setTicked] = useState<string[] | null>(null);
  const charted = (ticked ?? numeric.slice(0, 1)).filter((k) => numeric.includes(k)).slice(0, maxCharted);
  const [win, setWin] = useState<WindowKey>('6h');
  // a read's answer is kept with what it was asked for, so a chart never draws another window's or other keys' lines
  const want = `${win}|${charted.join(',')}`;
  const [answer, setAnswer] = useState<{ for: string; series: Record<string, TelemetryPoint[]> | null; error: string | null } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    // the trend follows the clock: read again every minute
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!api || !want.split('|')[1]) return;
    const ctrl = new AbortController();
    readSeries(api, deviceId, want, ctrl.signal)
      .then((series) => setAnswer({ for: want, series, error: null }))
      .catch(() => { if (!ctrl.signal.aborted) setAnswer({ for: want, series: null, error: t.chartError }); });
    return () => ctrl.abort();
  }, [api, deviceId, want, tick, t.chartError]);
  const current = answer?.for === want ? answer : null;
  const series = current?.series ?? null;
  const seriesError = current?.error ?? null;

  const kindLabel: Record<Kind, string> = { number: t.typeNumber, flag: t.typeFlag, text: t.typeText, json: t.typeJson };
  const columns: Column<Row>[] = [
    { key: 'key', header: t.key, sortable: true, render: (r) => <span className="font-mono text-xs">{r.key}</span> },
    {
      key: 'value', header: t.value, sortable: true, align: 'right',
      render: (r) => <span className={cn('tabular-nums', r.kind === 'json' && 'font-mono text-xs')}>{showValue(r.value, t, lc)}</span>,
    },
    { key: 'kind', header: t.type, sortable: true, hideBelow: 'md', render: (r) => <span className="text-xs text-text-secondary">{kindLabel[r.kind]}</span> },
    {
      key: 'ts', header: t.updated, sortable: true, align: 'right',
      render: (r) => <time dateTime={new Date(r.ts).toISOString()} title={formatDateTime(r.ts, { locale: lc })} className="text-xs text-text-secondary">{formatRelative(r.ts, { locale: lc, now })}</time>,
    },
  ];

  if (!api) return null;
  const chart = (() => {
    if (charted.length === 0) return <p className="text-sm text-text-secondary">{fill(t.chartPick, { max: maxCharted })}</p>;
    if (seriesError) return <p role="alert" className="text-sm text-error">{seriesError}</p>;
    if (!series) return <div className="h-48 animate-pulse rounded-lg bg-surface-sunken" aria-busy="true" />;
    const { times, data } = alignSeries(series, charted);
    if (times.length === 0) return <p className="text-sm text-text-secondary">{t.chartEmpty}</p>;
    const fmt = new Intl.DateTimeFormat(lc, win === '7d' ? { month: 'short', day: 'numeric', hour: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
    const lines: TelemetrySeries[] = charted.map((k, i) => ({ label: k, color: PALETTE[i % PALETTE.length]!, data: data[k]! }));
    return <TelemetryTimeSeriesChart title={t.chartTitle} subtitle={charted.join(' · ')} labels={times.map((x) => fmt.format(x))} series={lines} />;
  })();

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <span className="text-xs text-text-secondary" aria-live="polite">{liveState === 'live' ? m.common.live : m.common.polling}</span>
        <div className="w-44">
          <Select
            id={`telemetry-window-${deviceId}`}
            label={t.window}
            value={win}
            onChange={(e) => setWin(e.target.value as WindowKey)}
            options={[
              { value: '1h', label: t.last1h }, { value: '6h', label: t.last6h }, { value: '24h', label: t.last24h }, { value: '7d', label: t.last7d },
            ]}
          />
        </div>
      </div>
      {rows !== null && rows.length === 0 && !error ? (
        <EmptyState icon={<FontAwesomeIcon icon={faChartLine} aria-hidden="true" />} title={t.empty} description={t.emptyHint} />
      ) : (
        <>
          {error && <AlertBanner variant="error" message={error} />}
          {chart}
          <DataTable<Row>
            mode="static"
            variant="plain"
            caption={t.caption}
            columns={columns}
            rows={rows ?? []}
            rowId={(r) => r.key}
            loading={rows === null && error === null}
            searchPlaceholder={t.search}
            defaultSort={[{ key: 'key', dir: 'asc' }]}
            filterFields={[{
              id: 'kind', label: t.type, type: 'select',
              options: (['number', 'flag', 'text', 'json'] as const).map((k) => ({ value: k, label: kindLabel[k] })),
            }]}
            selectable
            isRowSelectable={(r) => (r.kind === 'number' ? true : t.chartOnlyNumbers)}
            rowSelectLabel={(r) => fill(t.chartKey, { key: r.key })}
            selectedRowIds={charted}
            onSelectionChange={(ids) => setTicked(ids.map(String).slice(0, maxCharted))}
            emptyMessage={t.empty}
            messages={{ loading: m.common.loading, retry: m.common.retry }}
            density="compact"
            pageSizeOptions={[]}
            keyboardNavigation
          />
          {(ticked?.length ?? 0) > maxCharted && <p className="text-xs text-text-secondary">{fill(t.chartTooMany, { max: maxCharted })}</p>}
        </>
      )}
    </div>
  );
}
