/**
 * The SNMP mapping of a device profile and the test poll (docs/concepts/iot-platform/phases/11-snmp-targets.md §11.3, §11.4; NB
 * iot_gateway 11: the profile's `protocolSettings` block, D300 / D307). The shapes follow NB's block: scalar rows, walked tables and
 * trap rows, numeric OIDs only (OD-66: no MIB file anywhere). The helpers below are pure: the editor and the host's tests share them.
 */

export const SNMP_VALUE_TYPES = ['auto', 'gauge', 'counter32', 'counter64', 'timeticks', 'string', 'enum', 'ipaddr'] as const;
export type SnmpValueType = (typeof SNMP_VALUE_TYPES)[number];
export const SNMP_KINDS = ['telemetry', 'attribute'] as const;
export type SnmpKind = (typeof SNMP_KINDS)[number];

/** How one SNMP value becomes a key's value (a scalar row or a table column). */
export type SnmpValueRow = {
  oid: string;
  key: string;
  type?: SnmpValueType;
  /** A counter as a per-second rate (32-bit wrap handled; the first sample after a start is not emitted). */
  rate?: boolean;
  /** A multiplier (`0.1`: tenths to units); never 0. */
  scale?: number;
  unit?: string;
  /** For `enum`: the integer value → its word. */
  enumMap?: Record<string, string>;
};

export type SnmpScalarRow = SnmpValueRow & { kind?: SnmpKind };

/** A walked table: every row of every column becomes `<column key>.<row name>`. */
export type SnmpTableMapping = {
  /** A label for the editor (`ifTable`); the collector does not read it. */
  name?: string;
  /** `index` (the row's OID suffix) or the OID of a column whose value names the row (ifName, ifDescr). */
  indexBy?: string;
  maxRows?: number;
  columns: SnmpValueRow[];
};

/** A trap a Roltek router maps to a key (the cloud collector receives no traps). */
export type SnmpTrapMapping = {
  trapOid: string;
  key: string;
  /** 1, or the value of one varbind of the trap. */
  value?: 1 | { fromVarbind: string };
  varbinds?: Array<{ oid: string; key: string }>;
};

/** The profile's SNMP block. Unknown fields are kept as they are (the host owns the block). */
export type SnmpMapping = {
  timeoutMs?: number;
  retries?: number;
  maxRepetitions?: number;
  mapping?: SnmpScalarRow[];
  tables?: SnmpTableMapping[];
  traps?: SnmpTrapMapping[];
  [field: string]: unknown;
};

/** One problem of the block: a dotted path inside it (`mapping.3.oid`, `tables.0.columns.1.key`, `tables`) and a short code. */
export type SnmpMappingIssue = { path: string; message: string };

/** The bounds the host judges the block by (NB `snmp.profile.ts`). */
export type SnmpLimits = {
  maxTelemetryKeys: number;
  maxAttributeKeys: number;
  maxMappingRows: number;
  maxTables: number;
  maxTableColumns: number;
  maxTableRows: number;
  defaultTableRows: number;
  maxTrapRows: number;
  maxTrapVarbinds: number;
  maxEnumValues: number;
};

export const SNMP_DEFAULT_LIMITS: SnmpLimits = {
  maxTelemetryKeys: 200,
  maxAttributeKeys: 50,
  maxMappingRows: 200,
  maxTables: 8,
  maxTableColumns: 16,
  maxTableRows: 256,
  defaultTableRows: 64,
  maxTrapRows: 100,
  maxTrapVarbinds: 16,
  maxEnumValues: 64,
};

/** The transport knobs of one poll and their bounds and defaults. */
export const SNMP_POLL_RANGES = {
  timeoutMs: { min: 200, max: 10_000, value: 2_000 },
  retries: { min: 0, max: 3, value: 1 },
  maxRepetitions: { min: 1, max: 50, value: 10 },
} as const;

// ── Test poll (§11.4) ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A device the test poll can ask: one bound to an SNMP endpoint (never a credential). */
export type SnmpTestPollDevice = {
  deviceId: string;
  name: string;
  endpointName?: string;
  host?: string;
  version?: 'v2c' | 'v3' | string;
  /** Why this device cannot be polled now (`snmp_v2c_disabled_for_tenant`, `endpoint_disabled`, …); null = ready. */
  blocked?: string | null;
};

/** One OID of a test-poll answer: the SNMP wire type (`integer`, `octets`, `counter64`, …), the raw value, or the agent's exception. */
export type SnmpTestPollVarbind = {
  oid: string;
  /** A name the host knows for it (templates); never required. */
  name?: string;
  type: string;
  value: string | number | null;
  /** `noSuchObject`, `noSuchInstance`, `endOfMibView`, or a host code. */
  error?: string | null;
};

export type SnmpTestPollResult = {
  ok: boolean;
  /** Why the whole poll failed (`timeout`, `auth_failed`, `host_not_public`, …); null when it ran. */
  failure: string | null;
  durationMs: number;
  varbinds: SnmpTestPollVarbind[];
  warnings?: string[];
};

/** The default OIDs of a test poll (MIB-II system group). */
export const SNMP_SYSTEM_OIDS = [
  { oid: '1.3.6.1.2.1.1.1.0', name: 'sysDescr.0', key: 'sys.descr' },
  { oid: '1.3.6.1.2.1.1.2.0', name: 'sysObjectID.0', key: 'sys.object_id' },
  { oid: '1.3.6.1.2.1.1.3.0', name: 'sysUpTime.0', key: 'uptime' },
  { oid: '1.3.6.1.2.1.1.5.0', name: 'sysName.0', key: 'sys.name' },
] as const;

export const SNMP_TEST_POLL_MAX_OIDS = 64;

// ── Pure helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

const MAX_OID_ARCS = 128;

/** A numeric OID (`1.3.6.1.2.1.1.3.0`, a leading dot allowed) as the host parses it; MIB names are not OIDs (OD-66). */
export function isNumericOid(text: string): boolean {
  const t = text.trim().replace(/^\./, '');
  if (!/^[0-9]+(\.[0-9]+)+$/.test(t)) return false;
  const arcs = t.split('.').map(Number);
  if (arcs.length > MAX_OID_ARCS || arcs.some((a) => !Number.isSafeInteger(a) || a > 0xffffffff)) return false;
  return !(arcs[0] > 2 || (arcs[0] < 2 && arcs[1] > 39));
}

export const normaliseOid = (text: string): string => text.trim().replace(/^\./, '');

/** A key as the profile's key rules take it: a letter, then letters, digits, `_ . : -`, at most 96 characters. */
export const SNMP_KEY_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/;
export const isSnmpKey = (key: string): boolean => SNMP_KEY_RE.test(key.trim());

const isCounter = (t: SnmpValueType | undefined) => t === 'counter32' || t === 'counter64' || t === 'auto' || t === undefined;

/** The most telemetry keys and attributes the block can produce in one poll (every table full). */
export function expectedKeys(m: SnmpMapping, limits: SnmpLimits = SNMP_DEFAULT_LIMITS): { telemetry: number; attributes: number } {
  const rows = m.mapping ?? [];
  const tables = m.tables ?? [];
  const scalars = rows.filter((r) => (r.kind ?? 'telemetry') === 'telemetry').length;
  const walked = tables.reduce((n, t) => n + t.columns.length * (t.maxRows ?? limits.defaultTableRows), 0);
  return { telemetry: scalars + walked, attributes: rows.filter((r) => r.kind === 'attribute').length };
}

/** A sample row name for a table's key preview: an interface name when the rows are named by a column, else an index. */
export function tableKeyPreview(t: SnmpTableMapping, sample?: string): string[] {
  const label = sample ?? (t.indexBy && t.indexBy !== 'index' ? 'eth0' : '1');
  return t.columns.map((c) => `${c.key || '…'}.${label}`);
}

function valueIssues(v: SnmpValueRow, at: string, limits: SnmpLimits, out: SnmpMappingIssue[]): void {
  if (!isNumericOid(v.oid ?? '')) out.push({ path: `${at}.oid`, message: 'invalid_oid' });
  if (!isSnmpKey(v.key ?? '')) out.push({ path: `${at}.key`, message: 'invalid_key' });
  if (v.scale !== undefined && (!Number.isFinite(v.scale) || v.scale === 0)) out.push({ path: `${at}.scale`, message: 'scale_zero' });
  if (v.unit !== undefined && v.unit.trim().length > 16) out.push({ path: `${at}.unit`, message: 'unit_too_long' });
  if (v.rate && !isCounter(v.type)) out.push({ path: `${at}.rate`, message: 'rate_needs_counter' });
  if (v.type === 'enum' && (!v.enumMap || !Object.keys(v.enumMap).length)) out.push({ path: `${at}.enumMap`, message: 'enum_map_required' });
  if (v.enumMap && Object.keys(v.enumMap).length > limits.maxEnumValues) out.push({ path: `${at}.enumMap`, message: 'too_many_enum_values' });
  if (v.enumMap && Object.entries(v.enumMap).some(([k, w]) => !/^-?\d{1,10}$/.test(k) || !w.trim() || w.trim().length > 64)) out.push({ path: `${at}.enumMap`, message: 'invalid_enum_map' });
}

const inRange = (n: unknown, r: { min: number; max: number }) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= r.min && n <= r.max);

/**
 * What the host would refuse in the block, with its paths and codes (NB `parseSnmpProfile`): bad OIDs and keys, rate on a non-counter,
 * an enum without its map, duplicate keys and scalar OIDs, too many rows, and a key budget above the profile's limits. The host judges
 * again; its issues use the same paths.
 */
export function snmpMappingIssues(m: SnmpMapping, limits: SnmpLimits = SNMP_DEFAULT_LIMITS): SnmpMappingIssue[] {
  const out: SnmpMappingIssue[] = [];
  const rows = m.mapping ?? [];
  const tables = m.tables ?? [];
  const traps = m.traps ?? [];
  for (const k of Object.keys(SNMP_POLL_RANGES) as Array<keyof typeof SNMP_POLL_RANGES>) if (!inRange(m[k], SNMP_POLL_RANGES[k])) out.push({ path: k, message: 'out_of_range' });
  if (rows.length > limits.maxMappingRows) out.push({ path: 'mapping', message: 'too_many_rows' });
  if (tables.length > limits.maxTables) out.push({ path: 'tables', message: 'too_many_tables' });
  if (traps.length > limits.maxTrapRows) out.push({ path: 'traps', message: 'too_many_rows' });
  rows.forEach((r, i) => {
    valueIssues(r, `mapping.${i}`, limits, out);
    if (r.kind === 'attribute' && r.rate) out.push({ path: `mapping.${i}.rate`, message: 'attribute_rate' });
  });
  tables.forEach((t, ti) => {
    if (t.indexBy !== undefined && t.indexBy !== 'index' && !isNumericOid(t.indexBy)) out.push({ path: `tables.${ti}.indexBy`, message: 'invalid_oid' });
    if (t.maxRows !== undefined && !(Number.isInteger(t.maxRows) && t.maxRows >= 1 && t.maxRows <= limits.maxTableRows)) out.push({ path: `tables.${ti}.maxRows`, message: 'out_of_range' });
    if (!t.columns.length) out.push({ path: `tables.${ti}.columns`, message: 'columns_required' });
    if (t.columns.length > limits.maxTableColumns) out.push({ path: `tables.${ti}.columns`, message: 'too_many_columns' });
    t.columns.forEach((c, ci) => valueIssues(c, `tables.${ti}.columns.${ci}`, limits, out));
  });
  traps.forEach((t, i) => {
    if (!isNumericOid(t.trapOid ?? '')) out.push({ path: `traps.${i}.trapOid`, message: 'invalid_oid' });
    if (!isSnmpKey(t.key ?? '')) out.push({ path: `traps.${i}.key`, message: 'invalid_key' });
    if (t.value && t.value !== 1 && !isNumericOid(t.value.fromVarbind)) out.push({ path: `traps.${i}.value`, message: 'invalid_oid' });
    if ((t.varbinds ?? []).length > limits.maxTrapVarbinds) out.push({ path: `traps.${i}.varbinds`, message: 'too_many_rows' });
    if ((t.varbinds ?? []).some((v) => !isNumericOid(v.oid) || !isSnmpKey(v.key))) out.push({ path: `traps.${i}.varbinds`, message: 'invalid_varbind' });
  });
  const keys = new Set<string>();
  const dup = (key: string, path: string) => { if (key && keys.has(key)) out.push({ path, message: 'duplicate_key' }); keys.add(key); };
  rows.forEach((r, i) => dup(r.key, `mapping.${i}.key`));
  tables.forEach((t, ti) => t.columns.forEach((c, ci) => dup(c.key, `tables.${ti}.columns.${ci}.key`)));
  const oids = new Set<string>();
  rows.forEach((r, i) => { const o = normaliseOid(r.oid ?? ''); if (o && oids.has(o)) out.push({ path: `mapping.${i}.oid`, message: 'duplicate_oid' }); oids.add(o); });
  const budget = expectedKeys(m, limits);
  if (budget.telemetry > limits.maxTelemetryKeys) out.push({ path: 'tables', message: 'too_many_keys' });
  if (budget.attributes > limits.maxAttributeKeys) out.push({ path: 'mapping', message: 'too_many_attributes' });
  return out;
}

/**
 * The issues under one row (`mapping.3`, `tables.0`, `tables.0.columns.2`, `traps.1`) by the next field of their path, the first of
 * each: for `tables.0`, an issue at `tables.0.columns.2.key` is filed under `columns`.
 */
export function rowIssues(issues: readonly SnmpMappingIssue[], prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    if (!i.path.startsWith(`${prefix}.`)) continue;
    const f = i.path.slice(prefix.length + 1).split('.')[0];
    if (!(f in out)) out[f] = i.message;
  }
  return out;
}

/** The type a test-poll answer suggests for a row (the SNMP wire type → the mapping type). */
export function detectedType(snmpType: string): SnmpValueType {
  switch (snmpType) {
    case 'counter32': return 'counter32';
    case 'counter64': return 'counter64';
    case 'gauge32': case 'integer': return 'gauge';
    case 'timeticks': return 'timeticks';
    case 'octets': case 'oid': return 'string';
    case 'ipaddr': return 'ipaddr';
    default: return 'auto';
  }
}

/** A key for an OID nobody named yet: the system group's own names, else `oid_<arcs>`; made unique against `taken`. */
export function suggestKey(oid: string, taken: ReadonlySet<string> = new Set()): string {
  const o = normaliseOid(oid);
  const known = SNMP_SYSTEM_OIDS.find((s) => s.oid === o)?.key;
  const base = (known ?? `oid_${o.replace(/\./g, '_')}`).slice(0, 90);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
}

/** The mapping row a test-poll answer suggests (counters as rates, text as attributes). */
export function rowFromVarbind(vb: SnmpTestPollVarbind, taken: ReadonlySet<string>): SnmpScalarRow {
  const type = detectedType(vb.type);
  const counter = type === 'counter32' || type === 'counter64';
  const text = type === 'string' || type === 'ipaddr';
  return { oid: normaliseOid(vb.oid), key: suggestKey(vb.oid, taken), kind: text ? 'attribute' : 'telemetry', type, ...(counter ? { rate: true } : {}) };
}

/** Every key the block names (scalars, columns, traps), for `suggestKey`. */
export function keysOf(m: SnmpMapping): Set<string> {
  return new Set([...(m.mapping ?? []).map((r) => r.key), ...(m.tables ?? []).flatMap((t) => t.columns.map((c) => c.key)), ...(m.traps ?? []).map((t) => t.key)]);
}

/**
 * What a scalar row would store from one test-poll value, as far as one sample tells: the key and the scaled value, `rate` when the row
 * is a rate (it needs two samples), or null when the row would store nothing (an exception, a value that does not fit the row's type).
 */
export function mappedPreview(row: SnmpScalarRow, vb: SnmpTestPollVarbind): { key: string; value: string | number | null; rate?: true } {
  if (vb.error || vb.value === null) return { key: row.key, value: null };
  if (row.rate) return { key: row.key, value: null, rate: true };
  const scale = row.scale ?? 1;
  const type = row.type ?? 'auto';
  const num = typeof vb.value === 'number' ? vb.value : /^-?\d+(\.\d+)?$/.test(String(vb.value)) ? Number(vb.value) : null;
  const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 1e6) / 1e6);
  // timeticks come as hundredths of a second
  const base = vb.type === 'timeticks' && num !== null ? num / 100 : num;
  if (type === 'string' || type === 'ipaddr') return { key: row.key, value: String(vb.value) };
  if (type === 'enum') return { key: row.key, value: num === null ? null : row.enumMap?.[String(num)] ?? String(num) };
  if (type === 'timeticks') return { key: row.key, value: vb.type === 'timeticks' && base !== null ? round(base * scale) : null };
  if (base === null) return { key: row.key, value: type === 'auto' ? String(vb.value) : null };
  return { key: row.key, value: round(base * scale) };
}

/** `1=up\n2=down` → `{ 1: 'up', 2: 'down' }` (blank lines skipped); the lines it could not read are returned too. */
export function parseEnumMap(text: string): { map: Record<string, string>; bad: string[] } {
  const map: Record<string, string> = {};
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(-?\d{1,10})\s*[=:]\s*(.+)$/.exec(line);
    if (m) map[m[1]] = m[2].trim(); else bad.push(line);
  }
  return { map, bad };
}

export const enumMapText = (m: Record<string, string> | undefined): string => Object.entries(m ?? {}).map(([k, v]) => `${k}=${v}`).join('\n');

/** `oid=key` lines (trap varbinds) → rows; the lines it could not read are returned too. */
export function parsePairs(text: string): { rows: Array<{ oid: string; key: string }>; bad: string[] } {
  const rows: Array<{ oid: string; key: string }> = [];
  const bad: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([.0-9]+)\s*[=:]\s*(\S+)$/.exec(line);
    if (m && isNumericOid(m[1]) && isSnmpKey(m[2])) rows.push({ oid: normaliseOid(m[1]), key: m[2] }); else bad.push(line);
  }
  return { rows, bad };
}

/** Typed or pasted OIDs (one per line, commas or spaces too) → the numeric ones (deduplicated, capped) and the rest. */
export function parseOidList(text: string, max = SNMP_TEST_POLL_MAX_OIDS): { oids: string[]; bad: string[]; capped: boolean } {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const oids: string[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    if (!isNumericOid(p)) { bad.push(p); continue; }
    const o = normaliseOid(p);
    if (!oids.includes(o)) oids.push(o);
  }
  return { oids: oids.slice(0, max), bad, capped: oids.length > max };
}
