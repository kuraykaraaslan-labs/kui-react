'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Drawer } from '@/modules/ui/Drawer';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fill } from '../format';
import { mergeRateLimitsMessages, type RateLimitsMessages, type RateLimitsMessagesInput } from './messages';
import type { DeviceLimitMode, DeviceLimitRow, DeviceRateLimitsView, RateLimitsAdapter, WorkspaceLimitKey } from './types';

/** One limit as people read it: `10 a second, 300 a minute`; `None` without a window. */
export function limitText(windows: DeviceLimitRow['windows'], m: RateLimitsMessages): string {
  if (!windows.length) return m.common.none;
  return windows.map(({ count, seconds }) => {
    if (seconds === 1) return fill(m.window.perSecond, { count });
    if (seconds === 60) return fill(m.window.perMinute, { count });
    if (seconds === 3600) return fill(m.window.perHour, { count });
    return fill(m.window.perSeconds, { count, seconds });
  }).join(m.window.join);
}

const MODE_VARIANT: Record<DeviceLimitMode, 'success' | 'info' | 'warning' | 'neutral'> = { enforced: 'success', observed: 'info', off: 'warning', unknown: 'neutral' };

export interface DeviceRateLimitsPanelProps {
  view: DeviceRateLimitsView;
  messages?: RateLimitsMessagesInput;
  className?: string;
}

/** The two tables of the drawer: the device's own limits and the workspace's plan limits. Pure. */
export function DeviceRateLimitsPanel({ view, messages, className }: DeviceRateLimitsPanelProps) {
  const m = useMemo(() => mergeRateLimitsMessages(messages), [messages]);
  const deviceColumns = useMemo<Column<DeviceLimitRow>[]>(() => [
    { key: 'family', header: m.device.family, render: (r) => m.family[r.family], searchValue: (r) => m.family[r.family], sortValue: (r) => m.family[r.family] },
    { key: 'limit', header: m.device.limit, render: (r) => limitText(r.windows, m), sortable: false },
    { key: 'source', header: m.device.source, render: (r) => m.source[r.source], sortValue: (r) => r.source },
    { key: 'mode', header: m.device.mode, render: (r) => <Badge variant={MODE_VARIANT[r.mode]}>{m.mode[r.mode]}</Badge>, sortValue: (r) => r.mode },
  ], [m]);
  type TenantRow = { key: WorkspaceLimitKey; value: number | null };
  const tenantColumns = useMemo<Column<TenantRow>[]>(() => [
    { key: 'key', header: m.tenant.key, render: (r) => m.tenant[r.key], sortable: false },
    { key: 'value', header: m.tenant.value, render: (r) => (r.value === null ? m.common.none : r.value === 0 ? m.tenant.zero : r.value.toLocaleString()), sortable: false },
  ], [m]);
  const observed = view.device.some((r) => r.mode === 'observed');
  return (
    <div className={cn('space-y-6', className)} data-rate-limits>
      <Callout variant={view.gateway.enforcement === 'off' ? 'warning' : 'info'} title={null} className="my-0">
        <p>{m.gateway[view.gateway.enforcement]}</p>
      </Callout>
      <section aria-labelledby="rl-device">
        <h3 id="rl-device" className="text-base font-semibold text-text-primary">{m.device.title}</h3>
        <p className="mb-3 text-sm text-text-secondary">{m.device.intro}</p>
        <DataTable<DeviceLimitRow>
          mode="static" variant="plain" density="compact" caption={m.device.title} columns={deviceColumns} rows={view.device}
          rowId={(r) => r.family} searchPlaceholder={m.device.search} emptyMessage={m.device.empty}
          messages={{ loading: m.common.loading, retry: m.common.retry }}
        />
        {observed && <p className="mt-2 text-xs text-text-secondary">{m.mode.observedHint}</p>}
      </section>
      <section aria-labelledby="rl-tenant">
        <h3 id="rl-tenant" className="text-base font-semibold text-text-primary">{m.tenant.title}</h3>
        <p className="mb-3 text-sm text-text-secondary">{m.tenant.intro}</p>
        <DataTable<TenantRow>
          mode="static" variant="plain" density="compact" caption={m.tenant.title} columns={tenantColumns} rows={view.tenant}
          rowId={(r) => r.key} emptyMessage={m.common.none} messages={{ loading: m.common.loading, retry: m.common.retry }}
        />
      </section>
    </div>
  );
}

export interface DeviceRateLimitsActionProps {
  adapter: RateLimitsAdapter;
  deviceId: string;
  /** Open the drawer at once (a deep link). */
  defaultOpen?: boolean;
  messages?: RateLimitsMessagesInput;
}

/**
 * DeviceRateLimitsAction — the device page's "Rate limits" header button and its drawer (NB iot-gateway 06 §6.4, W8G-6: a header button
 * with a drawer, never a tab). Read-only: what the gateway applies to this device and to the whole workspace. The limits are read when the
 * drawer opens, so they are never older than the drawer.
 */
export function DeviceRateLimitsAction({ adapter, deviceId, defaultOpen = false, messages }: DeviceRateLimitsActionProps) {
  const m = useMemo(() => mergeRateLimitsMessages(messages), [messages]);
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<DeviceRateLimitsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  // the state is reset by the action that asks again (opening, Try again), never inside the effect
  const reload = useCallback(() => { setView(null); setError(null); setRound((n) => n + 1); }, []);
  const show = useCallback(() => { setView(null); setError(null); setOpen(true); }, []);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    adapter.limits(deviceId, ac.signal).then(
      (v) => { if (!ac.signal.aborted) setView(v); },
      (e: unknown) => { if (!ac.signal.aborted) setError(fill(m.common.unknownError, { message: e instanceof Error ? e.message : String(e) })); },
    );
    return () => ac.abort();
  }, [adapter, deviceId, open, round, m]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={show} aria-haspopup="dialog" data-rate-limits-action={deviceId}>
        <FontAwesomeIcon icon={faGaugeHigh} className="mr-1.5" aria-hidden="true" />{m.action.open}
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title={m.action.title} closeLabel={m.common.close} className="w-full sm:max-w-2xl">
        {open && (view
          ? <DeviceRateLimitsPanel view={view} messages={m} />
          : error
            ? <Callout variant="danger" title={null}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={reload}>{m.common.retry}</Button></Callout>
            : <div className="flex justify-center p-6" role="status" aria-label={m.common.loading}><Spinner label={null} /></div>)}
      </Drawer>
    </>
  );
}
