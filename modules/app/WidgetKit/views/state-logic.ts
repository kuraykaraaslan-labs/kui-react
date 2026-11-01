// The pure logic of the state widget (no React): rules, the source's own words, the "unknown" state and the
// "for 12 min" text. `StateView.tsx` draws it; kui-ejs and KUInative vendor this file.

import type { FontValue } from '../../SchemaForm/types';
import { cssColor, formatDateTimeText, tint } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { ColumnMeta, SlotData } from '../kind';
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
/** The words an on / off value reads as when no rule names it. */
export interface OnOffWords { on: string; off: string }

/**
 * Whether `value` is an on / off value: a boolean, or 1 / 0 (as a number or text) when the source says the column is a boolean
 * (a device's flag stored as 1 / 0 reaches a card as a number; e2e round 2: a State card read "0" and "1" for a pump's running flag).
 */
export function onOffOf(value: unknown, meta?: ColumnMeta): boolean | null {
  if (typeof value === 'boolean') return value;
  if (meta?.kind !== 'boolean') return null;
  const n = asNumber(value);
  if (n === 1 || n === 0) return n === 1;
  const w = String(value).trim().toLowerCase();
  return w === 'true' || w === 'on' ? true : w === 'false' || w === 'off' ? false : null;
}

/** A value as a state's words show it: a date and time sent as text in the viewer's language (`formatDateTimeText`), anything else as it is. */
export const stateValueText = (value: unknown, locale?: string): string => formatDateTimeText(value, locale) ?? String(value);

export function evaluateState(value: unknown, settings: Sparse, stale = false, unknownText = 'Unknown', meta?: ColumnMeta, words?: OnOffWords, locale?: string): StateOutcome {
  const s = settings as StateSettings;
  const neutral = 'var(--text-secondary)';
  if (isBlank(value) || (stale && s.staleAsUnknown !== false)) {
    return { label: s.unknownLabel && s.unknownLabel !== 'Unknown' ? s.unknownLabel : unknownText, color: neutral, matched: false, unknown: true };
  }
  const rules = (Array.isArray(s.states) ? (s.states as StateRule[]) : []).filter((r) => r && typeof r === 'object');
  const hit = rules.find((r) => ruleMatches(r, value));
  if (hit) {
    return {
      label: hit.label || stateValueText(value, locale),
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
  // An on / off value with no rule and no word from the source reads On / Off, never 1 / 0 or true / false.
  const onOff = onOffOf(value, meta);
  if (onOff !== null) {
    const w = words ?? DEFAULT_WIDGET_KIT_MESSAGES.stat;
    return { label: onOff ? w.on : w.off, color: onOff ? 'var(--success)' : neutral, matched: true, unknown: false, ...(onOff ? {} : { lit: false }) };
  }
  return {
    label: s.fallbackLabel || stateValueText(value, locale),
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


/**
 * What the state widget draws, decided once. "Since" needs memory (the time a view first saw the state), so the
 * caller keeps it: `showSince` says whether to show it, `fetched` seeds it, and `forText(now - since)` words it.
 */
export function stateModel(
  s: StateSettings,
  data: Record<string, SlotData | undefined>,
  stale: boolean,
  unknownText: string,
  words?: OnOffWords,
  locale?: string,
) {
  const raw = data.value?.value;
  const out = evaluateState(raw, s as Sparse, stale, unknownText, data.value?.meta, words, locale);
  const layout = s.layout ?? 'big';
  const fetched = data.value?.fetchedAt ? Date.parse(data.value.fetchedAt) : NaN;
  return {
    raw, out, layout,
    center: (s.alignment ?? 'start') === 'center' || layout === 'icon' || layout === 'lamp',
    iconSize: s.iconSize ?? 18,
    bg: out.background ?? tint(out.color, 14),
    pulse: !!out.pulse && !out.unknown,
    fetched,
    showSince: !!s.showSince && !out.unknown,
    showValue: !!s.showValue && !isBlank(raw) && !out.unknown,
    /** The raw value as the "raw value" part shows it (`stateValueText`). */
    valueText: isBlank(raw) ? '' : stateValueText(raw, locale),
  };
}
