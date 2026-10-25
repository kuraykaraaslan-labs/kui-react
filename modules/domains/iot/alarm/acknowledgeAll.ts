import type { IotAlarmsApi } from '../api/adapter';

/** Alarms per round: one list page and one acknowledge call (the hosts cap both at 100). */
const ROUND = 100;
/** A tenant with more open alarms than this is acknowledged in more than one press. */
const MAX_ROUNDS = 50;

/**
 * "Acknowledge all": acknowledges every OPEN alarm (of one device with `scope.deviceId`) through the per-id
 * `acknowledge` the adapter already has, a page at a time, so a host needs no extra endpoint and every id still
 * passes the host's own permission and state checks. Stops when no OPEN alarm is left, or when a round moved
 * nothing (they all changed meanwhile), so it can never spin. Returns how many were acknowledged.
 */
export async function acknowledgeAllOpen(
  api: Pick<IotAlarmsApi, 'list' | 'acknowledge'>,
  scope?: { deviceId?: string },
  note?: string,
): Promise<number> {
  let done = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const page = await api.list({ page: 1, pageSize: ROUND, status: 'OPEN', deviceId: scope?.deviceId });
    if (page.items.length === 0) break;
    const results = await api.acknowledge(page.items.map((a) => a.alarmId), note);
    const ok = results.filter((r) => r.ok).length;
    done += ok;
    if (ok === 0 || page.items.length < ROUND) break;
  }
  return done;
}
