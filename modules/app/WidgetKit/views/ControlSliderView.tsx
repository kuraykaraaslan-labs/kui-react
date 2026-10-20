'use client';
import type { ReactNode } from 'react';
import { ControlSlider, type ControlSliderParts } from '@/modules/ui/ControlTile';
import { SettingIcon, useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { numberFormatter } from './chart-data';
import { controlHostOf, requestControl } from './control-common';
import { controlSliderModel, type SliderSettings as S } from './control-slider-logic';
import { Meta, Metric, MetricHead, MetricLabel } from './ui';

export * from './control-slider-logic';

/** `control.slider`: label and value on top, the track below (the value widgets' order); written once per gesture. */
export function ControlSliderView(props: WidgetViewProps) {
  const s = props.settings as S;
  const value = props.data.value?.value;
  const m = useKitMessages().controls;
  const set = requestControl(props.onControl, 'set', m);
  const g = controlSliderModel(s, value, props.format, controlHostOf(props, m));
  const { control: c } = g;
  const iconEl = (i: typeof g.startIcon) => (i ? <span aria-hidden="true" className="inline-flex shrink-0 items-center"><SettingIcon name={i.name} style={i.style} /></span> : null);
  const label = <MetricLabel font={g.label.font} color={g.label.color}>{g.label.text}</MetricLabel>;
  const metric = (text: string, size: 'xl' | 'lg' | 'md' | 'sm') => (
    <Metric text={text} size={size} font={g.valueFont} color={g.valueColor} />
  );
  const { showValue, showMinMax, valueAt } = g;

  const render = (p: ControlSliderParts): ReactNode => {
    const minMax = showMinMax ? <><Meta>{p.minText}</Meta><Meta>{p.maxText}</Meta></> : null;
    if (g.variant === 'vertical') {
      return (
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 [&>*]:shrink-0">
            {label}
            {showValue && metric(p.valueText, g.valueSize)}
            {showMinMax && <Meta className="mt-auto">{p.minText} – {p.maxText}</Meta>}
          </div>
          <div className="flex min-h-16 flex-col items-center gap-1.5">
            {iconEl(g.endIcon)}
            <div className="min-h-0 flex-1">{p.slider}</div>
            {iconEl(g.startIcon)}
          </div>
        </div>
      );
    }
    const track = (end?: ReactNode) => (
      <div className="flex items-start gap-3">
        {g.startIcon && <span className="flex h-9 items-center">{iconEl(g.startIcon)}</span>}
        {p.slider}
        {g.endIcon && <span className="flex h-9 items-center">{iconEl(g.endIcon)}</span>}
        {end && <span className="flex h-9 shrink-0 items-center">{end}</span>}
      </div>
    );
    if (g.variant === 'compact') {
      return (
        <div className="flex min-h-0 flex-1 items-center gap-3">
          {g.label.text && <div className="max-w-[35%] shrink-0">{label}</div>}
          <div className="min-w-0 flex-1">{track(showValue ? metric(p.valueText, g.valueSize) : undefined)}</div>
        </div>
      );
    }
    if (g.variant === 'extended') {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-1">
          <div className="flex flex-col items-center gap-1 text-center">{label}{showValue && metric(p.valueText, g.valueSize)}</div>
          {track()}
          {minMax && <div className="flex justify-between">{minMax}</div>}
        </div>
      );
    }
    const atBottom = showValue && valueAt === 'footer';
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <MetricHead label={label} icon={showValue && valueAt === 'head' ? metric(p.valueText, g.valueSize) : undefined} />
        <div className="mt-auto">
          {track(showValue && valueAt === 'track-end' ? metric(p.valueText, g.valueSize) : undefined)}
          {(minMax || atBottom) && (
            <div className="flex items-center justify-between gap-2">
              {showMinMax ? <Meta>{p.minText}</Meta> : <span />}
              {atBottom && metric(p.valueText, g.valueSize)}
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
      value={c.value}
      {...c.confirm}
      messages={c.messages}
      onCommit={(next, confirmation) => set(next, confirmation)}
      ariaLabel={c.ariaLabel}
      min={c.min}
      max={c.max}
      step={c.step}
      format={numberFormatter(g.valueFormat, props.locale)}
      reportedLabel={m.reported}
      orientation={c.orientation}
      thickness={c.thickness}
      thumbSize={c.thumbSize}
      tickMarks={c.tickMarks}
      tickLabels={c.tickLabels}
      renderLayout={render}
      colors={c.colors}
      commitMode={c.commitMode}
      debounceMs={c.debounceMs}
      disabledReason={c.disabledReason}
    />
  );
}

export const CONTROL_SLIDER_VIEW: WidgetKindView = { View: ControlSliderView, isEmpty: () => false };
