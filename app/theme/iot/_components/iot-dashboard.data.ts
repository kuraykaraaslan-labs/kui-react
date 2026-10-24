import type { BoardDocument, SlotData } from '@/modules/app/WidgetKit';
import { ALARMS, DEVICES, DEVICE_METRICS, WORKSPACES } from '../iot.data';

/** A named demo data source: what a placement's data slot can be bound to in this theme. */
export interface DemoSource {
  key: string;
  label: string;
  data: SlotData;
}

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const press = DEVICE_METRICS['press-line-sensor-a1'];
const series = (name: string, values: number[]) => ({
  name,
  points: values.map((v, i) => ({ t: at((values.length - 1 - i) * 5), v })),
});
const count = (status: string) => DEVICES.filter((d) => d.status === status).length;
const STATUS_TONE: Record<string, string> = { ONLINE: 'success', OFFLINE: 'neutral', ERROR: 'error', MAINTENANCE: 'warning' };
const SEVERITY_TONE: Record<string, string> = { CRITICAL: 'error', MAJOR: 'error', MINOR: 'warning', WARNING: 'warning', INFO: 'info' };
const cloud = WORKSPACES[0];

export const DEMO_SOURCES: DemoSource[] = [
  { key: 'devices.total', label: 'Devices: total', data: { shape: 'scalar', value: cloud.deviceCount, fetchedAt: at(1) } },
  { key: 'devices.online', label: 'Devices: online', data: { shape: 'scalar', value: cloud.onlineCount, fetchedAt: at(1) } },
  { key: 'devices.online.yesterday', label: 'Devices: online yesterday', data: { shape: 'scalar', value: cloud.onlineCount - 6, fetchedAt: at(1) } },
  { key: 'devices.errors', label: 'Devices: in error', data: { shape: 'scalar', value: count('ERROR'), fetchedAt: at(1) } },
  { key: 'alerts.open', label: 'Alarms: open', data: { shape: 'scalar', value: ALARMS.filter((a) => a.status === 'OPEN').length, fetchedAt: at(2) } },
  { key: 'press.temperature', label: 'Press A1: temperature (°C)', data: { shape: 'scalar', value: press.currentValues.temperatureC, fetchedAt: at(0) } },
  { key: 'press.cpu', label: 'Press A1: CPU (%)', data: { shape: 'scalar', value: press.currentValues.cpuPct, fetchedAt: at(0) } },
  { key: 'press.rpm', label: 'Press A1: RPM', data: { shape: 'scalar', value: press.rpm[press.rpm.length - 1], fetchedAt: at(0) } },
  { key: 'press.state', label: 'Press A1: status', data: { shape: 'scalar', value: 'ONLINE', fetchedAt: at(0) } },
  { key: 'pump.on', label: 'Coolant pump: on', data: { shape: 'scalar', value: true, fetchedAt: at(0) } },
  { key: 'press.setpoint', label: 'Press A1: target RPM', data: { shape: 'scalar', value: 1450, fetchedAt: at(0) } },
  { key: 'press.temperature.series', label: 'Press A1: temperature over time', data: { shape: 'series', series: [series('Temperature', press.temperature)], fetchedAt: at(0) } },
  { key: 'press.vibration.series', label: 'Press A1: vibration over time', data: { shape: 'series', series: [series('Vibration', press.vibration)], fetchedAt: at(0) } },
  { key: 'press.resources.series', label: 'Press A1: CPU and memory', data: { shape: 'series', series: [series('CPU', press.sparklines.cpu), series('Memory', press.sparklines.memory)], fetchedAt: at(0) } },
  {
    key: 'devices.table', label: 'Devices: list',
    data: {
      shape: 'table', fetchedAt: at(1),
      columns: [
        { key: 'name', label: 'Device', type: 'text' }, { key: 'model', label: 'Model', type: 'text' },
        { key: 'status', label: 'Status', type: 'text' }, { key: 'lastSeen', label: 'Last seen', type: 'date' },
      ],
      rows: DEVICES.map((d) => ({ id: d.slug, name: d.name, model: d.model ?? d.type, status: d.status.charAt(0) + d.status.slice(1).toLowerCase(), lastSeen: d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : null })),
    },
  },
  {
    key: 'devices.byStatus', label: 'Devices: by status',
    data: {
      shape: 'table', fetchedAt: at(1),
      columns: [{ key: 'label', label: 'Status', type: 'text' }, { key: 'value', label: 'Devices', type: 'number' }],
      rows: ['ONLINE', 'MAINTENANCE', 'ERROR', 'OFFLINE'].map((s) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: count(s) })),
    },
  },
  {
    key: 'devices.map', label: 'Devices: locations',
    data: {
      shape: 'table', fetchedAt: at(1),
      columns: [
        { key: 'lat', label: 'Latitude', type: 'number' }, { key: 'lng', label: 'Longitude', type: 'number' },
        { key: 'label', label: 'Device', type: 'text' }, { key: 'tone', label: 'Status', type: 'badge' }, { key: 'id', label: 'Id', type: 'text' },
      ],
      rows: DEVICES.filter((d) => d.location).map((d) => ({ lat: d.location!.lat, lng: d.location!.lng, label: d.name, tone: STATUS_TONE[d.status] ?? 'neutral', id: d.slug })),
    },
  },
  {
    key: 'alerts.feed', label: 'Alarms: latest',
    data: {
      shape: 'table', fetchedAt: at(2),
      columns: [
        { key: 'time', label: 'Time', type: 'date' }, { key: 'title', label: 'Alarm', type: 'text' },
        { key: 'description', label: 'Device', type: 'text' }, { key: 'tone', label: 'Severity', type: 'badge' },
      ],
      rows: ALARMS.map((a) => ({ time: a.openedAt ? new Date(a.openedAt).toISOString() : null, title: a.title, description: a.deviceName, tone: SEVERITY_TONE[a.severity] ?? 'neutral' })),
    },
  },
  {
    key: 'press.record', label: 'Press A1: details',
    data: { shape: 'record', fetchedAt: at(1), record: { model: 'Nexus S200', firmware: 'v2.4.1', location: 'Hall A — Bay 3', cpu: press.currentValues.cpuPct, memory: press.currentValues.memoryPct } },
  },
];

export const sourceData = (key: unknown): SlotData | undefined => DEMO_SOURCES.find((s) => s.key === key)?.data;

/** The board a first visit starts from; edits are kept in this browser. */
export const DEFAULT_IOT_BOARD: BoardDocument = {
  format: 'widgetkit.board',
  version: 1,
  templates: {},
  board: { title: `${cloud.name} · ${cloud.region}`, settings: {} },
  placements: [
    { id: 'total', type: 'stat.value', title: 'Total devices', x: 0, y: 0, w: 3, h: 3, settings: { label: 'Registered in this workspace', icon: 'fas fa-microchip' }, binding: { value: 'devices.total' } },
    { id: 'online', type: 'stat.value', title: 'Online', x: 3, y: 0, w: 3, h: 3,
      settings: { label: 'Devices reporting', icon: 'fas fa-circle-check', iconColor: 'var(--success)', iconBackground: 'var(--success-subtle)', increaseIs: 'good', compareLabel: 'vs yesterday' },
      binding: { value: 'devices.online', compare: 'devices.online.yesterday' } },
    { id: 'errors', type: 'stat.value', title: 'Errors', x: 6, y: 0, w: 3, h: 3,
      settings: { label: 'Devices in error', icon: 'fas fa-circle-exclamation', iconColor: 'var(--error)', iconBackground: 'var(--error-subtle)', ranges: [{ to: 1, color: 'var(--success)' }, { from: 1, color: 'var(--error)' }] },
      binding: { value: 'devices.errors' } },
    { id: 'alerts', type: 'stat.value', title: 'Open alerts', x: 9, y: 0, w: 3, h: 3,
      settings: { label: 'Waiting for someone', icon: 'fas fa-bell', iconColor: 'var(--warning)', iconBackground: 'var(--warning-subtle)' },
      binding: { value: 'alerts.open' } },
    { id: 'temp', type: 'chart.line', title: 'Press A1 temperature', x: 0, y: 3, w: 8, h: 7,
      settings: { $card: { subtitle: 'Last 40 minutes', showUpdated: 'relative' }, $format: { unit: '°C' } }, binding: { series: 'press.temperature.series' } },
    { id: 'gauge', type: 'gauge', title: 'Press A1 CPU', x: 8, y: 3, w: 4, h: 7,
      settings: { $format: { unit: '%' }, ranges: [{ to: 60, color: 'var(--success)' }, { from: 60, to: 85, color: 'var(--warning)' }, { from: 85, color: 'var(--error)' }] },
      binding: { value: 'press.cpu' } },
    { id: 'devices', type: 'data.table', title: 'Devices', x: 0, y: 10, w: 7, h: 8, settings: {}, binding: { rows: 'devices.table' } },
    { id: 'feed', type: 'data.feed', title: 'Latest alerts', x: 7, y: 10, w: 5, h: 8, settings: {}, binding: { events: 'alerts.feed' } },
    { id: 'status', type: 'chart.pie', title: 'Fleet status', x: 0, y: 18, w: 4, h: 7, settings: {}, binding: { slices: 'devices.byStatus' } },
    { id: 'map', type: 'map', title: 'Device locations', x: 4, y: 18, w: 8, h: 7, settings: {}, binding: { points: 'devices.map' } },
    { id: 'pump', type: 'control.switch', title: 'Coolant pump', x: 0, y: 25, w: 4, h: 3, settings: { label: 'Pump power' }, binding: { value: 'pump.on' } },
    { id: 'press-state', type: 'state', title: 'Press A1 status', x: 4, y: 25, w: 4, h: 3,
      settings: { states: [{ match: 'ONLINE', label: 'Running', color: 'var(--success)' }, { match: 'ERROR', label: 'Fault', color: 'var(--error)' }] },
      binding: { value: 'press.state' } },
    { id: 'details', type: 'stat.attributes', title: 'Press A1 details', x: 8, y: 25, w: 4, h: 5, settings: {}, binding: { record: 'press.record' } },
  ],
};
