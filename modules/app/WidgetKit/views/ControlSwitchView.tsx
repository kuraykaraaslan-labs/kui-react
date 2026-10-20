'use client';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { ControlSwitch, type ControlSwitchParts } from '@/modules/ui/ControlTile';
import { useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { controlHostOf, requestControl } from './control-common';
import { controlSwitchModel, type SwitchSettings as S } from './control-switch-logic';
import { IconTile, Metric, MetricHead, MetricLabel, Pill } from './ui';

export * from './control-switch-logic';

/** `control.switch`: label and icon on top, the state and the switch below (the value widgets' order). */
export function ControlSwitchView(props: WidgetViewProps) {
  const s = props.settings as S;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const g = controlSwitchModel(s, props.data.value?.value, controlHostOf(props, m));
  const { layout, display } = g;

  const render = (p: ControlSwitchParts): ReactNode => {
    const look = g.states[p.state];
    const icon = look.tile ? <IconTile name={look.tile.name} size={look.tile.size} color={look.tile.color} /> : null;
    const label = <MetricLabel font={g.label.font} color={g.label.color}>{g.label.text}</MetricLabel>;
    const stateEl = !look.showState ? null : display === 'pill' ? (
      <span id={p.stateId} className="min-w-0"><Pill label={p.stateText} color={look.color} icon={look.stateIcon} /></span>
    ) : (
      <span id={p.stateId} className="min-w-0 truncate">
        <Metric text={p.stateText} size={look.stateSize} font={g.stateFont} color={look.color} />
      </span>
    );
    if (layout === 'centered') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 text-center [&>*]:shrink-0">
          {(icon || g.label.text) && <div className="flex max-w-full items-center gap-2">{icon}{label}</div>}
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
      value={g.state === 'on' ? true : g.state === 'off' ? false : null}
      {...g.confirm}
      messages={g.messages}
      onCommit={(next, confirmation) => set(next, confirmation)}
      // The switch's accessible name (the parts above draw the visible label).
      label={g.ariaLabel}
      onLabel={g.labels.on}
      offLabel={g.labels.off}
      unknownLabel={g.labels.unknown}
      size={g.size}
      renderLayout={render}
      colors={g.colors}
      disabledReason={g.disabledReason}
    />
  );
}

export const CONTROL_SWITCH_VIEW: WidgetKindView = { View: ControlSwitchView, isEmpty: () => false };
