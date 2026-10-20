// The pure logic of control.slider (no React): the layout, where the value and the range texts go, the icons, the
// slider's colours and ranges, the value formatter as data, the confirmation policy and why it may be disabled.
// `ControlSliderView.tsx` draws it; kui-ejs and KUInative vendor this file. A drag is interactive: it sends
// `{ kind: 'set', value: <number> }` once per gesture (`commitMode`) and the host answers `onControl`.

import { asNumber } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, type ValueFormat } from '../settings/style';
import type { NumberFormatSpec } from './chart-data';
import { confirmProps, controlBlockReasonOf, controlMessages, textOr, type ControlHost, type FeedbackSettings } from './control-common';

export type SliderSettings = FeedbackSettings & {
  layout?: 'default' | 'extended' | 'compact';
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  valuePosition?: 'top' | 'end' | 'bottom';
  valueFont?: FontValue;
  valueColor?: string;
  showMinMax?: boolean;
  tickMarks?: number | null;
  tickLabels?: boolean;
  mainColor?: string;
  trackColor?: string;
  disabledMainColor?: string;
  disabledTrackColor?: string;
  thickness?: number;
  thumbSize?: number;
  startIcon?: string;
  endIcon?: string;
  iconColor?: string;
  iconSize?: number;
  commit?: 'release' | 'debounced';
  debounceMs?: number;
  disableWhen?: string[];
};

/** Where the layout puts the value text: in the head (`head`), at the end of the track, under it, in the text column of a vertical slider, or centred above the track. */
export type SliderValueAt = 'head' | 'track-end' | 'footer' | 'column' | 'heading';

/**
 * Everything control.slider draws. `variant` is the arrangement: `vertical` (text column and a track with the end icon
 * on top), `compact` (label, then the track with the value at its end, one row), `extended` (label and a big value
 * centred above the track, the range under it) or `default` (label and value on top, the track below). `valueAt` and
 * `valueSize` place the value text; `minMaxAs` says how the range is shown (`pair` = one "min – max" line; `ends` =
 * a min and a max text at the two ends of the track's footer). The texts themselves (min, max, value) are produced by
 * the control with `valueFormat`.
 */
export function controlSliderModel(s: SliderSettings, value: unknown, format: ValueFormat, host: ControlHost) {
  const layout = s.layout === 'extended' || s.layout === 'compact' ? s.layout : 'default';
  const vertical = s.orientation === 'vertical';
  const showValue = s.showValue !== false;
  const showMinMax = s.showMinMax !== false;
  const pos = s.valuePosition === 'end' || s.valuePosition === 'bottom' ? s.valuePosition : 'top';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const iconStyle = { color: cssColor(s.iconColor) ?? 'var(--text-secondary)', fontSize: iconSize, width: iconSize, height: iconSize };
  const icon = (name?: string) => (name ? { name, style: iconStyle } : null);
  const { messages: policyMessages, ...confirm } = confirmProps(host.confirm);
  const variant = vertical ? 'vertical' as const : layout;
  const valueAt: SliderValueAt = vertical ? 'column' : layout === 'compact' ? 'track-end' : layout === 'extended' ? 'heading' : pos === 'top' ? 'head' : pos === 'end' ? 'track-end' : 'footer';
  const valueSize = vertical ? (layout === 'compact' ? 'md' as const : 'lg' as const)
    : layout === 'compact' ? 'sm' as const : layout === 'extended' ? 'xl' as const : pos === 'top' ? 'md' as const : 'sm' as const;
  return {
    request: { kind: 'set' as const, valueType: 'number' as const },
    variant,
    vertical,
    label: { text: textOr(s.label), font: s.labelFont, color: s.labelColor },
    showValue,
    valueAt,
    valueSize,
    valueFont: s.valueFont,
    valueColor: s.valueColor,
    showMinMax,
    minMaxAs: vertical ? 'pair' as const : 'ends' as const,
    startIcon: icon(s.startIcon),
    endIcon: icon(s.endIcon),
    /** The text of the control's number: the widget format, without unit changes. */
    valueFormat: { base: format } as NumberFormatSpec,
    control: {
      value,
      min: s.min,
      max: s.max,
      step: s.step,
      orientation: vertical ? 'vertical' as const : 'horizontal' as const,
      thickness: s.thickness,
      thumbSize: s.thumbSize,
      tickMarks: typeof s.tickMarks === 'number' ? s.tickMarks : undefined,
      tickLabels: s.tickLabels === true,
      colors: {
        main: cssColor(s.mainColor), track: cssColor(s.trackColor),
        disabledMain: cssColor(s.disabledMainColor), disabledTrack: cssColor(s.disabledTrackColor),
      },
      commitMode: s.commit === 'debounced' ? 'debounced' as const : 'release' as const,
      debounceMs: s.debounceMs,
      /** The accessible name: the label, the card title, else the host's word for a value. */
      ariaLabel: textOr(s.label) ?? textOr(host.title) ?? host.messages.value,
      confirm,
      messages: controlMessages(s, policyMessages, host.messages),
      disabledReason: controlBlockReasonOf(host, s.disableWhen, asNumber(value) === null, host.messages),
    },
  };
}
