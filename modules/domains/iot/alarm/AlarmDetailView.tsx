'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from '@/modules/ui/Drawer';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { Button } from '@/modules/ui/Button';
import { cn } from '@/libs/utils/cn';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill } from '../format';
import type { Alarm, AlarmEvent, AlarmStatus } from '../types/alarm';
import { AlarmDetailHeader } from './AlarmDetailHeader';
import { AlarmEventTimeline } from './AlarmEventTimeline';

/**
 * AlarmDetailView — one alarm (phase 03 §3.1), read through the adapter: the header with real actions (acknowledge and clear,
 * with an optional note; optimistic, rolled back with a toast when the server refuses or the alarm changed meanwhile), the
 * timeline with a note box, a runbook drawer (the rule's text, else generic steps) and a "Related" panel (device, what raised
 * it, the topic). It follows the alarm live (its device's or the tenant's alarm topic) and re-reads every 30 s without a live
 * source. Actions and the note box show only with their capabilities.
 */
export type AlarmDetailViewProps = {
  alarmId: string;
  hrefs?: { device?: (deviceId: string) => string; rule?: (profileId: string, ruleId: string) => string; flow?: (flowId: string, nodeId: string) => string };
  now?: number;
  className?: string;
};

export function AlarmDetailView({ alarmId, hrefs = {}, now, className }: AlarmDetailViewProps) {
  const api = useIotAdapter().alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [alarm, setAlarm] = useState<Alarm | null>(null);
  const [events, setEvents] = useState<AlarmEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runbookOpen, setRunbookOpen] = useState(false);
  const alarmRef = useRef<Alarm | null>(null);
  useEffect(() => { alarmRef.current = alarm; }, [alarm]);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return Promise.all([api.get(alarmId, signal), api.events(alarmId, signal)]).then(
      ([a, ev]) => { if (!signal?.aborted) { setAlarm(a); setEvents(ev); setError(null); } },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.alarm.loadError)); },
    );
  }, [api, alarmId, m.alarm.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const deviceId = alarm?.deviceId ?? null;
  useLiveOrPoll({
    enabled: !!alarm,
    key: deviceId ?? 'tenant',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.alarms(deviceId ? { deviceId } : 'tenant'),
      onLive: (payload) => {
        const ev = api.parseLive?.(payload);
        if (!ev || ev.alarm.alarmId !== alarmId) return;
        setAlarm(ev.alarm);
        void api.events(alarmId).then(setEvents).catch(() => undefined);
      },
    }) : undefined,
    poll: () => { void load(); },
  });

  async function act(action: 'acknowledge' | 'clear', note?: string) {
    if (!api || !alarmRef.current) return;
    const before = alarmRef.current;
    const optimistic: AlarmStatus = action === 'acknowledge' ? 'ACKNOWLEDGED' : 'RESOLVED';
    setAlarm({ ...before, status: optimistic, ...(action === 'acknowledge' ? { acknowledgedAt: new Date() } : { resolvedAt: new Date() }) });
    try {
      const [result] = action === 'acknowledge' ? await api.acknowledge([alarmId], note) : await api.clear([alarmId], note);
      if (!result?.ok) {
        setAlarm(before);
        notify({ tone: 'info', message: fill(m.alarm.unchanged, { status: m.status[before.status] }) });
      } else {
        notify({ tone: 'success', message: action === 'acknowledge' ? m.alarm.acknowledged : m.alarm.cleared });
      }
      await load();
    } catch (e) {
      setAlarm(before);
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarm.loadError) }) });
      throw e;
    }
  }

  async function addNote(text: string) {
    if (!api) return;
    await api.comment(alarmId, text);
    notify({ tone: 'success', message: m.event.noteAdded });
    setEvents(await api.events(alarmId));
  }

  if (!api) return null;
  if (error && !alarm) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        <Button variant="outline" size="sm" onClick={() => void load()}>{m.common.retry}</Button>
      </div>
    );
  }
  if (!alarm) return <SkeletonText lines={6} className={className} />;

  const origin = alarm.origin;
  const raisedBy = !origin ? m.related.unknown
    : origin.kind === 'profileRule' ? fill(m.related.profileRule, { name: origin.ruleName ?? origin.ruleId })
      : origin.kind === 'flow' ? fill(m.related.flow, { flow: origin.flowName ?? origin.flowId, node: origin.nodeName ?? origin.nodeId })
        : m.related.operator;
  const raisedHref = origin?.kind === 'profileRule' ? hrefs.rule?.(origin.profileId, origin.ruleId)
    : origin?.kind === 'flow' ? hrefs.flow?.(origin.flowId, origin.nodeId) : undefined;

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]', className)}>
      <div className="min-w-0 space-y-4">
        <AlarmDetailHeader
          title={alarm.title}
          message={alarm.message}
          severity={alarm.severity}
          status={alarm.status}
          deviceName={alarm.deviceName}
          deviceHref={alarm.deviceId ? hrefs.device?.(alarm.deviceId) : undefined}
          openedAt={alarm.openedAt}
          occurrences={alarm.occurrences}
          flapping={alarm.flapping}
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
        <dl className="space-y-2">
          <div>
            <dt className="text-xs text-text-secondary">{m.alarm.device}</dt>
            <dd className="text-text-primary">
              {alarm.deviceId && hrefs.device
                ? <a className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" href={hrefs.device(alarm.deviceId)}>{alarm.deviceName ?? alarm.deviceId}</a>
                : (alarm.deviceName ?? '—')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">{m.related.raisedBy}</dt>
            <dd className="break-words text-text-primary">
              {raisedHref ? <a className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" href={raisedHref}>{raisedBy}</a> : raisedBy}
            </dd>
          </div>
          {alarm.topic && (
            <div>
              <dt className="text-xs text-text-secondary">{m.alarm.topic}</dt>
              <dd><code className="break-all font-mono text-xs">{alarm.topic}</code></dd>
            </div>
          )}
        </dl>
      </aside>

      <Drawer open={runbookOpen} onClose={() => setRunbookOpen(false)} title={m.runbook.title} closeLabel={m.common.close}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{alarm.runbook?.trim() || m.runbook.generic}</p>
      </Drawer>
    </div>
  );
}
