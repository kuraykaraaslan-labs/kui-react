'use client';
import type { ReactNode } from 'react';
import { ControlSlider, type ControlSliderParts } from '@/modules/ui/ControlTile';
import { asNumber } from '@/modules/ui/ControlTile/control-logic';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, formatValue } from '../settings/style';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { confirmProps, controlBlockReason, controlMessages, requestControl, textOr, type FeedbackSettings } from './control-common';
import { Meta, Metric, MetricHead, MetricLabel } from './ui';

type S = FeedbackSettings & {
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

/** `control.slider`: label and value on top, the track below (the value widgets' order); written once per gesture. */
export function ControlSliderView(props: WidgetViewProps) {
  const s = props.settings as S;
  const value = props.data.value?.value;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const layout = s.layout === 'extended' || s.layout === 'compact' ? s.layout : 'default';
  const vertical = s.orientation === 'vertical';
  const showValue = s.showValue !== false;
  const showMinMax = s.showMinMax !== false;
  const pos = s.valuePosition === 'end' || s.valuePosition === 'bottom' ? s.valuePosition : 'top';
  const iconSize = typeof s.iconSize === 'number' ? s.iconSize : 16;
  const iconStyle = { color: cssColor(s.iconColor) ?? 'var(--text-secondary)', fontSize: iconSize, width: iconSize, height: iconSize };
  const iconEl = (name?: string) => (name ? <span aria-hidden="true" className="inline-flex shrink-0 items-center"><SettingIcon name={name} style={iconStyle} /></span> : null);
  const { messages: policyMessages, ...confirm } = confirmProps(props.confirm);
  const label = <MetricLabel font={s.labelFont} color={s.labelColor}>{textOr(s.label)}</MetricLabel>;
  const metric = (text: string, size: 'xl' | 'lg' | 'md' | 'sm') => (
    <Metric text={text} size={size} font={s.valueFont} color={s.valueColor} />
  );

  const render = (p: ControlSliderParts): ReactNode => {
    const minMax = showMinMax ? <><Meta>{p.minText}</Meta><Meta>{p.maxText}</Meta></> : null;
    if (vertical) {
      return (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 [&>*]:shrink-0">
            {label}
            {showValue && metric(p.valueText, layout === 'compact' ? 'md' : 'lg')}
            {showMinMax && <Meta className="mt-auto">{p.minText} – {p.maxText}</Meta>}
          </div>
          <div className="flex min-h-16 flex-col items-center gap-1.5">
            {iconEl(s.endIcon)}
            <div className="min-h-0 flex-1">{p.slider}</div>
            {iconEl(s.startIcon)}
          </div>
        </div>
      );
    }
    const track = (end?: ReactNode) => (
      <div className="flex items-start gap-3">
        {s.startIcon && <span className="flex h-9 items-center">{iconEl(s.startIcon)}</span>}
        {p.slider}
        {s.endIcon && <span className="flex h-9 items-center">{iconEl(s.endIcon)}</span>}
        {end && <span className="flex h-9 shrink-0 items-center">{end}</span>}
      </div>
    );
    if (layout === 'compact') {
      return (
        <div className="flex min-h-0 flex-1 items-center gap-3">
          {textOr(s.label) && <div className="max-w-[35%] shrink-0">{label}</div>}
          <div className="min-w-0 flex-1">{track(showValue ? metric(p.valueText, 'sm') : undefined)}</div>
        </div>
      );
    }
    if (layout === 'extended') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-1">
          <div className="flex flex-col items-center gap-1 text-center">{label}{showValue && metric(p.valueText, 'xl')}</div>
          {track()}
          {minMax && <div className="flex justify-between">{minMax}</div>}
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <MetricHead label={label} icon={showValue && pos === 'top' ? metric(p.valueText, 'md') : undefined} />
        <div className="mt-auto">
          {track(showValue && pos === 'end' ? metric(p.valueText, 'sm') : undefined)}
          {(minMax || (showValue && pos === 'bottom')) && (
            <div className="flex items-center justify-between gap-2">
              {showMinMax ? <Meta>{p.minText}</Meta> : <span />}
              {showValue && pos === 'bottom' && metric(p.valueText, 'sm')}
              {showMinMax ? <Meta>{p.maxText}</Meta> : <span />}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <ControlSlider
      framed={false}
      value={value}
      {...confirm}
      messages={controlMessages(s, policyMessages, m)}
      onCommit={(next, confirmation) => set(next, confirmation)}
      ariaLabel={textOr(s.label) ?? textOr(props.title) ?? m.value}
      min={s.min}
      max={s.max}
      step={s.step}
      format={(n) => formatValue(n, props.format, {}, props.locale)}
      reportedLabel={m.reported}
      orientation={vertical ? 'vertical' : 'horizontal'}
      thickness={s.thickness}
      thumbSize={s.thumbSize}
      tickMarks={typeof s.tickMarks === 'number' ? s.tickMarks : undefined}
      tickLabels={s.tickLabels === true}
      renderLayout={render}
      colors={{
        main: cssColor(s.mainColor), track: cssColor(s.trackColor),
        disabledMain: cssColor(s.disabledMainColor), disabledTrack: cssColor(s.disabledTrackColor),
      }}
      commitMode={s.commit === 'debounced' ? 'debounced' : 'release'}
      debounceMs={s.debounceMs}
      disabledReason={controlBlockReason(props, s.disableWhen, asNumber(value) === null, m)}
    />
  );
}

export const CONTROL_SLIDER_VIEW: WidgetKindView = { View: ControlSliderView, isEmpty: () => false };
