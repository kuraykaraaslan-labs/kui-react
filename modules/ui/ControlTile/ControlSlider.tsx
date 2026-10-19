'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { useAsyncControl } from '@/libs/hooks/useAsyncControl';
import { ControlTile, type ControlMessages } from './ControlTile';
import { asNumber, formatValue, snapToStep, toRange } from './control-logic';
import { ControlConfirmPrompt, useControlConfirm, type ControlConfirmation, type ControlConfirmMessages, type ControlConfirmMode } from './ControlConfirm';

/** Slider colours. Any CSS colour or a theme token; unset parts use the theme. */
export type ControlSliderColors = {
  main?: string;
  track?: string;
  disabledMain?: string;
  disabledTrack?: string;
};

/** The pieces a host arranges itself with `renderLayout`. */
export type ControlSliderParts = {
  /** The track with its marks (and mark labels), already oriented. */
  slider: ReactNode;
  /** The shown value (the drag value while dragging), formatted. */
  valueText: string;
  value: number;
  minText: string;
  maxText: string;
  /** A drag (or keyboard change) not yet written. */
  dragging: boolean;
};

export type ControlSliderProps = {
  title?: string;
  /** The control's accessible name when there is no `title` (a host card names it). */
  ariaLabel?: string;
  /** The bound number. */
  value: unknown;
  reported?: unknown;
  /** Written ONCE per gesture (pointer up / keyboard idle / blur), never per step; or after a pause with `commitMode="debounced"`. */
  onCommit: (next: number, confirmation?: ControlConfirmation) => Promise<void>;
  /** Ask before writing: `confirm` asks "Are you sure?"; `typed` also requires `confirmText`. Default `none`. */
  confirm?: ControlConfirmMode;
  /** The text to type when `confirm="typed"`. */
  confirmText?: string;

  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  decimals?: number;
  /** Formats every number shown (value, min, max). Overrides `unit` / `decimals`. */
  format?: (value: number) => string;
  /** Formats the "Reported: {value}" line; default `Reported: ${value}`. */
  reportedLabel?: (value: string) => string;
  /** `default`: slider, then min · value · max. `extended`: large value above, icons at both ends. `compact`: one line. */
  layout?: 'default' | 'extended' | 'compact';
  /** Show the current value. Default `true`. */
  showValue?: boolean;
  /** Inline style (font, colour) of the value. */
  valueStyle?: CSSProperties;
  /** Show the minimum and maximum. Default `true`. */
  showTicks?: boolean;
  /** Draw this many evenly spaced marks under the track (2–21). */
  tickMarks?: number;
  /** Print the value under each mark. */
  tickLabels?: boolean;
  /** `vertical` puts the minimum at the bottom; give the slider a height. Default `horizontal`. */
  orientation?: 'horizontal' | 'vertical';
  /** Track thickness in px (2–16). Default 6. */
  thickness?: number;
  /** Thumb diameter in px (8–32). Default 18. */
  thumbSize?: number;
  /** Arrange the parts yourself (value, min/max, icons) instead of `layout`. */
  renderLayout?: (parts: ControlSliderParts) => ReactNode;
  colors?: ControlSliderColors;
  /** Icons at the start and end of the track (layout `extended`). */
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  /** `release` (default): once per gesture. `debounced`: also while dragging, after `debounceMs` without movement. */
  commitMode?: 'release' | 'debounced';
  debounceMs?: number;
  readOnly?: boolean;
  disabled?: boolean;
  /** Why it is disabled; shown in a tooltip. Implies `disabled`. */
  disabledReason?: string;
  /** Draw the tile frame. Default `true`. */
  framed?: boolean;
  timeoutMs?: number;
  messages?: Partial<ControlMessages & ControlConfirmMessages>;
  className?: string;
};

const clampPx = (v: number | undefined, lo: number, hi: number, dflt: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

const COMMIT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const KEY_IDLE_MS = 400;

/** One gesture commits exactly once: pointer up, keyboard idle, blur, or (debounced) a pause. */
function useGestureCommit(onCommit: (v: number) => void) {
  const latest = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(onCommit);
  useEffect(() => { cb.current = onCommit; });
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const flush = useCallback(() => {
    clear();
    const v = latest.current;
    latest.current = null;
    if (v !== null) cb.current(v);
  }, []);
  const track = (v: number) => { latest.current = v; };
  const later = (ms: number) => { clear(); timer.current = setTimeout(flush, ms); };
  return { track, flush, later };
}

/** ControlSlider — drag moves only the local value; the write happens on release; failure restores the bound value. */
export function ControlSlider({
  title, ariaLabel, value, reported, onCommit, min, max, step, unit, decimals = 0, format, reportedLabel = (v) => `Reported: ${v}`,
  layout = 'default', showValue = true, valueStyle, showTicks = true, tickMarks, tickLabels = false, colors, startIcon, endIcon,
  orientation = 'horizontal', thickness, thumbSize, renderLayout,
  commitMode = 'release', debounceMs = 500,
  readOnly = false, disabled = false, disabledReason, framed = true, timeoutMs, messages, className,
  confirm = 'none', confirmText,
}: ControlSliderProps) {
  const range = toRange({ min, max, step });
  const bound = asNumber(value);
  const rep = reported === undefined ? undefined : asNumber(reported);
  const ask = useControlConfirm<number>(confirm);
  const ctl = useAsyncControl<number>({ value: bound, reported: rep, commit: (v) => (ask.confirmation.current ? onCommit(v, ask.confirmation.current) : onCommit(v)), timeoutMs });
  const write = (r: { value: number } | undefined) => { if (r) { setDraft(null); ctl.set(r.value); } };
  // The local drag value; it is dropped once the bound value changes underneath it.
  const [dragged, setDraft] = useState<{ v: number; base: number | null } | null>(null);
  const draft = dragged && dragged.base === bound ? dragged.v : null;
  const shown = draft ?? ctl.displayValue ?? range.min;
  const fmt = format ?? ((n: number) => `${formatValue(n, decimals)}${unit ? ` ${unit}` : ''}`);
  // No value yet reads "—": the thumb has to sit somewhere (the minimum), the text must not claim it.
  const text = draft === null && ctl.displayValue == null ? '—' : fmt(shown);
  const locked = disabled || readOnly || !!disabledReason;
  const pending = ctl.state === 'pending';

  // Without confirmation the draft is dropped as the write starts; with it, the draft stays until accepted or cancelled.
  const gesture = useGestureCommit((v) => write(ask.request(v)));

  const pct = ((shown - range.min) / (range.max - range.min)) * 100;
  const vertical = orientation === 'vertical';
  const main = (locked ? colors?.disabledMain : undefined) ?? colors?.main ?? 'var(--primary)';
  const track = (locked ? colors?.disabledTrack : undefined) ?? colors?.track ?? 'var(--surface-sunken)';
  const thick = clampPx(thickness, 2, 16, 6);
  const thumb = clampPx(thumbSize, 8, 32, 18);
  const inputStyle = {
    backgroundImage: `linear-gradient(to ${vertical ? 'top' : 'right'}, ${main} ${pct}%, ${track} ${pct}%)`,
    '--kui-slider-thumb': main,
    '--kui-slider-thumb-size': `${thumb}px`,
    ...(vertical
      ? { writingMode: 'vertical-lr', direction: 'rtl', width: thick, height: '100%' }
      : { height: thick, width: '100%' }),
  } as Record<string, string | number> as CSSProperties;
  const marks = typeof tickMarks === 'number' && tickMarks >= 2 ? Math.min(21, Math.floor(tickMarks)) : 0;
  const markValue = (i: number) => snapToStep(range.min + ((range.max - range.min) * i) / (marks - 1), { ...range, step: range.step / 100 });

  const input = (
    <input
      type="range"
      aria-label={ariaLabel || title || 'Value'}
      aria-valuetext={text}
      aria-orientation={vertical ? 'vertical' : undefined}
      aria-busy={pending || undefined}
      min={range.min}
      max={range.max}
      step={range.step}
      value={shown}
      disabled={locked || pending || !!ask.asking}
      onChange={(e) => {
        const v = snapToStep(Number(e.target.value), range);
        setDraft({ v, base: bound });
        gesture.track(v);
        if (commitMode === 'debounced') gesture.later(Math.max(100, debounceMs));
      }}
      onPointerUp={gesture.flush}
      onKeyUp={(e) => { if (COMMIT_KEYS.has(e.key)) gesture.later(commitMode === 'debounced' ? Math.max(100, debounceMs) : KEY_IDLE_MS); }}
      onBlur={gesture.flush}
      style={inputStyle}
      className={cn(
        'm-0 cursor-pointer appearance-none rounded-full',
        '[&::-webkit-slider-thumb]:h-[var(--kui-slider-thumb-size)] [&::-webkit-slider-thumb]:w-[var(--kui-slider-thumb-size)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-base [&::-webkit-slider-thumb]:bg-[var(--kui-slider-thumb)] [&::-webkit-slider-thumb]:shadow',
        '[&::-moz-range-thumb]:h-[var(--kui-slider-thumb-size)] [&::-moz-range-thumb]:w-[var(--kui-slider-thumb-size)] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface-base [&::-moz-range-thumb]:bg-[var(--kui-slider-thumb)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'disabled:cursor-not-allowed',
        locked && !colors?.disabledMain && 'disabled:opacity-50',
      )}
    />
  );
  // Marks sit under the thumb centres: the travel is inset by half a thumb at both ends.
  const inset = thumb / 2;
  const markRow = marks > 0 ? (
    <div aria-hidden="true" className={cn('relative shrink-0', vertical ? 'h-full' : 'w-full', tickLabels ? (vertical ? 'w-10' : 'h-5') : (vertical ? 'w-2' : 'h-2'))}
      style={vertical ? { marginBlock: 0 } : undefined}>
      {Array.from({ length: marks }, (_, i) => {
        const at = `calc(${inset}px + (100% - ${thumb}px) * ${i / (marks - 1)})`;
        return (
          <span key={i} className={cn('absolute flex items-center gap-1', vertical ? 'left-0 translate-y-1/2 flex-row' : 'top-0 -translate-x-1/2 flex-col')}
            style={vertical ? { bottom: at } : { left: at }}>
            <span className={cn('bg-border-strong', vertical ? 'h-px w-1.5' : 'h-1.5 w-px')} />
            {tickLabels && <span className="whitespace-nowrap text-[11px] leading-none tabular-nums text-text-secondary">{fmt(markValue(i))}</span>}
          </span>
        );
      })}
    </div>
  ) : null;
  const slider = vertical ? (
    <div className="flex h-full min-h-0 items-stretch justify-center gap-1.5">
      <div className="flex h-full w-9 items-center justify-center">{input}</div>
      {markRow}
    </div>
  ) : (
    <div className="min-w-0 flex-1">
      <div className="flex h-9 items-center">{input}</div>
      {markRow}
    </div>
  );
  const valueEl = showValue ? (
    <span className="font-semibold tabular-nums text-text-primary" aria-live="off" style={valueStyle}>{text}</span>
  ) : null;

  return (
    <ControlTile
      title={title}
      state={ctl.state}
      error={ctl.error}
      readOnly={readOnly}
      onRetry={ctl.retry}
      messages={messages}
      framed={framed}
      disabledReason={disabledReason}
      reportedText={bound !== null && draft !== null && draft !== bound ? reportedLabel(fmt(bound)) : undefined}
      className={className}
    >
      {renderLayout ? renderLayout({
        slider, valueText: text, value: shown, minText: fmt(range.min), maxText: fmt(range.max), dragging: draft !== null,
      }) : layout === 'compact' ? (
        <div className="flex items-center gap-3">
          {slider}
          {valueEl && <span className="shrink-0 text-sm">{valueEl}</span>}
        </div>
      ) : layout === 'extended' ? (
        <div className="space-y-2">
          {valueEl && <div className="text-center text-2xl">{valueEl}</div>}
          <div className="flex items-center gap-3">
            {startIcon && <span aria-hidden="true" className="inline-flex shrink-0 items-center">{startIcon}</span>}
            {slider}
            {endIcon && <span aria-hidden="true" className="inline-flex shrink-0 items-center">{endIcon}</span>}
          </div>
          {showTicks && (
            <div className="flex justify-between text-xs tabular-nums text-text-secondary"><span>{fmt(range.min)}</span><span>{fmt(range.max)}</span></div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {slider}
          {(showTicks || valueEl) && (
            <div className="flex justify-between text-xs tabular-nums text-text-secondary">
              <span>{showTicks ? fmt(range.min) : null}</span>
              {valueEl}
              <span>{showTicks ? fmt(range.max) : null}</span>
            </div>
          )}
        </div>
      )}
      {ask.asking && confirm !== 'none' && (
        <ControlConfirmPrompt
          mode={confirm}
          confirmText={confirmText}
          onConfirm={(typed) => write(ask.accept(typed))}
          onCancel={() => { ask.cancel(); setDraft(null); }}
          messages={messages}
        />
      )}
    </ControlTile>
  );
}
