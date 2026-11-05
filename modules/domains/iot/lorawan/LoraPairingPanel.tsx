'use client';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fillText, mergeLoraMessages, type LoraMessagesInput } from './messages';
import type { LoraPairedDevice, LoraPairingView } from './types';

/**
 * LoraPairingPanel — a LoRaWAN profile's pairing mode (NB iot_lorawan 04 §4.5, D517-D521): off by default; Start opens a window of a few
 * minutes (the host asks first and audits it) in which an unregistered device that joins with the profile's shared AppKey is added to the
 * profile, then shows the time left, counting down every second, with Stop. The devices the window added are listed (a DataTable: search,
 * sort) with their state, and one that waits for approval has Approve (the host asks first). Without a shared AppKey on the profile the
 * section says so and offers nothing. When the countdown reaches zero the host is told (`onExpired`) so it can read the state again.
 */
export type LoraPairingPanelProps = {
  view: LoraPairingView | null;
  /** Starts (or extends) the window for `minutes` minutes. */
  onStart?: (minutes: number) => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onApprove?: (deviceId: string) => void;
  /** The countdown reached zero. */
  onExpired?: () => void;
  /** Whether new devices wait for approval (the profile's setting), for the line under the button. */
  autoActivate?: boolean;
  loading?: boolean;
  error?: string | null;
  locale?: string;
  /** For tests: the clock. */
  now?: () => number;
  messages?: LoraMessagesInput;
};

export const PAIRING_MINUTES = [5, 15, 30, 60, 120] as const;

/** `m:ss` (or `h:mm:ss`) left until `until`, 0 when passed. Pure. */
export function pairingLeft(until: string | null, nowMs: number): { ms: number; text: string } {
  const ms = until ? Math.max(0, new Date(until).getTime() - nowMs) : 0;
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return { ms, text: h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}` };
}

export function LoraPairingPanel({ view, onStart, onStop, onApprove, onExpired, autoActivate, loading, error, locale, now = Date.now, messages }: LoraPairingPanelProps) {
  const all = mergeLoraMessages(messages);
  const m = all.pairing;
  const [minutes, setMinutes] = useState<number>(15);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => now());
  const active = !!view?.active && pairingLeft(view.until, tick).ms > 0;
  useEffect(() => {
    if (!view?.active || !view.until) return;
    const id = setInterval(() => {
      const t = now();
      setTick(t);
      if (pairingLeft(view.until, t).ms <= 0) { clearInterval(id); onExpired?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [view?.active, view?.until, now, onExpired]);
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }), [locale]);
  const run = (f: () => Promise<void> | void) => {
    setBusy(true); setActionError(null);
    Promise.resolve().then(f).catch((err: unknown) => setActionError(err instanceof Error ? err.message : String(err))).finally(() => setBusy(false));
  };
  const columns: Column<LoraPairedDevice>[] = [
    { key: 'name', header: m.name, sortable: true, render: (r) => <span className="text-sm">{r.name ?? r.devEui}</span> },
    { key: 'devEui', header: m.devEui, sortable: true, render: (r) => <code className="font-mono text-xs">{r.devEui}</code> },
    { key: 'pairedAt', header: m.pairedAt, sortable: true, searchable: false, render: (r) => <span className="text-sm tabular-nums">{date.format(new Date(r.pairedAt))}</span> },
    {
      key: 'held', header: m.status, sortable: true, searchable: false, render: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.held ? <Badge variant="warning" size="sm">{m.waiting}</Badge> : <Badge variant="success" size="sm">{m.ready}</Badge>}
          {r.held && onApprove && <Button size="sm" variant="outline" onClick={() => onApprove(r.deviceId)}>{m.approve}</Button>}
        </span>
      ),
    },
  ];
  if (error) return <Callout variant="danger">{error}</Callout>;
  if (loading && !view) return <p className="text-sm text-text-secondary">{all.common.loading}</p>;
  if (!view) return null;
  return (
    <section className="space-y-3" aria-label={m.title}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        {m.title}
        {active ? <Badge variant="success" size="sm" dot>{fillText(m.on, { left: pairingLeft(view.until, tick).text })}</Badge> : <Badge variant="neutral" size="sm">{m.off}</Badge>}
      </h3>
      <p className="text-sm text-text-secondary">{m.intro}</p>
      {!view.hasSharedAppKey ? (
        <Callout variant="note">{m.noKey}</Callout>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          {!active && (
            <Select id="lora-pairing-minutes" label={m.minutes} options={PAIRING_MINUTES.map((n) => ({ value: String(n), label: fillText(m.minutesValue, { n }) }))}
              value={String(minutes)} disabled={!onStart} onChange={(e) => setMinutes(Number(e.target.value))} className="min-w-48" />
          )}
          {!active && onStart && <Button loading={busy} onClick={() => run(() => onStart(minutes))}>{m.start}</Button>}
          {active && onStop && <Button variant="outline" loading={busy} onClick={() => run(() => onStop())}>{m.stop}</Button>}
        </div>
      )}
      {view.hasSharedAppKey && <p className="text-xs text-text-secondary">{autoActivate ? m.autoActivate : m.held}</p>}
      {actionError && <Callout variant="danger">{actionError}</Callout>}
      <h4 className="text-sm font-medium text-text-primary">{m.found}</h4>
      <DataTable<LoraPairedDevice>
        mode="paginated" variant="plain" density="compact" caption={m.found} columns={columns} rows={view.found} rowId={(r) => r.deviceId}
        pageSize={10} searchPlaceholder={m.search} emptyMessage={m.foundEmpty} defaultQuery={{ sort: [{ key: 'pairedAt', dir: 'desc' }] }}
        messages={{ loading: all.common.loading, retry: all.common.retry }}
      />
    </section>
  );
}
