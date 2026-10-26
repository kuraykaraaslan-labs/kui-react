'use client';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '../Button';
import { useAsyncControl } from '@/libs/hooks/useAsyncControl';
import { ControlTile, type ControlMessages } from './ControlTile';
import { ControlConfirmPrompt, DEFAULT_CONFIRM_MESSAGES, type ControlConfirmation, type ControlConfirmMessages } from './ControlConfirm';

export type { ControlConfirmation } from './ControlConfirm';

export type ControlButtonMessages = ControlConfirmMessages & {
  run: string;
};

export type ControlButtonProps = {
  title?: string;
  /** Button caption. Default = messages.run ("Run"). */
  label?: string;
  /** Fires the action. With a confirmation policy the argument carries the user's confirmation. Reject to fail. */
  onCommit: (confirmation?: ControlConfirmation) => Promise<void>;
  /** `confirm` asks "Are you sure?"; `typed` also requires `confirmText` to be typed. Default `none`. */
  confirm?: 'none' | 'confirm' | 'typed';
  /** The text to type when `confirm="typed"`. */
  confirmText?: string;
  readOnly?: boolean;
  disabled?: boolean;
  /** Why it is disabled; shown in a tooltip. Implies `disabled`. */
  disabledReason?: string;
  /**
   * `button` (default): a button. `tile`: a large pressable area with the icon above the label; unframed it fills
   * the height it is given (at least 96 px).
   * `icon`: a round icon button with the label under it. `fab`: a fully rounded, raised button.
   */
  layout?: 'button' | 'tile' | 'icon' | 'fab';
  /** An icon before the label (above it in a tile, alone in the round `icon` button). */
  icon?: ReactNode;
  /** Where the icon sits next to the label (`button` and `fab`). Default `start`. */
  iconPosition?: 'start' | 'end';
  /** Button style. Default `primary`. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  /** Unframed: centre the button in the space (default) or put it at the bottom. */
  bodyAlign?: 'center' | 'end';
  /** Where a button narrower than the space sits. Default `center`. */
  align?: 'start' | 'center' | 'end';
  /** Inline style of the main button (colours from settings data, radius, font). */
  buttonStyle?: CSSProperties;
  buttonClassName?: string;
  /** Draw the tile frame. Default `true`. */
  framed?: boolean;
  /**
   * A toggle-like button's state: `true` is drawn pressed and announced `aria-pressed="true"`, `false`
   * announced `aria-pressed="false"`. Absent (the default) is an ordinary button with no pressed state.
   * The button never flips it itself: the host derives it from the state the press changes.
   */
  pressed?: boolean;
  messages?: Partial<ControlMessages & ControlButtonMessages>;
  className?: string;
};

/** Control heights: 32 / 36 / 44 px (DESIGN.md: controls are 36px by default). */
const HEIGHT = { sm: 'h-8', md: 'h-9', lg: 'h-11' } as const;
/** The round `icon` button's diameter. */
const ROUND = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-[4.5rem] w-[4.5rem]' } as const;

const ALIGN = { start: 'justify-start', center: 'justify-center', end: 'justify-end' } as const;

const DEFAULTS: ControlButtonMessages = { ...DEFAULT_CONFIRM_MESSAGES, run: 'Run' };

/** ControlButton — one press fires `onCommit`; an optional confirm / typed-confirm step comes first. */
export function ControlButton({
  title, label, onCommit, confirm = 'none', confirmText = '', readOnly = false, disabled = false, disabledReason,
  layout = 'button', icon, iconPosition = 'start', align = 'center', bodyAlign, variant = 'primary', size = 'md', fullWidth = false, buttonStyle, buttonClassName,
  framed = true, pressed, messages, className,
}: ControlButtonProps) {
  const m = { ...DEFAULTS, ...messages };
  const [asking, setAsking] = useState(false);
  const ctl = useAsyncControl<ControlConfirmation | undefined>({
    value: undefined,
    commit: (c) => onCommit(c),
    confirmedMs: 2000,
  });
  const pending = ctl.state === 'pending';
  const text = label || m.run;
  const blocked = disabled || readOnly || !!disabledReason || pending;
  const press = () => (confirm === 'none' ? fire() : setAsking(true));

  const fire = (typed?: string) => {
    ctl.set(confirm === 'none' ? undefined : { confirmed: true, ...(confirm === 'typed' ? { typed } : {}) });
    setAsking(false);
  };

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
      bodyAlign={bodyAlign}
      fill={layout === 'tile'}
      reserveStatus={false}
      className={className}
    >
      {!asking ? (
        // Unframed, a tile fills the space it is given (its card); the other layouts keep their size and sit centred.
        <div className={cn('flex', ALIGN[align], layout === 'tile' && !framed && 'min-h-0 flex-1')}>{layout === 'icon' ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={variant}
              iconOnly
              onClick={press}
              disabled={blocked}
              aria-label={text}
              aria-busy={pending || undefined}
              selected={pressed === true}
              aria-pressed={pressed}
              data-pressed={pressed === undefined ? undefined : String(pressed)}
              style={buttonStyle}
              className={cn('rounded-full p-0', ROUND[size], pending && 'animate-pulse motion-reduce:animate-none', buttonClassName)}
            >
              {icon ? <span aria-hidden="true" className="inline-flex items-center">{icon}</span> : text.slice(0, 1)}
            </Button>
            <span aria-hidden="true" className="max-w-full truncate text-sm font-medium text-text-primary">{text}</span>
          </div>
        ) : (
          <Button
            variant={variant}
            size={layout === 'tile' ? 'lg' : size}
            fullWidth={(fullWidth && layout !== 'fab') || layout === 'tile'}
            onClick={press}
            disabled={blocked}
            loading={pending && layout !== 'tile'}
            aria-busy={pending || undefined}
            selected={pressed === true}
            aria-pressed={pressed}
            data-pressed={pressed === undefined ? undefined : String(pressed)}
            iconLeft={layout !== 'tile' && iconPosition !== 'end' ? icon : undefined}
            iconRight={layout !== 'tile' && iconPosition === 'end' ? icon : undefined}
            style={buttonStyle}
            className={cn(
              layout === 'tile' && 'min-h-24 flex-col gap-2 py-4',
              layout === 'button' && HEIGHT[size],
              layout === 'fab' && cn('rounded-full px-6 shadow-md', HEIGHT[size === 'sm' ? 'md' : 'lg']),
              buttonClassName,
            )}
          >
            {layout === 'tile' && icon && <span aria-hidden="true" className="inline-flex items-center">{icon}</span>}
            {text}
          </Button>
        )}</div>
      ) : (
        <ControlConfirmPrompt
          mode={confirm === 'typed' ? 'typed' : 'confirm'}
          confirmText={confirmText}
          onConfirm={fire}
          onCancel={() => setAsking(false)}
          messages={m}
        />
      )}
    </ControlTile>
  );
}
