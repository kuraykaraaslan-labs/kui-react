'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Popover } from '@/modules/ui/Popover';
import { useIotAdapter, useIotCapabilities, useIotLive, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { errorMessage } from '../api/adapter';
import { iotTopics } from '../api/live';
import { fill, formatRelative } from '../format';
import type { IotMessages } from '../messages';
import type { Alarm, AlarmCounts } from '../types/alarm';
import { ALARM_SEVERITY_META, worstSeverity } from './alarm-severity';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { acknowledgeAllOpen } from './acknowledgeAll';
import { ALARM_BELL_POLL_MS, AlarmBellSync, EMPTY_ALARM_BELL, type AlarmBellState } from './alarm-bell-state';

/**
 * AlarmBellMenu — the IoT shell's bell (phase 03 §3.3). Its badge counts the alarms still OPEN (nobody acknowledged them
 * yet), its dot takes the colour of the worst severity not resolved, and its panel lists the latest open alarms with an
 * inline "Acknowledge", "Acknowledge all" (behind a confirmation; both with `canAcknowledge`) and "View all". Counts and list
 * follow the tenant's alarm topic live: each event updates them without asking the host (`alarm-bell-state.ts`); the host is
 * asked when the bell starts, after a reconnect, when the list runs short and every 5 minutes, every 60 s without a live
 * source. Renders nothing for a viewer who may not read alarms.
 *
 * A host that already has a bell (a notification menu) puts the alarms into its one list instead: `useAlarmBellSource` (or the
 * headless {@link AlarmBellSource}) hands them over as a source of kui-react's `NotificationMenu`, with their own look, the
 * inline Acknowledge, "Acknowledge all" and the alarms page. {@link AlarmBellSection} (a section above that list) stays for
 * hosts that still show one.
 */
export type AlarmBellMenuProps = {
  hrefs: { alarms: string; alarm: (alarmId: string) => string };
  limit?: number;
  now?: number;
  /** Opens a page inside the host app (a plain click on a link); without it the links navigate as links. */
  onNavigate?: (href: string) => void;
  className?: string;
};

export type AlarmBell = ReturnType<typeof useAlarmBell>;

/** The bell's state: counts, the latest alarms not resolved and the acknowledge actions. */
export function useAlarmBell(limit = 5) {
  const api = useIotAdapter().alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const live = useIotLive();
  const { m } = useIotText();
  const allowed = caps.canReadAlarms === true && !!api;
  const [state, setState] = useState<AlarmBellState>(EMPTY_ALARM_BELL);
  /** The alarm being acknowledged, `'*'` for "Acknowledge all". */
  const [busy, setBusy] = useState<string | null>(null);
  /** The live source refused the alarm topic: poll instead. */
  const [refused, setRefused] = useState(false);
  const sync = useMemo(() => (api ? new AlarmBellSync({ api, limit, onChange: setState }) : null), [api, limit]);
  const syncRef = useRef(sync);
  const liveRef = useRef(live);
  useEffect(() => { syncRef.current = sync; liveRef.current = live; });

  // the first answer waits for the subscription's snapshot, so that answer and the events leave no gap between them
  useLiveOrPoll({
    enabled: allowed,
    key: 'tenant',
    intervalMs: ALARM_BELL_POLL_MS,
    subscribe: api && !refused ? (source) => source.subscribe({
      ...iotTopics.alarms('tenant'),
      onLive: (p) => syncRef.current?.live(p),
      onSnapshot: () => syncRef.current?.snapshot(),
      onError: () => setRefused(true),
    }) : undefined,
    poll: () => syncRef.current?.poll(),
  });

  useEffect(() => {
    if (!allowed || !sync) return;
    const source = liveRef.current;
    // a subscription answers with a snapshot once the server holds it (live already, connecting or reconnecting alike): the first
    // answer goes with it, or after 3 s without one
    sync.start({ awaitSnapshot: !!source && source.state !== 'closed' });
    return () => sync.stop();
  }, [allowed, sync]);

  const acknowledge = useCallback(async (a: Alarm) => {
    if (!api || !sync) return;
    setBusy(a.alarmId);
    try {
      const [r] = await api.acknowledge([a.alarmId]);
      notify({ tone: r?.ok ? 'success' : 'info', message: r?.ok ? m.alarm.acknowledged : fill(m.alarm.unchanged, { status: m.status[a.status] }) });
      // what the live event will say: the bell needs no answer for it, and the event itself then changes nothing more
      if (r?.ok) sync.apply({ alarm: { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }, transition: 'acknowledged' });
      else await sync.refresh();
    } catch (e) {
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
    } finally {
      setBusy(null);
    }
  }, [api, sync, notify, m]);

  const acknowledgeAll = useCallback(async (note?: string) => {
    if (!api || !sync) return;
    setBusy('*');
    try {
      const n = await acknowledgeAllOpen(api, undefined, note);
      notify({ tone: 'success', message: fill(m.alarms.acknowledgeAllDone, { n }) });
    } catch (e) {
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
    } finally {
      setBusy(null);
      await sync.refresh();
    }
  }, [api, sync, notify, m]);

  const counts = state.counts;
  const open = counts?.open ?? 0;
  const worst = counts ? worstSeverity((Object.keys(counts.bySeverity) as Array<keyof AlarmCounts['bySeverity']>).filter((k) => counts.bySeverity[k] > 0)) : null;
  return { allowed, canAcknowledge: caps.canAcknowledge === true, counts, latest: state.items, open, worst, busy, acknowledge, acknowledgeAll };
}

/** "Acknowledge all (n)" behind the alarm list's own confirmation: the optional note goes with every acknowledge. */
function confirmAcknowledgeAll(bell: Pick<AlarmBell, 'open' | 'acknowledgeAll'>, m: IotMessages) {
  const label = fill(m.alarms.acknowledgeAll, { n: bell.open });
  void confirmDialog({
    title: label,
    message: m.alarm.noteTitle,
    input: { kind: 'textarea', label: m.alarm.noteLabel, maxLength: 2000 },
    confirmLabel: label,
    cancelLabel: m.common.cancel,
    closeLabel: m.common.close,
    action: ({ value }) => bell.acknowledgeAll(value || undefined),
  });
}

/** A link's plain click opened by the host inside the app; a modified click (a new tab) stays the browser's. */
function inApp(onNavigate: ((href: string) => void) | undefined, href: string) {
  if (!onNavigate) return undefined;
  return (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(href);
  };
}

/** The bell's panel: the counts with "Acknowledge all", the latest open alarms, "View all". */
export function AlarmBellPanel({ bell, hrefs, now, onNavigate, className }: { bell: AlarmBell; hrefs: AlarmBellMenuProps['hrefs']; now?: number; onNavigate?: (href: string) => void; className?: string }) {
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
          <Button variant="outline" size="xs" loading={busy === '*'} disabled={busy !== null} onClick={() => confirmAcknowledgeAll(bell, m)}>
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
                <a href={hrefs.alarm(a.alarmId)} onClick={inApp(onNavigate, hrefs.alarm(a.alarmId))} className="block truncate rounded text-sm font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                  {a.title}
                </a>
                <p className="truncate text-xs text-text-secondary">
                  {[a.deviceName, a.siteName, formatRelative(a.openedAt, { locale, now })].filter(Boolean).join(' · ')}
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
        <a href={hrefs.alarms} onClick={inApp(onNavigate, hrefs.alarms)} className="block rounded text-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          {m.bell.viewAll}
        </a>
      </div>
    </div>
  );
}

/** One alarm as an item of a host's notification list (the shape of kui-react's `NotificationItem`). */
export type AlarmBellItem = {
  id: string;
  title: string;
  meta?: string;
  at: Date;
  read: boolean;
  icon: React.ReactNode;
  href: string;
  onClick?: () => void;
  action?: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean };
};

/** The alarms as a source of a host's notification menu (the shape of kui-react's `NotificationSource`). */
export type AlarmNotificationSource = {
  key: string;
  label: string;
  items: AlarmBellItem[];
  unread: number;
  action?: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean };
  viewAll: { label: string; href: string; onClick?: () => void };
  emptyLabel: string;
  /** "3 open · 2 acknowledged" (loading until the first answer). */
  summary: string;
};

export type AlarmBellSourceOptions = Omit<AlarmBellMenuProps, 'className' | 'now'>;

/**
 * The alarms as items of a host's one notification list (D40-16), or null while the viewer may not read alarms. An item has its
 * severity's icon and colour, its title, the device and site, its opening time (the menu writes it relative), an inline
 * "Acknowledge" while it is OPEN and a click that opens the alarm; an OPEN alarm is unread, and every OPEN alarm, listed or not,
 * counts in `unread`, and the summary under its filter says how many are open and acknowledged. The source's action is
 * "Acknowledge all (n)" behind the confirmation, its page the alarm list.
 */
export function useAlarmBellSource({ hrefs, limit = 5, onNavigate }: AlarmBellSourceOptions): AlarmNotificationSource | null {
  const { allowed, canAcknowledge, counts, latest, open, busy, acknowledge, acknowledgeAll } = useAlarmBell(limit);
  const { m } = useIotText();
  // keep `hrefs.alarm` and `onNavigate` stable (memoized) in the host: a new one makes a new source
  const { alarms: alarmsHref, alarm: alarmHref } = hrefs;
  return useMemo(() => {
    if (!allowed) return null;
    const go = (href: string) => (onNavigate ? () => onNavigate(href) : undefined);
    return {
      key: 'alarms',
      label: m.bell.label,
      emptyLabel: m.bell.none,
      summary: counts ? `${fill(m.alarms.openCount, { n: counts.open })} · ${fill(m.alarms.acknowledgedCount, { n: counts.acknowledged })}` : m.common.loading,
      unread: open,
      items: latest.map((a) => ({
        id: a.alarmId,
        title: a.title,
        meta: [a.deviceName, a.siteName].filter(Boolean).join(' · ') || undefined,
        at: a.openedAt,
        read: a.status !== 'OPEN',
        icon: <AlarmSeverityBadge severity={a.severity} labels={{ [a.severity]: m.severity[a.severity] }} size="sm" iconOnly />,
        href: alarmHref(a.alarmId),
        onClick: go(alarmHref(a.alarmId)),
        action: canAcknowledge && a.status === 'OPEN'
          ? { label: m.alarm.acknowledge, onClick: () => void acknowledge(a), loading: busy === a.alarmId, disabled: busy !== null }
          : undefined,
      })),
      action: canAcknowledge && open > 0
        ? { label: fill(m.alarms.acknowledgeAll, { n: open }), onClick: () => confirmAcknowledgeAll({ open, acknowledgeAll }, m), loading: busy === '*', disabled: busy !== null }
        : undefined,
      viewAll: { label: m.bell.viewAll, href: alarmsHref, onClick: go(alarmsHref) },
    };
  }, [allowed, canAcknowledge, counts, latest, open, busy, acknowledge, acknowledgeAll, alarmsHref, alarmHref, onNavigate, m]);
}

/**
 * {@link useAlarmBellSource} for a host that collects its bell's sources from contributions it does not render itself (NB's
 * `notification_inapp.bell` slot): it draws nothing and hands the source up through `onSource` whenever it changes (null while the
 * viewer may not read alarms, and when it unmounts).
 */
export function AlarmBellSource({ onSource, ...opts }: AlarmBellSourceOptions & { onSource: (source: AlarmNotificationSource | null) => void }) {
  const source = useAlarmBellSource(opts);
  useEffect(() => { onSource(source); }, [onSource, source]);
  useEffect(() => () => onSource(null), [onSource]);
  return null;
}

/**
 * The alarms as a section of another bell (a host's notification menu), above its list. `onCount` gets the number of OPEN
 * alarms whenever it changes, for that bell's badge (0 while the viewer may not read alarms). A host with kui-react's
 * `NotificationMenu` puts the alarms into its one list instead (`useAlarmBellSource`).
 */
export function AlarmBellSection({
  hrefs, limit = 5, now, onNavigate, onCount, className,
}: AlarmBellMenuProps & { onCount?: (open: number) => void }) {
  const bell = useAlarmBell(limit);
  const reported = bell.allowed ? bell.open : 0;
  useEffect(() => { onCount?.(reported); }, [onCount, reported]);
  useEffect(() => () => onCount?.(0), [onCount]);
  if (!bell.allowed) return null;
  return <AlarmBellPanel bell={bell} hrefs={hrefs} now={now} onNavigate={onNavigate} className={cn('border-b border-border', className)} />;
}

export function AlarmBellMenu({ hrefs, limit = 5, now, onNavigate, className }: AlarmBellMenuProps) {
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
      <AlarmBellPanel bell={bell} hrefs={hrefs} now={now} onNavigate={onNavigate} />
    </Popover>
  );
}
