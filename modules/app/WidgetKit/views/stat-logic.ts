// The pure logic of the single-number widget (no React): the number, the change against the compared value
// and what that change means. `StatValueView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import { formatValue, type RangeEdges } from '../settings/style';
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

