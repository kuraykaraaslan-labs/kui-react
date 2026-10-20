'use client';
import { useId } from 'react';
import { formatValue } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { UpdatedAgo } from './UpdatedAgo';
import { Delta, IconTile, Meta, Metric, MetricHead, MetricLabel } from './ui';
import { H, W, sparklineModel, sparkValues, type StatSparklineSettings as S } from './spark-logic';

export * from './spark-logic';


/** `stat.sparkline`: Stat's label, icon, number and change, plus the trend line of the series. */
export function StatSparklineView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const m = useKitMessages().stat;
  const gid = `ks${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const {
    points, values, last, first, layout, rangeColor, target, lineColor, fillMode, fillOpacity, width,
    change, span, timeText, lo, hi, pts, area, line, iMin, iMax,
  } = sparklineModel(s, format, data, locale, m);
  // Markers are HTML dots over the stretched drawing so they stay round.
  const marker = (i: number, part: string, title: string) => (
    <span key={part} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-raised" data-part={part} title={title}
      style={{ left: `${(pts[i].x / W) * 100}%`, top: `${(pts[i].y / H) * 100}%`, background: lineColor }} />
  );


  const chart = (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full overflow-visible"
        role="img" aria-label={m.trend(span, values.length, formatValue(first ?? last, format, {}, locale), formatValue(last, format, {}, locale))}>
        {fillMode === 'gradient' && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
        )}
        {area && (
          <path d={area} stroke="none" data-part="area"
            fill={fillMode === 'gradient' ? `url(#${gid})` : lineColor} fillOpacity={fillMode === 'gradient' ? undefined : fillOpacity} />
        )}
        {pts.length === 0 && (
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--border)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" data-part="baseline" />
        )}
        <path d={line} fill="none" stroke={lineColor} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
          vectorEffect="non-scaling-stroke" data-part="line" />
      </svg>
      {s.showMinMax && pts.length > 2 && hi !== lo && [marker(iMin, 'min', m.min(formatValue(lo, format, {}, locale))), marker(iMax, 'max', m.max(formatValue(hi, format, {}, locale)))]}
      {s.showLast !== false && pts.length > 1 && marker(pts.length - 1, 'last', m.latest(formatValue(last, format, {}, locale)))}
    </div>
  );

  const label = s.label ? <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label}</MetricLabel> : null;
  const icon = s.icon ? (
    <IconTile name={s.icon} size={Math.round((s.iconSize ?? 20) * 1.8)} background={s.iconBackground}
      color={(rangeColor && target !== 'line' ? rangeColor : undefined) ?? s.iconColor} />
  ) : null;
  const metric = (
    <span data-part="value">
      <Metric
        text={formatValue(last, { ...format, unit: '' }, {}, locale)}
        unit={format.unit}
        unitPosition={format.unitPosition}
        size={layout === 'inline' ? 'lg' : 'xl'}
        font={s.autoScale === false ? s.valueFont : undefined}
        color={(rangeColor && target !== 'line' ? rangeColor : undefined) ?? s.valueColor}
      />
    </span>
  );
  const delta = change ? (
    <span data-part="change"><Delta text={change.text} direction={change.direction} meaning={change.meaning} color={change.color} label={timeText ?? undefined} /></span>
  ) : timeText ? <Meta>{timeText}</Meta> : null;
  const updatedAt = Number.isFinite(points[points.length - 1]?.t) ? points[points.length - 1].t : data.series?.fetchedAt;
  const updated = s.showUpdated ? <UpdatedAgo at={updatedAt} locale={locale} /> : null;
  const numberBlock = (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">{metric}{delta}{updated}</div>
  );

  if (layout === 'chart-only') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <MetricHead label={label} icon={icon} />
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }
  if (layout === 'inline') {
    return (
      <div className="flex h-full min-h-0 items-end gap-4">
        <div className="flex min-w-0 shrink-0 flex-col gap-1.5 self-stretch">
          <MetricHead label={label} icon={null} />
          <div className="mt-auto flex flex-col gap-1.5">{metric}{delta}{updated}</div>
        </div>
        <div className="h-full max-h-24 min-w-0 flex-1 self-end">{chart}</div>
      </div>
    );
  }
  if (layout === 'overlay') {
    // The line fills the lower part of the card behind the number (Grafana's stat with graph).
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-2">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-40">{chart}</div>
        <div className="relative"><MetricHead label={label} icon={icon} /></div>
        <div className="relative mt-auto flex flex-col gap-1.5">{metric}{delta}{updated}</div>
      </div>
    );
  }
  if (layout === 'value-top') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <MetricHead label={label} icon={icon} />
        {numberBlock}
        <div className="min-h-0 flex-1">{chart}</div>
      </div>
    );
  }
  // stacked: Stat's order (label, icon, number at the bottom) with the line between them.
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <MetricHead label={label} icon={icon} />
      <div className="min-h-6 flex-1">{chart}</div>
      <div className="shrink-0">{numberBlock}</div>
    </div>
  );
}

export const STAT_SPARKLINE_VIEW: WidgetKindView = {
  View: StatSparklineView,
  isEmpty: (data) => sparkValues(data.series).length === 0,
  emptyShape: true,
};
