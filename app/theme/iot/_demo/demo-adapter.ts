import { IotApiError, type IotAdapter, type AlarmLiveEvent, type AlarmTransition } from '@/modules/domains/iot/api/adapter';
import { ALARM_SEVERITIES, type Alarm, type AlarmBulkResult, type AlarmCounts, type AlarmEvent } from '@/modules/domains/iot/types/alarm';
import type {
  AttributeEntry, AttributeScope, DeviceConnectionEvent, DeviceCredential, DeviceRecord, DeviceStatePatch, IssuedSecret,
} from '@/modules/domains/iot/types/device';
import type { Device } from '@/modules/domains/iot/types';
import { ALARMS, ALARM_EVENTS, DEVICES } from '../iot.data';
import type { DemoLive } from './demo-live';

/*
 * The demo adapter (docs/concepts/iot-platform/phases/00 §0.5): an in-memory store seeded from `iot.data.ts` that implements
 * the device and alarm parts of `IotAdapter`, so `/theme/iot` runs the same views NB runs on its HTTP adapter. Changes last
 * for the page's life (no browser storage) and are published to the demo live source. A seeded quarantined device and a
 * "last seen only" device show OD-1 and OD-57; alarms cover the five OD-9 severities and every alarm has a timeline.
 */

export const DEMO_PROFILES = [
  { id: 'prof-sensor', name: 'Sensors (live connection)' },
  { id: 'prof-gateway', name: 'Gateways (live connection)' },
  { id: 'prof-lorawan', name: 'LoRaWAN meters (last seen only)' },
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
  devices: DeviceRecord[];
  credentials: Map<string, DeviceCredential | null>;
  attributes: Map<string, Record<AttributeScope, AttributeEntry[]>>;
  alarms: Alarm[];
  events: Map<string, AlarmEvent[]>;
};

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
  };
};

export function createDemoAdapter(live: DemoLive, opts: { latencyMs?: number } = {}): DemoAdapter {
  const store: Store = {
    devices: [...DEVICES.map(toRecord), ...EXTRA_DEVICES].map((d) => ({ ...d, profileName: DEMO_PROFILES.find((p) => p.id === d.deviceProfileId)?.name ?? null })),
    credentials: new Map(),
    attributes: new Map(),
    alarms: ALARMS.map((a) => ({ ...a })),
    events: new Map(Object.entries(ALARM_EVENTS).map(([k, v]) => [k, [...v]])),
  };
  for (const d of store.devices) {
    store.credentials.set(d.deviceId, d.deviceId === 'dev-002'
      ? { type: 'MQTT_BASIC', username: 'gw-assembly', clientId: 'gw-assembly-01', createdAt: ago(60 * 86_400_000) }
      : d.deviceId === 'dev-006'
        ? { type: 'X509_CERTIFICATE', certFingerprint: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', certSubject: 'CN=weather-bridge', certExpiresAt: new Date(Date.now() + 200 * 86_400_000), createdAt: ago(165 * 86_400_000) }
        : { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000) });
    store.attributes.set(d.deviceId, seedAttributes(d));
  }
  let seq = 100;
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

  function transition(ids: string[], action: 'acknowledge' | 'clear', note?: string): AlarmBulkResult[] {
    return ids.map((id) => {
      const a = store.alarms.find((x) => x.alarmId === id);
      if (!a) return { alarmId: id, ok: false, reason: 'not_found' };
      if (action === 'acknowledge' && a.status !== 'OPEN') return { alarmId: id, ok: false, reason: a.status === 'ACKNOWLEDGED' ? 'already_acknowledged' : 'not_active' };
      if (action === 'clear' && a.status === 'RESOLVED') return { alarmId: id, ok: false, reason: 'not_active' };
      if (action === 'acknowledge') { a.status = 'ACKNOWLEDGED'; a.acknowledgedAt = new Date(); } else { a.status = 'RESOLVED'; a.resolvedAt = new Date(); }
      addEvent(id, { kind: action === 'acknowledge' ? 'acknowledged' : 'resolved', by: 'Alex Müller', at: new Date(), note });
      publishAlarm({ ...a }, action === 'acknowledge' ? 'acknowledged' : 'cleared');
      return { alarmId: id, ok: true };
    });
  }

  const adapter: DemoAdapter = {
    name: 'Demo, in memory',
    async capabilities() {
      return {
        canCreateDevice: true, canEditDevice: true, canDeleteDevice: true, canViewCredentials: true, canReadAttributes: true,
        canWriteAttributes: true, canActivateDevice: true, canReleaseDevice: false, canReadAlarms: true, canAcknowledge: true,
        canClear: true, canComment: true,
      };
    },
    profiles: { async options() { await wait(); return DEMO_PROFILES; } },
    devices: {
      async list(q) {
        await wait();
        let rows = store.devices;
        if (q.search) rows = rows.filter((d) => d.name.toLowerCase().includes(q.search!.toLowerCase()));
        if (q.profileId) rows = rows.filter((d) => d.deviceProfileId === q.profileId);
        if (q.status) rows = rows.filter((d) => d.status === q.status);
        if (q.gateway !== undefined) rows = rows.filter((d) => d.isGateway === q.gateway);
        if (q.online) rows = rows.filter((d) => (q.online === 'last_seen' ? d.online === null : d.online === (q.online === 'online')));
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
        return { device: { ...d }, credential, secret: { token: randomSecret() } };
      },
      async remove(id) { await wait(); device(id); store.devices = store.devices.filter((d) => d.deviceId !== id); },
      async activate(ids) {
        await wait();
        let n = 0;
        for (const id of ids.slice(0, 100)) {
          const d = store.devices.find((x) => x.deviceId === id);
          if (d && d.status === 'QUARANTINED') { d.status = 'ACTIVE'; n++; publishState(d); }
        }
        return { activated: n };
      },
      async connections(id, q) {
        await wait();
        const all = seedConnections(device(id));
        return { items: all.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: all.length };
      },
      async quarantinedCount() { return store.devices.filter((d) => d.status === 'QUARANTINED').length; },
      parseState(p) { return p && typeof p === 'object' && 'deviceId' in p ? (p as DeviceStatePatch) : null; },
    },
    credentials: {
      async get(id) { await wait(); device(id); return store.credentials.get(id) ?? null; },
      async rotate(id) {
        await wait();
        const cur = store.credentials.get(id);
        if (!cur) throw new IotApiError('not_found', 'No active credential.');
        const next = { ...cur, rotatedAt: new Date() };
        store.credentials.set(id, next);
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
      },
      async remove(id, scope, keys) {
        await wait();
        const all = store.attributes.get(id)!;
        all[scope] = all[scope].filter((e) => !keys.includes(e.key));
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
      },
      deviceIds() { return store.devices.map((d) => d.deviceId); },
    },
  };
  return adapter;
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
  return () => { clearInterval(flip); clearInterval(alarm); };
}
