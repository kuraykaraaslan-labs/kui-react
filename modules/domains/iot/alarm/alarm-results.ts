import { errorMessage } from '../api/adapter';
import { fill, plural } from '../format';
import type { IotMessages } from '../messages';
import type { AlarmStatus } from '../types/alarm';

/*
 * How an alarm action's outcome is told (NB 41-ui-fixes/24 1.7, 1.16): from the host's answer, never from what the view held before
 * the action. A refused id says why from its `reason` (`already_acknowledged`, `not_active`, `not_found`); another reason says the
 * status the alarm has now (`status`, read again after the action), and only without either the generic line. A failed call says
 * which action failed, with the host's words when it gave some.
 */

/** "Nothing changed: …" for an id the host did not move. */
export function unchangedText(m: IotMessages, reason?: string, status?: AlarmStatus): string {
  if (reason === 'already_acknowledged') return m.alarm.unchanged_already_acknowledged;
  if (reason === 'not_active') return m.alarm.unchanged_not_active;
  if (reason === 'not_found') return m.alarm.unchanged_not_found;
  return status ? fill(m.alarm.unchanged, { status: m.status[status] }) : m.alarm.unchanged_moved;
}

/** "The action failed: …" with the action's own fallback when the host gave no words (no answer at all, a network error). */
export function actionFailedText(m: IotMessages, e: unknown, action: 'acknowledge' | 'clear', many = false): string {
  const fallback = action === 'acknowledge'
    ? (many ? m.alarms.acknowledgeFailed : m.alarm.acknowledgeFailed)
    : (many ? m.alarms.clearFailed : m.alarm.clearFailed);
  return fill(m.alarm.failed, { message: errorMessage(e, fallback) });
}

/**
 * What "Acknowledge all" did: how many, how many had changed meanwhile, a failure part way with the count done before it, and a stop at
 * its round limit (`more`) with the count done and that pressing again goes on.
 */
export function acknowledgeAllNotice(m: IotMessages, r: { done: number; skipped: number; error?: unknown; more?: boolean }, locale?: string): { tone: 'success' | 'info' | 'error'; message: string } {
  if (r.error !== undefined) {
    return { tone: 'error', message: fill(m.alarms.acknowledgeAllStopped, { n: r.done, message: errorMessage(r.error, m.alarms.acknowledgeFailed) }) };
  }
  if (r.more) return { tone: 'info', message: plural(r.done, { one: m.alarms.acknowledgeAllMore_one, other: m.alarms.acknowledgeAllMore }, locale) };
  if (r.skipped > 0) return { tone: 'info', message: fill(m.alarms.bulkDone, { done: r.done, skipped: r.skipped }) };
  return { tone: 'success', message: plural(r.done, { one: m.alarms.acknowledgeAllDone_one, other: m.alarms.acknowledgeAllDone }, locale) };
}
