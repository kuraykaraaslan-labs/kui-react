'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { useIotAdapter, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import type { IotAdapter, TelemetryLatest, TelemetryPoint, TelemetryValue } from '../api/adapter';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative } from '../format';
import type { IotMessagesInput } from '../messages';
import { LineChart } from '@/modules/ui/Chart/charts/LineChart';
import type { Series } from '@/modules/ui/Chart/types';

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
/** `name`: the host's label for the key, else the key (the sort and search column). */
type Row = TelemetryLatest & { kind: Kind; name: string };
type WindowKey = '1h' | '6h' | '24h' | '7d';

const WINDOW_MS: Record<WindowKey, number> = { '1h': 3_600_000, '6h': 6 * 3_600_000, '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000 };
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
        setRows(latest.map((l) => ({ ...l, kind: kindOf(l.value), name: l.label || l.key })));
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
      const was = at >= 0 ? list[at]! : undefined;
      // a live point carries no name: the row keeps the one the first read gave it
      const next: Row = { key: p.key as string, ts: p.ts as number, value, kind: kindOf(value), name: was?.name || (p.key as string), ...(was?.label ? { label: was.label } : {}), ...(was?.unit ? { unit: was.unit } : {}) };
      if (at < 0) return [...list, next];
      if (was!.ts > next.ts) return list;
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

  // the keys charted: the freshest numeric key until the viewer ticks others (next-boilerplate e2e round 3, m-R3-04: the first key by name was an
  // 11-hour-old leftover, and the chart under "Live" said "No values in this window")
  const numeric = useMemo(() => (rows ?? []).filter((r) => r.kind === 'number').sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0) || a.key.localeCompare(b.key)).map((r) => r.key), [rows]);
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
  // the name the host gives a key (its schema's label) first, the key itself only for a key the host has no name for
  const columns: Column<Row>[] = [
    {
      key: 'name', header: t.name, sortable: true, searchValue: (r) => `${r.label ?? ''} ${r.key}`,
      render: (r) => (r.label ? <span>{r.label}</span> : <span className="font-mono text-xs">{r.key}</span>),
    },
    {
      key: 'value', header: t.value, sortable: true, align: 'right',
      render: (r) => (
        <span className={cn('tabular-nums', r.kind === 'json' && 'font-mono text-xs')}>
          {showValue(r.value, t, lc)}{r.unit && r.kind === 'number' ? <span className="text-text-secondary">{` ${r.unit}`}</span> : null}
        </span>
      ),
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
    const lines: Series[] = charted.map((k) => ({ id: k, name: rows?.find((r) => r.key === k)?.name ?? k, data: (series[k] ?? []).map((p) => ({ x: p.ts, y: p.value })) }));
    if (lines.every((l) => l.data.length === 0)) return <p className="text-sm text-text-secondary">{t.chartEmpty}</p>;
    return (
      <section className="rounded-xl border border-border bg-surface-raised p-4" aria-label={t.chartTitle}>
        <h3 className="mb-2 text-sm font-semibold text-text-primary">{t.chartTitle}</h3>
        <LineChart series={lines} xAxis="time" locale={lc} height={240} curve="linear" showLegend ariaLabel={`${t.chartTitle}: ${charted.join(', ')}`} />
      </section>
    );
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
          {error && <Callout variant="danger" title={null} role="alert">{error}</Callout>}
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
            defaultSort={[{ key: 'name', dir: 'asc' }]}
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
