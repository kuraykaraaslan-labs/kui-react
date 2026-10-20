// The pure logic of control.switch (no React): the bound value as on / off / unknown, the look of each state (colour,
// icon, tile) and the layout choices, the switch's labels and colours, the confirmation policy and why it may be
// disabled. `ControlSwitchView.tsx` draws it; kui-ejs and KUInative vendor this file. The toggle itself is interactive:
// it sends `{ kind: 'set', value: <boolean> }` and the host answers `onControl`.

import { asBoolean } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor } from '../settings/style';
import { confirmProps, controlBlockReasonOf, controlMessages, textOr, type ControlHost, type FeedbackSettings } from './control-common';

export type SwitchSettings = FeedbackSettings & {
  layout?: 'right' | 'left' | 'centered';
  size?: 'auto' | 'sm' | 'md' | 'lg';
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  stateDisplay?: 'text' | 'pill' | 'none';
  onLabel?: string;
  offLabel?: string;
  unknownLabel?: string;
  stateFont?: FontValue;
  onTextColor?: string;
  offTextColor?: string;
  unknownTextColor?: string;
  onIcon?: string;
  offIcon?: string;
  unknownIcon?: string;
  onColor?: string;
  offColor?: string;
  disabledColor?: string;
  thumbColor?: string;
  thumbOffColor?: string;
  thumbDisabledColor?: string;
  onMatch?: string;
  disableWhen?: string[];
};

export type SwitchState = 'on' | 'off' | 'unknown';

/**
 * The bound value as on / off / unknown. With `onMatch` set, only that exact value means on and any
 * other present value means off; without it, the usual spellings (true, 1, on, yes …) are read.
 */
export function switchState(value: unknown, onMatch?: string): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof onMatch === 'string' && onMatch.trim() !== '') {
    if (typeof value === 'object') return null;
    return String(value).trim() === onMatch.trim();
  }
  return asBoolean(value);
}

/** The state's name. */
export const switchStateName = (state: boolean | null): SwitchState => (state === true ? 'on' : state === false ? 'off' : 'unknown');

/**
 * Everything control.switch draws. `states` holds the look of each of the three states (the switch draws the one it is
 * in, and the parts of every state are decided here): the text colour, the icon of the state, the head's icon tile and
 * whether / how big the state text is. The switch's own track and thumb take `colors`; the state texts `labels`.
 */
export function controlSwitchModel(s: SwitchSettings, value: unknown, host: ControlHost) {
  const state = switchState(value, s.onMatch);
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 20;
  const layout = s.layout === 'left' || s.layout === 'centered' ? s.layout : 'right';
  const display = s.stateDisplay === 'pill' || s.stateDisplay === 'none' ? s.stateDisplay : 'text';
  const size = s.size === 'sm' || s.size === 'md' || s.size === 'lg' ? s.size : layout === 'centered' ? 'lg' : 'md';
  const onColor = cssColor(s.onColor) ?? 'var(--success)';
  const { messages: policyMessages, ...confirm } = confirmProps(host.confirm);
  const m = host.messages;
  const stateLook = (name: SwitchState) => {
    const stateIcon = name === 'on' ? s.onIcon : name === 'off' ? s.offIcon : s.unknownIcon;
    const color = name === 'on' ? cssColor(s.onTextColor) ?? onColor
      : name === 'off' ? cssColor(s.offTextColor) ?? 'var(--text-secondary)'
        : cssColor(s.unknownTextColor) ?? 'var(--warning)';
    const iconName = stateIcon || s.icon;
    return {
      color,
      /** The state's own icon (shown in the pill). */
      stateIcon: stateIcon || undefined,
      /** The head's icon tile: the state's icon, else the widget's; it takes the state colour unless `iconColor` is set. */
      tile: iconName ? {
        name: iconName,
        size: Math.round(iconSize * (layout === 'centered' ? 1.4 : 1.8)),
        color: stateIcon && !cssColor(s.iconColor) ? color : s.iconColor,
      } : null,
      /** The state's text is drawn unless `stateDisplay` is none (an unknown state is always named). */
      showState: display !== 'none' || name === 'unknown',
      /** The text's metric size. */
      stateSize: name === 'unknown' || layout === 'centered' ? 'md' as const : 'lg' as const,
    };
  };
  return {
    request: { kind: 'set' as const, valueType: 'boolean' as const },
    state: switchStateName(state),
    layout, display, size,
    label: { text: textOr(s.label), font: s.labelFont, color: s.labelColor },
    stateFont: s.stateFont,
    states: { on: stateLook('on'), off: stateLook('off'), unknown: stateLook('unknown') },
    /** The switch's accessible name (the visible label is drawn by the layout). */
    ariaLabel: textOr(s.label) ?? textOr(host.title),
    labels: { on: textOr(s.onLabel) ?? m.on, off: textOr(s.offLabel) ?? m.off, unknown: textOr(s.unknownLabel) ?? m.unknownLabel },
    colors: {
      on: onColor, off: cssColor(s.offColor), disabled: cssColor(s.disabledColor),
      thumb: cssColor(s.thumbColor), thumbOff: cssColor(s.thumbOffColor), thumbDisabled: cssColor(s.thumbDisabledColor),
    },
    confirm,
    messages: controlMessages(s, policyMessages, m),
    disabledReason: controlBlockReasonOf(host, s.disableWhen, state === null, m),
  };
}
