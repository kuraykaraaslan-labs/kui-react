'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { ControlSwitch, type ControlSwitchParts } from '@/modules/ui/ControlTile';
import { asBoolean } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor } from '../settings/style';
import { useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { confirmProps, controlBlockReason, controlMessages, requestControl, textOr, type FeedbackSettings } from './control-common';
import { IconTile, Metric, MetricHead, MetricLabel, Pill } from './ui';

type S = FeedbackSettings & {
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

/** `control.switch`: label and icon on top, the state and the switch below (the value widgets' order). */
export function ControlSwitchView(props: WidgetViewProps) {
  const s = props.settings as S;
  const state = switchState(props.data.value?.value, s.onMatch);
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 20;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const layout = s.layout === 'left' || s.layout === 'centered' ? s.layout : 'right';
  const display = s.stateDisplay === 'pill' || s.stateDisplay === 'none' ? s.stateDisplay : 'text';
  const size = s.size === 'sm' || s.size === 'md' || s.size === 'lg' ? s.size : layout === 'centered' ? 'lg' : 'md';
  const onColor = cssColor(s.onColor) ?? 'var(--success)';
  const { messages: policyMessages, ...confirm } = confirmProps(props.confirm);

  const render = (p: ControlSwitchParts): ReactNode => {
    const stateIcon = p.state === 'on' ? s.onIcon : p.state === 'off' ? s.offIcon : s.unknownIcon;
    const color = p.state === 'on' ? cssColor(s.onTextColor) ?? onColor
      : p.state === 'off' ? cssColor(s.offTextColor) ?? 'var(--text-secondary)'
        : cssColor(s.unknownTextColor) ?? 'var(--warning)';
    const iconName = stateIcon || s.icon;
    const icon = iconName ? (
      <IconTile name={iconName} size={Math.round(iconSize * (layout === 'centered' ? 1.4 : 1.8))} color={stateIcon && !cssColor(s.iconColor) ? color : s.iconColor} />
    ) : null;
    const label = <MetricLabel font={s.labelFont} color={s.labelColor}>{textOr(s.label)}</MetricLabel>;
    const showState = display !== 'none' || p.state === 'unknown';
    const stateEl = !showState ? null : display === 'pill' ? (
      <span id={p.stateId} className="min-w-0"><Pill label={p.stateText} color={color} icon={stateIcon || undefined} /></span>
    ) : (
      <span id={p.stateId} className="min-w-0 truncate">
        <Metric text={p.stateText} size={p.state === 'unknown' || layout === 'centered' ? 'md' : 'lg'} font={s.stateFont} color={color} />
      </span>
    );
    if (layout === 'centered') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 text-center [&>*]:shrink-0">
          {(icon || textOr(s.label)) && <div className="flex max-w-full items-center gap-2">{icon}{label}</div>}
          {p.control}{stateEl}
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <MetricHead label={label} icon={icon} />
        <div className={cn('mt-auto flex min-h-9 items-center gap-3', layout === 'right' ? 'justify-between' : 'justify-start')}>
          {layout === 'right' ? <>{stateEl ?? <span />}{p.control}</> : <>{p.control}{stateEl}</>}
        </div>
      </div>
    );
  };

  return (
    <ControlSwitch
      framed={false}
      value={state}
      {...confirm}
      messages={controlMessages(s, policyMessages, m)}
      onCommit={(next, confirmation) => set(next, confirmation)}
      // The switch's accessible name (the parts above draw the visible label).
      label={textOr(s.label) ?? textOr(props.title)}
      onLabel={textOr(s.onLabel) ?? m.on}
      offLabel={textOr(s.offLabel) ?? m.off}
      unknownLabel={textOr(s.unknownLabel) ?? m.unknownLabel}
      size={size}
      renderLayout={render}
      colors={{
        on: onColor, off: cssColor(s.offColor), disabled: cssColor(s.disabledColor),
        thumb: cssColor(s.thumbColor), thumbOff: cssColor(s.thumbOffColor), thumbDisabled: cssColor(s.thumbDisabledColor),
      }}
      disabledReason={controlBlockReason(props, s.disableWhen, state === null, m)}
    />
  );
}

export const CONTROL_SWITCH_VIEW: WidgetKindView = { View: ControlSwitchView, isEmpty: () => false };
