// The pure part of the scene setup (next-boilerplate phase 42, D42-4 / D42-10): the keys of a scene, the elements of the
// devices, how the one is matched to the other, the binding payload that comes out, and what is still open. No React, no
// DOM, no fetching: the drawer (`SceneSetupDrawer.tsx`) and the host's server check use the same grammar and caps.
//
// The binding stores exceptions only. A scene key resolves by itself: its role prefix selects the device, the rest is the
// element id on that device (`fryer.heater` -> role `fryer`, element `heater`; a key without a known role prefix belongs
// to the main role, ''). So a match that is that identity is never written to `map`; only a hand pick, a label match or a
// type match is.

/** A scene key and an element id share one grammar: the intersection of the 2D element-id rule and kui-viewer's key format. */
export const KEY_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_.-]{0,47}$/;
/** A role is the part of a key before the first separator, so it has no `.` itself. */
export const ROLE_GRAMMAR = /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/;
/** At most this many devices in one binding. */
export const MAX_BINDING_DEVICES = 100;
/** At most this many `map` entries (exceptions) in one binding. */
export const MAX_BINDING_MAP = 500;
/** The role of the device a key without a role prefix belongs to. */
export const MAIN_ROLE = '';

/** Names a plain object would answer for without owning them; never a key, a role or an element. */
const RESERVED = new Set(['__proto__', 'prototype', 'constructor']);

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export const isSceneKey = (s: unknown): s is string => typeof s === 'string' && KEY_GRAMMAR.test(s) && !RESERVED.has(s);
/** A named role (not the main one). */
export const isRoleName = (s: unknown): s is string => typeof s === 'string' && ROLE_GRAMMAR.test(s) && !RESERVED.has(s);

// ─── Types ───────────────────────────────────────────────────────────────────

/** One key a scene reads. `kind` is the host's word for what it is (symbol, item, room, ...); it is only shown. */
export interface SceneKey {
  key: string;
  label?: string;
  kind: string;
  /** The catalogue type of the symbol or item (`pump`, `heater`); the third matching step compares it. */
  catalogue?: string;
}

/** One element a device offers (a telemetry key, an attribute, a signal). */
export interface DeviceElement {
  element: string;
  label?: string;
  /** Absent: the element belongs to the main role's device. */
  deviceId?: string;
  /** The catalogue type of the element (`pump`, `heater`), when the device's schema says one. */
  catalogue?: string;
}

/** An element on a device, as the binding stores an exception. */
export interface DeviceRef {
  deviceId: string;
  element: string;
}

/** How a match was found. `none` = no element. */
export type AutoMatchHow = 'key' | 'label' | 'type' | 'none';
/** `manual` is a pick by hand; `autoMatch` never says it. */
export type MatchHow = AutoMatchHow | 'manual';
export type MatchStep = 'key' | 'label' | 'type';

export interface AutoMatch {
  key: string;
  /** The role the key was read in ('' = main). */
  role: string;
  /** The device the element is on; null while `element` is. */
  deviceId: string | null;
  element: string | null;
  /** `type` is a proposal: the drawer asks for a confirmation and stores nothing before it. */
  how: AutoMatchHow;
}

export interface AutoMatchOptions {
  /** Role -> device id. The role of a key is looked up here; a role with no device matches nothing. */
  devices?: Readonly<Record<string, string>>;
  /** More role names to recognise as a key prefix (the scene's roles whose device is not chosen yet). */
  roles?: readonly string[];
  /** The steps to run, in the fixed order key, label, type. Default all. `['key']` is the identity the runtime applies. */
  steps?: readonly MatchStep[];
  /** Keys the caller has settled (a hand pick): they come back `none` and are not matched. */
  skip?: ReadonlySet<string>;
  /** Elements already taken (a hand pick); no step hands them out. */
  claimed?: Iterable<DeviceRef>;
}

// ─── Roles and keys ──────────────────────────────────────────────────────────

/**
 * Splits a key into its role and the element it names on that device. The role is the longest known role name followed by
 * a `.` with something after it; with none, the whole key belongs to the main role.
 */
export function splitKey(key: string, roles: Iterable<string>): { role: string; local: string } {
  let best = '';
  for (const r of roles) {
    if (r.length > best.length && r !== MAIN_ROLE && key.length > r.length + 1 && key.startsWith(`${r}.`)) best = r;
  }
  return best ? { role: best, local: key.slice(best.length + 1) } : { role: MAIN_ROLE, local: key };
}

const refId = (deviceId: string | null | undefined, element: string): string => `${deviceId ?? ''}\u0000${element}`;

/** The elements a role's device offers. The main role also owns the elements with no `deviceId`. */
export function elementsForRole(
  role: string,
  elements: readonly DeviceElement[],
  devices: Readonly<Record<string, string>>,
): DeviceElement[] {
  const d = own(devices, role) ? devices[role] : undefined;
  return elements.filter((e) => (d !== undefined && e.deviceId === d) || (role === MAIN_ROLE && e.deviceId === undefined));
}

/** The device an element of `role` is on: its own `deviceId`, else the role's device, else null. */
function deviceOfElement(role: string, e: DeviceElement, devices: Readonly<Record<string, string>>): string | null {
  return e.deviceId ?? (own(devices, role) ? devices[role] : null);
}

// ─── Auto match ──────────────────────────────────────────────────────────────

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

/**
 * Matches the scene's keys to the device elements, per key, in three steps run one after the other over what is left:
 *
 *  1. `key`: the key (minus its role prefix) is the element id. Exact; this is what the runtime does without a map entry.
 *  2. `label`: the key's label equals the element's label or name, ignoring case, and only when exactly one key and one
 *     element of that role carry it (a label two things share decides nothing).
 *  3. `type`: the key's catalogue type equals the element's, paired in list order (the first free `pump` key gets the first
 *     free `pump` element). Always a proposal.
 *
 * An element is handed out once. Every key gets an entry, in the scene's order.
 */
export function autoMatch(
  sceneKeys: readonly SceneKey[],
  elements: readonly DeviceElement[],
  opts: AutoMatchOptions = {},
): AutoMatch[] {
  const devices = opts.devices ?? {};
  const steps = new Set<MatchStep>(opts.steps ?? ['key', 'label', 'type']);
  const roleNames = [...Object.keys(devices), ...(opts.roles ?? [])];
  const taken = new Set<string>();
  for (const c of opts.claimed ?? []) taken.add(refId(c.deviceId, c.element));

  const split = sceneKeys.map((k) => splitKey(k.key, roleNames));
  const out: AutoMatch[] = sceneKeys.map((k, i) => ({ key: k.key, role: split[i].role, deviceId: null, element: null, how: 'none' }));
  const pools = new Map<string, DeviceElement[]>();
  const poolOf = (role: string): DeviceElement[] => {
    let p = pools.get(role);
    if (!p) {
      p = elementsForRole(role, elements, devices);
      pools.set(role, p);
    }
    return p;
  };
  const free = (role: string, e: DeviceElement): boolean => !taken.has(refId(deviceOfElement(role, e, devices), e.element));
  const settle = (i: number, e: DeviceElement, how: AutoMatchHow): void => {
    const role = out[i].role;
    const deviceId = deviceOfElement(role, e, devices);
    taken.add(refId(deviceId, e.element));
    out[i] = { key: out[i].key, role, deviceId, element: e.element, how };
  };
  const open = (i: number): boolean => out[i].how === 'none' && !opts.skip?.has(out[i].key);

  if (steps.has('key')) {
    sceneKeys.forEach((_, i) => {
      if (!open(i)) return;
      const role = out[i].role;
      const hit = poolOf(role).find((e) => e.element === split[i].local && free(role, e));
      if (hit) settle(i, hit, 'key');
    });
  }

  if (steps.has('label')) {
    // Count the labels over what is still open, per role, on both sides.
    const keyCount = new Map<string, number>();
    sceneKeys.forEach((k, i) => {
      if (!open(i) || !norm(k.label)) return;
      const id = `${out[i].role}\u0000${norm(k.label)}`;
      keyCount.set(id, (keyCount.get(id) ?? 0) + 1);
    });
    sceneKeys.forEach((k, i) => {
      const label = norm(k.label);
      if (!open(i) || !label || keyCount.get(`${out[i].role}\u0000${label}`) !== 1) return;
      const role = out[i].role;
      const hits = poolOf(role).filter((e) => free(role, e) && (norm(e.label) === label || norm(e.element) === label));
      if (hits.length === 1) settle(i, hits[0], 'label');
    });
  }

  if (steps.has('type')) {
    // Per role and type, the free elements in their order; the keys take them one by one in theirs.
    const queues = new Map<string, DeviceElement[]>();
    sceneKeys.forEach((k, i) => {
      if (!open(i) || !norm(k.catalogue)) return;
      const role = out[i].role;
      const id = `${role}\u0000${norm(k.catalogue)}`;
      let q = queues.get(id);
      if (!q) {
        q = poolOf(role).filter((e) => norm(e.catalogue) === norm(k.catalogue) && free(role, e));
        queues.set(id, q);
      }
      const next = q.shift();
      if (next) settle(i, next, 'type');
    });
  }
  return out;
}

// ─── Proposed roles ──────────────────────────────────────────────────────────

/** A role name from a device code: the code with every character the grammar refuses turned into `_`. */
export function roleFromCode(code: string): string {
  let r = code.trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+(?=.)|_+$/g, '');
  if (!r) return 'device';
  if (!/^[A-Za-z_]/.test(r)) r = `_${r}`;
  r = r.slice(0, 48);
  return RESERVED.has(r) ? `${r}_` : r;
}

/**
 * The roles to propose for a list of devices. One device is the main one (''). With several, a device whose code contains
 * a role the scene declares takes that role; the others take a role from their own code; every role is used once.
 */
export function proposeRoles(
  devices: ReadonlyArray<{ id: string; code?: string; label?: string }>,
  sceneRoles: readonly string[] = [],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (devices.length === 1) {
    out[devices[0].id] = MAIN_ROLE;
    return out;
  }
  const used = new Set<string>();
  const claim = (base: string): string => {
    let r = base;
    for (let n = 2; used.has(r); n += 1) r = `${base.slice(0, 48 - String(n).length - 1)}_${n}`;
    used.add(r);
    return r;
  };
  const rest: typeof devices[number][] = [];
  for (const d of devices) {
    const code = norm(d.code ?? d.label);
    const hit = code ? sceneRoles.find((r) => isRoleName(r) && !used.has(r) && code.includes(r.toLowerCase())) : undefined;
    if (hit) {
      used.add(hit);
      out[d.id] = hit;
    } else rest.push(d);
  }
  for (const d of rest) out[d.id] = claim(roleFromCode(d.code ?? d.label ?? d.id));
  return out;
}

// ─── The payload ─────────────────────────────────────────────────────────────

/** The binding as the host's server stores it (one row per slot). `map` holds the exceptions only. */
export interface BindingDraft {
  documentId: string;
  slot: string;
  kind: string;
  /** Role -> device id. */
  devices: Record<string, string>;
  /** Scene key -> the element it reads, when that is not the identity the role table gives. */
  map: Record<string, DeviceRef>;
  /** Keys the scene leaves out. */
  hidden: string[];
}

export interface DraftMatch {
  key: string;
  element: string | null;
  deviceId?: string | null;
}

export interface DraftInput {
  documentId: string;
  slot: string;
  kind: string;
  devices: Readonly<Record<string, string>>;
  /** The matches to store: the accepted ones. A proposal still waiting for its confirmation is not passed. */
  matches: readonly DraftMatch[];
  hidden?: readonly string[];
}

/**
 * Builds the payload. A match that is the identity (the key's role device, the key's local part as the element) is left
 * out: `map` carries exceptions only. Unmatched keys are left out too. Keys are written in the scene's order.
 */
export function bindingDraft(input: DraftInput): BindingDraft {
  const devices = Object.fromEntries(Object.entries(input.devices));
  const roleNames = Object.keys(devices);
  const entries: Array<[string, DeviceRef]> = [];
  for (const m of input.matches) {
    if (m.element === null) continue;
    const { role, local } = splitKey(m.key, roleNames);
    const roleDevice = own(devices, role) ? devices[role] : undefined;
    const deviceId = m.deviceId ?? roleDevice;
    if (deviceId === undefined || deviceId === null) continue;
    if (local === m.element && deviceId === roleDevice) continue;
    entries.push([m.key, { deviceId, element: m.element }]);
  }
  return {
    documentId: input.documentId,
    slot: input.slot,
    kind: input.kind,
    devices,
    map: Object.fromEntries(entries),
    hidden: [...new Set(input.hidden ?? [])],
  };
}

/** A stable text of a draft (keys sorted), so two drafts can be compared for "has anything changed". */
export function draftSignature(d: BindingDraft): string {
  const sorted = <T>(o: Record<string, T>): Array<[string, T]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([
    d.documentId, d.slot, d.kind,
    sorted(d.devices),
    sorted(d.map).map(([k, v]) => [k, v.deviceId, v.element]),
    [...d.hidden].sort(),
  ]);
}

export const sameDraft = (a: BindingDraft, b: BindingDraft): boolean => draftSignature(a) === draftSignature(b);

// ─── Roles of a device table ─────────────────────────────────────────────────

export type BindingIssueCode =
  | 'document-missing'
  | 'slot-missing'
  | 'kind-missing'
  | 'no-devices'
  | 'too-many-devices'
  | 'too-many-map'
  | 'role-invalid'
  | 'role-duplicate'
  | 'device-missing'
  | 'key-invalid'
  | 'element-invalid'
  | 'hidden-invalid';

export interface BindingIssue {
  code: BindingIssueCode;
  /** The key, role or device the issue is about. */
  subject?: string;
}

/** Turns the device table (a role per device) into the role -> device map, with what is wrong with the roles. */
export function devicesFromRoles(
  rows: ReadonlyArray<{ deviceId: string; role: string }>,
): { devices: Record<string, string>; issues: BindingIssue[] } {
  const entries: Array<[string, string]> = [];
  const issues: BindingIssue[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const role = r.role.trim();
    if (role !== MAIN_ROLE && !isRoleName(role)) {
      issues.push({ code: 'role-invalid', subject: role });
      continue;
    }
    if (seen.has(role)) {
      issues.push({ code: 'role-duplicate', subject: role });
      continue;
    }
    seen.add(role);
    entries.push([role, r.deviceId]);
  }
  return { devices: Object.fromEntries(entries), issues };
}

/** What is wrong with a draft: the grammar of every key, role and element, the caps and the parts a binding cannot lack. */
export function validateDraft(d: BindingDraft): BindingIssue[] {
  const issues: BindingIssue[] = [];
  if (!d.documentId) issues.push({ code: 'document-missing' });
  if (!d.slot.trim()) issues.push({ code: 'slot-missing' });
  if (!d.kind) issues.push({ code: 'kind-missing' });
  const roles = Object.keys(d.devices);
  if (roles.length === 0) issues.push({ code: 'no-devices' });
  if (roles.length > MAX_BINDING_DEVICES) issues.push({ code: 'too-many-devices' });
  for (const role of roles) {
    if (role !== MAIN_ROLE && !isRoleName(role)) issues.push({ code: 'role-invalid', subject: role });
    if (!d.devices[role]) issues.push({ code: 'device-missing', subject: role });
  }
  const mapKeys = Object.keys(d.map);
  if (mapKeys.length > MAX_BINDING_MAP) issues.push({ code: 'too-many-map' });
  for (const k of mapKeys) {
    if (!isSceneKey(k)) issues.push({ code: 'key-invalid', subject: k });
    const e = d.map[k];
    if (!isSceneKey(e.element)) issues.push({ code: 'element-invalid', subject: k });
    if (!e.deviceId) issues.push({ code: 'device-missing', subject: k });
  }
  for (const h of d.hidden) if (!isSceneKey(h)) issues.push({ code: 'hidden-invalid', subject: h });
  return issues;
}

// ─── What is still open ──────────────────────────────────────────────────────

export interface UnresolvedInput {
  sceneKeys: readonly SceneKey[];
  elements: readonly DeviceElement[];
  /** The current match of every key (an entry per key; a missing one counts as unmatched). */
  matches: readonly DraftMatch[];
  devices: Readonly<Record<string, string>>;
  /** The roles the scene needs (its keys' prefixes) when they are known; each must have a device. */
  roles?: readonly string[];
  hidden?: readonly string[];
}

export interface Unresolved {
  /** Scene keys with no element (hidden ones are not counted). */
  keys: string[];
  /** Elements of the bound devices that no scene key reads. */
  elements: DeviceRef[];
  /** Roles the scene needs that have no device. */
  roles: string[];
  /** Bound devices none of whose elements a scene key reads. */
  devices: string[];
}

export function unresolved(input: UnresolvedInput): Unresolved {
  const hidden = new Set(input.hidden ?? []);
  const byKey = new Map(input.matches.map((m) => [m.key, m] as const));
  const keys = input.sceneKeys.filter((k) => !hidden.has(k.key) && (byKey.get(k.key)?.element ?? null) === null).map((k) => k.key);

  const bound = new Set(Object.values(input.devices));
  const used = new Set<string>();
  const usedDevices = new Set<string>();
  for (const m of input.matches) {
    if (m.element === null || m.element === undefined) continue;
    const role = splitKey(m.key, Object.keys(input.devices)).role;
    const deviceId = m.deviceId ?? (own(input.devices, role) ? input.devices[role] : undefined);
    if (deviceId === undefined || deviceId === null) continue;
    used.add(refId(deviceId, m.element));
    usedDevices.add(deviceId);
  }
  const elements: DeviceRef[] = [];
  const mainDevice = own(input.devices, MAIN_ROLE) ? input.devices[MAIN_ROLE] : undefined;
  for (const e of input.elements) {
    const deviceId = e.deviceId ?? mainDevice;
    if (deviceId === undefined || !bound.has(deviceId)) continue;
    if (!used.has(refId(deviceId, e.element))) elements.push({ deviceId, element: e.element });
  }
  return {
    keys,
    elements,
    roles: (input.roles ?? []).filter((r) => r !== MAIN_ROLE && !own(input.devices, r)),
    devices: [...bound].filter((d) => !usedDevices.has(d)),
  };
}
