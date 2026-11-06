'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from '@/modules/ui/Drawer';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DescriptionList } from '@/modules/ui/DescriptionList';
import { cn } from '@/libs/utils/cn';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill, formatDateTime } from '../format';
import type { Alarm, AlarmEvent, AlarmStatus } from '../types/alarm';
import { AlarmDetailHeader } from './AlarmDetailHeader';
import { AlarmEventTimeline } from './AlarmEventTimeline';
import { compareMarks } from './alarm-bell-state';
import { actionFailedText, unchangedText } from './alarm-results';

/**
 * AlarmDetailView — one alarm (phase 03 §3.1), read through the adapter: the header with real actions (acknowledge and clear,
 * with an optional note; optimistic, rolled back with a toast when the server refuses or the alarm changed meanwhile), the
 * timeline with a note box, a runbook drawer (the rule's text, else generic steps) and a "Related" panel (device, what raised
 * it, the topic). It follows the alarm live (its device's or the tenant's alarm topic) and re-reads every 30 s without a live
 * source. Actions and the note box show only with their capabilities.
 *
 * A live event moves the alarm forward only (an older one is ignored) and keeps what it does not carry: the runbook, the origin with the
 * rule's name, the message. A snapshot after a reconnect reads the alarm again; a re-read that fails keeps what is shown and says how old
 * it is, with a retry. An action's outcome is told from the host's answer (why nothing changed, or the status read again). A note the
 * host took empties the box even when the timeline cannot be read again (it says the note may not show yet). Capabilities that could
 * not be read say so with a retry. `onNavigate` opens the device, rule and flow links in the host's router (NB 41-ui-fixes/24 1.7,
 * 1.8, 1.12, 1.14, 1.18).
 */

/** The alarm after a live event: the event's fields over what is held, but never what an event does not carry (runbook, origin, message). */
export function mergeLiveAlarm(cur: Alarm, live: Alarm): Alarm {
  return {
    ...cur,
    ...live,
    runbook: live.runbook ?? cur.runbook,
    origin: cur.origin ?? live.origin,
    message: live.message ?? cur.message,
    deviceName: live.deviceName ?? cur.deviceName,
    siteName: live.siteName ?? cur.siteName,
  };
}

const markOf = (a: Alarm) => ({ status: a.status, severity: a.severity, occurrences: a.occurrences ?? 1 });
export type AlarmDetailViewProps = {
  alarmId: string;
  hrefs?: { device?: (deviceId: string) => string; rule?: (profileId: string, ruleId: string) => string; flow?: (flowId: string, nodeId: string) => string };
  /** Opens a link (device, rule, flow) in the host's router on a plain click; without it the links navigate as links. */
  onNavigate?: (href: string) => void;
  now?: number;
  className?: string;
};

export function AlarmDetailView({ alarmId, hrefs = {}, onNavigate, now, className }: AlarmDetailViewProps) {
  const api = useIotAdapter().alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** When the shown alarm was last read (the stale notice names it). */
  const [readAt, setReadAt] = useState<number | null>(null);
  const [runbookOpen, setRunbookOpen] = useState(false);
  const alarmRef = useRef<Alarm | null>(null);
  useEffect(() => { alarmRef.current = alarm; }, [alarm]);
  // only the newest read is shown (a late answer of an older one is dropped)
  const seqRef = useRef(0);

  /** Reads the alarm and its timeline; resolves with the alarm read, or null when the read failed (the shown one is kept). */
  const load = useCallback((signal?: AbortSignal): Promise<Alarm | null> => {
    if (!api) return Promise.resolve(null);
    const seq = ++seqRef.current;
    return Promise.all([api.get(alarmId, signal), api.events(alarmId, signal)]).then(
      ([a, ev]) => {
        if (signal?.aborted || seq !== seqRef.current) return null;
        setAlarm(a); setEvents(ev); setError(null); setReadAt(Date.now());
        return a;
      },
      (e) => {
        if (!signal?.aborted && seq === seqRef.current) setError(errorMessage(e, m.alarm.loadError));
        return null;
      },
    );
  }, [api, alarmId, m.alarm.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const deviceId = alarm?.deviceId ?? null;
  const snapshots = useRef(0);
  useEffect(() => { snapshots.current = 0; }, [deviceId]);
  useLiveOrPoll({
    enabled: !!alarm,
    key: deviceId ?? 'tenant',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.alarms(deviceId ? { deviceId } : 'tenant'),
      onLive: (payload) => {
        const ev = api.parseLive?.(payload);
        if (!ev || ev.alarm.alarmId !== alarmId) return;
        const cur = alarmRef.current;
        // an alarm only moves forward: a late event is older than what is shown
        if (cur && compareMarks(markOf(ev.alarm), markOf(cur)) < 0) return;
        const next = cur ? mergeLiveAlarm(cur, ev.alarm) : ev.alarm;
        alarmRef.current = next;
        setAlarm(next);
        void api.events(alarmId).then(setEvents).catch(() => undefined);
      },
      // the first snapshot repeats what was just read; a later one follows a reconnect: read again (events may have been missed)
      onSnapshot: () => { snapshots.current += 1; if (snapshots.current > 1) void load(); },
    }) : undefined,
    poll: () => { void load(); },
  });

  /** Acknowledge or clear; answers the words the header announces (the host's outcome). */
  async function act(action: 'acknowledge' | 'clear', note?: string): Promise<string> {
    if (!api || !alarmRef.current) return '';
    const before = alarmRef.current;
    const optimistic: AlarmStatus = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED';
    setAlarm({ ...before, status: optimistic, ...(action === 'acknowledge' ? { acknowledgedAt: new Date() } : { resolvedAt: new Date() }) });
    let result;
    try {
      [result] = action === 'acknowledge' ? await api.acknowledge([alarmId], note) : await api.clear([alarmId], note);
    } catch (e) {
      setAlarm(before);
      notify({ tone: 'error', message: actionFailedText(m, e, action) });
      throw e;
    }
    if (result?.ok) {
      const said = action === 'acknowledge' ? m.alarm.acknowledged : m.alarm.cleared;
      notify({ tone: 'success', message: said });
      await load();
      return said;
    }
    setAlarm(before);
    // why nothing changed: the host's reason, else the status read again now (not the one shown before the action)
    const reread = await load();
    const said = unchangedText(m, result?.reason, reread?.status);
    notify({ tone: 'info', message: said });
    return said;
  }

  /** Posts a note; once the host took it the box empties even when the timeline cannot be read again. */
  async function addNote(text: string) {
    if (!api) return;
    await api.comment(alarmId, text);
    try {
      setEvents(await api.events(alarmId));
      notify({ tone: 'success', message: m.event.noteAdded });
    } catch {
      notify({ tone: 'info', message: m.event.noteAddedStale });
    }
  }

  const link = (href: string) => (onNavigate ? (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(href);
  } : undefined);

  if (!api) return null;
  if (error && !alarm) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!alarm) return <SkeletonText lines={6} label={m.common.loading} className={className} />;

  const origin = alarm.origin;
  const raisedBy = !origin ? m.related.unknown
    : origin.kind === 'profileRule' ? fill(m.related.profileRule, { name: origin.ruleName ?? origin.ruleId })
      : origin.kind === 'flow' ? fill(m.related.flow, { flow: origin.flowName ?? origin.flowId, node: origin.nodeName ?? origin.nodeId })
        : m.related.operator;
  const raisedHref = origin?.kind === 'profileRule' ? hrefs.rule?.(origin.profileId, origin.ruleId)
    : origin?.kind === 'flow' ? hrefs.flow?.(origin.flowId, origin.nodeId) : undefined;

  const deviceHref = alarm.deviceId ? hrefs.device?.(alarm.deviceId) : undefined;
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]', className)}>
      <div className="min-w-0 space-y-4">
        {caps.ready && caps.failed && (
          <Callout variant="warning" title={null}>
            <span className="flex flex-wrap items-center gap-2">
              {m.common.capabilitiesError}
              <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
            </span>
          </Callout>
        )}
        {error && (
          <Callout variant="warning" title={null}>
            <span role="status" className="flex flex-wrap items-center gap-2">
              {fill(m.common.staleRead, { time: readAt !== null ? formatDateTime(readAt, { locale, timeZone }) : '—' })}
              <Button variant="outline" size="xs" onClick={() => void load()}>{m.common.retry}</Button>
            </span>
          </Callout>
        )}
        <AlarmDetailHeader
          title={alarm.title}
          message={alarm.message}
          severity={alarm.severity}
          status={alarm.status}
          deviceName={alarm.deviceName}
          deviceHref={deviceHref}
          onNavigate={onNavigate}
          openedAt={alarm.openedAt}
          occurrences={alarm.occurrences}
          flapping={alarm.flapping}
          backfilled={alarm.backfilled}
          type={alarm.type}
          topic={alarm.topic}
          onAcknowledge={caps.canAcknowledge ? (note) => act('acknowledge', note) : undefined}
          onClear={caps.canClear ? (note) => act('clear', note) : undefined}
          onOpenRunbook={() => setRunbookOpen(true)}
          now={now}
        />
        <AlarmEventTimeline events={events} onAddNote={caps.canComment ? addNote : undefined} />
      </div>

      <aside aria-label={m.related.title} className="h-fit space-y-3 rounded-xl border border-border bg-surface-raised p-4 text-sm">
        <h2 className="text-sm font-semibold text-text-primary">{m.related.title}</h2>
        <DescriptionList
          layout="stacked"
          dense
          emptyValue="—"
          items={[
            {
              id: 'device',
              label: m.alarm.device,
              value: deviceHref
                ? <a className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" href={deviceHref} onClick={link(deviceHref)}>{alarm.deviceName ?? alarm.deviceId}</a>
                : alarm.deviceName,
            },
            {
              id: 'raisedBy',
              label: m.related.raisedBy,
              value: raisedHref ? <a className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" href={raisedHref} onClick={link(raisedHref)}>{raisedBy}</a> : raisedBy,
            },
            {
              id: 'topic',
              label: m.alarm.topic,
              value: <code className="break-all font-mono text-xs">{alarm.topic}</code>,
              hidden: !alarm.topic,
            },
          ]}
        />
      </aside>

      <Drawer open={runbookOpen} onClose={() => setRunbookOpen(false)} title={m.runbook.title} closeLabel={m.common.close}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{alarm.runbook?.trim() || m.runbook.generic}</p>
      </Drawer>
    </div>
  );
}
