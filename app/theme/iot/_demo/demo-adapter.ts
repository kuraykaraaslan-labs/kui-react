import { IotApiError, type IotAdapter, type AlarmLiveEvent, type AlarmTransition, type IotListSort } from '@/modules/domains/iot/api/adapter';
import { ALARM_SEVERITIES, type Alarm, type AlarmBulkResult, type AlarmCounts, type AlarmEvent } from '@/modules/domains/iot/types/alarm';
import type {
  AttributeEntry, AttributeScope, DeviceConnectionEvent, DeviceCredential, DeviceLogEntry, DeviceRecord, DeviceStatePatch, IssuedSecret,
} from '@/modules/domains/iot/types/device';
import type { Device } from '@/modules/domains/iot/types';
import { isRefusedRpcMethod, type RpcCatalogCommand, type RpcCommand, type RpcCommandInput, type RpcRequest, type RpcStatus } from '@/modules/domains/iot/types/rpc';
import { blankProfileDraft, onlineRuleBlock, type DeviceProfile, type DeviceProfileUsage } from '@/modules/domains/iot/types/profile';
import { alarmRuleKeys, conditionLeaves, isInactivityRule, newInactivityRule, type AlarmRuleDefinition } from '@/modules/domains/iot/types/alarm-rule';
import { ALARMS, ALARM_EVENTS, DEVICES, DEVICE_PROFILES } from '../iot.data';
import type { DemoLive } from './demo-live';
import { createDemoAssets } from './demo-assets';
import { createDemoTelemetry, demoLivePoint } from './demo-telemetry';

/*
 * The demo adapter (docs/concepts/iot-platform/phases/00 §0.5): an in-memory store seeded from `iot.data.ts` that implements
 * the device and alarm parts of `IotAdapter`, so `/theme/iot` runs the same views NB runs on its HTTP adapter. Changes last
 * for the page's life (no browser storage) and are published to the demo live source. A seeded quarantined device and a
 * "last seen only" device show OD-1 and OD-57; alarms cover the five OD-9 severities and every alarm has a timeline.
 */

export const DEMO_PROFILES = DEVICE_PROFILES.map((p) => ({ id: p.profileId, name: p.name }));

type SortValue = string | number | null | undefined;

/** Rows in a list view's column order (one key); equal values keep their order, empty values last. Without a sort, as they are. */
export function sortRows<T>(rows: T[], sort: IotListSort | undefined, values: Record<string, (row: T) => SortValue>): T[] {
  const get = sort ? values[sort.key] : undefined;
  if (!sort || !get) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null || x === undefined || y === null || y === undefined) return x === y ? 0 : x === null || x === undefined ? 1 : -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir;
  });
}

const time = (v: string | number | Date | null | undefined): number | null => (v ? new Date(v).getTime() : null);
const STATUS_RANK: Record<string, number> = { OPEN: 0, ACKNOWLEDGED: 1, RESOLVED: 2 };

/** The alarm rules the demo profiles start with (the sensors: a two-severity temperature rule and the offline rule). */
const DEMO_RULES: Record<string, AlarmRuleDefinition[]> = {
  'prof-sensor': [
    {
      type: 'high_temperature', title: '{{device.name}}: temperature {{value}} °C', enabled: true,
      severities: [
        { severity: 'CRITICAL', condition: { key: 'temperature', op: '>', value: 95 } },
        { severity: 'MAJOR', condition: { key: 'temperature', op: '>', value: 80 } },
      ],
      debounce: { mode: 'count', raise: 3, clear: 3 }, hysteresis: 3, runbook: 'Check the coolant flow and the pump.',
    },
    newInactivityRule(),
  ],
  'prof-http': [
    {
      type: 'battery_low', title: '{{device.name}}: battery {{value}} %', enabled: true,
      severities: [{ severity: 'WARNING', condition: { any: [{ key: 'battery', op: '<', value: 20 }, { key: 'battery_v', op: '<', value: 3.1 }] } }],
    },
  ],
};

/** The Roltek router catalog in the protocol's wire names (no factory reset, OD-8); `diag.slow` never answers (the timeout demo). */
export const DEMO_RPC_COMMANDS: RpcCommand[] = [
  { method: 'sys.info', label: 'System information', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {}, defaultTimeoutMs: 10_000 },
  { method: 'sys.ping', label: 'Ping a host', tier: 'basic', highImpact: false, oneway: false, defaultTimeoutMs: 15_000,
    paramsSchema: { host: { label: 'Host', type: 'text', required: true, placeholder: '8.8.8.8' }, count: { label: 'Count', type: 'number', min: 1, max: 10, value: 3 } } },
  { method: 'net.status', label: 'Network status', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {} },
  { method: 'cfg.sync', label: 'Apply configuration now', tier: 'privileged', highImpact: false, oneway: true, paramsSchema: {} },
  { method: 'diag.slow', label: 'Slow diagnostic (never answers)', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {}, defaultTimeoutMs: 5_000 },
  { method: 'sys.reboot', label: 'Reboot', description: 'The device restarts and is offline for about a minute.', tier: 'critical', highImpact: true,
    confirmText: 'REBOOT', oneway: true, persistentDefault: true, paramsSchema: {} },
];

const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms);

function toRecord(d: Device): DeviceRecord {
  const online = d.status === 'ONLINE';
  return {
    deviceId: d.deviceId,
    name: d.name,
    label: d.location?.label ?? null,
    type: d.model ?? null,
    serial: `RT-${d.deviceId.toUpperCase()}`,
    deviceProfileId: d.role === 'GATEWAY' ? 'prof-gateway' : 'prof-sensor',
    profileName: null,
    status: d.status === 'MAINTENANCE' ? 'DISABLED' : 'ACTIVE',
    isGateway: d.role === 'GATEWAY',
    fwTitle: d.model ?? null,
    fwVersion: d.firmware ?? null,
    protocolMajor: 1,
    online,
    lastActivityAt: d.lastSeenAt ?? null,
    lastConnectAt: online ? ago(3 * 3_600_000) : ago(26 * 3_600_000),
    lastDisconnectAt: online ? ago(4 * 3_600_000) : (d.lastSeenAt ?? null),
    lastDisconnectReason: online ? null : 'keepalive_timeout',
    createdAt: d.createdAt ?? ago(90 * 86_400_000),
  };
}

const EXTRA_DEVICES: DeviceRecord[] = [
  {
    deviceId: 'dev-tb01', name: 'Legacy Meter DC620', label: 'Speaks the ThingsBoard topics only', type: 'DC620', serial: 'DC-620-0042',
    deviceProfileId: 'prof-tb', status: 'ACTIVE', isGateway: false, fwTitle: 'DC620', fwVersion: '3.2', protocolMajor: null,
    online: true, lastActivityAt: ago(MIN), createdAt: ago(400 * 86_400_000),
  },
  {
    deviceId: 'dev-q01', name: 'Cold Room Probe 12', label: 'Provisioned from the factory pool', type: 'Nexus T100', serial: 'RT-24-000912',
    deviceProfileId: 'prof-sensor', status: 'QUARANTINED', isGateway: false, fwTitle: 'Nexus T100', fwVersion: 'v2.4.0', protocolMajor: 1,
    online: true, lastActivityAt: ago(2 * MIN), lastConnectAt: ago(40 * MIN), createdAt: ago(40 * MIN),
  },
  {
    deviceId: 'dev-lw01', name: 'Water Meter 3B', label: 'Basement, riser 3', type: 'LoRaWAN meter', serial: 'LW-70B3D5',
    deviceProfileId: 'prof-lorawan', status: 'ACTIVE', isGateway: false, fwTitle: null, fwVersion: '1.0.3', protocolMajor: null,
    online: null, lastActivityAt: ago(3 * 3_600_000), createdAt: ago(200 * 86_400_000),
  },
];

type Store = {
  profiles: DeviceProfile[];
  rules: Map<string, AlarmRuleDefinition[]>;
  catalog: Map<string, RpcCatalogCommand[]>;
  rpc: RpcRequest[];
  devices: DeviceRecord[];
  credentials: Map<string, DeviceCredential | null>;
  attributes: Map<string, Record<AttributeScope, AttributeEntry[]>>;
  alarms: Alarm[];
  events: Map<string, AlarmEvent[]>;
  /** The audited changes of each device (the Log tab's "Changes"), newest last. */
  audit: Map<string, DeviceLogEntry[]>;
};

/** The demo's people: whoever acts in the demo is Alex Müller; the seeded history has a second operator. */
const ALEX = { id: 'user-alex', name: 'Alex Müller' };
const ADA = { id: 'user-ada', name: 'Ada Lovelace' };

/** A plausible history of changes for a seeded device (no secrets, no attribute values: what a host's audit log keeps). */
function seedAudit(d: DeviceRecord): DeviceLogEntry[] {
  const at = (ms: number) => ago(ms);
  const created = d.createdAt ? new Date(d.createdAt) : ago(90 * 86_400_000);
  const rows: DeviceLogEntry[] = [
    { id: `${d.deviceId}-a0`, at: created, source: 'audit', kind: 'iot_device.device.created', actor: ADA, metadata: { credentialType: 'ACCESS_TOKEN' } },
  ];
  if (d.status === 'QUARANTINED') return rows.map((r) => ({ ...r, actor: null }));
  rows.push(
    { id: `${d.deviceId}-a1`, at: at(5 * 86_400_000), source: 'audit', kind: 'iot_device.device.updated', actor: ADA, metadata: { fields: ['label'] } },
    { id: `${d.deviceId}-a2`, at: at(2 * 86_400_000), source: 'audit', kind: 'iot_device.credential.rotated', actor: ALEX, metadata: { credentialType: 'ACCESS_TOKEN' } },
    { id: `${d.deviceId}-a3`, at: at(26 * 3_600_000 + 5 * MIN), source: 'audit', kind: 'iot_device.attributes.saved', actor: ALEX, metadata: { scope: 'SHARED', keys: ['cfg.report_interval_s'] } },
  );
  if (d.online !== null) {
    rows.push({ id: `${d.deviceId}-a4`, at: at(3 * 3_600_000 + 12 * MIN), source: 'audit', kind: 'iot_rpc.request.created', actor: ALEX, metadata: { method: 'sys.ping', rpcId: `rpc-seed-${d.deviceId}` } });
  }
  if (d.status === 'DISABLED') {
    rows.push({ id: `${d.deviceId}-a5`, at: at(20 * MIN), source: 'audit', kind: 'iot_device.device.disabled', actor: ADA, metadata: { from: 'ACTIVE', to: 'DISABLED' } });
  }
  return rows;
}

function seedAttributes(d: DeviceRecord): Record<AttributeScope, AttributeEntry[]> {
  const t = Date.now() - 3_600_000;
  return {
    SERVER: [
      { key: 'site', value: d.label ?? 'Hall A', updatedAt: t },
      { key: 'maintenance', value: { window: 'Sun 02:00-04:00', owner: 'facilities' }, updatedAt: t },
    ],
    SHARED: [
      { key: 'cfg.report_interval_s', value: 30, updatedAt: t, sync: 'in_sync' },
      { key: 'cfg.threshold_c', value: 85, updatedAt: Date.now() - 60_000, sync: 'pending' },
      { key: 'cfg.led', value: 'blink', updatedAt: t, sync: 'rejected', syncReason: 'value_out_of_range' },
      { key: 'cfg.wifi.psk', value: null, updatedAt: t, secret: true, sync: 'in_sync' },
    ],
    CLIENT: [
      { key: 'fw_version', value: d.fwVersion ?? 'v1', updatedAt: t },
      { key: 'cfg.report_interval_s', value: 30, updatedAt: t },
      { key: 'uptime_s', value: 86_400 * 3 + 512, updatedAt: Date.now() - 30_000 },
    ],
  };
}

function seedConnections(d: DeviceRecord): DeviceConnectionEvent[] {
  if (d.online === null) return [{ id: `${d.deviceId}-c0`, at: ago(30 * 86_400_000), kind: 'last_seen_only', reason: 'online_rule_changed' }];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${d.deviceId}-c${i}`,
    at: ago((i + 1) * 3_600_000),
    kind: i % 2 === 0 ? 'connected' : 'disconnected',
    reason: i % 2 === 0 ? null : (i % 4 === 1 ? 'keepalive_timeout' : 'client_disconnect'),
    transport: i % 3 === 0 ? 'mqtts' : 'mqtt',
    remoteIp: `203.0.113.${10 + i}`,
  }));
}

function randomSecret(n = 32): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({ length: n }, (_, i) => abc[(i * 7 + Date.now()) % abc.length]).join('');
}

export type DemoAdapter = IotAdapter & {
  /** The simulation's hooks: raise / clear an alarm, flip a device. */
  sim: {
    raise(deviceId: string): void;
    clearOldest(): void;
    flip(deviceId: string): void;
    deviceIds(): string[];
    /** Publishes one live telemetry point of the device (the `i`-th of its keys, in turn). */
    telemetry(deviceId: string, i: number): void;
  };
};

export function createDemoAdapter(live: DemoLive, opts: { latencyMs?: number } = {}): DemoAdapter {
  const store: Store = {
    profiles: DEVICE_PROFILES.map((p) => structuredClone(p)),
    rules: new Map(Object.entries(DEMO_RULES).map(([k, v]) => [k, structuredClone(v)])),
    catalog: new Map(['prof-sensor', 'prof-gateway', 'prof-http'].map((pid) => [pid, DEMO_RPC_COMMANDS.map((c, i) => ({ ...c, commandId: `${pid}-cmd-${i}`, maskedParams: [] }))])),
    rpc: [],
    devices: [...DEVICES.map(toRecord), ...EXTRA_DEVICES].map((d) => ({ ...d, profileName: DEMO_PROFILES.find((p) => p.id === d.deviceProfileId)?.name ?? null })),
    credentials: new Map(),
    attributes: new Map(),
    alarms: ALARMS.map((a) => ({ ...a })),
    events: new Map(Object.entries(ALARM_EVENTS).map(([k, v]) => [k, [...v]])),
    audit: new Map(),
  };
  for (const d of store.devices) {
    store.credentials.set(d.deviceId, d.deviceId === 'dev-002'
      ? { type: 'MQTT_BASIC', username: 'gw-assembly', clientId: 'gw-assembly-01', createdAt: ago(60 * 86_400_000) }
      : d.deviceId === 'dev-006'
        ? { type: 'X509_CERTIFICATE', certFingerprint: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', certSubject: 'CN=weather-bridge', certExpiresAt: new Date(Date.now() + 200 * 86_400_000), createdAt: ago(165 * 86_400_000) }
        : { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000) });
    store.attributes.set(d.deviceId, seedAttributes(d));
    store.audit.set(d.deviceId, seedAudit(d));
  }
  let seq = 100;
  const audit = (deviceId: string, kind: string, metadata: Record<string, unknown> = {}) => {
    const list = store.audit.get(deviceId) ?? [];
    list.push({ id: `${deviceId}-a${++seq}`, at: new Date(), source: 'audit', kind, actor: ALEX, metadata });
    store.audit.set(deviceId, list);
  };
  const wait = () => new Promise<void>((r) => setTimeout(r, opts.latencyMs ?? 120));
  const device = (id: string) => {
    const d = store.devices.find((x) => x.deviceId === id);
    if (!d) throw new IotApiError('not_found', 'Device not found.');
    return d;
  };
  const alarmOf = (id: string) => {
    const a = store.alarms.find((x) => x.alarmId === id);
    if (!a) throw new IotApiError('not_found', 'Alarm not found.');
    return a;
  };
  const profileOf = (id: string) => {
    const p = store.profiles.find((x) => x.profileId === id);
    if (!p) throw new IotApiError('not_found', 'Device profile not found.');
    return p;
  };
  const usageOf = (id: string): DeviceProfileUsage => {
    const devices = store.devices.filter((d) => d.deviceProfileId === id).length;
    const rules = store.rules.get(id)?.length ?? 0;
    const commands = store.catalog.get(id)?.length ?? 0;
    return {
      devices,
      references: [
        ...(devices ? [{ moduleId: 'iot_device', count: devices, label: devices === 1 ? 'device' : 'devices' }] : []),
        ...(rules ? [{ moduleId: 'iot_alarm', count: rules, label: rules === 1 ? 'alarm rule' : 'alarm rules' }] : []),
        ...(commands ? [{ moduleId: 'iot_rpc', count: commands, label: commands === 1 ? 'RPC command' : 'RPC commands' }] : []),
      ],
    };
  };
  const refuseRule = (p: Pick<DeviceProfile, 'onlineRule' | 'transportType' | 'expectedIntervalS'>) => {
    if (onlineRuleBlock(p.onlineRule, p.transportType)) throw new IotApiError('validation', 'The chosen online rule cannot be used with this transport (online_rule_not_allowed).');
    if (p.onlineRule === 'UPLINK_WINDOW' && !p.expectedIntervalS) throw new IotApiError('validation', 'The recent-message online rule needs the expected message interval (expected_interval_required).');
  };
  const catalogOf = (profileId: string) => store.catalog.get(profileId) ?? [];
  const publishAlarm = (alarm: Alarm, transition: AlarmTransition) => live.publish('alarms', { deviceId: alarm.deviceId }, { alarm, transition } satisfies AlarmLiveEvent);
  const publishState = (d: DeviceRecord) => live.publish('deviceState', { deviceId: d.deviceId }, {
    deviceId: d.deviceId, online: d.online, lastActivityAt: d.lastActivityAt ?? null, lastConnectAt: d.lastConnectAt ?? null,
    lastDisconnectAt: d.lastDisconnectAt ?? null, reason: d.lastDisconnectReason ?? undefined,
  } satisfies DeviceStatePatch);
  const addEvent = (alarmId: string, e: Omit<AlarmEvent, 'eventId'>) => {
    const list = store.events.get(alarmId) ?? [];
    list.push({ ...e, eventId: `evt-${++seq}` });
    store.events.set(alarmId, list);
  };

  const publishRpc = (r: RpcRequest) => live.publish('rpc', { deviceId: r.deviceId }, { request: { ...r, params: undefined, response: undefined, hasResponse: r.response !== undefined } });
  function move(r: RpcRequest, status: RpcStatus, extra: Partial<RpcRequest> = {}) {
    if (r.status === 'SUCCESSFUL' || r.status === 'FAILED' || r.status === 'TIMEOUT' || r.status === 'EXPIRED' || r.status === 'CANCELLED') return;
    Object.assign(r, extra, { status });
    const now = new Date();
    if (status === 'SENT') r.sentAt = now;
    if (status === 'DELIVERED') r.deliveredAt = now;
    if (['SUCCESSFUL', 'FAILED', 'TIMEOUT', 'EXPIRED', 'CANCELLED'].includes(status)) r.completedAt = now;
    publishRpc(r);
  }
  /** The mock device: sent, delivered, then the answer (or nothing for `diag.slow`, which times out). */
  function deliver(r: RpcRequest) {
    setTimeout(() => move(r, 'SENT'), 300);
    setTimeout(() => {
      move(r, 'DELIVERED');
      if (r.oneway) { setTimeout(() => move(r, 'SUCCESSFUL'), 200); return; }
      if (r.method === 'diag.slow') { setTimeout(() => move(r, 'TIMEOUT'), r.timeoutMs ?? 5_000); return; }
      const response = r.method === 'sys.info' ? { model: 'RT-300', uptime_s: 86_400 * 4 + 512, fw: '24.10.1' }
        : r.method === 'sys.ping' ? { sent: 3, received: 3, avg_ms: 12.4 } : { ok: true };
      setTimeout(() => move(r, 'SUCCESSFUL', { response }), 400);
    }, 600);
  }

  function transition(ids: string[], action: 'acknowledge' | 'clear', note?: string): AlarmBulkResult[] {
    return ids.map((id) => {
      const a = store.alarms.find((x) => x.alarmId === id);
      if (!a) return { alarmId: id, ok: false, reason: 'not_found' };
      if (action === 'acknowledge' && a.status !== 'OPEN') return { alarmId: id, ok: false, reason: a.status === 'ACKNOWLEDGED' ? 'already_acknowledged' : 'not_active' };
      if (action === 'clear' && a.status === 'RESOLVED') return { alarmId: id, ok: false, reason: 'not_active' };
      if (action === 'acknowledge') { a.status = 'ACKNOWLEDGED'; a.acknowledgedAt = new Date(); } else { a.status = 'RESOLVED'; a.resolvedAt = new Date(); }
      addEvent(id, { kind: action === 'acknowledge' ? 'acknowledged' : 'resolved', by: 'Alex Müller', at: new Date(), note });
      if (a.deviceId) audit(a.deviceId, action === 'acknowledge' ? 'iot_alarm.alarm.acknowledged' : 'iot_alarm.alarm.cleared', { alarmId: id, alarmType: a.type });
      publishAlarm({ ...a }, action === 'acknowledge' ? 'acknowledged' : 'cleared');
      return { alarmId: id, ok: true };
    });
  }

  const assets = createDemoAssets(() => store.devices, wait, () => store.alarms);

  const adapter: DemoAdapter = {
    name: 'Demo, in memory',
    assets,
    telemetry: createDemoTelemetry(wait),
    async capabilities() {
      return {
        canCreateDevice: true, canEditDevice: true, canDeleteDevice: true, canViewCredentials: true, canReadAttributes: true,
        canWriteAttributes: true, canActivateDevice: true, canReleaseDevice: false, canReadAlarms: true, canAcknowledge: true,
        canClear: true, canComment: true, canSendRpc: true, canManageProfiles: true, canManageAlarmRules: true, canManageRpcCommands: true,
        canManageAssets: true, canPlaceDevices: true, canReadTelemetry: true,
      };
    },
    profiles: {
      transports: ['MQTT', 'HTTP', 'ANY', 'LORAWAN'],
      async options() { await wait(); return store.profiles.map((p) => ({ id: p.profileId, name: p.name })); },
      async list(q) {
        await wait();
        let rows = [...store.profiles].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
        if (q.search) rows = rows.filter((p) => p.name.toLowerCase().includes(q.search!.toLowerCase()));
        if (q.transportType) rows = rows.filter((p) => p.transportType === q.transportType);
        if (q.onlineRule) rows = rows.filter((p) => p.onlineRule === q.onlineRule);
        rows = sortRows(rows, q.sort, { name: (p) => p.name, transport: (p) => p.transportType, online: (p) => p.onlineRule, updated: (p) => time(p.updatedAt) });
        return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((p) => structuredClone(p)), total: rows.length };
      },
      async get(id) { await wait(); return structuredClone(profileOf(id)); },
      async create(input) {
        await wait();
        if (store.profiles.some((p) => p.name === input.name)) throw new IotApiError('conflict', 'A device profile with this name already exists.', { fieldErrors: { name: 'This name is taken.' } });
        const blank = blankFields();
        const p: DeviceProfile = { ...blank, ...input, rateLimits: { ...blank.rateLimits, ...input.rateLimits }, profileId: `prof-n${++seq}`, isDefault: false, template: null, schemaSource: null, createdAt: new Date(), updatedAt: new Date() } as DeviceProfile;
        refuseRule(p);
        store.profiles.push(p);
        return structuredClone(p);
      },
      async update(id, patch) {
        await wait();
        const p = profileOf(id);
        const next = { ...p, ...patch, rateLimits: { ...p.rateLimits, ...patch.rateLimits } } as DeviceProfile;
        refuseRule(next);
        if (patch.name && store.profiles.some((x) => x.profileId !== id && x.name === patch.name)) throw new IotApiError('conflict', 'A device profile with this name already exists.', { fieldErrors: { name: 'This name is taken.' } });
        Object.assign(p, next, { updatedAt: new Date() });
        return structuredClone(p);
      },
      async remove(id) {
        await wait();
        const p = profileOf(id);
        if (p.isDefault) throw new IotApiError('conflict', 'The default device profile cannot be deleted. Make another profile the default first.');
        const hit = usageOf(id).references[0];
        if (hit) throw new IotApiError('conflict', `The device profile is still in use by ${hit.count} ${hit.label} (${hit.moduleId}).`);
        store.profiles = store.profiles.filter((x) => x.profileId !== id);
      },
      async setDefault(id) {
        await wait();
        const p = profileOf(id);
        for (const x of store.profiles) x.isDefault = x.profileId === id;
        return structuredClone(p);
      },
      async usage(ids) {
        await wait();
        return Object.fromEntries(ids.filter((id) => store.profiles.some((p) => p.profileId === id)).map((id) => [id, usageOf(id)]));
      },
      async keyUsage(id, keys) {
        await wait();
        const using = (store.rules.get(id) ?? []).filter((r) => alarmRuleKeys(r).some((k) => keys.includes(k)));
        const read = [...new Set(using.flatMap((r) => alarmRuleKeys(r)).filter((k) => keys.includes(k)))];
        return using.length ? [{ moduleId: 'alarm rules', label: 'alarm rules', count: using.length, keys: read, canRename: true }] : [];
      },
      async renameKeys(id, renames) {
        await wait();
        const rules = store.rules.get(id) ?? [];
        let changed = 0;
        for (const r of rules) {
          if (isInactivityRule(r)) continue;
          const leaves = [...r.severities.flatMap((x) => conditionLeaves(x.condition)), ...(r.clear ? conditionLeaves(r.clear) : [])];
          const hit = leaves.filter((l) => l.key in renames);
          for (const l of hit) l.key = renames[l.key];
          if (hit.length) changed++;
        }
        return changed ? [{ moduleId: 'alarm rules', label: 'alarm rules', count: changed, keys: Object.values(renames), canRename: true }] : [];
      },
    },
    alarmRules: {
      async list(profileId) { await wait(); profileOf(profileId); return (store.rules.get(profileId) ?? []).map((definition, i) => ({ ruleId: `${profileId}-rule-${i}`, version: 1, definition: structuredClone(definition) })); },
      async replace(profileId, rules) {
        await wait();
        profileOf(profileId);
        if (new Set(rules.map((r) => r.type)).size !== rules.length) throw new IotApiError('validation', 'Each alarm type at most once in a profile.');
        store.rules.set(profileId, structuredClone(rules));
        return rules.map((definition, i) => ({ ruleId: `${profileId}-rule-${i}`, version: 1, definition: structuredClone(definition) }));
      },
    },
    rpcCatalog: {
      templates: [{
        id: 'scada.set_value', label: 'Set a value (board controls)',
        command: {
          method: 'scada.set_value', label: 'Set a value', tier: 'basic', highImpact: false, oneway: false,
          // the value is not required: a switch sends false (as in next-boilerplate's seeded catalogs)
          paramsSchema: { key: { label: 'Key', type: 'text', required: true }, value: { label: 'Value', type: 'json' } },
        },
      }],
      async list(profileId) { await wait(); const p = profileOf(profileId); return { commands: structuredClone(catalogOf(profileId)), supported: p.topicSchemes.includes('ROLTEK') }; },
      async create(profileId, input) {
        await wait();
        profileOf(profileId);
        if (isRefusedRpcMethod(input.method)) throw new IotApiError('validation', 'A factory reset is never a command.');
        if (catalogOf(profileId).some((c) => c.method === input.method)) throw new IotApiError('conflict', 'This method is already in the catalog.', { fieldErrors: { method: 'Already in the catalog.' } });
        const c: RpcCatalogCommand = { ...input, commandId: `${profileId}-cmd-${++seq}` };
        store.catalog.set(profileId, [...catalogOf(profileId), c]);
        return structuredClone(c);
      },
      async update(profileId, commandId, patch) {
        await wait();
        const c = catalogOf(profileId).find((x) => x.commandId === commandId);
        if (!c) throw new IotApiError('not_found', 'Command not found.');
        Object.assign(c, patch);
        return structuredClone(c);
      },
      async remove(profileId, commandId) { await wait(); store.catalog.set(profileId, catalogOf(profileId).filter((c) => c.commandId !== commandId)); },
      async exportAll(profileId) {
        await wait();
        return catalogOf(profileId).map(({ commandId: _id, sendable: _s, updatedAt: _u, ...rest }): RpcCommandInput => rest);
      },
      async importAll(profileId, commands) {
        await wait();
        if (commands.some((c) => isRefusedRpcMethod(c.method))) throw new IotApiError('validation', 'A factory reset is never a command.');
        store.catalog.set(profileId, commands.map((c, i) => ({ ...c, commandId: `${profileId}-imp-${++seq}-${i}` })));
        return structuredClone(catalogOf(profileId));
      },
    },
    devices: {
      async list(q) {
        await wait();
        let rows = store.devices;
        if (q.search) rows = rows.filter((d) => d.name.toLowerCase().includes(q.search!.toLowerCase()));
        if (q.profileId) rows = rows.filter((d) => d.deviceProfileId === q.profileId);
        if (q.status) rows = rows.filter((d) => d.status === q.status);
        if (q.gateway !== undefined) rows = rows.filter((d) => d.isGateway === q.gateway);
        if (q.online) rows = rows.filter((d) => (q.online === 'last_seen' ? d.online === null : d.online === (q.online === 'online')));
        rows = sortRows(rows, q.sort, { name: (d) => d.name, connection: (d) => (d.online === null || d.online === undefined ? null : Number(d.online)), lastSeen: (d) => time(d.lastActivityAt) });
        return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((d) => ({ ...d })), total: rows.length };
      },
      async get(id) { await wait(); return { ...device(id) }; },
      async create(input) {
        await wait();
        if (store.devices.some((d) => d.name === input.name)) throw new IotApiError('conflict', 'A device with this name exists.', { fieldErrors: { name: 'This name is taken.' } });
        const d: DeviceRecord = {
          deviceId: `dev-n${++seq}`, name: input.name, label: input.label ?? null, deviceProfileId: input.profileId ?? 'prof-sensor',
          profileName: DEMO_PROFILES.find((p) => p.id === (input.profileId ?? 'prof-sensor'))?.name ?? null, status: 'ACTIVE',
          isGateway: !!input.isGateway, online: false, createdAt: new Date(),
        };
        store.devices = [d, ...store.devices];
        const credential: DeviceCredential = { type: 'ACCESS_TOKEN', createdAt: new Date() };
        store.credentials.set(d.deviceId, credential);
        store.attributes.set(d.deviceId, { SERVER: [], SHARED: [], CLIENT: [] });
        audit(d.deviceId, 'iot_device.device.created', { credentialType: 'ACCESS_TOKEN' });
        return { device: { ...d }, credential, secret: { token: randomSecret() } };
      },
      async remove(id) {
        await wait();
        device(id);
        // NB iot_asset's reference check: a placed device is not deleted until it is unplaced
        if (assets.placementOf(id)) throw new IotApiError('conflict', 'The device is still referenced by 1 asset placement or relation (iot_asset).');
        store.devices = store.devices.filter((d) => d.deviceId !== id);
      },
      async activate(ids) {
        await wait();
        let n = 0;
        for (const id of ids.slice(0, 100)) {
          const d = store.devices.find((x) => x.deviceId === id);
          if (d && d.status === 'QUARANTINED') { d.status = 'ACTIVE'; n++; publishState(d); audit(d.deviceId, 'iot_device.device.activated', { from: 'QUARANTINED', to: 'ACTIVE' }); }
        }
        return { activated: n };
      },
      async connections(id, q) {
        await wait();
        const all = seedConnections(device(id));
        return { items: all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: all.length };
      },
      async log(id, q) {
        await wait();
        const d = device(id);
        const connections: DeviceLogEntry[] = seedConnections(d).map((e) => ({ ...e, source: 'connection' as const }));
        const rows = [...(q.source === 'audit' ? [] : connections), ...(q.source === 'connection' ? [] : (store.audit.get(id) ?? []))]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((e) => ({ ...e })), total: rows.length };
      },
      async quarantinedCount() { return store.devices.filter((d) => d.status === 'QUARANTINED').length; },
      parseState(p) { return p && typeof p === 'object' && 'deviceId' in p ? (p as DeviceStatePatch) : null; },
    },
    credentials: {
      async get(id) { await wait(); device(id); return store.credentials.get(id) ?? null; },
      async connection(id) {
        await wait();
        const d = device(id);
        const keys = store.profiles.find((p) => p.profileId === d.deviceProfileId)?.telemetrySchema ?? [];
        return { mqtt: { host: 'mqtt.example.com', port: 8883, tls: true }, httpBase: 'https://demo.example.com', telemetryKeys: keys.map((k) => ({ key: k.key, type: k.type })) };
      },
      async rotate(id) {
        await wait();
        const cur = store.credentials.get(id);
        if (!cur) throw new IotApiError('not_found', 'No active credential.');
        const next = { ...cur, rotatedAt: new Date() };
        store.credentials.set(id, next);
        audit(id, 'iot_device.credential.rotated', { credentialType: cur.type });
        const secret: IssuedSecret = cur.type === 'MQTT_BASIC' ? { password: randomSecret(24) } : { token: randomSecret() };
        return { credential: next, secret };
      },
    },
    attributes: {
      async list(id, scope) { await wait(); device(id); return [...(store.attributes.get(id)?.[scope] ?? [])]; },
      async save(id, scope, values) {
        await wait();
        const all = store.attributes.get(id)!;
        for (const [key, value] of Object.entries(values)) {
          const list = all[scope];
          const i = list.findIndex((e) => e.key === key);
          const entry: AttributeEntry = { key, value, updatedAt: Date.now(), ...(scope === 'SHARED' ? { sync: 'pending' as const } : {}) };
          if (i >= 0) list[i] = { ...list[i], ...entry }; else list.push(entry);
        }
        audit(id, 'iot_device.attributes.saved', { scope, keys: Object.keys(values).sort() });
      },
      async remove(id, scope, keys) {
        await wait();
        const all = store.attributes.get(id)!;
        all[scope] = all[scope].filter((e) => !keys.includes(e.key));
        audit(id, 'iot_device.attributes.deleted', { scope, keys: [...keys].sort() });
      },
    },
    alarms: {
      async list(q) {
        await wait();
        let rows = [...store.alarms];
        const status = q.status ?? 'active';
        if (status === 'active') rows = rows.filter((a) => a.status !== 'RESOLVED');
        else if (status !== 'any') rows = rows.filter((a) => a.status === status);
        if (q.severity?.length) rows = rows.filter((a) => q.severity!.includes(a.severity));
        if (q.deviceId) rows = rows.filter((a) => a.deviceId === q.deviceId);
        if (q.search) rows = rows.filter((a) => a.title.toLowerCase().includes(q.search!.toLowerCase()));
        if (q.from) rows = rows.filter((a) => new Date(a.openedAt).getTime() >= new Date(q.from!).getTime());
        rows.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        rows = sortRows(rows, q.sort, {
          severity: (a) => ALARM_SEVERITIES.length - ALARM_SEVERITIES.indexOf(a.severity), title: (a) => a.title, device: (a) => a.deviceName,
          status: (a) => STATUS_RANK[a.status], opened: (a) => time(a.openedAt),
        });
        return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((a) => ({ ...a })), total: rows.length };
      },
      async get(id) { await wait(); return { ...alarmOf(id) }; },
      async events(id) { await wait(); alarmOf(id); return [...(store.events.get(id) ?? [])]; },
      async acknowledge(ids, note) { await wait(); return transition(ids, 'acknowledge', note); },
      async clear(ids, note) { await wait(); return transition(ids, 'clear', note); },
      async comment(id, text) { await wait(); alarmOf(id); addEvent(id, { kind: 'note', by: 'Alex Müller', at: new Date(), note: text }); },
      async counts(scope) {
        const rows = store.alarms.filter((a) => a.status !== 'RESOLVED' && (!scope?.deviceId || a.deviceId === scope.deviceId));
        const bySeverity = Object.fromEntries(ALARM_SEVERITIES.map((s) => [s, rows.filter((a) => a.severity === s).length])) as AlarmCounts['bySeverity'];
        return { open: rows.filter((a) => a.status === 'OPEN').length, acknowledged: rows.filter((a) => a.status === 'ACKNOWLEDGED').length, bySeverity };
      },
      parseLive(p) {
        return p && typeof p === 'object' && 'alarm' in p && 'transition' in p ? (p as AlarmLiveEvent) : null;
      },
    },
    rpc: {
      async methods(deviceId) {
        await wait();
        const d = device(deviceId);
        const p = store.profiles.find((x) => x.profileId === d.deviceProfileId);
        if (p && !p.topicSchemes.includes('ROLTEK')) return { commands: [], canSendRaw: false, supported: false };
        return { commands: catalogOf(d.deviceProfileId).map((c) => ({ ...c, sendable: true })), canSendRaw: true, supported: true };
      },
      async send(deviceId, input) {
        await wait();
        const d = device(deviceId);
        if (d.deviceProfileId === 'prof-tb') throw new IotApiError('conflict', 'RPC is not available for this device.');
        const cmd: RpcCommand | undefined = catalogOf(d.deviceProfileId).find((c) => c.method === input.method);
        if (cmd?.highImpact && input.confirm !== true) throw new IotApiError('validation', 'This command needs a confirmation.');
        if (cmd?.confirmText && input.confirmText !== cmd.confirmText) throw new IotApiError('validation', 'The typed confirmation does not match.');
        const r: RpcRequest = {
          rpcId: `rpc-${++seq}`, deviceId, deviceName: d.name, method: input.method, params: input.params ?? {}, oneway: input.oneway ?? cmd?.oneway ?? false,
          persistent: input.persistent ?? cmd?.persistentDefault ?? false, status: 'QUEUED', source: 'console', createdAt: new Date(),
          timeoutMs: input.timeoutMs ?? cmd?.defaultTimeoutMs ?? 10_000, highImpact: cmd?.highImpact ?? false,
        };
        store.rpc = [r, ...store.rpc];
        audit(deviceId, 'iot_rpc.request.created', { method: r.method, rpcId: r.rpcId });
        if (!d.online && !r.persistent) { move(r, 'FAILED', { error: 'device offline' }); return { ...r }; }
        if (d.online) deliver(r);
        return { ...r };
      },
      async list(q) {
        await wait();
        const rows = store.rpc.filter((r) => (!q.deviceId || r.deviceId === q.deviceId) && (!q.status || r.status === q.status) && (!q.method || r.method === q.method));
        const start = q.cursor ? Number(q.cursor) : 0;
        const page = rows.slice(start, start + q.limit);
        return { items: page.map((r) => ({ ...r })), nextCursor: start + q.limit < rows.length ? String(start + q.limit) : null };
      },
      async get(rpcId) {
        await wait();
        const r = store.rpc.find((x) => x.rpcId === rpcId);
        if (!r) throw new IotApiError('not_found', 'Command not found.');
        return { ...r };
      },
      async cancel(rpcId) {
        await wait();
        const r = store.rpc.find((x) => x.rpcId === rpcId);
        if (!r) throw new IotApiError('not_found', 'Command not found.');
        if (r.status !== 'QUEUED' && r.status !== 'SENT') throw new IotApiError('conflict', 'Only a queued or sent command can be cancelled.');
        move(r, 'CANCELLED');
        audit(r.deviceId, 'iot_rpc.request.cancelled', { method: r.method, rpcId: r.rpcId });
        return { ...r };
      },
      parseLive(p) { return p && typeof p === 'object' && 'request' in p ? (p as { request: RpcRequest }) : null; },
    },
    sim: {
      raise(deviceId) {
        const d = store.devices.find((x) => x.deviceId === deviceId);
        if (!d) return;
        const sev = ALARM_SEVERITIES[seq % ALARM_SEVERITIES.length];
        const a: Alarm = {
          alarmId: `alarm-sim-${++seq}`, type: 'sim_threshold', deviceId, deviceName: d.name, severity: sev, status: 'OPEN',
          title: `Simulated threshold on ${d.name}`, origin: { kind: 'profileRule', profileId: d.deviceProfileId, ruleId: 'rule-sim', ruleName: 'Simulated threshold' },
          openedAt: new Date(), occurrences: 1, flapping: false,
        };
        store.alarms = [a, ...store.alarms];
        addEvent(a.alarmId, { kind: 'opened', by: 'default flow', at: new Date() });
        publishAlarm({ ...a }, 'created');
      },
      clearOldest() {
        const a = [...store.alarms].reverse().find((x) => x.alarmId.startsWith('alarm-sim-') && x.status !== 'RESOLVED');
        if (!a) return;
        a.status = 'RESOLVED';
        a.resolvedAt = new Date();
        addEvent(a.alarmId, { kind: 'resolved', by: 'default flow', at: new Date(), note: 'The condition cleared.' });
        publishAlarm({ ...a }, 'cleared');
      },
      flip(deviceId) {
        const d = store.devices.find((x) => x.deviceId === deviceId);
        if (!d || d.online === null || d.status !== 'ACTIVE') return;
        d.online = !d.online;
        const now = new Date();
        if (d.online) d.lastConnectAt = now; else { d.lastDisconnectAt = now; d.lastDisconnectReason = 'keepalive_timeout'; }
        d.lastActivityAt = now;
        publishState(d);
        // a persistent command waits for its device: deliver what is queued once it is back
        if (d.online) for (const r of store.rpc) if (r.deviceId === d.deviceId && r.status === 'QUEUED') deliver(r);
      },
      deviceIds() { return store.devices.map((d) => d.deviceId); },
      telemetry(deviceId, i) { live.publish('telemetry', { deviceId }, demoLivePoint(deviceId, i)); },
    },
  };
  return adapter;
}

/** The protocol defaults a new demo profile starts from (the online rule comes from the create). */
function blankFields(): Omit<DeviceProfile, 'profileId' | 'isDefault' | 'onlineRule' | 'name'> {
  const { onlineRule: _r, name: _n, ...rest } = blankProfileDraft();
  return rest;
}

/** The slow simulation (00 §0.5): a device flips every 20 s, an alarm opens every 45 s and the oldest simulated one clears. */
export function startDemoSimulation(adapter: DemoAdapter): () => void {
  let i = 0;
  const flip = setInterval(() => {
    const ids = adapter.sim.deviceIds();
    adapter.sim.flip(ids[i++ % ids.length]);
  }, 20_000);
  const alarm = setInterval(() => {
    const ids = adapter.sim.deviceIds();
    adapter.sim.raise(ids[i % ids.length]);
    setTimeout(() => adapter.sim.clearOldest(), 60_000);
  }, 45_000);
  // every device sends one of its keys every 2 s, in turn
  let k = 0;
  const telemetry = setInterval(() => {
    for (const id of adapter.sim.deviceIds()) adapter.sim.telemetry(id, k);
    k++;
  }, 2_000);
  return () => { clearInterval(flip); clearInterval(alarm); clearInterval(telemetry); };
}
