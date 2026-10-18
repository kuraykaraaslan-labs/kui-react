'use client';
import type { CSSProperties } from 'react';
import { cn } from '@/libs/utils/cn';
import { ControlButton } from '@/modules/ui/ControlTile';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle } from '../settings/style';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { confirmProps, controlBlockReason, controlMessages, requestControl, textOr, type FeedbackSettings } from './control-common';
import { MetricLabel, tint } from './ui';

type S = FeedbackSettings & {
  layout?: 'button' | 'tile' | 'icon' | 'fab';
  label?: string;
  labelFont?: FontValue;
  icon?: string;
  iconSize?: number;
  iconPosition?: 'start' | 'end';
  description?: string;
  descriptionFont?: FontValue;
  descriptionColor?: string;
  appearance?: 'filled' | 'outlined' | 'ghost' | 'underlined';
  mainColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: number | null;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  align?: 'start' | 'center' | 'end';
  hoverColor?: string;
  hoverTextColor?: string;
  disabledColor?: string;
  disabledTextColor?: string;
};

const VARIANT = { filled: 'primary', outlined: 'outline', ghost: 'ghost', underlined: 'ghost' } as const;
const LAYOUTS = new Set(['button', 'tile', 'icon', 'fab']);
const SIZES = new Set(['sm', 'md', 'lg']);
const ALIGNS = new Set(['start', 'center', 'end']);

/**
 * The button's look from its appearance and colours, per state. Colours from settings reach the DOM
 * only as CSS variables (checked by `cssColor`); the state classes read them, so hover and disabled
 * colours work without script. Unset colours keep the Button's own theme classes.
 */
export function buttonLookOf(s: S): { style: CSSProperties; className: string } {
  const appearance = s.appearance && VARIANT[s.appearance] ? s.appearance : 'filled';
  const main = cssColor(s.mainColor);
  const text = cssColor(s.textColor);
  const bg = cssColor(s.backgroundColor);
  const hover = cssColor(s.hoverColor);
  const hoverText = cssColor(s.hoverTextColor);
  const disabled = cssColor(s.disabledColor);
  const disabledText = cssColor(s.disabledTextColor);
  const vars: Record<string, string> = {};
  const cls: string[] = [];
  const set = (name: string, value: string | undefined, ...classes: string[]) => {
    if (!value) return;
    vars[name] = value;
    cls.push(...classes);
  };
  if (appearance === 'filled') {
    const fill = bg ?? main;
    set('--kb-bg', fill, 'bg-[color:var(--kb-bg)]', 'border-[color:var(--kb-bg)]');
    set('--kb-fg', text, 'text-[color:var(--kb-fg)]');
    // A shade of the fill towards the text colour: darker in light themes, lighter in dark ones.
    set('--kb-hover-bg', hover ?? (fill ? `color-mix(in srgb, ${fill} 85%, var(--text-primary))` : undefined), 'hover:bg-[color:var(--kb-hover-bg)]');
  } else {
    const fg = text ?? main;
    set('--kb-fg', fg, 'text-[color:var(--kb-fg)]');
    set('--kb-bg', bg, 'bg-[color:var(--kb-bg)]');
    if (appearance === 'outlined') set('--kb-border', main, 'border-[color:var(--kb-border)]');
    set('--kb-hover-bg', hover ?? tint(fg, 10), 'hover:bg-[color:var(--kb-hover-bg)]');
  }
  set('--kb-hover-fg', hoverText, 'hover:text-[color:var(--kb-hover-fg)]');
  set('--kb-dis-bg', disabled, 'disabled:bg-[color:var(--kb-dis-bg)]', 'disabled:border-[color:var(--kb-dis-bg)]', 'disabled:opacity-100');
  set('--kb-dis-fg', disabledText, 'disabled:text-[color:var(--kb-dis-fg)]', 'disabled:opacity-100');
  if (appearance === 'underlined') cls.push('underline underline-offset-4');
  const style: CSSProperties = { ...(vars as CSSProperties), ...fontStyle(s.labelFont) };
  if (typeof s.borderRadius === 'number') style.borderRadius = s.borderRadius;
  return { style, className: cn(cls) };
}

/** `control.button`: one press asks the host to run the placement's command. With `pressed` it is a toggle. */
export function ControlButtonView(props: WidgetViewProps) {
  const s = props.settings as S;
  const appearance = s.appearance && VARIANT[s.appearance] ? s.appearance : 'filled';
  const layout = s.layout && LAYOUTS.has(s.layout) ? s.layout : 'button';
  const size = s.size && SIZES.has(s.size) ? s.size : 'md';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const shown = layout === 'tile' ? Math.max(iconSize, 28) : layout === 'icon' ? Math.max(iconSize, size === 'lg' ? 28 : size === 'sm' ? 16 : 22) : iconSize;
  const icon = s.icon ? <SettingIcon name={s.icon} style={{ width: shown, height: shown, fontSize: shown }} /> : undefined;
  const m = useKitMessages().controls;
  const run = requestControl(props.onControl, 'run', m);
  const look = buttonLookOf(s);
  const { messages: policyMessages, ...confirm } = confirmProps(props.confirm);
  const description = textOr(s.description);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {description && <MetricLabel font={s.descriptionFont} color={s.descriptionColor}>{description}</MetricLabel>}
      <ControlButton
        framed={false}
        className="min-h-0 flex-1"
        layout={layout}
        label={textOr(s.label)}
        icon={icon}
        iconPosition={s.iconPosition === 'end' ? 'end' : 'start'}
        variant={VARIANT[appearance]}
        size={size}
        fullWidth={layout === 'button' && s.fullWidth !== false}
        bodyAlign={description && (layout === 'button' || layout === 'fab') ? 'end' : 'center'}
        align={s.align && ALIGNS.has(s.align) ? s.align : 'center'}
        buttonStyle={look.style}
        buttonClassName={look.className}
        disabledReason={controlBlockReason(props, [], false, m)}
        pressed={typeof props.pressed === 'boolean' ? props.pressed : undefined}
        {...confirm}
        messages={controlMessages(s, policyMessages, m)}
        onCommit={(confirmation) => run(undefined, confirmation)}
      />
    </div>
  );
}

export const CONTROL_BUTTON_VIEW: WidgetKindView = { View: ControlButtonView, isEmpty: () => false };
