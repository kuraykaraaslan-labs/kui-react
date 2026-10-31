'use client';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Progress } from '@/modules/ui/Progress';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { IconTile, Meta, Metric, MetricHead, MetricLabel } from './ui';
import { num, progressModel, type ProgressSettings as S } from './progress-logic';

export * from './progress-logic';

/**
 * `progress`: a bound number against a target, in Stat's order (label and icon on top, the number,
 * its meta, the bar). A bound target wins over the typed one. A zero or negative target has no
 * percentage: the number still shows, only the bar goes.
 */
export function ProgressView({ settings, format, data, locale }: WidgetViewProps) {
  const m = useKitMessages().stat;
  const s = settings as S;
  const p = progressModel(s, format, data, locale, m);
  const { layout, metric: mt, pct } = p;

  const metric = (size: 'xl' | 'lg' | 'md', style?: CSSProperties) => mt === null ? null : (
    <span data-part="value">
      <Metric text={mt.text} unit={mt.unit} unitPosition={mt.unitPosition} size={size} font={mt.font} color={mt.color} style={mt.custom ? undefined : style} />
    </span>
  );
  const meta = p.secondary ? <Meta><span data-part="secondary">{p.secondary}</span></Meta> : null;
  const head = (
    <MetricHead
      label={p.label ? <MetricLabel font={p.label.font} color={p.label.color}>{p.label.text}</MetricLabel> : undefined}
      icon={p.tile ? <IconTile name={p.tile.name} size={p.tile.size} color={p.tile.color} background={p.tile.background} /> : undefined}
    />
  );

  if (layout === 'ring' || layout === 'semicircle') {
    const { half, thickness: t, ratioText, valueFontSize } = p.ring;
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {head}
        <div className="flex min-h-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
          <div className="relative" style={{ width: `min(100cqw, calc(100cqh * ${ratioText}))`, aspectRatio: ratioText, containerType: 'inline-size' }}>
            <Progress
              shape={half ? 'semicircle' : 'circle'}
              value={pct ?? 0}
              diameter="fill"
              thickness={t}
              color={p.barColor}
              gradient={p.gradient}
              trackColor={p.trackColor}
              segments={p.segments}
              marks={p.marks}
              rounded={p.rounded}
              showLabel={p.mode !== 'none'}
              label={p.aria}
              labelContent={
                <span className={cn('flex flex-col items-center gap-1 leading-none', half && 'pb-[2%]')}>
                  {metric('xl', { fontSize: valueFontSize })}
                  {meta}
                </span>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // No value still draws the empty track (and its scale) when there is a target: the empty shape.
  const bar = p.hasTarget ? (
    <Progress value={pct ?? 0} color={p.barColor} gradient={p.gradient} trackColor={p.trackColor} thickness={p.thickness} rounded={p.rounded}
      segments={p.segments} marks={p.marks} label={p.aria} className="min-w-0 flex-1" />
  ) : null;
  const scale: ReactNode = p.showTicks ? (
    <div className="relative mt-1 h-3 text-[11px] leading-none tabular-nums text-text-secondary" style={p.ticksStyle as CSSProperties} data-part="ticks">
      <span className="absolute left-0">{p.zeroText}</span>
      {p.ticks.map((t) => (
        <span key={t.left} className="absolute -translate-x-1/2" style={{ left: t.left }}>{t.text}</span>
      ))}
      <span className="absolute right-0">{p.targetStr}</span>
    </div>
  ) : null;

  if (layout === 'bar') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2" data-layout="bar">
        {head}
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {bar}
            {metric('lg')}
          </div>
          {scale}
          {meta}
        </div>
      </div>
    );
  }

  const text = (p.mode !== 'none' || meta) ? (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">{metric('xl')}{meta}</div>
  ) : null;
  const below = p.below;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-layout="bar-labelled">
      {head}
      <div className="mt-auto flex flex-col gap-2.5">
        {!below && text}
        {bar && <div className="flex flex-col">{bar}{scale}</div>}
        {below && text}
      </div>
    </div>
  );
}

export const PROGRESS_VIEW: WidgetKindView = {
  View: ProgressView,
  fit: true,
  isEmpty: (data) => num(data.value?.value) === null,
  emptyShape: true,
};
