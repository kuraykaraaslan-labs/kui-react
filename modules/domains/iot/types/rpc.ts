/*
 * RPC entity (docs/concepts/iot-platform/phases/04-rpc-console.md; NB `iot_rpc` 00 §0.1, the vocabulary of its 3.1 contract
 * alignment). Status set R2: QUEUED → SENT → DELIVERED → SUCCESSFUL, or FAILED / TIMEOUT / EXPIRED / CANCELLED. A timeout means
 * "no answer, outcome unknown", never "did not run". Self-contained (no zod), like the other entity files.
 */
import type { FieldSchema } from '@/modules/app/SchemaForm/types';

export const RPC_STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'SUCCESSFUL', 'FAILED', 'TIMEOUT', 'EXPIRED', 'CANCELLED'] as const;
export type RpcStatus = (typeof RPC_STATUSES)[number];
export const RPC_OPEN_STATUSES: readonly RpcStatus[] = ['QUEUED', 'SENT', 'DELIVERED'];

/** The catalog tiers; a method outside the catalog is `raw`. */
export type RpcTier = 'basic' | 'privileged' | 'critical' | 'raw';

/** Who sent it: the console, an API caller, a flow, OTA, an alarm action or a dashboard control (OD-80). */
export type RpcSource = 'console' | 'api' | 'automation' | 'ota' | 'alarm_action' | 'dashboard_control' | (string & {});

/** The method a command sends when its catalog names none (NB rpc-wire-method). */
export const RPC_DEFAULT_WIRE_METHOD = 'setValue';

/** One command of the device profile's catalog. */
export type RpcCommand = {
  /**
   * The command's key in its profile's catalog: unique there, what boards, flows, rules and the history name it by, and what its tier and
   * the plaintext rule are judged on. Not what the device receives: that is `wireMethod`.
   */
  method: string;
  /**
   * The `method` of the `{"method", "params"}` envelope the device receives (NB rpc-wire-method): free text, no namespace needed, and
   * the same for many commands (`setValue`). Null or absent: the command's key, as before the split.
   */
  wireMethod?: string | null;
  label: string;
  description?: string | null;
  /** Declared parameters in the `FieldSchema` vocabulary (OD-16). */
  paramsSchema: Record<string, FieldSchema>;
  tier: Exclude<RpcTier, 'raw'>;
  /** Asks for a confirmation before sending (`reboot`). */
  highImpact: boolean;
  /** When set, the operator must type this phrase (stronger than a click). */
  confirmText?: string | null;
  oneway: boolean;
  /** A long method: the answer only says it was accepted; the result arrives later. */
  long?: boolean;
  defaultTimeoutMs?: number | null;
  persistentDefault?: boolean;
  /** False when the viewer may not send this tier (shown greyed with the reason). */
  sendable?: boolean;
  /**
   * The parameters that are secrets (a Wi-Fi password): typed in password fields, masked in the history, and never filled back by "Send
   * again" (NB 41-ui-fixes/23 1.1, 1.2).
   */
  maskedParams?: string[];
  /**
   * The whole payload the device receives, as a JSON template with `{{param}}`, `{{requestId}}` and `{{expirationTime}}` placeholders
   * (NB 63-licensed-devices LD-8), for a device that does not take the `{"method", "params"}` envelope; null or absent = the envelope.
   */
  payloadTemplate?: unknown;
};

/**
 * A command as its profile's catalog stores it (the catalog editor's row): the host's id, the parameters it masks in the history and the
 * row's edit `version` (an edit sends it back, so a change made meanwhile by someone else is refused as `stale`, NB 41-ui-fixes/23 1.17).
 */
export type RpcCatalogCommand = RpcCommand & {
  commandId: string;
  maskedParams?: string[];
  updatedAt?: Date | string;
  version?: number;
};

/** What the catalog editor sends (create, edit, import): never `sendable` (the host answers it per viewer). */
export type RpcCommandInput = Omit<RpcCommand, 'sendable'> & { maskedParams?: string[] };

/** A ready command a host offers in "New command" ("From a template"): the form starts from it and stays editable. */
export type RpcCommandTemplate = {
  id: string;
  label: string;
  description?: string;
  command: RpcCommandInput;
};

/** "running" = an accepted long method; "unknown" = a timeout; "late" = an answer after the end. */
export type RpcOutcome = 'running' | 'unknown' | 'late' | null;

export type RpcRequest = {
  rpcId: string;
  deviceId: string;
  deviceName?: string | null;
  method: string;
  /** Masked where the catalog says so. */
  params?: unknown;
  /**
   * What the device was sent for a command with a payload template (NB 63-licensed-devices LD-8), masked like `params`; null or absent =
   * the `{"method", "params"}` envelope.
   */
  payload?: unknown;
  oneway: boolean;
  persistent: boolean;
  status: RpcStatus;
  outcome?: RpcOutcome;
  timeoutMs?: number;
  expiresAt?: Date | string | null;
  response?: unknown;
  /** The list and the live events say only whether an answer exists; the detail reads it. */
  hasResponse?: boolean;
  /** The host's own words for why it did not succeed; `errorReason` is the same as a code the views put in the viewer's language. */
  error?: string | null;
  /**
   * Why it did not succeed, as a code of the kit's `rpcError` texts (`device_offline`, `queue_full`, `no_answer`, `device_bad_params`, …);
   * `errorDetail` is what the device itself said, when it said more (NB 41-ui-fixes/23 1.21).
   */
  errorReason?: string | null;
  errorDetail?: string | null;
  /** The tier it was sent under (its permission): Cancel is offered only to a viewer who may send that tier (NB 41-ui-fixes/23 1.7). */
  tier?: RpcTier;
  /**
   * The params the host masked (dot paths, `wifi.psk`): "Send again" leaves them empty and asks for them, so a mask is never sent as a
   * value (NB 41-ui-fixes/23 1.1). Absent: the command's `maskedParams` and every `***` value are taken as masked.
   */
  maskedPaths?: string[];
  highImpact?: boolean;
  source: RpcSource;
  createdAt: Date | string;
  sentAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  completedAt?: Date | string | null;
  lateResponseAt?: Date | string | null;
};

export type RpcSendInput = {
  /** A catalog command's key; with `payload`, the method the payload names (`rpcCustomMethodOf`), for the history. */
  method: string;
  params?: Record<string, unknown>;
  /**
   * A one-time custom payload (NB rpc-wire-method): the JSON the device receives exactly as it is, never saved to the catalog. Raw RPC
   * (the raw permission, always audited); it carries no `params`.
   */
  payload?: unknown;
  oneway?: boolean;
  timeoutMs?: number;
  persistent?: boolean;
  /** Persistent requests: how long the request may wait for the device (seconds). */
  expiresInS?: number;
  /** A high-impact command was confirmed (the API enforces it too). */
  confirm?: boolean;
  /** The typed phrase of a command with `confirmText`. */
  confirmText?: string;
  /**
   * One send, whatever the network does (NB 41-ui-fixes/23 1.4): the panel makes a key when the form is filled, keeps it when a send got
   * no answer (a retry is then recognised by the host and not run twice) and makes a new one after an answer or a change of the form.
   * A host sends it as its idempotency key (NB: the `Idempotency-Key` header), never as a parameter.
   */
  requestKey?: string;
};

/**
 * What "Send again" fills the send panel with: the method, its params without the masked ones, the paths it left out (asked for again)
 * and the request's own settings, so earlier choices on the form do not stay (NB 41-ui-fixes/23 N1).
 */
export type RpcPreset = {
  method: string;
  params?: Record<string, unknown>;
  /** The custom payload a one-time request sent (NB rpc-wire-method): "Send again" opens it in the custom payload box. */
  payload?: unknown;
  maskedPaths?: readonly string[];
  oneway?: boolean;
  persistent?: boolean;
  timeoutMs?: number;
  expiresInS?: number;
};

/** The limits the host's API checks (NB `iot_rpc` 00 §0.1): an answer timeout of 1 s to 10 min, a persistent expiry of at most 7 days. */
export const RPC_SEND_LIMITS = { timeoutMinS: 1, timeoutMaxS: 600, expiryMaxS: 7 * 24 * 3600 } as const;

/** How far a status is along the way: a later event never moves a request back (a slow answer behind a live one, NB 41-ui-fixes/23 1.13). */
export function rpcStatusRank(s: RpcStatus): number {
  return s === 'QUEUED' ? 0 : s === 'SENT' ? 1 : s === 'DELIVERED' ? 2 : 3;
}

/** A new idempotency key for one send (`RpcSendInput.requestKey`): 8–255 characters of `[A-Za-z0-9._:-]`. */
export function newRpcRequestKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `rpc-${c.randomUUID()}`;
  return `rpc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

const MASK = '***';

/**
 * The dot paths of the params a request was masked at: the host's `maskedPaths` when it says, else the command's `maskedParams` (top
 * level), every value that is exactly the mask and every name the host's `isSecretParam` holds secret.
 */
export function rpcMaskedPaths(
  r: Pick<RpcRequest, 'params' | 'maskedPaths'>,
  command?: Pick<RpcCommand, 'maskedParams'> | null,
  isSecretParam?: (name: string, raw: boolean) => boolean,
): string[] {
  if (r.maskedPaths) return [...r.maskedPaths];
  const out = new Set<string>();
  const params = r.params && typeof r.params === 'object' && !Array.isArray(r.params) ? (r.params as Record<string, unknown>) : null;
  for (const k of command?.maskedParams ?? []) if (params && k in params) out.add(k);
  const walk = (v: unknown, at: string, depth: number) => {
    if (depth > 8 || !v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const p = at ? `${at}.${k}` : k;
      // a name the host holds secret is left out too, whatever value the history shows for it (C7)
      if (x === MASK || isSecretParam?.(k, !command)) out.add(p);
      else walk(x, p, depth + 1);
    }
  };
  walk(params, '', 0);
  return [...out];
}

/** `params` without the values at `paths` (a copy; an emptied object stays, so its other keys are kept). */
export function withoutRpcPaths(params: Record<string, unknown>, paths: readonly string[]): Record<string, unknown> {
  const copy = structuredClone(params);
  for (const p of paths) {
    const parts = p.split('.');
    let at: unknown = copy;
    for (const part of parts.slice(0, -1)) at = at && typeof at === 'object' ? (at as Record<string, unknown>)[part] : undefined;
    if (at && typeof at === 'object' && !Array.isArray(at)) delete (at as Record<string, unknown>)[parts[parts.length - 1]!];
  }
  return copy;
}

/** "Send again" of `r`: its method, params without the masked ones and its own settings (`command`: the catalog's entry, when known). */
export function rpcPresetOf(
  r: RpcRequest,
  command?: Pick<RpcCommand, 'maskedParams'> | null,
  isSecretParam?: (name: string, raw: boolean) => boolean,
): RpcPreset {
  const params = r.params && typeof r.params === 'object' && !Array.isArray(r.params) ? (r.params as Record<string, unknown>) : undefined;
  const masked = rpcMaskedPaths(r, command, isSecretParam);
  const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
  const expires = r.expiresAt ? new Date(r.expiresAt).getTime() : NaN;
  const expiresInS = r.persistent && Number.isFinite(created) && Number.isFinite(expires) && expires > created ? Math.round((expires - created) / 1000) : undefined;
  // a one-time custom payload (no catalog command) comes back as the payload it sent; its masked values are asked for again
  const custom = !command && r.payload !== undefined && r.payload !== null;
  return {
    method: r.method,
    ...(params ? { params: withoutRpcPaths(params, masked) } : {}),
    ...(custom ? { payload: r.payload } : {}),
    maskedPaths: custom ? rpcMaskPathsIn(r.payload) : masked,
    oneway: r.oneway,
    persistent: r.persistent,
    ...(typeof r.timeoutMs === 'number' ? { timeoutMs: r.timeoutMs } : {}),
    ...(expiresInS ? { expiresInS } : {}),
  };
}

/** The dot paths inside `v` whose value is exactly the mask (a custom payload the history masked). */
export function rpcMaskPathsIn(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown, at: string, depth: number) => {
    if (x === MASK && at) { out.push(at); return; }
    if (depth > 8 || !x || typeof x !== 'object') return;
    for (const [k, y] of Object.entries(x as Record<string, unknown>)) walk(y, at ? `${at}.${k}` : k, depth + 1);
  };
  walk(v, '', 0);
  return out;
}

/** What a command puts in the envelope's `method` (NB rpc-wire-method): its wire method, else its key. */
export function rpcWireMethodOf(c: Pick<RpcCommand, 'method' | 'wireMethod'>): string {
  const w = c.wireMethod?.trim();
  return w ? w : c.method;
}

/** A command key a host takes: letters, digits and _, starting with a letter; dots allowed between parts, none needed (NB RPC_METHOD_RE). */
export const RPC_COMMAND_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;

/**
 * The key a one-time custom payload is recorded under (NB rpc-wire-method; the host works it out the same way): the payload's own
 * `method` when it is a usable key, else `custom`.
 */
export function rpcCustomMethodOf(payload: unknown): string {
  const m = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>).method : undefined;
  return typeof m === 'string' && m.length <= 64 && RPC_COMMAND_KEY_RE.test(m) ? m : 'custom';
}

const TR_ASCII: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

/**
 * A command key made from its label (NB rpc-wire-method): lower case ASCII words joined by `_`, starting with a letter, at most 64
 * characters, and not one of `taken` (a `_2`, `_3`, … suffix when it is).
 */
export function rpcCommandKeyOf(label: string, taken: Iterable<string> = []): string {
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  let base = label.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR_ASCII[c] ?? c).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = 'command';
  if (!/^[a-z]/.test(base)) base = `cmd_${base}`;
  base = base.slice(0, 60);
  let key = base;
  for (let n = 2; used.has(key.toLowerCase()); n++) key = `${base}_${n}`;
  return key;
}

/** Method names that are never sendable from a console (OD-8: no remote factory reset; NB refuses them too). */
export function isRefusedRpcMethod(method: string): boolean {
  const m = method.toLowerCase().replace(/[^a-z]/g, '');
  return m.includes('factoryreset') || m.includes('factorydefault') || m === 'cloudforget';
}

// ── entity controls and command bindings (NB 42-telemetry/14, iot-rpc 04; OD-222, OD-226) ─────────────────────────────────────────

/** What a record's control may do to equipment; a bound command is never above it. */
export type ControlTier = 'basic' | 'privileged' | 'critical';
export const CONTROL_TIERS: readonly ControlTier[] = ['basic', 'privileged', 'critical'];
export const CONTROL_TIER_RANK: Readonly<Record<ControlTier, number>> = { basic: 0, privileged: 1, critical: 2 };
export type ControlConfirmation = 'none' | 'confirm' | 'typed';

export type ControlParamSpec =
  | { type: 'number' | 'integer'; label: string; labelKey?: string; required?: boolean; min?: number; max?: number; step?: number; unit?: string }
  | { type: 'boolean'; label: string; labelKey?: string; required?: boolean }
  | { type: 'text'; label: string; labelKey?: string; required?: boolean; maxLength: number }
  | { type: 'select'; label: string; labelKey?: string; required?: boolean; options: ReadonlyArray<{ value: string; label: string; labelKey?: string }> };

/** A named control a kind of record declares (`start`, `turn_off`, `set_value`). Its name is stored by the host and never shown. */
export type EntityControl = {
  name: string;
  label: string;
  labelKey?: string;
  description?: string;
  params: Record<string, ControlParamSpec>;
  tier: ControlTier;
  confirmation: ControlConfirmation;
  /** `typed` only: the phrase the person types. */
  confirmText?: string;
};

export type ControlBindingTarget = { targetId: string; label: string; tier: ControlTier };
/** What one sink has bound to one control: labels where the viewer may read them, else a count. */
export type ControlBindingSummary = { control: string; targets: ControlBindingTarget[] | { count: number } };

/** One record's controls as the host answers them. */
export type EntityControlsView = {
  kind: string;
  entityId: string;
  controls: EntityControl[];
  /** The viewer may send this record's controls. */
  permitted: boolean;
  sinks: Array<{ sink: string; bindings: ControlBindingSummary[] }>;
  failedSinks: string[];
};

export type ControlSendBody = { params?: Record<string, unknown>; confirmed?: boolean; confirmText?: string };
export type ControlOutcome = 'queued' | 'sent' | 'failed';
export type ControlTargetResult = {
  sink: string;
  targetId: string;
  label: string;
  outcome: ControlOutcome;
  ref?: { refType: string; refId: string };
  /** A refused target's reason code (the host's), worded by the view; `message` is the host's English. */
  reason?: string;
  message?: string;
};
export type ControlSendResult =
  | { outcome: 'nothing_bound'; failedSinks: string[] }
  | { outcome: 'dispatched'; targets: ControlTargetResult[]; failedSinks: string[] };

/** Where a bound value comes from: a parameter of the control, or a fixed value. */
export type CommandBindingParamSource = { from: 'control'; param: string } | { const: unknown };
export type CommandBindingTargetType = 'COMMAND' | 'ATTRIBUTES';
export const COMMAND_BINDING_STATES = ['ok', 'record_missing', 'control_gone', 'command_gone'] as const;
export type CommandBindingState = (typeof COMMAND_BINDING_STATES)[number];

/** A record's control bound to a device: a catalog command, or a set of the device's shared values. */
export type CommandBinding = {
  bindingId: string;
  targetKind: string;
  targetKindLabel: string;
  targetEntityId: string;
  /** Null when the record is gone. */
  targetLabel: string | null;
  control: string;
  controlLabel: string | null;
  controlTier: ControlTier;
  position: number;
  deviceId: string;
  deviceName: string;
  targetType: CommandBindingTargetType;
  method: string | null;
  commandLabel: string | null;
  paramMap: Record<string, CommandBindingParamSource>;
  tier: ControlTier;
  highImpact: boolean;
  enabled: boolean;
  note: string | null;
  state: CommandBindingState;
  version: number;
  updatedAt: string | Date;
};

export type CommandBindingInput = {
  targetKind: string;
  targetEntityId: string;
  control: string;
  deviceId: string;
  targetType: CommandBindingTargetType;
  method?: string | null;
  paramMap?: Record<string, CommandBindingParamSource>;
  position?: number;
  enabled?: boolean;
  note?: string | null;
};

/** A rule a binding breaks, in the host's English (`reason` worded by the view when it knows it). */
export type CommandBindingProblem = { reason: string; field?: string; message: string };
/** A kind of record that declares controls (derived by the host, never listed by hand). */
export type BindableKind = { kind: string; label: string; labelKey?: string; controls: EntityControl[] };
/** A command of the device's catalog this control may bind. */
export type BindableCommand = { method: string; label: string; tier: ControlTier; highImpact: boolean; paramsSchema: Record<string, FieldSchema> };
/** At most 8 targets per record control (positions 0–7). */
export const COMMAND_BINDING_POSITIONS = 8;
