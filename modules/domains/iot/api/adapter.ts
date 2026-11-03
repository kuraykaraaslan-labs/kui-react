import type {
  Alarm, AlarmBulkResult, AlarmCounts, AlarmEvent, AlarmSeverity, AlarmStatus,
} from '../types/alarm';
import type {
  AttributeEntry, AttributeScope, CredentialType, DeviceConnectionEvent, DeviceConnectionInfo, DeviceCredential, DeviceLogEntry, DeviceLogSource,
  DeviceRecord, DeviceRegistryStatus, DeviceStatePatch, IssuedSecret,
} from '../types/device';
import type { RpcCatalogCommand, RpcCommand, RpcCommandInput, RpcCommandTemplate, RpcRequest, RpcSendInput, RpcStatus } from '../types/rpc';
import type {
  DeviceProfile, DeviceProfileInput, DeviceProfileUsage, IssuedProvisionKey, OnlineRule, ProfileKeyUsage, ProfileTransport, ProvisionKey, ProvisioningInfo,
  ProvisionStrategy,
} from '../types/profile';
import type { AlarmRuleDefinition, AlarmRuleRecord } from '../types/alarm-rule';
import type {
  AssetInput, AssetNode, AssetRecord, AssetRow, AssetSummary, AssetRelation, AssetRelationInput, DevicePlacement, PlacedDevice, RelationEntityType,
} from '../types/asset';

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

/**
 * A list's order: one column of the view and its direction (the views sort by one column at a time). Absent: the host's own
 * order (devices by name, profiles the default first, alarms newest first). A host maps the key onto its own sort field and
 * refuses a key it cannot sort by.
 */
export type IotListSort<K extends string = string> = { key: K; dir: 'asc' | 'desc' };

// ── devices ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type DeviceOnlineFilter = 'online' | 'offline' | 'last_seen';

/** The device list's sortable columns. */
export const DEVICE_SORT_KEYS = ['name', 'connection', 'lastSeen'] as const;
export type DeviceSortKey = (typeof DEVICE_SORT_KEYS)[number];

export type DeviceListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sort?: IotListSort<DeviceSortKey>;
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

/**
 * The fields of a device an operator edits in place (the Edit drawer of the device page and of the list); `null` clears a label, a type
 * or the additional info. `status` moves between `ACTIVE` and `DISABLED` only (a quarantined device is approved through `activate`).
 */
export type UpdateDeviceInput = {
  name?: string;
  label?: string | null;
  type?: string | null;
  profileId?: string;
  status?: 'ACTIVE' | 'DISABLED';
  additionalInfo?: Record<string, unknown> | null;
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
  /** Edits a device (only the sent fields change); answers the device as it is now. Absent when the host cannot edit. */
  update?(deviceId: string, patch: UpdateDeviceInput): Promise<DeviceRecord>;
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

/** The profile list's sortable columns. */
export const PROFILE_SORT_KEYS = ['name', 'transport', 'online', 'updated'] as const;
export type ProfileSortKey = (typeof PROFILE_SORT_KEYS)[number];

export type ProfileListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sort?: IotListSort<ProfileSortKey>;
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
  /** Who still reads some telemetry keys of the profile (alarm rules, …): asked after a save removed keys. Only non-zero counts. */
  keyUsage?(profileId: string, keys: string[], signal?: AbortSignal): Promise<ProfileKeyUsage[]>;
  /** Rewrites what reads the old keys to the new names (`{ old: new }`) where the viewer may; answers what each module changed. */
  renameKeys?(profileId: string, renames: Record<string, string>): Promise<ProfileKeyUsage[]>;
}

/**
 * The provisioning of a profile (NB `iot_device_profile` 02 §2.2, OD-1), for a viewer with `canManageProvisioning`: the keys and what
 * the host serves, the strategy, a rotation (the new secret answered once) and a revocation (the key id typed again, a reason).
 */
export interface IotProvisioningApi {
  get(profileId: string, signal?: AbortSignal): Promise<ProvisioningInfo>;
  /** Sets the strategy (the editor's Save sends it here instead of in the profile patch); answers the stored one. */
  setStrategy?(profileId: string, strategy: ProvisionStrategy): Promise<ProvisionStrategy>;
  /** A new active key; the previous active key is retired with `graceDays` (absent: the host's default). The secret is in the answer only. */
  rotate(profileId: string, input: { graceDays?: number }): Promise<IssuedProvisionKey>;
  /** Immediate and final; `confirmKeyId` is the key id the viewer typed again. */
  revoke(profileId: string, input: { provisionKeyId: string; confirmKeyId: string; reason: string }): Promise<ProvisionKey>;
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
  /** Commands the host's own features send (a board control's `scada.set_value`): "New command" offers them as a start. */
  templates?: readonly RpcCommandTemplate[];
}

export interface IotCredentialsApi {
  get(deviceId: string, signal?: AbortSignal): Promise<DeviceCredential | null>;
  /** A new secret of the same type, returned once; the old one stops working at once. */
  rotate(deviceId: string): Promise<{ credential: DeviceCredential | null; secret: IssuedSecret | null }>;
  /** Where the device connects (host, port, the HTTPS base, its profile's keys): the "Connection details" card. Absent: no card. */
  connection?(deviceId: string, signal?: AbortSignal): Promise<DeviceConnectionInfo>;
}

export interface IotAttributesApi {
  list(deviceId: string, scope: AttributeScope, signal?: AbortSignal): Promise<AttributeEntry[]>;
  save(deviceId: string, scope: Exclude<AttributeScope, 'CLIENT'>, values: Record<string, unknown>): Promise<void>;
  remove(deviceId: string, scope: Exclude<AttributeScope, 'CLIENT'>, keys: string[]): Promise<void>;
}

// ── alarms (phase 03) ────────────────────────────────────────────────────────────────────────────────────────────────

/** `active` = not resolved (the default list); `any` needs a bounded time range (OD-31). */
export type AlarmStatusFilter = 'active' | AlarmStatus | 'any';

/** The alarm list's sortable columns (severity: the most severe first when descending). */
export const ALARM_SORT_KEYS = ['severity', 'title', 'device', 'status', 'opened'] as const;
export type AlarmSortKey = (typeof ALARM_SORT_KEYS)[number];

export type AlarmListQuery = {
  page: number;
  pageSize: number;
  sort?: IotListSort<AlarmSortKey>;
  status?: AlarmStatusFilter;
  severity?: AlarmSeverity[];
  deviceId?: string;
  search?: string;
  /** ISO times; a resolved or all-status list always sends a range (default last 7 days). */
  from?: string;
  to?: string;
};

export type AlarmTransition = 'created' | 'updated' | 'acknowledged' | 'cleared';

/**
 * One alarm transition as the live topic carries it: the alarm as it is now and what happened. `severityChange` comes with an
 * `updated` that moved the severity (the bell moves the alarm between its severity counts without asking the host).
 */
export type AlarmLiveEvent = {
  alarm: Alarm;
  transition: AlarmTransition;
  severityChange?: { from: AlarmSeverity; to: AlarmSeverity };
};

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
  /**
   * An `alarms` live payload as an event, or null when it is not one. With it the bell (`useAlarmBell`) follows the events
   * without asking again; without it, it re-reads after an event (at most once per 30 s).
   */
  parseLive?(payload: unknown): AlarmLiveEvent | null;
}

// ── RPC (phase 04) ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The columns a request history sorts by on the host. */
export const RPC_SORT_KEYS = ['method', 'status', 'source', 'createdAt', 'completedAt'] as const;
export type RpcSortKey = (typeof RPC_SORT_KEYS)[number];

/**
 * One page of a request history. The console sends the list query of its table (`page`, `pageSize`, `search` over the method,
 * `sort`, `statuses`, `sources`) and the host answers that page with `total`; `cursor` / `limit` keep an older keyset host working
 * (`limit` is the page size).
 */
export type RpcListQuery = {
  /** Absent: the fleet log (every device of the tenant), when the host offers it. */
  deviceId?: string;
  status?: RpcStatus;
  statuses?: readonly RpcStatus[];
  sources?: readonly string[];
  method?: string;
  /** 1-based page of `pageSize` rows. */
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: IotListSort<RpcSortKey>;
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
  /** One page; `total` (the rows across every page) lets the table page, sort and filter on the host. */
  list(query: RpcListQuery, signal?: AbortSignal): Promise<{ items: RpcRequest[]; nextCursor: string | null; total?: number }>;
  get(rpcId: string, signal?: AbortSignal): Promise<RpcRequest>;
  /** QUEUED or SENT only. */
  cancel(rpcId: string): Promise<RpcRequest>;
  /** An `rpc` live payload (a state change, no params or answer) as an event, or null. */
  parseLive?(payload: unknown): RpcLiveEvent | null;
}

// ── sites and assets (phase 08) ─────────────────────────────────────────────────────────────────────────────────────

export type PlacedDeviceQuery = {
  page: number;
  pageSize: number;
  /** Devices on descendants too (default true). */
  recursive?: boolean;
  /** Name, label or the node it sits on. */
  search?: string;
  /** `name`: the device's name; `connection`: online first, then the most recently active. Default: by name. */
  sort?: IotListSort<'name' | 'connection'>;
  /** Only online (`true`) or offline (`false`) devices. */
  online?: boolean;
};

/** The columns the Sites & assets table sorts by on the host (no sort: tree order, each site followed by what is under it). */
export const ASSET_SORT_KEYS = ['name', 'kind', 'location', 'children', 'devices', 'alarms'] as const;
export type AssetSortKey = (typeof ASSET_SORT_KEYS)[number];

/**
 * The Sites & assets table's query (owner 2026-10-27, option B): paging, sort, search (name, code or place), the kind, a site's
 * subtree (`site`, the node itself included), the direct children of a node (`parentId`) and "only with active alarms". `asset` (the
 * open asset drawer) and `map` (the map drawer is open) are the view's own state, kept by a host in its URL; never sent to the host API.
 */
export type AssetListQuery = {
  page: number;
  pageSize: number;
  sort?: IotListSort<AssetSortKey>;
  search?: string;
  kind?: string;
  site?: string;
  parentId?: string;
  alarmed?: boolean;
  asset?: string;
  map?: boolean;
};

/**
 * The topology (NB `iot_asset`): the tree, one asset, its devices and relations, and a device's placement. A host refuses a move
 * under the asset itself or a descendant (`validation`), a delete while children remain or another module still points at the
 * asset (`conflict`, the message names it), and a second placement of a device is a move, never a second parent.
 */
export interface IotAssetsApi {
  /** The whole tree (a host may bound it; `truncated` says it did): the Move and placement pickers. */
  tree(signal?: AbortSignal): Promise<{ nodes: AssetNode[]; truncated: boolean }>;
  /** One page of the Sites & assets table, filtered and sorted by the host; `alarms` false when it shows no alarm counts. */
  list(query: AssetListQuery, signal?: AbortSignal): Promise<Page<AssetRow> & { alarms: boolean }>;
  /** The page's KPI row and its sites on the map. */
  summary(signal?: AbortSignal): Promise<AssetSummary>;
  get(assetId: string, signal?: AbortSignal): Promise<AssetRecord>;
  create(input: AssetInput): Promise<{ assetId: string }>;
  /** Only the changed fields; never the parent (that is `move`). */
  update(assetId: string, patch: Partial<Omit<AssetInput, 'parentId'>>): Promise<void>;
  /** `null` = to the top level. */
  move(assetId: string, parentId: string | null): Promise<void>;
  remove(assetId: string): Promise<void>;
  /** The devices placed on the asset or (recursive) any descendant. */
  devices(assetId: string, query: PlacedDeviceQuery, signal?: AbortSignal): Promise<Page<PlacedDevice>>;
  /** Places the devices on the asset (each moved from where it was). */
  place(assetId: string, deviceIds: string[]): Promise<void>;
  placement(deviceId: string, signal?: AbortSignal): Promise<DevicePlacement>;
  /** `null` removes the placement. */
  setPlacement(deviceId: string, assetId: string | null): Promise<DevicePlacement>;
  /** Relations with the entity at either end. */
  relations?(entity: { type: RelationEntityType; id: string }, signal?: AbortSignal): Promise<AssetRelation[]>;
  createRelation?(input: AssetRelationInput): Promise<AssetRelation>;
  removeRelation?(relationId: string): Promise<void>;
}

// ── telemetry (the device page's Telemetry tab) ───────────────────────────────────────────────────────────────────────

/** A value a device sends for one key: a number, a flag, a word, or a JSON object or list. */
export type TelemetryValue = number | boolean | string | Record<string, unknown> | unknown[];
/**
 * One key's latest value and when it was sent (epoch ms). `label` and `unit` are the host's words for the key (its profile's schema),
 * shown instead of the key and beside the value when given (next-boilerplate's e2e round 2: a tab of codes without names or units).
 */
export type TelemetryLatest = { key: string; ts: number; value: TelemetryValue; label?: string; unit?: string };
/** One point of a numeric series (a bucket's value when the host aggregates). */
export type TelemetryPoint = { ts: number; value: number };
export type TelemetrySeriesQuery = { keys: string[]; from: number; to: number };

/**
 * A device's telemetry (NB `telemetry` + `iot_telemetry`): every key's latest value, and numeric series over a window. A host
 * aggregates a long window into buckets (its choice of resolution); a key that is not numeric answers an empty series.
 */
export interface IotTelemetryApi {
  /** Every key the device has a latest value for. */
  latest(deviceId: string, signal?: AbortSignal): Promise<TelemetryLatest[]>;
  /** One series per key over `[from, to)`, oldest first. */
  series(deviceId: string, query: TelemetrySeriesQuery, signal?: AbortSignal): Promise<Record<string, TelemetryPoint[]>>;
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
  /** Manage a profile's provisioning: its strategy and keys (rotate, revoke). */
  canManageProvisioning: boolean;
  /** Edit the alarm rules of a profile. */
  canManageAlarmRules: boolean;
  /** Edit the command catalog of a profile (create, edit, delete, import). */
  canManageRpcCommands: boolean;
  /** Create, edit, move and delete sites and assets. */
  canManageAssets: boolean;
  /** Place devices on assets and manage relations. */
  canPlaceDevices: boolean;
  /** Read a device's telemetry (its latest values and series). */
  canReadTelemetry: boolean;
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
  canManageProvisioning: false,
  canManageAlarmRules: false,
  canManageRpcCommands: false,
  canManageAssets: false,
  canPlaceDevices: false,
  canReadTelemetry: false,
};

export interface IotAdapter {
  /** Shown in the demo settings ("Demo, in memory"). */
  name?: string;
  devices?: IotDevicesApi;
  profiles?: IotProfilesApi;
  provisioning?: IotProvisioningApi;
  credentials?: IotCredentialsApi;
  attributes?: IotAttributesApi;
  alarms?: IotAlarmsApi;
  rpc?: IotRpcApi;
  alarmRules?: IotAlarmRulesApi;
  rpcCatalog?: IotRpcCatalogApi;
  assets?: IotAssetsApi;
  telemetry?: IotTelemetryApi;
  capabilities?(signal?: AbortSignal): Promise<Partial<IotCapabilities>>;
}

/** The credential types a "New device" form can offer (01 §1.1). */
export type NewDeviceCredentialType = CredentialType;
