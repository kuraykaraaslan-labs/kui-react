'use client';
import type { CSSProperties } from 'react';
import { ControlButton } from '@/modules/ui/ControlTile';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { controlHostOf, requestControl } from './control-common';
import { controlButtonModel, type ButtonSettings as S } from './control-button-logic';
import { MetricLabel } from './ui';

export * from './control-button-logic';

/** `control.button`: one press asks the host to run the placement's command. With `pressed` it is a toggle. */
export function ControlButtonView(props: WidgetViewProps) {
  const s = props.settings as S;
  const m = useKitMessages().controls;
  const run = requestControl(props.onControl, 'run', m);
  const { description, button: b } = controlButtonModel(s, controlHostOf(props, m));
  const icon = b.icon ? <SettingIcon name={b.icon.name} style={{ width: b.icon.size, height: b.icon.size, fontSize: b.icon.size }} /> : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {description && <MetricLabel font={description.font} color={description.color}>{description.text}</MetricLabel>}
      <ControlButton
        framed={false}
        className="min-h-0 flex-1"
        layout={b.layout}
        label={b.label}
        icon={icon}
        iconPosition={b.iconPosition}
        variant={b.variant}
        size={b.size}
        fullWidth={b.fullWidth}
        bodyAlign={b.bodyAlign}
        align={b.align}
        buttonStyle={b.style as CSSProperties}
        buttonClassName={b.className}
        disabledReason={b.disabledReason}
        pressed={b.pressed}
        {...b.confirm}
        messages={b.messages}
        onCommit={(confirmation) => run(undefined, confirmation)}
      />
    </div>
  );
}

export const CONTROL_BUTTON_VIEW: WidgetKindView = { View: ControlButtonView, isEmpty: () => false };
