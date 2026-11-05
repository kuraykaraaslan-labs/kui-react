'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Callout } from '@/modules/ui/Callout';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill, formatRelative } from '../format';
import type { OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { OtaRolloutPanel } from './OtaRolloutPanel';
import { OtaStateBadge, otaStateLabel } from './OtaStateBadge';
import { OtaStateBar } from './OtaStateBar';
import { otaErrorText, useOtaText } from './OtaText';
import { OTA_FINISHED_STATES, OTA_RETRYABLE_STATES, OTA_STATES, type OtaAttempt, type OtaLiveEvent, type OtaRollout, type OtaState } from './types';

export { OtaStateBar, type OtaStateBarProps } from './OtaStateBar';

type Row = OtaAttempt & Record<string, unknown>;

/** The page size the attempts list asks for. */
export const OTA_ROLLOUT_LIMIT = 500;

export interface OtaRolloutViewProps {
  adapter: OtaAdapter;
  packageId: string;
  /** Per-state counts when the host already has them (the package page); else they are counted from the rows. */
  counts?: Partial<Record<OtaState, number>>;
  canRetry?: boolean;
  /** May pause, resume and abort rollouts in waves (the host's `iot_ota.assign`). */
  canManageRollouts?: boolean;
  /** The package's title and version (the rollout panels' confirmations). */
  title?: string;
  version?: string;
  deviceHref?: (deviceId: string) => string;
  /** Poll while devices are on their way and no live source delivers (ms; 0 = never). */
  pollMs?: number;
  /** Bumped by the host after a change (an assignment): read again. */
  reloadKey?: unknown;
  /** Called after each read or live event with the counts (the host's header can show them). */
  onCounts?: (counts: Partial<Record<OtaState, number>>) => void;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/** The changed attempts of a live event put into the table: a device's row replaced, a new device on top, at most the page size. */
export function mergeOtaAttempts(rows: readonly OtaAttempt[], changed: readonly OtaAttempt[], packageId: string): OtaAttempt[] {
  const mine = changed.filter((c) => c.packageId === packageId);
  if (!mine.length) return [...rows];
  const byId = new Map(mine.map((c) => [c.deviceId, c]));
  const next = rows.map((r) => {
    const c = byId.get(r.deviceId);
    return c ? { ...r, ...c, deviceName: c.deviceName ?? r.deviceName } : r;
  });
  const known = new Set(rows.map((r) => r.deviceId));
  const added = mine.filter((c) => !known.has(c.deviceId));
  return [...added, ...next].slice(0, OTA_ROLLOUT_LIMIT);
}

/** The rollouts a package page shows: every running or paused one, and the newest that ended. */
export function shownRollouts(rollouts: readonly OtaRollout[]): OtaRollout[] {
  const active = rollouts.filter((r) => r.status === 'RUNNING' || r.status === 'PAUSED');
  const ended = rollouts.filter((r) => r.status === 'COMPLETED' || r.status === 'ABORTED')
    .sort((a, b) => (b.finishedAt ?? b.createdAt).localeCompare(a.finishedAt ?? a.createdAt));
  return ended[0] ? [...active, ended[0]] : active;
}

/**
 * OtaRolloutView — the devices updating to one package: its rollouts in waves (`OtaRolloutPanel`: waves, gates, Pause / Resume / Abort),
 * the state bar and one DataTable (device, wave, from → to, state with the wait reason or the progress, tries, last change, problem),
 * sortable, filtered by state and wave, with "Try again" on a failed, timed-out or rolled-back device. Live through the adapter's `watch`
 * (counts, rollouts and changed devices; read once more after a reconnect); while it is absent or not live, it reads again every `pollMs`
 * as long as a device is on its way or a rollout runs.
 */
export function OtaRolloutView({
  adapter, packageId, counts, canRetry, canManageRollouts, title, version, deviceHref, pollMs = 5000, reloadKey, onCounts, messages, locale, className,
}: OtaRolloutViewProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [rows, setRows] = useState<OtaAttempt[] | null>(null);
  const [rollouts, setRollouts] = useState<OtaRollout[]>([]);
  const [liveCounts, setLiveCounts] = useState<Partial<Record<OtaState, number>> | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const wasLive = useRef(false);

  useEffect(() => {
    const ac = new AbortController();
    adapter.attempts({ packageId, limit: OTA_ROLLOUT_LIMIT }, ac.signal).then((r) => { setRows(r); setLiveCounts(null); setError(null); }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    adapter.rollouts?.list({ packageId }, ac.signal).then(setRollouts, () => undefined);
    return () => ac.abort();
  }, [adapter, packageId, tick, reloadKey, m]);

  useEffect(() => {
    if (!adapter.watch) return;
    wasLive.current = false;
    const stop = adapter.watch(packageId, {
      onEvent: (ev: OtaLiveEvent) => {
        if (ev.packageId !== packageId) return;
        setLiveCounts(ev.states);
        if (Array.isArray(ev.rollouts)) setRollouts(ev.rollouts);
        if (ev.rows?.length) setRows((cur) => (cur ? mergeOtaAttempts(cur, ev.rows, packageId) : cur));
      },
      onLive: (v) => {
        setLive(v);
        // events are not replayed: after a reconnect, read once more what was missed
        if (v && wasLive.current) setTick((t) => t + 1);
        if (v) wasLive.current = true;
      },
    });
    return () => { stop(); setLive(false); };
  }, [adapter, packageId]);

  const onWay = !!rows?.some((r) => !OTA_FINISHED_STATES.has(r.state)) || rollouts.some((r) => r.status === 'RUNNING');
  useEffect(() => {
    if (!pollMs || !onWay || (adapter.watch && live)) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [adapter, pollMs, onWay, live]);

  const counted = useMemo(() => {
    const c: Partial<Record<OtaState, number>> = {};
    for (const r of rows ?? []) c[r.state] = (c[r.state] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = liveCounts ?? (rows && rows.length < OTA_ROLLOUT_LIMIT ? counted : counts ?? counted);
  useEffect(() => { if (rows) onCounts?.(shown); }, [rows, shown, onCounts]);

  const retry = useCallback(async (r: OtaAttempt) => {
    setError(null); setNotice(null);
    try {
      await adapter.retry(r.deviceId);
      setNotice(fill(m.rollout.retried, { device: r.deviceName ?? r.deviceId }));
      setTick((t) => t + 1);
    } catch (e) {
      setError(otaErrorText(m, e));
    }
  }, [adapter, m]);

  const openWave = useMemo(() => new Map(rollouts.map((r) => [r.rolloutId, r.status === 'RUNNING' ? r.currentWave : -1])), [rollouts]);
  const hasWaves = !!rows?.some((r) => typeof r.wave === 'number');
  const waveColumn: Column<Row> = {
    key: 'wave', header: m.rollout.wave, sortable: true, hideBelow: 'sm', sortValue: (r) => (typeof r.wave === 'number' ? r.wave : 99),
    render: (r) => (typeof r.wave === 'number' ? fill(m.rollout.waveN, { n: r.wave + 1 }) : m.common.none),
  };
  const columns: Column<Row>[] = [
    {
      key: 'deviceName', header: m.rollout.device, sortable: true, searchValue: (r) => r.deviceName ?? r.deviceId,
      render: (r) => (deviceHref
        ? <a href={deviceHref(r.deviceId)} className="font-medium text-primary hover:underline">{r.deviceName ?? r.deviceId}</a>
        : <span className="font-medium text-text-primary">{r.deviceName ?? r.deviceId}</span>),
    },
    ...(hasWaves ? [waveColumn] : []),
    { key: 'fromVersion', header: m.rollout.from, hideBelow: 'md', render: (r) => <span className="font-mono text-xs">{r.fromVersion ?? m.common.none}</span> },
    { key: 'toVersion', header: m.rollout.to, hideBelow: 'lg', render: (r) => <span className="font-mono text-xs">{r.toVersion}</span> },
    {
      key: 'state', header: m.rollout.state, sortable: true,
      render: (r) => {
        const heldFor = r.state === 'QUEUED' && r.rolloutId && typeof r.wave === 'number' && r.wave > (openWave.get(r.rolloutId) ?? -1) ? r.wave + 1 : null;
        return (
          <span className="inline-flex flex-col gap-0.5">
            <OtaStateBadge state={r.state} waitReason={r.waitReason} progress={r.progress} messages={m} />
            {heldFor !== null && <span className="text-xs text-text-secondary">{fill(m.rollout.heldForWave, { n: heldFor })}</span>}
          </span>
        );
      },
    },
    { key: 'attempts', header: m.rollout.tries, sortable: true, align: 'right', hideBelow: 'md', render: (r) => <span className="tabular-nums">{r.attempts}</span> },
    { key: 'stateChangedAt', header: m.rollout.changed, sortable: true, hideBelow: 'sm', render: (r) => <span className="text-text-secondary">{formatRelative(r.stateChangedAt, { locale: lang })}</span> },
    {
      key: 'fwError', header: m.rollout.error, hideBelow: 'lg',
      render: (r) => (r.fwError ? <span className="text-xs text-text-secondary">{(m.block as Record<string, string>)[r.fwError] ?? r.fwError}</span> : m.common.none),
    },
  ];
  const present = OTA_STATES.filter((s) => (counted[s] ?? 0) > 0);
  const waveNumbers = [...new Set((rows ?? []).map((r) => r.wave).filter((w): w is number => typeof w === 'number'))].sort((a, b) => a - b);
  const filters: DataTableFilterField<Row>[] = [
    {
      id: 'state', label: m.rollout.state, type: 'checkboxes', options: (present.length ? present : OTA_STATES).map((s) => ({ value: s, label: otaStateLabel(m, s) })),
      match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(r.state),
    },
  ];
  if (waveNumbers.length) {
    filters.push({
      id: 'wave', label: m.rollout.wave, type: 'checkboxes', options: waveNumbers.map((w) => ({ value: String(w), label: fill(m.rollout.waveN, { n: w + 1 }) })),
      match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(String(r.wave)),
    });
  }
  const panels = shownRollouts(rollouts);

  return (
    <section className={cn('space-y-3', className)} aria-label={m.rollout.title} data-ota-rollout={packageId} data-live={live ? 'live' : 'polling'}>
      {panels.map((r) => (
        <OtaRolloutPanel
          key={r.rolloutId}
          adapter={adapter}
          rollout={r}
          title={title ?? ''}
          version={version ?? ''}
          canAct={canManageRollouts}
          messages={m}
          locale={lang}
          onChanged={(next) => { setRollouts((cur) => cur.map((x) => (x.rolloutId === next.rolloutId ? next : x))); setTick((t) => t + 1); }}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-primary">{m.rollout.title}</h2>
        {onWay && <span className="text-xs text-text-secondary" aria-live="polite">{m.rollout.live}</span>}
      </div>
      <OtaStateBar counts={shown} messages={m} />
      {rows && rows.length >= OTA_ROLLOUT_LIMIT && <p className="text-xs text-text-secondary">{fill(m.rollout.capped, { n: OTA_ROLLOUT_LIMIT })}</p>}
      {notice && <Callout variant="info">{notice}</Callout>}
      {error && <Callout variant="danger" role="alert">{error}</Callout>}
      <DataTable<Row>
        columns={columns}
        rows={(rows ?? []) as Row[]}
        mode="static"
        loading={rows === null && !error}
        caption={m.rollout.caption}
        rowId={(r) => r.deviceId}
        filterFields={filters}
        defaultSort={[{ key: 'stateChangedAt', dir: 'desc' }]}
        emptyMessage={m.rollout.empty}
        rowActions={canRetry ? [{ id: 'retry', label: m.rollout.retry, hidden: (r) => !OTA_RETRYABLE_STATES.has(r.state), onClick: (r) => void retry(r) }] : undefined}
      />
    </section>
  );
}
