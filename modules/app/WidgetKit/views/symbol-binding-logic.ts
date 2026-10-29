// The pure part of the symbol binding panel (next-boilerplate phase 45.4, D45-10; slice 16: U1 ranking, U2b expressions): what a symbol's
// fields read, the ranking of a device's keys for a field, the draft a person edits, the entry that is saved, the age of a value and the
// one-liner templates. No React, no DOM, no fetching: `SymbolBindingPanel.tsx` maps this to JSX and a host (or kui-ejs / KUInative)
// can reuse it as it is. The entry is the field map of the binding's map v2 (D45-3: `MapEntry.fields`, its grammars and caps are
// `scene-binding-logic.ts`'s, not redefined here): a field reads a device value (`key`), or an expression over named inputs, or both.

import {
  INPUT_NAME_GRAMMAR, MAX_FIELD_LABEL, MAX_FIELDS_PER_KEY, MAX_INPUTS_PER_FIELD, RESERVED_INPUT_NAMES, UUID_GRAMMAR, fieldHasSource, isInputName, isSymbolField, isTelemetryKey,
  type FieldInput, type FieldRead, type MapEntry,
} from './scene-binding-logic';

export { MAX_INPUTS_PER_FIELD };

// ─── Types ───────────────────────────────────────────────────────────────────

/** One named input of a field's expression as the host knows it now: its name in the formula, the device by name and the key. */
export interface InputSource {
  name: string;
  deviceId: string;
  deviceName: string;
  key: string;
}

/** Where a field of the symbol reads from now. `key` is '' for a field that is an expression over its inputs alone. */
export interface FieldSource {
  deviceId: string;
  deviceName: string;
  key: string;
  /**
   * The field has no entry of its own: the host found its source by the drawing's own rule (the symbol's group → the device,
   * the symbol's name → the value). The panel shows it filled in and says "automatic"; saving it unchanged writes nothing.
   */
  automatic?: boolean;
  /** The named inputs of the field's expression (slice 16). */
  inputs?: InputSource[];
}

/** What a field expects, when the drawing knows: a state (on/off), a number or a text. */
export type FieldKind = 'state' | 'number' | 'text';

/** One thing a symbol draws, in the symbol's own words (`running`, `value`, `status`, a 3D item's own parameter). */
export interface SymbolFieldSpec {
  /** The field's name in the binding (D45-3's `symbolField`). Never shown. */
  name: string;
  /** What the person sees: "Running", "Temperature". */
  label: string;
  /** What the drawing expects of it, when known (else guessed from the name). */
  kind?: FieldKind;
  /** The unit the drawing shows it in, when known. */
  unit?: string;
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

/** A device the search offers. `hint` is where it is (its place in the site or asset), shown under the name and used to group. */
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
  /** A connection of the drawing itself (a pipe run, a cable): never ranked or suggested, listed last in a picker. */
  internal?: boolean;
}

/** One field of a saved entry: the map v2 `FieldRead` (`deviceId` is left out when the field reads the entry's own device), the one-liner and its named inputs. */
export type BindingEntryField = FieldRead;

/** What `onSave` receives: a map v2 entry's `fields` (`MapEntry`) with each field's one-liner. An empty `fields` means "unbound". */
export interface BindingEntry extends Pick<MapEntry, 'fields'> {
  fields: Record<string, BindingEntryField>;
}

/** How a field reads: a device value, or an expression (over the picked value and named inputs). */
export type SourceMode = 'value' | 'expression';

/** One named input as the person edits it. */
export interface InputDraft {
  name: string;
  deviceId: string;
  deviceName: string;
  key: string;
  label: string;
}

export interface FieldDraft {
  deviceId: string;
  deviceName: string;
  key: string;
  label: string;
  script: string;
  /** The key is the automatic one the person has not touched: it is shown, but not written to the entry (unless it has a one-liner). */
  automatic?: boolean;
  mode: SourceMode;
  inputs: InputDraft[];
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

const STATE_FIELDS = new Set(['running', 'on', 'enabled', 'active', 'open', 'alarm', 'fault', 'present']);
const WORD_FIELDS = new Set(['status', 'mode', 'quality', 'state', 'direction']);
const NUMBER_FIELDS = /^(value\d*|speed|position|level|flow|temperature|pressure|humidity|power|current|voltage|rpm|setpoint)$/;

/** What a field expects: its own `kind`, else what its name implies, else null (an own parameter nobody described). */
export function fieldKindOf(field: { name: string; kind?: FieldKind }): FieldKind | null {
  if (field.kind) return field.kind;
  const n = field.name.toLowerCase();
  if (STATE_FIELDS.has(n)) return 'state';
  if (WORD_FIELDS.has(n)) return 'text';
  if (NUMBER_FIELDS.test(n)) return 'number';
  return null;
}

/** What a key sends, read off its live value: a state (a boolean, 0/1 with no unit, an on/off word), a number (a measure, or a number with a unit), a text; null when it has no value. */
export function keyKindOf(k: Pick<DeviceKey, 'value' | 'unit'>): FieldKind | null {
  const unit = k.unit !== undefined && k.unit !== '';
  if (typeof k.value === 'boolean') return 'state';
  if (typeof k.value === 'number') return Number.isFinite(k.value) ? (unit || isMeasure(k.value) ? 'number' : 'state') : null;
  if (typeof k.value === 'string') return isBooleanish(k.value) ? 'state' : isWord(k.value) ? 'text' : null;
  return null;
}

// ─── Words: the synonym table and the units ──────────────────────────────────

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** The words of a name: `supply_temp`, `supplyTemp`, `Supply temperature` all give `supply` and `temp`/`temperature`. */
export function wordsOf(s: string): string[] {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w !== '');
}

/**
 * Words that mean the same thing on a device and on a drawing. One line per concept: a field whose name or label holds any word of a line
 * is also looked for under the other words of that line (a drawing's "Reading" field finds a device's `temp_1`; "Running" finds `pump_on`).
 */
export const SYNONYMS: ReadonlyArray<ReadonlyArray<string>> = [
  ['running', 'run', 'on', 'off', 'active', 'state', 'enabled', 'enable', 'power', 'powered', 'started', 'start', 'switch', 'operating', 'working', 'is_on', 'motor'],
  ['status', 'state', 'mode', 'health', 'condition', 'alarm', 'fault', 'error', 'warning', 'code', 'phase'],
  ['value', 'reading', 'measure', 'measurement', 'pv', 'process', 'level', 'amount'],
  ['temperature', 'temp', 'tmp', 't', 'celsius', 'thermometer', 'thermostat'],
  ['flow', 'flowrate', 'flowmeter', 'lpm', 'm3h', 'gpm'],
  ['pressure', 'press', 'bar', 'psi'],
  ['humidity', 'hum', 'rh', 'moisture'],
  ['level', 'lvl', 'fill', 'filling', 'tank'],
  ['power', 'kw', 'watt', 'watts', 'load'],
  ['energy', 'kwh', 'consumption'],
  ['voltage', 'volt', 'volts', 'v'],
  ['current', 'amp', 'amps', 'ampere', 'a'],
  ['speed', 'rpm', 'frequency', 'freq', 'hz', 'rate', 'velocity'],
  ['position', 'opening', 'open', 'opened', 'pos', 'angle', 'travel', 'stroke', 'aperture', 'valve', 'damper'],
  ['direction', 'dir', 'forward', 'reverse', 'fwd', 'rev', 'rotation', 'heading'],
  ['value2', 'setpoint', 'sp', 'target', 'second', 'secondary', 'aux'],
  ['door', 'hatch', 'lid', 'cover'],
  ['weight', 'mass', 'kg'],
  ['volume', 'litre', 'liter', 'l'],
];

/**
 * The words a field is looked for under: its name, its label, the `hints` (the symbol's own words: a "Thermometer" looks for temperatures) and every
 * synonym of those. Words are matched whole (`rh` is a word, never a part of `through`).
 */
export function fieldWords(field: { name: string; label?: string }, hints: readonly string[] = []): Set<string> {
  const base = new Set([...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : []), ...hints.flatMap(wordsOf)]);
  const out = new Set(base);
  for (const line of SYNONYMS) if (line.some((w) => base.has(w))) for (const w of line) out.add(w);
  return out;
}

const UNIT_QUANTITY: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['temperature', ['°c', 'c', '°f', 'f', 'k', 'celsius', 'degc', 'deg']],
  ['flow', ['l/min', 'lpm', 'm3/h', 'm³/h', 'l/h', 'gpm', 'l/s']],
  ['pressure', ['bar', 'mbar', 'psi', 'pa', 'kpa', 'hpa', 'mpa']],
  ['percent', ['%', 'pct', 'percent']],
  ['speed', ['rpm']],
  ['frequency', ['hz', 'khz']],
  ['voltage', ['v', 'mv', 'kv']],
  ['current', ['a', 'ma']],
  ['power', ['w', 'kw', 'mw']],
  ['energy', ['kwh', 'wh', 'mwh']],
  ['length', ['m', 'cm', 'mm', 'km']],
  ['mass', ['kg', 'g', 't']],
  ['volume', ['l', 'm3', 'm³', 'ml']],
];
const QUANTITY_WORDS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['temperature', ['temperature', 'temp']], ['flow', ['flow']], ['pressure', ['pressure']], ['percent', ['humidity', 'opening', 'position', 'level', 'fill']],
  ['speed', ['speed', 'rpm']], ['frequency', ['frequency']], ['voltage', ['voltage']], ['current', ['current']], ['power', ['power']], ['energy', ['energy']],
];

/** The quantity a unit measures (`°C` → temperature, `l/min` → flow), or null for an unknown or absent unit. */
export function unitQuantity(unit: string | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  for (const [q, units] of UNIT_QUANTITY) if (units.includes(u)) return q;
  return null;
}

/** The synonym lines that name a thing's role (what it shows), not a quantity: never widened into a quantity. */
const NOT_A_QUANTITY = new Set(['value', 'value2', 'running', 'status', 'position', 'direction', 'door']);

/**
 * The quantity some words name (`temperature` or `temp` say temperature, `lpm` flow), or null. With `expand`, a word is widened by its synonym line first
 * (`hum` says humidity, a percent); the lines that name a role rather than a quantity (`value`, `running`, ...) are never widened.
 */
export function quantityOfWords(words: Iterable<string>, expand = false): string | null {
  const base = new Set(words);
  const all = new Set(base);
  if (expand) for (const line of SYNONYMS) if (!NOT_A_QUANTITY.has(line[0]) && line.some((w) => base.has(w))) for (const w of line) all.add(w);
  for (const [q, ws] of QUANTITY_WORDS) if (ws.some((w) => all.has(w))) return q;
  return null;
}

/** The quantity a field measures: its unit when the drawing gives one, else what its name or label says (its own words, never widened), else null. */
export function fieldQuantity(field: { name: string; label?: string; unit?: string }): string | null {
  return unitQuantity(field.unit) ?? quantityOfWords([...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : [])]);
}

/** The quantity a key measures: its unit, else what its name or label says (`temp_1` is a temperature, `flow_lpm` a flow), else null. */
export function keyQuantity(k: Pick<DeviceKey, 'key' | 'label' | 'unit'>): { quantity: string; byUnit: boolean } | null {
  const byUnit = unitQuantity(k.unit);
  if (byUnit) return { quantity: byUnit, byUnit: true };
  const local = k.key.slice(k.key.lastIndexOf('.') + 1);
  const byWords = quantityOfWords([...wordsOf(local), ...(k.label ? wordsOf(k.label) : [])], true);
  return byWords ? { quantity: byWords, byUnit: false } : null;
}

// ─── Ranking a device's keys for a field (U1) ────────────────────────────────

/** Why a key does not fit the field, in a word the panel turns into a sentence: its kind, or the quantity it measures (`quantity`: a temperature for an opening). */
export type Mismatch = 'text-for-number' | 'state-for-number' | 'number-for-state' | 'text-for-state' | 'number-for-text' | 'quantity';

/** `symbol`: the shared word came from the symbol's own words (its label or kind), not from the field's: a reason specific to THIS symbol. */
export type RankReason = 'element' | 'name' | 'synonym' | 'symbol' | 'contains' | 'type' | 'unit' | 'only';

/** One key of the device as a candidate for a field: its score, whether the panel may pick it by itself, why, and the kind problem if it has one. */
export interface RankedKey {
  key: string;
  score: number;
  confident: boolean;
  reasons: RankReason[];
  mismatch?: Mismatch;
  /**
   * The key belongs to ANOTHER piece of equipment of the device (its `<element>.` prefix shares no word with the symbol's own label or kind, and
   * the element rule did not match): a basin's Running is never the drain valve's by itself (next-boilerplate e2e round 2, E2E-2.11). Offered, never
   * picked without asking.
   */
  foreign?: boolean;
}

/** The kind problem of feeding `key` to `field`, or null when the kinds agree or one of them is not known. */
export function mismatchOf(field: { name: string; kind?: FieldKind }, key: Pick<DeviceKey, 'value' | 'unit'>): Mismatch | null {
  const want = fieldKindOf(field);
  const got = keyKindOf(key);
  if (!want || !got || want === got) return null;
  if (want === 'number') return got === 'text' ? 'text-for-number' : 'state-for-number';
  if (want === 'state') return got === 'text' ? 'text-for-state' : 'number-for-state';
  // a status shows a state as a word; a bare number is seldom a status (found on the real drawing: a tee's Status offered a temperature as certain)
  return got === 'number' ? 'number-for-text' : null;
}

/**
 * The score a kind pairing adds: agreement earns (more when the key is the ONLY one of that kind the device sends: the one state of a device is what
 * a Running field most likely reads, but a kind alone never makes a certainty: a tee's Running is not the device's one door), a mismatch costs (a state
 * for a number only a little: 0/1 may well be a reading at rest).
 */
function typeScore(field: { name: string; kind?: FieldKind }, key: Pick<DeviceKey, 'value' | 'unit'>, onlyOfKind: boolean): number {
  const want = fieldKindOf(field);
  const got = keyKindOf(key);
  if (!want || !got) return 0;
  if (want === got) return onlyOfKind ? KIND_ALONE_SCORE : 15;
  if (want === 'text') return got === 'state' ? 10 : 0;
  return mismatchOf(field, key) === 'state-for-number' ? -10 : -45;
}

/** A score from this on, with no better rival nearby and no mismatch, is picked without asking. */
export const CONFIDENT_SCORE = 60;
/** The best must lead the second by this much to be picked by itself. */
export const CONFIDENT_LEAD = 15;
/** Below this a candidate is not even offered as "Suggested: …": a kind alone among several (15) says too little. */
export const MIN_PROPOSAL_SCORE = 30;
/**
 * What the only key of the field's kind earns when no word says anything: offered as "Suggested: …" (above `MIN_PROPOSAL_SCORE`), never picked by
 * itself (below `CONFIDENT_SCORE`). A word of the field's, of the symbol's, the element rule or a unit is what makes a pick certain.
 */
export const KIND_ALONE_SCORE = 50;

/**
 * The keys the ranking may propose: a key the host marked internal (a connection of the drawing itself: a pipe run, a cable) is never ranked or
 * suggested. The panel still lists such a key, last, so nothing a device sends is ever out of a person's reach.
 */
export const pickableKeys = (keys: readonly DeviceKey[]): DeviceKey[] => keys.filter((k) => !k.internal);

/**
 * Every pickable key of the device ranked for `field`, best first (a tie keeps the host's order). Reasons, in the order they are scored:
 *  element  `<element>.<field>` exactly (the convention of a device that follows it), when the symbol's element is known: 100;
 *  name     the key's local part (after its last dot), or its label, is the field's name or label: 80;
 *  synonym  the key and the field share a whole word, or a synonym of one (`Reading` of a thermometer finds `temp_1`, `Running` finds `pump_on`): 65,
 *           and 15 more for each further shared word (`Supply temperature` beats `Return temperature` for a supply field);
 *  symbol   the key shares a word of the SYMBOL's own (its label or kind: Door ↔ `door`, Circulation pump ↔ `pump_on`): 65 on its own, 15 beside a
 *           name or synonym match; the one reason that ties a key to this symbol rather than to any symbol with the same parameter;
 *  contains the key holds a word of the field of four letters or more: 55;
 *  type     what the key sends agrees with what the field expects: 15, or `KIND_ALONE_SCORE` (50: offered, never certain) when it is the only key of
 *           that kind the device sends and no key matched by a word (words first, the kind as the fallback); a mismatch is flagged and costs (45;
 *           10 for a 0/1 where a number is expected);
 *  unit     the key measures what the field measures (by its unit: 45; by its words, `temp_1` for a temperature: 20); a different quantity costs 20
 *           and bars the kind fallback (a temperature is never the one number a speed reads);
 *  only     the one key there is, when nothing else says anything: 60.
 * `hints` are the symbol's own words (its label and kind), used for a number field whose own words say no quantity ("Reading" of a "Thermometer").
 * `confident` is on the best alone: a score from `CONFIDENT_SCORE`, no mismatch, not `foreign`, and a lead of `CONFIDENT_LEAD` over the next.
 * `foreign`: a key under another piece of equipment's prefix (`drain_valve.running` for an "Open basin"), told by the symbol's own raw words (no synonyms:
 * "open" must not reach "valve" through the position line); the element rule overrides it.
 */
export function rankKeysForField(
  field: { name: string; label?: string; kind?: FieldKind; unit?: string },
  keys: readonly DeviceKey[],
  element?: string,
  taken: readonly string[] = [],
  hints: readonly string[] = [],
): RankedKey[] {
  const used = new Set(taken);
  const list = pickableKeys(keys).filter((k) => !used.has(k.key));
  if (list.length === 0) return [];
  const want = `${element ?? ''}.${field.name}`.toLowerCase();
  const name = norm(field.name);
  const label = field.label ? norm(field.label) : '';
  const kind = fieldKindOf(field);
  const useHints = kind === 'number' || kind === null;
  const words = fieldWords(field, useHints ? hints : []);
  // the symbol's own words (and their synonyms), apart: a key that shares one of them is matched to THIS symbol, not to any symbol with the same field
  const ownWords = fieldWords({ name: '' }, hints);
  const fieldOnly = fieldWords(field);
  const long = [...new Set([...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : [])])].filter((w) => w.length >= 4);
  const quantity = fieldQuantity(field) ?? (useHints ? fieldQuantity({ name: hints.join(' ') }) : null);
  const kinds = new Map<FieldKind | null, number>();
  for (const k of list) kinds.set(keyKindOf(k), (kinds.get(keyKindOf(k)) ?? 0) + 1);
  // the symbol's own words as written (no synonyms): what tells its equipment from another's
  const rawOwn = new Set(hints.flatMap(wordsOf));
  // first the words (the element, a name, a shared word, a contained word) …
  const worded = list.map((k) => {
    const reasons: RankReason[] = [];
    let score = 0;
    const lower = k.key.toLowerCase();
    const local = lower.slice(lower.lastIndexOf('.') + 1);
    const prefix = lower.includes('.') ? lower.slice(0, lower.lastIndexOf('.')) : '';
    const nlocal = norm(local);
    const nlabel = k.label ? norm(k.label) : '';
    if (element && lower === want) { score += 100; reasons.push('element'); }
    if (nlocal === name || (label && (nlocal === label || nlabel === label)) || (nlabel && nlabel === name)) { score += 80; reasons.push('name'); }
    const keyWords = new Set([...wordsOf(local), ...(k.label ? wordsOf(k.label) : [])]);
    const shared = [...keyWords].filter((w) => words.has(w)).length;
    if (!reasons.includes('name') && shared > 0) { score += 65 + Math.min(2, shared - 1) * 15; reasons.push('synonym'); }
    // a word of the symbol's own (Door ↔ `door`, Circulation pump ↔ `pump_on`): a match to THIS symbol, scored like a synonym, a second signal beside one
    if ([...keyWords].some((w) => ownWords.has(w) && !fieldOnly.has(w))) { score += reasons.length === 0 ? 65 : 15; reasons.push('symbol'); }
    if (reasons.length === 0 && long.some((w) => nlocal.includes(w) || nlabel.includes(w))) { score += 55; reasons.push('contains'); }
    // another piece of equipment of the same device: the key's prefix names nothing of this symbol (and the element rule did not claim it)
    const foreign = prefix !== '' && rawOwn.size > 0 && !reasons.includes('element') && !wordsOf(prefix).some((w) => rawOwn.has(w));
    return { k, reasons, score, foreign };
  });
  // … then the kind: the only key of the field's kind decides by itself only when no key matched by a word (words first, the kind as the fallback)
  const anyWords = worded.some((w) => w.reasons.length > 0);
  const ranked = worded.map(({ k, reasons, score: base, foreign }): RankedKey => {
    let score = base;
    const kq = quantity ? keyQuantity(k) : null;
    const contradicts = !!kq && kq.quantity !== quantity;
    const t = typeScore(field, k, !anyWords && !contradicts && kinds.get(keyKindOf(k)) === 1);
    if (t !== 0) { score += t; reasons.push('type'); }
    if (kq) { score += contradicts ? -20 : kq.byUnit ? 45 : 20; reasons.push('unit'); }
    if (list.length === 1 && reasons.length === 0) { score += 60; reasons.push('only'); }
    // a key that measures another quantity than the field is never picked by itself, whatever word it shares (a supply temperature for a valve's opening)
    const mismatch = mismatchOf(field, k) ?? (contradicts ? 'quantity' : null);
    return { key: k.key, score, confident: false, reasons, ...(mismatch ? { mismatch } : {}), ...(foreign ? { foreign } : {}) };
  }).filter((r) => r.score > 0);
  ranked.sort((a, b) => b.score - a.score);
  const [top, second] = ranked;
  if (top && top.score >= CONFIDENT_SCORE && !top.mismatch && !top.foreign && (second === undefined || top.score - second.score >= CONFIDENT_LEAD)) top.confident = true;
  return ranked;
}

/**
 * The key a field most likely reads, or null when it is not clear: the best of `rankKeysForField` when it is confident. A field with
 * several equally good candidates gets none (a wrong pick is worse than an empty one: the person chooses from the ranked list).
 */
export function suggestKeyForField(
  field: { name: string; label?: string; kind?: FieldKind; unit?: string },
  keys: readonly DeviceKey[],
  element?: string,
  hints: readonly string[] = [],
): string | null {
  const [top] = rankKeysForField(field, keys, element, [], hints);
  return top && top.confident ? top.key : null;
}

/**
 * A key for each field that has none: fields are answered in order and a key taken by one is not offered to the next, so two
 * numeric fields do not both land on the one numeric key.
 */
export function suggestKeysForFields(
  fields: readonly { name: string; label?: string; kind?: FieldKind; unit?: string }[],
  keys: readonly DeviceKey[],
  element?: string,
  taken: readonly string[] = [],
  hints: readonly string[] = [],
): Record<string, string> {
  const used = new Set(taken);
  const out: Record<string, string> = {};
  for (const f of fields) {
    const pick = suggestKeyForField(f, keys.filter((k) => !used.has(k.key)), element, hints);
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

/** The quick-fill chips, each an expression over `value` (the field's picked value); the numbers are a starting point the person edits. */
export function scriptTemplates(): ScriptTemplate[] {
  return [
    { id: 'invert', script: '!value' },
    { id: 'scale', script: 'value / 4095 * 100' },
    { id: 'round', script: 'Math.round(value * 10) / 10' },
    { id: 'threshold', script: 'value > 80' },
    { id: 'words', script: 'value === "on"' },
  ];
}

/** A template written for a field that has no picked value: `value` becomes the first input's name, so the chip means something there too. */
export function templateFor(template: ScriptTemplate, inputs: readonly { name: string }[], hasValue: boolean): string {
  if (hasValue || inputs.length === 0) return template.script;
  return template.script.replace(/\bvalue\b/g, inputs[0].name);
}

/** The bare names an expression of this field may read: the fixed three and the field's inputs, in that order (the editor's completion). */
export function expressionNames(inputs: readonly { name: string }[]): string[] {
  return ['value', 'row', 'now', ...inputs.map((i) => i.name)];
}

/**
 * A readable name for an input, from its KEY (`temp_24h` stays `temp_24h`; `oven.door_open` is `door_open`, `pool.value` is `pool_value`; next-boilerplate
 * e2e round 2, E2E-2.12: a name cut from the label, "pool_temperatu_2", told two values apart by nothing): lower-case words joined by `_`, at most 16
 * characters (a long text drops its leading words first), never a word of the formula language (`return` → `return_in`) and never one already
 * `taken` (`temp` → `temp_2`). `v_` leads a name that would start with a digit; a text with no letter or digit at all becomes `input`.
 */
export function defaultInputName(text: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  // a dotted key reads by its local part (`oven.door_open` → `door_open`) unless that is a word of the language or taken already (`pool.value` → `pool_value`)
  const local = text.includes('.') ? text.slice(text.lastIndexOf('.') + 1) : '';
  const localName = local ? wordsOf(local).join('_') : '';
  const words = localName && !RESERVED_INPUT_NAMES.has(localName) && !used.has(localName) ? wordsOf(local) : wordsOf(text);
  while (words.length > 1 && words.join('_').length > 16) words.shift();
  let base = words.join('_');
  if (!base) base = 'input';
  if (/^[0-9]/.test(base)) base = `v_${base}`;
  base = base.slice(0, 16).replace(/_+$/, '') || 'input';
  if (RESERVED_INPUT_NAMES.has(base)) base = `${base.slice(0, 13)}_in`;
  if (!INPUT_NAME_GRAMMAR.test(base)) base = 'input';
  let name = base;
  for (let n = 2; used.has(name); n += 1) name = `${base.slice(0, 16 - `_${n}`.length)}_${n}`;
  return name;
}

export type ScriptErrorKind = 'syntax' | 'name' | 'timeout' | 'other';

/** Sorts the sandbox's own error text into the few cases the panel words in plain language. */
export function scriptErrorKind(error: string): ScriptErrorKind {
  const e = error.toLowerCase();
  if (/timed? ?out|timeout|too long|time limit/.test(e)) return 'timeout';
  if (/syntax|unexpected|unterminated|invalid or unexpected|missing \)|expected|not valid|not allowed|ends too soon|is empty/.test(e)) return 'syntax';
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

const inputDraftOf = (i: InputSource): InputDraft => ({ name: i.name, deviceId: i.deviceId, deviceName: i.deviceName, key: i.key, label: '' });

/** A field is in expression mode when it has a one-liner or named inputs; a bare key is a device value. */
export const modeOf = (f: { script?: string; inputs?: readonly unknown[] }): SourceMode => ((f.script ?? '').trim() !== '' || (f.inputs?.length ?? 0) > 0 ? 'expression' : 'value');

/** The draft the panel starts from: the device of the first field that has a source, else `fallback`; one draft per field. */
export function draftFromSymbol(symbol: Pick<SymbolSpec, 'fields'>, fallback?: { id: string; name: string } | null): BindingDraft {
  const first = symbol.fields.find((f) => f.currentSource);
  const device = first?.currentSource ? { id: first.currentSource.deviceId, name: first.currentSource.deviceName } : fallback ?? { id: '', name: '' };
  const fields: Record<string, FieldDraft> = {};
  for (const f of symbol.fields) {
    if (!isSymbolField(f.name)) continue;
    const inputs = (f.currentSource?.inputs ?? []).map(inputDraftOf);
    const script = f.currentScript ?? '';
    fields[f.name] = {
      deviceId: f.currentSource?.deviceId ?? '',
      deviceName: f.currentSource?.deviceName ?? '',
      key: f.currentSource?.key ?? '',
      label: '',
      script,
      ...(f.currentSource?.automatic && f.currentSource.key !== '' ? { automatic: true } : {}),
      mode: modeOf({ script, inputs }),
      inputs,
    };
  }
  return { deviceId: device.id, deviceName: device.name, fields };
}

/**
 * The entry a draft saves. Texts are trimmed, a script is cut at 200 characters and a label at 60. What the map v2 grammars refuse is left out,
 * never cut (a cut key is another key): a field name that is not a symbol field (prototype names too), a key that is not a telemetry key, a device
 * id that is not a UUID, an input whose name or key the grammar refuses. A field is written when it reads a key, or an expression (`script`) over
 * at least one input, or both; inputs without a script are dropped (nothing would read them); a field with neither is left out. At most 16 fields,
 * at most 4 inputs each. `deviceId` is written on every field and input that has one. A field still on its `automatic` source (see `FieldSource`)
 * is left out unless it has a one-liner: only what the person changed or filled is written.
 */
export function entryFromDraft(draft: BindingDraft): BindingEntry {
  const fields: Record<string, BindingEntryField> = {};
  let count = 0;
  for (const [rawName, f] of Object.entries(draft.fields)) {
    if (count >= MAX_FIELDS_PER_KEY) break;
    const name = rawName.trim();
    if (!isSymbolField(name)) continue;
    const key = f.key.trim();
    const script = f.script.trim().slice(0, MAX_SCRIPT_LENGTH);
    // An automatic key the person has not touched is not theirs to write; with a one-liner on it, it is.
    if (f.automatic && script === '') continue;
    const deviceId = (f.deviceId || draft.deviceId || '').trim();
    if (deviceId && !UUID_GRAMMAR.test(deviceId)) continue;
    const out: BindingEntryField = {};
    if (key !== '') {
      if (!isTelemetryKey(key)) continue;
      out.key = key;
    }
    if (deviceId) out.deviceId = deviceId;
    const label = f.label.trim().slice(0, MAX_FIELD_LABEL);
    if (label) out.label = label;
    if (script) {
      out.script = script;
      const inputs: Record<string, FieldInput> = {};
      const names = new Set<string>();
      for (const i of f.inputs) {
        if (Object.keys(inputs).length >= MAX_INPUTS_PER_FIELD) break;
        const iname = i.name.trim();
        const ikey = i.key.trim();
        if (!isInputName(iname) || names.has(iname) || !isTelemetryKey(ikey)) continue;
        const idevice = (i.deviceId || '').trim();
        if (idevice && !UUID_GRAMMAR.test(idevice)) continue;
        names.add(iname);
        inputs[iname] = { key: ikey, ...(idevice && idevice !== deviceId ? { deviceId: idevice } : {}) };
      }
      if (Object.keys(inputs).length > 0) out.inputs = inputs;
    }
    if (!fieldHasSource(out)) continue;
    fields[name] = out;
    count += 1;
  }
  return { fields };
}

const inputsText = (i: Record<string, FieldInput> | undefined): string => JSON.stringify(Object.entries(i ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)).map(([n, v]) => [n, v.key, v.deviceId ?? null]));

/** Two entries say the same thing. */
export function sameEntry(a: BindingEntry, b: BindingEntry): boolean {
  const ka = Object.keys(a.fields);
  const kb = Object.keys(b.fields);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!own(b.fields, k)) return false;
    const x = a.fields[k];
    const y = b.fields[k];
    if (x.key !== y.key || x.deviceId !== y.deviceId || x.label !== y.label || x.script !== y.script || inputsText(x.inputs) !== inputsText(y.inputs)) return false;
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

/** Whether the symbol reads from anything now (an automatic source counts: the symbol draws live data). */
export function isBound(symbol: Pick<SymbolSpec, 'fields'>): boolean {
  return symbol.fields.some((f) => f.currentSource && (f.currentSource.key !== '' || (f.currentSource.inputs?.length ?? 0) > 0));
}

/** Whether the symbol has an entry of its own: some field reads from a source the person (or a bulk action) set, not an automatic one. */
export function hasOwnEntry(symbol: Pick<SymbolSpec, 'fields'>): boolean {
  return symbol.fields.some((f) => f.currentSource && (f.currentSource.key !== '' || (f.currentSource.inputs?.length ?? 0) > 0) && !f.currentSource.automatic);
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

// ─── Match everything (U3): one proposal per unconnected parameter of the drawing ──────────────────────────────────────────────

/** One symbol of the drawing as "Match everything" sees it: its words, its device (the page's, or its group's), and the parameters still to connect. */
export interface MatchSymbol {
  id: string;
  label: string;
  kindLabel: string;
  /** The symbol's element for the `<element>.<field>` rule, when known. */
  element?: string;
  deviceId: string;
  deviceName: string;
  fields: ReadonlyArray<{ name: string; label: string; kind?: FieldKind; unit?: string }>;
  /** The keys the symbol's other parameters read already (its own entries, the drawing's own naming): never proposed again for it. */
  taken?: readonly string[];
}

/** One row of the preview table: a parameter of a symbol with the device value proposed for it. */
export type MatchRow = {
  /** `<symbol id>.<field>`; internal. */
  id: string;
  symbolId: string;
  symbolLabel: string;
  kindLabel: string;
  field: string;
  fieldLabel: string;
  deviceId: string;
  deviceName: string;
  key: string;
  keyLabel: string;
  value: unknown;
  unit?: string;
  ts: number | string;
  /** The panel would have picked it by itself: checked by default. */
  confident: boolean;
  mismatch?: Mismatch;
};

/**
 * The proposals for a whole drawing: for every parameter of every symbol, the best key of the symbol's device by `rankKeysForField` (the element rule, the
 * words of the symbol, the kind, the unit), one key per symbol at most once. A parameter with no candidate, a candidate under `MIN_PROPOSAL_SCORE`, or a tie
 * at the top (nobody's pick), has no row; a confident one is checked by default, a weaker one is offered unchecked, a mismatch is said. A device whose keys
 * are not known proposes nothing.
 */
export function matchAllRows(symbols: readonly MatchSymbol[], keysByDevice: ReadonlyMap<string, readonly DeviceKey[]>): MatchRow[] {
  const out: MatchRow[] = [];
  // the reasons of each row, kept aside: a key proposed for the same parameter of several symbols is certain only where a reason names THAT symbol
  const reasonsOf = new Map<string, readonly RankReason[]>();
  for (const s of symbols) {
    const keys = keysByDevice.get(s.deviceId);
    if (!keys || keys.length === 0) continue;
    const taken: string[] = [...(s.taken ?? [])];
    for (const f of s.fields) {
      const [top, second] = rankKeysForField(f, keys, s.element, taken, [s.label, s.kindLabel]);
      if (!top || top.score < MIN_PROPOSAL_SCORE || (second && second.score === top.score)) continue;
      const k = keys.find((x) => x.key === top.key);
      if (!k) continue;
      taken.push(top.key);
      const id = `${s.id}.${f.name}`;
      reasonsOf.set(id, top.reasons);
      out.push({
        id, symbolId: s.id, symbolLabel: s.label, kindLabel: s.kindLabel, field: f.name, fieldLabel: f.label,
        deviceId: s.deviceId, deviceName: s.deviceName, key: k.key, keyLabel: k.label && k.label.trim() ? k.label : k.key, value: k.value,
        ...(k.unit ? { unit: k.unit } : {}), ts: k.ts, confident: top.confident, ...(top.mismatch ? { mismatch: top.mismatch } : {}),
      });
    }
  }
  // the one state key of a device fits the Running of every symbol by its kind alone: proposed to each, certain only for the symbol it names
  // (the element rule, or a word of the symbol's own), so a whole drawing is never ticked onto one key by accident
  const claims = new Map<string, number>();
  for (const r of out) { const k = `${r.deviceId}\n${r.field}\n${r.key}`; claims.set(k, (claims.get(k) ?? 0) + 1); }
  for (const r of out) {
    const reasons = reasonsOf.get(r.id) ?? [];
    if (r.confident && (claims.get(`${r.deviceId}\n${r.field}\n${r.key}`) ?? 0) > 1 && !reasons.includes('element') && !reasons.includes('symbol')) r.confident = false;
  }
  return out;
}

/** The entries "Match everything" writes for the chosen rows: one per symbol, each field read from the proposed key of the symbol's device. */
export function entriesOfMatches(rows: readonly MatchRow[], chosen: ReadonlySet<string>): Record<string, BindingEntry> {
  const out: Record<string, BindingEntry> = {};
  for (const r of rows) {
    if (!chosen.has(r.id) || !isSymbolField(r.field) || !isTelemetryKey(r.key) || !UUID_GRAMMAR.test(r.deviceId)) continue;
    const entry = (out[r.symbolId] ??= { fields: {} });
    entry.fields[r.field] = { deviceId: r.deviceId, key: r.key, ...(r.keyLabel && r.keyLabel !== r.key ? { label: r.keyLabel.slice(0, MAX_FIELD_LABEL) } : {}) };
  }
  return out;
}
