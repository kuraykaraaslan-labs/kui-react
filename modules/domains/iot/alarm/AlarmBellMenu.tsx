'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Popover } from '@/modules/ui/Popover';
import { useIotAdapter, useIotCapabilities, useIotLive, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatRelative, plural } from '../format';
import type { IotMessages } from '../messages';
import { ALARM_SEVERITIES, type Alarm, type AlarmCounts, type AlarmSeverity } from '../types/alarm';
import { countClassOf, worstSeverity } from './alarm-severity';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { acknowledgeAllOpen } from './acknowledgeAll';
import { acknowledgeAllNotice, actionFailedText, unchangedText } from './alarm-results';
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
 *
 * The badge's colour and its label follow the most severe OPEN alarm (the one it counts), with text that reads in both themes, and stay
 * neutral while that severity is not known (never a CRITICAL it cannot vouch for); a first
 * read that failed says so with a retry instead of "No open alarms"; capabilities that could not be read say so with a retry; an
 * acknowledge that changed nothing says why from the host's answer (NB 41-ui-fixes/24 1.7, 1.11, 1.12, 1.15, N6).
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
  const { m, locale } = useIotText();
  const allowed = caps.canReadAlarms === true && !!api;
  /** The capabilities could not be read: the bell says so (with a retry) instead of vanishing. */
  const capsFailed = !!api && caps.ready && caps.failed;
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
      // what the live event will say: the bell needs no answer for it, and the event itself then changes nothing more
      if (r?.ok) {
        notify({ tone: 'success', message: m.alarm.acknowledged });
        sync.apply({ alarm: { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }, transition: 'acknowledged' });
      } else {
        // why, from the host's answer (the status the bell held may be the old one)
        notify({ tone: 'info', message: unchangedText(m, r?.reason) });
        await sync.refresh();
      }
    } catch (e) {
      notify({ tone: 'error', message: actionFailedText(m, e, 'acknowledge') });
    } finally {
      setBusy(null);
    }
  }, [api, sync, notify, m]);

  const acknowledgeAll = useCallback(async (note?: string) => {
    if (!api || !sync) return;
    setBusy('*');
    try {
      const r = await acknowledgeAllOpen(api, {}, note);
      notify(acknowledgeAllNotice(m, r, locale));
    } finally {
      setBusy(null);
      await sync.refresh();
    }
  }, [api, sync, notify, m, locale]);

  const retry = useCallback(() => {
    if (capsFailed) caps.retry();
    else void sync?.refresh();
  }, [capsFailed, caps, sync]);

  const counts = state.counts;
  const open = counts?.open ?? 0;
  const worst = worstOpen(counts, state.items);
  return {
    allowed, capsFailed, failed: state.failed && counts === null, retry,
    canAcknowledge: caps.canAcknowledge === true, counts, latest: state.items, open, worst, busy, acknowledge, acknowledgeAll,
  };
}

/**
 * The most severe OPEN alarm (the badge counts the OPEN ones, so its colour follows them, N6): from the host's `openBySeverity`, else
 * from the OPEN alarms the bell lists.
 */
export function worstOpen(counts: AlarmCounts | null, items: readonly Alarm[]): AlarmSeverity | null {
  if (!counts || counts.open === 0) return null;
  const by = counts.openBySeverity;
  if (by) return worstSeverity(ALARM_SEVERITIES.filter((s) => (by[s] ?? 0) > 0));
  return worstSeverity(items.filter((a) => a.status === 'OPEN').map((a) => a.severity));
}


/**
 * "Acknowledge all (n)" behind a confirmation that says what it does: every alarm open now, their reminders stop, one opening meanwhile
 * stays open (NB 41-ui-fixes/24 1.2); the optional note goes with every acknowledge.
 */
function confirmAcknowledgeAll(bell: Pick<AlarmBell, 'open' | 'acknowledgeAll'>, m: IotMessages, locale?: string) {
  const label = fill(m.alarms.acknowledgeAll, { n: bell.open });
  void confirmDialog({
    title: plural(bell.open, { one: m.alarms.acknowledgeAllTitle_one, other: m.alarms.acknowledgeAllTitle }, locale),
    message: m.alarms.acknowledgeAllHint_all,
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
  if (bell.capsFailed || bell.failed) {
    return (
      <div className={className} data-testid="iot-alarm-bell-panel">
        <div role="alert" className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-text-secondary">
          {bell.capsFailed ? m.common.capabilitiesError : m.alarms.loadError}
          <Button variant="outline" size="xs" onClick={bell.retry}>{m.common.retry}</Button>
        </div>
      </div>
    );
  }
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
          <Button variant="outline" size="xs" loading={busy === '*'} disabled={busy !== null} onClick={() => confirmAcknowledgeAll(bell, m, locale)}>
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
  /** "3 open · 2 acknowledged"; loading until the first answer; why nothing is listed when the alarms or capabilities could not be read. */
  summary: string;
  /** No answer yet: the summary and the empty line say loading, not "No open alarms". */
  loading: boolean;
  /** The alarms (or the viewer's capabilities) could not be read: the summary and the empty line say so and the action is Retry. */
  failed: boolean;
};

export type AlarmBellSourceOptions = Omit<AlarmBellMenuProps, 'className' | 'now'>;

/**
 * The alarms as items of a host's one notification list (D40-16), or null while the viewer may not read alarms. An item has its
 * severity's icon and colour, its title, the device and site, its opening time (the menu writes it relative), an inline
 * "Acknowledge" while it is OPEN and a click that opens the alarm; an OPEN alarm is unread, and every OPEN alarm, listed or not,
 * counts in `unread`, and the summary under its filter says how many are open and acknowledged. The source's action is
 * "Acknowledge all (n)" behind the confirmation, its page the alarm list. Until the first answer the summary and the empty line say
 * loading; a first read that failed, or capabilities that could not be read, say so there with Retry as the action (the source stays,
 * so the viewer learns why no alarm is listed), as the bell's own panel does (NB 41-ui-fixes/24 1.11, 1.12).
 */
export function useAlarmBellSource({ hrefs, limit = 5, onNavigate }: AlarmBellSourceOptions): AlarmNotificationSource | null {
  const { allowed, capsFailed, failed, retry, canAcknowledge, counts, latest, open, busy, acknowledge, acknowledgeAll } = useAlarmBell(limit);
  const { m, locale } = useIotText();
  // keep `hrefs.alarm` and `onNavigate` stable (memoized) in the host: a new one makes a new source
  const { alarms: alarmsHref, alarm: alarmHref } = hrefs;
  return useMemo(() => {
    if (!allowed && !capsFailed) return null;
    const go = (href: string) => (onNavigate ? () => onNavigate(href) : undefined);
    const viewAll = { label: m.bell.viewAll, href: alarmsHref, onClick: go(alarmsHref) };
    if (capsFailed || failed) {
      const why = capsFailed ? m.common.capabilitiesError : m.alarms.loadError;
      return {
        key: 'alarms', label: m.bell.label, emptyLabel: why, summary: why, unread: 0, items: [], loading: false, failed: true,
        action: { label: m.common.retry, onClick: retry }, viewAll,
      };
    }
    return {
      key: 'alarms',
      label: m.bell.label,
      emptyLabel: counts ? m.bell.none : m.common.loading,
      summary: counts ? `${fill(m.alarms.openCount, { n: counts.open })} · ${fill(m.alarms.acknowledgedCount, { n: counts.acknowledged })}` : m.common.loading,
      loading: counts === null,
      failed: false,
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
        ? { label: fill(m.alarms.acknowledgeAll, { n: open }), onClick: () => confirmAcknowledgeAll({ open, acknowledgeAll }, m, locale), loading: busy === '*', disabled: busy !== null }
        : undefined,
      viewAll,
    };
  }, [allowed, capsFailed, failed, retry, canAcknowledge, counts, latest, open, busy, acknowledge, acknowledgeAll, alarmsHref, alarmHref, onNavigate, m, locale]);
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
  if (!bell.allowed && !bell.capsFailed) return null;
  return <AlarmBellPanel bell={bell} hrefs={hrefs} now={now} onNavigate={onNavigate} className={cn('border-b border-border', className)} />;
}

export function AlarmBellMenu({ hrefs, limit = 5, now, onNavigate, className }: AlarmBellMenuProps) {
  const { m } = useIotText();
  const bell = useAlarmBell(limit);
  if (!bell.allowed && !bell.capsFailed) return null;
  // the label says what the colour says: the count and the most severe open alarm
  const label = [`${m.bell.label}: ${fill(m.alarms.openCount, { n: bell.open })}`, bell.worst ? fill(m.bell.worst, { severity: m.severity[bell.worst] }) : '']
    .filter(Boolean).join(', ');

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
                  'absolute -right-2 -top-2 min-w-4 rounded-full px-1 text-center text-[10px] font-bold leading-4 ring-2 ring-surface-raised',
                  countClassOf(bell.worst),
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
