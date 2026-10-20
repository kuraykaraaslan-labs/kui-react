// The widget cases kui-react draws as the reference (golden.json) and kui-ejs / KUInative draw again and compare.
// Each case is plain JSON: a builtin kind, its stored settings and the bound data. "Now" is fixed so every
// relative time ("5 minutes ago", "for 12 min") is the same in every renderer.

import type { SlotData } from '../../kind';

export interface ParityCase {
  id: string;
  kind: string;
  title?: string;
  settings?: Record<string, unknown>;
  board?: Record<string, unknown>;
  data?: Record<string, SlotData>;
  /** Slots bound to a source; defaults to the keys of `data`. */
  boundSlots?: string[];
  isEditor?: boolean;
  loading?: boolean;
  error?: string;
  fixedHeight?: boolean;
  /** Host props for the view (a table's paging and row actions are interactive and not part of the goldens). */
  viewProps?: Record<string, unknown>;
}

export const PARITY_NOW = '2026-10-20T10:05:00.000Z';
export const PARITY_LOCALE = 'en';

const at = (minAgo: number) => new Date(Date.parse(PARITY_NOW) - minAgo * 60_000).toISOString();
const series = (vals: number[], meta?: SlotData['meta'], stepMin = 60): SlotData => ({
  shape: 'series', fetchedAt: at(1),
  series: [{ name: 'Load', ...(meta ? { meta } : {}), points: vals.map((v, i) => ({ t: at((vals.length - 1 - i) * stepMin), v })) }],
});
const scalar = (value: number | string | boolean | null, extra: Partial<SlotData> = {}): SlotData => ({ shape: 'scalar', value, fetchedAt: at(5), ...extra });

const withTitle = { $card: { showTitle: true } };

const TABLE: SlotData = {
  shape: 'table', fetchedAt: at(2),
  columns: [
    { key: 'name', label: 'Device', type: 'text' },
    { key: 'status', label: 'Status', type: 'text', kind: 'enum', valueMap: { Online: { label: 'Online', color: 'var(--success)' }, Offline: { label: 'Offline', color: 'var(--error)' }, Warning: { label: 'Warning', color: 'var(--warning)' } } },
    { key: 'level', label: 'Level', type: 'number', unit: 'm', decimals: 2 },
    { key: 'low', label: 'Low limit', type: 'number', decimals: 1 },
    { key: 'armed', label: 'Armed', type: 'text' },
    { key: 'seen', label: 'Last seen', type: 'date' },
  ],
  rows: [
    { name: 'Pump A', status: 'Online', level: 4.2, low: 2, armed: 'true', seen: at(3) },
    { name: 'Pump B', status: 'Warning', level: 1.5, low: 2, armed: 'true', seen: at(30) },
    { name: 'Pump C', status: 'Offline', level: 0.4, low: 1, armed: 'false', seen: at(600) },
  ],
};

export const PARITY_CASES: ParityCase[] = [
  // ── card chrome
  { id: 'card.title-buttons', kind: 'stat.value', title: 'Power', settings: { label: 'Load', $card: { showTitle: true, subtitle: 'Last hour', buttons: ['refresh', 'fullscreen'], showUpdated: 'relative' } }, data: { value: scalar(21.4) } },
  { id: 'card.no-data', kind: 'stat.value', title: 'Power', settings: withTitle },
  { id: 'card.unconfigured', kind: 'stat.value', title: 'Power', settings: withTitle, isEditor: true, boundSlots: [] },
  { id: 'card.loading', kind: 'stat.value', title: 'Power', settings: withTitle, loading: true, boundSlots: ['value'] },
  { id: 'card.error', kind: 'stat.value', title: 'Power', settings: withTitle, error: 'Could not load', boundSlots: ['value'] },
  { id: 'card.stale', kind: 'stat.value', title: 'Power', settings: { ...withTitle, $card: { showTitle: true, staleAfterSeconds: 60, staleDisplay: 'badge' } }, data: { value: scalar(7, { fetchedAt: at(30) }) } },
  // ── stat.value
  { id: 'stat.value.basic', kind: 'stat.value', title: 'Power', settings: { label: 'Load', ...withTitle }, data: { value: scalar(21.4) } },
  { id: 'stat.value.meta', kind: 'stat.value', title: 'Power', settings: withTitle, data: { value: scalar(21.43, { meta: { label: 'Room temperature', unit: '°C', decimals: 1, kind: 'number' } }) } },
  { id: 'stat.value.layout-inline', kind: 'stat.value', settings: { layout: 'inline', label: 'Orders', icon: 'fas fa-bolt', iconColor: '#2563eb' }, data: { value: scalar(1284) } },
  { id: 'stat.value.layout-centered', kind: 'stat.value', settings: { layout: 'centered', label: 'Orders', icon: 'fas fa-bolt' }, data: { value: scalar(1284) } },
  { id: 'stat.value.layout-compact', kind: 'stat.value', settings: { layout: 'compact', label: 'Orders' }, data: { value: scalar(1284) } },
  { id: 'stat.value.compare-good', kind: 'stat.value', settings: { label: 'Orders', increaseIs: 'good', compareLabel: 'vs yesterday' }, data: { value: scalar(1284), compare: scalar(1147) } },
  { id: 'stat.value.compare-bad-delta', kind: 'stat.value', settings: { label: 'Errors', increaseIs: 'bad', compareAs: 'delta' }, data: { value: scalar(18), compare: scalar(9) } },
  { id: 'stat.value.compare-direction-meta', kind: 'stat.value', settings: { label: 'CPU' }, data: { value: scalar(80, { meta: { unit: '%', decimals: 0, direction: 'lowerIsBetter' } }), compare: scalar(60) } },
  { id: 'stat.value.ranges-background', kind: 'stat.value', settings: { label: 'CPU', ranges: [{ from: 0, to: 50, color: '#16a34a' }, { from: 50, to: 101, color: '#dc2626' }], rangeTarget: 'background' }, data: { value: scalar(67) } },
  { id: 'stat.value.updated', kind: 'stat.value', settings: { label: 'Orders', showUpdated: true }, data: { value: scalar(1284) } },
  { id: 'stat.value.empty-shape', kind: 'stat.value', title: 'Power', settings: { ...withTitle, label: 'Load' }, data: {}, boundSlots: ['value'] },
  // ── stat.sparkline
  { id: 'stat.sparkline.stacked', kind: 'stat.sparkline', title: 'Load', settings: { label: 'CPU', ...withTitle }, data: { series: series([10, 12, 9, 15, 18, 16, 20], { unit: '%', decimals: 0 }) } },
  { id: 'stat.sparkline.value-top-minmax', kind: 'stat.sparkline', settings: { layout: 'value-top', showMinMax: true, increaseIs: 'good' }, data: { series: series([10, 8, 14, 9, 21, 15]) } },
  { id: 'stat.sparkline.inline-step', kind: 'stat.sparkline', settings: { layout: 'inline', curve: 'step', fill: 'none', label: 'Flow' }, data: { series: series([3, 5, 4, 8, 6]) } },
  { id: 'stat.sparkline.overlay-opacity', kind: 'stat.sparkline', settings: { layout: 'overlay', fill: 'opacity', fillOpacity: 30, lineColor: '#7c3aed' }, data: { series: series([3, 5, 4, 8, 6]) } },
  { id: 'stat.sparkline.chart-only', kind: 'stat.sparkline', settings: { layout: 'chart-only', label: 'Flow' }, data: { series: series([3, 5, 4, 8, 6]) } },
  { id: 'stat.sparkline.compare', kind: 'stat.sparkline', settings: { compareLabel: 'vs last week', showChange: 'delta' }, data: { series: series([10, 12, 15]), compare: scalar(30) } },
  { id: 'stat.sparkline.updated', kind: 'stat.sparkline', settings: { showUpdated: true }, data: { series: series([10, 12, 15], undefined, 5) } },
  // ── state
  { id: 'state.big', kind: 'state', settings: { label: 'Line', states: [{ match: 'RUNNING', label: 'Running', color: '#16a34a' }] }, data: { value: scalar('RUNNING') } },
  { id: 'state.badge', kind: 'state', settings: { layout: 'badge', states: [{ match: 'ALARM', label: 'Alarm', color: '#dc2626', icon: 'fas fa-bell', pulse: true }] }, data: { value: scalar('ALARM') } },
  { id: 'state.dot', kind: 'state', settings: { layout: 'dot', states: [{ match: 'ok', label: 'All good', color: '#16a34a' }] }, data: { value: scalar('ok') } },
  { id: 'state.tile', kind: 'state', settings: { layout: 'tile', label: 'Door', states: [{ match: '1', label: 'Open', color: '#dc2626', icon: 'fas fa-door-open' }], showSince: true }, data: { value: scalar(1, { fetchedAt: at(12) }) } },
  { id: 'state.icon', kind: 'state', settings: { layout: 'icon', states: [{ match: 'ON', label: 'On', color: '#16a34a', icon: 'fas fa-check' }] }, data: { value: scalar('ON') } },
  { id: 'state.lamp', kind: 'state', settings: { layout: 'lamp', lampSize: 64, states: [{ match: 'RUNNING', label: 'Running', color: '#16a34a' }, { match: 'STOPPED', label: 'Stopped', color: '#dc2626', lit: false }] }, data: { value: scalar('RUNNING') } },
  { id: 'state.lamp-dim', kind: 'state', settings: { layout: 'lamp', lampLabel: false, states: [{ match: 'STOPPED', label: 'Stopped', color: '#dc2626', lit: false }] }, data: { value: scalar('STOPPED') } },
  { id: 'state.unknown', kind: 'state', settings: { layout: 'badge' }, data: { value: scalar(null) } },
  { id: 'state.source-value-map', kind: 'state', settings: {}, data: { value: scalar('IDLE', { meta: { valueMap: { IDLE: { label: 'Idle', color: '#f59e0b' } } } }) } },
  // ── content
  { id: 'content.image.basic', kind: 'content.image', settings: { src: 'https://img.example.com/plan.png', alt: 'Plan', caption: 'Floor 1', captionPlacement: 'below', radius: 8 } },
  { id: 'content.image.overlay-link', kind: 'content.image', settings: { src: '/assets/a.png', alt: 'A', caption: 'Open', href: '/devices', fit: 'contain', grayscale: 40 } },
  { id: 'content.image.bound', kind: 'content.image', settings: {}, data: { source: scalar('https://img.example.com/bound.png') } },
  { id: 'content.image.empty', kind: 'content.image', settings: {} },
  { id: 'content.links.list', kind: 'content.links', settings: { links: [{ label: 'Devices', description: 'All devices', href: '/devices', icon: 'fas fa-microchip' }, { label: 'Docs', href: 'https://docs.example.com/start' }] } },
  { id: 'content.links.tiles', kind: 'content.links', settings: { layout: 'tiles', links: [{ label: 'Devices', href: '/devices', icon: 'fas fa-microchip' }, { label: 'Alarms', href: '/alarms', icon: 'fas fa-bell' }] } },
  { id: 'content.links.attr', kind: 'content.links', settings: { links: [{ label: 'Pump', href: '/pumps/{{attr_id}}' }, { label: 'Gone', href: '/pumps/{{attr_none}}' }] }, data: { record: { shape: 'record', record: { id: '7' } } } },
  { id: 'content.embed.basic', kind: 'content.embed', title: 'Grafana', settings: { url: 'https://grafana.example.com/d/abc' } },
  { id: 'content.embed.refused', kind: 'content.embed', settings: { url: 'http://insecure.example.com/' } },
  // ── data.table
  { id: 'table.basic', kind: 'data.table', title: 'Devices', settings: { ...withTitle, maxRows: 10, search: false }, data: { rows: TABLE } },
  { id: 'table.rules-sibling-gate', kind: 'data.table', settings: { search: false, rowRules: [{ column: 'level', op: 'lt', valueFrom: 'column', valueColumn: 'low', gateColumn: 'armed', color: '#dc2626', target: 'background' }] }, data: { rows: TABLE } },
  { id: 'table.columns-configured', kind: 'data.table', settings: { search: false, columns: [{ key: 'name', label: 'Pump' }, { key: 'level', cell: 'bar' }, { key: 'status', cell: 'icon' }] }, data: { rows: TABLE } },
  { id: 'table.history-layout', kind: 'data.table', settings: { search: false, historyLayout: true, onlyChanges: true }, data: { rows: TABLE } },
  { id: 'table.striped-compact', kind: 'data.table', settings: { search: false, striped: true, density: 'compact', gridLines: 'all', showRowNumbers: true }, data: { rows: TABLE } },
  { id: 'table.empty', kind: 'data.table', settings: {}, data: { rows: { shape: 'table', rows: [] } } },
];
