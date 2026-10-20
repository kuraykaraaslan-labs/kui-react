// The pure logic of control.setpoint (no React): the head (label, the optional range line, the value the device
// reports), how the value is worded (with or without the unit), the control's look and ranges, the confirmation policy
// and why it may be disabled. `ControlSetpointView.tsx` draws it; kui-ejs and KUInative vendor this file. Applying is
// interactive: it sends `{ kind: 'set', value: <number> }` and the host answers `onControl`.

import { asNumber } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle, formatValue, type ValueFormat } from '../settings/style';
import type { StyleRecord } from '../card-logic';
import type { NumberFormatSpec } from './chart-data';
import { confirmProps, controlBlockReasonOf, controlMessages, textOr, type ControlHost, type FeedbackSettings } from './control-common';

export type SetpointSettings = FeedbackSettings & {
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
 * Everything control.setpoint draws. The head shows the label (with `range` under it when asked for) and, at the
 * end, `current`: the value the device reports, so a pending change reads as "now 22 → 23". The control below shows
 * the value being set: `bareFormat` words it without the unit; the unit goes beside it (`input`: inside the field
 * as `control.unit`; `stepper` / `dial`: in the value metric `control.valueMetric`, which leaves the unit off when
 * the text is "—").
 */
export function controlSetpointModel(s: SetpointSettings, value: unknown, format: ValueFormat, locale: string | undefined, host: ControlHost) {
  const current = asNumber(value);
  const layout: 'input' | 'stepper' | 'dial' = s.layout === 'stepper' || s.layout === 'dial' ? s.layout : 'input';
  const withUnit = s.unitDisplay !== 'hide';
  const fmt = (n: number) => formatValue(n, withUnit ? format : { ...format, unit: '' }, {}, locale);
  const bare = (n: number) => formatValue(n, { ...format, unit: '' }, {}, locale);
  const unit = withUnit && format.unit ? format.unit : undefined;
  const apply = textOr(s.applyLabel);
  const { messages: policyMessages, ...confirm } = confirmProps(host.confirm);
  const messages = controlMessages(s, policyMessages, host.messages);
  const showRange = s.showRange === true && layout !== 'dial';
  return {
    request: { kind: 'set' as const, valueType: 'number' as const },
    layout,
    label: { text: textOr(s.label), font: s.labelFont, color: s.labelColor },
    /** The "min – max" line under the label, or null. */
    range: showRange ? `${fmt(asNumber(s.min) ?? 0)} – ${fmt(asNumber(s.max) ?? 100)}` : null,
    /** The value the device reports, or null when `showValue` is off. */
    current: s.showValue !== false ? {
      label: textOr(s.currentLabel) ?? host.messages.now,
      text: current === null ? '—' : bare(current),
      unit,
      unitPosition: format.unitPosition,
      font: s.currentFont,
      color: s.currentColor,
    } : null,
    bareFormat: { base: { ...format, unit: '' } } as NumberFormatSpec,
    control: {
      value,
      ariaLabel: textOr(s.label) ?? textOr(host.title) ?? host.messages.setpoint,
      min: s.min,
      max: s.max,
      step: s.step,
      unit: layout === 'input' ? unit : undefined,
      layout,
      valueStyle: fontStyle(s.valueFont, s.valueColor) as StyleRecord,
      valueMetric: layout === 'input' ? null : {
        unit,
        unitPosition: format.unitPosition,
        size: 'md' as const,
        font: s.valueFont,
        color: s.valueColor,
        style: layout === 'dial' && !s.valueFont?.size ? { fontSize: 'clamp(0.625rem, 22cqi, 1.75rem)' } as StyleRecord : undefined,
      },
      buttonColor: cssColor(s.buttonColor),
      buttonTextColor: cssColor(s.buttonTextColor),
      borderColor: cssColor(s.borderColor),
      dialColor: cssColor(s.dialColor) ?? cssColor(s.buttonColor),
      dialTrackColor: cssColor(s.dialTrackColor),
      confirm,
      messages: apply || messages ? { ...messages, ...(apply ? { apply } : {}) } : undefined,
      disabledReason: controlBlockReasonOf(host, s.disableWhen, current === null, host.messages),
    },
  };
}
