import type { SettingClass, SettingsAnnotations, SettingsSchemaNode } from '../types/settings';

/**
 * Pure helpers over a section's JSON Schema (the manifest subset): what kind of control a property is, its label, its default, the
 * client-side check before the server's dry run, secrets as write-only markers, and the difference of two documents. The server
 * validates again with the device's own manifest; this only lets a person see a mistake where it is before asking.
 */

export type Path = Array<string | number>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const annotationsOf = (node: SettingsSchemaNode | undefined): SettingsAnnotations => node?.['x-roltek'] ?? {};

/** A manifest text in the viewer's language: the exact tag, its language, English, then any. */
export function localized(text: string | Record<string, string> | null | undefined, locale?: string): string | undefined {
  if (text == null) return undefined;
  if (typeof text === 'string') return text;
  const lang = (locale ?? 'en').toLowerCase();
  return text[lang] ?? text[lang.split('-')[0]] ?? text.en ?? Object.values(text)[0];
}

export const titleCase = (k: string): string =>
  k.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const SCALAR_TYPES = new Set(['string', 'number', 'integer', 'boolean']);
const isScalar = (n: SettingsSchemaNode | undefined): boolean =>
  !!n && (SCALAR_TYPES.has(n.type ?? '') || Array.isArray(n.enum) || n.const !== undefined || (!!n.oneOf && n.oneOf.every(isScalar)));

export type NodeKind = 'secret' | 'fixed' | 'scalar' | 'choice' | 'scalar-list' | 'object-list' | 'object' | 'variant' | 'unknown';

/**
 * How a property is drawn: a write-only `secret`; a `fixed` value only the device can change (`remote: false`); a `scalar` field; a
 * `choice` (a `oneOf` of scalars: "Automatic" or a number); a list of scalars; a list of objects (a table, a drawer per row); an `object`
 * (a group); a `variant` (a `oneOf` of objects told apart by a constant property).
 */
export function nodeKind(node: SettingsSchemaNode): NodeKind {
  const a = annotationsOf(node);
  if (a.sensitive) return 'secret';
  if (a.remote === false) return 'fixed';
  if (node.oneOf?.length) return node.oneOf.every(isScalar) ? 'choice' : node.oneOf.every((b) => b.type === 'object' || !!b.properties) ? 'variant' : 'unknown';
  if (node.type === 'array') {
    if (!node.items) return 'unknown';
    if (isScalar(node.items)) return 'scalar-list';
    return node.items.type === 'object' || node.items.properties || node.items.oneOf ? 'object-list' : 'unknown';
  }
  if (node.type === 'object' || node.properties) return 'object';
  return isScalar(node) ? 'scalar' : 'unknown';
}

/** The property of every branch that holds a constant: the "kind" a `variant` is told apart by. */
export function discriminatorOf(node: SettingsSchemaNode): string | null {
  const branches = node.oneOf ?? [];
  if (!branches.length) return null;
  const first = Object.entries(branches[0].properties ?? {}).filter(([, p]) => p.const !== undefined).map(([k]) => k);
  return first.find((k) => branches.every((b) => b.properties?.[k]?.const !== undefined)) ?? null;
}

/** The branch of a `variant` a value is (by its discriminator), else the first. */
export function branchOf(node: SettingsSchemaNode, value: unknown): SettingsSchemaNode | undefined {
  const d = discriminatorOf(node);
  const branches = node.oneOf ?? [];
  if (!d || !isObj(value)) return branches[0];
  return branches.find((b) => b.properties?.[d]?.const === value[d]) ?? branches[0];
}

/** The class of a node from its nearest annotated ancestor (`inherited`); a section's own default is `admin`. */
export const classOf = (node: SettingsSchemaNode | undefined, inherited: SettingClass = 'admin'): SettingClass => annotationsOf(node).class ?? inherited;

/** The schema node at a value path (`ssids.0.key`), through properties, items and the branches of a `oneOf`. */
export function schemaAt(root: SettingsSchemaNode, path: Path): SettingsSchemaNode | undefined {
  let node: SettingsSchemaNode | undefined = root;
  for (const seg of path) {
    if (!node) return undefined;
    if (node.oneOf && !node.properties && !node.items) {
      const found: SettingsSchemaNode | undefined = node.oneOf.map((b) => (typeof seg === 'number' ? b.items : b.properties?.[String(seg)])).find(Boolean);
      node = found;
      continue;
    }
    node = typeof seg === 'number' || /^\d+$/.test(String(seg)) ? node.items : node.properties?.[String(seg)];
  }
  return node;
}

/** The schema path of a value path (indexes dropped): `ssids.key` for `ssids.0.key`, the key labels and hints are looked up by. */
export const schemaKey = (path: Path): string => path.filter((s) => typeof s !== 'number' && !/^\d+$/.test(String(s))).join('.');

export const pathOf = (raw: string): Path => (raw === '' ? [] : raw.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s)));
export const pathText = (path: Path): string => path.join('.');

export function valueAt(root: unknown, path: Path): unknown {
  let cur = root;
  for (const seg of path) {
    if (Array.isArray(cur) && typeof seg === 'number') cur = cur[seg];
    else if (isObj(cur)) cur = cur[String(seg)];
    else return undefined;
  }
  return cur;
}

/** The default of a new value of this node: the schema's `default`, an object of its properties' defaults, a choice's first constant. */
export function defaultFor(node: SettingsSchemaNode | undefined): unknown {
  if (!node) return undefined;
  if (node.default !== undefined) return structuredClone(node.default);
  const kind = nodeKind(node);
  if (kind === 'variant') return defaultFor(node.oneOf?.[0]);
  if (kind === 'object' || node.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(node.properties ?? {})) {
      if (p.const !== undefined) { out[k] = p.const; continue; }
      const d = annotationsOf(p).sensitive ? undefined : defaultFor(p);
      if (d !== undefined) out[k] = d;
    }
    return out;
  }
  if (kind === 'object-list' || kind === 'scalar-list') return undefined;
  if (kind === 'choice') return node.oneOf?.find((b) => b.const !== undefined)?.const;
  return undefined;
}

// ── Secrets ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A secret the device holds, as the editor keeps it: kept unless changed, and where it was read (a moved row cannot keep it). */
export interface KeptSecret { $keep: true; $at: string }
export const isKeptSecret = (v: unknown): v is KeptSecret => isObj(v) && v.$keep === true;
export const isSecretReport = (v: unknown): v is { set: boolean } => isObj(v) && typeof v.set === 'boolean' && Object.keys(v).every((k) => k === 'set' || k === 'ref' || k === 'fp');

/** Every value path under a sensitive node in `values` (all branches of a `oneOf`). */
export function secretPaths(schema: SettingsSchemaNode, values: unknown): Path[] {
  const out: Path[] = [];
  const visit = (node: SettingsSchemaNode, v: unknown, path: Path) => {
    if (path.length && annotationsOf(node).sensitive) { out.push(path); return; }
    if (node.oneOf) { for (const b of node.oneOf) visit(b, v, path); return; }
    if (Array.isArray(v) && node.items) v.forEach((item, i) => visit(node.items!, item, [...path, i]));
    if (isObj(v) && node.properties) for (const [k, val] of Object.entries(v)) if (node.properties[k]) visit(node.properties[k], val, [...path, k]);
  };
  visit(schema, values, []);
  const seen = new Set<string>();
  return out.filter((p) => { const k = pathText(p); if (seen.has(k)) return false; seen.add(k); return true; });
}

function setAt(root: unknown, path: Path, value: unknown): void {
  let cur = root as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i] as never] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (value === undefined) delete cur[last as never];
  else cur[last as never] = value;
}

/** A document as the editor starts from it: a secret the device holds (`{ set: true }`) is kept where it was read; one not set is absent. */
export function prepareForEdit(schema: SettingsSchemaNode, doc: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out = structuredClone(doc ?? {}) as Record<string, unknown>;
  for (const path of secretPaths(schema, out)) {
    const v = valueAt(out, path);
    if (isSecretReport(v)) setAt(out, path, v.set ? { $keep: true, $at: pathText(path) } : undefined);
    else if (isKeptSecret(v)) setAt(out, path, { $keep: true, $at: pathText(path) });
  }
  return out;
}

/**
 * The values a write sends: a kept secret becomes `{ $keep: true }`; an empty optional text is left out. A kept secret whose row moved (a
 * row above it was removed, or the row was copied) cannot be kept by the server, which knows secrets by position: it is listed in
 * `moved` and the person types it again. A secret whose "Change" was pressed with nothing typed is listed in `blank`.
 */
export function prepareForSave(schema: SettingsSchemaNode, values: Record<string, unknown>): { values: Record<string, unknown>; moved: string[]; blank: string[] } {
  const out = structuredClone(values);
  const moved: string[] = [];
  // "Change" pressed and nothing typed: never sent as an empty value (that would drop the secret on the device), the person decides
  const blank: string[] = [];
  for (const path of secretPaths(schema, out)) {
    const v = valueAt(out, path);
    if (isKeptSecret(v)) {
      if (v.$at !== pathText(path)) moved.push(pathText(path));
      setAt(out, path, { $keep: true });
    } else if (v === '') blank.push(pathText(path));
  }
  const dropEmpty = (node: SettingsSchemaNode | undefined, v: unknown) => {
    if (!node) return;
    if (Array.isArray(v)) { v.forEach((item) => dropEmpty(node.items ?? branchOf(node, item), item)); return; }
    if (!isObj(v)) return;
    const n = node.oneOf ? branchOf(node, v) ?? node : node;
    const req = new Set(n.required ?? []);
    for (const [k, val] of Object.entries(v)) {
      const p = n.properties?.[k];
      if (p && annotationsOf(p).sensitive) continue;
      if ((val === '' || val === undefined || val === null) && !req.has(k)) delete v[k];
      else dropEmpty(p, val);
    }
  };
  dropEmpty(schema, out);
  return { values: out, moved, blank };
}

// ── The client-side check ────────────────────────────────────────────────────────────────────────────────────────────────

export interface ValueIssue { path: string; code: string; limit?: number | string }

const FORMATS: Record<string, (s: string) => boolean> = {
  ipv4: (s) => /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s),
  ipv6: (s) => /^[0-9a-fA-F:]+$/.test(s) && s.includes(':') && s.length <= 45,
  cidr: (s) => {
    const [ip, bits, ...rest] = s.split('/');
    if (rest.length) return false;
    const v4 = FORMATS.ipv4(ip);
    const v6 = !v4 && FORMATS.ipv6(ip);
    if (!v4 && !v6) return false;
    if (bits === undefined) return true;
    const n = Number(bits);
    return /^\d{1,3}$/.test(bits) && n >= 0 && n <= (v4 ? 32 : 128);
  },
  mac: (s) => /^[0-9a-fA-F]{2}([:-][0-9a-fA-F]{2}){5}$/.test(s),
  hostname: (s) => s.length <= 253 && /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(s),
  port: (s) => /^\d{1,5}$/.test(s) && Number(s) >= 1 && Number(s) <= 65535,
};

/** An example of a format, as a field's placeholder. */
export const FORMAT_EXAMPLES: Record<string, string> = {
  ipv4: '192.168.1.10', ipv6: 'fd00::1', cidr: '192.168.1.0/24', mac: 'AA:BB:CC:DD:EE:FF', hostname: 'router.local', port: '443',
};

function patternOk(pattern: string, s: string): boolean {
  try { return new RegExp(pattern, 'u').test(s); } catch { return true; }
}

/** The mistakes in `value` against `node` (the manifest subset), with their value paths. Secrets kept or typed and fixed values are not judged. */
export function validateValues(node: SettingsSchemaNode, value: unknown, path: Path = []): ValueIssue[] {
  const out: ValueIssue[] = [];
  const at = pathText(path);
  const a = annotationsOf(node);
  if (a.remote === false && path.length) return out;
  if (a.sensitive && path.length) {
    if (typeof value === 'string') {
      if (node.minLength !== undefined && value.length < node.minLength) out.push({ path: at, code: 'minLength', limit: node.minLength });
      if (node.maxLength !== undefined && value.length > node.maxLength) out.push({ path: at, code: 'maxLength', limit: node.maxLength });
    }
    return out;
  }
  if (node.oneOf?.length) {
    if (nodeKind(node) === 'choice') {
      const ok = node.oneOf.some((b) => validateValues(b, value, path).length === 0);
      if (!ok) out.push({ path: at, code: 'type' });
      return out;
    }
    const branch = branchOf(node, value);
    return branch ? validateValues(branch, value, path) : out;
  }
  if (node.const !== undefined) {
    if (value !== node.const) out.push({ path: at, code: 'const' });
    return out;
  }
  if (Array.isArray(node.enum) && value !== undefined && !node.enum.includes(value)) { out.push({ path: at, code: 'enum' }); return out; }
  switch (node.type) {
    case 'object': {
      if (!isObj(value)) { if (value !== undefined) out.push({ path: at, code: 'type' }); return out; }
      for (const r of node.required ?? []) {
        const p = node.properties?.[r];
        const v = value[r];
        if ((v === undefined || v === '') && !(p && annotationsOf(p).remote === false)) out.push({ path: pathText([...path, r]), code: 'required' });
      }
      for (const [k, v] of Object.entries(value)) {
        const p = node.properties?.[k];
        if (p) out.push(...validateValues(p, v, [...path, k]));
        else if (node.additionalProperties === false) out.push({ path: pathText([...path, k]), code: 'unknown' });
      }
      return out;
    }
    case 'array': {
      if (!Array.isArray(value)) { if (value !== undefined) out.push({ path: at, code: 'type' }); return out; }
      if (node.maxItems !== undefined && value.length > node.maxItems) out.push({ path: at, code: 'maxItems', limit: node.maxItems });
      if (node.minItems !== undefined && value.length < node.minItems) out.push({ path: at, code: 'minItems', limit: node.minItems });
      if (node.items) value.forEach((v, i) => out.push(...validateValues(node.items!, v, [...path, i])));
      return out;
    }
    case 'string': {
      if (value === undefined) return out;
      if (typeof value !== 'string') { out.push({ path: at, code: 'type' }); return out; }
      if (node.minLength !== undefined && value.length < node.minLength) out.push({ path: at, code: 'minLength', limit: node.minLength });
      if (node.maxLength !== undefined && value.length > node.maxLength) out.push({ path: at, code: 'maxLength', limit: node.maxLength });
      if (value && node.pattern && !patternOk(node.pattern, value)) out.push({ path: at, code: 'pattern' });
      if (value && node.format && FORMATS[node.format] && !FORMATS[node.format](value)) out.push({ path: at, code: 'format', limit: node.format });
      return out;
    }
    case 'integer':
    case 'number': {
      if (value === undefined) return out;
      if (typeof value !== 'number' || !Number.isFinite(value) || (node.type === 'integer' && !Number.isInteger(value))) { out.push({ path: at, code: 'type' }); return out; }
      if (node.minimum !== undefined && value < node.minimum) out.push({ path: at, code: 'minimum', limit: node.minimum });
      if (node.maximum !== undefined && value > node.maximum) out.push({ path: at, code: 'maximum', limit: node.maximum });
      return out;
    }
    case 'boolean':
      if (value !== undefined && typeof value !== 'boolean') out.push({ path: at, code: 'type' });
      return out;
    default:
      return out;
  }
}

// ── Desired against reported ─────────────────────────────────────────────────────────────────────────────────────────────

export interface LeafDifference { path: string; desired: unknown; reported: unknown; sensitive: boolean }

/**
 * The leaves where two documents differ (both as the server shows them: a secret is `{ set }`), in path order. A secret differs only when
 * one side holds it and the other does not: its value is never known here.
 */
export function differences(schema: SettingsSchemaNode, desired: unknown, reported: unknown): LeafDifference[] {
  const secret = new Set([...secretPaths(schema, desired), ...secretPaths(schema, reported)].map(pathText));
  const leaves = (v: unknown, path: Path, out: Map<string, unknown>) => {
    const key = pathText(path);
    if (secret.has(key)) { out.set(key, isSecretReport(v) ? v.set : v !== undefined); return; }
    if (Array.isArray(v)) { if (!v.length) out.set(key, []); v.forEach((x, i) => leaves(x, [...path, i], out)); return; }
    if (isObj(v)) { for (const [k, x] of Object.entries(v)) leaves(x, [...path, k], out); return; }
    out.set(key, v);
  };
  const d = new Map<string, unknown>();
  const r = new Map<string, unknown>();
  leaves(desired ?? {}, [], d);
  leaves(reported ?? {}, [], r);
  const out: LeafDifference[] = [];
  for (const key of [...new Set([...d.keys(), ...r.keys()])].sort()) {
    const a = d.get(key);
    const b = r.get(key);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ path: key, desired: a, reported: b, sensitive: secret.has(key) });
  }
  return out;
}

/** Two editor documents hold the same values (kept secrets compared by where they were read). */
export const sameValues = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'undefined';
}

/** The reported document as values to write back ("keep what the device has"): its secrets kept where they are. */
export const reportedAsValues = (schema: SettingsSchemaNode, reported: Record<string, unknown> | null): Record<string, unknown> => prepareForEdit(schema, reported);
