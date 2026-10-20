// The pure logic of the state widget (no React): rules, the source's own words, the "unknown" state and the
// "for 12 min" text. `StateView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import { cssColor } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { ColumnMeta } from '../kind';
import { metaValue } from '../settings/source-meta';
import { DEFAULT_WIDGET_KIT_MESSAGES, type StatViewMessages } from '../messages';

export type StateRule = { match?: string; gte?: number | null; lte?: number | null; label?: string; color?: string; background?: string; icon?: string; pulse?: boolean; lit?: boolean };

export type StateSettings = {
  layout?: 'big' | 'badge' | 'dot' | 'tile' | 'icon' | 'lamp';
  lampSize?: number;
  lampLabel?: boolean;
  lampDim?: string;
  alignment?: 'start' | 'center';
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  iconSize?: number;
  states?: unknown;
  fallbackLabel?: string;
  fallbackColor?: string;
  fallbackBackground?: string;
  fallbackIcon?: string;
  stateFont?: FontValue;
  showValue?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  showSince?: boolean;
  staleAsUnknown?: boolean;
  unknownLabel?: string;
};

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const isBlank = (v: unknown) => v === null || v === undefined || v === '';

function ruleMatches(rule: StateRule, value: unknown): boolean {
  if (!isBlank(rule.match)) {
    const a = asNumber(rule.match);
    const b = asNumber(value);
    if (a !== null && b !== null) return a === b;
    return String(rule.match).toLowerCase() === String(value).toLowerCase();
  }
  if (isBlank(rule.gte) && isBlank(rule.lte)) return false;
  const n = asNumber(value);
  if (n === null) return false;
  if (typeof rule.gte === 'number' && n < rule.gte) return false;
  if (typeof rule.lte === 'number' && n > rule.lte) return false;
  return true;
}

export interface StateOutcome {
  label: string;
  color: string;
  background?: string;
  icon?: string;
  pulse?: boolean;
  /** Lamp layout: false draws the dim colour (a rule can say a state is not lit). */
  lit?: boolean;
  matched: boolean;
  unknown: boolean;
}

/**
 * First matching rule wins, otherwise the fallback. A missing value (or, when asked, a stale one)
 * is "unknown" in a neutral colour, never the fallback's. Its label is the `unknownLabel` setting, unless
 * that is empty or still the template's English default: then `unknownText` (the host's word for it).
 */
export function evaluateState(value: unknown, settings: Sparse, stale = false, unknownText = 'Unknown', meta?: ColumnMeta): StateOutcome {
  const s = settings as StateSettings;
  const neutral = 'var(--text-secondary)';
  if (isBlank(value) || (stale && s.staleAsUnknown !== false)) {
    return { label: s.unknownLabel && s.unknownLabel !== 'Unknown' ? s.unknownLabel : unknownText, color: neutral, matched: false, unknown: true };
  }
  const rules = (Array.isArray(s.states) ? (s.states as StateRule[]) : []).filter((r) => r && typeof r === 'object');
  const hit = rules.find((r) => ruleMatches(r, value));
  if (hit) {
    return {
      label: hit.label || String(value),
      color: cssColor(hit.color) ?? neutral,
      background: cssColor(hit.background),
      icon: hit.icon || undefined,
      ...(hit.pulse ? { pulse: true } : {}),
      ...(hit.lit === false ? { lit: false } : {}),
      matched: true,
      unknown: false,
    };
  }
  // No rule matched: the source's own word for this value, before the fallback.
  const said = metaValue(meta, value);
  if (said) {
    return { label: said.label, color: cssColor(said.color) ?? neutral, icon: said.icon || undefined, matched: true, unknown: false };
  }
  return {
    label: s.fallbackLabel || String(value),
    color: cssColor(s.fallbackColor) ?? neutral,
    background: cssColor(s.fallbackBackground),
    icon: s.fallbackIcon || undefined,
    matched: false,
    unknown: false,
  };
}

/** "for 12 min", "for 3 h", "for 2 d"; `texts` words them. */
export function forText(
  ms: number,
  texts: Pick<StatViewMessages, 'justNow' | 'forMinutes' | 'forHours' | 'forDays'> = DEFAULT_WIDGET_KIT_MESSAGES.stat,
): string {
  if (!Number.isFinite(ms) || ms < 60_000) return texts.justNow;
  const min = Math.round(ms / 60_000);
  if (min < 60) return texts.forMinutes(min);
  const h = Math.round(min / 60);
  if (h < 48) return texts.forHours(h);
  return texts.forDays(Math.round(h / 24));
}

