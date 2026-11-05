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

/** One command of the device profile's catalog. */
export type RpcCommand = {
  method: string;
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
  method: string;
  params?: Record<string, unknown>;
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
  return {
    method: r.method,
    ...(params ? { params: withoutRpcPaths(params, masked) } : {}),
    maskedPaths: masked,
    oneway: r.oneway,
    persistent: r.persistent,
    ...(typeof r.timeoutMs === 'number' ? { timeoutMs: r.timeoutMs } : {}),
    ...(expiresInS ? { expiresInS } : {}),
  };
}

/** Method names that are never sendable from a console (OD-8: no remote factory reset; NB refuses them too). */
export function isRefusedRpcMethod(method: string): boolean {
  const m = method.toLowerCase().replace(/[^a-z]/g, '');
  return m.includes('factoryreset') || m.includes('factorydefault') || m === 'cloudforget';
}
