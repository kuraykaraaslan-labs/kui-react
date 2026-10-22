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
const pointRows = (rows: Array<Record<string, unknown>>): SlotData => ({ shape: 'table', fetchedAt: at(1), rows });

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

const EVENTS: SlotData = {
  shape: 'table', fetchedAt: at(1),
  columns: [
    { key: 'time', label: 'Time', type: 'date' }, { key: 'title', label: 'Event', type: 'text' },
    { key: 'description', label: 'Detail', type: 'text' }, { key: 'severity', label: 'Severity', type: 'text' }, { key: 'icon', label: 'Icon', type: 'text' },
  ],
  rows: [
    { time: at(4), title: 'Pump A started', description: 'Started by the schedule.', severity: 'success', icon: 'fas fa-play' },
    { time: at(95), title: 'High level on Tank 2', description: 'Level 4.2 m is above the 4 m limit. Check the inlet valve before the next shift starts.', severity: 'warning' },
    { time: at(1500), title: 'Gateway offline', description: '', severity: 'error' },
    { time: 'not a date', title: 'Firmware updated', description: 'v2.4.1', severity: 'info' },
  ],
};

const RECORD: SlotData = {
  shape: 'record', fetchedAt: at(2),
  record: { serial: 'GW-2041', model: 'Edge 4', uptimeHours: 412.5, signal: -71, online: true, firmware: '2.4.1', notes: { a: 1 }, lastSeenAt: '' },
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
  // ── stat.attributes
  { id: 'attributes.list', kind: 'stat.attributes', title: 'Gateway', settings: withTitle, data: { record: RECORD } },
  { id: 'attributes.list-configured', kind: 'stat.attributes', settings: { fields: [{ key: 'uptimeHours', label: 'Uptime', unit: 'h', decimals: 0, icon: 'fas fa-clock' }, { key: 'signal', unit: 'dBm', ranges: [{ from: -200, to: -80, color: '#dc2626' }, { from: -80, to: 0, color: '#16a34a' }] }, { key: 'online' }, { key: 'missing' }], emptyValue: 'n/a', striped: true, dividerColor: '#cccccc' }, data: { record: RECORD } },
  { id: 'attributes.grid-2', kind: 'stat.attributes', settings: { layout: 'grid-2', fields: [{ key: 'uptimeHours', unit: 'h' }, { key: 'signal', unit: 'dBm' }, { key: 'model' }, { key: 'firmware' }] }, data: { record: RECORD } },
  { id: 'attributes.columns-centered', kind: 'stat.attributes', settings: { layout: 'columns', alignment: 'center', dividers: false, fields: [{ key: 'uptimeHours', unit: 'h' }, { key: 'signal', unit: 'dBm', color: '#7c3aed' }] }, data: { record: RECORD } },
  { id: 'attributes.empty-shape', kind: 'stat.attributes', title: 'Gateway', settings: { ...withTitle, fields: [{ key: 'serial' }, { key: 'model' }] }, data: {}, boundSlots: ['record'] },
  // ── data.feed
  { id: 'feed.timeline', kind: 'data.feed', title: 'Events', settings: { ...withTitle, colorColumn: 'severity', descriptionColumn: 'description', iconColumn: 'icon', indicator: 'icon' }, data: { events: EVENTS } },
  { id: 'feed.timeline-dots', kind: 'data.feed', settings: { colorColumn: 'severity', descriptionColumn: 'description', order: 'oldest', timeDisplay: 'datetime' }, data: { events: EVENTS } },
  { id: 'feed.list-grouped', kind: 'data.feed', settings: { layout: 'list', groupByDay: true, colorColumn: 'severity', descriptionColumn: 'description', timePosition: 'below', descriptionLines: 0 }, data: { events: EVENTS } },
  { id: 'feed.compact-bar', kind: 'data.feed', settings: { layout: 'compact', indicator: 'bar', colorColumn: 'severity', divider: false }, data: { events: EVENTS } },
  { id: 'feed.cards', kind: 'data.feed', settings: { layout: 'cards', colorColumn: 'severity', descriptionColumn: 'description', indicator: 'icon', iconColumn: 'icon' }, data: { events: EVENTS } },
  { id: 'feed.empty', kind: 'data.feed', title: 'Events', settings: withTitle, data: { events: { shape: 'table', rows: [] } } },
  // ── progress
  { id: 'progress.bar-labelled', kind: 'progress', title: 'Storage', settings: { ...withTitle, label: 'Used', target: 500, valueText: 'both', ranges: [{ from: 0, to: 300, color: '#16a34a' }, { from: 300, to: 500, color: '#dc2626' }], rangeDisplay: 'both', marker: 400, markerLabel: 'Quota' }, data: { value: scalar(320, { meta: { unit: 'GB', decimals: 0 } }) } },
  { id: 'progress.bar-ticks', kind: 'progress', settings: { layout: 'bar', target: 100, showTicks: true, tickCount: 3, valueText: 'percent', barGradient: true, thickness: 12 }, data: { value: scalar(42) } },
  { id: 'progress.bar-below-icon', kind: 'progress', settings: { textPosition: 'below', icon: 'fas fa-hard-drive', label: 'Disk', roundedEnds: false }, data: { value: scalar(7), target: scalar(10) } },
  { id: 'progress.ring', kind: 'progress', title: 'Goal', settings: { ...withTitle, layout: 'ring', target: 200, valueText: 'both' }, data: { value: scalar(150) } },
  { id: 'progress.semicircle', kind: 'progress', settings: { layout: 'semicircle', target: 8, label: 'Shift', valueText: 'percent' }, data: { value: scalar(6) } },
  { id: 'progress.empty-shape', kind: 'progress', title: 'Goal', settings: { ...withTitle, target: 100 }, data: {}, boundSlots: ['value'] },
  // ── gauge
  { id: 'gauge.arc-bands', kind: 'gauge', title: 'Pressure', settings: { ...withTitle, label: 'Line 1', unitTitle: 'bar', ranges: [{ from: 0, to: 12, color: '#16a34a' }, { from: 12, to: 18, color: '#f59e0b' }, { from: 18, to: 24, color: '#dc2626' }], max: 24, ticks: 3, tickLabels: true }, data: { value: scalar(14.5, { meta: { unit: 'bar', decimals: 1 } }) } },
  { id: 'gauge.donut-needle', kind: 'gauge', settings: { layout: 'donut', needle: true, needleStyle: 'arrow', icon: 'fas fa-gauge', barColorMode: 'constant', barColor: '#7c3aed', thickness: 18, roundedCaps: false, showMinMax: false }, data: { value: scalar(62) } },
  { id: 'gauge.bar-horizontal', kind: 'gauge', settings: { layout: 'bar-horizontal', min: 10, max: 90, ticks: 4, tickLabels: true, valueText: 'value' }, data: { value: scalar(55), min: scalar(0), max: scalar(100) } },
  { id: 'gauge.level', kind: 'gauge', settings: { layout: 'level', label: 'Tank', unitTitle: 'm', max: 5, ranges: [{ from: 0, to: 1, color: '#dc2626' }, { from: 1, to: 5, color: '#2563eb' }], rangeDisplay: 'track' }, data: { value: scalar(3.2, { meta: { unit: 'm', decimals: 1 } }) } },
  { id: 'gauge.empty-shape', kind: 'gauge', title: 'Pressure', settings: withTitle, data: {}, boundSlots: ['value'] },
  // ── scada.symbol and scada.scene (SVG node trees: kui-ejs writes the same markup with `svgToString`)
  { id: 'scada.tv-reading', kind: 'scada.symbol', title: 'Living room', settings: { ...withTitle, symbol: 'home.tv', max: 100, label: 'TV' }, data: { value: scalar(62, { meta: { unit: '%', decimals: 0 } }), running: scalar(true) } },
  { id: 'scada.router-running', kind: 'scada.symbol', settings: { symbol: 'home.router', label: 'Router' }, data: { running: scalar(true) } },
  { id: 'scada.router-idle', kind: 'scada.symbol', settings: { symbol: 'home.router' }, data: { running: scalar(false) } },
  { id: 'scada.plug-warning', kind: 'scada.symbol', settings: { symbol: 'home.plug.smart', max: 60 }, data: { value: scalar(48, { meta: { unit: 'W', decimals: 0 } }), running: scalar(true), status: scalar('warning') } },
  { id: 'scada.camera-turned', kind: 'scada.symbol', settings: { symbol: 'home.camera.security', orientation: '90', mirror: true }, data: { running: scalar(true), status: scalar('critical') } },
  { id: 'scada.empty-shape', kind: 'scada.symbol', title: 'Router', settings: withTitle, data: {}, boundSlots: ['value'] },
  {
    id: 'scada.scene-small', kind: 'scada.scene', title: 'Home network',
    settings: {
      width: 600, height: 300, scale: 0.7, background: 'dots',
      elements: [
        { id: 'plug', symbol: 'home.plug.smart', x: 80, y: 220, label: 'Plug', max: 60 },
        { id: 'router', symbol: 'home.router', x: 260, y: 120, label: 'Router', labelPos: 't' },
        { id: 'tv', symbol: 'home.tv', x: 440, y: 80, label: 'TV' },
        { id: 'cam', symbol: 'home.camera.security', x: 440, y: 220, labelPos: 'n' },
      ],
      links: [
        { from: 'plug.r', to: 'router.b', kind: 'cable', id: 'plug' },
        { from: 'router.r', to: 'tv.l', kind: 'line', id: 'router' },
        { from: 'router.r', to: 'cam.l', kind: 'wire', id: 'cam' },
      ],
    },
    data: { points: pointRows([{ id: 'plug', value: 9, running: true }, { id: 'router', running: true }, { id: 'tv', running: false }, { id: 'cam', running: true, status: 'warning' }]) },
  },
  {
    id: 'scada.scene-connections', kind: 'scada.scene', title: 'Connections',
    settings: {
      width: 600, height: 400, scale: 0.6, fit: 'canvas',
      elements: [
        { id: 'a', symbol: 'home.router', x: 80, y: 80 }, { id: 'b', symbol: 'home.router', x: 480, y: 80 },
        { id: 'c', symbol: 'home.plug.smart', x: 80, y: 320 }, { id: 'd', symbol: 'home.plug.smart', x: 480, y: 320 },
      ],
      links: [
        { from: 'a.r', to: 'b.l', kind: 'pipe', medium: 'cold', arrows: true },
        { from: 'a.b', to: 'c.t', kind: 'hose', medium: 'hot' },
        { from: 'c.r', to: 'd.l', kind: 'cable' },
        { from: 'b.b', to: 'd.t', kind: 'strip' },
        { from: 'a.r:0.8', to: 'd.t:0.2', kind: 'sld', id: 'sld' },
      ],
    },
    data: { points: pointRows([{ id: 'a', running: true }, { id: 'b', running: true }, { id: 'c', running: true, status: 'critical' }, { id: 'sld', running: true }]) },
  },
  { id: 'scada.scene-empty', kind: 'scada.scene', title: 'Plant', settings: withTitle, data: {}, boundSlots: ['points'] },
  // ── content.markdown
  { id: 'markdown.plain', kind: 'content.markdown', title: 'Notes', settings: { ...withTitle, content: '# Shift notes\n\nPump **A** is *running*; see [the manual](https://docs.example.com/pumps) or [devices](/devices).\n\n- Level {{level}} m\n- Owner {{owner}}\n\n1. Check the valve\n2. Log it\n\n> Keep clear of the pit.\n\n```\nrun --safe\n```\n\n---\n\nUse `reset` after {{missing}}.' }, data: { record: { shape: 'record', record: { level: 4.2, owner: 'Ayşe' } } } },
  { id: 'markdown.callout', kind: 'content.markdown', settings: { layout: 'callout', calloutStyle: 'warning', calloutIcon: 'fas fa-triangle-exclamation', content: 'Maintenance tonight at 22:00.', textSize: 'lg', align: 'center', padding: 8 } },
  { id: 'markdown.callout-custom-clamp', kind: 'content.markdown', settings: { layout: 'callout', calloutStyle: 'custom', calloutColor: '#7c3aed', calloutBackground: '#f5f3ff', content: 'A long text that is clamped to two lines so it never grows the card past its cell and the rest is cut off with an ellipsis at the end of the second line.', overflow: 'clamp', clampLines: 2, linkUnderline: 'always' } },
  { id: 'markdown.footer', kind: 'content.markdown', settings: { content: 'Gateway status', showRecord: true, recordKeys: ['model', 'uptimeHours', 'online'] }, data: { record: { shape: 'record', record: { model: 'Edge 4', uptimeHours: 412.5, online: true, extra: 'x' } } } },
  { id: 'markdown.empty', kind: 'content.markdown', settings: {} },
];
