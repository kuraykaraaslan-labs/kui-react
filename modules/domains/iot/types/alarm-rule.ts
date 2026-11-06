import type { AlarmSeverity } from './alarm';

/*
 * Alarm rules of a device profile (docs/concepts/iot-platform/phases/01 §1.4 "Alarm rules", 03; NB `iot_alarm` 01 §1.1). A profile holds
 * a set of rules, each with a unique `type` (one open alarm per device and type): a threshold rule (one condition per severity, the
 * highest true wins, debounce, hysteresis, …) or the inactivity rule `device_offline`. The host stores and validates the whole set; the
 * editor sends it back whole. Self-contained (no zod), like the other entity files.
 */

export const ALARM_RULE_OPS = ['>', '>=', '<', '<=', '==', '!='] as const;
export type AlarmRuleOp = (typeof ALARM_RULE_OPS)[number];

/** The inactivity rule's fixed type (NB `DEVICE_OFFLINE_TYPE`). */
export const DEVICE_OFFLINE_RULE_TYPE = 'device_offline';

/** A rule type: a letter or digit, then letters, digits, `_ . : -`, at most 128 (NB `ALARM_TYPE_PATTERN`, 41-ui-fixes/24 1.13). */
export const ALARM_RULE_TYPE_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

/** The operators that order values: their value must be a number (NB `iot_alarm` refuses anything else on write). */
export const ORDERING_OPS: readonly AlarmRuleOp[] = ['>', '>=', '<', '<='];
/** A number written as text, as the host's evaluator reads one (`80`, `-1.5`, `.5`, `1e3`). */
export const THRESHOLD_NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
/** A decimal written with a comma (`80,5`): refused with its own hint. */
const DECIMAL_COMMA_RE = /^[-+]?\d+,\d+$/;
/** Longest key, text value and title the host stores (NB `AlarmRuleSchema`). */
export const ALARM_RULE_KEY_MAX = 128;
export const ALARM_RULE_VALUE_MAX = 256;
export const ALARM_RULE_TITLE_MAX = 300;

export type AlarmRuleLeaf = {
  key: string;
  op: AlarmRuleOp;
  /** A number, string or boolean, or a per-device threshold from an attribute. */
  value: number | string | boolean | { attribute: string };
  /** OD-25: exact `metadata.topic`; null = only the default topics; absent = any topic. */
  topic?: string | null;
};
export type AlarmRuleCondition = AlarmRuleLeaf | { all: AlarmRuleCondition[] } | { any: AlarmRuleCondition[] };

export type AlarmRuleDebounce = { mode: 'count' | 'duration'; raise: number; clear: number };

export type ThresholdAlarmRule = {
  type: string;
  title: string;
  severities: Array<{ severity: AlarmSeverity; condition: AlarmRuleCondition }>;
  clear?: AlarmRuleCondition;
  debounce?: AlarmRuleDebounce;
  hysteresis?: number;
  dampening?: { maxTransitions: number; windowSec: number; holdSec: number };
  notify?: Record<string, unknown>;
  runbook?: string;
  evaluateBackfill?: boolean;
  enabled: boolean;
};

export type InactivityAlarmRule = {
  type: typeof DEVICE_OFFLINE_RULE_TYPE;
  title: string;
  inactivity: { afterSec: number; severity: AlarmSeverity };
  notify?: Record<string, unknown>;
  runbook?: string;
  enabled: boolean;
};

export type AlarmRuleDefinition = ThresholdAlarmRule | InactivityAlarmRule;

/** A stored rule: its id and version are the host's; the definition is what the editor changes. */
export type AlarmRuleRecord = {
  ruleId?: string;
  version?: number;
  updatedAt?: Date | string;
  definition: AlarmRuleDefinition;
};

export function isInactivityRule(r: AlarmRuleDefinition): r is InactivityAlarmRule {
  return r.type === DEVICE_OFFLINE_RULE_TYPE && 'inactivity' in r;
}

export function isLeafCondition(c: AlarmRuleCondition): c is AlarmRuleLeaf {
  return !('all' in c) && !('any' in c);
}

/** Every comparison of a condition tree, in order. */
export function conditionLeaves(c: AlarmRuleCondition): AlarmRuleLeaf[] {
  return 'all' in c ? c.all.flatMap(conditionLeaves) : 'any' in c ? c.any.flatMap(conditionLeaves) : [c];
}

/** `temperature > 80`, `(a > 1 and b < 2)`, `level >= attribute:limit`, with ` on <topic>` when the leaf names one. */
export function describeCondition(c: AlarmRuleCondition, words: { and: string; or: string; attribute: string; topic: string } = { and: 'and', or: 'or', attribute: 'attribute', topic: 'on' }): string {
  if ('all' in c) return `(${c.all.map((x) => describeCondition(x, words)).join(` ${words.and} `)})`;
  if ('any' in c) return `(${c.any.map((x) => describeCondition(x, words)).join(` ${words.or} `)})`;
  const v = typeof c.value === 'object' && c.value !== null ? `${words.attribute}:${c.value.attribute}` : JSON.stringify(c.value);
  const topic = c.topic ? ` ${words.topic} ${c.topic}` : c.topic === null ? ` ${words.topic} v1/` : '';
  return `${c.key} ${c.op} ${v}${topic}`;
}

/** The new rules a profile starts from in the editor. */
export function newThresholdRule(type = 'high_value'): ThresholdAlarmRule {
  return {
    type,
    title: '{{device.name}}: {{value}}',
    severities: [{ severity: 'MAJOR', condition: { key: 'temperature', op: '>', value: 80 } }],
    debounce: { mode: 'count', raise: 1, clear: 1 },
    enabled: true,
  };
}
export function newInactivityRule(): InactivityAlarmRule {
  return { type: DEVICE_OFFLINE_RULE_TYPE, title: '{{device.name}} is offline', inactivity: { afterSec: 600, severity: 'WARNING' }, enabled: true };
}

/** What the editor checks before it sends a set (the host validates the full schema again). */
export type AlarmRuleIssue = 'type_invalid' | 'type_duplicate' | 'title_required' | 'title_too_long' | 'severity_required' | 'severity_duplicate'
  | 'key_required' | 'key_invalid' | 'key_too_long' | 'value_not_number' | 'value_comma' | 'value_too_long' | 'debounce_out_of_range'
  | 'hysteresis_out_of_range' | 'after_out_of_range';

/**
 * What is wrong with one comparison's value: an ordering operator (`>`, `>=`, `<`, `<=`) needs a number, or a per-device attribute
 * (`80,5` with a comma has its own hint; `80 °C`, `8O`, `true` are refused), and a text value is at most 256 characters. Null: nothing.
 */
export function leafValueIssue(l: AlarmRuleLeaf): 'value_not_number' | 'value_comma' | 'value_too_long' | null {
  const v = l.value;
  if (typeof v === 'string' && v.length > ALARM_RULE_VALUE_MAX) return 'value_too_long';
  if (!ORDERING_OPS.includes(l.op) || typeof v === 'number' || (typeof v === 'object' && v !== null)) return null;
  if (typeof v === 'string' && THRESHOLD_NUMBER_RE.test(v.trim())) return null;
  return typeof v === 'string' && DECIMAL_COMMA_RE.test(v.trim()) ? 'value_comma' : 'value_not_number';
}

/**
 * A condition key names a telemetry key, never a value: no whitespace and not a bare number (`5.3` typed into the key box is refused, NB
 * `iot_alarm` refuses it on write too), unless the profile declares that very key (`declared`: a register number like `40001` is a key
 * a profile may list). Anything else passes, so a key a device sends but the profile does not declare stays possible.
 */
export function isAlarmRuleKey(k: string, declared?: readonly string[] | null): boolean {
  if (k.length === 0 || k.length > ALARM_RULE_KEY_MAX) return false;
  if (Array.isArray(declared) && declared.includes(k)) return true;
  return !/\s/.test(k) && !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(k);
}

/** Every key the rule's conditions read (its severities and its clear condition). */
export function alarmRuleKeys(r: AlarmRuleDefinition): string[] {
  if (isInactivityRule(r)) return [];
  const keys = [...r.severities.flatMap((s) => conditionLeaves(s.condition)), ...(r.clear ? conditionLeaves(r.clear) : [])].map((l) => l.key.trim()).filter(Boolean);
  return [...new Set(keys)];
}

/**
 * The keys of the rule the profile does not declare (`declared`: its telemetry keys). A warning, never a block: a profile may list no keys
 * at all (then nothing is reported), and a device may send keys its profile does not list. A rule whose keys are all undeclared never
 * fires on a device that sends only the declared ones.
 */
export function undeclaredRuleKeys(r: AlarmRuleDefinition, declared: readonly string[] | null | undefined): string[] {
  if (!declared || declared.length === 0) return [];
  const known = new Set(declared);
  return alarmRuleKeys(r).filter((k) => !known.has(k));
}

/** What is wrong with a rule (`others`: the rest of the set, for duplicate types; `declared`: the profile's keys, see `isAlarmRuleKey`). */
export function alarmRuleIssues(r: AlarmRuleDefinition, others: readonly AlarmRuleDefinition[] = [], declared?: readonly string[] | null): AlarmRuleIssue[] {
  const out: AlarmRuleIssue[] = [];
  if (!ALARM_RULE_TYPE_RE.test(r.type)) out.push('type_invalid');
  if (others.some((o) => o.type === r.type)) out.push('type_duplicate');
  if (!r.title.trim()) out.push('title_required');
  else if (r.title.trim().length > ALARM_RULE_TITLE_MAX) out.push('title_too_long');
  if (isInactivityRule(r)) {
    if (!Number.isInteger(r.inactivity.afterSec) || r.inactivity.afterSec < 10 || r.inactivity.afterSec > 7 * 86_400) out.push('after_out_of_range');
    return out;
  }
  if (r.type === DEVICE_OFFLINE_RULE_TYPE) out.push('type_invalid');
  if (!r.severities.length) out.push('severity_required');
  if (new Set(r.severities.map((s) => s.severity)).size !== r.severities.length) out.push('severity_duplicate');
  const all = [...r.severities.flatMap((s) => conditionLeaves(s.condition)), ...(r.clear ? conditionLeaves(r.clear) : [])];
  if (all.some((l) => !l.key.trim())) out.push('key_required');
  else if (all.some((l) => l.key.trim().length > ALARM_RULE_KEY_MAX)) out.push('key_too_long');
  else if (all.some((l) => !isAlarmRuleKey(l.key.trim(), declared))) out.push('key_invalid');
  // the value checks the host makes on write (NB 41-ui-fixes/24 1.6, 1.13): each issue once
  for (const issue of all.map(leafValueIssue)) if (issue && !out.includes(issue)) out.push(issue);
  const d = r.debounce;
  const count = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 86_400;
  if (d && (!count(d.raise) || !count(d.clear))) out.push('debounce_out_of_range');
  if (r.hysteresis !== undefined && !(typeof r.hysteresis === 'number' && Number.isFinite(r.hysteresis) && r.hysteresis >= 0 && r.hysteresis <= 1e9)) {
    out.push('hysteresis_out_of_range');
  }
  return out;
}

/** The condition with each key of `renames` (`{ old: new }`) replaced; everything else as it was (NB `iot_alarm` renameConditionKeys). */
export function renameConditionKeys(c: AlarmRuleCondition, renames: Readonly<Record<string, string>>): AlarmRuleCondition {
  if ('all' in c) return { all: c.all.map((p) => renameConditionKeys(p, renames)) };
  if ('any' in c) return { any: c.any.map((p) => renameConditionKeys(p, renames)) };
  return Object.prototype.hasOwnProperty.call(renames, c.key) ? { ...c, key: renames[c.key] } : c;
}

/**
 * The rule with its condition keys renamed, the way the host rewrites stored rules when the profile's keys are renamed (an inactivity
 * rule reads no key and comes back as it is). The rules editor applies it to its unsaved edits, so a save after a rename keeps the new keys.
 */
export function renameAlarmRuleKeys(r: AlarmRuleDefinition, renames: Readonly<Record<string, string>>): AlarmRuleDefinition {
  if (isInactivityRule(r)) return r;
  return {
    ...r,
    severities: r.severities.map((s) => ({ ...s, condition: renameConditionKeys(s.condition, renames) })),
    ...(r.clear ? { clear: renameConditionKeys(r.clear, renames) } : {}),
  };
}
