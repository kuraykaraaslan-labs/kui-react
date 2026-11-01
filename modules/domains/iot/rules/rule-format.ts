import type { RuleItem, RuleMode } from '../types/rules';
import { fill } from '../format';
import type { IotMessages } from '../messages';

/** Words for the Rules card, pure: the status of a rule, a clock time, the "until" of Manual. */
export type RuleRunState = 'off' | 'attention' | 'manual' | 'paused' | 'waiting' | 'running' | 'idle';

/** What a rule is doing, one word of the chip (the first that applies: off, attention, Manual, a guard's pause, a hold, idle). */
export function ruleState(r: Pick<RuleItem, 'enabled' | 'status' | 'stoppedByManual' | 'pausedByGuard' | 'waitingUntil'>, now: number): RuleRunState {
  if (r.status === 'needs_attention') return 'attention';
  if (!r.enabled) return 'off';
  if (r.stoppedByManual) return 'manual';
  if (r.pausedByGuard) return 'paused';
  if (r.waitingUntil && r.waitingUntil > now) return 'waiting';
  return 'idle';
}

/** "3:20" for a countdown of 200 s; "1:02:03" past an hour. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

export function clock(ms: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

/** "today 14:02", "yesterday 09:10", else the date and time. Pure over `now`. */
export function when(ms: number, now: number, locale?: string): string {
  const day = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const diff = Math.round((day(now) - day(ms)) / 86_400_000);
  if (diff === 0) return clock(ms, locale);
  if (diff === 1) return `${new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day')} ${clock(ms, locale)}`;
  if (diff === -1) return `${new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(1, 'day')} ${clock(ms, locale)}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

/** The banner of a place in Manual: since when, by whom, until when. */
export function manualBanner(m: IotMessages['rules'], mode: RuleMode, now: number, locale?: string): string {
  const by = mode.setByName ? fill(m.manualBy, { name: mode.setByName }) : '';
  const until = mode.until ? fill(m.manualUntil, { when: when(mode.until, now, locale) }) : '';
  return fill(m.manualBanner, { since: mode.setAt ? when(mode.setAt, now, locale) : '', by, until });
}
