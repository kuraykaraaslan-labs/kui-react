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
import { acknowledgeAllOpen } from './acknowledgeAll';

/**
 * AlarmBellMenu — the IoT shell's bell (phase 03 §3.3). Its badge counts the alarms still OPEN (nobody acknowledged them
 * yet), its dot takes the colour of the worst severity not resolved, and its panel lists the latest open alarms with an
 * inline "Acknowledge", "Acknowledge all" (both with `canAcknowledge`) and "View all". Counts and list follow the tenant's
 * alarm topic live (at most one re-read a second) and re-read every 30 s without a live source. Renders nothing for a
 * viewer who may not read alarms.
 *
 * A host that already has a bell (a notification menu) shows {@link AlarmBellSection} inside it instead, so the viewer
 * sees one bell; the section reports its count for that bell's badge through `onCount`.
 */
export type AlarmBellMenuProps = {
  hrefs: { alarms: string; alarm: (alarmId: string) => string };
  limit?: number;
  now?: number;
  className?: string;
};

export type AlarmBell = ReturnType<typeof useAlarmBell>;

/** The bell's state: counts, the latest open alarms and the acknowledge actions. */
export function useAlarmBell(limit = 5) {
  const api = useIotAdapter().alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [counts, setCounts] = useState<AlarmCounts | null>(null);
  const [latest, setLatest] = useState<Alarm[]>([]);
  /** The alarm being acknowledged, `'*'` for "Acknowledge all". */
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

  const allowed = caps.canReadAlarms === true && !!api;
  useEffect(() => { if (allowed) refresh().catch(() => undefined); }, [allowed, refresh]);
  useLiveOrPoll({
    enabled: allowed,
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

  async function acknowledgeAll() {
    if (!api) return;
    setBusy('*');
    try {
      const n = await acknowledgeAllOpen(api);
      notify({ tone: 'success', message: fill(m.alarms.acknowledgeAllDone, { n }) });
    } catch (e) {
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const open = counts?.open ?? 0;
  const worst = counts ? worstSeverity((Object.keys(counts.bySeverity) as Array<keyof AlarmCounts['bySeverity']>).filter((k) => counts.bySeverity[k] > 0)) : null;
  return { allowed, canAcknowledge: caps.canAcknowledge === true, counts, latest, open, worst, busy, acknowledge, acknowledgeAll };
}

/** The bell's panel: the counts with "Acknowledge all", the latest open alarms, "View all". */
export function AlarmBellPanel({ bell, hrefs, now, className }: { bell: AlarmBell; hrefs: AlarmBellMenuProps['hrefs']; now?: number; className?: string }) {
  const { m, locale } = useIotText();
  const { counts, latest, busy } = bell;
  return (
    <div className={className} data-testid="iot-alarm-bell-panel">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{m.bell.label}</p>
          <p className="text-xs text-text-secondary">
            {counts ? `${fill(m.alarms.openCount, { n: counts.open })} · ${fill(m.alarms.acknowledgedCount, { n: counts.acknowledged })}` : m.common.loading}
          </p>
        </div>
        {bell.canAcknowledge && bell.open > 0 && (
          <Button variant="outline" size="xs" loading={busy === '*'} disabled={busy !== null} onClick={() => void bell.acknowledgeAll()}>
            {fill(m.alarms.acknowledgeAll, { n: bell.open })}
          </Button>
        )}
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
              {bell.canAcknowledge && a.status === 'OPEN' && (
                <Button variant="outline" size="xs" loading={busy === a.alarmId} disabled={busy !== null} onClick={() => void bell.acknowledge(a)}>
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
    </div>
  );
}

/**
 * The alarms as a section of another bell (a host's notification menu), so the viewer has one bell. `onCount` gets the
 * number of OPEN alarms whenever it changes, for that bell's badge (0 while the viewer may not read alarms).
 */
export function AlarmBellSection({
  hrefs, limit = 5, now, onCount, className,
}: AlarmBellMenuProps & { onCount?: (open: number) => void }) {
  const bell = useAlarmBell(limit);
  const reported = bell.allowed ? bell.open : 0;
  useEffect(() => { onCount?.(reported); }, [onCount, reported]);
  useEffect(() => () => onCount?.(0), [onCount]);
  if (!bell.allowed) return null;
  return <AlarmBellPanel bell={bell} hrefs={hrefs} now={now} className={cn('border-b border-border', className)} />;
}

export function AlarmBellMenu({ hrefs, limit = 5, now, className }: AlarmBellMenuProps) {
  const { m } = useIotText();
  const bell = useAlarmBell(limit);
  if (!bell.allowed) return null;
  const label = `${m.bell.label}: ${fill(m.alarms.openCount, { n: bell.open })}`;

  return (
    <Popover
      className={cn('left-auto right-0 w-80 max-w-[calc(100vw-2rem)] p-0', className)}
      placement="bottom"
      trigger={(
        <Button variant="ghost" size="sm" iconOnly aria-label={label} data-testid="iot-alarm-bell">
          <span className="relative inline-flex">
            <FontAwesomeIcon icon={faBell} className="h-4 w-4" aria-hidden="true" />
            {bell.open > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 text-text-inverse ring-2 ring-surface-raised',
                  bell.worst ? ALARM_SEVERITY_META[bell.worst].accentClass : 'bg-error',
                )}
              >
                {bell.open > 99 ? '99+' : bell.open}
              </span>
            )}
          </span>
        </Button>
      )}
    >
      <AlarmBellPanel bell={bell} hrefs={hrefs} now={now} />
    </Popover>
  );
}
