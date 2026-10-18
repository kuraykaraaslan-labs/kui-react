'use client';
import { ControlSetpoint } from '@/modules/ui/ControlTile';
import { asNumber } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, formatValue } from '../settings/style';
import { useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { confirmProps, controlBlockReason, controlMessages, requestControl, textOr, type FeedbackSettings } from './control-common';
import { Meta, Metric, MetricHead, MetricLabel } from './ui';

type S = FeedbackSettings & {
  layout?: 'input' | 'stepper' | 'dial';
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  min?: number;
  max?: number;
  step?: number;
  showRange?: boolean;
  showValue?: boolean;
  currentLabel?: string;
  currentFont?: FontValue;
  currentColor?: string;
  valueFont?: FontValue;
  valueColor?: string;
  unitDisplay?: 'show' | 'hide';
  applyLabel?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  dialColor?: string;
  dialTrackColor?: string;
  disableWhen?: string[];
};

/**
 * `control.setpoint`: label and the current value on top (the value widgets' order), the control
 * below: type and apply, a stepper, or a dial. The control shows the value being set; the head the
 * value the device reports, so a pending change reads as "now 22 → 23".
 */
export function ControlSetpointView(props: WidgetViewProps) {
  const s = props.settings as S;
  const value = props.data.value?.value;
  const current = asNumber(value);
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const layout = s.layout === 'stepper' || s.layout === 'dial' ? s.layout : 'input';
  const withUnit = s.unitDisplay !== 'hide';
  const fmt = (n: number) => formatValue(n, withUnit ? props.format : { ...props.format, unit: '' }, {}, props.locale);
  const bare = (n: number) => formatValue(n, { ...props.format, unit: '' }, {}, props.locale);
  const unit = withUnit && props.format.unit ? props.format.unit : undefined;
  const apply = textOr(s.applyLabel);
  const { messages: policyMessages, ...confirm } = confirmProps(props.confirm);
  const messages = controlMessages(s, policyMessages, m);
  const label = <MetricLabel font={s.labelFont} color={s.labelColor}>{textOr(s.label)}</MetricLabel>;
  const head = s.showValue !== false ? (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <Meta>{textOr(s.currentLabel) ?? m.now}</Meta>
      <Metric text={current === null ? '—' : bare(current)} unit={unit} unitPosition={props.format.unitPosition}
        size="md" font={s.currentFont} color={s.currentColor} />
    </span>
  ) : null;
  const showRange = s.showRange === true && layout !== 'dial';
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MetricHead
        label={showRange ? <span className="flex flex-col gap-0.5">{label}<Meta>{fmt(asNumber(s.min) ?? 0)} – {fmt(asNumber(s.max) ?? 100)}</Meta></span> : label}
        icon={head}
      />
      <ControlSetpoint
        framed={false}
        className="min-h-0 flex-1"
        ariaLabel={textOr(s.label) ?? textOr(props.title) ?? m.setpoint}
        value={value}
        {...confirm}
        onCommit={(next, confirmation) => set(next, confirmation)}
        min={s.min}
        max={s.max}
        step={s.step}
        unit={layout === 'input' ? unit : undefined}
        format={bare}
        layout={layout}
        showValue={false}
        valueStyle={fontStyle(s.valueFont, s.valueColor)}
        renderValue={layout === 'input' ? undefined : (text) => (
          <Metric text={text} unit={text === '—' ? undefined : unit} unitPosition={props.format.unitPosition}
            size="md" font={s.valueFont} color={s.valueColor}
            style={layout === 'dial' && !s.valueFont?.size ? { fontSize: 'clamp(0.625rem, 22cqi, 1.75rem)' } : undefined} />
        )}
        buttonColor={cssColor(s.buttonColor)}
        buttonTextColor={cssColor(s.buttonTextColor)}
        borderColor={cssColor(s.borderColor)}
        dialColor={cssColor(s.dialColor) ?? cssColor(s.buttonColor)}
        dialTrackColor={cssColor(s.dialTrackColor)}
        messages={apply || messages ? { ...messages, ...(apply ? { apply } : {}) } : undefined}
        disabledReason={controlBlockReason(props, s.disableWhen, current === null, m)}
      />
    </div>
  );
}

export const CONTROL_SETPOINT_VIEW: WidgetKindView = { View: ControlSetpointView, isEmpty: () => false };
