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
import { AlarmBellMenu, AlarmBellSection, useAlarmBellSource } from '@/modules/domains/iot/alarm/AlarmBellMenu';
import { NotificationMenu } from '@/modules/domains/common/notification/NotificationMenu';
import { DeviceOnlineDot } from '@/modules/domains/iot/device/DeviceOnlineDot';
import { DeviceConnectionBadge } from '@/modules/domains/iot/device/DeviceConnectionBadge';
import { DeviceDetailHeader } from '@/modules/domains/iot/device/DeviceDetailHeader';
import { DeviceCredentialPanel } from '@/modules/domains/iot/device/DeviceCredentialPanel';
import { DeviceAttributeTable } from '@/modules/domains/iot/device/DeviceAttributeTable';
import { DesiredReportedBadge } from '@/modules/domains/iot/device/DesiredReportedBadge';
import { DeviceConnectionTimeline } from '@/modules/domains/iot/device/DeviceConnectionTimeline';
import { DeviceLogTimeline } from '@/modules/domains/iot/device/DeviceLogTimeline';
import { DeviceQuickView } from '@/modules/domains/iot/device/DeviceQuickView';
import { DeviceTable, type DeviceTableRow } from '@/modules/domains/iot/device/DeviceTable';
import { DeviceListView } from '@/modules/domains/iot/device/DeviceListView';
import { DeviceDetailView } from '@/modules/domains/iot/device/DeviceDetailView';
import { NewDeviceDrawer } from '@/modules/domains/iot/device/NewDeviceDrawer';
import { RpcStatusBadge } from '@/modules/domains/iot/rpc/RpcStatusBadge';
import { RpcSendPanel } from '@/modules/domains/iot/rpc/RpcSendPanel';
import { RpcRequestList } from '@/modules/domains/iot/rpc/RpcRequestList';
import { RpcRequestDetail } from '@/modules/domains/iot/rpc/RpcRequestDetail';
import { RpcConsoleView } from '@/modules/domains/iot/rpc/RpcConsoleView';
import type { RpcCatalogCommand, RpcCommand, RpcRequest } from '@/modules/domains/iot/types/rpc';
import { DeviceProfileCard } from '@/modules/domains/iot/profile/DeviceProfileCard';
import { DeviceProfileListView } from '@/modules/domains/iot/profile/DeviceProfileListView';
import { DeviceProfileEditorView } from '@/modules/domains/iot/profile/DeviceProfileEditorView';
import { NewDeviceProfileDrawer } from '@/modules/domains/iot/profile/NewDeviceProfileDrawer';
import { OnlineRuleField, type OnlineRuleValue } from '@/modules/domains/iot/profile/OnlineRuleField';
import { AuthModeSelector } from '@/modules/domains/iot/profile/AuthModeSelector';
import { TransportPolicyCard, type TransportPolicyValue } from '@/modules/domains/iot/profile/TransportPolicyCard';
import { ProtocolMappingCard, type ProtocolMappingValue } from '@/modules/domains/iot/profile/ProtocolMappingCard';
import { RateLimitEditor } from '@/modules/domains/iot/profile/RateLimitEditor';
import { TelemetryKeySchemaTable } from '@/modules/domains/iot/profile/TelemetryKeySchemaTable';
import { CfgSchemaTable } from '@/modules/domains/iot/profile/CfgSchemaTable';
import { ProvisioningSettingsCard } from '@/modules/domains/iot/profile/ProvisioningSettingsCard';
import { ProvisioningKeysPanel } from '@/modules/domains/iot/profile/ProvisioningKeysPanel';
import { AlarmRuleSetEditor } from '@/modules/domains/iot/alarm/AlarmRuleSetEditor';
import { AlarmRuleDrawer } from '@/modules/domains/iot/alarm/AlarmRuleDrawer';
import { RpcCommandCatalogEditor } from '@/modules/domains/iot/rpc/RpcCommandCatalogEditor';
import { blankProfileDraft, DEFAULT_RATE_LIMITS, type DeviceProfile, type ProfileAuthMode, type ProfileRateLimits, type ProvisionKey, type TelemetryKeySpec, type CfgKeySpec } from '@/modules/domains/iot/types/profile';
import { newThresholdRule, type AlarmRuleDefinition } from '@/modules/domains/iot/types/alarm-rule';
import { IotAdapterProvider } from '@/modules/domains/iot/api/IotAdapterProvider';
import { AssetKindBadge } from '@/modules/domains/iot/asset/AssetKindBadge';
import { AssetBreadcrumb } from '@/modules/domains/iot/asset/AssetBreadcrumb';
import { AssetTree } from '@/modules/domains/iot/asset/AssetTree';
import { AssetDrawer } from '@/modules/domains/iot/asset/AssetDrawer';
import { AssetsMapDrawer } from '@/modules/domains/iot/asset/AssetsMapDrawer';
import { AssetsView } from '@/modules/domains/iot/asset/AssetsView';
import { AssetFormDrawer } from '@/modules/domains/iot/asset/AssetFormDrawer';
import { MoveAssetDialog } from '@/modules/domains/iot/asset/MoveAssetDialog';
import { PlaceDevicesDialog } from '@/modules/domains/iot/asset/PlaceDevicesDialog';
import { PlacedDeviceTable } from '@/modules/domains/iot/asset/PlacedDeviceTable';
import { AssetRelationTable } from '@/modules/domains/iot/asset/AssetRelationTable';
import { DevicePlacementPanel } from '@/modules/domains/iot/asset/DevicePlacementPanel';
import { DevicePlacementPicker } from '@/modules/domains/iot/asset/DevicePlacementPicker';
import type { AssetCrumb, AssetNode, AssetRecord, AssetRelation, AssetRow, AssetSummary, PlacedDevice } from '@/modules/domains/iot/types/asset';
import { IotApiError, type AssetListQuery, type IotAdapter, type IotProvisioningApi } from '@/modules/domains/iot/api/adapter';
import type { Alarm, AlarmEvent } from '@/modules/domains/iot/types/alarm';
import type { AttributeEntry, DeviceConnectionEvent, DeviceLogEntry, DeviceLogFilter, DeviceRecord } from '@/modules/domains/iot/types/device';

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

const LOG: DeviceLogEntry[] = [
  ...CONNECTIONS.map((c) => ({ ...c, source: 'connection' as const })),
  { id: 'a1', at: ago(20 * MIN), source: 'audit', kind: 'iot_device.attributes.saved', actor: { id: 'u1', name: 'Ada Lovelace' }, metadata: { scope: 'SHARED', keys: ['cfg.report_interval_s'] } },
  { id: 'a2', at: ago(2 * 3_600_000), source: 'audit', kind: 'iot_rpc.request.created', actor: { id: 'u2', name: 'Alex Müller' }, metadata: { method: 'sys.info', rpcId: 'r1' } },
  { id: 'a3', at: ago(26 * 3_600_000), source: 'audit', kind: 'iot_device.credential.rotated', actor: { id: 'u1', name: 'Ada Lovelace' }, metadata: { credentialType: 'ACCESS_TOKEN' } },
  { id: 'a4', at: ago(5 * 86_400_000), source: 'audit', kind: 'iot_device.device.updated', actor: { id: 'u3' }, metadata: { fields: ['label', 'name'] } },
  { id: 'a5', at: ago(30 * 86_400_000), source: 'audit', kind: 'iot_device.device.created', actor: null, metadata: { credentialType: 'ACCESS_TOKEN' } },
];
const LOG_SORTED = [...LOG].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

const TABLE_ALARMS: AlarmTableRow[] = ALARMS.map((a) => ({
  id: a.alarmId, severity: a.severity, status: a.status, title: a.title, originator: a.deviceName, deviceId: a.deviceId, openedAt: a.openedAt,
  occurrences: a.occurrences, flapping: a.flapping,
}));
const TABLE_DEVICES: DeviceTableRow[] = DEVICES.map((d) => ({
  id: d.deviceId, name: d.name, label: d.label, profile: d.profileName, status: d.status, online: d.online, lastSeenAt: d.lastActivityAt,
  values: { temperature: 61.37, pressure: 2.4 },
}));

const RPC_COMMANDS: RpcCommand[] = [
  { method: 'sys.info', label: 'System information', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {}, sendable: true },
  { method: 'sys.ping', label: 'Ping a host', tier: 'basic', highImpact: false, oneway: false, sendable: true, paramsSchema: { host: { label: 'Host', type: 'text', required: true } } },
  { method: 'cfg.sync', label: 'Apply configuration', tier: 'privileged', highImpact: false, oneway: true, paramsSchema: {}, sendable: false },
  { method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, confirmText: 'REBOOT', oneway: true, paramsSchema: {}, sendable: true },
];
const RPC_REQUESTS: RpcRequest[] = [
  { rpcId: 'r1', deviceId: 'd1', deviceName: 'Pump 4', method: 'sys.info', oneway: false, persistent: false, status: 'SUCCESSFUL', source: 'console', createdAt: ago(5 * MIN), completedAt: new Date(NOW - 5 * MIN + 820), response: { uptime_s: 345_612, fw: '1.8.2' } },
  { rpcId: 'r2', deviceId: 'd1', deviceName: 'Pump 4', method: 'sys.ping', oneway: false, persistent: false, status: 'TIMEOUT', outcome: 'unknown', source: 'dashboard_control', createdAt: ago(15 * MIN), completedAt: ago(15 * MIN - 10_000) },
  { rpcId: 'r3', deviceId: 'd2', deviceName: 'Edge gateway 1', method: 'sys.reboot', oneway: true, persistent: true, status: 'QUEUED', source: 'console', createdAt: ago(MIN) },
];

const PROFILES: DeviceProfile[] = [
  { ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: 'Hall pumps on MQTT and HTTP.', isDefault: true, onlineRule: 'LIVE_SOCKET', allowedAuthModes: ['ACCESS_TOKEN', 'MQTT_BASIC'],
    telemetrySchema: [{ key: 'temperature', type: 'number', unit: '°C', label: 'Temperature', min: -20, max: 120, decimals: 1 }], createdAt: ago(40 * 86_400_000), updatedAt: ago(2 * 86_400_000) },
  { ...blankProfileDraft(), profileId: 'p2', name: 'Gateways', description: null, isDefault: false, transportType: 'MQTT', allowedAuthModes: ['X509_CERTIFICATE'], onlineRule: 'LIVE_SOCKET',
    template: { key: 'roltek-m1', version: 3 }, schemaSource: { kind: 'firmware', label: 'roltek-openwrt 24.10.1' }, createdAt: ago(40 * 86_400_000), updatedAt: ago(9 * 86_400_000) },
  { ...blankProfileDraft(), profileId: 'p3', name: 'LoRaWAN meters', description: 'Last seen only.', isDefault: false, transportType: 'LORAWAN', onlineRule: 'LAST_SEEN_ONLY',
    createdAt: ago(40 * 86_400_000), updatedAt: ago(20 * 86_400_000) },
];
const RULES: AlarmRuleDefinition[] = [
  { ...newThresholdRule('high_temperature'), severities: [{ severity: 'CRITICAL', condition: { key: 'temperature', op: '>', value: 95 } }, { severity: 'MAJOR', condition: { key: 'temperature', op: '>', value: 80 } }], debounce: { mode: 'count', raise: 3, clear: 3 } },
  { type: 'device_offline', title: '{{device.name}} is offline', inactivity: { afterSec: 600, severity: 'WARNING' }, enabled: true },
];
const CATALOG: RpcCatalogCommand[] = RPC_COMMANDS.map((c, i) => ({ ...c, commandId: `c${i}`, maskedParams: [] }));
const TELEMETRY_KEYS: TelemetryKeySpec[] = [
  { key: 'temperature', type: 'number', unit: '°C', label: 'Temperature', min: -20, max: 120, decimals: 1 },
  { key: 'pressure', type: 'number', unit: 'bar', label: 'Inlet pressure', min: 0, max: 16, decimals: 2 },
];
const CFG_KEYS: CfgKeySpec[] = [
  { key: 'cfg.report_interval_s', type: 'integer', label: 'Report interval', min: 5, max: 3600 },
  { key: 'cfg.mode', type: 'string', enum: ['eco', 'normal', 'boost'] },
  { key: 'cfg.wifi.psk', type: 'string', minLength: 8, maxLength: 63, secret: true },
];

// ── sites and assets (phase 08) ──

const an = (assetId: string, name: string, kind: string, children: AssetNode[] = [], deviceCount = 0): AssetNode => ({
  assetId, parentId: null, code: assetId.toUpperCase(), name, kind, childCount: children.length, deviceCount, children: children.map((c) => ({ ...c, parentId: assetId })),
});
const ASSET_TREE: AssetNode[] = [
  an('plant', 'Istanbul plant', 'SITE', [
    an('bldg-a', 'Building A', 'BUILDING', [an('line-3', 'Line 3', 'LINE', [an('press-3', 'Press 3', 'MACHINE', [], 1)]), an('boiler', 'Boiler room', 'ROOM', [], 1)]),
    an('bldg-b', 'Building B', 'BUILDING', [an('floor-2', 'Floor 2', 'FLOOR', [an('server-room', 'Server room', 'ROOM', [], 2)])]),
  ]),
  an('depot', 'Ankara depot', 'SITE', [an('cold', 'Cold storage', 'COLD_STORE', [], 1)]),
];
const crumbOf = (n: AssetNode): AssetCrumb => ({ assetId: n.assetId, code: n.code, name: n.name, kind: n.kind });
const findAsset = (id: string, list: AssetNode[] = ASSET_TREE, trail: AssetNode[] = []): { node: AssetNode; trail: AssetNode[] } | null => {
  for (const x of list) {
    if (x.assetId === id) return { node: x, trail };
    const hit = findAsset(id, x.children, [...trail, x]);
    if (hit) return hit;
  }
  return null;
};
const assetRecord = (id: string): AssetRecord => {
  const hit = findAsset(id);
  if (!hit) throw new IotApiError('not_found', 'Asset not found.');
  const { node, trail } = hit;
  return {
    assetId: node.assetId, parentId: trail.at(-1)?.assetId ?? null, code: node.code, name: node.name, kind: node.kind,
    description: node.kind === 'SITE' ? 'Head office, press and assembly halls' : null, timezone: node.kind === 'SITE' ? 'Europe/Istanbul' : null,
    effectiveTimezone: 'Europe/Istanbul', lat: node.kind === 'SITE' ? 41.0786 : null, lng: node.kind === 'SITE' ? 29.0112 : null,
    attributes: node.kind === 'SITE' ? { area_m2: 12_400, shifts: 3 } : {}, ancestors: trail.map(crumbOf), childCount: node.children.length,
    deviceCount: node.deviceCount + node.children.reduce((s, c) => s + c.deviceCount, 0), createdAt: ago(400 * 86_400_000),
  };
};
/** The table's rows and the map's sites from the fixture tree: place, counts (devices on a node or below) and a few active alarms. */
const ASSET_ALARMS: Record<string, { n: number; worst: AssetRow['worstSeverity'] }> = { 'press-3': { n: 2, worst: 'CRITICAL' }, boiler: { n: 1, worst: 'MINOR' }, cold: { n: 1, worst: 'WARNING' } };
const SEVERITY_RANK = ['INFO', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL'];
function assetRows(): AssetRow[] {
  const out: AssetRow[] = [];
  const walk = (n: AssetNode, trail: AssetNode[]): { devices: number; alarms: number; worst: AssetRow['worstSeverity'] } => {
    const at = out.length;
    out.push({ assetId: n.assetId, parentId: trail.at(-1)?.assetId ?? null, code: n.code, name: n.name, kind: n.kind, location: trail.map((t) => ({ assetId: t.assetId, name: t.name })), childCount: n.children.length, deviceCount: 0, alarmCount: 0, worstSeverity: null });
    let devices = n.deviceCount;
    let alarms = ASSET_ALARMS[n.assetId]?.n ?? 0;
    let worst = ASSET_ALARMS[n.assetId]?.worst ?? null;
    for (const c of n.children) {
      const r = walk(c, [...trail, n]);
      devices += r.devices;
      alarms += r.alarms;
      if (r.worst && (!worst || SEVERITY_RANK.indexOf(r.worst) > SEVERITY_RANK.indexOf(worst))) worst = r.worst;
    }
    out[at] = { ...out[at], deviceCount: devices, alarmCount: alarms, worstSeverity: worst };
    return { devices, alarms, worst };
  };
  ASSET_TREE.forEach((n) => walk(n, []));
  return out;
}
const ASSET_ROWS = assetRows();
const SITE_PLACES: Record<string, [number, number]> = { plant: [41.0786, 29.0112], depot: [39.9334, 32.8597] };
const ASSET_SUMMARY: AssetSummary = {
  sites: ASSET_TREE.length, sitesLocated: 2, assets: ASSET_ROWS.length, devices: 7, placedDevices: 6,
  activeAlarms: 4, criticalAlarms: 1, unacknowledgedAlarms: 3, sitesWithAlarms: 2, kinds: ['BUILDING', 'LINE', 'SITE'], sitesTruncated: false, alarms: true,
  siteList: ASSET_ROWS.filter((r) => !r.parentId).map((r) => ({
    assetId: r.assetId, code: r.code, name: r.name, kind: r.kind, lat: SITE_PLACES[r.assetId]?.[0] ?? null, lng: SITE_PLACES[r.assetId]?.[1] ?? null,
    assetCount: ASSET_ROWS.filter((x) => x.assetId === r.assetId || x.location.some((l) => l.assetId === r.assetId)).length,
    deviceCount: r.deviceCount, alarmCount: r.alarmCount, worstSeverity: r.worstSeverity,
    alarmsBySeverity: r.assetId === 'plant' ? { CRITICAL: 2, MINOR: 1 } : { WARNING: 1 },
  })),
};
function listAssetRows(q: AssetListQuery): { items: AssetRow[]; total: number; alarms: boolean } {
  const s = q.search?.toLowerCase();
  let rows = ASSET_ROWS.filter((r) => (!s || r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.location.some((l) => l.name.toLowerCase().includes(s)))
    && (!q.kind || r.kind === q.kind) && (!q.parentId || r.parentId === q.parentId) && (!q.alarmed || (r.alarmCount ?? 0) > 0)
    && (!q.site || r.assetId === q.site || r.location.some((l) => l.assetId === q.site)));
  if (q.sort) {
    const val = (r: AssetRow): string | number => ({ name: r.name, kind: r.kind, location: r.location.map((l) => l.name).join(' › '), children: r.childCount, devices: r.deviceCount, alarms: SEVERITY_RANK.indexOf(r.worstSeverity ?? '') * 1000 + (r.alarmCount ?? 0) })[q.sort!.key];
    const dir = q.sort.dir === 'desc' ? -1 : 1;
    rows = [...rows].sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : a.name.localeCompare(b.name)));
  }
  return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, alarms: true };
}
const PLACED: PlacedDevice[] = [
  { device: { ...DEVICES[0], lastRemoteIp: '203.0.113.7', lastTransport: 'mqtt' }, placement: { assetId: 'press-3', code: 'PRESS-3', name: 'Press 3', kind: 'MACHINE' } },
  { device: { ...DEVICES[1], lastRemoteIp: '198.51.100.24', lastTransport: 'mqtts' }, placement: { assetId: 'boiler', code: 'BOILER', name: 'Boiler room', kind: 'ROOM' } },
  { device: DEVICES[3], placement: { assetId: 'bldg-a', code: 'BLDG-A', name: 'Building A', kind: 'BUILDING' } },
];
const RELATIONS: AssetRelation[] = [
  { relationId: 'rl1', fromType: 'ASSET', fromId: 'bldg-a', toType: 'DEVICE', toId: 'd4', type: 'CONTAINS', fromName: 'Building A', toName: 'Water meter 3B' },
  { relationId: 'rl2', fromType: 'ASSET', fromId: 'boiler', toType: 'ASSET', toId: 'line-3', type: 'FEEDS', fromName: 'Boiler room', toName: 'Line 3' },
  { relationId: 'rl3', fromType: 'DEVICE', fromId: 'd2', toType: 'ASSET', toId: 'bldg-a', type: 'MONITORS', fromName: 'Edge gateway 1', toName: 'Building A' },
];

function fixtureAdapter(fail = false): IotAdapter {
  const failing = async () => { await wait(); throw new IotApiError('unavailable', 'The server did not answer.'); };
  const alarms = ALARMS.map((a) => ({ ...a }));
  return {
    name: 'Showcase fixtures',
    async capabilities() {
      return { canCreateDevice: true, canDeleteDevice: true, canViewCredentials: true, canReadAttributes: true, canWriteAttributes: true, canActivateDevice: true, canReadAlarms: true, canAcknowledge: true, canClear: true, canComment: true, canSendRpc: true, canManageProfiles: !fail, canManageAlarmRules: !fail, canManageRpcCommands: !fail, canManageAssets: !fail, canPlaceDevices: !fail };
    },
    profiles: {
      transports: ['MQTT', 'HTTP', 'ANY', 'LORAWAN'],
      async options() { return PROFILES.map((p) => ({ id: p.profileId, name: p.name })); },
      list: fail ? failing : async (q) => { await wait(); return { items: PROFILES.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: PROFILES.length }; },
      get: fail ? failing : async (id) => { await wait(); const p = PROFILES.find((x) => x.profileId === id); if (!p) throw new IotApiError('not_found', 'Device profile not found.'); return structuredClone(p); },
      async create(input) { await wait(); return { ...PROFILES[0], ...input, profileId: 'p-new', isDefault: false } as DeviceProfile; },
      async update(id, patch) { await wait(); if (patch.transportType === 'HTTP') throw new IotApiError('validation', 'The chosen online rule cannot be used with this transport (online_rule_not_allowed).'); return { ...PROFILES.find((x) => x.profileId === id)!, ...patch } as DeviceProfile; },
      async setDefault(id) { await wait(); return { ...PROFILES.find((x) => x.profileId === id)!, isDefault: true }; },
      async remove() { await wait(); throw new IotApiError('conflict', 'The device profile is still in use by 2 devices (iot_device).'); },
      async usage(ids) { await wait(); return Object.fromEntries(ids.map((id) => [id, { devices: DEVICES.filter((d) => d.deviceProfileId === id).length, references: [{ moduleId: 'iot_device', count: DEVICES.filter((d) => d.deviceProfileId === id).length, label: 'devices' }] }])); },
    },
    assets: {
      tree: fail ? failing : async () => { await wait(); return { nodes: ASSET_TREE, truncated: false }; },
      list: fail ? failing : async (q) => { await wait(); return listAssetRows(q); },
      summary: fail ? failing : async () => { await wait(); return ASSET_SUMMARY; },
      get: fail ? failing : async (id) => { await wait(); return assetRecord(id); },
      async create() { await wait(); return { assetId: 'line-3' }; },
      async update() { await wait(); },
      async move(_id, parentId) { await wait(); if (parentId === 'press-3') throw new IotApiError('validation', 'An asset cannot be moved under itself or one of its own descendants.'); },
      async remove() { await wait(); throw new IotApiError('conflict', 'This asset still has child assets: move or delete them first.'); },
      devices: fail ? failing : async (id, q) => { await wait(); const rows = q.recursive === false ? PLACED.filter((p) => p.placement.assetId === id) : PLACED; return { items: rows, total: rows.length }; },
      async place() { await wait(); },
      placement: fail ? failing : async () => { await wait(); return { assetId: 'press-3', path: ['plant', 'bldg-a', 'line-3', 'press-3'].map((id) => crumbOf(findAsset(id)!.node)) }; },
      async setPlacement(_d, assetId) { await wait(); return assetId ? { assetId, path: [...assetRecord(assetId).ancestors, crumbOf(findAsset(assetId)!.node)] } : { assetId: null, path: [] }; },
      async relations() { await wait(); return RELATIONS; },
      async removeRelation() { await wait(); },
    },
    alarmRules: {
      list: fail ? failing : async () => { await wait(); return RULES.map((definition, i) => ({ ruleId: `r${i}`, version: 1, definition })); },
      async replace(_id, rules) { await wait(); return rules.map((definition, i) => ({ ruleId: `r${i}`, version: 1, definition })); },
    },
    rpcCatalog: {
      list: fail ? failing : async () => { await wait(); return { commands: CATALOG, supported: true }; },
      async create(_p, c) { await wait(); return { ...c, commandId: 'c-new' }; },
      async update(_p, id, patch) { await wait(); return { ...CATALOG.find((c) => c.commandId === id)!, ...patch }; },
      async remove() { await wait(); },
      async exportAll() { await wait(); return CATALOG.map(({ commandId: _id, sendable: _s, ...rest }) => rest); },
      async importAll(_p, commands) { await wait(); return commands.map((c, i) => ({ ...c, commandId: `i${i}` })); },
    },
    devices: {
      list: fail ? failing : async (q) => { await wait(); return { items: DEVICES.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: DEVICES.length }; },
      get: fail ? failing : async (id) => { await wait(); const d = DEVICES.find((x) => x.deviceId === id); if (!d) throw new IotApiError('not_found', 'Device not found.'); return d; },
      async create(input) { await wait(); return { device: { ...DEVICES[0], deviceId: 'new', name: input.name }, credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'Xq7Lr2VbN8tKc4Mp9WzH3sJd6Fy1Ag5E' } }; },
      async activate(ids) { await wait(); return { activated: ids.length }; },
      async connections() { await wait(); return { items: CONNECTIONS, total: CONNECTIONS.length }; },
      log: fail ? failing : async (_id, q) => {
        await wait();
        const rows = LOG_SORTED.filter((e) => !q.source || e.source === q.source);
        return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length };
      },
      async quarantinedCount() { return 1; },
    },
    credentials: {
      async get() { return { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000) }; },
      async rotate() { await wait(); return { credential: { type: 'ACCESS_TOKEN', createdAt: ago(30 * 86_400_000), rotatedAt: new Date(NOW) }, secret: { token: 'Nm4Qa8Zr2Wt6Ys1Pk9Hd3Lc7Vb5Xe0Gj' } }; },
    },
    attributes: { async list(_id, scope) { await wait(); return ATTRIBUTES[scope]; }, async save() { await wait(); }, async remove() { await wait(); } },
    rpc: {
      async methods(deviceId) { await wait(); return deviceId === 'd4' ? { commands: [], canSendRaw: false, supported: false } : { commands: RPC_COMMANDS, canSendRaw: false, supported: true }; },
      async send(deviceId, input) { await wait(); return { rpcId: `r${Math.round(NOW / 1000)}`, deviceId, method: input.method, oneway: false, persistent: false, status: 'QUEUED', source: 'console', createdAt: new Date(NOW) }; },
      list: fail ? failing : async (q) => { await wait(); return { items: RPC_REQUESTS.filter((r) => !q.deviceId || r.deviceId === q.deviceId), nextCursor: null }; },
      async get(id) { await wait(); return RPC_REQUESTS.find((r) => r.rpcId === id) ?? RPC_REQUESTS[0]; },
      async cancel(id) { await wait(); return { ...(RPC_REQUESTS.find((r) => r.rpcId === id) ?? RPC_REQUESTS[2]), status: 'CANCELLED' }; },
    },
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

/** The host's notification bell with the alarms as items of its one list: one bell, one list, one badge. */
function OneList() {
  const alarms = useAlarmBellSource({ hrefs });
  return (
    <div className="flex justify-end">
      <NotificationMenu
        items={[{ id: 'n1', title: 'Backup finished', at: new Date(NOW - 5 * 60_000), read: false, variant: 'success' }]}
        sources={alarms ? [alarms] : []}
        now={NOW}
        locale="en-GB"
      />
    </div>
  );
}

/** The host's notification bell with the alarms as one of its sections: one bell, one badge. */
function OneBell() {
  const [alarms, setAlarms] = useState(0);
  return (
    <div className="flex justify-end">
      <NotificationMenu
        items={[{ id: 'n1', title: 'Backup finished', timestamp: '5 min ago', read: false, variant: 'success' }]}
        extraCount={alarms}
        sections={<AlarmBellSection hrefs={hrefs} now={NOW} onCount={setAlarms} />}
      />
    </div>
  );
}

function Fixture({ fail = false, children }: { fail?: boolean; children: React.ReactNode }) {
  const [adapter] = useState(() => fixtureAdapter(fail));
  return <IotAdapterProvider adapter={adapter} locale="en-GB">{children}</IotAdapterProvider>;
}

/** A profile's provisioning keys in memory: one in use, one old key still accepted, one revoked; `factory` = a platform template's (no grace). */
function provisioningFixture(factory: boolean, empty: boolean): IotProvisioningApi {
  const day = 86_400_000;
  let keys: ProvisionKey[] = empty ? [] : [
    { provisionKeyId: factory ? 'roltek-m1-k2' : 'pk-5b1e09a2', provisionKey: 'pk_5b1e09a2c4d7f013', state: 'active', createdAt: new Date(NOW - 12 * day) },
    { provisionKeyId: factory ? 'roltek-m1-k1' : 'pk-0c77d3f1', provisionKey: 'pk_0c77d3f1a98e2b40', state: 'retired', createdAt: new Date(NOW - 200 * day), retiredAt: new Date(NOW - 12 * day), graceUntil: factory ? null : new Date(NOW + 18 * day) },
    ...(factory ? [] : [{ provisionKeyId: 'pk-91aa40e6', provisionKey: 'pk_91aa40e6b2c15d77', state: 'revoked' as const, createdAt: new Date(NOW - 400 * day), revokedAt: new Date(NOW - 200 * day), revocationReason: 'The secret was pasted into a support ticket.' }]),
  ];
  let n = 3;
  return {
    async get() { await wait(); return { keys: structuredClone(keys), availableStrategies: ['DISABLED', 'ALLOW_CREATE_NEW_DEVICES', 'CHECK_PRE_PROVISIONED_DEVICES'], rotationGrace: factory ? null : { min: 0, max: 365, default: 30 } }; },
    async rotate() {
      await wait();
      keys = keys.map((k) => (k.state === 'active' ? { ...k, state: 'retired', retiredAt: new Date(), graceUntil: factory ? null : new Date(Date.now() + 30 * day) } : k));
      const key = { provisionKeyId: factory ? `roltek-m1-k${n++}` : `pk-demo000${n++}`, provisionKey: `pk_demo${String(n).padStart(12, '0')}`, state: 'active' as const, createdAt: new Date() };
      keys = [key, ...keys];
      return { key, provisionSecret: 'ps_0f1e2d3c4b5a69788796a5b4c3d2e1f0' };
    },
    async revoke(_id, { provisionKeyId, reason }) {
      await wait();
      keys = keys.map((k) => (k.provisionKeyId === provisionKeyId ? { ...k, state: 'revoked', revokedAt: new Date(), revocationReason: reason } : k));
      return keys.find((k) => k.provisionKeyId === provisionKeyId)!;
    },
  };
}

function ProvisioningKeysDemo({ factory = false, empty = false }: { factory?: boolean; empty?: boolean }) {
  const [adapter] = useState<IotAdapter>(() => ({ provisioning: provisioningFixture(factory, empty) }));
  return <IotAdapterProvider adapter={adapter} capabilities={{ canManageProvisioning: true }} locale="en-GB"><ProvisioningKeysPanel profileId="p1" /></IotAdapterProvider>;
}

function AssetsViewDemo({ fail = false }: { fail?: boolean }) {
  return <Fixture fail={fail}><AssetsView hrefs={{ asset: (id) => `#asset-${id}`, device: (id) => `#device-${id}`, alarms: () => '#alarms' }} now={NOW} /></Fixture>;
}

function AssetDrawerDemo({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setOpen(assetId)}>{`Open ${findAsset(assetId)!.node.name}`}</Button>
      {open && <AssetDrawer assetId={open} onClose={() => setOpen(null)} onOpenAsset={setOpen} hrefs={{ device: (id) => `#device-${id}` }} now={NOW} />}
    </Fixture>
  );
}

/** The map without alarm counts: a host without the alarm module, or a viewer who may not read alarms (neutral markers). */
const ASSET_SUMMARY_NO_ALARMS: AssetSummary = {
  ...ASSET_SUMMARY, alarms: false, activeAlarms: null, criticalAlarms: null, unacknowledgedAlarms: null, sitesWithAlarms: null,
  siteList: ASSET_SUMMARY.siteList.map((s) => ({ ...s, alarmCount: null, worstSeverity: null, alarmsBySeverity: null })),
};

function AssetsMapDrawerDemo({ alarms = true }: { alarms?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>{alarms ? 'Map' : 'Map without alarms'}</Button>
      {open && <AssetsMapDrawer onClose={() => setOpen(false)} summary={alarms ? ASSET_SUMMARY : ASSET_SUMMARY_NO_ALARMS} onListAssets={() => setOpen(false)} onOpenSite={() => setOpen(false)} alarmsHref={() => '#alarms'} />}
    </Fixture>
  );
}

function AssetTreeDemo() {
  const [selected, setSelected] = useState<string>('line-3');
  return <AssetTree nodes={ASSET_TREE} selectedId={selected} onSelect={setSelected} />;
}

function AssetDialogDemo({ which }: { which: 'form' | 'child' | 'move' | 'place' | 'picker' }) {
  const [open, setOpen] = useState(false);
  const label = which === 'form' ? 'Edit Building A' : which === 'child' ? 'Add a child to Building A' : which === 'move' ? 'Move Line 3' : which === 'place' ? 'Place devices on Press 3' : 'Pick an asset';
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>{label}</Button>
      {open && which === 'form' && <AssetFormDrawer open asset={assetRecord('bldg-a')} onClose={() => setOpen(false)} />}
      {open && which === 'child' && <AssetFormDrawer open parent={{ assetId: 'bldg-a', name: 'Building A' }} onClose={() => setOpen(false)} />}
      {open && which === 'move' && <MoveAssetDialog open asset={{ assetId: 'line-3', name: 'Line 3', parentId: 'bldg-a' }} nodes={ASSET_TREE} onClose={() => setOpen(false)} />}
      {open && which === 'place' && <PlaceDevicesDialog open asset={{ assetId: 'press-3', name: 'Press 3' }} placedIds={new Set(['d1'])} onClose={() => setOpen(false)} />}
      {open && which === 'picker' && <DevicePlacementPicker open value="press-3" onClose={() => setOpen(false)} onPick={() => setOpen(false)} />}
    </Fixture>
  );
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

function LogFilterDemo() {
  const [filter, setFilter] = useState<DeviceLogFilter>('all');
  return <DeviceLogTimeline entries={LOG_SORTED.filter((e) => filter === 'all' || e.source === filter)} filter={filter} onFilterChange={setFilter} hasMore onLoadMore={() => undefined} locale="en-GB" />;
}

function QuickViewDemo() {
  const [index, setIndex] = useState<number | null>(null);
  const d = index === null ? null : DEVICES[index];
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setIndex(0)}>Open the quick view</Button>
      {d && index !== null && (
        <DeviceQuickView
          open
          deviceId={d.deviceId}
          device={d}
          onClose={() => setIndex(null)}
          onPrevious={index > 0 ? () => setIndex(index - 1) : undefined}
          onNext={index < DEVICES.length - 1 ? () => setIndex(index + 1) : undefined}
          position={{ n: index + 1, total: DEVICES.length }}
          href={`#device-${d.deviceId}`}
          now={NOW}
        />
      )}
    </Fixture>
  );
}

function RpcDetailDemo({ request }: { request: RpcRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Open {request.method}</Button>
      <RpcRequestDetail open={open} request={request} onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onRerun={() => setOpen(false)} />
    </>
  );
}

const hrefs = { device: (id: string) => `#device-${id}`, alarm: (id: string) => `#alarm-${id}`, alarms: '#alarms', profile: (id: string) => `#profile-${id}` };

function OnlineRuleDemo({ transport, initial }: { transport: 'MQTT' | 'HTTP' | 'LORAWAN'; initial: OnlineRuleValue }) {
  const [v, setV] = useState(initial);
  return <OnlineRuleField value={v} transport={transport} onChange={setV} />;
}
function AuthModeDemo({ initial, locked }: { initial: ProfileAuthMode[]; locked?: boolean }) {
  const [v, setV] = useState(initial);
  return <AuthModeSelector value={v} locked={locked} onChange={setV} />;
}
function TransportPolicyDemo({ initial }: { initial: TransportPolicyValue }) {
  const [v, setV] = useState(initial);
  return <TransportPolicyCard value={v} transports={['MQTT', 'HTTP', 'ANY', 'LORAWAN']} onChange={(p) => setV({ ...v, ...p })} />;
}
function ProtocolMappingDemo({ initial }: { initial: ProtocolMappingValue }) {
  const [v, setV] = useState(initial);
  return <ProtocolMappingCard value={v} onChange={(p) => setV({ ...v, ...p })} />;
}
function RateLimitDemo({ initial, errors }: { initial: ProfileRateLimits; errors?: Partial<Record<keyof ProfileRateLimits, string>> }) {
  const [v, setV] = useState(initial);
  return <RateLimitEditor value={v} onChange={setV} errors={errors} />;
}
function TelemetryKeysDemo() {
  const [v, setV] = useState(TELEMETRY_KEYS);
  return <TelemetryKeySchemaTable value={v} onChange={setV} />;
}
function CfgKeysDemo() {
  const [v, setV] = useState(CFG_KEYS);
  return <CfgSchemaTable value={v} onChange={setV} />;
}
function NewProfileDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Fixture>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>New profile</Button>
      {open && <NewDeviceProfileDrawer open transports={['MQTT', 'HTTP', 'ANY', 'LORAWAN']} onClose={() => setOpen(false)} onCreated={() => setOpen(false)} />}
    </Fixture>
  );
}
function AlarmRuleDrawerDemo({ rule }: { rule: AlarmRuleDefinition }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit {rule.type}</Button>
      {open && <AlarmRuleDrawer open rule={rule} others={[]} onApply={() => setOpen(false)} onClose={() => setOpen(false)} />}
    </>
  );
}

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
      description: 'The IoT bell: the count of OPEN alarms (its dot in the colour of the worst severity), the latest open alarms with inline acknowledge, Acknowledge all (behind a confirmation with an optional note), and View all. Counts and list follow the live alarm events without asking the host again (alarm-bell-state.ts); the host is asked at the start, after a reconnect, when the list runs short and every 5 minutes. In a host that already has a bell, useAlarmBellSource puts the alarms into its NotificationMenu\'s one list (sources): their severity look, device and site, inline Acknowledge, a click that opens the alarm, and every OPEN alarm in the badge. AlarmBellSection (a section above that list) still works.',
      filePath: 'modules/domains/iot/alarm/AlarmBellMenu.tsx',
      usage: `<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => \`/alarms/\${id}\` }} />`,
      variants: [
        { title: 'With open alarms', layout: 'side', preview: <Fixture><div className="flex justify-end"><AlarmBellMenu hrefs={hrefs} now={NOW} /></div></Fixture>, code: '<AlarmBellMenu hrefs={hrefs} />' },
        { title: 'Five at most', layout: 'side', preview: <Fixture><div className="flex justify-end"><AlarmBellMenu hrefs={hrefs} limit={2} now={NOW} /></div></Fixture>, code: '<AlarmBellMenu hrefs={hrefs} limit={2} />' },
        { title: 'One bell: a section of the notification menu', layout: 'side', preview: <Fixture><OneBell /></Fixture>, code: 'const [alarms, setAlarms] = useState(0);\n<NotificationMenu items={items} extraCount={alarms} sections={<AlarmBellSection hrefs={hrefs} onCount={setAlarms} />} />' },
        { title: 'One bell, one list: the alarms are items of the notification menu', layout: 'side', preview: <Fixture><OneList /></Fixture>, code: 'const alarms = useAlarmBellSource({ hrefs, onNavigate: router.push });\n<NotificationMenu items={notifications} sources={alarms ? [alarms] : []} />' },
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
      id: 'iot-device-log-timeline',
      title: 'DeviceLogTimeline',
      abbr: 'DG',
      description: 'Everything that happened to one device, newest first: the connection log (with the client address and transport) and the audited changes with who made them, a chip row All / Connections / Changes, paged; compact for short lists.',
      filePath: 'modules/domains/iot/device/DeviceLogTimeline.tsx',
      usage: `<DeviceLogTimeline entries={entries} filter={filter} onFilterChange={setFilter} hasMore={more} onLoadMore={next} />`,
      variants: [
        { title: 'With the filter', layout: 'stack', preview: <LogFilterDemo />, code: '<DeviceLogTimeline entries={entries} filter={filter} onFilterChange={setFilter} />' },
        { title: 'Compact (the quick view)', layout: 'stack', preview: <DeviceLogTimeline entries={LOG_SORTED.slice(0, 5)} compact locale="en-GB" />, code: '<DeviceLogTimeline entries={recent} compact />' },
        { title: 'Empty', layout: 'stack', preview: <DeviceLogTimeline entries={[]} />, code: '<DeviceLogTimeline entries={[]} />' },
      ],
    }),
    entry({
      id: 'iot-device-quick-view',
      title: 'DeviceQuickView',
      abbr: 'DQ',
      description: 'A device seen from its list in a right-side drawer: connection, IP address, profile, firmware, the five newest log lines, copy ID and the full page; ↑ / ↓ and Previous / Next move through the list page, Esc closes. DeviceListView opens it on a row click and keeps it in the URL.',
      filePath: 'modules/domains/iot/device/DeviceQuickView.tsx',
      usage: `<DeviceQuickView open deviceId={id} device={row} onClose={close} onPrevious={prev} onNext={next} href={hrefs.device(id)} />`,
      variants: [
        { title: 'Open it', layout: 'side', preview: <QuickViewDemo />, code: '<DeviceQuickView open … />' },
        { title: 'Inside DeviceListView', layout: 'side', preview: <p className="text-sm text-text-secondary">The list view opens it when a row is clicked (the name still links the page).</p>, code: '<DeviceListView hrefs={hrefs} initialQuery={{ device }} onQueryChange={toUrl} />' },
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
      description: 'One device through the adapter: header with copy id, Activate and delete, tabs Overview, Attributes, Credentials (only with the capability) and Log (connections and audited changes), plus tabs other modules contribute.',
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
    entry({
      id: 'iot-rpc-status-badge',
      title: 'RpcStatusBadge',
      abbr: 'RV',
      description: 'An RPC request status (queued, sent, delivered, successful, failed, timed out, expired, cancelled) with its outcome: a timeout reads "outcome unknown", never "did not run".',
      filePath: 'modules/domains/iot/rpc/RpcStatusBadge.tsx',
      usage: `<RpcStatusBadge status={r.status} outcome={r.outcome} />`,
      variants: [
        { title: 'Statuses', layout: 'side', preview: <div className="flex flex-wrap gap-2">{(['QUEUED', 'SENT', 'DELIVERED', 'SUCCESSFUL', 'FAILED', 'TIMEOUT', 'EXPIRED', 'CANCELLED'] as const).map((s) => <RpcStatusBadge key={s} status={s} />)}</div>, code: '<RpcStatusBadge status="DELIVERED" />' },
        { title: 'With an outcome, medium', layout: 'side', preview: <div className="flex gap-2"><RpcStatusBadge status="TIMEOUT" outcome="unknown" size="md" /><RpcStatusBadge status="SUCCESSFUL" outcome="running" size="md" /></div>, code: '<RpcStatusBadge status="TIMEOUT" outcome="unknown" />' },
      ],
    }),
    entry({
      id: 'iot-rpc-send-panel',
      title: 'RpcSendPanel',
      abbr: 'RP',
      description: 'Send a command of the device profile catalog: declared parameters through SchemaForm, one-way, timeout, persistent delivery; a tier the viewer may not send is greyed; a high-impact command asks for its typed phrase; never a factory reset (OD-8); disabled with the reason for a ThingsBoard-scheme device (OD-85).',
      filePath: 'modules/domains/iot/rpc/RpcSendPanel.tsx',
      usage: `<RpcSendPanel commands={catalog.commands} canSendRaw={catalog.canSendRaw} supported={catalog.supported} deviceOnline={device.online} onSend={(i) => api.send(deviceId, i)} />`,
      variants: [
        { title: 'Catalog with a typed confirmation', layout: 'stack', preview: <RpcSendPanel commands={RPC_COMMANDS} deviceOnline={false} onSend={() => wait()} />, code: '<RpcSendPanel commands={commands} onSend={send} />' },
        { title: 'ThingsBoard-scheme device', layout: 'stack', preview: <RpcSendPanel commands={[]} supported={false} onSend={() => wait()} />, code: '<RpcSendPanel commands={[]} supported={false} onSend={send} />' },
      ],
    }),
    entry({
      id: 'iot-rpc-request-list',
      title: 'RpcRequestList',
      abbr: 'RL',
      description: 'RPC requests newest first: method, status with outcome, who sent it (console, a flow, a dashboard control), created and duration; a row opens the detail.',
      filePath: 'modules/domains/iot/rpc/RpcRequestList.tsx',
      usage: `<RpcRequestList requests={items} onOpen={open} hasMore={!!cursor} onLoadMore={more} />`,
      variants: [
        { title: 'Fleet log', layout: 'stack', preview: <RpcRequestList requests={RPC_REQUESTS} showDevice now={NOW} locale="en-GB" onOpen={() => undefined} />, code: '<RpcRequestList requests={items} showDevice />' },
        { title: 'Empty', layout: 'stack', preview: <RpcRequestList requests={[]} />, code: '<RpcRequestList requests={[]} />' },
      ],
    }),
    entry({
      id: 'iot-rpc-request-detail',
      title: 'RpcRequestDetail',
      abbr: 'RQ',
      description: 'One RPC request in a drawer: the request, the answer or the error, the progress timeline, send again and cancel (queued or sent only).',
      filePath: 'modules/domains/iot/rpc/RpcRequestDetail.tsx',
      usage: `<RpcRequestDetail open request={r} onClose={close} onCancel={cancel} onRerun={rerun} />`,
      variants: [
        { title: 'Answered', layout: 'side', preview: <RpcDetailDemo request={RPC_REQUESTS[0]} />, code: '<RpcRequestDetail open request={answered} … />' },
        { title: 'Queued (cancellable)', layout: 'side', preview: <RpcDetailDemo request={RPC_REQUESTS[2]} />, code: '<RpcRequestDetail open request={queued} onCancel={cancel} />' },
      ],
    }),
    entry({
      id: 'iot-rpc-console-view',
      title: 'RpcConsoleView',
      abbr: 'RW',
      description: 'A device command console through the IoT adapter: send panel over the catalog and the live history (a request moves through its states without a reload); without a device, the fleet log.',
      filePath: 'modules/domains/iot/rpc/RpcConsoleView.tsx',
      usage: `<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId={id} deviceOnline={device.online} /></IotAdapterProvider>`,
      variants: [
        { title: 'Device console', layout: 'stack', preview: <Fixture><RpcConsoleView deviceId="d1" now={NOW} /></Fixture>, code: '<RpcConsoleView deviceId="d1" />' },
        { title: 'Fleet log', layout: 'stack', preview: <Fixture><RpcConsoleView now={NOW} /></Fixture>, code: '<RpcConsoleView />' },
      ],
    }),
    entry({
      id: 'iot-device-profile-card',
      title: 'DeviceProfileCard',
      abbr: 'PE',
      description: 'One device profile at a glance: name, the default star, the template it was copied from, its transport and online rule, and how many devices use it.',
      filePath: 'modules/domains/iot/profile/DeviceProfileCard.tsx',
      usage: `<DeviceProfileCard profile={p} deviceCount={usage.devices} href={profileHref(p.profileId)} />`,
      variants: [
        { title: 'Default profile', layout: 'side', preview: <div className="max-w-sm"><DeviceProfileCard profile={PROFILES[0]} deviceCount={12} href="#p1" /></div>, code: '<DeviceProfileCard profile={p} deviceCount={12} />' },
        { title: 'Template copy, count unknown', layout: 'side', preview: <div className="max-w-sm"><DeviceProfileCard profile={PROFILES[1]} deviceCount={null} /></div>, code: '<DeviceProfileCard profile={copy} deviceCount={null} />' },
      ],
    }),
    entry({
      id: 'iot-device-profile-list-view',
      title: 'DeviceProfileListView',
      abbr: 'PN',
      description: 'The device profiles through the IoT adapter: search, transport and online-rule filters, the default first, device counts refreshed every 30 s, New profile (explicit online rule, OD-63), Make default and delete (the host refuses the default and a profile in use).',
      filePath: 'modules/domains/iot/profile/DeviceProfileListView.tsx',
      usage: `<IotAdapterProvider adapter={adapter}><DeviceProfileListView hrefs={{ profile: (id) => \`/profiles/\${id}\` }} /></IotAdapterProvider>`,
      variants: [
        { title: 'Profiles', layout: 'stack', preview: <Fixture><DeviceProfileListView hrefs={hrefs} now={NOW} /></Fixture>, code: '<DeviceProfileListView hrefs={hrefs} />' },
        { title: 'Read error, read-only', layout: 'stack', preview: <Fixture fail><DeviceProfileListView hrefs={hrefs} /></Fixture>, code: '<DeviceProfileListView hrefs={hrefs} />' },
      ],
    }),
    entry({
      id: 'iot-device-profile-editor-view',
      title: 'DeviceProfileEditorView',
      abbr: 'QE',
      description: 'One device profile through the IoT adapter: General, Transport & auth, Online status, Limits, Telemetry keys, Configuration keys and Provisioning on one draft with one Save that sends only the changed fields and blocks what the host would refuse; contributed tabs (alarm rules, commands) follow.',
      filePath: 'modules/domains/iot/profile/DeviceProfileEditorView.tsx',
      usage: `<DeviceProfileEditorView profileId={id} extraTabs={[{ id: 'alarm-rules', label: 'Alarm rules', content: <AlarmRuleSetEditor profileId={id} /> }]} />`,
      variants: [
        { title: 'Editable profile with contributed tabs', layout: 'stack', preview: <Fixture><DeviceProfileEditorView profileId="p1" extraTabs={[{ id: 'alarm-rules', label: 'Alarm rules', content: <AlarmRuleSetEditor profileId="p1" /> }, { id: 'commands', label: 'Commands', content: <RpcCommandCatalogEditor profileId="p1" /> }]} /></Fixture>, code: '<DeviceProfileEditorView profileId="p1" extraTabs={tabs} />' },
        { title: 'Template copy (schemas from firmware)', layout: 'stack', preview: <Fixture><DeviceProfileEditorView profileId="p2" tab="telemetry" /></Fixture>, code: '<DeviceProfileEditorView profileId="p2" tab="telemetry" />' },
      ],
    }),
    entry({
      id: 'iot-new-device-profile-drawer',
      title: 'NewDeviceProfileDrawer',
      abbr: 'QN',
      description: 'New device profile: name, description, transport and an explicit online rule (nothing preselected for any transport, Create disabled until one is chosen, OD-63); the rest takes the protocol defaults.',
      filePath: 'modules/domains/iot/profile/NewDeviceProfileDrawer.tsx',
      usage: `<NewDeviceProfileDrawer open onClose={close} onCreated={(p) => router.push(href(p.profileId))} />`,
      variants: [
        { title: 'Open the drawer', layout: 'side', preview: <NewProfileDemo />, code: '<NewDeviceProfileDrawer open onClose={close} />' },
        { title: 'With LoRaWAN', layout: 'side', preview: <NewProfileDemo />, code: "<NewDeviceProfileDrawer open transports={['MQTT', 'HTTP', 'ANY', 'LORAWAN']} onClose={close} />" },
      ],
    }),
    entry({
      id: 'iot-online-rule-field',
      title: 'OnlineRuleField',
      abbr: 'OR',
      description: 'The online rule of a profile (OD-57): live connection, recent message (interval × factor with a live "offline after" hint) or last seen only. Required and empty on a new profile (OD-63); a rule the transport cannot serve is disabled with the reason, and a chosen one that became impossible blocks saving.',
      filePath: 'modules/domains/iot/profile/OnlineRuleField.tsx',
      usage: `<OnlineRuleField value={{ onlineRule, expectedIntervalS, onlineWindowFactor }} transport={transportType} onChange={set} />`,
      variants: [
        { title: 'New profile: nothing chosen', layout: 'stack', preview: <OnlineRuleDemo transport="MQTT" initial={{ onlineRule: null, expectedIntervalS: null, onlineWindowFactor: 3 }} />, code: '<OnlineRuleField value={{ onlineRule: null, … }} transport="MQTT" />' },
        { title: 'Recent message on HTTP', layout: 'stack', preview: <OnlineRuleDemo transport="HTTP" initial={{ onlineRule: 'UPLINK_WINDOW', expectedIntervalS: 600, onlineWindowFactor: 3 }} />, code: '<OnlineRuleField value={{ onlineRule: "UPLINK_WINDOW", expectedIntervalS: 600, onlineWindowFactor: 3 }} transport="HTTP" />' },
        { title: 'Live connection chosen, transport became LoRaWAN', layout: 'stack', preview: <OnlineRuleDemo transport="LORAWAN" initial={{ onlineRule: 'LIVE_SOCKET', expectedIntervalS: null, onlineWindowFactor: 3 }} />, code: '<OnlineRuleField value={{ onlineRule: "LIVE_SOCKET", … }} transport="LORAWAN" />' },
      ],
    }),
    entry({
      id: 'iot-auth-mode-selector',
      title: 'AuthModeSelector',
      abbr: 'AM',
      description: 'The authentication modes a profile allows: access token, MQTT basic (always a username and a password, OD-163: no client-ID-only mode) and X.509; at least one; locked for an X.509-only template.',
      filePath: 'modules/domains/iot/profile/AuthModeSelector.tsx',
      usage: `<AuthModeSelector value={allowedAuthModes} onChange={set} />`,
      variants: [
        { title: 'Token and MQTT basic', layout: 'stack', preview: <AuthModeDemo initial={['ACCESS_TOKEN', 'MQTT_BASIC']} />, code: "<AuthModeSelector value={['ACCESS_TOKEN', 'MQTT_BASIC']} />" },
        { title: 'Locked to X.509', layout: 'stack', preview: <AuthModeDemo initial={['X509_CERTIFICATE']} locked />, code: "<AuthModeSelector value={['X509_CERTIFICATE']} locked />" },
      ],
    }),
    entry({
      id: 'iot-transport-policy-card',
      title: 'TransportPolicyCard',
      abbr: 'TP',
      description: 'How a profile’s devices reach the platform: transport, TLS only or plain MQTT (OD-160, TLS by default), tokens in the URL for devices without headers (OD-161, HTTP-only) and the networks devices may connect from (invalid entries named).',
      filePath: 'modules/domains/iot/profile/TransportPolicyCard.tsx',
      usage: `<TransportPolicyCard value={draft} onChange={(p) => set(p)} />`,
      variants: [
        { title: 'TLS only, pinned network', layout: 'stack', preview: <TransportPolicyDemo initial={{ transportType: 'ANY', mqttTransport: 'TLS_REQUIRED', allowTokenInUrl: false, allowedNetworks: ['203.0.113.0/24'], plaintextRpcMethods: [] }} />, code: '<TransportPolicyCard value={{ transportType: "ANY", mqttTransport: "TLS_REQUIRED", … }} />' },
        { title: 'Plain MQTT and URL tokens (warns)', layout: 'stack', preview: <TransportPolicyDemo initial={{ transportType: 'MQTT', mqttTransport: 'PLAINTEXT_ALLOWED', allowTokenInUrl: true, allowedNetworks: [], plaintextRpcMethods: ['sys.info', 'fan.set'] }} />, code: '<TransportPolicyCard value={{ mqttTransport: "PLAINTEXT_ALLOWED", plaintextRpcMethods: ["sys.info", "fan.set"], … }} />' },
      ],
    }),
    entry({
      id: 'iot-protocol-mapping-card',
      title: 'ProtocolMappingCard',
      abbr: 'QM',
      description: 'Topic schemes (Roltek default and/or ThingsBoard compatible, at least one; ThingsBoard carries telemetry and attributes only, OD-85) and custom topics with the decided limits 8 / 128 / 50 / 4 KB (OD-35, OD-43).',
      filePath: 'modules/domains/iot/profile/ProtocolMappingCard.tsx',
      usage: `<ProtocolMappingCard value={draft} onChange={(p) => set(p)} />`,
      variants: [
        { title: 'Roltek default', layout: 'stack', preview: <ProtocolMappingDemo initial={{ topicSchemes: ['ROLTEK'], anyTopicEnabled: true, prefixKeysWithTopic: false, maxTopicDepth: 8, maxTopicLength: 128, maxDistinctTopicsPerDevice: 50, rawMaxBytes: 4096 }} />, code: "<ProtocolMappingCard value={{ topicSchemes: ['ROLTEK'], … }} />" },
        { title: 'Both schemes', layout: 'stack', preview: <ProtocolMappingDemo initial={{ topicSchemes: ['ROLTEK', 'TB'], anyTopicEnabled: false, prefixKeysWithTopic: false, maxTopicDepth: 8, maxTopicLength: 128, maxDistinctTopicsPerDevice: 50, rawMaxBytes: 4096 }} />, code: "<ProtocolMappingCard value={{ topicSchemes: ['ROLTEK', 'TB'], … }} />" },
      ],
    }),
    entry({
      id: 'iot-rate-limit-editor',
      title: 'RateLimitEditor',
      abbr: 'RA',
      description: 'Per-device rate limits in the protocol notation: each family is up to four windows count : seconds, each longer than the one before; an invalid family is marked, a changed one can go back to the protocol default.',
      filePath: 'modules/domains/iot/profile/RateLimitEditor.tsx',
      usage: `<RateLimitEditor value={draft.rateLimits} onChange={(v) => set({ rateLimits: v })} />`,
      variants: [
        { title: 'Protocol defaults', layout: 'stack', preview: <RateLimitDemo initial={{ ...DEFAULT_RATE_LIMITS }} />, code: '<RateLimitEditor value={DEFAULT_RATE_LIMITS} />' },
        { title: 'A family with an error', layout: 'stack', preview: <RateLimitDemo initial={{ ...DEFAULT_RATE_LIMITS, telemetry_msgs: '300:60,10:1' }} errors={{ telemetry_msgs: 'Each window is count:seconds, each longer than the one before.' }} />, code: "<RateLimitEditor value={{ …, telemetry_msgs: '300:60,10:1' }} errors={{ telemetry_msgs: '…' }} />" },
      ],
    }),
    entry({
      id: 'iot-telemetry-key-schema-table',
      title: 'TelemetryKeySchemaTable',
      abbr: 'TK',
      description: 'A profile’s fallback telemetry keys (key, type, unit, label, range, decimals) for devices without a firmware description; read-only with a "from firmware" badge when profile.json describes them (P-4).',
      filePath: 'modules/domains/iot/profile/TelemetryKeySchemaTable.tsx',
      usage: `<TelemetryKeySchemaTable value={draft.telemetrySchema} onChange={(v) => set({ telemetrySchema: v })} />`,
      variants: [
        { title: 'Editable', layout: 'stack', preview: <TelemetryKeysDemo />, code: '<TelemetryKeySchemaTable value={keys} onChange={setKeys} />' },
        { title: 'From firmware (read-only)', layout: 'stack', preview: <TelemetryKeySchemaTable value={TELEMETRY_KEYS} fromFirmware="roltek-esp32 1.8.2" />, code: '<TelemetryKeySchemaTable value={keys} fromFirmware="roltek-esp32 1.8.2" />' },
      ],
    }),
    entry({
      id: 'iot-cfg-schema-table',
      title: 'CfgSchemaTable',
      abbr: 'QC',
      description: 'A profile’s fallback cfg.* allowlist: integer, boolean or string keys with ranges, lengths, allowed values and the write-only secret flag; read-only when the firmware describes them.',
      filePath: 'modules/domains/iot/profile/CfgSchemaTable.tsx',
      usage: `<CfgSchemaTable value={draft.cfgSchema} onChange={(v) => set({ cfgSchema: v })} />`,
      variants: [
        { title: 'Editable', layout: 'stack', preview: <CfgKeysDemo />, code: '<CfgSchemaTable value={keys} onChange={setKeys} />' },
        { title: 'From firmware (read-only)', layout: 'stack', preview: <CfgSchemaTable value={CFG_KEYS} fromFirmware="roltek-openwrt 24.10.1" />, code: '<CfgSchemaTable value={keys} fromFirmware="…" />' },
      ],
    }),
    entry({
      id: 'iot-provisioning-settings-card',
      title: 'ProvisioningSettingsCard',
      abbr: 'QP',
      description: 'A profile’s provisioning strategy (strategies the host cannot serve yet are marked) and its provisioning keys; without the host’s key management the keys are a clearly disabled placeholder and no secret is ever drawn (OD-1).',
      filePath: 'modules/domains/iot/profile/ProvisioningSettingsCard.tsx',
      usage: `<ProvisioningSettingsCard strategy={draft.provisionStrategy} availableStrategies={['DISABLED']} />`,
      variants: [
        { title: 'No provisioning yet (placeholder)', layout: 'stack', preview: <ProvisioningSettingsCard strategy="DISABLED" />, code: '<ProvisioningSettingsCard strategy="DISABLED" />' },
        { title: 'Strategies offered', layout: 'stack', preview: <ProvisioningSettingsCard strategy="CHECK_PRE_PROVISIONED_DEVICES" availableStrategies={['DISABLED', 'ALLOW_CREATE_NEW_DEVICES', 'CHECK_PRE_PROVISIONED_DEVICES']} />, code: "<ProvisioningSettingsCard strategy=\"CHECK_PRE_PROVISIONED_DEVICES\" availableStrategies={[…]} />" },
        { title: 'With the keys panel', layout: 'stack', preview: <ProvisioningSettingsCard strategy="ALLOW_CREATE_NEW_DEVICES" availableStrategies={['DISABLED', 'ALLOW_CREATE_NEW_DEVICES', 'CHECK_PRE_PROVISIONED_DEVICES']} keys={<ProvisioningKeysDemo />} />, code: '<ProvisioningSettingsCard strategy={draft.provisionStrategy} availableStrategies={served} keys={<ProvisioningKeysPanel profileId={id} />} />' },
      ],
    }),
    entry({
      id: 'iot-provisioning-keys-panel',
      title: 'ProvisioningKeysPanel',
      abbr: 'PK',
      description: 'A profile’s provisioning keys through the IoT adapter (OD-1): the keys in a DataTable (key id and key, state, created, until when an old key is accepted), Create / Replace key with the days the old key keeps working, the new secret shown once with copy and “you will not see it again”, and Revoke through the ConfirmDialog with a reason and the key id typed again.',
      filePath: 'modules/domains/iot/profile/ProvisioningKeysPanel.tsx',
      usage: `<IotAdapterProvider adapter={adapter}><ProvisioningKeysPanel profileId={id} onInfo={(i) => setServed(i.availableStrategies)} /></IotAdapterProvider>`,
      variants: [
        { title: 'Keys of a customer profile', layout: 'stack', preview: <ProvisioningKeysDemo />, code: '<ProvisioningKeysPanel profileId="p1" />' },
        { title: 'Keys of a factory template (no grace)', layout: 'stack', preview: <ProvisioningKeysDemo factory />, code: '<ProvisioningKeysPanel profileId="roltek-m1" />' },
        { title: 'No key yet', layout: 'stack', preview: <ProvisioningKeysDemo empty />, code: '<ProvisioningKeysPanel profileId="p2" />' },
      ],
    }),
    entry({
      id: 'iot-alarm-rule-set-editor',
      title: 'AlarmRuleSetEditor',
      abbr: 'RG',
      description: 'The alarm rules of a device profile through the IoT adapter: rule cards with the comparison per severity, add a threshold or the device-offline rule, edit in a drawer (form or JSON), remove; Save rules replaces the whole set. Read-only without canManageAlarmRules.',
      filePath: 'modules/domains/iot/alarm/AlarmRuleSetEditor.tsx',
      usage: `<IotAdapterProvider adapter={adapter}><AlarmRuleSetEditor profileId={id} /></IotAdapterProvider>`,
      variants: [
        { title: 'Rules', layout: 'stack', preview: <Fixture><AlarmRuleSetEditor profileId="p1" /></Fixture>, code: '<AlarmRuleSetEditor profileId="p1" />' },
        { title: 'Read error', layout: 'stack', preview: <Fixture fail><AlarmRuleSetEditor profileId="p1" /></Fixture>, code: '<AlarmRuleSetEditor profileId="p1" />' },
      ],
    }),
    entry({
      id: 'iot-alarm-rule-drawer',
      title: 'AlarmRuleDrawer',
      abbr: 'QD',
      description: 'Edits one alarm rule as a form (one comparison per severity, optional topic, debounce, hysteresis, runbook; or the offline delay) or as JSON for combined conditions; Apply returns it to the set.',
      filePath: 'modules/domains/iot/alarm/AlarmRuleDrawer.tsx',
      usage: `<AlarmRuleDrawer open rule={rule} others={otherRules} onApply={apply} onClose={close} />`,
      variants: [
        { title: 'Threshold rule', layout: 'side', preview: <AlarmRuleDrawerDemo rule={RULES[0]} />, code: '<AlarmRuleDrawer open rule={threshold} … />' },
        { title: 'Device offline rule', layout: 'side', preview: <AlarmRuleDrawerDemo rule={RULES[1]} />, code: '<AlarmRuleDrawer open rule={offline} … />' },
      ],
    }),
    entry({
      id: 'iot-rpc-command-catalog-editor',
      title: 'RpcCommandCatalogEditor',
      abbr: 'QR',
      description: 'The command catalog of a device profile through the IoT adapter: tier, high impact with a typed phrase, one-way, long-running, parameters; add, edit, remove, export and import (replaces the catalog after typing REPLACE). Never a factory reset (OD-8).',
      filePath: 'modules/domains/iot/rpc/RpcCommandCatalogEditor.tsx',
      usage: `<IotAdapterProvider adapter={adapter}><RpcCommandCatalogEditor profileId={id} /></IotAdapterProvider>`,
      variants: [
        { title: 'Catalog', layout: 'stack', preview: <Fixture><RpcCommandCatalogEditor profileId="p1" /></Fixture>, code: '<RpcCommandCatalogEditor profileId="p1" />' },
        { title: 'Read error', layout: 'stack', preview: <Fixture fail><RpcCommandCatalogEditor profileId="p1" /></Fixture>, code: '<RpcCommandCatalogEditor profileId="p1" />' },
      ],
    }),
    entry({
      id: 'iot-asset-kind-badge',
      title: 'AssetKindBadge',
      abbr: 'AG',
      description: 'The icon and label of an asset kind: site, building, floor, room, area, line, machine. Kinds are free: any other kind gets a neutral icon and its own name.',
      filePath: 'modules/domains/iot/asset/AssetKindBadge.tsx',
      usage: `<AssetKindBadge kind="BUILDING" />`,
      variants: [
        { title: 'Suggested kinds', layout: 'side', preview: <div className="flex flex-wrap gap-2">{['SITE', 'BUILDING', 'FLOOR', 'ROOM', 'AREA', 'LINE', 'MACHINE', 'OTHER'].map((k) => <AssetKindBadge key={k} kind={k} />)}</div>, code: '<AssetKindBadge kind="SITE" />' },
        { title: 'Free kind and icon only', layout: 'side', preview: <div className="flex items-center gap-3"><AssetKindBadge kind="COLD_STORE" /><AssetKindBadge kind="MACHINE" iconOnly /><AssetKindBadge kind="SITE" size="md" /></div>, code: '<AssetKindBadge kind="COLD_STORE" />' },
      ],
    }),
    entry({
      id: 'iot-asset-breadcrumb',
      title: 'AssetBreadcrumb',
      abbr: 'AI',
      description: 'An asset path from the materialised path, root first, each step with its kind icon and a link; long paths collapse in the middle.',
      filePath: 'modules/domains/iot/asset/AssetBreadcrumb.tsx',
      usage: `<AssetBreadcrumb path={asset.ancestors} href={(id) => assetHref(id)} />`,
      variants: [
        { title: 'Linked path', layout: 'stack', preview: <AssetBreadcrumb path={['plant', 'bldg-a', 'line-3', 'press-3'].map((id) => crumbOf(findAsset(id)!.node))} href={(id) => `#asset-${id}`} currentLast />, code: '<AssetBreadcrumb path={path} href={href} currentLast />' },
        { title: 'Collapsed', layout: 'stack', preview: <AssetBreadcrumb path={['plant', 'bldg-b', 'floor-2', 'server-room'].map((id) => crumbOf(findAsset(id)!.node))} maxItems={3} />, code: '<AssetBreadcrumb path={path} maxItems={3} />' },
      ],
    }),
    entry({
      id: 'iot-asset-tree',
      title: 'AssetTree',
      abbr: 'AU',
      description: 'The site and asset tree on the generic TreeView, with search that keeps every hit with its ancestors, an empty state with the host action, and keyboard navigation.',
      filePath: 'modules/domains/iot/asset/AssetTree.tsx',
      usage: `<AssetTree nodes={tree} selectedId={id} onSelect={open} />`,
      variants: [
        { title: 'Tree', layout: 'side', preview: <AssetTreeDemo />, code: '<AssetTree nodes={tree} selectedId={id} onSelect={setId} />' },
        { title: 'Empty', layout: 'side', preview: <AssetTree nodes={[]} emptyAction={<Button variant="primary" size="sm">New site</Button>} />, code: '<AssetTree nodes={[]} emptyAction={newSite} />' },
      ],
    }),
    entry({
      id: 'iot-assets-view',
      title: 'AssetsView',
      abbr: 'AV',
      description: 'The Sites & assets page through the IoT adapter: a KPI row, one DataTable of every site and asset (search over name, code or place; site, kind and alarm filters; sortable columns; server paging), a row opening the asset drawer, Map, ⋯ and New site; the filters and the open drawer belong to the host URL.',
      filePath: 'modules/domains/iot/asset/AssetsView.tsx',
      usage: `<IotAdapterProvider adapter={adapter}><AssetsView initialQuery={fromUrl} onQueryChange={toUrl} hrefs={{ device, alarms }} /></IotAdapterProvider>`,
      variants: [
        { title: 'Fixture adapter', layout: 'stack', preview: <AssetsViewDemo />, code: '<AssetsView initialQuery={q} onQueryChange={setQ} hrefs={hrefs} />' },
        { title: 'Failing adapter', layout: 'stack', preview: <AssetsViewDemo fail />, code: '<AssetsView />' },
      ],
    }),
    entry({
      id: 'iot-asset-drawer',
      title: 'AssetDrawer',
      abbr: 'AW',
      description: 'One site or asset in a right-side drawer over the table: the actions in the header (add a child, edit; Move to… and delete in the ⋯ menu, labels folding to icons on a phone), then sections one under the other: path, Overview (inherited time zone, location), Attributes, Devices (placed here or below, Place devices), Child assets and Relations.',
      filePath: 'modules/domains/iot/asset/AssetDrawer.tsx',
      usage: `<AssetDrawer assetId={id} onClose={close} onOpenAsset={open} onChanged={reread} hrefs={{ device }} />`,
      variants: [
        { title: 'A site', layout: 'stack', preview: <AssetDrawerDemo assetId="plant" />, code: '<AssetDrawer assetId="plant" onClose={close} />' },
        { title: 'A building', layout: 'stack', preview: <AssetDrawerDemo assetId="bldg-a" />, code: '<AssetDrawer assetId="bldg-a" onClose={close} />' },
      ],
    }),
    entry({
      id: 'iot-assets-map-drawer',
      title: 'AssetsMapDrawer',
      abbr: 'MQ',
      description: 'The sites on the map in a wide drawer: markers coloured by the worst active alarm, the sites listed by alarm beside the map (under it on a phone), a site summary with List assets, Details and Alarms, and "Only with active alarms".',
      filePath: 'modules/domains/iot/asset/AssetsMapDrawer.tsx',
      usage: `<AssetsMapDrawer summary={summary} onClose={close} onListAssets={filterTo} onOpenSite={openDrawer} />`,
      variants: [
        { title: 'Fixture summary', layout: 'stack', preview: <AssetsMapDrawerDemo />, code: '<AssetsMapDrawer summary={summary} onClose={close} onListAssets={filterTo} onOpenSite={open} />' },
        { title: 'Without alarms', layout: 'stack', preview: <AssetsMapDrawerDemo alarms={false} />, code: '<AssetsMapDrawer summary={{ ...summary, alarms: false }} onClose={close} onListAssets={filterTo} onOpenSite={open} />' },
      ],
    }),
    entry({
      id: 'iot-placed-device-table',
      title: 'PlacedDeviceTable',
      abbr: 'AX',
      description: 'The devices placed under an asset: the device link, its online state (DeviceOnlineDot), the address of its newest connect (DeviceAddress) and the node it sits on; optional Remove placement.',
      filePath: 'modules/domains/iot/asset/PlacedDeviceTable.tsx',
      usage: `<PlacedDeviceTable rows={placed} assetId={id} deviceHref={href} onUnplace={unplace} />`,
      variants: [
        { title: 'Rows', layout: 'stack', preview: <PlacedDeviceTable rows={PLACED} assetId="bldg-a" deviceHref={(id) => `#device-${id}`} assetHref={(id) => `#asset-${id}`} onUnplace={() => undefined} now={NOW} />, code: '<PlacedDeviceTable rows={rows} assetId="bldg-a" onUnplace={unplace} />' },
        { title: 'Empty', layout: 'stack', preview: <PlacedDeviceTable rows={[]} />, code: '<PlacedDeviceTable rows={[]} />' },
      ],
    }),
    entry({
      id: 'iot-asset-relation-table',
      title: 'AssetRelationTable',
      abbr: 'AY',
      description: 'Typed relations of an asset or device: from, type and to with entity icons and links; CONTAINS towards a device is its placement.',
      filePath: 'modules/domains/iot/asset/AssetRelationTable.tsx',
      usage: `<AssetRelationTable rows={relations} hrefs={{ asset, device }} onRemove={remove} />`,
      variants: [
        { title: 'Relations', layout: 'stack', preview: <AssetRelationTable rows={RELATIONS} hrefs={{ asset: (id) => `#asset-${id}`, device: (id) => `#device-${id}` }} onRemove={() => undefined} />, code: '<AssetRelationTable rows={rows} onRemove={remove} />' },
        { title: 'Empty', layout: 'stack', preview: <AssetRelationTable rows={[]} />, code: '<AssetRelationTable rows={[]} />' },
      ],
    }),
    entry({
      id: 'iot-asset-form-drawer',
      title: 'AssetFormDrawer',
      abbr: 'AZ',
      description: 'Create or edit a site or asset: name, kind (suggested or another), code (derived when empty), description, time zone and coordinates.',
      filePath: 'modules/domains/iot/asset/AssetFormDrawer.tsx',
      usage: `<AssetFormDrawer open parent={{ assetId, name }} onClose={close} onSaved={reload} />`,
      variants: [
        { title: 'Edit', layout: 'side', preview: <AssetDialogDemo which="form" />, code: '<AssetFormDrawer open asset={asset} onClose={close} />' },
        { title: 'New child', layout: 'side', preview: <AssetDialogDemo which="child" />, code: '<AssetFormDrawer open parent={parent} onClose={close} />' },
      ],
    }),
    entry({
      id: 'iot-move-asset-dialog',
      title: 'MoveAssetDialog',
      abbr: 'AO',
      description: 'Move to…: the new parent picked in a searchable tree that leaves out the asset and everything under it (no cycle), or the top level.',
      filePath: 'modules/domains/iot/asset/MoveAssetDialog.tsx',
      usage: `<MoveAssetDialog open asset={asset} nodes={tree} onClose={close} onMoved={reload} />`,
      variants: [
        { title: 'Move a line', layout: 'side', preview: <AssetDialogDemo which="move" />, code: '<MoveAssetDialog open asset={line} nodes={tree} />' },
        { title: 'Pick a place for a device', layout: 'side', preview: <AssetDialogDemo which="picker" />, code: '<DevicePlacementPicker open value={assetId} onPick={place} />' },
      ],
    }),
    entry({
      id: 'iot-place-devices-dialog',
      title: 'PlaceDevicesDialog',
      abbr: 'DU',
      description: 'Place devices on an asset: search the devices, tick several, place them in one call; a device has one place, so placing it here moves it.',
      filePath: 'modules/domains/iot/asset/PlaceDevicesDialog.tsx',
      usage: `<PlaceDevicesDialog open asset={{ assetId, name }} placedIds={here} onClose={close} onPlaced={reload} />`,
      variants: [
        { title: 'Place devices', layout: 'side', preview: <AssetDialogDemo which="place" />, code: '<PlaceDevicesDialog open asset={asset} />' },
        { title: 'Failing adapter', layout: 'side', preview: <Fixture fail><PlaceDevicesDialog open={false} asset={{ assetId: 'press-3', name: 'Press 3' }} onClose={() => undefined} /></Fixture>, code: '<PlaceDevicesDialog open={false} … />' },
      ],
    }),
    entry({
      id: 'iot-device-placement-panel',
      title: 'DevicePlacementPanel',
      abbr: 'DV',
      description: 'Where a device is: the path of its asset with links, Change placement (DevicePlacementPicker) and Remove placement; the device page Placement tab.',
      filePath: 'modules/domains/iot/asset/DevicePlacementPanel.tsx',
      usage: `<DevicePlacementPanel deviceId={id} hrefs={{ asset }} />`,
      variants: [
        { title: 'Placed', layout: 'stack', preview: <Fixture><DevicePlacementPanel deviceId="d1" hrefs={{ asset: (id) => `#asset-${id}` }} /></Fixture>, code: '<DevicePlacementPanel deviceId="d1" hrefs={hrefs} />' },
        { title: 'Not readable', layout: 'stack', preview: <Fixture fail><DevicePlacementPanel deviceId="d1" /></Fixture>, code: '<DevicePlacementPanel deviceId="d1" />' },
      ],
    }),
  ];
}
