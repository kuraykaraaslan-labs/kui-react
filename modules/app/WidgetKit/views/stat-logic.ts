// The pure logic of the single-number widget (no React): the number, the change against the compared value
// and what that change means. `StatValueView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import { cssColor, formatDateTimeText, formatValue, rangeFor, tint, type RangeEdges } from '../settings/style';
import { metaLabel } from '../settings/source-meta';
import type { SlotData } from '../kind';
import type { ValueFormat } from '../settings/style';

export const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export type StatValueSettings = {
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
  showUpdated?: boolean;
  upColor?: string;
  downColor?: string;
};

/** The change against the `compare` slot and what it means (good / bad / neutral). */
export function comparison(value: number | null, compare: number | null, s: StatValueSettings, format: ValueFormat, locale?: string) {
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


/** What the single-number widget draws, decided once: the number and its unit, the range colour and where it goes, the change, the label. */
export function statValueModel(s: StatValueSettings, format: ValueFormat, data: Record<string, SlotData | undefined>, locale: string | undefined) {
  const value = num(data.value?.value);
  // a date and time the source sends as text is shown as one, in the viewer's language, never as "—" or the raw ISO string
  const when = value === null ? formatDateTimeText(data.value?.value, locale) : null;
  const rc = cssColor(rangeFor(value, s.ranges, s.rangeEdges ?? 'from')?.color);
  const target = s.rangeTarget ?? 'value';
  const layout = s.layout ?? 'stacked';
  const cmp = comparison(value, num(data.compare?.value), s, format, locale);
  return {
    value, layout, cmp,
    metricText: when ?? formatValue(value, { ...format, unit: '' }, {}, locale),
    metricUnit: value === null ? undefined : format.unit,
    metricColor: (rc && target === 'value' ? rc : undefined) ?? s.valueColor,
    labelText: s.label || metaLabel(data.value?.meta?.label, locale),
    iconSize: Math.round((s.iconSize ?? 20) * 1.8),
    iconColor: (rc && target === 'icon' ? rc : undefined) ?? s.iconColor,
    surface: rc && target === 'background' ? { background: tint(rc, 14), borderRadius: 8, padding: 8 } : undefined,
  };
}
