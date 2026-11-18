'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '../Button';
import { useAsyncControl } from '@/libs/hooks/useAsyncControl';
import { ControlTile, type ControlMessages } from './ControlTile';
import { asNumber, formatValue, snapToStep, toRange, validateSetpoint } from './control-logic';
import { ControlConfirmPrompt, useControlConfirm, type ControlConfirmation, type ControlConfirmMessages, type ControlConfirmMode } from './ControlConfirm';

export type ControlSetpointMessages = {
  apply: string;
  enterNumber: string;
  /** `{min}` and `{max}` are replaced. */
  outOfRange: string;
  /** `{value}` is replaced. */
  current: string;
  /** Stepper buttons' accessible names. */
  decrease: string;
  increase: string;
};

export type ControlSetpointProps = {
  title?: string;
  /** The control's accessible name when there is no `title` (a host card names it). */
  ariaLabel?: string;
  value: unknown;
  reported?: unknown;
  /** Written when the user presses Apply (or Enter) with a valid number, or presses a stepper button. */
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
  /** Formats the numbers shown (current value, stepper value). Overrides `unit` / `decimals`. */
  format?: (value: number) => string;
  /**
   * `input` (default): type a number and apply. `stepper`: minus / plus buttons; presses in a row move the value at once and are
   * written as one, `settleMs` after the last (a device takes one command for five presses, not five).
   * `dial`: the stepper around an arc showing where the value sits between min and max.
   */
  layout?: 'input' | 'stepper' | 'dial';
  /** Stepper and dial: how long after the last press the value is written (ms, default 700; 0 writes every press). */
  settleMs?: number;
  /** Renders the stepper / dial number (default: the formatted text in `valueStyle`). */
  renderValue?: (text: string, value: number | null) => ReactNode;
  /** Text colour of the Apply / stepper buttons. */
  buttonTextColor?: string;
  /** Arc colours of the `dial` (default: `buttonColor`, then the theme). */
  dialColor?: string;
  dialTrackColor?: string;
  /** Show the current (bound) value. Default `true`. */
  showValue?: boolean;
  /** Inline style (font, colour) of the value text (the input, or the stepper's number). */
  valueStyle?: CSSProperties;
  /** Fill of the Apply / stepper buttons. Any CSS colour or a theme token. */
  buttonColor?: string;
  /** Border of the input / stepper box. */
  borderColor?: string;
  readOnly?: boolean;
  disabled?: boolean;
  /** Why it is disabled; shown in a tooltip. Implies `disabled`. */
  disabledReason?: string;
  /** Draw the tile frame. Default `true`. */
  framed?: boolean;
  timeoutMs?: number;
  messages?: Partial<ControlMessages & ControlSetpointMessages & ControlConfirmMessages>;
  className?: string;
};

/** A 270° arc with the value's share of the range filled, and the value in its middle. Decorative. */
function Dial({ fraction, color, track, children }: { fraction: number | null; color?: string; track?: string; children: ReactNode }) {
  const r = 42;
  const len = 2 * Math.PI * r * 0.75;
  const f = fraction === null ? 0 : Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative aspect-square h-full max-h-32 min-h-14 w-auto">
      <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full rotate-[135deg]">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${len} 999`} style={{ stroke: track ?? 'var(--surface-sunken)' }} />
        {fraction !== null && (
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${len * f} 999`} style={{ stroke: color ?? 'var(--primary)', transition: 'stroke-dasharray 200ms' }} />
        )}
      </svg>
      {/* A size container, so the value can scale with the dial (`cqi` units). */}
      <div className="absolute inset-0 flex items-center justify-center [container-type:size]">{children}</div>
    </div>
  );
}

const DEFAULTS: ControlSetpointMessages = {
  apply: 'Apply',
  enterNumber: 'Enter a number.',
  outOfRange: 'Enter a value between {min} and {max}.',
  current: 'Current: {value}',
  decrease: 'Decrease',
  increase: 'Increase',
};

/** How long a stepper waits after the last press before it writes the value (ms). */
export const STEP_SETTLE_MS = 700;

/** ControlSetpoint — type a number, press Apply or Enter (or step it). A bad entry is a field error and sends nothing. */
export function ControlSetpoint({
  title, ariaLabel, value, reported, onCommit, min, max, step, unit, decimals = 0, format, layout = 'input', showValue = true,
  valueStyle, buttonColor, buttonTextColor, borderColor, renderValue, dialColor, dialTrackColor, readOnly = false, disabled = false, disabledReason, framed = true, timeoutMs, messages, className,
  confirm = 'none', confirmText, settleMs = STEP_SETTLE_MS,
}: ControlSetpointProps) {
  const id = useId();
  const m = { ...DEFAULTS, ...messages };
  const range = toRange({ min, max, step });
  const bound = asNumber(value);
  const rep = reported === undefined ? undefined : asNumber(reported);
  const ask = useControlConfirm<number>(confirm);
  const ctl = useAsyncControl<number>({ value: bound, reported: rep, commit: (v) => (ask.confirmation.current ? onCommit(v, ask.confirmation.current) : onCommit(v)), timeoutMs });
  const write = (r: { value: number } | undefined) => { if (r) { ctl.set(r.value); } };
  const [text, setText] = useState(bound !== null ? String(bound) : '');
  const [prevBound, setPrevBound] = useState(bound);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // A new bound value replaces the typed text (adjusting state during render, not in an effect).
  if (bound !== prevBound) {
    setPrevBound(bound);
    if (bound !== null) setText(String(bound));
  }
  const fmt = format ?? ((n: number) => `${formatValue(n, decimals)}${unit ? ` ${unit}` : ''}`);
  const errId = `${id}-error`;
  const pending = ctl.state === 'pending';
  const locked = disabled || readOnly || !!disabledReason || pending || !!ask.asking;
  const buttonStyle: CSSProperties | undefined = buttonColor || buttonTextColor
    ? { ...(buttonColor ? { background: buttonColor, borderColor: buttonColor } : {}), ...(buttonTextColor ? { color: buttonTextColor } : {}) }
    : undefined;
  const boxStyle: CSSProperties | undefined = borderColor ? { borderColor } : undefined;

  const apply = () => {
    const checked = validateSetpoint(text, range);
    if (!checked.ok) {
      setFieldError(checked.reason === 'range'
        ? m.outOfRange.replace('{min}', String(range.min)).replace('{max}', String(range.max))
        : m.enterNumber);
      return;
    }
    setFieldError(null);
    write(ask.request(checked.value));
  };

  // Presses in a row move a draft at once; the draft is written once they settle (one command, not one per press).
  const [draft, setDraft] = useState<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);
  const current = draft ?? ctl.displayValue ?? bound;
  const stepBy = (dir: -1 | 1) => {
    const base = current ?? range.min;
    const next = snapToStep(base + dir * range.step, range);
    if (settleMs <= 0) { write(ask.request(next)); return; }
    setDraft(next);
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      settle.current = null;
      setDraft(null);
      write(ask.request(next));
    }, settleMs);
  };

  const currentLine = showValue && bound !== null && (layout === 'input' || (current !== null && current !== bound)) ? (
    <p className="text-xs text-text-secondary">{m.current.replace('{value}', fmt(bound))}</p>
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
      className={className}
    >
      {layout === 'stepper' || layout === 'dial' ? (
        <div className={cn('space-y-1', layout === 'dial' && 'flex min-h-0 flex-1 flex-col')}>
          <div className={cn('flex items-center gap-2', layout === 'dial' && 'min-h-0 flex-1 justify-center gap-3')} role="group" aria-label={ariaLabel || title || 'Set point'}>
            <Button
              iconOnly
              aria-label={m.decrease}
              onClick={() => stepBy(-1)}
              disabled={locked || (current !== null && current <= range.min)}
              style={buttonStyle}
              className="h-9 w-9 shrink-0 text-lg leading-none"
            >
              −
            </Button>
            {layout === 'stepper' ? (
              <output
                aria-live="polite"
                className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-md border border-border bg-surface-base px-2 text-base font-semibold tabular-nums text-text-primary"
                style={{ ...boxStyle, ...valueStyle }}
              >
                {renderValue ? renderValue(current !== null ? fmt(current) : '—', current) : current !== null ? fmt(current) : '—'}
              </output>
            ) : (
              <Dial
                fraction={current === null ? null : (current - range.min) / (range.max - range.min)}
                color={dialColor ?? buttonColor}
                track={dialTrackColor}
              >
                <output aria-live="polite" className="font-semibold tabular-nums text-text-primary" style={valueStyle}>
                  {renderValue ? renderValue(current !== null ? fmt(current) : '—', current) : current !== null ? fmt(current) : '—'}
                </output>
              </Dial>
            )}
            <Button
              iconOnly
              aria-label={m.increase}
              onClick={() => stepBy(1)}
              disabled={locked || (current !== null && current >= range.max)}
              style={buttonStyle}
              className="h-9 w-9 shrink-0 text-lg leading-none"
            >
              +
            </Button>
          </div>
          {currentLine}
        </div>
      ) : (
        <form className="space-y-1" noValidate onSubmit={(e) => { e.preventDefault(); apply(); }}>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              aria-label={ariaLabel || title || 'Set point'}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? errId : undefined}
              value={text}
              disabled={locked}
              onChange={(e) => { setText(e.target.value); setFieldError(null); }}
              style={{ ...boxStyle, ...valueStyle }}
              className={cn(
                'h-9 w-28 min-w-0 flex-1 rounded-md border border-border bg-surface-base px-2 text-sm tabular-nums text-text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            {unit && <span className="text-sm text-text-secondary">{unit}</span>}
            <Button type="submit" disabled={locked} loading={pending} style={buttonStyle} className="h-9 shrink-0">{m.apply}</Button>
          </div>
          {currentLine}
          {fieldError && <p id={errId} role="alert" className="text-xs text-error">{fieldError}</p>}
        </form>
      )}
      {ask.asking && confirm !== 'none' && (
        <ControlConfirmPrompt mode={confirm} confirmText={confirmText} value={format && unit ? `${format(ask.asking.value)} ${unit}` : fmt(ask.asking.value)}
          onConfirm={(typed) => write(ask.accept(typed))} onCancel={ask.cancel} messages={messages} />
      )}
    </ControlTile>
  );
}
