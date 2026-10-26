import { IotApiError, type AlarmLiveEvent, type IotAlarmsApi } from '../api/adapter';
import type { Alarm, AlarmCounts, AlarmSeverity, AlarmStatus } from '../types/alarm';

/*
 * The bell's alarms, kept from the live events (NB phase 40, D40-9): the counts of the alarms not resolved and the latest of
 * them, as the counts and the list (`status: 'active'`) would answer, updated by each `alarms` event without asking the host
 * again. `applyAlarmEvent` is pure; `AlarmBellSync` holds the state and decides when HTTP is still needed.
 *
 * An alarm only moves forward: its status OPEN → ACKNOWLEDGED → RESOLVED never goes back and its `occurrences` only grows (a
 * re-trigger, a severity change included, counts one more). So (status, occurrences) orders the states of one alarm, and an
 * event older than what the bell holds for that alarm (a late delivery, or one the answer of a refresh already contains) is
 * ignored.
 */

export type AlarmMark = { status: AlarmStatus; severity: AlarmSeverity; occurrences: number };

export type AlarmBellState = {
  /** Null until the first answer. */
  counts: AlarmCounts | null;
  /** The latest alarms not resolved, newest opened first (as the list orders them), at most the bell's limit. */
  items: Alarm[];
  /** What the bell last knew of each alarm it has seen (its items and the events), the newest {@link SEEN_MAX}. */
  seen: ReadonlyMap<string, AlarmMark>;
};

export const EMPTY_ALARM_BELL: AlarmBellState = { counts: null, items: [], seen: new Map() };

/** How many alarms the bell remembers to judge late events (more than any list it shows). */
export const SEEN_MAX = 500;

const RANK: Record<AlarmStatus, number> = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 };

const markOf = (a: Alarm): AlarmMark => ({ status: a.status, severity: a.severity, occurrences: a.occurrences ?? 1 });

/** < 0: `a` is an older state of the alarm than `b`; 0: the same; > 0: newer. */
export function compareMarks(a: AlarmMark, b: AlarmMark): number {
  return RANK[a.status] - RANK[b.status] || a.occurrences - b.occurrences;
}

const time = (v: Date | string | number) => new Date(v).getTime() || 0;

/** The list's order: newest opened first, then the larger id (`ORDER BY openedAt DESC, alarmId DESC`). */
export function compareAlarms(a: Alarm, b: Alarm): number {
  return time(b.openedAt) - time(a.openedAt) || (a.alarmId > b.alarmId ? -1 : a.alarmId < b.alarmId ? 1 : 0);
}

function remember(seen: ReadonlyMap<string, AlarmMark>, id: string, mark: AlarmMark): Map<string, AlarmMark> {
  const next = new Map(seen);
  next.delete(id);
  next.set(id, mark);
  while (next.size > SEEN_MAX) next.delete(next.keys().next().value as string);
  return next;
}

/** The state of an answer of the counts and the list (the list in the host's order). */
export function alarmBellFrom(counts: AlarmCounts, items: readonly Alarm[], limit: number): AlarmBellState {
  const listed = items.filter((a) => a.status !== 'RESOLVED').slice(0, limit);
  let seen: Map<string, AlarmMark> = new Map();
  for (const a of listed) seen = remember(seen, a.alarmId, markOf(a));
  return { counts, items: listed, seen };
}

type Slot = { status: Exclude<AlarmStatus, 'RESOLVED'>; severity: AlarmSeverity } | null;

const slotOf = (status: AlarmStatus, severity: AlarmSeverity): Slot => (status === 'RESOLVED' ? null : { status, severity });

/** Where an alarm the bell has not seen was counted before this event, from the event alone. */
function slotBefore(ev: AlarmLiveEvent): Slot {
  const a = ev.alarm;
  switch (ev.transition) {
    case 'created': return null;
    case 'acknowledged': return { status: 'OPEN', severity: a.severity };
    // acknowledgedAt says which count a cleared alarm leaves
    case 'cleared': return { status: a.acknowledgedAt ? 'ACKNOWLEDGED' : 'OPEN', severity: a.severity };
    default: return slotOf(a.status, ev.severityChange?.from ?? a.severity);
  }
}

/** Moves one alarm from one slot of the counts to another; `drift` when a count would go below zero (kept at zero). */
function shift(counts: AlarmCounts, from: Slot, to: Slot): { counts: AlarmCounts; drift: boolean } {
  if (from?.status === to?.status && from?.severity === to?.severity) return { counts, drift: false };
  const next: AlarmCounts = { open: counts.open, acknowledged: counts.acknowledged, bySeverity: { ...counts.bySeverity } };
  let drift = false;
  const add = (s: Slot, d: 1 | -1) => {
    if (!s) return;
    const key = s.status === 'OPEN' ? 'open' : 'acknowledged';
    const n = next[key] + d;
    const k = (next.bySeverity[s.severity] ?? 0) + d;
    if (n < 0 || k < 0) drift = true;
    next[key] = Math.max(0, n);
    next.bySeverity[s.severity] = Math.max(0, k);
  };
  add(from, -1);
  add(to, 1);
  return { counts: next, drift };
}

/** The list with `a` in its place (or without it once resolved), at most `limit` long. */
function place(items: readonly Alarm[], a: Alarm, limit: number): Alarm[] {
  const rest = items.filter((x) => x.alarmId !== a.alarmId);
  if (a.status === 'RESOLVED') return rest;
  const i = rest.findIndex((x) => compareAlarms(a, x) < 0);
  return (i < 0 ? [...rest, a] : [...rest.slice(0, i), a, ...rest.slice(i)]).slice(0, limit);
}

export type AlarmEventResult = {
  state: AlarmBellState;
  /** False when the event was older than what the bell holds for that alarm (nothing changed). */
  applied: boolean;
  /** A count would have gone below zero: the bell had drifted, only an answer of the host repairs it. */
  drift: boolean;
};

/**
 * One live event on the bell: the counts move the alarm from where it was counted to where it is now (created, acknowledged,
 * updated with a severity change, cleared), and the list takes it in its place or drops it once resolved. An alarm the bell has
 * seen moves from what the bell held; one it has not seen from what the event says it was.
 */
export function applyAlarmEvent(state: AlarmBellState, ev: AlarmLiveEvent, limit: number): AlarmEventResult {
  const a = ev.alarm;
  const mark = markOf(a);
  const held = state.seen.get(a.alarmId);
  if (held && compareMarks(mark, held) < 0) return { state, applied: false, drift: false };
  const from = held ? slotOf(held.status, held.severity) : slotBefore(ev);
  const moved = state.counts ? shift(state.counts, from, slotOf(a.status, a.severity)) : { counts: null, drift: false };
  return {
    state: { counts: moved.counts, items: place(state.items, a, limit), seen: remember(state.seen, a.alarmId, mark) },
    applied: true,
    drift: moved.drift,
  };
}

/** The list holds fewer alarms than it could while the counts say more are not resolved: only the host has the next ones. */
export function alarmsRunShort(state: AlarmBellState, limit: number): boolean {
  const c = state.counts;
  return !!c && state.items.length < limit && c.open + c.acknowledged > state.items.length;
}

/** The counts say fewer alarms are not resolved than the list holds: they drifted. */
export function alarmCountsBehind(state: AlarmBellState): boolean {
  const c = state.counts;
  return !!c && c.open + c.acknowledged < state.items.length;
}

// ── when to ask the host ─────────────────────────────────────────────────────────────────────────────────────────────

/** The safety net: at most this long without an answer of the host, live or not. */
export const ALARM_BELL_REFRESH_MS = 5 * 60_000;
/** Without a live source the bell asks this often. */
export const ALARM_BELL_POLL_MS = 60_000;
/** A short list, a drift, an event a refresh may have missed, an adapter without `parseLive`: at most one answer per 30 s. */
export const ALARM_BELL_REPAIR_MS = 30_000;
/** A subscription that is connecting answers with a snapshot; the first answer waits for it at most this long. */
export const ALARM_BELL_START_WAIT_MS = 3_000;
/** A burst of events that each want an answer gets one. */
const COALESCE_MS = 1_000;
/** Without a `Retry-After`, a refused (429) answer waits this long. */
const RATE_LIMITED_WAIT_MS = 60_000;

export type AlarmBellSyncOptions = {
  api: Pick<IotAlarmsApi, 'counts' | 'list' | 'parseLive'>;
  limit: number;
  onChange: (state: AlarmBellState) => void;
  /** The clock (tests). */
  now?: () => number;
};

/**
 * The bell's state and its traffic (D40-9). HTTP (the counts and the list, in parallel) only: when the bell starts (or the first
 * snapshot of a subscription that was still connecting), after the live source reconnects (a later snapshot), when the list runs
 * short while the counts say more are not resolved, after a drift, and every 5 minutes as a safety net; every 60 s without a live
 * source (the host's poll). Everything else comes from the events: `parseLive` turns a payload into an event and
 * `applyAlarmEvent` applies it. An adapter without `parseLive` keeps the old behaviour, a refresh after an event, at most once per
 * 30 s. One refresh at a time; events that arrive while one is in flight are applied at once and again on its answer, which
 * judges the alarms it lists exactly; when such an event concerns an alarm the answer does not list, one more refresh follows
 * (at most once per 30 s). A refused answer (429) holds every refresh for its `Retry-After`.
 */
export class AlarmBellSync {
  state: AlarmBellState = EMPTY_ALARM_BELL;
  private readonly now: () => number;
  private stopped = true;
  private inFlight = false;
  private again = false;
  private buffer: AlarmLiveEvent[] = [];
  private lastSent = Number.NEGATIVE_INFINITY;
  private holdUntil = 0;
  private subscribedAt = Number.NEGATIVE_INFINITY;
  private snapshots = 0;
  private waiting = false;
  private repairTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimer: ReturnType<typeof setTimeout> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly o: AlarmBellSyncOptions) {
    this.now = o.now ?? Date.now;
  }

  /** The bell may read alarms: the first answer now, or (`awaitSnapshot`) with the snapshot of the subscription being connected. */
  start(opts: { awaitSnapshot?: boolean } = {}): void {
    this.stopped = false;
    if (opts.awaitSnapshot) {
      this.waiting = true;
      this.startTimer = setTimeout(() => { this.startTimer = null; if (this.waiting) { this.waiting = false; void this.refresh(); } }, ALARM_BELL_START_WAIT_MS);
      return;
    }
    void this.refresh();
  }

  stop(): void {
    this.stopped = true;
    this.waiting = false;
    this.again = false;
    for (const t of [this.repairTimer, this.safetyTimer, this.startTimer]) if (t) clearTimeout(t);
    this.repairTimer = this.safetyTimer = this.startTimer = null;
  }

  /** A (new) subscription to the alarm topic was made: its first snapshot is a catch-up point unless an answer was asked since. */
  subscribed(): void {
    this.subscribedAt = this.now();
    this.snapshots = 0;
  }

  /** The subscription's snapshot: the first after `subscribed` (unless already answered) and every later one (a reconnect) refresh. */
  snapshot(): void {
    if (this.stopped) return;
    this.snapshots += 1;
    if (this.waiting) {
      this.waiting = false;
      if (this.startTimer) clearTimeout(this.startTimer);
      this.startTimer = null;
      void this.refresh();
      return;
    }
    if (this.snapshots === 1 && this.lastSent >= this.subscribedAt) return;
    void this.refresh();
  }

  /** The host's poll tick (no live source, or not live). */
  poll(): void {
    if (!this.stopped && !this.waiting) void this.refresh();
  }

  /** A payload of the alarm topic. */
  live(payload: unknown): void {
    if (this.stopped) return;
    if (!this.o.api.parseLive) { this.repair(); return; }
    const ev = this.o.api.parseLive(payload);
    if (ev) this.apply(ev);
  }

  /** An event the bell itself knows of (an acknowledge it made): applied like a live one, so no refresh is needed. */
  apply(ev: AlarmLiveEvent): void {
    if (this.stopped) return;
    if (this.inFlight) this.buffer.push(ev);
    const r = applyAlarmEvent(this.state, ev, this.o.limit);
    if (!r.applied) return;
    this.commit(r.state);
    if (r.drift || alarmsRunShort(r.state, this.o.limit) || alarmCountsBehind(r.state)) this.repair();
  }

  /** Asks the host now (a refresh in flight is followed by one more). Resolves when the answer is applied (or failed). */
  async refresh(): Promise<void> {
    if (this.stopped) return;
    const wait = this.holdUntil - this.now();
    if (wait > 0) { this.repair(); return; }
    if (this.inFlight) { this.again = true; return; }
    this.inFlight = true;
    this.lastSent = this.now();
    this.armSafety();
    const { api, limit } = this.o;
    try {
      const [counts, page] = await Promise.all([api.counts(), api.list({ page: 1, pageSize: limit, status: 'active' })]);
      if (this.stopped) return;
      let next = alarmBellFrom(counts, page.items, limit);
      const listed = new Set(next.items.map((a) => a.alarmId));
      let unsure = false;
      let drift = false;
      for (const ev of this.buffer) {
        if (!listed.has(ev.alarm.alarmId)) unsure = true;
        const r = applyAlarmEvent(next, ev, limit);
        next = r.state;
        drift = drift || r.drift;
      }
      this.commit(next);
      if (unsure || drift || alarmsRunShort(next, limit) || alarmCountsBehind(next)) this.repair();
    } catch (e) {
      // keep the last answer; a refused one waits its Retry-After
      if (e instanceof IotApiError && e.code === 'rate_limited') this.holdUntil = this.now() + (e.retryAfterMs ?? RATE_LIMITED_WAIT_MS);
    } finally {
      this.inFlight = false;
      this.buffer = [];
      if (this.again && !this.stopped) { this.again = false; void this.refresh(); }
    }
  }

  /** One refresh soon: at most one per 30 s, never inside a 429's wait, after a short pause that gathers a burst. */
  private repair(): void {
    if (this.stopped || this.repairTimer) return;
    const now = this.now();
    const wait = Math.max(COALESCE_MS, this.lastSent + ALARM_BELL_REPAIR_MS - now, this.holdUntil - now);
    this.repairTimer = setTimeout(() => { this.repairTimer = null; void this.refresh(); }, wait);
  }

  private armSafety(): void {
    if (this.safetyTimer) clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(() => { this.safetyTimer = null; void this.refresh(); }, ALARM_BELL_REFRESH_MS);
  }

  private commit(next: AlarmBellState): void {
    this.state = next;
    this.o.onChange(next);
  }
}
