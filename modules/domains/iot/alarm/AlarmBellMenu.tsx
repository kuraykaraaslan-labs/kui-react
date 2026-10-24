'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Popover } from '@/modules/ui/Popover';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { errorMessage } from '../api/adapter';
import { iotTopics } from '../api/live';
import { fill, formatRelative } from '../format';
import type { Alarm, AlarmCounts } from '../types/alarm';
import { ALARM_SEVERITY_META, worstSeverity } from './alarm-severity';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';

/**
 * AlarmBellMenu — the IoT shell's bell (phase 03 §3.3): the count of alarms that are not resolved (its dot takes the colour of
 * the worst open severity), and a short list of the latest open alarms with an inline "Acknowledge" (with `canAcknowledge`)
 * and "View all". Counts and list follow the tenant's alarm topic live (at most one re-read a second) and re-read every 30 s
 * without a live source. Renders nothing for a viewer who may not read alarms.
 */
export type AlarmBellMenuProps = {
  hrefs: { alarms: string; alarm: (alarmId: string) => string };
  limit?: number;
  now?: number;
  className?: string;
};

export function AlarmBellMenu({ hrefs, limit = 5, now, className }: AlarmBellMenuProps) {
  const api = useIotAdapter().alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const [counts, setCounts] = useState<AlarmCounts | null>(null);
  const [latest, setLatest] = useState<Alarm[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (!api) return Promise.resolve();
    return Promise.all([api.counts(), api.list({ page: 1, pageSize: limit, status: 'active' })]).then(
      ([c, page]) => { setCounts(c); setLatest(page.items); },
      () => undefined, // keep the last answer
    );
  }, [api, limit]);

  const soon = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = null; void refresh(); }, 1_000);
  }, [refresh]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const allowed = caps.canReadAlarms;
  useEffect(() => { if (allowed) refresh().catch(() => undefined); }, [allowed, refresh]);
  useLiveOrPoll({
    enabled: allowed && !!api,
    key: 'tenant',
    subscribe: api ? (live) => live.subscribe({ ...iotTopics.alarms('tenant'), onLive: soon }) : undefined,
    poll: () => { void refresh(); },
  });

  async function acknowledge(a: Alarm) {
    if (!api) return;
    setBusy(a.alarmId);
    try {
      const [r] = await api.acknowledge([a.alarmId]);
      notify({ tone: r?.ok ? 'success' : 'info', message: r?.ok ? m.alarm.acknowledged : fill(m.alarm.unchanged, { status: m.status[a.status] }) });
      await refresh();
    } catch (e) {
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
    } finally {
      setBusy(null);
    }
  }

  if (!api || !allowed) return null;
  const total = counts ? counts.open + counts.acknowledged : 0;
  const worst = counts ? worstSeverity((Object.keys(counts.bySeverity) as Array<keyof AlarmCounts['bySeverity']>).filter((k) => counts.bySeverity[k] > 0)) : null;
  const label = fill(m.bell.count, { n: total });

  return (
    <Popover
      className={cn('left-auto right-0 w-80 max-w-[calc(100vw-2rem)] p-0', className)}
      placement="bottom"
      trigger={(
        <Button variant="ghost" size="sm" iconOnly aria-label={`${m.bell.label}: ${label}`} data-testid="iot-alarm-bell">
          <span className="relative inline-flex">
            <FontAwesomeIcon icon={faBell} className="h-4 w-4" aria-hidden="true" />
            {total > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 text-text-inverse ring-2 ring-surface-raised',
                  worst ? ALARM_SEVERITY_META[worst].accentClass : 'bg-error',
                )}
              >
                {total > 99 ? '99+' : total}
              </span>
            )}
          </span>
        </Button>
      )}
    >
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-sm font-semibold text-text-primary">{m.bell.label}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
      {latest.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-secondary">{m.bell.none}</p>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {latest.map((a) => (
            <li key={a.alarmId} className="flex items-start gap-2 px-4 py-2.5">
              <AlarmSeverityBadge severity={a.severity} size="sm" iconOnly className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <a href={hrefs.alarm(a.alarmId)} className="block truncate rounded text-sm font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  {a.title}
                </a>
                <p className="truncate text-xs text-text-secondary">
                  {[a.deviceName, formatRelative(a.openedAt, { locale, now })].filter(Boolean).join(' · ')}
                </p>
              </div>
              {caps.canAcknowledge && a.status === 'OPEN' && (
                <Button variant="outline" size="xs" loading={busy === a.alarmId} disabled={busy !== null} onClick={() => void acknowledge(a)}>
                  {m.alarm.acknowledge}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border px-4 py-2">
        <a href={hrefs.alarms} className="block rounded text-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          {m.bell.viewAll}
        </a>
      </div>
    </Popover>
  );
}
