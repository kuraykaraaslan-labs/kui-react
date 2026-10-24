'use client';
// Showcase entries for the IoT platform screens (docs/concepts/iot-platform/phases/00, 01, 03, 07): the alarm components
// (renamed from Alert*, OD-9), the device components, the two dashboard table bodies and the adapter-driven views, which run
// here on a small fixture adapter. All times are offsets from a fixed instant, so screenshots do not drift.

import { useState } from 'react';
import type { ShowcaseComponent } from '../showcase.types';
import { Button } from '@/modules/ui/Button';
import { AlarmSeverityBadge } from '@/modules/domains/iot/alarm/AlarmSeverityBadge';
import { AlarmStatusPill } from '@/modules/domains/iot/alarm/AlarmStatusPill';
import { AlarmDetailHeader } from '@/modules/domains/iot/alarm/AlarmDetailHeader';
import { AlarmEventTimeline } from '@/modules/domains/iot/alarm/AlarmEventTimeline';
import { AlarmTable, type AlarmTableRow } from '@/modules/domains/iot/alarm/AlarmTable';
import { AlarmListView } from '@/modules/domains/iot/alarm/AlarmListView';
import { AlarmDetailView } from '@/modules/domains/iot/alarm/AlarmDetailView';
import { AlarmBellMenu } from '@/modules/domains/iot/alarm/AlarmBellMenu';
import { DeviceOnlineDot } from '@/modules/domains/iot/device/DeviceOnlineDot';
import { DeviceConnectionBadge } from '@/modules/domains/iot/device/DeviceConnectionBadge';
import { DeviceDetailHeader } from '@/modules/domains/iot/device/DeviceDetailHeader';
import { DeviceCredentialPanel } from '@/modules/domains/iot/device/DeviceCredentialPanel';
import { DeviceAttributeTable } from '@/modules/domains/iot/device/DeviceAttributeTable';
import { DesiredReportedBadge } from '@/modules/domains/iot/device/DesiredReportedBadge';
import { DeviceConnectionTimeline } from '@/modules/domains/iot/device/DeviceConnectionTimeline';
import { DeviceTable, type DeviceTableRow } from '@/modules/domains/iot/device/DeviceTable';
import { DeviceListView } from '@/modules/domains/iot/device/DeviceListView';
import { DeviceDetailView } from '@/modules/domains/iot/device/DeviceDetailView';
import { NewDeviceDrawer } from '@/modules/domains/iot/device/NewDeviceDrawer';
import { IotAdapterProvider } from '@/modules/domains/iot/api/IotAdapterProvider';
import { IotApiError, type IotAdapter } from '@/modules/domains/iot/api/adapter';
import type { Alarm, AlarmEvent } from '@/modules/domains/iot/types/alarm';
import type { AttributeEntry, DeviceConnectionEvent, DeviceRecord } from '@/modules/domains/iot/types/device';

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;
const wait = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

/** One place builds the entry, so the registry's `sourceCode` is a usage snippet written next to the variants. */
function entry(def: Omit<ShowcaseComponent, 'sourceCode' | 'category' | 'since'> & { usage: string }): ShowcaseComponent {
  const { usage, ...rest } = def;
  const out = { ...rest, category: 'Domain', since: '2026-10', status: 'beta' } as ShowcaseComponent;
  out.sourceCode = usage;
  return out;
}

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const DEVICES: DeviceRecord[] = [
  { deviceId: 'd1', name: 'Pump 4', label: 'Hall 2, line A', serial: 'RT-24-000412', deviceProfileId: 'p1', profileName: 'Pumps', status: 'ACTIVE', isGateway: false, fwTitle: 'roltek-esp32', fwVersion: '1.8.2', protocolMajor: 1, online: true, lastActivityAt: ago(40_000), lastConnectAt: ago(3 * 3_600_000) },
  { deviceId: 'd2', name: 'Edge gateway 1', label: 'Hall 2 cabinet', serial: 'RT-24-000007', deviceProfileId: 'p2', profileName: 'Gateways', status: 'ACTIVE', isGateway: true, fwTitle: 'roltek-openwrt', fwVersion: '24.10.1', protocolMajor: 1, online: false, lastActivityAt: ago(52 * MIN), lastDisconnectAt: ago(50 * MIN), lastDisconnectReason: 'keepalive_timeout' },
  { deviceId: 'd3', name: 'Cold room probe 12', label: null, serial: 'RT-24-000912', deviceProfileId: 'p1', profileName: 'Pumps', status: 'QUARANTINED', isGateway: false, online: true, lastActivityAt: ago(2 * MIN) },
  { deviceId: 'd4', name: 'Water meter 3B', label: 'Basement', serial: null, deviceProfileId: 'p3', profileName: 'LoRaWAN meters', status: 'ACTIVE', isGateway: false, online: null, lastActivityAt: ago(3 * 3_600_000) },
];

const ALARMS: Alarm[] = [
  { alarmId: 'a1', type: 'high_temperature', severity: 'CRITICAL', status: 'OPEN', title: 'Bearing temperature above 90 °C', message: 'Reading 94.2 °C for 3 minutes.', deviceId: 'd1', deviceName: 'Pump 4', openedAt: ago(12 * MIN), occurrences: 7, flapping: false, origin: { kind: 'profileRule', profileId: 'p1', ruleId: 'r1', ruleName: 'Bearing > 90 °C' }, runbook: 'Stop the pump from the HMI, check the lubrication, restart at half speed.' },
  { alarmId: 'a2', type: 'device_offline', severity: 'MAJOR', status: 'ACKNOWLEDGED', title: 'Gateway offline', deviceId: 'd2', deviceName: 'Edge gateway 1', openedAt: ago(50 * MIN), acknowledgedAt: ago(30 * MIN), occurrences: 1, flapping: false, origin: { kind: 'profileRule', profileId: 'p2', ruleId: 'r2', ruleName: 'Inactivity' } },
  { alarmId: 'a3', type: 'pressure_low', severity: 'MINOR', status: 'OPEN', title: 'Inlet pressure low', deviceId: 'd1', deviceName: 'Pump 4', topic: 'sensors/hall-2/inlet', openedAt: ago(3 * 3_600_000), occurrences: 2, flapping: true, origin: { kind: 'flow', flowId: 'f1', nodeId: 'n7', flowName: 'Hall 2', nodeName: 'Pressure alarm' } },
  { alarmId: 'a4', type: 'battery', severity: 'WARNING', status: 'OPEN', title: 'Battery below 20 %', deviceId: 'd4', deviceName: 'Water meter 3B', openedAt: ago(6 * 3_600_000), occurrences: 1, flapping: false },
  { alarmId: 'a5', type: 'door', severity: 'INFO', status: 'RESOLVED', title: 'Cabinet door opened', deviceId: 'd2', deviceName: 'Edge gateway 1', openedAt: ago(26 * 3_600_000), resolvedAt: ago(25 * 3_600_000), occurrences: 1, flapping: false },
];

const EVENTS: AlarmEvent[] = [
  { eventId: 'e1', kind: 'opened', by: 'default flow', at: ago(12 * MIN) },
  { eventId: 'e2', kind: 'notified', by: 'platform', at: ago(12 * MIN - 4_000) },
  { eventId: 'e3', kind: 'severity_changed', from: 'MAJOR', to: 'CRITICAL', by: 'default flow', at: ago(9 * MIN) },
  { eventId: 'e4', kind: 'note', by: 'Ayşe K.', at: ago(5 * MIN), note: 'On my way to hall 2.' },
];

const ATTRIBUTES: Record<'SERVER' | 'SHARED' | 'CLIENT', AttributeEntry[]> = {
  SERVER: [{ key: 'site', value: 'Hall 2', updatedAt: ago(86_400_000) }, { key: 'service', value: { contract: 'gold', until: '2027-01-01' }, updatedAt: ago(86_400_000) }],
  SHARED: [
    { key: 'cfg.report_interval_s', value: 30, updatedAt: ago(3_600_000), sync: 'in_sync' },
    { key: 'cfg.speed_rpm', value: 1450, updatedAt: ago(MIN), sync: 'pending' },
    { key: 'cfg.led', value: 'blink', updatedAt: ago(3_600_000), sync: 'rejected', syncReason: 'value_out_of_range' },
    { key: 'cfg.wifi.psk', value: null, secret: true, updatedAt: ago(3_600_000), sync: 'in_sync' },
  ],
  CLIENT: [{ key: 'fw_version', value: '1.8.2', updatedAt: ago(3 * 3_600_000) }, { key: 'cfg.report_interval_s', value: 30, updatedAt: ago(3_600_000) }],
};

const CONNECTIONS: DeviceConnectionEvent[] = [
  { id: 'c1', at: ago(50 * MIN), kind: 'disconnected', reason: 'keepalive_timeout', transport: 'mqtts', remoteIp: '203.0.113.7' },
  { id: 'c2', at: ago(3 * 3_600_000), kind: 'connected', transport: 'mqtts', remoteIp: '203.0.113.7' },
  { id: 'c3', at: ago(3 * 3_600_000 + MIN), kind: 'taken_over', detail: 'session s-81f2' },
];

const TABLE_ALARMS: AlarmTableRow[] = ALARMS.map((a) => ({
  id: a.alarmId, severity: a.severity, status: a.status, title: a.title, originator: a.deviceName, deviceId: a.deviceId, openedAt: a.openedAt,
  occurrences: a.occurrences, flapping: a.flapping,
}));
const TABLE_DEVICES: DeviceTableRow[] = DEVICES.map((d) => ({
  id: d.deviceId, name: d.name, label: d.label, profile: d.profileName, status: d.status, online: d.online, lastSeenAt: d.lastActivityAt,
  values: { temperature: 61.37, pressure: 2.4 },
}));

function fixtureAdapter(fail = false): IotAdapter {
  const failing = async () => { await wait(); throw new IotApiError('unavailable', 'The server did not answer.'); };
  const alarms = ALARMS.map((a) => ({ ...a }));
  return {
    name: 'Showcase fixtures',
    async capabilities() {
      return { canCreateDevice: true, canDeleteDevice: true, canViewCredentials: true, canReadAttributes: true, canWriteAttributes: true, canActivateDevice: true, canReadAlarms: true, canAcknowledge: true, canClear: true, canComment: true };
    },
    profiles: { async options() { return [{ id: 'p1', name: 'Pumps' }, { id: 'p2', name: 'Gateways' }, { id: 'p3', name: 'LoRaWAN meters' }]; } },
    devices: {
      list: fail ? failing : async (q) => { await wait(); return { items: DEVICES.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: DEVICES.length }; },
      get: fail ? failing : async (id) => { await wait(); const d = DEVICES.find((x) => x.deviceId === id); if (!d) throw new IotApiError('not_found', 'Device not found.'); return d; },
      async create(input) { await wait(); return { device: { ...DEVICES[0], deviceId: 'new', name: input.name }, credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'Xq7Lr2VbN8tKc4Mp9WzH3sJd6Fy1Ag5E' } }; },
      async activate(ids) { await wait(); return { activated: ids.length }; },
      async connections() { await wait(); return { items: CONNECTIONS, total: CONNECTIONS.length }; },
      async quarantinedCount() { return 1; },
    },
    credentials: {
      async get() { return { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000) }; },
      async rotate() { await wait(); return { credential: { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000), rotatedAt: new Date(NOW) }, secret: { token: 'Nm4Qa8Zr2Wt6Ys1Pk9Hd3Lc7Vb5Xe0Gj' } }; },
    },
    attributes: { async list(_id, scope) { await wait(); return ATTRIBUTES[scope]; }, async save() { await wait(); }, async remove() { await wait(); } },
    alarms: {
      list: fail ? failing : async (q) => {
        await wait();
        const rows = alarms.filter((a) => (q.status ?? 'active') === 'any' || (q.status === 'active' || !q.status ? a.status !== 'RESOLVED' : a.status === q.status))
          .filter((a) => !q.deviceId || a.deviceId === q.deviceId);
        return { items: rows, total: rows.length };
      },
      get: fail ? failing : async (id) => { await wait(); const a = alarms.find((x) => x.alarmId === id); if (!a) throw new IotApiError('not_found', 'Alarm not found.'); return { ...a }; },
      async events() { return EVENTS; },
      async acknowledge(ids) { await wait(800); return ids.map((alarmId) => ({ alarmId, ok: true })); },
      async clear(ids) { await wait(800); return ids.map((alarmId) => ({ alarmId, ok: true })); },
      async comment() { await wait(); },
      async counts() { return { open: 3, acknowledged: 1, bySeverity: { CRITICAL: 1, MAJOR: 1, MINOR: 1, WARNING: 1, INFO: 0 } }; },
    },
  };
}

function Fixture({ fail = false, children }: { fail?: boolean; children: React.ReactNode }) {
  const [adapter] = useState(() => fixtureAdapter(fail));
  return <IotAdapterProvider adapter={adapter} locale="en-GB">{children}</IotAdapterProvider>;
}

function NewDeviceDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New device</Button>
      {open && <NewDeviceDrawer open profiles={[{ id: 'p1', name: 'Pumps' }]} deviceHref={(id) => `#device-${id}`} onClose={() => setOpen(false)} />}
    </Fixture>
  );
}

const hrefs = { device: (id: string) => `#device-${id}`, alarm: (id: string) => `#alarm-${id}`, alarms: '#alarms' };

// ── entries ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function buildIoTPlatformEntries(): ShowcaseComponent[] {
  return [
    entry({
      id: 'iot-alarm-severity-badge',
      title: 'AlarmSeverityBadge',
      abbr: 'AS',
      description: 'The five alarm severities of OD-9 (Critical, Major, Minor, Warning, Info), each with its own icon and tone from alarm-severity.ts. Renamed from AlertSeverityBadge (OD-9).',
      filePath: 'modules/domains/iot/alarm/AlarmSeverityBadge.tsx',
      usage: `import { AlarmSeverityBadge } from '@/modules/domains/iot';\n<AlarmSeverityBadge severity="CRITICAL" />`,
      variants: [
        { title: 'All five levels', layout: 'side', preview: <div className="flex flex-wrap gap-2">{(['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'] as const).map((s) => <AlarmSeverityBadge key={s} severity={s} />)}</div>, code: '<AlarmSeverityBadge severity="MAJOR" />' },
        { title: 'Small and icon only', layout: 'side', preview: <div className="flex flex-wrap gap-2"><AlarmSeverityBadge severity="MINOR" size="sm" /><AlarmSeverityBadge severity="CRITICAL" iconOnly /></div>, code: '<AlarmSeverityBadge severity="CRITICAL" iconOnly />' },
      ],
    }),
    entry({
      id: 'iot-alarm-status-pill',
      title: 'AlarmStatusPill',
      abbr: 'AP',
      description: 'An alarm status (Open, Acknowledged, Resolved) as a pill.',
      filePath: 'modules/domains/iot/alarm/AlarmStatusPill.tsx',
      usage: `<AlarmStatusPill status="ACKNOWLEDGED" />`,
      variants: [
        { title: 'Statuses', layout: 'side', preview: <div className="flex gap-2"><AlarmStatusPill status="OPEN" /><AlarmStatusPill status="ACKNOWLEDGED" /><AlarmStatusPill status="RESOLVED" /></div>, code: '<AlarmStatusPill status="OPEN" />' },
        { title: 'Small, translated', layout: 'side', preview: <AlarmStatusPill status="OPEN" size="sm" labels={{ OPEN: 'Açık' }} />, code: `<AlarmStatusPill status="OPEN" size="sm" labels={{ OPEN: 'Açık' }} />` },
      ],
    }),
    entry({
      id: 'iot-alarm-detail-header',
      title: 'AlarmDetailHeader',
      abbr: 'AH',
      description: 'An alarm page header with real actions: acknowledge and clear return promises (pending state, every action disabled while one runs, result announced), each optionally with a note. Renamed from AlertDetailHeader (OD-9).',
      filePath: 'modules/domains/iot/alarm/AlarmDetailHeader.tsx',
      usage: `<AlarmDetailHeader title={a.title} severity={a.severity} status={a.status} deviceName={a.deviceName} openedAt={a.openedAt}\n  onAcknowledge={(note) => api.acknowledge([id], note)} onClear={(note) => api.clear([id], note)} onOpenRunbook={openRunbook} />`,
      variants: [
        { title: 'Open, with actions (pending for 1 s)', layout: 'stack', preview: <AlarmDetailHeader title="Bearing temperature above 90 °C" message="Reading 94.2 °C for 3 minutes." severity="CRITICAL" status="OPEN" deviceName="Pump 4" deviceHref="#" openedAt={ago(12 * MIN)} now={NOW} occurrences={7} type="high_temperature" onAcknowledge={() => wait(1000)} onClear={() => wait(1000)} onOpenRunbook={() => undefined} />, code: '<AlarmDetailHeader … onAcknowledge={ack} onClear={clear} />' },
        { title: 'Failing action, flapping with topic', layout: 'stack', preview: <AlarmDetailHeader title="Inlet pressure low" severity="MINOR" status="ACKNOWLEDGED" deviceName="Pump 4" openedAt={ago(3 * 3_600_000)} now={NOW} flapping topic="sensors/hall-2/inlet" onClear={async () => { await wait(600); throw new Error('The server refused'); }} />, code: '<AlarmDetailHeader status="ACKNOWLEDGED" flapping topic="sensors/hall-2/inlet" onClear={clear} />' },
      ],
    }),
    entry({
      id: 'iot-alarm-event-timeline',
      title: 'AlarmEventTimeline',
      abbr: 'AE',
      description: 'An alarm history on the generic Timeline: opened, severity changes, acknowledge and clear with notes, notifications, throttles, mutes, flapping; a note box with onAddNote. Renamed from AlertEventTimeline (OD-9).',
      filePath: 'modules/domains/iot/alarm/AlarmEventTimeline.tsx',
      usage: `<AlarmEventTimeline events={events} onAddNote={(text) => api.comment(id, text)} />`,
      variants: [
        { title: 'With a note box', layout: 'stack', preview: <AlarmEventTimeline events={EVENTS} locale="en-GB" onAddNote={() => wait()} />, code: '<AlarmEventTimeline events={events} onAddNote={addNote} />' },
        { title: 'Read only, empty', layout: 'stack', preview: <AlarmEventTimeline events={[]} />, code: '<AlarmEventTimeline events={[]} />' },
      ],
    }),
    entry({
      id: 'iot-alarm-table',
      title: 'AlarmTable',
      abbr: 'AR',
      description: 'The body of a dashboard alarm table (iot.alarm-table): the rows a host delivers, viewer-side severity chips (the five levels, no re-query), status pills, relative times, a row cap, keyboard row focus, an optional row action, and rows that fade out once resolved.',
      filePath: 'modules/domains/iot/alarm/AlarmTable.tsx',
      usage: `<AlarmTable rows={data.rows.rows} maxRows={settings.maxRows} onRowClick={onRowClick} rowAction={{ label: 'Acknowledge', onRun: ack }} />`,
      variants: [
        { title: 'Rows with chips and a row action', layout: 'stack', preview: <AlarmTable rows={TABLE_ALARMS} now={NOW} locale="en-GB" activeOnly={false} rowAction={{ label: 'Acknowledge', onRun: () => wait(), disabled: (r) => r.status !== 'OPEN' }} />, code: '<AlarmTable rows={rows} rowAction={…} />' },
        { title: 'Loading, error, empty', layout: 'stack', preview: <div className="flex flex-col gap-3"><AlarmTable rows={[]} loading /><AlarmTable rows={[]} error="The source did not answer." onRetry={() => undefined} showSeverityChips={false} /><AlarmTable rows={[]} showSeverityChips={false} /></div>, code: '<AlarmTable rows={[]} loading />' },
      ],
    }),
    entry({
      id: 'iot-alarm-list-view',
      title: 'AlarmListView',
      abbr: 'AL',
      description: 'The alarm list through the IoT adapter: count chips, status / severity filters and search, server paging, selection with bulk acknowledge / clear sharing one note, live arrivals ("N new alarms") and a 30 s re-read without a live source.',
      filePath: 'modules/domains/iot/alarm/AlarmListView.tsx',
      usage: `<IotAdapterProvider adapter={adapter} live={live}><AlarmListView hrefs={{ alarm, device }} onQueryChange={toUrl} /></IotAdapterProvider>`,
      variants: [
        { title: 'Fixture adapter', layout: 'stack', preview: <Fixture><AlarmListView hrefs={hrefs} now={NOW} /></Fixture>, code: '<AlarmListView hrefs={hrefs} />' },
        { title: 'Failing adapter', layout: 'stack', preview: <Fixture fail><AlarmListView hrefs={hrefs} embedded /></Fixture>, code: '<AlarmListView hrefs={hrefs} embedded />' },
      ],
    }),
    entry({
      id: 'iot-alarm-detail-view',
      title: 'AlarmDetailView',
      abbr: 'AD',
      description: 'One alarm through the adapter: header with optimistic acknowledge / clear (rolled back with a toast on refusal), the timeline with a note box, a runbook drawer and a Related panel (device, what raised it, the topic).',
      filePath: 'modules/domains/iot/alarm/AlarmDetailView.tsx',
      usage: `<AlarmDetailView alarmId={id} hrefs={{ device }} />`,
      variants: [
        { title: 'Fixture adapter', layout: 'stack', preview: <Fixture><AlarmDetailView alarmId="a1" hrefs={{ device: hrefs.device }} now={NOW} /></Fixture>, code: '<AlarmDetailView alarmId="a1" />' },
        { title: 'Not readable', layout: 'stack', preview: <Fixture fail><AlarmDetailView alarmId="a1" /></Fixture>, code: '<AlarmDetailView alarmId="missing" />' },
      ],
    }),
    entry({
      id: 'iot-alarm-bell-menu',
      title: 'AlarmBellMenu',
      abbr: 'BM',
      description: 'The IoT bell: the count of alarms not resolved (its dot in the colour of the worst severity), the latest open alarms with inline acknowledge, and View all.',
      filePath: 'modules/domains/iot/alarm/AlarmBellMenu.tsx',
      usage: `<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => \`/alarms/\${id}\` }} />`,
      variants: [
        { title: 'With open alarms', layout: 'side', preview: <Fixture><div className="flex justify-end"><AlarmBellMenu hrefs={hrefs} now={NOW} /></div></Fixture>, code: '<AlarmBellMenu hrefs={hrefs} />' },
        { title: 'Five at most', layout: 'side', preview: <Fixture><div className="flex justify-end"><AlarmBellMenu hrefs={hrefs} limit={2} now={NOW} /></div></Fixture>, code: '<AlarmBellMenu hrefs={hrefs} limit={2} />' },
      ],
    }),
    entry({
      id: 'iot-device-online-dot',
      title: 'DeviceOnlineDot',
      abbr: 'DO',
      description: 'A device connection as a dot and a short text: online, offline with last seen, last seen only (OD-57, never a red offline), and stale after a threshold.',
      filePath: 'modules/domains/iot/device/DeviceOnlineDot.tsx',
      usage: `<DeviceOnlineDot state="ONLINE" lastSeenAt={row.lastSeenAt} staleAfterSeconds={600} />`,
      variants: [
        { title: 'States', layout: 'stack', preview: <div className="flex flex-col gap-2"><DeviceOnlineDot state="ONLINE" lastSeenAt={ago(40_000)} now={NOW} /><DeviceOnlineDot state="OFFLINE" lastSeenAt={ago(52 * MIN)} now={NOW} /><DeviceOnlineDot state="LAST_SEEN" lastSeenAt={ago(3 * 3_600_000)} now={NOW} /><DeviceOnlineDot state="OFFLINE" now={NOW} /></div>, code: '<DeviceOnlineDot state="LAST_SEEN" lastSeenAt={t} />' },
        { title: 'Stale and compact', layout: 'side', preview: <div className="flex gap-4"><DeviceOnlineDot state="ONLINE" lastSeenAt={ago(20 * MIN)} staleAfterSeconds={600} now={NOW} /><DeviceOnlineDot state="ONLINE" lastSeenAt={ago(MIN)} compact now={NOW} /></div>, code: '<DeviceOnlineDot state="ONLINE" staleAfterSeconds={600} />' },
      ],
    }),
    entry({
      id: 'iot-device-connection-badge',
      title: 'DeviceConnectionBadge',
      abbr: 'DN',
      description: 'Online / offline with a relative last seen and the last disconnect reason in a tooltip; follows the online rule (null = last seen only) and shows Quarantined (OD-1, counts toward the limit) or Disabled first.',
      filePath: 'modules/domains/iot/device/DeviceConnectionBadge.tsx',
      usage: `<DeviceConnectionBadge online={d.online} status={d.status} lastActivityAt={d.lastActivityAt} lastDisconnectReason={d.lastDisconnectReason} />`,
      variants: [
        { title: 'Connection', layout: 'side', preview: <div className="flex flex-wrap gap-2"><DeviceConnectionBadge online lastActivityAt={ago(40_000)} now={NOW} /><DeviceConnectionBadge online={false} lastActivityAt={ago(52 * MIN)} lastDisconnectReason="keepalive_timeout" now={NOW} /><DeviceConnectionBadge online={null} lastActivityAt={ago(3 * 3_600_000)} now={NOW} /></div>, code: '<DeviceConnectionBadge online={false} lastDisconnectReason="keepalive_timeout" />' },
        { title: 'Quarantined and disabled', layout: 'side', preview: <div className="flex gap-2"><DeviceConnectionBadge online status="QUARANTINED" /><DeviceConnectionBadge online={false} status="DISABLED" /></div>, code: '<DeviceConnectionBadge online status="QUARANTINED" />' },
      ],
    }),
    entry({
      id: 'iot-device-detail-header',
      title: 'DeviceDetailHeader',
      abbr: 'DE',
      description: 'A device page header: name, label, connection badge, gateway tag, serial, profile, firmware and protocol, and an actions slot the host fills. There is no factory-reset action (OD-8).',
      filePath: 'modules/domains/iot/device/DeviceDetailHeader.tsx',
      usage: `<DeviceDetailHeader device={device} profileHref={profileHref} actions={<Button>Copy ID</Button>} />`,
      variants: [
        { title: 'Online device', layout: 'stack', preview: <DeviceDetailHeader device={DEVICES[0]} profileHref="#" now={NOW} actions={<Button variant="ghost" size="sm">Copy ID</Button>} />, code: '<DeviceDetailHeader device={device} />' },
        { title: 'Quarantined, with Activate', layout: 'stack', preview: <DeviceDetailHeader device={DEVICES[2]} now={NOW} actions={<Button variant="primary" size="sm">Activate</Button>} />, code: '<DeviceDetailHeader device={quarantined} actions={<Button>Activate</Button>} />' },
      ],
    }),
    entry({
      id: 'iot-device-credential-panel',
      title: 'DeviceCredentialPanel',
      abbr: 'CD',
      description: 'A device credential without its secret (type, client id, username, X.509 fingerprint and expiry) with Rotate behind a Popconfirm; a newly issued secret is shown once (masked, copyable) and never stored.',
      filePath: 'modules/domains/iot/device/DeviceCredentialPanel.tsx',
      usage: `<DeviceCredentialPanel credential={c} secret={issued} onSecretDismiss={() => setIssued(null)} onRotate={rotate} />`,
      variants: [
        { title: 'Token, just rotated', layout: 'stack', preview: <DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000), rotatedAt: ago(MIN) }} secret={{ token: 'Xq7Lr2VbN8tKc4Mp9WzH3sJd6Fy1Ag5E' }} onSecretDismiss={() => undefined} onRotate={() => wait()} locale="en-GB" />, code: '<DeviceCredentialPanel credential={c} secret={{ token }} />' },
        { title: 'X.509 and MQTT basic', layout: 'stack', preview: <div className="flex flex-col gap-3"><DeviceCredentialPanel credential={{ type: 'X509_CERTIFICATE', certFingerprint: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', certSubject: 'CN=pump-4', certExpiresAt: '2027-10-24T00:00:00Z' }} locale="en-GB" /><DeviceCredentialPanel credential={{ type: 'MQTT_BASIC', username: 'pump-4', clientId: 'pump-4-a' }} onRotate={() => wait()} /></div>, code: `<DeviceCredentialPanel credential={{ type: 'X509_CERTIFICATE', certFingerprint }} />` },
      ],
    }),
    entry({
      id: 'iot-device-attribute-table',
      title: 'DeviceAttributeTable',
      abbr: 'DA',
      description: 'Device attributes in three scope tabs; Server and Shared are edited inline as validated JSON, Shared keys show the desired/reported state, Client is read-only, secret keys are write-only.',
      filePath: 'modules/domains/iot/device/DeviceAttributeTable.tsx',
      usage: `<DeviceAttributeTable entries={entries} canWrite onSave={save} onDelete={remove} onScopeOpen={load} />`,
      variants: [
        { title: 'Writable, shared tab', layout: 'stack', preview: <DeviceAttributeTable entries={ATTRIBUTES} canWrite defaultScope="SHARED" onSave={() => wait()} onDelete={() => wait()} now={NOW} />, code: '<DeviceAttributeTable entries={entries} canWrite defaultScope="SHARED" />' },
        { title: 'Read only, loading client', layout: 'stack', preview: <DeviceAttributeTable entries={{ SERVER: ATTRIBUTES.SERVER }} loading={{ CLIENT: true }} now={NOW} />, code: '<DeviceAttributeTable entries={entries} />' },
      ],
    }),
    entry({
      id: 'iot-desired-reported-badge',
      title: 'DesiredReportedBadge',
      abbr: 'DR',
      description: 'The sync state of a shared attribute: in sync, pending, rejected (with the device reason), drifted, unknown key.',
      filePath: 'modules/domains/iot/device/DesiredReportedBadge.tsx',
      usage: `<DesiredReportedBadge state="rejected" reason="value_out_of_range" />`,
      variants: [
        { title: 'States', layout: 'side', preview: <div className="flex flex-wrap gap-2">{(['in_sync', 'pending', 'rejected', 'drifted', 'unknown_key'] as const).map((s) => <DesiredReportedBadge key={s} state={s} />)}</div>, code: '<DesiredReportedBadge state="pending" />' },
        { title: 'Rejected with a reason, medium', layout: 'side', preview: <DesiredReportedBadge state="rejected" reason="value_out_of_range" size="md" />, code: '<DesiredReportedBadge state="rejected" reason="value_out_of_range" />' },
      ],
    }),
    entry({
      id: 'iot-device-connection-timeline',
      title: 'DeviceConnectionTimeline',
      abbr: 'DK',
      description: 'A device connection log on the generic Timeline: connects, disconnects with the protocol reason, takeovers and rule switches, paged.',
      filePath: 'modules/domains/iot/device/DeviceConnectionTimeline.tsx',
      usage: `<DeviceConnectionTimeline events={events} hasMore={more} onLoadMore={next} />`,
      variants: [
        { title: 'Events', layout: 'stack', preview: <DeviceConnectionTimeline events={CONNECTIONS} hasMore onLoadMore={() => undefined} locale="en-GB" />, code: '<DeviceConnectionTimeline events={events} />' },
        { title: 'Empty', layout: 'stack', preview: <DeviceConnectionTimeline events={[]} />, code: '<DeviceConnectionTimeline events={[]} />' },
      ],
    }),
    entry({
      id: 'iot-device-table',
      title: 'DeviceTable',
      abbr: 'DX',
      description: 'The body of a dashboard device table (iot.device-table): rows a host delivers, online dot with last seen and a stale threshold, telemetry key columns with unit and decimals, keyboard row focus and a row click.',
      filePath: 'modules/domains/iot/device/DeviceTable.tsx',
      usage: `<DeviceTable rows={data.rows.rows} keyColumns={[{ key: 'temperature', unit: '°C', decimals: 1 }]} staleAfterSeconds={600} onRowClick={onRowClick} />`,
      variants: [
        { title: 'With key columns', layout: 'stack', preview: <DeviceTable rows={TABLE_DEVICES} keyColumns={[{ key: 'temperature', label: 'Temp.', unit: '°C', decimals: 1 }, { key: 'pressure', label: 'Pressure', unit: 'bar' }]} staleAfterSeconds={600} now={NOW} locale="en-GB" onRowClick={() => undefined} />, code: '<DeviceTable rows={rows} keyColumns={keys} />' },
        { title: 'Empty and failing', layout: 'stack', preview: <div className="flex flex-col gap-3"><DeviceTable rows={[]} /><DeviceTable rows={[]} error="The source did not answer." onRetry={() => undefined} /></div>, code: '<DeviceTable rows={[]} error="…" onRetry={retry} />' },
      ],
    }),
    entry({
      id: 'iot-device-list-view',
      title: 'DeviceListView',
      abbr: 'DY',
      description: 'The device list through the IoT adapter: search and filters, server paging, connection badge, the Quarantined (n) quick filter with bulk Activate, New device (token shown once), live connection updates and a 30 s re-read without a live source.',
      filePath: 'modules/domains/iot/device/DeviceListView.tsx',
      usage: `<IotAdapterProvider adapter={adapter} live={live}><DeviceListView hrefs={{ device }} onQueryChange={toUrl} /></IotAdapterProvider>`,
      variants: [
        { title: 'Fixture adapter', layout: 'stack', preview: <Fixture><DeviceListView hrefs={hrefs} now={NOW} /></Fixture>, code: '<DeviceListView hrefs={hrefs} />' },
        { title: 'Failing adapter', layout: 'stack', preview: <Fixture fail><DeviceListView hrefs={hrefs} /></Fixture>, code: '<DeviceListView hrefs={hrefs} />' },
      ],
    }),
    entry({
      id: 'iot-device-detail-view',
      title: 'DeviceDetailView',
      abbr: 'DZ',
      description: 'One device through the adapter: header with copy id, Activate and delete, tabs Overview, Attributes, Credentials (only with the capability) and Connections, plus tabs other modules contribute.',
      filePath: 'modules/domains/iot/device/DeviceDetailView.tsx',
      usage: `<DeviceDetailView deviceId={id} extraTabs={contributedTabs} tab={tab} onTabChange={setTab} />`,
      variants: [
        { title: 'Fixture adapter', layout: 'stack', preview: <Fixture><DeviceDetailView deviceId="d1" now={NOW} /></Fixture>, code: '<DeviceDetailView deviceId="d1" />' },
        { title: 'Not readable', layout: 'stack', preview: <Fixture fail><DeviceDetailView deviceId="d1" /></Fixture>, code: '<DeviceDetailView deviceId="missing" />' },
      ],
    }),
    entry({
      id: 'iot-new-device-drawer',
      title: 'NewDeviceDrawer',
      abbr: 'NE',
      description: 'New device: name, label, profile and gateway flag; on success the access token is shown once with a link to the device, and leaves with the drawer.',
      filePath: 'modules/domains/iot/device/NewDeviceDrawer.tsx',
      usage: `<NewDeviceDrawer open profiles={profiles} deviceHref={href} onClose={close} onCreated={reload} />`,
      variants: [
        { title: 'Open it', layout: 'side', preview: <NewDeviceDemo />, code: '<NewDeviceDrawer open … />' },
        { title: 'Inside DeviceListView', layout: 'side', preview: <p className="text-sm text-text-secondary">The list view opens it from its New device action.</p>, code: '<DeviceListView hrefs={hrefs} />' },
      ],
    }),
  ];
}
