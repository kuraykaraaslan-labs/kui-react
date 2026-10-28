// The pure part of the symbol binding panel (next-boilerplate phase 45.4, D45-10): what a symbol's fields read, the key the
// panel proposes for a field, the draft a person edits, the entry that is saved, the age of a value and the one-liner
// templates. No React, no DOM, no fetching: `SymbolBindingPanel.tsx` maps this to JSX and a host (or kui-ejs / KUInative)
// can reuse it as it is. The entry is the field map of the binding's map v2 (D45-3: `MapEntry.fields`, its grammars and caps are
// `scene-binding-logic.ts`'s, not redefined here) plus the per-field one-liner of D45-4 as an additive `script`.

import {
  MAX_FIELD_LABEL, MAX_FIELDS_PER_KEY, UUID_GRAMMAR, isSymbolField, isTelemetryKey,
  type FieldRead, type MapEntry,
} from './scene-binding-logic';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Where a field of the symbol reads from now. */
export interface FieldSource {
  deviceId: string;
  deviceName: string;
  key: string;
}

/** One thing a symbol draws, in the symbol's own words (`running`, `value`, `status`, a 3D item's own parameter). */
export interface SymbolFieldSpec {
  /** The field's name in the binding (D45-3's `symbolField`). Never shown. */
  name: string;
  /** What the person sees: "Running", "Temperature". */
  label: string;
  currentSource?: FieldSource;
  /** The one-liner the binding has for this field now. */
  currentScript?: string;
  /** What the symbol shows for this field now (after the map and the script). */
  live?: unknown;
}

/** The symbol the panel is about. `id` is internal: it is never drawn, only used to find `<element>.<field>` keys. */
export interface SymbolSpec {
  id: string;
  label: string;
  /** "Pump", "Tank": the symbol's kind in words. */
  kindLabel: string;
  fields: SymbolFieldSpec[];
}

/** A device the search offers. */
export interface DeviceOption {
  id: string;
  name: string;
  code?: string;
  hint?: string;
}

/** One latest-telemetry key of a device with its value. `ts` is epoch milliseconds or an ISO date-time. */
export interface DeviceKey {
  key: string;
  label?: string;
  unit?: string;
  value: unknown;
  ts: number | string;
}

/** One field of a saved entry: the map v2 `FieldRead` (`deviceId` is left out when the field reads the entry's own device) and D45-4's one-liner. */
export interface BindingEntryField extends FieldRead {
  script?: string;
}

/** What `onSave` receives: a map v2 entry's `fields` (`MapEntry`) with each field's one-liner. An empty `fields` means "unbound". */
export interface BindingEntry extends Pick<MapEntry, 'fields'> {
  fields: Record<string, BindingEntryField>;
}

export interface FieldDraft {
  deviceId: string;
  deviceName: string;
  key: string;
  label: string;
  script: string;
}

/** What the person is editing: the device the panel is on, and one draft per field name. */
export interface BindingDraft {
  deviceId: string;
  deviceName: string;
  fields: Record<string, FieldDraft>;
}

// ─── Caps and grammar ────────────────────────────────────────────────────────

/** The one-liner's cap (the field map's own caps, `MAX_FIELD_LABEL` and the grammars, come from `scene-binding-logic.ts`). */
export const MAX_SCRIPT_LENGTH = 200;

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

// ─── Value reading ───────────────────────────────────────────────────────────

const ON_OFF = new Set(['on', 'off', 'true', 'false', 'yes', 'no', 'open', 'closed', 'running', 'stopped', 'active', 'inactive', '0', '1']);

/** A value that is a state rather than a measure: a boolean, 0 or 1, or an on/off word. */
export function isBooleanish(v: unknown): boolean {
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return v === 0 || v === 1;
  if (typeof v === 'string') return ON_OFF.has(v.trim().toLowerCase());
  return false;
}

const isMeasure = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && !isBooleanish(v);
const isWord = (v: unknown): boolean => typeof v === 'string' && !isBooleanish(v) && v.trim() !== '';

/** The check a field's name implies, when it implies one. */
type Hint = (k: DeviceKey) => boolean;

const STATE_FIELDS = new Set(['running', 'on', 'enabled', 'active', 'open', 'alarm', 'fault', 'present']);
const WORD_FIELDS = new Set(['status', 'mode', 'quality', 'state', 'direction']);
const NUMBER_FIELDS = /^(value\d*|speed|position|level|flow|temperature|pressure|humidity|power|current|voltage|rpm|setpoint)$/;

function hintFor(name: string): Hint | null {
  const n = name.toLowerCase();
  if (STATE_FIELDS.has(n)) return (k) => isBooleanish(k.value);
  if (WORD_FIELDS.has(n)) return (k) => isWord(k.value) || isBooleanish(k.value);
  if (NUMBER_FIELDS.test(n)) return (k) => isMeasure(k.value) || (typeof k.value === 'number' && k.unit !== undefined && k.unit !== '');
  return null;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// ─── Suggesting a key ────────────────────────────────────────────────────────

/**
 * The key a field most likely reads, or null when it is not clear. Steps, first one with exactly one answer wins; a step with
 * several answers is ambiguous and stops the search (a wrong pick is worse than an empty one):
 *  1. `<element>.<field>` (the convention of a device that follows it), when the symbol's element is known;
 *  2. a key named like the field (`running`, `speed`, or any `<prefix>.<field>`);
 *  3. a key whose name or label equals, then contains, the field's name or label;
 *  4. the type: a state-like key for a state field, a measure for a value field, a word for a status field;
 *  5. the only key there is.
 */
export function suggestKeyForField(
  field: { name: string; label?: string },
  keys: readonly DeviceKey[],
  element?: string,
): string | null {
  if (keys.length === 0) return null;
  const name = field.name.toLowerCase();
  const nname = norm(field.name);
  const nlabel = field.label ? norm(field.label) : '';

  const one = (list: DeviceKey[]): string | null | undefined => (list.length === 1 ? list[0].key : list.length === 0 ? undefined : null);

  // 1. <element>.<field>
  if (element) {
    const want = `${element}.${field.name}`.toLowerCase();
    const r = one(keys.filter((k) => k.key.toLowerCase() === want));
    if (r !== undefined) return r;
  }

  // 2. named like the field
  const r2 = one(keys.filter((k) => {
    const lk = k.key.toLowerCase();
    return lk === name || lk.endsWith(`.${name}`);
  }));
  if (r2 !== undefined) return r2;

  // 3. equal, then contained (names of three letters or more, so `on` does not match everything)
  const words = [nname, nlabel].filter((w) => w.length > 0);
  const keyNames = (k: DeviceKey): string[] => [norm(k.key), k.label ? norm(k.label) : ''].filter((w) => w.length > 0);
  const r3a = one(keys.filter((k) => keyNames(k).some((kn) => words.includes(kn))));
  if (r3a !== undefined) return r3a;
  const long = words.filter((w) => w.length >= 3);
  const r3b = one(keys.filter((k) => keyNames(k).some((kn) => long.some((w) => kn.includes(w)))));
  if (r3b !== undefined) return r3b;

  // 4. the type the field's name implies
  const hint = hintFor(field.name);
  if (hint) {
    const r4 = one(keys.filter(hint));
    if (r4 !== undefined) return r4;
  }

  // 5. the only key
  return keys.length === 1 ? keys[0].key : null;
}

/**
 * A key for each field that has none: fields are answered in order and a key taken by one is not offered to the next, so two
 * numeric fields do not both land on the one numeric key.
 */
export function suggestKeysForFields(
  fields: readonly { name: string; label?: string }[],
  keys: readonly DeviceKey[],
  element?: string,
  taken: readonly string[] = [],
): Record<string, string> {
  const used = new Set(taken);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const pick = suggestKeyForField(f, keys.filter((k) => !used.has(k.key)), element);
    if (pick !== null) {
      out[f.name] = pick;
      used.add(pick);
    }
  }
  return out;
}

// ─── Age and values on screen ────────────────────────────────────────────────

/** The words of an age ("4 s ago"). The panel passes its messages; these are the English defaults. */
export interface AgeWords {
  now: string;
  seconds: (n: number) => string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
}

export const DEFAULT_AGE_WORDS: AgeWords = {
  now: 'just now',
  seconds: (n) => `${n} s ago`,
  minutes: (n) => `${n} min ago`,
  hours: (n) => `${n} h ago`,
  days: (n) => `${n} d ago`,
};

/** How long ago `ts` was, at `now` (epoch ms): "just now", "4 s ago", "3 min ago", "2 h ago", "5 d ago". '' for a date that is not one. */
export function ageText(ts: number | string, now: number, words: AgeWords = DEFAULT_AGE_WORDS): string {
  const t = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(t) || !Number.isFinite(now)) return '';
  const s = Math.floor((now - t) / 1000);
  if (s < 2) return words.now; // also a clock a little ahead of ours
  if (s < 60) return words.seconds(s);
  const m = Math.floor(s / 60);
  if (m < 60) return words.minutes(m);
  const h = Math.floor(m / 60);
  if (h < 48) return words.hours(h);
  return words.days(Math.floor(h / 24));
}

/** A value as the panel lists it: numbers trimmed to 3 decimals, a state as true / false, text as it is, anything else as short JSON. */
export function formatValue(value: unknown, unit?: string): string {
  let text: string;
  if (value === null || value === undefined) return '–';
  if (typeof value === 'number') text = Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '–';
  else if (typeof value === 'boolean') text = value ? 'true' : 'false';
  else if (typeof value === 'string') text = value;
  else {
    try {
      text = JSON.stringify(value) ?? '–';
    } catch {
      text = '–';
    }
  }
  if (text.length > 40) text = `${text.slice(0, 39)}…`;
  return unit && typeof value === 'number' ? `${text} ${unit}` : text;
}

/** A sample or a result in the preview line: text is quoted so `"on"` and `on` are told apart. */
export function formatSample(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 30 ? `${value.slice(0, 29)}…` : value);
  if (value === undefined) return 'nothing';
  return formatValue(value);
}

// ─── The one-liner ───────────────────────────────────────────────────────────

export type ScriptTemplateId = 'invert' | 'scale' | 'round' | 'threshold' | 'words';

export interface ScriptTemplate {
  id: ScriptTemplateId;
  script: string;
}

/** The quick-fill chips. `value` is the only variable a one-liner can use. The numbers are a starting point the person edits. */
export function scriptTemplates(): ScriptTemplate[] {
  return [
    { id: 'invert', script: '!value' },
    { id: 'scale', script: 'value / 4095 * 100' },
    { id: 'round', script: 'Math.round(value * 10) / 10' },
    { id: 'threshold', script: 'value > 80' },
    { id: 'words', script: 'value === "on"' },
  ];
}

export type ScriptErrorKind = 'syntax' | 'name' | 'timeout' | 'other';

/** Sorts the sandbox's own error text into the few cases the panel words in plain language. */
export function scriptErrorKind(error: string): ScriptErrorKind {
  const e = error.toLowerCase();
  if (/timed? ?out|timeout|too long|time limit/.test(e)) return 'timeout';
  if (/syntax|unexpected|unterminated|invalid or unexpected|missing \)|expected/.test(e)) return 'syntax';
  if (/not defined|is not a function|undefined variable|unknown name|cannot find/.test(e)) return 'name';
  return 'other';
}

export type ScriptOutcome = { ok: true; result: unknown } | { ok: false; error: string };

/** The preview line before the words: nothing to show, the pair `from → to`, or an error kind with the sandbox's own text. */
export type PreviewLine =
  | { kind: 'none' }
  | { kind: 'wait' }
  | { kind: 'ok'; from: string; to: string }
  | { kind: 'error'; error: ScriptErrorKind; detail: string };

/** `sample` is the key's live value (`undefined` when it has none yet). A blank script previews nothing. `outcome` is the host's answer. */
export function previewLine(script: string, sample: unknown, outcome: ScriptOutcome | null): PreviewLine {
  if (script.trim() === '') return { kind: 'none' };
  if (sample === undefined) return { kind: 'wait' };
  if (outcome === null) return { kind: 'none' };
  if (!outcome.ok) return { kind: 'error', error: scriptErrorKind(outcome.error), detail: outcome.error.trim().slice(0, 120) };
  return { kind: 'ok', from: formatSample(sample), to: formatSample(outcome.result) };
}

// ─── Draft, entry, dirty ─────────────────────────────────────────────────────

/** The draft the panel starts from: the device of the first field that has a source, else `fallback`; one draft per field. */
export function draftFromSymbol(symbol: Pick<SymbolSpec, 'fields'>, fallback?: { id: string; name: string } | null): BindingDraft {
  const first = symbol.fields.find((f) => f.currentSource);
  const device = first?.currentSource ? { id: first.currentSource.deviceId, name: first.currentSource.deviceName } : fallback ?? { id: '', name: '' };
  const fields: Record<string, FieldDraft> = {};
  for (const f of symbol.fields) {
    if (!isSymbolField(f.name)) continue;
    fields[f.name] = {
      deviceId: f.currentSource?.deviceId ?? '',
      deviceName: f.currentSource?.deviceName ?? '',
      key: f.currentSource?.key ?? '',
      label: '',
      script: f.currentScript ?? '',
    };
  }
  return { deviceId: device.id, deviceName: device.name, fields };
}

/**
 * The entry a draft saves. Fields with no key are dropped, texts are trimmed, a script is cut at 200 characters and a label at 60.
 * What the map v2 grammars refuse is left out, never cut (a cut key is another key): a field name that is not a symbol field
 * (prototype names too), a key that is not a telemetry key, a device id that is not a UUID. At most 16 fields. `deviceId` is
 * written on every field that has one.
 */
export function entryFromDraft(draft: BindingDraft): BindingEntry {
  const fields: Record<string, BindingEntryField> = {};
  let count = 0;
  for (const [rawName, f] of Object.entries(draft.fields)) {
    if (count >= MAX_FIELDS_PER_KEY) break;
    const name = rawName.trim();
    if (!isSymbolField(name)) continue;
    const key = f.key.trim();
    if (!isTelemetryKey(key)) continue;
    const deviceId = (f.deviceId || draft.deviceId || '').trim();
    if (deviceId && !UUID_GRAMMAR.test(deviceId)) continue;
    const out: BindingEntryField = { key };
    if (deviceId) out.deviceId = deviceId;
    const label = f.label.trim().slice(0, MAX_FIELD_LABEL);
    if (label) out.label = label;
    const script = f.script.trim().slice(0, MAX_SCRIPT_LENGTH);
    if (script) out.script = script;
    fields[name] = out;
    count += 1;
  }
  return { fields };
}

/** Two entries say the same thing. */
export function sameEntry(a: BindingEntry, b: BindingEntry): boolean {
  const ka = Object.keys(a.fields);
  const kb = Object.keys(b.fields);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!own(b.fields, k)) return false;
    const x = a.fields[k];
    const y = b.fields[k];
    if (x.key !== y.key || x.deviceId !== y.deviceId || x.label !== y.label || x.script !== y.script) return false;
  }
  return true;
}

/** The draft would save something other than `baseline` (an entry: what is saved now). */
export function isDirty(draft: BindingDraft, baseline: BindingEntry): boolean {
  return !sameEntry(entryFromDraft(draft), baseline);
}

/** The entry a symbol already has (what its fields' current sources and scripts say). */
export function entryFromSymbol(symbol: Pick<SymbolSpec, 'fields'>): BindingEntry {
  return entryFromDraft(draftFromSymbol(symbol));
}

/** Whether the symbol reads from anything now. */
export function isBound(symbol: Pick<SymbolSpec, 'fields'>): boolean {
  return symbol.fields.some((f) => f.currentSource && f.currentSource.key !== '');
}

/**
 * The symbol "Next symbol" goes to: the first unbound one after `currentId` in the drawing's order, wrapping round to the start;
 * null when every other symbol is bound (or there is no other). The current symbol is never its own next.
 */
export function nextUnbound(symbols: readonly { id: string; bound: boolean }[], currentId: string): string | null {
  const n = symbols.length;
  if (n === 0) return null;
  const at = symbols.findIndex((s) => s.id === currentId);
  for (let step = 1; step <= n; step += 1) {
    const s = symbols[((at < 0 ? -1 : at) + step) % n];
    if (s.id !== currentId && !s.bound) return s.id;
  }
  return null;
}
