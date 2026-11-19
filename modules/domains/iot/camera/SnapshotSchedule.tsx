'use client';
import { useId, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Input } from '@/modules/ui/Input';
import { Toggle } from '@/modules/ui/Toggle';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, type TimeInput } from '../format';
import type { IotMessagesInput } from '../messages';

/**
 * SnapshotSchedule — whether a camera takes a still picture by itself, and how often: a switch, "every N minutes" and Save (nothing is saved before
 * Save). Presentational: the host reads and writes the schedule through its own API and passes the facts back (the last scheduled picture, when the
 * next is due, and why the schedule is paused after repeated failures). A paused schedule says why and is resumed by saving it again.
 *
 * The bounds are the host's (`min` / `max`, default 1 and 1440 minutes); a value outside them is not saved and says so. A reader who may not change it
 * sees the schedule in words only.
 */
export const SNAPSHOT_INTERVAL_MIN = 1;
export const SNAPSHOT_INTERVAL_MAX = 1440;
const DEFAULT_INTERVAL = 15;

export type SnapshotScheduleProps = {
  /** The saved interval in minutes; `null` = no schedule (pictures only when someone asks). */
  intervalMin: number | null;
  /** The last picture the schedule took (or tried). */
  lastAt?: TimeInput | null;
  /** When the next picture is due; `null` when the schedule is off or paused. */
  nextAt?: TimeInput | null;
  /** Why the schedule stopped after repeated failures (a code); `null` = running. */
  pausedReason?: string | null;
  /** The words for a pause reason (`camera_error` -> "The camera did not answer"); default the code itself. */
  reasonLabel?: (reason: string) => string;
  canManage: boolean;
  saving?: boolean;
  /** A save the host refused, in words. */
  error?: string | null;
  onSave: (intervalMin: number | null) => void | Promise<void>;
  min?: number;
  max?: number;
  messages?: IotMessagesInput;
  locale?: string;
  timeZone?: string;
};

export function SnapshotSchedule({
  intervalMin, lastAt = null, nextAt = null, pausedReason = null, reasonLabel, canManage, saving = false, error = null, onSave,
  min = SNAPSHOT_INTERVAL_MIN, max = SNAPSHOT_INTERVAL_MAX, messages, locale, timeZone,
}: SnapshotScheduleProps) {
  const { m, locale: lang, timeZone: zone } = useIotText(messages, locale);
  const t = m.snapshotSchedule;
  const id = useId();
  const [on, setOn] = useState(intervalMin !== null);
  const [text, setText] = useState(String(intervalMin ?? DEFAULT_INTERVAL));
  // a newly saved value (this host's save, or another person's) resets the form: state adjusted while rendering, not in an effect
  const [shown, setShown] = useState(intervalMin);
  if (shown !== intervalMin) { setShown(intervalMin); setOn(intervalMin !== null); setText(String(intervalMin ?? DEFAULT_INTERVAL)); }

  const when = (v: TimeInput) => formatDateTime(v, { locale: lang, timeZone: timeZone ?? zone });
  const n = Number(text);
  const valid = !on || (/^\d+$/.test(text.trim()) && n >= min && n <= max);
  const wanted = on ? (valid ? n : null) : null;
  const changed = on !== (intervalMin !== null) || (on && valid && n !== intervalMin);
  const paused = pausedReason ? (reasonLabel?.(pausedReason) ?? pausedReason) : null;
  // a paused schedule is resumed by saving it again, unchanged
  const resumable = paused !== null && intervalMin !== null && on && valid;

  const status = (
    <>
      {paused && intervalMin !== null && (
        <Callout variant="warning" title={null} data-kind="paused">{fill(t.paused, { reason: paused })}</Callout>
      )}
      {!paused && intervalMin !== null && nextAt && <p className="text-sm text-text-secondary">{fill(t.next, { time: when(nextAt) })}</p>}
      {intervalMin !== null && lastAt && <p className="text-sm text-text-secondary">{fill(t.last, { time: when(lastAt) })}</p>}
    </>
  );

  if (!canManage) {
    return (
      <section aria-labelledby={`${id}-h`} className="space-y-1">
        <h3 id={`${id}-h`} className="text-sm font-medium">{t.title}</h3>
        <p className="text-sm">{intervalMin === null ? t.off : fill(t.every, { n: intervalMin })}</p>
        {status}
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3">
      <h3 id={`${id}-h`} className="text-sm font-medium">{t.title}</h3>
      <Toggle id={`${id}-on`} label={t.toggle} description={t.toggleHint} checked={on} onChange={setOn} disabled={saving} />
      {on && (
        <Input
          id={`${id}-n`}
          label={t.interval}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          hint={fill(t.intervalHint, { min, max })}
          error={valid ? undefined : fill(t.invalid, { min, max })}
          disabled={saving}
          className="max-w-[12rem]"
        />
      )}
      {status}
      {error && <Callout variant="danger" title={null}>{error}</Callout>}
      <div>
        <Button size="sm" onClick={() => { void onSave(wanted); }} disabled={!(changed || resumable) || !valid || saving} loading={saving}>
          {paused && !changed ? t.resume : t.save}
        </Button>
      </div>
    </section>
  );
}
