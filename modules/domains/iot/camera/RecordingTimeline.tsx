'use client';
import { useId, useMemo, type KeyboardEvent } from 'react';
import { cn } from '@/libs/utils/cn';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, toDate, type TimeInput } from '../format';
import type { IotMessagesInput } from '../messages';

/**
 * RecordingTimeline — one bar for a window of a camera's recordings: the footage that exists (green), the gaps (empty), the kept clips (outlined), the event
 * markers (dots, each a button), a cursor, and a click or the keyboard to choose a moment. Presentational: the host passes the ranges it got from its own
 * index and plays what `onPick` / `onPlay` choose (the player is the host's, the timeline knows no link).
 *
 * Accessible: the bar is a `slider` (Left / Right move the cursor a minute, Shift ten minutes, Home / End to the ends of the window, Enter plays), the markers
 * are buttons with a label, and the ranges are listed as text for a screen reader. Times are shown in the viewer's locale and the host's time zone.
 */
const MINUTE = 60_000;
const HOUR = 3_600_000;

export type RecordingRange = { from: TimeInput; to: TimeInput };
export type RecordingClipRange = RecordingRange & { id: string };
export type RecordingMarker = { id: string; at: TimeInput; kind: string | null };

export type RecordingTimelineProps = {
  /** The window shown (a day, a few hours). */
  from: Date;
  to: Date;
  /** Footage that exists, merged into ranges by the host. */
  coverage: readonly RecordingRange[];
  /** The holes between the ranges (listed for a screen reader; the bar shows them as empty). */
  gaps?: readonly RecordingRange[];
  clips?: readonly RecordingClipRange[];
  markers?: readonly RecordingMarker[];
  cursor: Date | null;
  onPick: (at: Date) => void;
  /** Enter on the bar (and nothing else): play from the cursor. */
  onPlay?: () => void;
  /** The words for an event kind (`motion` -> "Motion"); default the message `event`. */
  markerLabel?: (kind: string | null) => string;
  locale?: string;
  timeZone?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const ms = (v: TimeInput): number => toDate(v)?.getTime() ?? Number.NaN;

export function RecordingTimeline({ from, to, coverage, gaps = [], clips = [], markers = [], cursor, onPick, onPlay, markerLabel, locale, timeZone, messages, className }: RecordingTimelineProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const legendId = useId();
  const t = m.recording;
  const start = from.getTime();
  const end = to.getTime();
  const span = Math.max(1, end - start);
  const pct = (v: number): number => Math.min(100, Math.max(0, ((v - start) / span) * 100));
  const width = (a: number, b: number, min: number): string => `${Math.max(min, pct(b) - pct(a))}%`;
  const at = cursor ? cursor.getTime() : start;
  const label = (kind: string | null): string => markerLabel?.(kind) ?? t.event;
  const when = (v: TimeInput): string => formatDateTime(v, { locale: lang, timeZone });
  const hhmm = useMemo(() => new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', timeZone }), [lang, timeZone]);
  const ticks = useMemo(() => {
    const step = span > 12 * HOUR ? 3 * HOUR : HOUR;
    const out: number[] = [];
    for (let v = Math.ceil(start / step) * step; v < end && out.length < 48; v += step) out.push(v);
    return out;
  }, [start, end, span]);

  const move = (v: number): void => onPick(new Date(Math.min(end - 1, Math.max(start, v))));
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = (e.shiftKey ? 10 : 1) * MINUTE;
    if (e.key === 'ArrowRight') { e.preventDefault(); move(at + step); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(at - step); }
    else if (e.key === 'Home') { e.preventDefault(); move(start); }
    else if (e.key === 'End') { e.preventDefault(); move(end - 1); }
    else if (e.key === 'Enter' && onPlay) { e.preventDefault(); onPlay(); }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t.bar}
        aria-describedby={legendId}
        aria-valuemin={start}
        aria-valuemax={end}
        aria-valuenow={at}
        aria-valuetext={when(new Date(at))}
        onKeyDown={onKey}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (r.width > 0) move(start + ((e.clientX - r.left) / r.width) * span);
        }}
        className="relative h-12 w-full cursor-pointer overflow-hidden rounded-md border border-border bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        {coverage.map((c) => (
          <div key={`c${ms(c.from)}`} data-kind="coverage" className="absolute inset-y-2 rounded-sm bg-success/70" style={{ left: `${pct(ms(c.from))}%`, width: width(ms(c.from), ms(c.to), 0.2) }} />
        ))}
        {clips.map((c) => (
          <div key={c.id} data-kind="clip" title={t.clip} className="pointer-events-none absolute inset-y-0.5 rounded-sm border-2 border-primary" style={{ left: `${pct(ms(c.from))}%`, width: width(ms(c.from), ms(c.to), 0.4) }} />
        ))}
        {cursor && <div data-kind="cursor" className="pointer-events-none absolute inset-y-0 w-0.5 bg-text-primary" style={{ left: `${pct(at)}%` }} />}
      </div>
      <div className="relative h-5">
        {markers.map((mk) => (
          <button
            key={mk.id}
            type="button"
            aria-label={fill(t.marker, { kind: label(mk.kind), time: when(mk.at) })}
            title={label(mk.kind)}
            onClick={() => move(ms(mk.at))}
            className="absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-warning bg-surface-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            style={{ left: `${pct(ms(mk.at))}%` }}
          />
        ))}
      </div>
      <div className="relative h-4 text-[11px] text-text-secondary" aria-hidden="true">
        {ticks.map((v) => <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pct(v)}%` }}>{hhmm.format(new Date(v))}</span>)}
      </div>
      <p id={legendId} className="sr-only">{t.legend}</p>
      <ul className="sr-only">
        {coverage.length === 0 && <li>{t.noFootage}</li>}
        {coverage.map((c) => <li key={`lc${ms(c.from)}`}>{t.coverage}: {when(c.from)} – {when(c.to)}</li>)}
        {gaps.map((g) => <li key={`lg${ms(g.from)}`}>{t.gap}: {when(g.from)} – {when(g.to)}</li>)}
      </ul>
    </div>
  );
}
