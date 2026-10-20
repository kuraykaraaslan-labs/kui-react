'use client';
import type { FontValue } from '../../SchemaForm/types';
import { metaLabel } from '../settings/source-meta';
import { cssColor, formatValue, rangeFor, type RangeEdges } from '../settings/style';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { Delta, IconTile, Metric, MetricHead, MetricLabel, tint } from './ui';

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

type S = {
  layout?: 'stacked' | 'inline' | 'centered' | 'compact';
  autoScale?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: string;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
  rangeTarget?: 'value' | 'icon' | 'background';
  compareAs?: 'percent' | 'delta' | 'value';
  increaseIs?: 'good' | 'bad' | 'neutral';
  showArrow?: boolean;
  compareLabel?: string;
  upColor?: string;
  downColor?: string;
};

/** The change against the `compare` slot and what it means (good / bad / neutral). */
export function comparison(value: number | null, compare: number | null, s: S, format: WidgetViewProps['format'], locale?: string) {
  if (value === null || compare === null) return null;
  const diff = value - compare;
  const direction: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const meaning: 'good' | 'bad' | 'neutral' = s.increaseIs === 'neutral' || diff === 0 || !s.increaseIs ? 'neutral'
    : (diff > 0) === (s.increaseIs === 'good') ? 'good' : 'bad';
  let text: string;
  if (s.compareAs === 'value') text = formatValue(compare, format, {}, locale);
  else if (s.compareAs === 'delta') text = `${diff > 0 ? '+' : ''}${formatValue(diff, format, {}, locale)}`;
  else if (compare === 0) return null;
  else text = `${diff > 0 ? '+' : ''}${formatValue((diff / Math.abs(compare)) * 100, { decimals: 1 }, {}, locale)} %`;
  const color = meaning === 'good' ? s.upColor : meaning === 'bad' ? s.downColor : undefined;
  return { text, direction: s.showArrow === false ? 'flat' as const : direction, meaning, color };
}

/** `stat.value`: label and icon on top, the number, then its change. Every layout uses the same parts. */
export function StatValueView({ settings, format, data, locale }: WidgetViewProps) {
  const s = settings as S;
  const value = num(data.value?.value);
  const rc = cssColor(rangeFor(value, s.ranges, s.rangeEdges ?? 'from')?.color);
  const target = s.rangeTarget ?? 'value';
  const layout = s.layout ?? 'stacked';
  const cmp = comparison(value, num(data.compare?.value), s, format, locale);

  const metric = (
    <Metric
      text={formatValue(value, { ...format, unit: '' }, {}, locale)}
      unit={value === null ? undefined : format.unit}
      unitPosition={format.unitPosition}
      size={layout === 'compact' ? 'lg' : 'xl'}
      font={s.autoScale === false ? s.valueFont : undefined}
      color={(rc && target === 'value' ? rc : undefined) ?? s.valueColor}
    />
  );
  const label = <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label || metaLabel(data.value?.meta?.label, locale)}</MetricLabel>;
  const icon = s.icon ? (
    <IconTile name={s.icon} size={Math.round((s.iconSize ?? 20) * 1.8)}
      color={(rc && target === 'icon' ? rc : undefined) ?? s.iconColor}
      background={s.iconBackground} />
  ) : null;
  const delta = cmp ? <Delta text={cmp.text} direction={cmp.direction} meaning={cmp.meaning} color={cmp.color} label={s.compareLabel} /> : null;
  const surface = rc && target === 'background' ? { background: tint(rc, 14), borderRadius: 8, padding: 8 } : undefined;

  if (layout === 'compact') {
    return (
      <div className="flex h-full items-center gap-3" style={surface}>
        {icon}
        <div className="min-w-0 flex-1">{label}</div>
        <div className="flex flex-col items-end gap-1">{metric}{delta}</div>
      </div>
    );
  }
  if (layout === 'inline') {
    return (
      <div className="flex h-full items-center gap-4" style={surface}>
        {icon}
        <div className="flex min-w-0 flex-col gap-1.5">{label}{metric}{delta}</div>
      </div>
    );
  }
  if (layout === 'centered') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center" style={surface}>
        {icon}{metric}{label}{delta}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" style={surface}>
      <MetricHead label={label} icon={icon} />
      {/* Number and change share a line (wrapping when narrow), so a short card keeps both visible. */}
      <div className="mt-auto flex flex-wrap items-baseline gap-x-2.5 gap-y-1">{metric}{delta}</div>
    </div>
  );
}

export const STAT_VALUE_VIEW: WidgetKindView = {
  View: StatValueView,
  isEmpty: (data) => data.value?.value === undefined || data.value?.value === null,
  emptyShape: true,
};
