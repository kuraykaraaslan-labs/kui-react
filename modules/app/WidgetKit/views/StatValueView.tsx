'use client';
import { UpdatedAgo } from './UpdatedAgo';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { Delta, IconTile, Metric, MetricHead, MetricLabel } from './ui';
import { statValueModel, type StatValueSettings as S } from './stat-logic';

export * from './stat-logic';

/** `stat.value`: label and icon on top, the number, then its change. Every layout uses the same parts. */
export function StatValueView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const { layout, cmp, metricText, metricUnit, metricColor, labelText, iconSize, iconColor, surface } = statValueModel(s, format, data, locale);

  const metric = (
    <Metric
      text={metricText}
      unit={metricUnit}
      unitPosition={format.unitPosition}
      size={layout === 'compact' ? 'lg' : 'xl'}
      font={s.autoScale === false ? s.valueFont : undefined}
      color={metricColor}
    />
  );
  const label = <MetricLabel font={s.labelFont} color={s.labelColor}>{labelText}</MetricLabel>;
  const icon = s.icon ? (
    <IconTile name={s.icon} size={iconSize} color={iconColor} background={s.iconBackground} />
  ) : null;
  const delta = cmp ? <Delta text={cmp.text} direction={cmp.direction} meaning={cmp.meaning} color={cmp.color} label={s.compareLabel} /> : null;
  const tail = <>{delta}{s.showUpdated ? <UpdatedAgo at={data.value?.fetchedAt} locale={locale} /> : null}</>;

  if (layout === 'compact') {
    return (
      <div className="flex h-full items-center gap-3" style={surface}>
        {icon}
        <div className="min-w-0 flex-1">{label}</div>
        <div className="flex flex-col items-end gap-1">{metric}{tail}</div>
      </div>
    );
  }
  if (layout === 'inline') {
    return (
      <div className="flex h-full items-center gap-4" style={surface}>
        {icon}
        <div className="flex min-w-0 flex-col gap-1.5">{label}{metric}{tail}</div>
      </div>
    );
  }
  if (layout === 'centered') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center" style={surface}>
        {icon}{metric}{label}{tail}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" style={surface}>
      <MetricHead label={label} icon={icon} />
      {/* Number and change share a line (wrapping when narrow), so a short card keeps both visible. */}
      <div className="mt-auto flex flex-wrap items-baseline gap-x-2.5 gap-y-1">{metric}{tail}</div>
    </div>
  );
}

export const STAT_VALUE_VIEW: WidgetKindView = {
  View: StatValueView,
  fit: true,
  isEmpty: (data) => data.value?.value === undefined || data.value?.value === null,
  emptyShape: true,
};
