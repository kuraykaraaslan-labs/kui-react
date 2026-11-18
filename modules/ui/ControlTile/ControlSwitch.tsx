'use client';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { useAsyncControl } from '@/libs/hooks/useAsyncControl';
import { ControlTile, type ControlMessages } from './ControlTile';
import { asBoolean } from './control-logic';
import { ControlConfirmPrompt, useControlConfirm, type ControlConfirmation, type ControlConfirmMessages, type ControlConfirmMode } from './ControlConfirm';

/** Switch colours. Any CSS colour or a theme token; unset parts use the theme (primary on, sunken off). */
export type ControlSwitchColors = {
  on?: string;
  off?: string;
  disabled?: string;
  /** The knob in every state, unless a per-state colour below is set. */
  thumb?: string;
  thumbOn?: string;
  thumbOff?: string;
  thumbDisabled?: string;
};

/** The pieces a host arranges itself with `renderLayout`. */
export type ControlSwitchParts = {
  /** The switch itself (the labelled checkbox and its track). */
  control: ReactNode;
  state: 'on' | 'off' | 'unknown';
  /** The on / off / unknown text for the shown state. */
  stateText: string;
  /** Put this id on the element showing the state: the switch is described by it. */
  stateId: string;
  pending: boolean;
  locked: boolean;
};

export type ControlSwitchProps = {
  title?: string;
  /** The bound state. Anything `asBoolean` cannot read is "unknown" and shows off. */
  value: unknown;
  /** The state the other side reports, if it reports one; "pending" lasts until it matches. */
  reported?: unknown;
  /** The write. Reject to fail and roll the thumb back. With `confirm`, the second argument carries the confirmation. */
  onCommit: (next: boolean, confirmation?: ControlConfirmation) => Promise<void>;
  /** Ask before writing: `confirm` asks "Are you sure?"; `typed` also requires `confirmText`. Default `none`. */
  confirm?: ControlConfirmMode;
  /** The text to type when `confirm="typed"`. */
  confirmText?: string;

  onLabel?: string;
  offLabel?: string;
  unknownLabel?: string;
  /** Text naming what the switch controls, beside it. Without it the on/off text stands alone. */
  label?: string;
  /** Inline style (font, colour) of `label`. */
  labelStyle?: CSSProperties;
  /** An icon before the label. */
  icon?: ReactNode;
  /** `left` (default): switch, then text. `right`: text, switch at the far end. `centered`: stacked, large switch. */
  layout?: 'left' | 'right' | 'centered';
  /** Show the on / off text. Default `true`. The unknown text is always shown. */
  showStateText?: boolean;
  /** Inline styles of the state text per state. */
  stateStyles?: { on?: CSSProperties; off?: CSSProperties; unknown?: CSSProperties };
  colors?: ControlSwitchColors;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Arrange the parts yourself (label, state, icon, switch) instead of `layout`. The status line,
   * the confirmation step and the disabled tooltip stay the control's.
   */
  renderLayout?: (parts: ControlSwitchParts) => ReactNode;
  /** The user may not use the control. */
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

const SIZES = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', on: 'translate-x-3' },
  md: { track: 'h-5 w-9', thumb: 'h-4 w-4', on: 'translate-x-4' },
  lg: { track: 'h-7 w-12', thumb: 'h-6 w-6', on: 'translate-x-5' },
};

/** ControlSwitch — a bound boolean written on toggle; shows the requested value while pending, rolls back on failure. */
export function ControlSwitch({
  title, value, reported, onCommit, onLabel = 'On', offLabel = 'Off', unknownLabel = 'State unknown',
  label, labelStyle, icon, layout = 'left', showStateText = true, stateStyles, colors, size, renderLayout,
  readOnly = false, disabled = false, disabledReason, framed = true, timeoutMs, messages, className,
  confirm = 'none', confirmText,
}: ControlSwitchProps) {
  const id = useId();
  const bound = asBoolean(value);
  const rep = reported === undefined ? undefined : asBoolean(reported);
  const ask = useControlConfirm<boolean>(confirm);
  const ctl = useAsyncControl<boolean>({ value: bound, reported: rep, commit: (v) => (ask.confirmation.current ? onCommit(v, ask.confirmation.current) : onCommit(v)), timeoutMs });
  const write = (r: { value: boolean } | undefined) => { if (r) { ctl.set(r.value); } };
  const known = ctl.displayValue !== null && ctl.displayValue !== undefined;
  const shown = ctl.displayValue ?? false;
  const pending = ctl.state === 'pending';
  const locked = disabled || readOnly || !!disabledReason;
  const hintId = `${id}-hint`;
  const sz = SIZES[size ?? (layout === 'centered' ? 'lg' : 'md')];

  const trackColor = locked ? colors?.disabled : shown ? colors?.on : colors?.off;
  const stateText = !known ? unknownLabel : shown ? onLabel : offLabel;
  const stateStyle = !known ? stateStyles?.unknown : shown ? stateStyles?.on : stateStyles?.off;
  const showState = showStateText || !known || !!renderLayout;
  const thumbColor = (locked ? colors?.thumbDisabled : shown ? colors?.thumbOn : colors?.thumbOff) ?? colors?.thumb;

  const control = (
    <span className="relative inline-flex shrink-0 items-center">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={shown}
        onChange={(e) => write(ask.request(e.target.checked))}
        disabled={locked || pending || !!ask.asking}
        aria-checked={shown}
        aria-busy={pending || undefined}
        aria-invalid={ctl.state === 'mismatch' || undefined}
        aria-label={label || title || undefined}
        aria-describedby={showState ? hintId : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'block rounded-full transition-colors duration-200',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-surface-base',
          sz.track,
          !trackColor && (shown ? 'bg-primary' : 'border border-border bg-surface-sunken'),
          locked && !colors?.disabled && 'opacity-50',
          ctl.state === 'mismatch' && 'ring-2 ring-warning ring-offset-1 ring-offset-surface-base',
        )}
        style={trackColor ? { background: trackColor } : undefined}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full shadow-sm transition-transform duration-200',
          !thumbColor && 'bg-primary-fg',
          sz.thumb,
          shown && sz.on,
        )}
        style={thumbColor ? { background: thumbColor } : undefined}
      >
        {pending && (
          <span
            aria-hidden="true"
            className="absolute inset-0 m-auto h-[70%] w-[70%] animate-spin rounded-full border border-primary border-t-transparent motion-reduce:animate-none"
          />
        )}
      </span>
    </span>
  );

  const iconEl = icon ? <span aria-hidden="true" className="inline-flex shrink-0 items-center">{icon}</span> : null;
  const labelEl = label ? <span className="truncate text-sm font-medium text-text-primary" style={labelStyle}>{label}</span> : null;
  const stateEl = showState ? (
    <span
      id={hintId}
      className={cn(label && layout !== 'centered' ? 'text-xs' : 'text-sm font-medium', !known || label ? 'text-text-secondary' : 'text-text-primary')}
      style={stateStyle}
    >
      {stateText}
    </span>
  ) : null;
  const text = (
    <span className="flex min-w-0 items-center gap-2">
      {iconEl}
      <span className="flex min-w-0 flex-col">{labelEl}{stateEl}</span>
    </span>
  );

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
      {renderLayout ? renderLayout({
        control: (
          <label htmlFor={id} className={cn('inline-flex', locked ? 'cursor-not-allowed' : pending ? 'cursor-progress' : 'cursor-pointer')}>
            {control}
          </label>
        ),
        state: !known ? 'unknown' : shown ? 'on' : 'off',
        stateText,
        stateId: hintId,
        pending,
        locked,
      }) : (
      <label
        htmlFor={id}
        className={cn(
          'flex items-center gap-3',
          layout === 'right' && 'justify-between',
          layout === 'centered' && 'flex-col justify-center gap-2',
          locked ? 'cursor-not-allowed' : pending ? 'cursor-progress' : 'cursor-pointer',
        )}
      >
        {layout === 'right' ? <>{text}{control}</>
          : layout === 'centered' ? <>{iconEl}{labelEl}{control}{stateEl}</>
            : <>{control}{text}</>}
      </label>
      )}
      {ask.asking && confirm !== 'none' && (
        <ControlConfirmPrompt mode={confirm} confirmText={confirmText} value={ask.asking.value ? onLabel : offLabel}
          onConfirm={(typed) => write(ask.accept(typed))} onCancel={ask.cancel} messages={messages} />
      )}
    </ControlTile>
  );
}
