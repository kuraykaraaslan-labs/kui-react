import type {
  Alarm, AlarmBulkResult, AlarmCounts, AlarmEvent, AlarmSeverity, AlarmStatus,
} from '../types/alarm';
import type {
  AttributeEntry, AttributeScope, CredentialType, DeviceConnectionEvent, DeviceCredential, DeviceLogEntry, DeviceLogSource, DeviceRecord,
  DeviceRegistryStatus, DeviceStatePatch, IssuedSecret,
} from '../types/device';
import type { RpcCatalogCommand, RpcCommand, RpcCommandInput, RpcRequest, RpcSendInput, RpcStatus } from '../types/rpc';
import type { DeviceProfile, DeviceProfileInput, DeviceProfileUsage, OnlineRule, ProfileTransport } from '../types/profile';
import type { AlarmRuleDefinition, AlarmRuleRecord } from '../types/alarm-rule';

/*
 * The IoT adapter contract (docs/concepts/iot-platform/phases/00-api-adapter-layer.md §0.2): every IoT view reads and writes
 * through it, so a host (NB) injects real fetchers and the demo runs on an in-memory store. Only the methods the device and
 * alarm screens need are here (phases 01 and 03); later phases add theirs.
 *
 * Every sub-interface is optional: a host provides the parts its modules own (NB's `iot_device` the devices, `iot_alarm`
 * the alarms) and nested `IotAdapterProvider`s merge them. Naming between the host and these types (NB "resolve" =
 * kui-react "clear", NB payloads → `Alarm`) is mapped inside the adapter, never in a component.
 */

export type Page<T> = { items: T[]; total: number };

export type IotApiErrorCode =
  | 'not_found' | 'forbidden' | 'conflict' | 'validation' | 'rate_limited' | 'timeout' | 'unavailable' | 'unknown';

/** What an adapter throws; views map the code to an error state, a field error or a toast. */
export class IotApiError extends Error {
  readonly code: IotApiErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfterMs?: number;
  constructor(code: IotApiErrorCode, message: string, extra: { fieldErrors?: Record<string, string>; retryAfterMs?: number } = {}) {
    super(message);
    this.name = 'IotApiError';
    this.code = code;
    this.fieldErrors = extra.fieldErrors;
    this.retryAfterMs = extra.retryAfterMs;
  }
}

/** The message of anything an adapter threw (an `IotApiError`, an `Error`, else the fallback). */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

// ── devices ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type DeviceOnlineFilter = 'online' | 'offline' | 'last_seen';

export type DeviceListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  profileId?: string;
  online?: DeviceOnlineFilter;
  status?: DeviceRegistryStatus;
  gateway?: boolean;
  /** The device open in the quick view (`?device=` in a host's URL). Not a filter: `list` never receives it. */
  device?: string;
};

export type NewDeviceInput = {
  name: string;
  label?: string | null;
  profileId?: string;
  isGateway?: boolean;
};

export type CreatedDevice = {
  device: DeviceRecord;
  credential: DeviceCredential | null;
  /** Shown once: the view never stores it (no storage, no state outside the open dialog). */
  secret: IssuedSecret | null;
};

/** One page of a device's log, newest first; `source` narrows it to the connection log or to the audited changes. */
export type DeviceLogQuery = { page: number; pageSize: number; source?: DeviceLogSource };

export interface IotDevicesApi {
  list(query: DeviceListQuery, signal?: AbortSignal): Promise<Page<DeviceRecord>>;
  get(deviceId: string, signal?: AbortSignal): Promise<DeviceRecord>;
  create?(input: NewDeviceInput): Promise<CreatedDevice>;
  remove?(deviceId: string): Promise<void>;
  /** OD-1: quarantined → active (single and bulk, at most 100). Absent when the host has no provisioning. */
  activate?(deviceIds: string[]): Promise<{ activated: number }>;
  /** The connection log alone. Kept for hosts without `log`: the Log tab then shows connection entries only. */
  connections(deviceId: string, query: { page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<DeviceConnectionEvent>>;
  /** The device's log: its connection log and its audited changes merged, newest first (the Log tab, the quick view's recent lines). */
  log?(deviceId: string, query: DeviceLogQuery, signal?: AbortSignal): Promise<Page<DeviceLogEntry>>;
  /** How many devices wait for activation (the "Quarantined (n)" quick filter). */
  quarantinedCount?(signal?: AbortSignal): Promise<number>;
  /** A `deviceState` live payload as a patch, or null when it is not one. */
  parseState?(payload: unknown): DeviceStatePatch | null;
}

export type ProfileListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  transportType?: ProfileTransport;
  onlineRule?: OnlineRule;
};

export interface IotProfilesApi {
  /** The profiles a filter or a form offers (id and name). */
  options(signal?: AbortSignal): Promise<Array<{ id: string; name: string }>>;
  // ── the profile screens (phase 01 §1.4; NB iot_device_profile 03) ──
  list?(query: ProfileListQuery, signal?: AbortSignal): Promise<Page<DeviceProfile>>;
  get?(profileId: string, signal?: AbortSignal): Promise<DeviceProfile>;
  /** A create always carries a name and an explicit online rule (OD-63: the host refuses one without). */
  create?(input: DeviceProfileInput & { name: string; onlineRule: OnlineRule }): Promise<DeviceProfile>;
  /** Only the changed fields; a transport the stored rule cannot serve is refused unless the same edit picks an allowed rule. */
  update?(profileId: string, patch: DeviceProfileInput): Promise<DeviceProfile>;
  /** Refused (conflict) for the default profile and while anything still references it. */
  remove?(profileId: string): Promise<void>;
  setDefault?(profileId: string): Promise<DeviceProfile>;
  /** What still points at each profile (devices, alarm rules, commands, …), for the list's device count and the delete hint. */
  usage?(profileIds: string[], signal?: AbortSignal): Promise<Record<string, DeviceProfileUsage>>;
  /** The transports this host offers (default MQTT, HTTP, ANY). */
  transports?: ProfileTransport[];
}

/** The alarm rules of a profile (NB `iot_alarm`): read, and replace the whole set (types unique in a profile). */
export interface IotAlarmRulesApi {
  list(profileId: string, signal?: AbortSignal): Promise<AlarmRuleRecord[]>;
  replace(profileId: string, rules: AlarmRuleDefinition[]): Promise<AlarmRuleRecord[]>;
}

/** The command catalog of a profile (NB `iot_rpc`): one command at a time, or the whole catalog as JSON (import / export). */
export interface IotRpcCatalogApi {
  list(profileId: string, signal?: AbortSignal): Promise<{ commands: RpcCatalogCommand[]; supported: boolean }>;
  create(profileId: string, command: RpcCommandInput): Promise<RpcCatalogCommand>;
  /** Every field but the method (a renamed method is a new command). */
  update(profileId: string, commandId: string, patch: Partial<Omit<RpcCommandInput, 'method'>>): Promise<RpcCatalogCommand>;
  remove(profileId: string, commandId: string): Promise<void>;
  /** The import shape (no ids). */
  exportAll(profileId: string): Promise<RpcCommandInput[]>;
  /** Replaces the whole catalog. */
  importAll(profileId: string, commands: RpcCommandInput[]): Promise<RpcCatalogCommand[]>;
}

export interface IotCredentialsApi {
  get(deviceId: string, signal?: AbortSignal): Promise<DeviceCredential | null>;
  /** A new secret of the same type, returned once; the old one stops working at once. */
  rotate(deviceId: string): Promise<{ credential: DeviceCredential | null; secret: IssuedSecret | null }>;
}

export interface IotAttributesApi {
  list(deviceId: string, scope: AttributeScope, signal?: AbortSignal): Promise<AttributeEntry[]>;
  save(deviceId: string, scope: Exclude<AttributeScope, 'CLIENT'>, values: Record<string, unknown>): Promise<void>;
  remove(deviceId: string, scope: Exclude<AttributeScope, 'CLIENT'>, keys: string[]): Promise<void>;
}

// ── alarms (phase 03) ────────────────────────────────────────────────────────────────────────────────────────────────

/** `active` = not resolved (the default list); `any` needs a bounded time range (OD-31). */
export type AlarmStatusFilter = 'active' | AlarmStatus | 'any';

export type AlarmListQuery = {
  page: number;
  pageSize: number;
  status?: AlarmStatusFilter;
  severity?: AlarmSeverity[];
  deviceId?: string;
  search?: string;
  /** ISO times; a resolved or all-status list always sends a range (default last 7 days). */
  from?: string;
  to?: string;
};

export type AlarmTransition = 'created' | 'updated' | 'acknowledged' | 'cleared';

export type AlarmLiveEvent = { alarm: Alarm; transition: AlarmTransition };

export interface IotAlarmsApi {
  list(query: AlarmListQuery, signal?: AbortSignal): Promise<Page<Alarm>>;
  get(alarmId: string, signal?: AbortSignal): Promise<Alarm>;
  events(alarmId: string, signal?: AbortSignal): Promise<AlarmEvent[]>;
  /** Per-id results: an alarm that changed meanwhile is reported, not thrown. */
  acknowledge(alarmIds: string[], note?: string): Promise<AlarmBulkResult[]>;
  /** "Clear" here = "resolve" in NB. */
  clear(alarmIds: string[], note?: string): Promise<AlarmBulkResult[]>;
  comment(alarmId: string, text: string): Promise<void>;
  counts(scope?: { deviceId?: string }, signal?: AbortSignal): Promise<AlarmCounts>;
  /** An `alarms` live payload as an event, or null when it is not one. */
  parseLive?(payload: unknown): AlarmLiveEvent | null;
}

// ── RPC (phase 04) ───────────────────────────────────────────────────────────────────────────────────────────────────

export type RpcListQuery = {
  /** Absent: the fleet log (every device of the tenant), when the host offers it. */
  deviceId?: string;
  status?: RpcStatus;
  method?: string;
  cursor?: string | null;
  limit: number;
};

export type RpcCatalog = {
  commands: RpcCommand[];
  /** The viewer may send methods outside the catalog (raw RPC). */
  canSendRaw: boolean;
  /** False when the device cannot take RPC at all (OD-85: a ThingsBoard-scheme profile); `reason` says why. */
  supported: boolean;
  reason?: string;
};

export type RpcLiveEvent = { request: RpcRequest };

export interface IotRpcApi {
  /** The device's catalog with what the viewer may send. */
  methods(deviceId: string, signal?: AbortSignal): Promise<RpcCatalog>;
  /** Sends; answers the request as it stands (often QUEUED; the rest arrives live or by `get`). */
  send(deviceId: string, input: RpcSendInput): Promise<RpcRequest>;
  list(query: RpcListQuery, signal?: AbortSignal): Promise<{ items: RpcRequest[]; nextCursor: string | null }>;
  get(rpcId: string, signal?: AbortSignal): Promise<RpcRequest>;
  /** QUEUED or SENT only. */
  cancel(rpcId: string): Promise<RpcRequest>;
  /** An `rpc` live payload (a state change, no params or answer) as an event, or null. */
  parseLive?(payload: unknown): RpcLiveEvent | null;
}

// ── capabilities ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the viewer may do (00 §0.2): views hide or disable actions from it; the server still judges every call. There is no
 * capability for a remote factory reset (OD-8).
 */
export type IotCapabilities = {
  canCreateDevice: boolean;
  canEditDevice: boolean;
  canDeleteDevice: boolean;
  canViewCredentials: boolean;
  canReadAttributes: boolean;
  canWriteAttributes: boolean;
  canActivateDevice: boolean;
  canReleaseDevice: boolean;
  canReadAlarms: boolean;
  canAcknowledge: boolean;
  canClear: boolean;
  canComment: boolean;
  /** The viewer may send at least one catalog tier (the catalog says which). */
  canSendRpc: boolean;
  /** Create, edit, delete profiles and make one the default. */
  canManageProfiles: boolean;
  /** Edit the alarm rules of a profile. */
  canManageAlarmRules: boolean;
  /** Edit the command catalog of a profile (create, edit, delete, import). */
  canManageRpcCommands: boolean;
};

/** Fail closed: nothing until the host says so. */
export const NO_CAPABILITIES: IotCapabilities = {
  canCreateDevice: false,
  canEditDevice: false,
  canDeleteDevice: false,
  canViewCredentials: false,
  canReadAttributes: false,
  canWriteAttributes: false,
  canActivateDevice: false,
  canReleaseDevice: false,
  canReadAlarms: false,
  canAcknowledge: false,
  canClear: false,
  canComment: false,
  canSendRpc: false,
  canManageProfiles: false,
  canManageAlarmRules: false,
  canManageRpcCommands: false,
};

export interface IotAdapter {
  /** Shown in the demo settings ("Demo, in memory"). */
  name?: string;
  devices?: IotDevicesApi;
  profiles?: IotProfilesApi;
  credentials?: IotCredentialsApi;
  attributes?: IotAttributesApi;
  alarms?: IotAlarmsApi;
  rpc?: IotRpcApi;
  alarmRules?: IotAlarmRulesApi;
  rpcCatalog?: IotRpcCatalogApi;
  capabilities?(signal?: AbortSignal): Promise<Partial<IotCapabilities>>;
}

/** The credential types a "New device" form can offer (01 §1.1). */
export type NewDeviceCredentialType = CredentialType;
