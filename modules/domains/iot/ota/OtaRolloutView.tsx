'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Callout } from '@/modules/ui/Callout';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill, formatRelative } from '../format';
import type { OtaMessages, OtaMessagesInput } from './messages';
import type { OtaAdapter } from './ota-adapter';
import { OtaStateBadge, otaStateLabel } from './OtaStateBadge';
import { otaErrorText, useOtaText } from './OtaText';
import { OTA_FINISHED_STATES, OTA_RETRYABLE_STATES, OTA_STATES, type OtaAttempt, type OtaState } from './types';

type Row = OtaAttempt & Record<string, unknown>;

/** Bar colours per state: done green, failed red, on the way blue, waiting / queued / left out grey. */
const STATE_COLOR: Record<OtaState, string> = {
  UPDATED: 'bg-success', FAILED: 'bg-error', TIMEOUT: 'bg-error', ROLLED_BACK: 'bg-error',
  INITIATED: 'bg-info', DOWNLOADING: 'bg-info', DOWNLOADED: 'bg-info', VERIFIED: 'bg-info', UPDATING: 'bg-primary',
  QUEUED: 'bg-border-strong', WAITING: 'bg-text-disabled', SKIPPED: 'bg-surface-overlay', CANCELLED: 'bg-surface-overlay',
};

/** The page size the attempts list asks for. */
export const OTA_ROLLOUT_LIMIT = 500;

export interface OtaStateBarProps {
  counts: Partial<Record<OtaState, number>>;
  messages?: OtaMessagesInput | OtaMessages;
  className?: string;
}

/** The devices of a package by state: one stacked bar and its legend (counts in words, so the bar is not the only carrier). */
export function OtaStateBar({ counts, messages, className }: OtaStateBarProps) {
  const { m } = useOtaText(messages as OtaMessagesInput);
  const parts = OTA_STATES.map((s) => ({ s, n: counts[s] ?? 0 })).filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div className={cn('space-y-2', className)} data-ota-state-bar>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${m.rollout.legend}: ${parts.map((p) => `${otaStateLabel(m, p.s)} ${p.n}`).join(', ')}`}>
        {total > 0 && parts.map((p) => <div key={p.s} className={STATE_COLOR[p.s]} style={{ width: `${(p.n / total) * 100}%` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <li className="font-medium text-text-primary">{fill(m.rollout.total, { n: total })}</li>
        {parts.map((p) => (
          <li key={p.s} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', STATE_COLOR[p.s])} aria-hidden />
            {otaStateLabel(m, p.s)} <span className="tabular-nums text-text-primary">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface OtaRolloutViewProps {
  adapter: OtaAdapter;
  packageId: string;
  /** Per-state counts when the host already has them (the package page); else they are counted from the rows. */
  counts?: Partial<Record<OtaState, number>>;
  canRetry?: boolean;
  deviceHref?: (deviceId: string) => string;
  /** Poll while devices are on their way and the adapter has no `watch` (ms; 0 = never). */
  pollMs?: number;
  /** Bumped by the host after a change (an assignment): read again. */
  reloadKey?: unknown;
  /** Called after each read with the counts (the host's header can show them). */
  onCounts?: (counts: Partial<Record<OtaState, number>>) => void;
  messages?: OtaMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * OtaRolloutView — the devices updating to one package: the state bar and one DataTable (device, from → to, state with the wait reason or
 * the progress, tries, last change, problem), sortable, filtered by state, with "Try again" on a failed, timed-out or rolled-back device.
 * Live through the adapter's `watch` when it has one; otherwise it reads again every `pollMs` while a device is on its way.
 */
export function OtaRolloutView({ adapter, packageId, counts, canRetry, deviceHref, pollMs = 5000, reloadKey, onCounts, messages, locale, className }: OtaRolloutViewProps) {
  const { m, locale: lang } = useOtaText(messages, locale);
  const [rows, setRows] = useState<OtaAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    adapter.attempts({ packageId, limit: OTA_ROLLOUT_LIMIT }, ac.signal).then((r) => { setRows(r); setError(null); }, (e) => { if (!ac.signal.aborted) setError(otaErrorText(m, e)); });
    return () => ac.abort();
  }, [adapter, packageId, tick, reloadKey, m]);

  const live = !!rows?.some((r) => !OTA_FINISHED_STATES.has(r.state));
  useEffect(() => {
    if (adapter.watch) return adapter.watch(packageId, () => setTick((t) => t + 1));
    if (!pollMs || !live) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [adapter, packageId, pollMs, live]);

  const counted = useMemo(() => {
    const c: Partial<Record<OtaState, number>> = {};
    for (const r of rows ?? []) c[r.state] = (c[r.state] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = rows && rows.length < OTA_ROLLOUT_LIMIT ? counted : counts ?? counted;
  useEffect(() => { if (rows) onCounts?.(counted); }, [rows, counted, onCounts]);

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

  const columns: Column<Row>[] = [
    {
      key: 'deviceName', header: m.rollout.device, sortable: true, searchValue: (r) => r.deviceName ?? r.deviceId,
      render: (r) => (deviceHref
        ? <a href={deviceHref(r.deviceId)} className="font-medium text-primary hover:underline">{r.deviceName ?? r.deviceId}</a>
        : <span className="font-medium text-text-primary">{r.deviceName ?? r.deviceId}</span>),
    },
    { key: 'fromVersion', header: m.rollout.from, hideBelow: 'md', render: (r) => <span className="font-mono text-xs">{r.fromVersion ?? m.common.none}</span> },
    { key: 'toVersion', header: m.rollout.to, hideBelow: 'lg', render: (r) => <span className="font-mono text-xs">{r.toVersion}</span> },
    { key: 'state', header: m.rollout.state, sortable: true, render: (r) => <OtaStateBadge state={r.state} waitReason={r.waitReason} progress={r.progress} messages={m} /> },
    { key: 'attempts', header: m.rollout.tries, sortable: true, align: 'right', hideBelow: 'md', render: (r) => <span className="tabular-nums">{r.attempts}</span> },
    { key: 'stateChangedAt', header: m.rollout.changed, sortable: true, hideBelow: 'sm', render: (r) => <span className="text-text-secondary">{formatRelative(r.stateChangedAt, { locale: lang })}</span> },
    {
      key: 'fwError', header: m.rollout.error, hideBelow: 'lg',
      render: (r) => (r.fwError ? <span className="text-xs text-text-secondary">{(m.block as Record<string, string>)[r.fwError] ?? r.fwError}</span> : m.common.none),
    },
  ];
  const present = OTA_STATES.filter((s) => (counted[s] ?? 0) > 0);
  const filters: DataTableFilterField<Row>[] = [
    {
      id: 'state', label: m.rollout.state, type: 'checkboxes', options: (present.length ? present : OTA_STATES).map((s) => ({ value: s, label: otaStateLabel(m, s) })),
      match: (r, v) => !Array.isArray(v) || !v.length || (v as string[]).includes(r.state),
    },
  ];

  return (
    <section className={cn('space-y-3', className)} aria-label={m.rollout.title} data-ota-rollout={packageId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text-primary">{m.rollout.title}</h2>
        {live && <span className="text-xs text-text-secondary" aria-live="polite">{m.rollout.live}</span>}
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
