// The pure part of the symbol binding panel (next-boilerplate phase 45.4, D45-10; slice 16: U1 ranking, U2b expressions): what a symbol's
// fields read, the ranking of a device's keys for a field, the draft a person edits, the entry that is saved, the age of a value and the
// one-liner templates. No React, no DOM, no fetching: `SymbolBindingPanel.tsx` maps this to JSX and a host (or kui-ejs / KUInative)
// can reuse it as it is. The entry is the field map of the binding's map v2 (D45-3: `MapEntry.fields`, its grammars and caps are
// `scene-binding-logic.ts`'s, not redefined here): a field reads a device value (`key`), or an expression over named inputs, or both.

import {
  INPUT_NAME_GRAMMAR, MAX_FIELD_LABEL, MAX_FIELDS_PER_KEY, MAX_INPUTS_PER_FIELD, RESERVED_INPUT_NAMES, UUID_GRAMMAR, elementLabelOf, fieldHasSource, foldText, isInputName, isSymbolField,
  isTelemetryKey, sameWords, textWords, type FieldInput, type FieldRead, type MapEntry,
} from './scene-binding-logic';

export { MAX_INPUTS_PER_FIELD, elementLabelOf, foldText, sameWords };

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

/** Whether a field is proposed by itself: always (`true`), never (`false`), or only from the symbol's own part (`'own'`, see `SymbolFieldSpec.suggest`). */
export type SuggestMode = boolean | 'own';

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
  /**
   * `false`: the row is offered (its picker lists every value of the device) but nothing is picked or proposed for it by itself, here or in "Match
   * everything": a symbol that measures draws whether it runs and its status only when the person says so (next-boilerplate e2e round 5, E5: every gauge
   * of a floor got "Running ← Panel on battery"). `'own'`: proposed only from the symbol's own part: a key the element rule or the symbol's name reaches,
   * or a key of the part another of its fields reads (a detector's `h2s.status` beside its `h2s.value`; next-boilerplate phase 52.2.6: a measuring
   * symbol's Status, so its alarm state comes through). Default true.
   */
  suggest?: SuggestMode;
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
  /** Whether the device's profile declares the key (false: a key the device sent that its profile does not know; the picker says so). Unknown when absent. */
  declared?: boolean;
  /**
   * The type the device's profile declares for the key, when it declares one: what the value IS, before any guess from the value itself (next-boilerplate
   * e2e round 5, V1-B19: a text state RUNNING / JAMMED was called on/off because one live value read like a state word).
   */
  type?: 'number' | 'boolean' | 'string';
  /** The scale the profile declares for the key (its raw range), when it does: the 0–100 helper starts from it (e2e round 5, E15). */
  min?: number;
  max?: number;
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

/** Words of a key's name that make a 0 / 1 a state (`pump_running`, `door_open`, `alarm`, `Çalışıyor`), folded as `textWords` gives them. */
const STATE_NAME_WORDS = new Set([
  ...STATE_FIELDS, 'run', 'off', 'enable', 'state', 'status', 'door', 'switch', 'relay', 'trip', 'tripped', 'error', 'closed', 'close', 'stop', 'stopped',
  'started', 'start', 'onoff', 'ok', 'fail', 'failed', 'leak', 'motion', 'occupied', 'presence', 'calisiyor', 'calisma', 'devrede', 'acik', 'kapali', 'ariza', 'alarm',
]);
/** Words of a key's name that make a 0 / 1 a count or a measure (`bags_per_hour`, `flow_rate`, `level`). */
const MEASURE_NAME_WORDS = new Set([
  'per', 'rate', 'count', 'counter', 'total', 'hour', 'hours', 'minute', 'second', 'daily', 'level', 'flow', 'speed', 'temperature', 'temp', 'pressure',
  'humidity', 'voltage', 'rpm', 'load', 'percent', 'pct', 'value', 'reading', 'volume', 'weight', 'sayi', 'adet', 'seviye', 'debi',
]);
const nameWordsOf = (k: Partial<Pick<DeviceKey, 'key' | 'label'>>): string[] => [...textWords(k.key ?? ''), ...textWords(k.label ?? '')];
const nameSaysState = (k: Partial<Pick<DeviceKey, 'key' | 'label'>>): boolean => nameWordsOf(k).some((w) => STATE_NAME_WORDS.has(w));
const nameSaysMeasure = (k: Partial<Pick<DeviceKey, 'key' | 'label'>>): boolean => nameWordsOf(k).some((w) => MEASURE_NAME_WORDS.has(w));
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

/**
 * What a key sends. The type its profile declares comes first (a declared boolean is a state, a declared text is a text whatever word it holds now: an on/off
 * word is a state only for a boolean key, V1-B19); a declared number is a measure unless it is a 0/1 with no unit. With no declared type it is read off the
 * live value: a state (a boolean, 0/1 with no unit, an on/off word), a number (a measure, or a number with a unit), a text; null when it has no value.
 */
export function keyKindOf(k: Pick<DeviceKey, 'value' | 'unit' | 'type'> & Partial<Pick<DeviceKey, 'key' | 'label'>>): FieldKind | null {
  const unit = k.unit !== undefined && k.unit !== '';
  const zeroOne = typeof k.value === 'number' && Number.isFinite(k.value) && !unit && (k.value === 0 || k.value === 1);
  if (k.type === 'boolean') return 'state';
  if (k.type === 'string') return 'text';
  // a declared number that is 0 or 1 now is a state only when its name says so (run 3 note 61: "Bags per hour" at 0 was called on/off)
  if (k.type === 'number') return zeroOne && nameSaysState(k) && !nameSaysMeasure(k) ? 'state' : 'number';
  if (typeof k.value === 'boolean') return 'state';
  // an undeclared 0 or 1 is a state unless its name says it counts or measures (`alarm_count` counts, whatever else it names)
  if (zeroOne) return nameSaysMeasure(k) ? 'number' : 'state';
  if (typeof k.value === 'number') return Number.isFinite(k.value) ? (unit || isMeasure(k.value) ? 'number' : 'state') : null;
  if (typeof k.value === 'string') return isBooleanish(k.value) ? 'state' : isWord(k.value) ? 'text' : null;
  return null;
}

// ─── Words: the synonym table and the units ──────────────────────────────────

const norm = (s: string): string => foldText(s).replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * The words of a name: `supply_temp`, `supplyTemp`, `Supply temperature` all give `supply` and `temp`/`temperature`. Words are Unicode letters and digits,
 * folded (`Açıklık` is the word `aciklik`; next-boilerplate e2e round 5, E3: an ASCII split cut it into `a`, `kl`, `k`, which "Bulanıklık" shared).
 */
export function wordsOf(s: string): string[] {
  return textWords(s);
}

/** A word that can match a word of a key: two letters or more, not a bare number (a symbol's "1" or "A" tells it from its twin, it names nothing). */
const matchable = (w: string): boolean => w.length > 1 && !/^\d+$/.test(w);

/**
 * The one Turkish–English word table (next-boilerplate phase 52.2.3, D585): one line per thing, the English word first, then its other English words
 * and its Turkish ones, folded as `wordsOf` gives them (`sag` for "sağ", `basinc` for "basınç") and with the forms a Turkish compound takes ("Dozaj
 * pompası", "Çarşı deposu"). Used by the synonym lines (`SYNONYMS` takes every translation of its words), by the words a field or a symbol is looked
 * for under (`fieldWords`), and by a device's name or place against a symbol's name (`deviceNameRelation`: "Kat 3 oksijen" against "Floor 3 gas alarm
 * panel"). A line names one thing; it never makes two different things one ("left" and "right" stay two lines).
 */
export const WORD_TABLE: ReadonlyArray<ReadonlyArray<string>> = [
  ['floor', 'storey', 'kat', 'kati'],
  ['left', 'sol'],
  ['right', 'sag'],
  ['upper', 'top', 'ust'],
  ['lower', 'bottom', 'alt'],
  ['north', 'kuzey'],
  ['south', 'guney'],
  ['east', 'dogu'],
  ['west', 'bati'],
  ['main', 'ana'],
  ['spare', 'standby', 'yedek'],
  ['inlet', 'intake', 'giris', 'girisi'],
  ['outlet', 'discharge', 'cikis', 'cikisi'],
  ['oxygen', 'o2', 'oksijen'],
  ['vacuum', 'vac', 'vakum'],
  ['chlorine', 'cl2', 'klor'],
  ['nitrogen', 'n2', 'azot'],
  ['air', 'hava'],
  ['gas', 'gaz'],
  ['water', 'su', 'suyu'],
  ['flowmeter', 'debimetre', 'debimetresi'],
  ['pump', 'pompa', 'pompasi'],
  ['well', 'borehole', 'kuyu', 'kuyusu'],
  ['tank', 'reservoir', 'depo', 'deposu', 'hazne', 'haznesi', 'tanki'],
  ['valve', 'vana', 'vanasi'],
  ['room', 'oda', 'odasi'],
  ['door', 'kapi', 'kapisi'],
  ['cover', 'lid', 'kapak', 'kapagi'],
  ['building', 'bina', 'binasi'],
  ['station', 'istasyon', 'istasyonu'],
  ['line', 'hat', 'hatti'],
  ['bank', 'banka', 'bankasi'],
  ['cylinder', 'tup', 'tupu'],
  ['generator', 'jenerator', 'jeneratoru'],
  ['battery', 'aku', 'akusu', 'pil'],
  ['boiler', 'kazan', 'kazani'],
  ['compressor', 'kompresor', 'kompresoru'],
  ['fan', 'fani'],
  ['filter', 'filtre', 'filtresi'],
  ['mixer', 'karistirici'],
  ['heater', 'isitici'],
  ['cooler', 'sogutucu'],
  ['greenhouse', 'sera', 'serasi'],
  ['meter', 'sayac', 'sayaci', 'olcer'],
  ['dosing', 'dozaj'],
  ['pressure', 'basinc', 'basinci'],
  ['temperature', 'sicaklik', 'sicakligi'],
  ['level', 'seviye', 'seviyesi'],
  ['flow', 'debi', 'debisi'],
  ['humidity', 'nem', 'nemi'],
  ['power', 'guc', 'gucu'],
  ['energy', 'enerji', 'enerjisi'],
  ['voltage', 'gerilim', 'gerilimi', 'voltaj'],
  ['current', 'akim', 'akimi'],
  ['speed', 'hiz', 'hizi'],
  ['turbidity', 'bulaniklik'],
  ['conductivity', 'iletkenlik'],
];

/** Each word of the table to the first word of its line (the English one): `kat` → `floor`, `oksijen` → `oxygen`; a word not in the table stays itself. */
const CANONICAL: ReadonlyMap<string, string> = new Map(WORD_TABLE.flatMap((line) => line.map((w) => [w, line[0]] as const)));
/** A word as the table's English one. */
export const canonicalWord = (w: string): string => CANONICAL.get(w) ?? w;

/** Two words a device writes as one compound (`flow meter` → `flowmeter`), so "Debimetre" meets "Flow meter". */
const COMPOUNDS: ReadonlyArray<readonly [string, string, string]> = [['flow', 'meter', 'flowmeter']];

/**
 * The words of a text as the table's English ones, a compound's joined word after its parts: "Kat 3 oksijen" → floor, 3, oxygen; "Giriş debimetresi" →
 * inlet, flowmeter; "Flow meter 2" → flow, meter, flowmeter, 2.
 */
export function canonicalWords(text: string): string[] {
  const words = wordsOf(text).map(canonicalWord);
  const out: string[] = [];
  words.forEach((w, i) => {
    out.push(w);
    const joined = COMPOUNDS.find(([a, b]) => w === b && words[i - 1] === a);
    if (joined) out.push(joined[2]);
  });
  return out;
}

/** The base synonym lines (English with the common Turkish words); `SYNONYMS` is these with every translation the word table gives their words. */
const BASE_SYNONYMS: ReadonlyArray<ReadonlyArray<string>> = [
  ['running', 'run', 'on', 'off', 'active', 'state', 'enabled', 'enable', 'power', 'powered', 'started', 'start', 'switch', 'operating', 'working', 'is_on', 'motor', 'calisiyor', 'calisma', 'devrede'],
  ['status', 'state', 'mode', 'health', 'condition', 'alarm', 'fault', 'error', 'warning', 'code', 'phase', 'durum', 'durumu', 'ariza', 'hata', 'uyari', 'mod'],
  ['value', 'reading', 'measure', 'measurement', 'pv', 'process', 'level', 'amount', 'deger', 'degeri', 'olcum', 'olcumu'],
  ['temperature', 'temp', 'tmp', 't', 'celsius', 'thermometer', 'thermostat', 'sicaklik', 'sicakligi'],
  ['flow', 'flowrate', 'flowmeter', 'lpm', 'm3h', 'gpm', 'debi', 'debisi', 'akis', 'akisi'],
  ['pressure', 'press', 'bar', 'psi', 'basinc', 'basinci'],
  ['humidity', 'hum', 'rh', 'moisture', 'nem', 'nemi'],
  ['level', 'lvl', 'fill', 'filling', 'tank', 'seviye', 'seviyesi', 'doluluk'],
  ['power', 'kw', 'watt', 'watts', 'load', 'guc', 'gucu'],
  ['energy', 'kwh', 'consumption', 'enerji', 'tuketim'],
  ['voltage', 'volt', 'volts', 'v', 'gerilim', 'voltaj'],
  ['current', 'amp', 'amps', 'ampere', 'a', 'akim', 'akimi'],
  ['speed', 'rpm', 'frequency', 'freq', 'hz', 'rate', 'velocity', 'hiz', 'hizi', 'devir'],
  ['position', 'opening', 'open', 'opened', 'pos', 'angle', 'travel', 'stroke', 'aperture', 'valve', 'damper', 'aciklik', 'acikligi', 'konum'],
  ['direction', 'dir', 'forward', 'reverse', 'fwd', 'rev', 'rotation', 'heading', 'yon', 'yonu'],
  ['value2', 'setpoint', 'sp', 'target', 'second', 'secondary', 'aux'],
  ['door', 'hatch', 'lid', 'cover', 'kapi', 'kapisi'],
  ['weight', 'mass', 'kg', 'agirlik'],
  ['volume', 'litre', 'liter', 'l', 'hacim'],
];

/** The translations the word table gives a word (itself first): `pump` → pump, pompa, pompasi. */
const translationsOf = (w: string): readonly string[] => WORD_TABLE.find((line) => line.includes(w)) ?? [w];

/**
 * Words that mean the same thing on a device and on a drawing. One line per concept: a field whose name or label holds any word of a line
 * is also looked for under the other words of that line (a drawing's "Reading" field finds a device's `temp_1`; "Running" finds `pump_on`).
 * The Turkish words stand folded (`sicaklik` for "Sıcaklık", `aciklik` for "Açıklık"), as `wordsOf` gives them; every word of a line brings its
 * translations from the one word table (`WORD_TABLE`, D585: the flow line knows "debimetre", the level line "depo").
 */
export const SYNONYMS: ReadonlyArray<ReadonlyArray<string>> = BASE_SYNONYMS.map((line) => [...new Set(line.flatMap(translationsOf))]);

/**
 * A set of words widened by their synonym lines and (with `translate`) by the word table: what a set of words is looked for under. A thing's identity is
 * compared without the table (a "Sera 1 A" soil probe is not the controller's `greenhouse_1` through a translation of where it stands).
 */
function widen(base: ReadonlySet<string>, translate = true): Set<string> {
  const out = new Set(base);
  for (const line of SYNONYMS) if (line.some((w) => base.has(w))) for (const w of line) out.add(w);
  if (translate) for (const w of base) for (const t of translationsOf(w)) out.add(t);
  return out;
}

/**
 * The words a field is looked for under: its name, its label, the `hints` (the symbol's own words: a "Thermometer" looks for temperatures) and every
 * synonym of those. Words are matched whole (`rh` is a word, never a part of `through`).
 */
export function fieldWords(field: { name: string; label?: string }, hints: readonly string[] = []): Set<string> {
  return widen(new Set([...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : []), ...hints.flatMap(wordsOf).filter(matchable)]));
}

/**
 * The quantity lines the symbol's own words name (a "Thermometer" names the temperature line, "Hisartepe deposu" the level line through "depo"): what a
 * number field whose own words say no quantity is looked for under. Only the lines that name a quantity: a word of the symbol's name that names no quantity
 * ("AC" of an "AC breaker", "heat" of a "Plate heat exchanger") is the symbol's own word, counted once as such (`symbol`, `kind`), never a second time as a
 * word of the field (next-boilerplate phase 52.2.1, test 3 #62, #91).
 */
function hintQuantityWords(hints: readonly string[]): Set<string> {
  const base = new Set(hints.flatMap(wordsOf).filter(matchable).flatMap(translationsOf));
  const out = new Set<string>();
  for (const line of SYNONYMS) if (!NOT_A_QUANTITY.has(line[0]) && line.some((w) => base.has(w))) for (const w of line) out.add(w);
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
  ['temperature', ['temperature', 'temp']], ['flow', ['flow']], ['pressure', ['pressure']], ['level', ['level', 'fill']], ['percent', ['humidity', 'opening', 'position']],
  ['speed', ['speed', 'rpm']], ['frequency', ['frequency']], ['voltage', ['voltage']], ['current', ['current']], ['power', ['power']], ['energy', ['energy']],
];

/**
 * Whether a key's quantity is what a field measures: the same, or a level read as a percent or as a length (a tank gauge's level in mm is a level:
 * next-boilerplate phase 52.2.1, test 3 #109, every level transmitter on a tank farm said "Check the kind").
 */
export function sameQuantity(field: string, key: string): boolean {
  return field === key || (field === 'level' && (key === 'percent' || key === 'length')) || (key === 'level' && (field === 'percent' || field === 'length'));
}

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

/**
 * Why a key does not fit the field, in a word the panel turns into a sentence: its kind, the quantity it measures (`quantity`: a temperature for an
 * opening), or a state named the other way round (`inverted`: "Door closed" for a field that shows open or running).
 */
export type Mismatch = 'text-for-number' | 'state-for-number' | 'number-for-state' | 'text-for-state' | 'number-for-text' | 'quantity' | 'inverted';

/** The fields whose on means open, running or on: a key named for the other way round never reads one as it is. */
const POSITIVE_STATE_FIELDS = new Set(['running', 'on', 'enabled', 'active', 'open']);
/** Words of a key's name that say its on is closed, shut or stopped (folded: "Kapalı" is `kapali`). */
const INVERSE_STATE_WORDS = new Set(['closed', 'close', 'shut', 'stopped', 'kapali', 'kapandi', 'kapatildi', 'durdu', 'durmus']);

/**
 * `symbol`: the shared word is one of the symbol's OWN name that its kind does not have ("Supply" of a "Supply temperature"): a reason specific to THIS
 * symbol. `kind`: the shared word comes from the symbol's kind, or is a kind word its name repeats ("room" of a "Cold room", "pump" of a "Circulation
 * pump"): scored alike, but every symbol of that kind has it, so it never names THIS symbol (next-boilerplate e2e round 5, E3: four cold rooms took one
 * controller's room temperature as certain through "room").
 * `stale`: the key's last value is much older than the device's newest one (next-boilerplate e2e round 3, M-R3-06: a 12-hour-old raw key was
 * offered above the live value): it counts against the key and it is never picked by itself.
 */
export type RankReason = 'element' | 'label' | 'name' | 'synonym' | 'symbol' | 'kind' | 'contains' | 'type' | 'unit' | 'only' | 'stale';

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
export function mismatchOf(field: { name: string; kind?: FieldKind }, key: Pick<DeviceKey, 'value' | 'unit' | 'type'> & Partial<Pick<DeviceKey, 'key' | 'label'>>): Mismatch | null {
  const want = fieldKindOf(field);
  const got = keyKindOf(key);
  // a "closed" or "kapalı" key never reads an open or running field as it is: its 1 is the field's 0 (next-boilerplate phase 52.2.1, test 3: a dock door
  // linked to "Door closed" was drawn open while it was shut)
  if (POSITIVE_STATE_FIELDS.has(field.name.toLowerCase()) && got !== 'number' && got !== 'text' && nameWordsOf(key).some((w) => INVERSE_STATE_WORDS.has(w))) return 'inverted';
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
function typeScore(field: { name: string; kind?: FieldKind }, key: Pick<DeviceKey, 'value' | 'unit' | 'type'> & Partial<Pick<DeviceKey, 'key' | 'label'>>, onlyOfKind: boolean): number {
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
/** A key whose last value is older than the device's newest by more than this is stale: it is offered last and never picked by itself. */
export const STALE_GAP_MS = 60 * 60 * 1000;
/** What a stale key loses. */
export const STALE_PENALTY = 40;
/**
 * What a key of another piece of equipment loses (`RankedKey.foreign`): it is still offered, but never ties with, or leads, the symbol's own key (e2e
 * round 5, E3: greenhouse 2's value tied with greenhouse 1's for "Sera 1", and nothing was certain).
 */
export const FOREIGN_PENALTY = 30;

/** The words that make a key a set-point: `setpoint`, `sp`, `target` and their Turkish `hedef`, or the pairs "set point" and "ayar noktası". */
const SETPOINT_WORDS = new Set(['setpoint', 'sp', 'target', 'targets', 'hedef', 'soll', 'setp']);
const SETPOINT_PAIRS: ReadonlyArray<readonly [string, string]> = [['set', 'point'], ['set', 'pt'], ['ayar', 'noktasi'], ['ayar', 'degeri']];

/** Whether some words (in their order) name a set-point. */
export function isSetpointWords(words: readonly string[]): boolean {
  if (words.some((w) => SETPOINT_WORDS.has(w))) return true;
  return words.some((w, i) => SETPOINT_PAIRS.some(([a, b]) => w === a && words[i + 1] === b));
}

/**
 * Words that name a piece of equipment (folded; English and the common Turkish ones). A flat key whose label holds one the symbol does not have reads
 * another piece of equipment ("Tank level" for a soil probe, "Pump kiosk" for a booster set, "Battery" for a dock door; e2e round 5, E3).
 */
const EQUIPMENT_WORDS: ReadonlySet<string> = new Set([
  'pump', 'valve', 'tank', 'fan', 'motor', 'compressor', 'heater', 'boiler', 'chiller', 'freezer', 'cooler', 'fridge', 'door', 'gate', 'hatch', 'lid', 'damper',
  'filter', 'kiosk', 'hydrant', 'reservoir', 'vessel', 'silo', 'bin', 'conveyor', 'mixer', 'agitator', 'turbine', 'generator', 'transformer', 'breaker',
  'inverter', 'battery', 'panel', 'greenhouse', 'room', 'chamber', 'oven', 'fryer', 'kettle', 'borehole', 'well', 'basin', 'clarifier', 'blower', 'crane',
  'lift', 'elevator', 'escalator', 'lamp', 'light', 'camera', 'sprinkler', 'pivot', 'barn', 'radiator', 'dryer', 'washer', 'router', 'rack', 'charger',
  'switch', 'thermostat', 'meter', 'gauge', 'sensor', 'probe', 'manifold', 'cylinder', 'compressor', 'evaporator', 'condenser', 'tower', 'flowmeter', 'cover',
  'pompa', 'vana', 'kazan', 'sera', 'oda', 'kapi', 'kapisi', 'firin', 'depo', 'fan', 'sayac', 'sensor', 'jenerator', 'trafo', 'aku',
].flatMap(translationsOf));

/** Words that only say what kind of instrument a symbol is (a "Reading hall thermostat" is the reading hall's; "thermostat" names no place or thing of its own). */
const INSTRUMENT_WORDS: ReadonlySet<string> = new Set([
  'sensor', 'gauge', 'meter', 'transmitter', 'transducer', 'indicator', 'probe', 'monitor', 'detector', 'analyser', 'analyzer', 'thermometer', 'thermostat',
  'manometer', 'hygrometer', 'flowmeter', 'logger', 'counter', 'dial', 'display', 'olcer', 'sayac', 'algilayici', 'gosterge',
].flatMap(translationsOf));

/**
 * Words a place or a thing shares with many others ("room", "hall", "floor", "oda", "kat"): they never tell one device from the rest, so a device's name
 * earns no bonus for one of them alone (next-boilerplate phase 52.2.2, test 3 #136: three rooms tied on "room").
 */
const GENERIC_NAME_WORDS: ReadonlySet<string> = new Set([
  'room', 'hall', 'floor', 'area', 'zone', 'building', 'block', 'site', 'station', 'line', 'unit', 'panel', 'controller', 'gateway', 'device', 'rtu', 'plc',
  'cabinet', 'house', 'plant', 'system', 'main', 'bolge', 'alan', 'saha', 'blok', 'cihaz', 'sistem', 'merkez', 'merkezi', 'kaydedici',
].flatMap(translationsOf));

/**
 * The words of a label that name a thing rather than what is read of it: the words of the label left once the words of a reading (every word of the
 * synonym lines but the pieces of equipment among them: temperature, running, level …) and the generic ones (raw, total, ok …) are taken out. "Pump
 * kiosk" names `pump`, `kiosk`; "Room temperature" names `room`; "Tank level" names `tank`; "Defrost running" names `defrost`; "Door open" names `door`.
 * Words that join a label's parts ("Energy this session": `this`; "bu", "ile") are no thing either (test 3 #90).
 */
const READING_WORDS: ReadonlySet<string> = new Set([
  ...SYNONYMS.flat().filter((w) => !EQUIPMENT_WORDS.has(w)),
  'raw', 'total', 'actual', 'measured', 'live', 'trend', 'ok', 'avg', 'average', 'mean', 'min', 'max', 'last', 'daily', 'hourly', 'ago', 'pct', 'percent',
  'closed', 'shut', 'is', 'of', 'at', 'the', 'and', 'or', 'in', 'to', 'by', 'h', 'c', 'f', 'k', 'm', 's', 'x',
  'this', 'that', 'these', 'those', 'per', 'for', 'from', 'with', 'its', 'an', 'bu', 'bir', 'ile', 'icin', 've',
]);
const thingWords = (text: string): string[] => wordsOf(text).filter((w) => !READING_WORDS.has(w) && !/^\d+$/.test(w));

/**
 * The numbers of a name by the word each follows ("Cable 1 · point 2": cable 1, point 2), the words as the table's English ones (`kat 3` is `floor 3`). Two
 * names whose same word carries another number name two things: "Cable 1 · point 2" is not "Cable 2 · point 1" (test 3 #116), "Floor 2 pump 1" is "Pump 1"'s.
 */
function numbersByWord(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let word = '';
  for (const w of canonicalWords(text)) {
    if (/^\d+$/.test(w)) { if (word && !out.has(word)) out.set(word, String(Number(w))); } else if (matchable(w)) word = w;
  }
  return out;
}
const numbersDiffer = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean => [...a].some(([w, n]) => b.has(w) && b.get(w) !== n);

/**
 * The piece of equipment a key names, as words (numbers too, they tell twins apart): a dotted key's element (its prefix's words and the equipment name of
 * its label, "Greenhouse 1 valve · running"), else the thing a flat key's label (or name) speaks of ("Pump kiosk", "Greenhouse 1 temperature"). `prefixed`
 * says which. Null for a flat key that names no thing (`temp`, "Door open").
 */
function equipmentOf(k: Pick<DeviceKey, 'key' | 'label'>): { words: Set<string>; prefixed: boolean } | null {
  const lower = k.key.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot > 0) return { words: new Set([...wordsOf(lower.slice(0, dot)), ...wordsOf(elementLabelOf(k.label))]), prefixed: true };
  const text = k.label && k.label.trim() ? k.label : k.key;
  const named = thingWords(text);
  if (named.length === 0) return null;
  // a flat label's number belongs to its thing ("Greenhouse 1 temperature"): kept beside its words
  return { words: new Set([...named, ...wordsOf(text).filter((w) => /^\d+$/.test(w))]), prefixed: false };
}

const tsOf = (k: Pick<DeviceKey, 'ts'>): number => {
  if (k.ts === undefined || k.ts === null) return 0;
  const n = typeof k.ts === 'number' ? k.ts : Date.parse(k.ts);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The keys of the device whose last value is far behind the newest one (`STALE_GAP_MS`): a reading the device stopped sending hours ago (an old
 * key name, a sensor that went away). A key with no time at all (declared, nothing sent yet) is not stale: it has no value to be old.
 */
export function staleKeys(keys: readonly Pick<DeviceKey, 'key' | 'ts'>[]): Set<string> {
  const newest = Math.max(0, ...keys.map(tsOf));
  const out = new Set<string>();
  if (newest === 0) return out;
  for (const k of keys) {
    const t = tsOf(k);
    if (t > 0 && newest - t > STALE_GAP_MS) out.add(k.key);
  }
  return out;
}

/**
 * The keys the ranking may propose: a key the host marked internal (a connection of the drawing itself: a pipe run, a cable) is never ranked or
 * suggested. The panel still lists such a key, last, so nothing a device sends is ever out of a person's reach.
 */
export const pickableKeys = (keys: readonly DeviceKey[]): DeviceKey[] => keys.filter((k) => !k.internal);


/**
 * Whether a key's piece of equipment IS the symbol, by name (next-boilerplate e2e Slice 21, AD-02: "Circulation pump" on the drawing and the device's
 * `pump_circulation` labelled "Circulation pump · running" stayed unmatched): the label's equipment name equals the symbol's label (case aside), or the
 * key's prefix is the symbol's label in other words or order. A key with no prefix and no such label names no equipment.
 */
export function keyNamesSymbol(k: Pick<DeviceKey, 'key' | 'label'>, symbolLabel: string): boolean {
  const own = symbolLabel.trim();
  if (!own) return false;
  const lower = k.key.toLowerCase();
  const prefix = lower.includes('.') ? lower.slice(0, lower.lastIndexOf('.')) : '';
  const named = elementLabelOf(k.label);
  return (named !== '' && named.toLowerCase() === own.toLowerCase()) || (prefix !== '' && sameWords(prefix, own));
}

/**
 * Every pickable key of the device ranked for `field`, best first (a tie keeps the host's order). Reasons, in the order they are scored:
 *  element  `<element>.<field>` exactly (the convention of a device that follows it), when the symbol's element is known: 100;
 *  label    the key's piece of equipment is the symbol by name (`keyNamesSymbol`, AD-02) and the key's own part is the field: 100, the element rule
 *           found by the name instead of the id (a drawing keyed `pump` for the device's `pump_circulation`);
 *  name     the key's local part (after its last dot), or its label, is the field's name or label: 80;
 *  synonym  the key and the field share a whole word, or a synonym of one (`Reading` of a thermometer finds `temp_1`, `Running` finds `pump_on`): 65,
 *           and 15 more for each further shared word (`Supply temperature` beats `Return temperature` for a supply field). "on" and "off" count only as
 *           the last word of a key or a label (`pump_on`, "Pump on"; never "Panel on battery");
 *  symbol   the key shares a word of the symbol's own NAME that its kind does not have ("Supply" of a "Supply temperature" in `supply_temp`): 65 on its
 *           own, 15 beside a name or synonym match; the one word reason that ties a key to this symbol rather than to any symbol of its kind;
 *  kind     the same for a word of the symbol's kind, or a kind word its name repeats (Door ↔ `door`, Circulation pump ↔ `pump_on`): scored as `symbol`,
 *           but every symbol of that kind has it, so it never names THIS symbol (next-boilerplate e2e round 5, E3);
 *  contains the key holds a word of the field of four letters or more: 55;
 *  type     what the key sends agrees with what the field expects: 15, or `KIND_ALONE_SCORE` (50: offered, never certain) when it is the only key of
 *           that kind the device sends and no key matched by a word (words first, the kind as the fallback); a mismatch is flagged and costs (45;
 *           10 for a 0/1 where a number is expected);
 *  unit     the key measures what the field measures (by its unit: 45; by its words, `temp_1` for a temperature: 20; a percent says no more than a
 *           word: humidity, opening, level and load all read %, e2e round 5); a different quantity costs 20 and bars the kind fallback (a temperature is
 *           never the one number a speed reads);
 *  only     the one key there is, when nothing else says anything: 60;
 *  stale    the key's last value is far behind the device's newest (`STALE_GAP_MS`): minus `STALE_PENALTY`, and never picked by itself.
 * A set-point (`setpoint`, `sp`, `target`, "set point") is never ranked for a field that shows what is measured (any field but a second value or a
 * set-point of its own): a target is no reading (e2e round 5, E3). The picker still lists it, last.
 * `hints` are the symbol's own words: its NAME first, then its kind ([label, kindLabel]); used for a number field whose own words say no quantity
 * ("Reading" of a "Thermometer"). A word of one letter or a bare number never matches (a symbol's "1" or "A" tells twins apart, it names nothing).
 * `confident` is on the best alone: a score from `CONFIDENT_SCORE`, evidence that the key is what THIS symbol shows (`strongEvidence`), no mismatch,
 * not `foreign`, not stale, a lead of `CONFIDENT_LEAD`, and, when the symbol's name writes a code (`B01`, `FT-101`), that code written by the key, its
 * label or its element, or by the device itself (`device`: its name and place; next-boilerplate phase 52.2.1, test 3 #55: "B01 power" was certain of the
 * hall's total). A code that shares only its number with the symbol's (`T-101` for `LT-101`, a loop number) ranks the key a little higher but is no proof.
 * `foreign`: a key of another piece of equipment than the symbol (E2E-2.11, M-R3-03, e2e round 5 E3), measured on the symbol's identity (its name and
 * its kind, as written, with their translations in the word table: "open" must not reach "valve" through the position line). A dotted key's element is
 * another when it shares no word with the identity, or when it shares one but each side has a word the other lacks (`heat_pump` for a "Mud pump";
 * `greenhouse_1` for a "Sera 1 A" soil probe; `greenhouse_2` for "Sera 1", a Greenhouse), or when a word they share carries another number ("Cable 2 ·
 * point 1" for "Cable 1 · point 2", test 3 #116); a flat key is another in the second and third ways, by the thing its label names ("Greenhouse 1
 * temperature" for "Sera 2"), or, on a device that names its pieces of equipment in its keys (two prefixes or more), when its label names a piece of
 * equipment the symbol is not ("Tank level" for a soil probe, "Pump kiosk" for a booster set): on a one-purpose device a flat key is the device's own
 * ("pump_on" of a combi boiler, "Room temperature" of a cold room controller). The element rule and the symbol's name on the equipment (`label`) override
 * it; a foreign key loses `FOREIGN_PENALTY`.
 * Each word counts once: a word of the symbol's name that also names the field's quantity counts as the field's word, never again as the symbol's.
 */
export function rankKeysForField(
  field: { name: string; label?: string; kind?: FieldKind; unit?: string },
  keys: readonly DeviceKey[],
  element?: string,
  taken: readonly string[] = [],
  hints: readonly string[] = [],
  context: RankContext = {},
): RankedKey[] {
  const used = new Set(taken);
  const device = context.device;
  // the parts the symbol reads already are its own: their other keys are never another piece of equipment's (a detector's `h2s.status` beside the `h2s.value`
  // its Reading reads, next-boilerplate phase 52.2.6)
  const ownParts = new Set([...(context.parts ?? [])].map((p) => p.toLowerCase()));
  // a set-point is never what a field that shows a measured value reads (a second value or a set-point field may read one)
  const fieldOwn = [...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : [])];
  const readsMeasure = field.name !== 'value2' && !isSetpointWords(fieldOwn);
  const isSetpointKey = (k: DeviceKey): boolean => isSetpointWords([...wordsOf(k.key.slice(k.key.lastIndexOf('.') + 1)), ...(k.label ? wordsOf(k.label) : [])]);
  const list = pickableKeys(keys).filter((k) => !used.has(k.key) && !(readsMeasure && isSetpointKey(k)));
  if (list.length === 0) return [];
  const want = `${element ?? ''}.${field.name}`.toLowerCase();
  const name = norm(field.name);
  const label = field.label ? norm(field.label) : '';
  const kind = fieldKindOf(field);
  const useHints = kind === 'number' || kind === null;
  const fieldOnly = fieldWords(field);
  // what the field is looked for under: its own words, and for a number field the quantity the symbol's words name (never the symbol's other words:
  // those count once, as the symbol's)
  const words = useHints ? new Set([...fieldOnly, ...hintQuantityWords(hints)]) : fieldOnly;
  // the symbol's NAME and its KIND apart: a word of the name its kind lacks names THIS symbol; a kind word names every symbol of the kind
  const nameRaw = (hints[0] ?? '') !== '' ? wordsOf(hints[0]) : [];
  const kindRaw = hints.slice(1).flatMap(wordsOf);
  const kindSet = new Set(kindRaw.flatMap(translationsOf));
  const specific = nameRaw.filter((w) => matchable(w) && !kindSet.has(w) && !READING_WORDS.has(w));
  const specificWords = fieldWords({ name: '' }, specific);
  const kindWords = fieldWords({ name: '' }, [...kindRaw, ...nameRaw.filter((w) => !specific.includes(w))]);
  // the symbol's identity, as the word table's English words (numbers and letters too: they tell twins apart: "Sol banka" is a left bank), and widened by
  // the synonyms for a fair comparison
  const identity = new Set([...nameRaw, ...kindRaw].flatMap((w) => canonicalWords(w)));
  const identityAll = widen(new Set([...identity].filter(matchable)), false);
  for (const w of identity) identityAll.add(w);
  // the tags of the symbol's own name: a numbered piece of equipment that lacks one of them holds the symbol rather than is it ("Sera 1 A", a soil probe,
  // is not the controller's `greenhouse_1`)
  const nameTags = nameRaw.flatMap((w) => canonicalWords(w)).filter((w) => !matchable(w));
  const long = [...new Set([...wordsOf(field.name), ...(field.label ? wordsOf(field.label) : [])])].filter((w) => w.length >= 4);
  const quantity = fieldQuantity(field) ?? (useHints ? quantityOfWords(hints.flatMap(wordsOf).filter(matchable), true) : null);
  // the quantity the field itself or the symbol's KIND names (a thermometer reads temperatures): agreeing with it is evidence of its own; the quantity a
  // word of the symbol's NAME gives ("Network flow valve") ranks the keys but proves nothing (test 3 #91: the valve was certain of the primary flow)
  // (a name that holds an instrument's word says what that instrument measures: "Pressure gauge", "Room thermometer")
  const ownQuantity = fieldQuantity(field)
    ?? (useHints ? quantityOfWords(kindRaw.filter(matchable), true) ?? (nameRaw.some((w) => INSTRUMENT_WORDS.has(w)) ? quantityOfWords(nameRaw.filter(matchable), true) : null) : null);
  const kinds = new Map<FieldKind | null, number>();
  for (const k of list) kinds.set(keyKindOf(k), (kinds.get(keyKindOf(k)) ?? 0) + 1);
  const stale = staleKeys(list);
  const symbolLabel = hints[0] ?? '';
  // the codes of the symbol's own name (`FT-101`, `CL1`): a key, its label or its element that writes the same code is this symbol's (run 3 note 131)
  const symbolCodes = codesOf(symbolLabel);
  const deviceCoded = device !== undefined && sharesCode(symbolCodes, device);
  // the numbers of the symbol's name, by the word each follows (cable 1, point 2)
  const symbolNumbers = numbersByWord(symbolLabel);
  // what the symbol's name needs to be named whole (`namesWhole`): its words and tags, the words of an instrument aside
  const nameNeeds = nameRaw.flatMap((w) => canonicalWords(w)).filter((w) => !INSTRUMENT_WORDS.has(w));
  const deviceWords = device ? canonicalWords(device) : [];
  // a device that names its pieces of equipment in its keys (two element prefixes or more: a plant, a controller): its flat keys may be another
  // piece's too; on a one-purpose device (flat keys only) a pump or a fan in a key's name is a part of the thing the device is
  const prefixes = new Set(list.filter((k) => k.key.includes('.')).map((k) => k.key.slice(0, k.key.lastIndexOf('.')).toLowerCase()));
  const manyThings = prefixes.size >= 2;
  // first the words (the element, a name, a shared word, a contained word) …
  const worded = list.map((k) => {
    const reasons: RankReason[] = [];
    let score = 0;
    const lower = k.key.toLowerCase();
    const local = lower.slice(lower.lastIndexOf('.') + 1);
    const nlocal = norm(local);
    const nlabel = k.label ? norm(k.label) : '';
    if (element && lower === want) { score += 100; reasons.push('element'); }
    // the symbol's equipment by its name (AD-02): the key of that equipment for this very field is the element rule's answer
    const named = keyNamesSymbol(k, symbolLabel);
    if (named && !reasons.includes('element') && local === field.name.toLowerCase()) { score += 100; reasons.push('label'); }
    if (nlocal === name || (label && (nlocal === label || nlabel === label)) || (nlabel && nlabel === name)) { score += 80; reasons.push('name'); }
    const keyWords = new Set([...wordsOfKey(local), ...(k.label ? wordsOfKey(k.label) : [])]);
    const sharedWords = [...keyWords].filter((w) => words.has(w));
    // a word of the field's own (not one the symbol's name brought): what is read, said by the key itself
    const fieldWord = sharedWords.some((w) => fieldOnly.has(w));
    if (!reasons.includes('name') && sharedWords.length > 0) { score += 65 + Math.min(2, sharedWords.length - 1) * 15; reasons.push('synonym'); }
    // the piece of equipment the key names, against the symbol's identity: another one when it shares nothing (a dotted key), or when it shares a word
    // but each side has a word of its own the other lacks (a heat pump is not a mud pump; greenhouse 2 is not "Sera 1"), or a number of its own
    const equipment = equipmentOf(k);
    const equipWords = equipment ? [...equipment.words] : [];
    const equipCanon = equipWords.flatMap((w) => canonicalWords(w));
    const sharesIdentity = equipCanon.some((w) => identity.has(w));
    const equipAll = widen(new Set(equipCanon), false);
    const equipTags = equipCanon.filter((w) => !matchable(w));
    const holdsSymbol = equipTags.length > 0 && nameTags.some((t) => !equipTags.includes(t));
    const equipText = equipment?.prefixed ? (elementLabelOf(k.label) || lower.slice(0, lower.lastIndexOf('.'))) : (k.label && k.label.trim() ? k.label : k.key);
    const differentEquipment = sharesIdentity && (
      (equipCanon.some((w) => !identityAll.has(w)) && [...identity].some((w) => !equipAll.has(w))) || numbersDiffer(symbolNumbers, numbersByWord(equipText)) || holdsSymbol);
    // a flat key whose label names a piece of equipment the symbol is not ("Tank level" for a soil probe): another one, whatever word it shares
    const otherThing = manyThings && !!equipment && !equipment.prefixed && equipCanon.some((w) => EQUIPMENT_WORDS.has(w) && !identityAll.has(w));
    const prefixWords = equipment?.prefixed ? equipWords : [];
    // a word of the symbol's own in the key, its label or its element: a match to THIS symbol (`symbol`) or to its kind (`kind`), scored like a synonym (a
    // second signal beside one), 15 more for each further shared word; never through an element that is another piece of equipment, and never a word the
    // field's match counted already (one word counts once, test 3 #62)
    const counted = new Set(sharedWords);
    const hits = [...keyWords, ...(differentEquipment ? [] : prefixWords)].filter((w) => matchable(w) && !fieldOnly.has(w) && !counted.has(w));
    const ownHits = new Set(hits.filter((w) => specificWords.has(w)));
    const kindHits = new Set(hits.filter((w) => kindWords.has(w) && !ownHits.has(w)));
    const hitCount = ownHits.size + kindHits.size;
    if (hitCount > 0) { score += (reasons.length === 0 ? 65 : 15) + Math.min(2, hitCount - 1) * 15; reasons.push(ownHits.size > 0 ? 'symbol' : 'kind'); }
    // the symbol's own code, written whole in the key or its label: a match to THIS symbol, as a word of its own name is
    const keyText = `${k.key} ${k.label ?? ''}`;
    const codeWritten = sharesCode(symbolCodes, keyText);
    if (!reasons.includes('symbol') && codeWritten) { score += reasons.length === 0 ? 65 : 15; reasons.push('symbol'); }
    // a code with the symbol's number under other letters (`T-101` for `LT-101`): a little higher, never a reason
    else if (!codeWritten && sharesCodeNumber(symbolCodes, keyText)) score += PART_CODE_SCORE;
    if (reasons.length === 0 && long.some((w) => nlocal.includes(w) || nlabel.includes(w))) { score += 55; reasons.push('contains'); }
    const ruled = reasons.includes('element') || named || ownParts.has(partOf(k.key));
    const foreign = identity.size > 0 && !!equipment && !ruled && (equipment.prefixed ? !sharesIdentity || differentEquipment : differentEquipment || otherThing);
    // the symbol named whole by the key with its device: every word and tag of its name (an instrument's word aside) is in the key, its element or the
    // device's name and place, in other words or languages too ("Chiller 1" on the "Chiller 1 controller"; "Session energy" in "Energy this session")
    const have = widen(new Set([...keyWords, ...(differentEquipment ? [] : prefixWords), ...wordsOf(elementLabelOf(k.label)), ...deviceWords].flatMap(canonicalWords)));
    const namesWhole = nameNeeds.length > 0 && nameNeeds.every((w) => have.has(w));
    const fieldEvidence = reasons.some((r) => r === 'element' || r === 'label' || r === 'name' || r === 'contains') || fieldWord;
    // a word of the symbol's KIND in the key ("Room temperature" for a cold room, "Heat power" for a heat meter) says what the symbol is; one word of its
    // own NAME alone ("AC" of an "AC breaker") does not, two do
    const kindEvidence = kindHits.size > 0 || ownHits.size >= 2;
    return { k, reasons, score, foreign, fieldEvidence: fieldEvidence || kindEvidence, namesWhole: namesWhole && reasons.length > 0, codeMet: !symbolCodes.size || codeWritten || deviceCoded || ruled };
  });
  // … then the kind: the only key of the field's kind decides by itself only when no key matched by a word (words first, the kind as the fallback)
  const anyWords = worded.some((w) => w.reasons.length > 0);
  const strong = new Set<string>();
  const codeMet = new Set<string>();
  const ranked = worded.map(({ k, reasons, score: base, foreign, fieldEvidence, namesWhole, codeMet: met }): RankedKey => {
    let score = base;
    if (met) codeMet.add(k.key);
    // what may make a pick certain (`strongEvidence`): a word of the field's own, the symbol named whole by the key and its device, the one key there is,
    // or a unit that names the quantity the field or the symbol's kind measures. One word of the symbol's name alone never does (test 3 #62: "AC" of an
    // "AC breaker" made "AC power" certain), nor does a kind or a percent alone.
    if (fieldEvidence || namesWhole) strong.add(k.key);
    const kq = quantity ? keyQuantity(k) : null;
    const contradicts = !!kq && !sameQuantity(quantity!, kq.quantity);
    const t = typeScore(field, k, !anyWords && !contradicts && kinds.get(keyKindOf(k)) === 1);
    if (t !== 0) { score += t; reasons.push('type'); }
    // a percent is a scale, not a quantity: it says no more than a word (a humidity in % is no door's opening)
    if (kq) {
      const named = kq.byUnit && kq.quantity !== 'percent';
      score += contradicts ? -20 : named ? 45 : 20;
      reasons.push('unit');
      if (!contradicts && ownQuantity && sameQuantity(ownQuantity, kq.quantity) && kq.quantity !== 'percent') strong.add(k.key);
    }
    if (list.length === 1 && reasons.length === 0) { score += 60; reasons.push('only'); strong.add(k.key); }
    // a value the device stopped sending long ago (an old key name, a sensor that went away) comes after the live ones
    const isStale = stale.has(k.key);
    if (isStale) { score -= STALE_PENALTY; reasons.push('stale'); }
    if (foreign) score -= FOREIGN_PENALTY;
    // a key that measures another quantity than the field is never picked by itself, whatever word it shares (a supply temperature for a valve's opening)
    const mismatch = mismatchOf(field, k) ?? (contradicts ? 'quantity' : null);
    return { key: k.key, score, confident: false, reasons, ...(mismatch ? { mismatch } : {}), ...(foreign ? { foreign } : {}) };
  }).filter((r) => r.score > 0);
  ranked.sort((a, b) => b.score - a.score);
  const [top, second] = ranked;
  if (top && top.score >= CONFIDENT_SCORE && strong.has(top.key) && codeMet.has(top.key) && !top.mismatch && !top.foreign && !top.reasons.includes('stale')
    && (second === undefined || top.score - second.score >= CONFIDENT_LEAD)) top.confident = true;
  return ranked;
}

/** The part of a key (what stands before its last dot), lower-cased; '' for a flat key. */
function partOf(key: string): string {
  return key.includes('.') ? key.slice(0, key.lastIndexOf('.')).toLowerCase() : '';
}

/** What `rankKeysForField` knows beyond the symbol's words. */
export interface RankContext {
  /** The device's name and place: a code the symbol's name writes, written by the device, is the symbol's; the device's words name the symbol too. */
  device?: string;
  /** The parts (`<part>.` of a key) the symbol reads already: their keys are the symbol's own, never another piece of equipment's. */
  parts?: Iterable<string>;
}

/** The parts the keys read (`h2s` of `h2s.value`); flat keys have none. */
export const partsOf = (keys: Iterable<string>): string[] => [...keys].map(partOf).filter((p) => p !== '');

/**
 * The best of a ranking when it is clearly the best: offered as "Suggested" in a picker only then (next-boilerplate phase 52.2.4, test 3 #157: every belt
 * was "Suggested: Conveyor 1" while the next key scored the same). Null for a tie at the top, a score under `MIN_PROPOSAL_SCORE` or a kind problem.
 */
export function clearBest(ranked: readonly RankedKey[]): RankedKey | null {
  const [top, second] = ranked;
  if (!top || top.score < MIN_PROPOSAL_SCORE || top.mismatch) return null;
  return second && second.score >= top.score ? null : top;
}

/** The words of a key or a label as `rankKeysForField` matches them: "on" and "off" only as the last word (`pump_on`; "Panel on battery" is not "on"). */
function wordsOfKey(text: string): string[] {
  const all = wordsOf(text);
  return all.filter((w, i) => (w !== 'on' && w !== 'off') || i === all.length - 1);
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

/** The words a state is shown as (next-boilerplate e2e round 3, m-R3-10: the product says On / Off everywhere, never true / false). */
export interface StateWords { on: string; off: string }
export const DEFAULT_STATE_WORDS: StateWords = { on: 'On', off: 'Off' };

const numberFormats = new Map<string, Intl.NumberFormat>();
/**
 * A number as the panel shows it: at most 3 decimals, in the workspace's language when the host gives one (`locale`: a Turkish screen writes `46,222`,
 * next-boilerplate phase 52.2.4, test 3 #28), else as JavaScript writes it.
 */
export function shownNumber(n: number, locale?: string): string {
  if (!Number.isFinite(n)) return '–';
  if (!locale) return String(Math.round(n * 1000) / 1000);
  let f = numberFormats.get(locale);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
    }
    numberFormats.set(locale, f);
  }
  return f.format(n);
}

/**
 * A value as the panel lists it: numbers trimmed to 3 decimals (in the workspace's language with `locale`), a state as On / Off (`words`), text as it is,
 * anything else as short JSON.
 */
export function formatValue(value: unknown, unit?: string, words: StateWords = DEFAULT_STATE_WORDS, locale?: string): string {
  let text: string;
  if (value === null || value === undefined) return '–';
  if (typeof value === 'number') text = shownNumber(value, locale);
  else if (typeof value === 'boolean') text = value ? words.on : words.off;
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

/** A sample or a result in the preview line: text is quoted so `"on"` and `on` are told apart; a number in the workspace's language with `locale`. */
export function formatSample(value: unknown, locale?: string): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 30 ? `${value.slice(0, 29)}…` : value);
  if (value === undefined) return 'nothing';
  return formatValue(value, undefined, DEFAULT_STATE_WORDS, locale);
}

// ─── The one-liner ───────────────────────────────────────────────────────────

/** The two chips over two values (next-boilerplate phase 52.2.4, D589): their difference (A − B) and A as a percent of B (A ÷ B × 100). */
export type PairTemplateId = 'difference' | 'ratio';
export type ScriptTemplateId = 'invert' | 'scale' | 'round' | 'threshold' | 'words' | PairTemplateId;

export interface ScriptTemplate {
  id: ScriptTemplateId;
  script: string;
}

/** A raw range of a value: what it reads at 0 % and at 100 % (a soil probe: 1500 when dry, 3300 when soaked). */
export interface RawRange { from: number; to: number }

const numberText = (n: number): string => String(Math.round(n * 1e6) / 1e6);

/**
 * The 0–100 expression over a raw range (next-boilerplate e2e round 5, E15: a fixed `value / 4095 * 100` turned a probe's 2387 into 58 % where its own
 * scale, 1500 dry to 3300 soaked, says 49 %): `value / 3300 * 100` from 0, else `(value - 1500) / (3300 - 1500) * 100`, both numbers as the person gave them.
 */
export function scaleScript(range: RawRange): string {
  const { from, to } = range;
  if (from === 0) return `value / ${numberText(to)} * 100`;
  const minus = from < 0 ? `+ ${numberText(-from)}` : `- ${numberText(from)}`;
  return `(value ${minus}) / (${numberText(to)} ${minus}) * 100`;
}

/** Two numbers typed for a raw range ("1500", "3 300", "0,5"), or null when either is not a number or both are the same. */
export function rawRangeOf(from: string, to: string): RawRange | null {
  const num = (t: string): number | null => {
    const s = t.trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const a = num(from);
  const b = num(to);
  return a === null || b === null || a === b ? null : { from: a, to: b };
}

/** The raw range a key's profile declares (its `min` and `max`), or null when it declares none: the 0–100 helper starts from it. */
export function declaredRange(k: Pick<DeviceKey, 'min' | 'max'> | undefined): RawRange | null {
  return k && typeof k.min === 'number' && typeof k.max === 'number' && Number.isFinite(k.min) && Number.isFinite(k.max) && k.min !== k.max ? { from: k.min, to: k.max } : null;
}

/**
 * The quick-fill chips, each an expression over `value` (the field's picked value); the numbers are a starting point the person edits. "Scale 0–100" asks
 * for the raw range first (`scaleScript`); without one it is the plain 0–100 of a value that already reads 0 to 100.
 */
export function scriptTemplates(range: RawRange = { from: 0, to: 100 }): ScriptTemplate[] {
  return [
    { id: 'invert', script: '!value' },
    { id: 'scale', script: scaleScript(range) },
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

/**
 * What a template chip writes into a row's expression box (next-boilerplate e2e Slice 21, AD-15: "Round" replaced the typed `value / 250 * 100` with its
 * own text). Over an empty box: the template itself (`templateFor`). Over what the person typed: the template APPLIED to it, every `value` of the template
 * becoming the typed expression (in brackets unless it is one plain name), so typed work is wrapped or extended, never lost: Round over
 * `value / 250 * 100` is `Math.round((value / 250 * 100) * 10) / 10`. Null when the result would pass `MAX_SCRIPT_LENGTH`: the box keeps what it has.
 */
export function applyTemplate(template: ScriptTemplate, current: string, inputs: readonly { name: string }[], hasValue: boolean): string | null {
  const typed = current.trim();
  if (typed === '') return templateFor(template, inputs, hasValue);
  const operand = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(typed) ? typed : `(${typed})`;
  const out = template.script.replace(/\bvalue\b/g, () => operand);
  return out.length <= MAX_SCRIPT_LENGTH ? out : null;
}

/**
 * The expression "Scale 0–100" writes: the raw range over the RAW value (`value`, else the first other value when nothing is picked), never over what is
 * typed (next-boilerplate phase 52.2.4, test 3 #27: a second scale wrapped the first and showed −80.7; its form says "from the raw value").
 */
export function scaleOver(range: RawRange, inputs: readonly { name: string }[], hasValue: boolean): string {
  return templateFor({ id: 'scale', script: scaleScript(range) }, inputs, hasValue);
}

/** The two values a pair chip reads: the picked value and the first other value, else the first two other values; null while there are fewer than two. */
export function pairOperands(hasValue: boolean, inputs: readonly { name: string }[]): { a: string; b: string } | null {
  if (hasValue) return inputs[0] ? { a: 'value', b: inputs[0].name } : null;
  return inputs[0] && inputs[1] ? { a: inputs[0].name, b: inputs[1].name } : null;
}

/** "Difference" writes `A - B`; "Ratio (%)" writes `A / B * 100` (D589: a reservoir's outflow against its inflow, a pump's share of a station). */
export function pairScript(id: PairTemplateId, a: string, b: string): string {
  return id === 'difference' ? `${a} - ${b}` : `${a} / ${b} * 100`;
}

/**
 * What a pair chip writes into a row's expression box: `pairScript` over the two picked values, what its tooltip names (`A - B`, `A / B * 100`), in place of
 * whatever the box held. Never the typed expression in A's place (next-boilerplate phase 53.2.5, re-run 4 #6: "Ratio (%)" over a reject-rate formula
 * divided that formula by the first value and showed 66,667); the box's earlier text is the person's to put back (the panel's unsaved changes, the save's
 * Undo). Null when the result would pass `MAX_SCRIPT_LENGTH`.
 */
export function applyPair(id: PairTemplateId, pair: { a: string; b: string }): string | null {
  const out = pairScript(id, pair.a, pair.b);
  return out.length <= MAX_SCRIPT_LENGTH ? out : null;
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
export function previewLine(script: string, sample: unknown, outcome: ScriptOutcome | null, locale?: string): PreviewLine {
  if (script.trim() === '') return { kind: 'none' };
  if (sample === undefined) return { kind: 'wait' };
  if (outcome === null) return { kind: 'none' };
  if (!outcome.ok) return { kind: 'error', error: scriptErrorKind(outcome.error), detail: outcome.error.trim().slice(0, 120) };
  return { kind: 'ok', from: formatSample(sample, locale), to: formatSample(outcome.result, locale) };
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
  /** The symbol's device; '' when no one device is known and `candidates` decide. */
  deviceId: string;
  deviceName: string;
  /** `suggest: false` is a parameter nothing is proposed for (`SymbolFieldSpec.suggest`: a measuring symbol's Running and Status). */
  fields: ReadonlyArray<{ name: string; label: string; kind?: FieldKind; unit?: string; suggest?: SuggestMode }>;
  /** The keys the symbol's other parameters read already (its own entries, the drawing's own naming): never proposed again for it. */
  taken?: readonly string[];
  /**
   * The devices the symbol may read from while `deviceId` is '' (a site's devices, next-boilerplate phase 46.2: a site's view whose symbols name no
   * device yet), each with the place it sits in (`place`: the room or area of the site) when the host knows it. The device whose name or place holds the
   * symbol's own name is the symbol's (e2e round 5, E4: "Chiller 1 controller", or the device placed in "Chiller 1", for the symbol "Chiller 1"); a device
   * whose number or letter tells another twin ("Chiller 2 controller", "Sera 1 probe B" for "Sera 1 A"), or that another symbol's name claims, is never
   * this symbol's. Without such a name the device whose proposals score best is offered; devices that score the same are all offered (at most
   * `MAX_TIED_DEVICES`). Only a device that names the symbol, or the one device there is, makes a proposal certain: a guess across devices never is.
   */
  candidates?: ReadonlyArray<{ deviceId: string; deviceName: string; place?: string }>;
}

/** One row of the preview table: a parameter of a symbol with the device value proposed for it. */
export type MatchRow = {
  /** `<symbol id>.<field>`, and `@<device id>` after it for the second and later devices of a tie; internal. */
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

/** What one device proposes for one symbol: its rows, each row's reasons and score, its best row's score and the sum of them all. */
interface DeviceProposals {
  rows: MatchRow[];
  reasons: Map<string, readonly RankReason[]>;
  scores: Map<string, number>;
  /**
   * The best row's score: how well the device fits the symbol (a sum would let a device that answers more fields lead, test 3 #144). A row proposed only
   * from the part another row picked (`suggest: 'own'`) follows that row and proves nothing of its own: it counts only on a device with no other row
   * (next-boilerplate phase 53.2.6, re-run 4 #10: the fan's Status, following the fan's current guessed for a grain bin's Reading, tied the fan with the
   * logger's Grain level).
   */
  best: number;
  /** The sum of the rows' scores: only the order of devices that fit alike. */
  total: number;
}


function proposalsOn(s: MatchSymbol, deviceId: string, deviceName: string, keys: readonly DeviceKey[], idSuffix = '', place?: string): DeviceProposals {
  const rows: MatchRow[] = [];
  const reasons = new Map<string, readonly RankReason[]>();
  const scores = new Map<string, number>();
  let total = 0;
  let best = 0;
  let bestOwn = 0;
  const taken: string[] = [...(s.taken ?? [])];
  const device = `${deviceName} ${place ?? ''}`;
  // the parts the symbol reads already (its own entries): its own; a part proposed in this pass is its own only for a field proposed from its own part
  const stored = partsOf(s.taken ?? []);
  // a field proposed only from the symbol's own part comes after the others, so the part its Reading reads is known (52.2.6)
  const fields = [...s.fields.filter((f) => f.suggest !== false && f.suggest !== 'own'), ...s.fields.filter((f) => f.suggest === 'own')];
  for (const f of fields) {
    const own = f.suggest === 'own';
    const pool = own ? ownPartKeys(keys, taken, s) : keys;
    const [top, second] = rankKeysForField(f, pool, s.element, taken, [s.label, s.kindLabel], { device, parts: own ? [...stored, ...partsOf(taken)] : stored });
    if (!top || top.score < MIN_PROPOSAL_SCORE || (second && second.score === top.score)) continue;
    const k = keys.find((x) => x.key === top.key);
    if (!k) continue;
    taken.push(top.key);
    const id = `${s.id}.${f.name}${idSuffix}`;
    reasons.set(id, top.reasons);
    scores.set(id, top.score);
    total += top.score;
    if (own) bestOwn = Math.max(bestOwn, top.score); else best = Math.max(best, top.score);
    rows.push({
      id, symbolId: s.id, symbolLabel: s.label, kindLabel: s.kindLabel, field: f.name, fieldLabel: f.label,
      deviceId, deviceName, key: k.key, keyLabel: k.label && k.label.trim() ? k.label : k.key, value: k.value,
      ...(k.unit ? { unit: k.unit } : {}), ts: k.ts, confident: top.confident, ...(top.mismatch ? { mismatch: top.mismatch } : {}),
    });
  }
  return { rows, reasons, scores, best: best > 0 ? best : bestOwn, total };
}

/**
 * The keys of a symbol's own part (`SymbolFieldSpec.suggest: 'own'`): those of the part another of its fields reads (`taken`: a detector's `h2s.value`
 * makes `h2s.*` its own), those of its element, and those whose part is the symbol by name ("H2S · status" for the symbol "H2S"). Pure.
 */
export function ownPartKeys<K extends Pick<DeviceKey, 'key' | 'label'>>(keys: readonly K[], taken: readonly string[], s: { element?: string; label: string }): K[] {
  const parts = new Set(taken.map(partOf).filter((p) => p !== ''));
  if (s.element) parts.add(s.element.toLowerCase());
  return keys.filter((k) => {
    const part = partOf(k.key);
    return part !== '' && (parts.has(part) || keyNamesSymbol(k, s.label));
  });
}

/**
 * What a device's name adds for a symbol when no device names it: a DISTINCTIVE word or tag it shares with the symbol's name (`sharedNameWords`), one
 * that not every candidate holds ("Hisartepe" of "Hisartepe deposu RTU" for "Hisartepe +128 m"; never "room" or "oda", which many rooms share: test 3
 * #136). It breaks a tie between devices that send the same keys, but stays under `CONFIDENT_LEAD`.
 */
export const DEVICE_NAME_SCORE = 10;
/** The most devices a tie offers for one symbol (each with its own rows, none ticked): more would bury the table. */
export const MAX_TIED_DEVICES = 3;

/**
 * The codes a text writes (run 3 notes 60 and 131): a tag or a code word, one to four letters and a number, written together or with a hyphen (`FT-101`, `B-101`,
 * `CL1`, `K1`, `F1`, `B01`), folded and joined (`ft101`, `cl1`). A word cut by `wordsOf` loses them (`B-101` is `b` and `101`, neither a word that
 * matches), so a code is compared whole. A name with a space before its number ("Pump 1") holds no code.
 */
export function codesOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of foldText(text).matchAll(/(?:^|[^\p{L}\p{N}])(\p{L}{1,4})-?(\d{1,5}\p{L}?)(?=$|[^\p{L}\p{N}])/gu)) out.add(`${m[1]}${m[2]}`);
  return out;
}

const sharesCode = (a: ReadonlySet<string>, text: string): boolean => a.size > 0 && [...codesOf(text)].some((c) => a.has(c));

/** A code's number (with its letter after, `101`, `12b`): what a loop number shares (`LT-101` and `T-101`). */
const codeNumber = (code: string): string => code.replace(/^\p{L}+/u, '');
/**
 * Whether a text writes a code with the same number as one of `a` under other letters (`T-101` for `LT-101`; never `FT-102` for `FT-101`): codes compared by
 * their parts (next-boilerplate phase 52.2.1, test 3 #109). A loop number is a convention, not a proof: it ranks, it never makes a pick certain.
 */
export function sharesCodeNumber(a: ReadonlySet<string>, text: string): boolean {
  if (a.size === 0) return false;
  const numbers = new Set([...a].map(codeNumber));
  return [...codesOf(text)].some((c) => !a.has(c) && numbers.has(codeNumber(c)));
}
/** What a key that writes the symbol's code number under other letters earns: enough to rank it first among alike keys, never a certainty. */
export const PART_CODE_SCORE = 10;

/**
 * A number written with its sign in a name, with the short unit after it ("Hisartepe +128 m", "Kuyu −3 m"): a height or an offset the author wrote in, never
 * a tag that tells twins apart (test 3 #180: no reservoir was named while its height was in its name).
 */
const SIGNED_NUMBER = /(^|\s)[+±−-]\s*\d+(?:[.,]\d+)?(?:\s*\p{L}{1,3}(?=$|[^\p{L}\p{N}]))?/gu;

/** A name as words and as tags (the numbers and single letters that tell twins apart: "Chiller 1", "Sera 1 A", "T-101"), as the word table's English words. */
function nameParts(text: string): { words: Set<string>; tags: Set<string> } {
  const all = canonicalWords(text.replace(SIGNED_NUMBER, '$1'));
  return { words: new Set(all.filter(matchable)), tags: new Set(all.filter((w) => !matchable(w))) };
}

/** The words of a symbol's name that need not be in a device's name for it to name the symbol: its kind's, an instrument's and a reading's words. */
function optionalNameWords(kindLabel: string | undefined): Set<string> {
  return new Set([...(kindLabel ? canonicalWords(kindLabel) : []), ...INSTRUMENT_WORDS, ...READING_WORDS]);
}

/**
 * How a device stands to a symbol by name, its words read through the word table (D585: "Kat 3 oksijen" against "Floor 3 gas alarm panel"): `names` when
 * the device's name or place holds every tag of the symbol's name and every word of it but the words of its kind, of an instrument or of a reading (the
 * monitor placed in "Gowning room" names "Gowning room pressure"; the sensor of the "Reading hall" names "Reading hall thermostat": next-boilerplate phase
 * 52.2.2, test 3 #136, #144), and holds at least one word or tag of it that many places share not ("room", "hall" and "floor" alone name nothing);
 * `twin` when they share a word or a tag but each has a tag the other lacks ("Chiller 2 controller" for "Chiller 1", "Sera 1 probe B" for "Sera 1 A",
 * "Floor 2 gas alarm panel" for "Kat 3 oksijen"): another of the same things; `shares` when they share a word; else `none`.
 */
export function deviceNameRelation(device: { deviceName: string; place?: string }, symbolLabel: string, kindLabel?: string): 'names' | 'twin' | 'shares' | 'none' {
  const own = nameParts(symbolLabel);
  if (own.words.size + own.tags.size === 0) return 'none';
  const dev = nameParts(`${device.deviceName} ${device.place ?? ''}`);
  const optional = optionalNameWords(kindLabel);
  const needed = [...own.words].filter((w) => !optional.has(w));
  const held = [...own.words, ...own.tags].filter((w) => dev.words.has(w) || dev.tags.has(w));
  if (needed.length + own.tags.size > 0 && needed.every((w) => dev.words.has(w)) && [...own.tags].every((w) => dev.tags.has(w)) && held.some((w) => !GENERIC_NAME_WORDS.has(w))) return 'names';
  const sharesWord = [...own.words].some((w) => dev.words.has(w));
  const sharesAny = sharesWord || [...own.tags].some((w) => dev.tags.has(w));
  if (sharesAny && [...dev.tags].some((w) => !own.tags.has(w)) && [...own.tags].some((w) => !dev.tags.has(w))) return 'twin';
  return sharesWord ? 'shares' : 'none';
}

/**
 * The words and tags of a symbol's name that a device's name or place holds, but the words many places share ("room", "oda", "floor", "hall"): what earns a
 * device the name bonus (`DEVICE_NAME_SCORE`, when not every device holds it) and what the panel's device suggestion counts (the best such match, test 3
 * #182: "Çarşı deposu RTU" for "Çarşı deposu +104 m").
 */
export function sharedNameWords(device: { deviceName: string; place?: string }, symbolLabel: string): Set<string> {
  const own = nameParts(symbolLabel);
  const dev = nameParts(`${device.deviceName} ${device.place ?? ''}`);
  const out = new Set<string>();
  for (const w of own.words) if (dev.words.has(w) && !GENERIC_NAME_WORDS.has(w)) out.add(w);
  for (const w of own.tags) if (dev.tags.has(w)) out.add(w);
  return out;
}

/** A symbol named by its author (not only by its kind): its name can claim a device. */
const ownName = (s: Pick<MatchSymbol, 'label' | 'kindLabel'>): boolean => s.label.trim() !== '' && norm(s.label) !== norm(s.kindLabel);

/**
 * The proposals for a whole drawing: for every parameter of every symbol, the best key of the symbol's device by `rankKeysForField` (the element rule, the
 * symbol's name on the device's equipment, the words of the symbol, the kind, the unit), one key per symbol at most once. A parameter with no candidate, a
 * candidate under `MIN_PROPOSAL_SCORE`, a tie at the top between two keys, or a parameter nothing is proposed for (`suggest: false`) has no row; a confident
 * one is checked by default, a weaker one is offered unchecked, a mismatch is said. A device whose keys are not known proposes nothing. A symbol with no
 * device of its own and `candidates` (a site's devices, phase 46.2) is matched across them as `MatchSymbol.candidates` says (e2e round 5, E3 and E4): the
 * device its name points at, else the one device that writes its code, else the one device whose code shares its number (a loop number: proposed, never
 * certain), else every viable device, each by its best row (never by the sum of its rows, test 3 #144). Several symbols claiming one value are never all
 * certain: of the claimants that were certain, only one that leads the others by `CONFIDENT_LEAD` stays so (test 3 #91); a claimant offered unticked takes
 * no certainty from anyone (test 3 #109).
 */
export function matchAllRows(symbols: readonly MatchSymbol[], keysByDevice: ReadonlyMap<string, readonly DeviceKey[]>): MatchRow[] {
  const out: MatchRow[] = [];
  // the score of each row, kept aside for the claims pass
  const scoreOf = new Map<string, number>();
  // `sure`: the device is the symbol's own and leads clearly; `byName`: it leads clearly, so a row that reads the symbol's own equipment by its id or its
  // name (the element rule, `label`: a "Flow meter" on the one site device that sends "Flow meter · value") keeps its certainty on it
  const take = (p: DeviceProposals, sure: boolean, byName = sure) => {
    for (const r of p.rows) {
      const reasons = p.reasons.get(r.id) ?? [];
      out.push(sure || (byName && (reasons.includes('element') || reasons.includes('label'))) ? r : { ...r, confident: false });
      scoreOf.set(r.id, p.scores.get(r.id) ?? 0);
    }
  };
  // the devices each symbol's own name claims: such a device is that symbol's, never another named symbol's
  const named = symbols.filter(ownName);
  // a name every device of the place holds (the place's own name: "Silo" on the site "Silo 1", whose logger and fan are both placed there) picks no device
  // out: it claims none of them, and the symbol it names is ranked across them by its kind (next-boilerplate phase 53.2.6, re-run 4 #9, #10: the bin
  // "Silo" claimed both devices, so the twelve "Cable N · point M" thermometers had none left)
  const placeWide = (o: Pick<MatchSymbol, 'label' | 'kindLabel'>, devices: ReadonlyArray<{ deviceName: string; place?: string }>): boolean =>
    devices.length > 0 && devices.every((c) => deviceNameRelation(c, o.label, o.kindLabel) === 'names');
  for (const s of symbols) {
    if (s.deviceId) {
      const keys = keysByDevice.get(s.deviceId);
      if (keys && keys.length > 0) take(proposalsOn(s, s.deviceId, s.deviceName, keys), true);
      continue;
    }
    const candidates = s.candidates ?? [];
    const mine = ownName(s);
    // the named symbols whose name picks devices out of these (never one that names them all)
    const claimants = named.filter((o) => o.id !== s.id && !placeWide(o, candidates));
    // a twin (another number or letter of the same thing) is never this symbol's; nor is a device another symbol's name claims and this one's does not,
    // unless this one's name shares a word of its own with it ("Hisartepe klor" may read the RTU that "Hisartepe deposu" names)
    const viable = candidates.filter((c) => {
      const rel = mine ? deviceNameRelation(c, s.label, s.kindLabel) : 'none';
      if (rel === 'twin') return false;
      if (rel === 'names') return true;
      if (mine && [...sharedNameWords(c, s.label)].some((w) => matchable(w) && !optionalNameWords(s.kindLabel).has(w))) return true;
      return !claimants.some((o) => deviceNameRelation(c, o.label, o.kindLabel) === 'names');
    });
    const naming = mine && !placeWide(s, candidates) ? viable.filter((c) => deviceNameRelation(c, s.label, s.kindLabel) === 'names') : [];
    // without one, the devices that write the symbol's code (`CL1 collector` and the `CL1 controller`, run 3 note 60): a shared word added only a little, so
    // a device whose keys fitted the kind better (the sorter) won; a code names the thing
    const codes = mine ? codesOf(s.label) : new Set<string>();
    const coded = naming.length === 0 && codes.size > 0 ? viable.filter((c) => sharesCode(codes, `${c.deviceName} ${c.place ?? ''}`)) : [];
    // else the one device whose code shares the symbol's number under other letters (the tank `T-101` for the gauge `LT-101`, test 3 #109): proposed only
    const looped = naming.length === 0 && coded.length === 0 && codes.size > 0 ? viable.filter((c) => sharesCodeNumber(codes, `${c.deviceName} ${c.place ?? ''}`)) : [];
    // the device the symbol's name points at decides; only without one is the symbol ranked across the others
    const pool = naming.length > 0 ? naming : coded.length > 0 ? coded : looped.length === 1 ? looped : viable;
    const read = pool
      .map((c) => ({ c, keys: keysByDevice.get(c.deviceId) }))
      .filter((o): o is { c: { deviceId: string; deviceName: string; place?: string }; keys: readonly DeviceKey[] } => !!o.keys && o.keys.length > 0)
      .map((o) => ({ ...proposalsOn(s, o.c.deviceId, o.c.deviceName, o.keys, '', o.c.place), c: o.c }))
      .filter((p) => p.rows.length > 0);
    // the name bonus: only for a word or tag of the symbol that not every device here holds (`sharedNameWords`; "room" of three rooms is no reason)
    const shared = new Map(read.map((p) => [p, naming.length === 0 && mine ? sharedNameWords(p.c, s.label) : new Set<string>()]));
    const holders = (w: string) => read.filter((p) => shared.get(p)!.has(w)).length;
    const options = read
      .map((p) => ({ ...p, fit: p.best + ([...shared.get(p)!].some((w) => holders(w) < read.length) ? DEVICE_NAME_SCORE : 0) }))
      .sort((a, b) => b.fit - a.fit || b.total - a.total);
    const [best, next] = options;
    if (!best) continue;
    const tied = options.filter((o) => o.fit === best.fit);
    if (tied.length > 1) {
      // devices that fit the same are all offered, none ticked: the person knows which one it is (a tie dropped said "nothing to propose")
      tied.slice(0, MAX_TIED_DEVICES).forEach((o, i) => {
        const p = i === 0 ? o : proposalsOn(s, o.c.deviceId, o.c.deviceName, keysByDevice.get(o.c.deviceId) ?? [], `@${o.c.deviceId}`, o.c.place);
        for (const r of p.rows) { out.push({ ...r, confident: false }); scoreOf.set(r.id, p.scores.get(r.id) ?? 0); }
      });
      continue;
    }
    // certain only on the symbol's own device: the one device its name points at, the one that writes its code, or the one device there is; a guess
    // across devices never is, nor is a loop number or a name that points at several
    const own = naming.length === 1 || coded.length === 1 || candidates.length === 1;
    const lead = !next || best.fit - next.fit >= CONFIDENT_LEAD;
    take(best, own && lead, lead);
  }
  // several symbols claiming one value of one device: never all certain. Of the claimants that were certain (an unticked one takes no certainty from anyone,
  // test 3 #109), the one that leads the others by `CONFIDENT_LEAD` stays certain, the rest are offered unticked (test 3 #91: a heat meter and a plate heat
  // exchanger were both certain of the heat power); the one state key of a device thus never ticks a whole drawing onto itself
  const claims = new Map<string, MatchRow[]>();
  for (const r of out) if (r.confident) { const k = `${r.deviceId}\n${r.field}\n${r.key}`; claims.set(k, [...(claims.get(k) ?? []), r]); }
  for (const rows of claims.values()) {
    if (rows.length < 2) continue;
    const byScore = [...rows].sort((a, b) => (scoreOf.get(b.id) ?? 0) - (scoreOf.get(a.id) ?? 0));
    const leads = (scoreOf.get(byScore[0].id) ?? 0) - (scoreOf.get(byScore[1].id) ?? 0) >= CONFIDENT_LEAD;
    byScore.forEach((r, i) => { if (i > 0 || !leads) r.confident = false; });
  }
  return out;
}

/** Why "Match everything" has nothing to propose: every symbol is connected, the devices sent no values, there is no device to read, or no proposal is sure. */
export type MatchEmptyReason = 'allLinked' | 'noValues' | 'noDevices' | 'unsure';

/**
 * Why `matchAllRows` gave no row for these symbols (next-boilerplate e2e round 5, E4: "Nothing to propose" was said while nothing was linked and the
 * devices were live): `allLinked` when no symbol has a parameter left to connect (only those the host passes), `noDevices` when no symbol has a device to
 * read (its own or a candidate), `noValues` when none of those devices has sent a value, else `unsure`: there are values, but no proposal is good enough.
 */
export function matchEmptyReason(symbols: readonly MatchSymbol[], keysByDevice: ReadonlyMap<string, readonly DeviceKey[]>): MatchEmptyReason {
  const open = symbols.filter((s) => s.fields.some((f) => f.suggest !== false));
  if (open.length === 0) return 'allLinked';
  const devices = new Set(open.flatMap((s) => (s.deviceId ? [s.deviceId] : (s.candidates ?? []).map((c) => c.deviceId))));
  if (devices.size === 0) return 'noDevices';
  if (![...devices].some((d) => (keysByDevice.get(d)?.length ?? 0) > 0)) return 'noValues';
  return 'unsure';
}

/**
 * The entries "Match everything" writes for the chosen rows: one per symbol, each field read from the proposed key of the symbol's device. When the rows of
 * two tied devices are both ticked for one parameter, the first in the table's order is written.
 */
export function entriesOfMatches(rows: readonly MatchRow[], chosen: ReadonlySet<string>): Record<string, BindingEntry> {
  const out: Record<string, BindingEntry> = {};
  for (const r of rows) {
    if (!chosen.has(r.id) || !isSymbolField(r.field) || !isTelemetryKey(r.key) || !UUID_GRAMMAR.test(r.deviceId)) continue;
    const entry = (out[r.symbolId] ??= { fields: {} });
    if (own(entry.fields, r.field)) continue;
    entry.fields[r.field] = { deviceId: r.deviceId, key: r.key, ...(r.keyLabel && r.keyLabel !== r.key ? { label: r.keyLabel.slice(0, MAX_FIELD_LABEL) } : {}) };
  }
  return out;
}
