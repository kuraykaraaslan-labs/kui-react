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
};

/** A command as its profile's catalog stores it (the catalog editor's row): the host's id and the parameters it masks in the history. */
export type RpcCatalogCommand = RpcCommand & {
  commandId: string;
  maskedParams?: string[];
  updatedAt?: Date | string;
};

/** What the catalog editor sends (create, edit, import): never `sendable` (the host answers it per viewer). */
export type RpcCommandInput = Omit<RpcCommand, 'sendable'> & { maskedParams?: string[] };

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
  error?: string | null;
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
};

/** Method names that are never sendable from a console (OD-8: no remote factory reset; NB refuses them too). */
export function isRefusedRpcMethod(method: string): boolean {
  const m = method.toLowerCase().replace(/[^a-z]/g, '');
  return m.includes('factoryreset') || m.includes('factorydefault') || m === 'cloudforget';
}
