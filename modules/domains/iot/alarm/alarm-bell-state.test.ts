import { describe, it, expect, vi, afterEach } from 'vitest';
import { IotApiError, type AlarmLiveEvent, type AlarmTransition } from '../api/adapter';
import type { Alarm, AlarmCounts } from '../types/alarm';
import {
  ALARM_BELL_GRACE_MS, ALARM_BELL_REFRESH_MS, ALARM_BELL_REPAIR_MS, ALARM_BELL_START_WAIT_MS, AlarmBellSync, EMPTY_ALARM_BELL, alarmBellFrom, alarmCountsBehind,
  alarmsRunShort, applyAlarmEvent, compareMarks, type AlarmBellState,
} from './alarm-bell-state';

const T0 = new Date('2026-10-26T12:00:00Z').getTime();
const alarm = (id: string, minutesAgo: number, patch: Partial<Alarm> = {}): Alarm => ({
  alarmId: id, type: 't', severity: 'MAJOR', status: 'OPEN', title: `Alarm ${id}`, deviceId: 'd1', deviceName: 'Pump 4',
  openedAt: new Date(T0 - minutesAgo * 60_000), occurrences: 1, flapping: false, ...patch,
});
const counts = (open: number, acknowledged: number, by: Partial<AlarmCounts['bySeverity']> = {}): AlarmCounts => ({
  open, acknowledged, bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, WARNING: 0, INFO: 0, ...by },
});
const ev = (a: Alarm, transition: AlarmTransition, severityChange?: AlarmLiveEvent['severityChange']): AlarmLiveEvent => ({ alarm: a, transition, ...(severityChange ? { severityChange } : {}) });
const ids = (s: AlarmBellState) => s.items.map((a) => a.alarmId);

/** Two open MAJOR alarms and one acknowledged MINOR one, as the host answered. */
function base(limit = 5) {
  return alarmBellFrom(counts(2, 1, { MAJOR: 2, MINOR: 1 }), [alarm('a1', 5), alarm('a2', 10), alarm('a3', 20, { status: 'ACKNOWLEDGED', severity: 'MINOR', acknowledgedAt: new Date(T0) })], limit);
}

describe('applyAlarmEvent: every transition as the counts and the list would answer', () => {
  it('created: one more open of its severity, at its place in the list (newest opened first)', () => {
    const r = applyAlarmEvent(base(), ev(alarm('a4', 7, { severity: 'CRITICAL' }), 'created'), 5);
    expect(r.applied).toBe(true);
    expect(r.state.counts).toEqual(counts(3, 1, { CRITICAL: 1, MAJOR: 2, MINOR: 1 }));
    expect(ids(r.state)).toEqual(['a1', 'a4', 'a2', 'a3']);
  });

  it('acknowledged: from open to acknowledged, severity unchanged; the item stays', () => {
    const r = applyAlarmEvent(base(), ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'), 5);
    expect(r.state.counts).toEqual(counts(1, 2, { MAJOR: 2, MINOR: 1 }));
    expect(r.state.items[0].status).toBe('ACKNOWLEDGED');
  });

  it('updated with a severity change: between the severity counts, open and acknowledged unchanged', () => {
    const r = applyAlarmEvent(base(), ev(alarm('a2', 10, { severity: 'CRITICAL', occurrences: 2 }), 'updated', { from: 'MAJOR', to: 'CRITICAL' }), 5);
    expect(r.state.counts).toEqual(counts(2, 1, { CRITICAL: 1, MAJOR: 1, MINOR: 1 }));
    expect(r.state.items[1].severity).toBe('CRITICAL');
  });

  it('cleared: acknowledgedAt says which count it leaves, and it leaves the list', () => {
    const open = applyAlarmEvent(base(), ev(alarm('a1', 5, { status: 'RESOLVED', resolvedAt: new Date(T0) }), 'cleared'), 5);
    expect(open.state.counts).toEqual(counts(1, 1, { MAJOR: 1, MINOR: 1 }));
    expect(ids(open.state)).toEqual(['a2', 'a3']);
    const acked = applyAlarmEvent(base(), ev(alarm('a3', 20, { status: 'RESOLVED', severity: 'MINOR', acknowledgedAt: new Date(T0), resolvedAt: new Date(T0) }), 'cleared'), 5);
    expect(acked.state.counts).toEqual(counts(2, 0, { MAJOR: 2 }));
    expect(ids(acked.state)).toEqual(['a1', 'a2']);
  });

  it('an alarm the bell does not hold moves from what the event says it was', () => {
    // a5 is open somewhere past the list's end: counted, not listed
    const state = alarmBellFrom(counts(3, 1, { MAJOR: 3, MINOR: 1 }), [alarm('a1', 5), alarm('a2', 10)], 2);
    const acked = applyAlarmEvent(state, ev(alarm('a5', 60, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'), 2);
    expect(acked.state.counts).toEqual(counts(2, 2, { MAJOR: 3, MINOR: 1 }));
    expect(ids(acked.state)).toEqual(['a1', 'a2']); // older than the list's last: not listed
    const raised = applyAlarmEvent(state, ev(alarm('a5', 60, { severity: 'CRITICAL', occurrences: 3 }), 'updated', { from: 'MAJOR', to: 'CRITICAL' }), 2);
    expect(raised.state.counts).toEqual(counts(3, 1, { CRITICAL: 1, MAJOR: 2, MINOR: 1 }));
    const cleared = applyAlarmEvent(state, ev(alarm('a5', 60, { status: 'RESOLVED', acknowledgedAt: new Date(T0), resolvedAt: new Date(T0) }), 'cleared'), 2);
    expect(cleared.state.counts).toEqual(counts(3, 0, { MAJOR: 2, MINOR: 1 }));
  });

  it('an update without a severity change (or a re-trigger) changes no count', () => {
    const r = applyAlarmEvent(base(), ev(alarm('a2', 10, { occurrences: 4 }), 'updated'), 5);
    expect(r.applied).toBe(true);
    expect(r.state.counts).toEqual(base().counts);
  });

  it('a new alarm older than a full list counts but is not listed; the list keeps its limit', () => {
    const full = alarmBellFrom(counts(2, 0, { MAJOR: 2 }), [alarm('a1', 5), alarm('a2', 10)], 2);
    expect(ids(applyAlarmEvent(full, ev(alarm('old', 90), 'created'), 2).state)).toEqual(['a1', 'a2']);
    expect(ids(applyAlarmEvent(full, ev(alarm('new', 1), 'created'), 2).state)).toEqual(['new', 'a1']);
  });

  it('the same opening time is ordered by id, larger first, like the list', () => {
    const s = applyAlarmEvent(alarmBellFrom(counts(1, 0, { MAJOR: 1 }), [alarm('b', 5)], 5), ev(alarm('c', 5), 'created'), 5);
    expect(ids(s.state)).toEqual(['c', 'b']);
  });
});

describe('applyAlarmEvent: late and repeated events', () => {
  it('an event older than what the bell holds for that alarm is ignored', () => {
    const acked = applyAlarmEvent(base(), ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'), 5).state;
    const late = applyAlarmEvent(acked, ev(alarm('a1', 5), 'created'), 5);
    expect(late.applied).toBe(false);
    expect(late.state).toBe(acked);
    // a severity change the bell already holds a later occurrence of
    const raised = applyAlarmEvent(base(), ev(alarm('a2', 10, { severity: 'CRITICAL', occurrences: 3 }), 'updated', { from: 'MAJOR', to: 'CRITICAL' }), 5).state;
    expect(applyAlarmEvent(raised, ev(alarm('a2', 10, { severity: 'MINOR', occurrences: 2 }), 'updated', { from: 'MAJOR', to: 'MINOR' }), 5).applied).toBe(false);
    // and once resolved, nothing brings it back
    const gone = applyAlarmEvent(base(), ev(alarm('a2', 10, { status: 'RESOLVED', resolvedAt: new Date(T0) }), 'cleared'), 5).state;
    const back = applyAlarmEvent(gone, ev(alarm('a2', 10, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'), 5);
    expect(back.applied).toBe(false);
    expect(ids(back.state)).toEqual(['a1', 'a3']);
  });

  it('an event the answer already contains (the same state) changes no count twice', () => {
    // the answer listed a1 acknowledged; its acknowledged event arrives after it
    const answered = alarmBellFrom(counts(1, 1, { MAJOR: 2 }), [alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), alarm('a2', 10)], 5);
    const again = applyAlarmEvent(answered, ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'), 5);
    expect(again.state.counts).toEqual(answered.counts);
    const created = applyAlarmEvent(answered, ev(alarm('a2', 10), 'created'), 5);
    expect(created.state.counts).toEqual(answered.counts);
  });

  it('orders the states of one alarm by status, then occurrences', () => {
    expect(compareMarks({ status: 'OPEN', severity: 'MAJOR', occurrences: 9 }, { status: 'ACKNOWLEDGED', severity: 'MAJOR', occurrences: 1 })).toBeLessThan(0);
    expect(compareMarks({ status: 'ACKNOWLEDGED', severity: 'MAJOR', occurrences: 2 }, { status: 'ACKNOWLEDGED', severity: 'MINOR', occurrences: 3 })).toBeLessThan(0);
    expect(compareMarks({ status: 'RESOLVED', severity: 'MAJOR', occurrences: 1 }, { status: 'ACKNOWLEDGED', severity: 'MAJOR', occurrences: 5 })).toBeGreaterThan(0);
  });

  it('a sequence: created, raised, acknowledged, lowered, cleared, with a late repeat between', () => {
    let s = alarmBellFrom(counts(0, 0), [], 5);
    const step = (e: AlarmLiveEvent) => { s = applyAlarmEvent(s, e, 5).state; };
    const x = (p: Partial<Alarm>) => alarm('x', 1, p);
    step(ev(x({ severity: 'MINOR' }), 'created'));
    expect(s.counts).toEqual(counts(1, 0, { MINOR: 1 }));
    step(ev(x({ severity: 'CRITICAL', occurrences: 2 }), 'updated', { from: 'MINOR', to: 'CRITICAL' }));
    step(ev(x({ severity: 'MINOR' }), 'created')); // late
    expect(s.counts).toEqual(counts(1, 0, { CRITICAL: 1 }));
    step(ev(x({ severity: 'CRITICAL', occurrences: 2, status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'acknowledged'));
    step(ev(x({ severity: 'WARNING', occurrences: 3, status: 'ACKNOWLEDGED', acknowledgedAt: new Date(T0) }), 'updated', { from: 'CRITICAL', to: 'WARNING' }));
    expect(s.counts).toEqual(counts(0, 1, { WARNING: 1 }));
    expect(s.items[0]).toMatchObject({ status: 'ACKNOWLEDGED', severity: 'WARNING' });
    step(ev(x({ severity: 'WARNING', occurrences: 3, status: 'RESOLVED', acknowledgedAt: new Date(T0), resolvedAt: new Date(T0) }), 'cleared'));
    expect(s.counts).toEqual(counts(0, 0));
    expect(s.items).toEqual([]);
  });
});

describe('drift', () => {
  it('a count that would go below zero stays at zero and says the bell drifted', () => {
    const empty = alarmBellFrom(counts(0, 0), [], 5);
    const r = applyAlarmEvent(empty, ev(alarm('x', 1, { status: 'RESOLVED', resolvedAt: new Date(T0) }), 'cleared'), 5);
    expect(r.drift).toBe(true);
    expect(r.state.counts).toEqual(counts(0, 0));
  });

  it('a short list (fewer items than the counts) and counts behind the list are both seen', () => {
    const s = alarmBellFrom(counts(4, 0, { MAJOR: 4 }), [alarm('a1', 1), alarm('a2', 2)], 5);
    expect(alarmsRunShort(s, 5)).toBe(true);
    expect(alarmsRunShort(s, 2)).toBe(false);
    expect(alarmCountsBehind(alarmBellFrom(counts(1, 0, { MAJOR: 1 }), [alarm('a1', 1), alarm('a2', 2)], 5))).toBe(true);
    expect(alarmsRunShort(EMPTY_ALARM_BELL, 5)).toBe(false);
  });
});

// ── AlarmBellSync: when the bell asks the host ─────────────────────────────────────────────────────────────────────────

function fakeApi(opts: { parse?: boolean } = {}) {
  let answer = { counts: counts(2, 0, { MAJOR: 2 }), items: [alarm('a1', 5), alarm('a2', 10)] };
  const gate: { hold: boolean; release: Array<() => void> } = { hold: false, release: [] };
  const wait = () => (gate.hold ? new Promise<void>((r) => gate.release.push(r)) : Promise.resolve());
  const api = {
    counts: vi.fn(async () => { const c = answer.counts; await wait(); return c; }),
    list: vi.fn(async () => { const items = answer.items; await wait(); return { items, total: items.length }; }),
    ...(opts.parse === false ? {} : { parseLive: (p: unknown) => (p && typeof p === 'object' && 'alarm' in p ? p as AlarmLiveEvent : null) }),
  };
  return {
    api,
    set(c: AlarmCounts, items: Alarm[]) { answer = { counts: c, items }; },
    hold() { gate.hold = true; },
    release() { gate.hold = false; for (const r of gate.release.splice(0)) r(); },
  };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

describe('AlarmBellSync', () => {
  afterEach(() => vi.useRealTimers());

  it('asks once at the start, then follows the events without HTTP', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const changes: AlarmBellState[] = [];
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: (s) => changes.push(s) });
    sync.start({ awaitSnapshot: true });
    sync.snapshot(); // the subscription's first snapshot: the first answer goes with it
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(1);
    expect(sync.state.counts?.open).toBe(2);
    await vi.advanceTimersByTimeAsync(ALARM_BELL_GRACE_MS);
    sync.live(ev(alarm('a9', 1), 'created'));
    sync.live(ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    sync.live({ not: 'an event' });
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REFRESH_MS - ALARM_BELL_GRACE_MS - 1_000);
    expect(f.api.counts).toHaveBeenCalledTimes(1);
    expect(sync.state.counts).toEqual(counts(2, 1, { MAJOR: 3 }));
    expect(ids(sync.state)).toEqual(['a9', 'a1', 'a2']);
    sync.stop();
  });

  it('asks again every 5 minutes as a safety net, after a reconnect (a later snapshot), and on a poll', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REFRESH_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    sync.snapshot(); // a reconnect
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(3);
    sync.poll();
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(4);
    sync.stop();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REFRESH_MS * 2);
    expect(f.api.counts).toHaveBeenCalledTimes(4);
  });

  it('a subscription being made: the first answer goes with its first snapshot, or after 3 s without one and again with it', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start({ awaitSnapshot: true });
    sync.poll(); // the host's poll does not jump the wait
    await flush();
    expect(f.api.counts).not.toHaveBeenCalled();
    sync.snapshot();
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(1);
    sync.stop();

    const g = fakeApi();
    const late = new AlarmBellSync({ api: g.api, limit: 5, onChange: () => undefined });
    late.start({ awaitSnapshot: true });
    await vi.advanceTimersByTimeAsync(ALARM_BELL_START_WAIT_MS);
    expect(g.api.counts).toHaveBeenCalledTimes(1);
    // the socket comes up at 10 s: an alarm created since the 3 s answer is in neither that answer nor the events
    g.set(counts(3, 0, { MAJOR: 2, CRITICAL: 1 }), [alarm('c1', 0, { severity: 'CRITICAL' }), alarm('a1', 5), alarm('a2', 10)]);
    await vi.advanceTimersByTimeAsync(7_000);
    late.snapshot();
    await flush();
    expect(g.api.counts).toHaveBeenCalledTimes(2);
    expect(late.state.counts?.open).toBe(3);
    expect(ids(late.state)).toEqual(['c1', 'a1', 'a2']);
    late.stop();
  });

  it('a live source that came after the first answer: its first snapshot catches up', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    sync.snapshot();
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('a list that runs short while the counts say more: one answer, at most once per 30 s', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    f.set(counts(3, 0, { MAJOR: 3 }), [alarm('a1', 5), alarm('a2', 10)]);
    const sync = new AlarmBellSync({ api: f.api, limit: 2, onChange: () => undefined });
    sync.start();
    await flush();
    f.set(counts(2, 0, { MAJOR: 2 }), [alarm('a2', 10), alarm('a3', 30)]);
    sync.live(ev(alarm('a1', 5, { status: 'RESOLVED', resolvedAt: new Date() }), 'cleared'));
    expect(ids(sync.state)).toEqual(['a2']);
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS - 2_000);
    expect(f.api.list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(f.api.list).toHaveBeenCalledTimes(2);
    expect(ids(sync.state)).toEqual(['a2', 'a3']);
    sync.stop();
  });

  it('repairs a drift (a count below zero) with one answer', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    f.set(counts(0, 0), []);
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    f.set(counts(0, 1, { MAJOR: 1 }), [alarm('z', 3, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() })]);
    sync.live(ev(alarm('y', 1, { status: 'RESOLVED', resolvedAt: new Date() }), 'cleared'));
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    expect(sync.state.counts).toEqual(counts(0, 1, { MAJOR: 1 }));
    sync.stop();
  });

  it('events during a refresh are applied at once and again on its answer; one it cannot judge brings one more answer', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    f.hold();
    void sync.refresh();
    // the answer was read before both events: a2's acknowledge and a new alarm
    sync.live(ev(alarm('a2', 10, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    sync.live(ev(alarm('n1', 0), 'created'));
    expect(sync.state.counts).toEqual(counts(2, 1, { MAJOR: 3 }));
    f.release();
    await flush();
    expect(sync.state.counts).toEqual(counts(2, 1, { MAJOR: 3 }));
    expect(ids(sync.state)).toEqual(['n1', 'a1', 'a2']);
    expect(sync.state.items[2].status).toBe('ACKNOWLEDGED');
    // n1 was not in the answer: the counts may hold it twice or not at all, so the host is asked once more
    f.set(counts(2, 1, { MAJOR: 3 }), [alarm('n1', 0), alarm('a1', 5), alarm('a2', 10, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() })]);
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(3);
    sync.stop();
  });

  it('one refresh at a time: a request during one runs once after it', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    f.hold();
    sync.start();
    sync.poll();
    sync.poll();
    expect(f.api.counts).toHaveBeenCalledTimes(1);
    f.release();
    await flush();
    f.release();
    await flush();
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('an adapter without parseLive re-reads after an event, at most once per 30 s', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi({ parse: false });
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    sync.live({ any: 1 });
    sync.live({ any: 2 });
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    sync.live({ any: 3 });
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS - 1);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.api.counts).toHaveBeenCalledTimes(3);
    sync.stop();
  });

  it('a refused answer (429) alone is asked again once its Retry-After (at least 30 s) is over', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    f.api.counts.mockRejectedValueOnce(new IotApiError('rate_limited', 'Too many requests', { retryAfterMs: 45_000 }));
    sync.poll();
    await flush();
    await vi.advanceTimersByTimeAsync(44_000);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.api.counts).toHaveBeenCalledTimes(3);
    sync.stop();
  });

  it('a failed first answer while live is asked again (at most once per 30 s), not left to the safety net', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    f.api.counts.mockRejectedValueOnce(new IotApiError('unavailable', 'Bad gateway'));
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    expect(sync.state.counts).toBeNull();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    expect(sync.state.counts?.open).toBe(2);
    sync.stop();

    // a network error that is not the adapter's error is retried too; a refused viewer is not (the safety net stays)
    const g = fakeApi();
    g.api.counts.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const net = new AlarmBellSync({ api: g.api, limit: 5, onChange: () => undefined });
    net.start();
    await flush();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(g.api.counts).toHaveBeenCalledTimes(2);
    net.stop();
    const h = fakeApi();
    h.api.counts.mockRejectedValueOnce(new IotApiError('forbidden', 'No'));
    const denied = new AlarmBellSync({ api: h.api, limit: 5, onChange: () => undefined });
    denied.start();
    await flush();
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REFRESH_MS - 1_000);
    expect(h.api.counts).toHaveBeenCalledTimes(1);
    denied.stop();
  });

  it('an event just after an answer, about an alarm it does not list, brings one more answer (it may be counted twice)', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    // 7 open, the list shows 5; a6 (not listed) is acknowledged and the answer already counts it
    const listed = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) => alarm(id, i + 1));
    f.set(counts(6, 1, { MAJOR: 7 }), listed);
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    sync.live(ev(alarm('a6', 30, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    expect(sync.state.counts).toEqual(counts(5, 2, { MAJOR: 7 })); // applied twice for now
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    expect(sync.state.counts).toEqual(counts(6, 1, { MAJOR: 7 }));
    // after the grace an event about an unlisted alarm is the bell's to apply
    await vi.advanceTimersByTimeAsync(ALARM_BELL_GRACE_MS);
    sync.live(ev(alarm('a7', 40, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    expect(sync.state.counts).toEqual(counts(5, 2, { MAJOR: 7 }));
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REFRESH_MS - ALARM_BELL_GRACE_MS - 1_000);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    sync.stop();
  });

  it('a refused answer (429) holds every refresh for its Retry-After and keeps the last answer', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    f.api.counts.mockRejectedValueOnce(new IotApiError('rate_limited', 'Too many requests', { retryAfterMs: 90_000 }));
    sync.poll();
    await flush();
    expect(sync.state.counts?.open).toBe(2);
    sync.poll();
    await vi.advanceTimersByTimeAsync(89_000);
    expect(f.api.counts).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(f.api.counts).toHaveBeenCalledTimes(3);
    sync.stop();
  });

  it('an acknowledge the bell made itself is applied like its event, without an answer', async () => {
    vi.useFakeTimers({ now: T0 });
    const f = fakeApi();
    const sync = new AlarmBellSync({ api: f.api, limit: 5, onChange: () => undefined });
    sync.start();
    await flush();
    sync.apply(ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    // the live event of the same acknowledge, a moment later, changes nothing more
    sync.live(ev(alarm('a1', 5, { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }), 'acknowledged'));
    expect(sync.state.counts).toEqual(counts(1, 1, { MAJOR: 2 }));
    await vi.advanceTimersByTimeAsync(ALARM_BELL_REPAIR_MS);
    expect(f.api.counts).toHaveBeenCalledTimes(1);
    sync.stop();
  });
});
