import type { AlarmListQuery, IotAlarmsApi } from '../api/adapter';

/** Alarms per round: one list page and one acknowledge call (the hosts cap both at 100). */
const ROUND = 100;
/** Most list reads of one press: a tenant with more open alarms than that is told some are left (`more`) and presses again. */
export const ACKNOWLEDGE_ALL_MAX_ROUNDS = 50;

/** What "Acknowledge all" acts on: the list's scope and filters (its status is always OPEN). */
export type AcknowledgeAllScope = Pick<AlarmListQuery, 'deviceId' | 'severity' | 'search'>;

export type AcknowledgeAllResult = {
  /** Alarms acknowledged. */
  done: number;
  /** Alarms that changed meanwhile (acknowledged or cleared by someone else): reported, not acknowledged. */
  skipped: number;
  /** The call that failed part way (the `done` before it stay acknowledged); absent when it ran to the end. */
  error?: unknown;
  /** It stopped at its round limit with open alarms possibly left (the `done` stay acknowledged): pressing again goes on. */
  more?: true;
};

const time = (v: Date | string | number) => new Date(v).getTime() || 0;

/**
 * "Acknowledge all": acknowledges the OPEN alarms of the list's scope and filters (`scope`: the device, the severities, the search)
 * through the per-id `acknowledge` the adapter already has, a page at a time, so a host needs no extra endpoint and every id still
 * passes the host's own permission and state checks. Only alarms open when it started are acknowledged: one that opens while it runs
 * stays OPEN, so its notifications and reminders are never stopped unseen (NB 41-ui-fixes/24 1.2). The cut is the newest opening time
 * of the first page it reads (the host's clock, so a browser clock that runs late or early moves nothing), or `startedAt`. An alarm
 * opened from late readings meanwhile (backfilled: its opening time is the readings', before the cut) is acknowledged with the others:
 * accepted, it says what happened before the press. After a round that acknowledged something it reads from page 1 again, since the
 * rows below move up as the acknowledged ones leave the OPEN list (reading on from the same page would skip them). Stops when no such
 * alarm is left, or when a round moved nothing (they all changed meanwhile), so it can never spin; at `ACKNOWLEDGE_ALL_MAX_ROUNDS` reads
 * it stops with `more`. It never throws: a failure part way is returned with the count done before it, so the viewer is told what was
 * acknowledged.
 */
export async function acknowledgeAllOpen(
  api: Pick<IotAlarmsApi, 'list' | 'acknowledge'>,
  scope: AcknowledgeAllScope = {},
  note?: string,
  startedAt?: number,
): Promise<AcknowledgeAllResult> {
  let done = 0;
  let skipped = 0;
  // newer alarms stay OPEN at the top of the newest-first list: once a page holds only those, the next page is read
  let page = 1;
  let cut: number | undefined;
  try {
    for (let round = 0; ; round += 1) {
      if (round >= ACKNOWLEDGE_ALL_MAX_ROUNDS) return { done, skipped, more: true };
      const res = await api.list({
        page, pageSize: ROUND, status: 'OPEN', deviceId: scope.deviceId,
        ...(scope.severity?.length ? { severity: scope.severity } : {}), ...(scope.search ? { search: scope.search } : {}),
      });
      if (res.items.length === 0) break;
      cut ??= startedAt ?? Math.max(...res.items.map((a) => time(a.openedAt)));
      const ids = res.items.filter((a) => time(a.openedAt) <= (cut as number)).map((a) => a.alarmId);
      if (ids.length === 0) {
        if (res.items.length < ROUND) break;
        page += 1;
        continue;
      }
      const results = await api.acknowledge(ids, note);
      const ok = results.filter((r) => r.ok).length;
      done += ok;
      skipped += ids.length - ok;
      // nothing moved: stop (no spin); a short first page held every alarm left; else from the top again (rows moved up)
      if (ok === 0 || (page === 1 && res.items.length < ROUND)) break;
      page = 1;
    }
  } catch (error) {
    return { done, skipped, error };
  }
  return { done, skipped };
}
