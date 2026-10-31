'use client';
import type { CSSProperties } from 'react';
import { ControlSetpoint } from '@/modules/ui/ControlTile';
import { useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { captionOf } from './caption';
import { numberFormatter } from './chart-data';
import { controlHostOf, requestControl } from './control-common';
import { controlSetpointModel, type SetpointSettings as S } from './control-setpoint-logic';
import { Meta, Metric, MetricHead, MetricLabel } from './ui';

export * from './control-setpoint-logic';

/**
 * `control.setpoint`: label and the current value on top (the value widgets' order), the control
 * below: type and apply, a stepper, or a dial. The control shows the value being set; the head the
 * value the device reports, so a pending change reads as "now 22 → 23".
 */
export function ControlSetpointView(props: WidgetViewProps) {
  const s = props.settings as S;
  const value = props.data.value?.value;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const g = controlSetpointModel(s, value, props.format, props.locale, controlHostOf(props, m));
  // A caption that only repeats the card's title shown above is not drawn again.
  const caption = captionOf(g.label.text, props);
  const { control: c, current } = g;
  const label = <MetricLabel font={g.label.font} color={g.label.color}>{caption}</MetricLabel>;
  const head = current ? (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <Meta>{current.label}</Meta>
      <Metric text={current.text} unit={current.unit} unitPosition={current.unitPosition}
        size="md" font={current.font} color={current.color} />
    </span>
  ) : null;
  const vm = c.valueMetric;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MetricHead
        label={g.range ? <span className="flex flex-col gap-0.5">{label}<Meta>{g.range}</Meta></span> : label}
        icon={head}
      />
      <ControlSetpoint
        framed={false}
        className="min-h-0 flex-1"
        ariaLabel={c.ariaLabel}
        value={c.value}
        {...c.confirm}
        onCommit={(next, confirmation) => set(next, confirmation)}
        min={c.min}
        max={c.max}
        step={c.step}
        unit={c.unit}
        format={numberFormatter(g.bareFormat, props.locale)}
        layout={c.layout}
        showValue={false}
        valueStyle={c.valueStyle as CSSProperties}
        renderValue={vm ? (text) => (
          <Metric text={text} unit={text === '—' ? undefined : vm.unit} unitPosition={vm.unitPosition}
            size={vm.size} font={vm.font} color={vm.color} style={vm.style as CSSProperties | undefined} />
        ) : undefined}
        buttonColor={c.buttonColor}
        buttonTextColor={c.buttonTextColor}
        borderColor={c.borderColor}
        dialColor={c.dialColor}
        dialTrackColor={c.dialTrackColor}
        messages={c.messages}
        disabledReason={c.disabledReason}
      />
    </div>
  );
}

export const CONTROL_SETPOINT_VIEW: WidgetKindView = { View: ControlSetpointView, fit: true, isEmpty: () => false };
