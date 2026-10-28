// The pure part of the scene setup (next-boilerplate phase 42, D42-4 / D42-10): the keys of a scene, the elements of the
// devices, how the one is matched to the other, the binding payload that comes out, and what is still open. No React, no
// DOM, no fetching: the drawer (`SceneSetupDrawer.tsx`) and the host's server check use the same grammar and caps.
import { designRuleIssues } from './design-rules-logic';

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
/** The slot a binding starts in (the server's default). */
export const DEFAULT_SLOT = 'main';
/** The server's grammars (`scene-binding.ts` of next-boilerplate), so a draft is refused here before the server would refuse it. */
export const SLOT_GRAMMAR = /^[a-z][a-z0-9_-]{0,31}$/;
export const KIND_GRAMMAR = /^[a-z][a-z0-9_]{0,31}$/;
export const UUID_GRAMMAR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The slot field's length (the grammar's own cap). */
export const MAX_SLOT_LENGTH = 32;

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
/** `manual` is a pick by hand and `hidden` a key the user left out (`hidden[]` of the binding); `autoMatch` never says either. */
export type MatchHow = AutoMatchHow | 'manual' | 'hidden';
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

/** The device an element names; an empty `deviceId` is no device. */
const elementDevice = (e: DeviceElement): string | undefined => e.deviceId || undefined;

/**
 * The elements a role's device offers. The main role also owns the elements with no `deviceId`, but only when the main role has a
 * device: an element with no device does not belong to a role that has none, so nothing is matched or stored against ''.
 */
export function elementsForRole(
  role: string,
  elements: readonly DeviceElement[],
  devices: Readonly<Record<string, string>>,
): DeviceElement[] {
  const d = own(devices, role) ? devices[role] : undefined;
  if (!d) return [];
  return elements.filter((e) => {
    const ed = elementDevice(e);
    return ed === d || (role === MAIN_ROLE && ed === undefined);
  });
}

/** The device an element of `role` is on: its own `deviceId`, else the role's device, else null. */
function deviceOfElement(role: string, e: DeviceElement, devices: Readonly<Record<string, string>>): string | null {
  return elementDevice(e) ?? ((own(devices, role) ? devices[role] : '') || null);
}

// ─── Auto match ──────────────────────────────────────────────────────────────

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

/**
 * Matches the scene's keys to the device elements, per key, in three steps run one after the other over what is left:
 *
 *  1. `key`: the key (minus its role prefix) is the element id. Exact; this is what the runtime does without a map entry.
 *  2. `label`: the key's label equals the element's label or name, ignoring case, and only when exactly one key and one
 *     element of that role carry it, counted over all of them before the key step (a label two things share decides nothing,
 *     even when one of them was taken by an earlier step).
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
    // A label is only a match when it is unique: counted over ALL keys of the role and ALL elements of the role's device, before
    // any step handed something out, so a label a settled key or a taken element also carries is ambiguous and decides nothing.
    const keyCount = new Map<string, number>();
    sceneKeys.forEach((k, i) => {
      if (!norm(k.label)) return;
      const id = `${out[i].role}\u0000${norm(k.label)}`;
      keyCount.set(id, (keyCount.get(id) ?? 0) + 1);
    });
    sceneKeys.forEach((k, i) => {
      const label = norm(k.label);
      if (!open(i) || !label || keyCount.get(`${out[i].role}\u0000${label}`) !== 1) return;
      const role = out[i].role;
      const hits = poolOf(role).filter((e) => norm(e.label) === label || norm(e.element) === label);
      if (hits.length === 1 && free(role, hits[0])) settle(i, hits[0], 'label');
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

// ─── Slots ───────────────────────────────────────────────────────────────────

/** The value the slot select gives its "New slot…" option. It is not a slot (it starts with an underscore), so it can never collide with one. */
export const NEW_SLOT_VALUE = '__new_slot__';

/**
 * What is typed into the new-slot field, made a slot as far as it can be: lower case, spaces and dots become `-`, anything else the
 * grammar refuses is dropped, cut to the grammar's length. A name that still breaks the grammar (it starts with a digit, it is empty)
 * is `slotIssue`'s to say.
 */
export function normalizeSlotInput(raw: string): string {
  return raw.trimStart().toLowerCase().replace(/[\s.]+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, MAX_SLOT_LENGTH);
}

/** What is wrong with a slot name, or null: the server's grammar (`SLOT_GRAMMAR`). */
export function slotIssue(slot: string): 'missing' | 'invalid' | null {
  if (!slot.trim()) return 'missing';
  return SLOT_GRAMMAR.test(slot) ? null : 'invalid';
}

/**
 * The slots the drawer lists for a subject: the ones it already has a setup in (from its bindings), `main` always (it is the default
 * slot every card draws unless it names another), sorted with `main` first. Names the grammar refuses are left out.
 */
export function slotChoices(existing: readonly string[]): string[] {
  const set = new Set<string>([DEFAULT_SLOT]);
  for (const s of existing) if (SLOT_GRAMMAR.test(s)) set.add(s);
  return [...set].sort((a, b) => (a === DEFAULT_SLOT ? -1 : b === DEFAULT_SLOT ? 1 : a < b ? -1 : a > b ? 1 : 0));
}

/** Whether the drawing changed since a binding was saved: both fingerprints are known and differ. A binding or a document without one (null, '') cannot be told, so it is not stale. */
export function documentChanged(savedHash: string | null | undefined, currentHash: string | null | undefined): boolean {
  return !!savedHash && !!currentHash && savedHash !== currentHash;
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
  /**
   * The saved binding's view (level / focus) and rules, opaque to the drawer: they come in through `initial` and go out here
   * unchanged, because the server replaces the whole binding on a save and would erase them otherwise. Absent when the saved
   * binding had none.
   */
  view?: Record<string, unknown> | null;
  rules?: Array<Record<string, unknown>> | null;
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
  /** Passed through to the payload as they are (see `BindingDraft`). */
  view?: BindingDraft['view'];
  rules?: BindingDraft['rules'];
  /**
   * Saved entries the scene no longer matches (a stale exception, a stale role) that the user keeps: written out as they are,
   * after the live ones. A live match wins over a carried entry of the same key or role.
   */
  carryMap?: Readonly<Record<string, DeviceRef>>;
  carryDevices?: Readonly<Record<string, string>>;
}

/**
 * Builds the payload. A match that is the identity (the key's role device, the key's local part as the element) is left
 * out: `map` carries exceptions only. Unmatched keys are left out too. Keys are written in the scene's order. A match with an
 * empty device id is a match with no device: it falls back to the role's device, and with none it is skipped (a map entry
 * never carries an empty `deviceId`).
 */
export function bindingDraft(input: DraftInput): BindingDraft {
  const devices = Object.fromEntries(Object.entries({ ...input.carryDevices, ...input.devices }));
  const roleNames = Object.keys(devices);
  const entries: Array<[string, DeviceRef]> = [];
  for (const m of input.matches) {
    if (m.element === null) continue;
    const { role, local } = splitKey(m.key, roleNames);
    const roleDevice = (own(devices, role) ? devices[role] : undefined) || undefined;
    const deviceId = m.deviceId || roleDevice;
    if (!deviceId) continue;
    if (local === m.element && deviceId === roleDevice) continue;
    entries.push([m.key, { deviceId, element: m.element }]);
  }
  const seen = new Set(entries.map(([k]) => k));
  for (const [k, ref] of Object.entries(input.carryMap ?? {})) if (!seen.has(k)) entries.push([k, { deviceId: ref.deviceId, element: ref.element }]);
  const out: BindingDraft = {
    documentId: input.documentId,
    slot: input.slot,
    kind: input.kind,
    devices,
    map: Object.fromEntries(entries),
    hidden: [...new Set(input.hidden ?? [])],
  };
  if (input.view !== undefined) out.view = input.view;
  if (input.rules !== undefined) out.rules = input.rules;
  return out;
}

/** A stable text of a draft (keys sorted), so two drafts can be compared for "has anything changed". */
export function draftSignature(d: BindingDraft): string {
  const sorted = <T>(o: Record<string, T>): Array<[string, T]> => Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([
    d.documentId, d.slot, d.kind,
    sorted(d.devices),
    sorted(d.map).map(([k, v]) => [k, v.deviceId, v.element]),
    [...d.hidden].sort(),
    d.view ?? null,
    d.rules ?? null,
  ]);
}

export const sameDraft = (a: BindingDraft, b: BindingDraft): boolean => draftSignature(a) === draftSignature(b);

// ─── Roles of a device table ─────────────────────────────────────────────────

export type BindingIssueCode =
  | 'document-missing'
  | 'document-invalid'
  | 'slot-missing'
  | 'slot-invalid'
  | 'kind-missing'
  | 'kind-invalid'
  | 'no-devices'
  | 'too-many-devices'
  | 'too-many-map'
  | 'role-invalid'
  | 'role-duplicate'
  | 'device-missing'
  | 'device-invalid'
  | 'key-invalid'
  | 'element-invalid'
  | 'hidden-invalid'
  | 'rule-invalid';

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
  else if (!UUID_GRAMMAR.test(d.documentId)) issues.push({ code: 'document-invalid', subject: d.documentId });
  if (!d.slot.trim()) issues.push({ code: 'slot-missing' });
  else if (!SLOT_GRAMMAR.test(d.slot)) issues.push({ code: 'slot-invalid', subject: d.slot });
  if (!d.kind) issues.push({ code: 'kind-missing' });
  else if (!KIND_GRAMMAR.test(d.kind)) issues.push({ code: 'kind-invalid', subject: d.kind });
  const roles = Object.keys(d.devices);
  if (roles.length === 0) issues.push({ code: 'no-devices' });
  if (roles.length > MAX_BINDING_DEVICES) issues.push({ code: 'too-many-devices' });
  for (const role of roles) {
    if (role !== MAIN_ROLE && !isRoleName(role)) issues.push({ code: 'role-invalid', subject: role });
    if (!d.devices[role]) issues.push({ code: 'device-missing', subject: role });
    else if (!UUID_GRAMMAR.test(d.devices[role])) issues.push({ code: 'device-invalid', subject: role });
  }
  const mapKeys = Object.keys(d.map);
  if (mapKeys.length > MAX_BINDING_MAP) issues.push({ code: 'too-many-map' });
  for (const k of mapKeys) {
    if (!isSceneKey(k)) issues.push({ code: 'key-invalid', subject: k });
    const e = d.map[k];
    if (!isSceneKey(e.element)) issues.push({ code: 'element-invalid', subject: k });
    if (!e.deviceId) issues.push({ code: 'device-missing', subject: k });
    else if (!UUID_GRAMMAR.test(e.deviceId)) issues.push({ code: 'device-invalid', subject: k });
  }
  for (const h of d.hidden) if (!isSceneKey(h)) issues.push({ code: 'hidden-invalid', subject: h });
  // the rules of a design (phase 42.6): the host's server judges them the same way (`designRuleIssues`); other kinds' rules are opaque here
  if (d.kind === 'design' && d.rules) {
    for (const i of designRuleIssues(d.rules)) {
      const at = /^rules\.(\d+)\./.exec(i.path);
      issues.push({ code: 'rule-invalid', subject: at ? `${Number(at[1]) + 1}: ${i.message}` : i.message });
    }
  }
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
    const deviceId = m.deviceId || (own(input.devices, role) ? input.devices[role] : undefined);
    if (!deviceId) continue;
    used.add(refId(deviceId, m.element));
    usedDevices.add(deviceId);
  }
  const elements: DeviceRef[] = [];
  const mainDevice = (own(input.devices, MAIN_ROLE) ? input.devices[MAIN_ROLE] : undefined) || undefined;
  for (const e of input.elements) {
    const deviceId = elementDevice(e) ?? mainDevice;
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

// ─── Saved entries the scene no longer has ───────────────────────────────────

export interface StaleInput {
  sceneKeys: readonly SceneKey[];
  /** Every device the host lists (included in the scene or not). */
  deviceIds: Iterable<string>;
  /** The saved binding's `map`, `devices` and `hidden`. */
  map: Readonly<Record<string, DeviceRef>>;
  devices: Readonly<Record<string, string>>;
  hidden: readonly string[];
}

export interface StaleEntries {
  /** Saved `map` keys the chosen document has no key for. */
  exceptions: string[];
  /** Saved roles whose device the host does not list. */
  roles: string[];
  /** Saved `hidden` keys the chosen document has no key for. */
  hidden: string[];
}

/**
 * What the saved binding holds that the drawer cannot show as a row: a map entry or a hidden key the document no longer has, a
 * role whose device is not listed. They are never dropped silently: the drawer lists them, keeps them in the payload and asks
 * for an acknowledgement, and the user removes them one by one.
 */
export function staleEntries(input: StaleInput): StaleEntries {
  const keys = new Set(input.sceneKeys.map((k) => k.key));
  const listed = new Set(input.deviceIds);
  return {
    exceptions: Object.keys(input.map).filter((k) => !keys.has(k)),
    roles: Object.keys(input.devices).filter((r) => !listed.has(input.devices[r])),
    hidden: [...new Set(input.hidden)].filter((k) => !keys.has(k)),
  };
}
