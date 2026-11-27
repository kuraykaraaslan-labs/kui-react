'use client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { cn } from '@/libs/utils/cn';
import {
  countdownLabels,
  countdownUnits,
  formatEndDate,
  formatUnit,
  msUntilNextTick,
  splitRemaining,
  tickStep,
  toEpochMs,
  toIsoString,
  type CountdownDateInput,
  type CountdownLabels,
  type CountdownUnit,
} from './countdownTime';

export type CountdownVariant = 'compact' | 'boxed';
export type CountdownSize = 'sm' | 'md';

export type CountdownProps = {
  /** When the countdown reaches zero (a Date, an ISO string or epoch milliseconds). */
  endsAt: CountdownDateInput;
  /**
   * The time the server rendered at. With it the server and the first client render show the same numbers; without
   * it they show "--" until the client knows the time. Either way the client then ticks on its own clock.
   */
  now?: CountdownDateInput;
  /** Show seconds and tick every second (default false: minutes, one tick a minute). */
  showSeconds?: boolean;
  /** `compact` reads "2d 4h 12m"; `boxed` draws one box per unit with its name below. */
  variant?: CountdownVariant;
  size?: CountdownSize;
  /** Picks the default words (`tr*` Turkish, else English) and formats the end date for screen readers. */
  locale?: string;
  /** Time zone of the end date read to screen readers (default: the viewer's). */
  timeZone?: string;
  labels?: Partial<CountdownLabels>;
  /** Text shown once the end date has passed (overrides `labels.ended`). */
  endedLabel?: string;
  /** Called once on the client when the countdown is (or becomes) over. */
  onEnd?: () => void;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>;

const ROOT_SIZE: Record<CountdownSize, string> = { sm: 'text-xs', md: 'text-sm' };

const BOX_SIZE: Record<CountdownSize, { box: string; value: string; label: string }> = {
  sm: { box: 'min-w-10 px-1.5 py-1', value: 'text-base', label: 'text-[10px]' },
  md: { box: 'min-w-14 px-2 py-1.5', value: 'text-2xl', label: 'text-xs' },
};

/** Steps left (floor of time left / step), -1 once ended, null while the time is not known (server, no `now`). */
type Snapshot = number | null;

function stepsLeft(end: number, at: number, step: number): number {
  const left = end - at;
  return Number.isFinite(left) && left > 0 ? Math.floor(left / step) : -1;
}

const UNIT_LABEL: Record<CountdownUnit, { long: keyof CountdownLabels; short: keyof CountdownLabels }> = {
  days: { long: 'days', short: 'daysShort' },
  hours: { long: 'hours', short: 'hoursShort' },
  minutes: { long: 'minutes', short: 'minutesShort' },
  seconds: { long: 'seconds', short: 'secondsShort' },
};

export function Countdown({
  endsAt,
  now,
  showSeconds = false,
  variant = 'compact',
  size = 'md',
  locale,
  timeZone,
  labels,
  endedLabel,
  onEnd,
  className,
  ...rest
}: CountdownProps) {
  const end = toEpochMs(endsAt);
  const step = tickStep(showSeconds);
  const serverNow = now === undefined ? undefined : toEpochMs(now);

  const subscribe = useCallback((notify: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const at = Date.now();
      if (!(end > at)) return;
      timer = setTimeout(() => { notify(); schedule(); }, msUntilNextTick(end, at, step) + 20);
    };
    const wake = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); notify(); schedule(); } };
    schedule();
    document.addEventListener('visibilitychange', wake);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', wake); };
  }, [end, step]);

  const snapshot: Snapshot = useSyncExternalStore<Snapshot>(
    subscribe,
    () => stepsLeft(end, Date.now(), step),
    () => (serverNow === undefined ? null : stepsLeft(end, serverNow, step)),
  );

  const pending = snapshot === null;
  const ended = snapshot !== null && snapshot < 0;
  const parts = snapshot !== null && snapshot >= 0 ? splitRemaining(snapshot * step, 0) : null;

  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!ended || firedFor.current === end) return;
    firedFor.current = end;
    onEndRef.current?.();
  }, [ended, end]);

  const words = countdownLabels(locale, endedLabel === undefined ? labels : { ...labels, ended: endedLabel });
  const boxed = variant === 'boxed';
  const box = BOX_SIZE[size];

  return (
    <span
      className={cn('inline-flex items-center gap-2', ROOT_SIZE[size], className)}
      data-variant={variant}
      data-size={size}
      data-state={pending ? 'pending' : ended ? 'ended' : 'running'}
      {...rest}
    >
      <span
        role="timer"
        aria-live="off"
        aria-atomic="true"
        className={cn('inline-flex', boxed ? 'items-stretch gap-2' : 'items-baseline gap-1.5 font-semibold tabular-nums')}
        data-part="units"
        hidden={ended}
      >
        {countdownUnits(showSeconds).map((unit) => {
          const value = parts ? formatUnit(unit, parts[unit], variant) : '--';
          const hideDays = !boxed && unit === 'days' && parts !== null && parts.days === 0;
          return boxed ? (
            <span
              key={unit}
              className={cn('flex flex-col items-center rounded-md border border-border bg-surface-raised text-text-primary', box.box)}
              data-unit={unit}
            >
              <span className={cn('font-semibold tabular-nums', box.value, 'leading-none')} data-part="value">{value}</span>
              <span className={cn('mt-1 text-text-secondary', box.label)} data-part="label">{words[UNIT_LABEL[unit].long]}</span>
            </span>
          ) : (
            <span key={unit} className="inline-flex items-baseline" data-unit={unit} hidden={hideDays}>
              <span data-part="value">{value}</span>
              <span data-part="label">{words[UNIT_LABEL[unit].short]}</span>
            </span>
          );
        })}
      </span>
      <span className="font-semibold" data-part="ended" hidden={!ended}>{words.ended}</span>
      <span className="sr-only">
        {`${words.endsAt} `}
        <time dateTime={toIsoString(endsAt)} suppressHydrationWarning>{formatEndDate(endsAt, locale, timeZone)}</time>
      </span>
    </span>
  );
}
