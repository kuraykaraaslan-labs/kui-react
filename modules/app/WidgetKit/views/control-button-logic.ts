// The pure logic of control.button (no React): the look from the appearance and colours, the layout, the labels, the
// confirmation policy, why it may be disabled and the request a press would send. `ControlButtonView.tsx` draws it;
// kui-ejs and KUInative vendor this file. The press itself is interactive: the host answers `onControl`.

import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import type { StyleRecord } from '../card-logic';
import { cssColor, fontStyle, tint } from '../settings/style';
import { confirmProps, controlBlockReasonOf, controlMessages, textOr, type ControlHost, type FeedbackSettings } from './control-common';

export type ButtonSettings = FeedbackSettings & {
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

/** The appearance as the kui Button's variant. */
export const BUTTON_VARIANT = { filled: 'primary', outlined: 'outline', ghost: 'ghost', underlined: 'ghost' } as const;
const LAYOUTS = new Set(['button', 'tile', 'icon', 'fab']);
const SIZES = new Set(['sm', 'md', 'lg']);
const ALIGNS = new Set(['start', 'center', 'end']);

/**
 * The button's look from its appearance and colours, per state. Colours from settings reach the DOM
 * only as CSS variables (checked by `cssColor`); the state classes read them, so hover and disabled
 * colours work without script. Unset colours keep the Button's own theme classes.
 */
export function buttonLookOf(s: ButtonSettings): { style: StyleRecord; className: string } {
  const appearance = s.appearance && BUTTON_VARIANT[s.appearance] ? s.appearance : 'filled';
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
  const style: StyleRecord = { ...vars, ...fontStyle(s.labelFont) as StyleRecord };
  if (typeof s.borderRadius === 'number') style.borderRadius = s.borderRadius;
  return { style, className: cn(cls) };
}

/** Everything control.button draws, and the request a press sends (`{ kind: 'run' }`, plus a confirmation when asked for). */
export function controlButtonModel(s: ButtonSettings, host: ControlHost) {
  const appearance = s.appearance && BUTTON_VARIANT[s.appearance] ? s.appearance : 'filled';
  const layout = s.layout && LAYOUTS.has(s.layout) ? s.layout : 'button';
  const size = s.size && SIZES.has(s.size) ? s.size : 'md';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const shown = layout === 'tile' ? Math.max(iconSize, 28) : layout === 'icon' ? Math.max(iconSize, size === 'lg' ? 28 : size === 'sm' ? 16 : 22) : iconSize;
  const look = buttonLookOf(s);
  const { messages: policyMessages, ...confirm } = confirmProps(host.confirm);
  const description = textOr(s.description);
  return {
    request: { kind: 'run' as const },
    description: description ? { text: description, font: s.descriptionFont, color: s.descriptionColor } : null,
    button: {
      layout,
      label: textOr(s.label),
      /** The icon's class list / name and its square size in px. */
      icon: s.icon ? { name: s.icon, size: shown } : null,
      iconPosition: s.iconPosition === 'end' ? 'end' as const : 'start' as const,
      variant: BUTTON_VARIANT[appearance],
      size,
      fullWidth: layout === 'button' && s.fullWidth !== false,
      bodyAlign: description && (layout === 'button' || layout === 'fab') ? 'end' as const : 'center' as const,
      align: s.align && ALIGNS.has(s.align) ? s.align : 'center' as const,
      style: look.style,
      className: look.className,
      disabledReason: controlBlockReasonOf(host, [], false, host.messages),
      pressed: typeof host.pressed === 'boolean' ? host.pressed : undefined,
      confirm,
      messages: controlMessages(s, policyMessages, host.messages),
    },
  };
}
