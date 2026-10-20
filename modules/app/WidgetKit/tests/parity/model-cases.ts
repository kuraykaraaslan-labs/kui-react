// The model-level reference cases: the kinds whose ui components draw in the browser (charts, map, controls, video)
// cannot be compared as static HTML, so kui-react also records what each kind's pure model decides, as JSON
// (`model-golden.json`, written by `model-golden.test.ts`). kui-ejs and KUInative vendor this file and the golden,
// build their own mapping input from the same case (stored settings + data + host facts), and compare it with the
// golden's `input` (the effective settings and format) and `model` (what must be drawn).
//
// A case is plain JSON: a builtin kind, its STORED settings (sparse; `$format` / `$card` allowed), the bound data by
// slot key, and the host facts the model needs (`host`). "Now" is fixed so every relative time is the same everywhere.

import type { SlotData } from '../../kind';

export interface ModelCase {
  id: string;
  kind: string;
  /** Stored placement settings (sparse); the type's defaults are layered under them like `resolvePlacement` does. */
  settings?: Record<string, unknown>;
  /** Stored `core:format` values (`unit`, `decimals`, `unitPosition`, `notation`): shorthand for `settings.$format`. */
  format?: Record<string, unknown>;
  data?: Record<string, SlotData>;
  locale?: string;
  /** What the platform tells the model (see each kind in `model-golden.test.ts`): never part of the settings. */
  host?: {
    /** Charts / pie: the card body's measured size in px. */
    box?: { width: number; height: number };
    /** Map: the host handles marker clicks / navigates a marker's link; a custom tile server; layer switch texts. */
    hasMarkerClick?: boolean;
    /** Map: the platform's imagery provider, and whether a dropped marker can be written back. */
    imagery?: unknown;
    movable?: boolean;
    hasNavigate?: boolean;
    tiles?: unknown;
    layerLabels?: Record<string, string>;
    /** Map / video: the host's `resolveUrl` prefixes internal paths (`/x.png` → `<prefix>/x.png`). */
    resolveUrlPrefix?: string;
    /** Controls: whether `onControl` is wired, the host's own reason not to act, the confirmation policy, the toggle state. */
    connected?: boolean;
    stale?: boolean;
    disabledReason?: string;
    confirm?: { mode: 'none' | 'confirm' | 'typed'; text?: string };
    pressed?: boolean;
    /** The card's title (a fallback accessible name). */
    title?: string;
  };
}

export const MODEL_NOW = '2026-10-20T10:05:00.000Z';
export const MODEL_LOCALE = 'en';

const at = (minAgo: number) => new Date(Date.parse(MODEL_NOW) - minAgo * 60_000).toISOString();

/** Several named series on shared hourly timestamps. */
const multi = (list: Array<{ name: string; vals: number[] }>, extra: Partial<SlotData> = {}, stepMin = 60): SlotData => ({
  shape: 'series', fetchedAt: at(1),
  series: list.map(({ name, vals }) => ({ name, points: vals.map((v, i) => ({ t: at((vals.length - 1 - i) * stepMin), v })) })),
  ...extra,
});
const scalar = (value: number | string | boolean | null): SlotData => ({ shape: 'scalar', value, fetchedAt: at(1) });
const table = (rows: Array<Record<string, unknown>>, columns?: SlotData['columns']): SlotData => ({
  shape: 'table', fetchedAt: at(1), rows, ...(columns ? { columns } : {}),
});

const TEMP = { name: 'Temperature', vals: [18.2, 19.5, 21.04, 22.8, 21.3, 20.1] };
const HUM = { name: 'Humidity', vals: [61, 58, 52, 49, 55, 59] };
const UTC = { window: { explicitTimezone: 'UTC' } };

const STATUS_COLUMNS: SlotData['columns'] = [
  { key: 'name', label: 'Device', type: 'text' },
  { key: 'lat', label: 'Lat', type: 'number' },
  { key: 'lng', label: 'Lng', type: 'number' },
  { key: 'status', label: 'Status', type: 'text', kind: 'enum', valueMap: { Online: { label: 'Online', color: 'var(--success)' }, Offline: { label: 'Offline', color: '#dc2626' } } },
  { key: 'level', label: 'Level', type: 'number', unit: 'm' },
  { key: 'seen', label: 'Last seen', type: 'date' },
];
const DEVICES = table([
  { id: 'a', name: 'Pump A', lat: 41.0082, lng: 28.9784, status: 'Online', level: 4.2, seen: at(3) },
  { id: 'b', name: 'Pump B', lat: 39.9334, lng: 32.8597, status: 'Offline', level: 0.4, seen: at(600) },
  { id: 'c', name: 'Pump C', lat: 38.4237, lng: 27.1428, status: 'Online', level: 2.75, seen: at(20) },
  { id: 'd', name: 'Off the map', lat: 123, lng: 28, status: 'Online', level: 1, seen: at(5) },
  { id: 'e', name: 'No position', lat: null, lng: null, status: 'Online', level: 1, seen: at(5) },
], STATUS_COLUMNS);

const SALES = table([
  { region: 'North', sales: 120 }, { region: 'South', sales: 340 }, { region: 'East', sales: 90 }, { region: 'West', sales: 210 },
  { region: 'Centre', sales: 10 }, { region: 'Islands', sales: 5 }, { region: 'Broken', sales: 'n/a' }, { region: 'Zero', sales: 0 },
]);

const CONTROL_HOST = { connected: true };

export const MODEL_CASES: ModelCase[] = [
  // ── chart.line
  {
    id: 'line.rules-right-axis', kind: 'chart.line',
    settings: {
      series: [
        { key: 'Temperature', label: '${name} (room)', color: '#dc2626', unit: '°C', decimals: 1, width: 3, showPoints: 'on', pointShape: 'diamond', pointSize: 4 },
        { key: 'Humidity', axis: 'right', unit: '%', decimals: 0, lineStyle: 'dashed' },
      ],
      y2Label: 'Humidity', yLabel: 'Temperature', thresholds: [{ value: 22, label: 'Limit', color: '#dc2626' }, { value: 55, axis: 'right', style: 'dotted' }],
      legendValues: ['latest', 'max'], tooltipTotal: false, curve: 'step',
    },
    data: { series: multi([TEMP, HUM]) },
  },
  {
    id: 'line.defaults-single', kind: 'chart.line',
    format: { unit: 'kW', decimals: 2, unitPosition: 'after' },
    data: { series: multi([{ name: 'Power', vals: [3, 4.5, 4.25, 8, 6] }]) },
  },
  {
    id: 'line.compact-tooltip-decimals', kind: 'chart.line',
    settings: { tooltipDecimals: 1, legend: 'top', yMin: 0, yMax: 20000, zoom: false, valueLabels: 'value', valueLabelPosition: 'bottom', animate: false },
    format: { notation: 'compact', unit: 'Wh' },
    data: { series: multi([{ name: 'Energy', vals: [1200, 5400, 18250, 9000] }], { window: { explicitTimezone: 'Europe/Istanbul' } }) },
    host: {},
  },
  { id: 'line.empty', kind: 'chart.line', settings: {}, data: {} },
  // ── chart.area
  {
    id: 'area.time-gradient', kind: 'chart.area',
    settings: { fill: 'medium', fillStyle: 'gradient', series: [{ key: '*', color: '#2563eb' }] },
    data: { series: multi([{ name: 'Flow', vals: [4, 6, 5, 9, 7] }]) },
  },
  {
    id: 'area.stacked-band', kind: 'chart.area',
    settings: { stacked: true, tooltipTotal: true, fill: 'solid', legend: 'right', series: [{ key: 'Humidity', stack: 'b' }] },
    data: { series: multi([TEMP, HUM], UTC) },
  },
  // ── chart.bar
  {
    id: 'bar.stacked-vertical', kind: 'chart.bar',
    settings: { stacked: true, barRadius: 2, barWidth: 60, barGap: 4, valueLabels: 'value', valueLabelPosition: 'inside', tooltipTotal: true },
    data: { series: multi([{ name: 'Day', vals: [5, 7, 6, 4] }, { name: 'Night', vals: [2, 3, 3, 1] }], UTC) },
  },
  {
    id: 'bar.horizontal-grouped', kind: 'chart.bar',
    settings: { orientation: 'horizontal', yFromZero: false, series: [{ key: 'Night', color: '#7c3aed', label: 'After dark' }] },
    format: { decimals: 0 },
    data: { series: multi([{ name: 'Day', vals: [5, 7, 6] }, { name: 'Night', vals: [2, 3, 3] }], UTC, 1440) },
  },
  {
    id: 'bar.category-sorted', kind: 'chart.bar',
    settings: { xAxis: 'category', categoryColumn: 'region', valueColumn: 'sales', categorySort: 'desc', maxBars: 4, series: [{ key: '*', color: '#16a34a' }] },
    format: { unit: 'k€', unitPosition: 'after' },
    data: { rows: { ...SALES, columns: [{ key: 'region', label: 'Region', type: 'text' }, { key: 'sales', label: 'Sales', type: 'number' }] } },
  },
  // ── chart.pie
  {
    id: 'pie.folds-into-other', kind: 'chart.pie',
    settings: { maxSlices: 4, layout: 'donut', donutWidth: 35, valueLabels: 'name-percent', legend: 'auto', colors: [{ key: 'South', color: '#2563eb' }, { key: 'Other', color: '#9ca3af' }] },
    format: { unit: 'k€' },
    data: { slices: table(SALES.rows!.map((r) => ({ label: r.region, value: r.sales }))) },
    host: { box: { width: 480, height: 240 } },
  },
  {
    id: 'pie.donut-total-narrow', kind: 'chart.pie',
    settings: { layout: 'donut-total', totalLabel: 'All regions', legendValue: 'percent', tooltipValue: 'value', sort: 'none', otherLabel: 'Rest', maxSlices: 3 },
    data: { slices: table(SALES.rows!.map((r) => ({ label: r.region, value: r.sales }))) },
    host: { box: { width: 200, height: 260 } },
  },
  {
    id: 'pie.columns-custom', kind: 'chart.pie',
    settings: { labelColumn: 'kind', valueColumn: 'n', layout: 'pie', legend: 'left', labelPosition: 'outside', sliceGap: 0, startAngle: 90, sort: 'asc' },
    data: { slices: table([{ kind: 'Run', n: 5 }, { kind: 'Stop', n: 2 }, { kind: 'Idle', n: 9 }]) },
  },
  { id: 'pie.empty', kind: 'chart.pie', settings: { layout: 'donut' }, data: {} },
  // ── chart.scatter
  {
    id: 'scatter.groups-trend', kind: 'chart.scatter',
    settings: { groupColumn: 'unit', trendLine: true, trendColor: '#111827', pointSize: 'lg', pointShape: 'square', pointOpacity: 0.6, groupColors: [{ key: 'A', color: '#2563eb' }], xUnit: 'rpm', yUnit: 'bar', yDecimals: 1 },
    data: { points: table([
      { x: 1000, y: 2.1, unit: 'A' }, { x: 1500, y: 3.3, unit: 'A' }, { x: 2000, y: 4.2, unit: 'B' }, { x: 2500, y: 5.8, unit: 'B' }, { x: 'bad', y: 1, unit: 'B' }, { x: 3000, y: 6.04 },
    ]) },
  },
  {
    id: 'scatter.single-colour-thresholds', kind: 'chart.scatter',
    settings: { pointColor: '#f59e0b', xColumn: 'a', yColumn: 'b', xMin: 0, xMax: 10, thresholds: [{ value: 5, label: 'Target' }], legend: 'bottom' },
    data: { points: table([{ a: 1, b: 2 }, { a: 4, b: 5 }, { a: 9, b: 3 }]) },
  },
  { id: 'scatter.empty', kind: 'chart.scatter', settings: {}, data: {} },
  // ── chart.histogram
  {
    id: 'histogram.nice-mean-median', kind: 'chart.histogram',
    settings: { showMean: true, showMedian: true, markerColor: '#dc2626', countLabel: 'Devices', valueLabels: 'value', barColor: '#2563eb' },
    format: { unit: 'ms' },
    data: { values: table([102, 118, 121, 140, 141, 150, 163, 170, 188, 201, 205, 236].map((value) => ({ value }))) },
  },
  {
    id: 'histogram.exact-edges-range', kind: 'chart.histogram',
    settings: { binEdges: 'exact', bins: 4, min: 0, max: 1, valueColumn: 'ratio', barRadius: 0, barWidth: 100 },
    format: { unit: '€', unitPosition: 'before', decimals: 2 },
    data: { values: table([0.1, 0.12, 0.4, 0.45, 0.46, 0.9].map((ratio) => ({ ratio }))) },
  },
  { id: 'histogram.single-value', kind: 'chart.histogram', settings: { showMean: true }, data: { values: table([{ value: 7 }, { value: 7 }]) } },
  { id: 'histogram.empty', kind: 'chart.histogram', settings: {}, data: {} },
  // ── heatmap
  {
    id: 'heatmap.gradient', kind: 'heatmap',
    settings: { colorLow: '#dbeafe', color: '#1d4ed8', valueLabels: 'value', cellGap: 1, cellRadius: 0, valueName: 'Load' },
    format: { unit: '%', decimals: 0 },
    data: { cells: table([
      { x: 'Mon', y: '08', value: 12 }, { x: 'Tue', y: '08', value: 45 }, { x: 'Mon', y: '12', value: 78 }, { x: 'Tue', y: '12', value: 'n/a' }, { x: '', y: '12', value: 5 },
    ]) },
  },
  {
    id: 'heatmap.bands-legend', kind: 'heatmap',
    settings: {
      scale: 'bands', rangeEdges: 'to', legend: 'right',
      ranges: [{ to: 30, color: '#16a34a', label: 'Low' }, { from: 30, to: 70, color: '#f59e0b' }, { from: 70, color: '#dc2626' }],
    },
    format: { notation: 'compact' },
    data: { cells: table([{ x: 1, y: 1, value: 10 }, { x: 2, y: 1, value: 50 }, { x: 3, y: 1, value: 1500 }]) },
  },
  { id: 'heatmap.empty', kind: 'heatmap', settings: {}, data: {} },
  // ── map
  {
    id: 'map.status-colours-legend', kind: 'map',
    settings: {
      latColumn: 'lat', lngColumn: 'lng', labelColumn: 'name', idColumn: 'id', colorColumn: 'status', colorBy: 'column',
      tooltipColumns: ['status', 'level'], markerStyle: 'pin', markerSize: 28, showLabels: true, cluster: true,
      linkTemplate: '/devices/{id}', linkLabel: 'Details', legend: true, legendPosition: 'bottomright',
    },
    data: { points: DEVICES },
    host: { hasNavigate: true, tiles: { light: { url: 'https://tiles.example.com/l/{z}/{x}/{y}.png', attribution: 'Example' }, dark: { url: 'https://tiles.example.com/d/{z}/{x}/{y}.png', attribution: 'Example' } } },
  },
  {
    id: 'map.value-colors-configured', kind: 'map',
    settings: {
      colorColumn: 'status', valueColors: [{ value: 'Offline', label: 'Down', color: '#7c3aed' }, { value: 'Online', color: '#16a34a' }],
      markerStyle: 'icon', markerIcon: 'fas fa-water', tileStyle: 'dark', zoom: 6, minZoom: 3, maxZoom: 12, centerLat: 39, centerLng: 35, tooltipTrigger: 'click',
    },
    data: { points: DEVICES },
    host: { hasMarkerClick: true },
  },
  {
    id: 'map.ranges-colour', kind: 'map',
    settings: {
      colorBy: 'ranges', valueColumn: 'level', rangeEdges: 'to', fitBounds: false, fitPadding: 10, zoomButtons: false, scrollZoom: true, markerStyle: 'dot',
      ranges: [{ to: 1, color: '#dc2626', label: 'Empty' }, { from: 1, to: 3, color: '#f59e0b' }, { from: 3, color: '#16a34a' }],
    },
    data: { points: DEVICES },
  },
  {
    id: 'map.fixed-colour-no-legend', kind: 'map',
    settings: { colorBy: 'fixed', markerColor: '#2563eb', legend: false, markerStyle: 'circle', tileStyle: 'streets', controlsPosition: 'topright' },
    data: { points: DEVICES },
  },
  {
    id: 'map.zones-routes-layers', kind: 'map',
    settings: { colorBy: 'fixed', zoneVariant: 'warning', zoneOpacity: 0.3, routeColor: '#7c3aed', routeWeight: 5, routeDashed: true, layerTogglesPosition: 'topleft', controlsPosition: 'topleft' },
    data: {
      points: DEVICES,
      zones: table([
        { id: 'z1', name: 'Depot', positions: [[41, 29], [41.1, 29.1], [41.0, 29.2]] },
        { id: 'z2', name: 'Too short', positions: [[41, 29], [41.1, 29.1]] },
        { id: 'z3', name: 'Alarm area', variant: 'error', positions: '[[40,30],[40.5,30.5],[40,31]]' },
      ]),
      routes: table([
        { id: 'r1', name: 'Morning run', positions: [[41, 29], [40.5, 30], [39.9, 32.8]] },
        { id: 'r2', name: 'Broken', positions: [[200, 29], [41, 29]] },
      ]),
    },
    host: { layerLabels: { layers: 'Layers', zones: 'Areas' } },
  },
  {
    id: 'map.image-plan', kind: 'map',
    settings: {
      mapKind: 'image', imageSrc: '/plans/floor1.png', imageWidth: 800, imageHeight: 600, latColumn: 'y', lngColumn: 'x', labelColumn: 'name',
      colorBy: 'fixed', markerStyle: 'pin',
    },
    data: { points: table([{ name: 'Sensor 1', y: 100, x: 200 }, { name: 'Sensor 2', y: 580, x: 790 }, { name: 'Outside', y: 700, x: 10 }]) },
    host: { resolveUrlPrefix: '/tenant-7' },
  },
  { id: 'map.empty', kind: 'map', settings: {}, data: {} },
  // ── control.button
  {
    id: 'button.filled-confirm-typed', kind: 'control.button',
    settings: { label: 'Restart', icon: 'fas fa-power-off', iconPosition: 'end', appearance: 'filled', mainColor: '#dc2626', textColor: '#ffffff', size: 'lg', description: 'Restarts the gateway.', confirmLabel: 'Yes, restart', failureText: 'Could not restart.' },
    host: { ...CONTROL_HOST, confirm: { mode: 'typed', text: 'RESTART' } },
  },
  {
    id: 'button.tile-outlined-colours', kind: 'control.button',
    settings: { layout: 'tile', label: 'Open valve', icon: 'fas fa-faucet', appearance: 'outlined', mainColor: '#2563eb', hoverColor: '#dbeafe', hoverTextColor: '#1e3a8a', disabledColor: '#e5e7eb', disabledTextColor: '#9ca3af', borderRadius: 16, description: 'Valve 2', descriptionColor: '#6b7280', align: 'start' },
    host: { ...CONTROL_HOST, confirm: { mode: 'confirm', text: 'Open valve 2 now?' } },
  },
  {
    id: 'button.icon-ghost-toggle', kind: 'control.button',
    settings: { layout: 'icon', icon: 'fas fa-lightbulb', iconSize: 18, size: 'sm', appearance: 'ghost' },
    host: { ...CONTROL_HOST, pressed: true },
  },
  {
    id: 'button.fab-underlined-not-connected', kind: 'control.button',
    settings: { layout: 'fab', label: 'Go', appearance: 'underlined', fullWidth: false, pendingText: 'Working…', successText: 'Gone' },
    host: { connected: false },
  },
  {
    id: 'button.host-reason', kind: 'control.button',
    settings: { label: 'Run' },
    host: { connected: true, disabledReason: 'You may not run this.' },
  },
  // ── control.switch
  {
    id: 'switch.on-pill-icons', kind: 'control.switch',
    settings: { label: 'Heater', stateDisplay: 'pill', onLabel: 'Heating', offLabel: 'Idle', onIcon: 'fas fa-fire', offIcon: 'fas fa-snowflake', onColor: '#f97316', offColor: '#9ca3af', thumbColor: '#ffffff', onTextColor: '#c2410c' },
    data: { value: scalar(true) },
    host: CONTROL_HOST,
  },
  {
    id: 'switch.on-match-centered', kind: 'control.switch',
    settings: { layout: 'centered', label: 'Mode', icon: 'fas fa-gear', iconColor: '#2563eb', onMatch: 'AUTO', onLabel: 'Auto', offLabel: 'Manual', stateFont: { size: 18, weight: 600 }, disableWhen: ['stale'] },
    data: { value: scalar('MANUAL') },
    host: { connected: true, stale: true },
  },
  {
    id: 'switch.unknown-left-confirm', kind: 'control.switch',
    settings: { layout: 'left', size: 'sm', label: 'Pump', unknownLabel: 'No signal', stateDisplay: 'none', disableWhen: ['unknown'], confirmQuestion: 'Switch the pump?' },
    data: { value: scalar('maybe') },
    host: { ...CONTROL_HOST, confirm: { mode: 'confirm' }, title: 'Pump card' },
  },
  // ── control.slider
  {
    id: 'slider.default-end-value', kind: 'control.slider',
    settings: { label: 'Dimmer', min: 0, max: 100, step: 5, valuePosition: 'end', tickMarks: 5, tickLabels: true, mainColor: '#f59e0b', startIcon: 'fas fa-moon', endIcon: 'fas fa-sun', commit: 'debounced', debounceMs: 300 },
    format: { unit: '%', decimals: 0 },
    data: { value: scalar(35) },
    host: CONTROL_HOST,
  },
  {
    id: 'slider.vertical-confirm', kind: 'control.slider',
    settings: { orientation: 'vertical', label: 'Level', min: 0, max: 10, thickness: 8, thumbSize: 24, showMinMax: true, valueColor: '#2563eb' },
    format: { unit: 'm', decimals: 1 },
    data: { value: scalar(4.5) },
    host: { ...CONTROL_HOST, confirm: { mode: 'confirm', text: 'Move it?' } },
  },
  {
    id: 'slider.compact-unknown-disabled', kind: 'control.slider',
    settings: { layout: 'compact', label: 'Speed', disableWhen: ['unknown'], showMinMax: false },
    data: { value: scalar('fast') },
    host: CONTROL_HOST,
  },
  {
    id: 'slider.extended-bottom', kind: 'control.slider',
    settings: { layout: 'extended', label: 'Volume', valuePosition: 'bottom', showValue: true, trackColor: '#e5e7eb', disabledMainColor: '#d1d5db' },
    data: { value: scalar(7) },
    host: CONTROL_HOST,
  },
  // ── control.setpoint
  {
    id: 'setpoint.input-range-unit', kind: 'control.setpoint',
    settings: { label: 'Target', min: 10, max: 30, step: 0.5, showRange: true, applyLabel: 'Set', currentLabel: 'Reads', borderColor: '#2563eb' },
    format: { unit: '°C', decimals: 1 },
    data: { value: scalar(22.5) },
    host: { ...CONTROL_HOST, confirm: { mode: 'typed', text: 'OK' } },
  },
  {
    id: 'setpoint.stepper-hidden-unit', kind: 'control.setpoint',
    settings: { layout: 'stepper', label: 'Fan', unitDisplay: 'hide', showValue: false, buttonColor: '#16a34a', buttonTextColor: '#ffffff', valueFont: { size: 22 } },
    format: { unit: 'rpm', unitPosition: 'after' },
    data: { value: scalar(1200) },
    host: CONTROL_HOST,
  },
  {
    id: 'setpoint.dial-no-value', kind: 'control.setpoint',
    settings: { layout: 'dial', min: 0, max: 50, buttonColor: '#7c3aed', dialTrackColor: '#e5e7eb', disableWhen: ['unknown'], showRange: true },
    format: { unit: '°C' },
    data: {},
    host: { ...CONTROL_HOST, title: 'Boiler' },
  },
  // ── map, phase 25: a picture per status, satellite imagery, a draggable floor plan, route replay
  {
    id: 'map.status-pictures', kind: 'map',
    settings: {
      colorBy: 'column', colorColumn: 'status', markerStyle: 'dot',
      valueColors: [{ value: 'Alarm', color: '#dc2626', label: 'Alarm', image: '/files/alarm.svg' }, { value: 'Ok', color: '#16a34a', label: 'Ok', icon: 'fas fa-check' }, { value: 'Idle', color: '#f59e0b', image: 'javascript:alert(1)' }],
    },
    data: { points: table([{ lat: 41, lng: 29, label: 'A', status: 'Alarm' }, { lat: 41.1, lng: 29.1, label: 'B', status: 'Ok' }, { lat: 41.2, lng: 29.2, label: 'C', status: 'Idle' }]) },
    host: { resolveUrlPrefix: '/tenant-7' },
  },
  {
    id: 'map.satellite-own-provider', kind: 'map', settings: { tileStyle: 'satellite' },
    data: { points: table([{ lat: 41, lng: 29, label: 'A' }]) },
    host: { imagery: { url: 'https://tiles.example.com/{z}/{x}/{y}.jpg', attribution: 'Example' } },
  },
  {
    id: 'map.floor-plan-draggable', kind: 'map',
    settings: { mapKind: 'image', imageWidth: 1200, imageHeight: 800, draggable: true, idColumn: 'id' },
    data: { points: table([{ id: 'p1', lat: 120, lng: 300, label: 'Pump' }, { id: 'p2', lat: 500, lng: 900, label: 'Tank' }]), image: scalar('/files/floor-2.png') },
    host: { movable: true, resolveUrlPrefix: '/tenant-7' },
  },
  {
    id: 'map.floor-plan-read-only', kind: 'map',
    settings: { mapKind: 'image', imageSrc: '/files/floor-1.png', imageWidth: 1200, imageHeight: 800, draggable: true },
    data: { points: table([{ lat: 120, lng: 300, label: 'Pump' }]) },
    host: { movable: false },
  },
  {
    id: 'map.route-replay', kind: 'map', settings: { replay: true, replaySpeed: '5', routeColor: '#7c3aed' },
    data: {
      points: table([]),
      routes: table([{ id: 'r1', name: 'Truck 7', positions: [[41, 29, '2026-10-20T10:00:00Z'], [41, 29.1, '2026-10-20T10:10:00Z'], [41.1, 29.1, '2026-10-20T10:30:00Z']] }, { id: 'r2', name: 'Van 2', positions: [[40.9, 29], [41.05, 29.2]] }]),
    },
  },
  // ── control.form
  {
    id: 'form.declared', kind: 'control.form',
    settings: {
      label: 'Pump settings',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, group: 'General' },
        { key: 'lowFlag', label: 'Low limit on', type: 'boolean', group: 'Limits' },
        { key: 'low', label: 'Low limit', type: 'number', min: 0, max: 10, step: 0.5, unit: 'm', gate: 'lowFlag', group: 'Limits' },
        { key: 'mode', type: 'enum', options: 'auto=Automatic, manual=Manual, off', group: 'General' },
        { key: 'serial', label: 'Serial', type: 'text', readOnly: true },
      ],
    },
    data: { record: { shape: 'record', record: { name: 'Pump A', lowFlag: true, low: 2.5, mode: 'auto', serial: 'SN-001' } } },
    host: CONTROL_HOST,
  },
  {
    id: 'form.from-source-meta', kind: 'control.form', settings: { saveLabel: 'Apply', resetLabel: 'Undo' },
    data: {
      record: {
        shape: 'record', record: { depth: 5000, speed: 25.5, mode: 'manual', recirculate: false, extra: { nested: true } },
        recordMeta: {
          depth: { label: { en: 'Well depth', tr: 'Kuyu derinliği' }, unit: 'm', decimals: 0, kind: 'number' },
          speed: { label: 'Drill speed', unit: 'm/h', decimals: 1, kind: 'number' },
          mode: { label: 'Mode', kind: 'enum', valueMap: { auto: { label: 'Automatic' }, manual: { label: 'Manual' } } },
          recirculate: { label: 'Recirculate mud', kind: 'boolean' },
        },
      },
    },
    host: CONTROL_HOST,
  },
  {
    id: 'form.from-source-off-and-no-record', kind: 'control.form', settings: { fromSource: false },
    data: { record: { shape: 'record', record: { a: 1 } } },
    host: CONTROL_HOST,
  },
  {
    id: 'form.confirm-typed', kind: 'control.form',
    settings: { fields: [{ key: 'level', type: 'number', min: 0, max: 100 }], confirmQuestion: 'Write the level?' },
    data: { record: { shape: 'record', record: { level: 40 } } },
    host: { ...CONTROL_HOST, confirm: { mode: 'typed', text: 'LEVEL' } },
  },
  {
    id: 'form.not-connected', kind: 'control.form',
    settings: { fields: [{ key: 'a', type: 'text' }, { key: '__proto__', type: 'text' }, { key: 'a', type: 'number' }, { key: 'bad key', type: 'text' }] },
    data: { record: { shape: 'record', record: { a: 'x' } } },
    host: { ...CONTROL_HOST, connected: false },
  },
  {
    id: 'form.stale-disabled', kind: 'control.form', settings: { fields: [{ key: 'a', type: 'text' }], disableWhen: ['stale'] },
    data: { record: { shape: 'record', record: { a: 'x' } } },
    host: { ...CONTROL_HOST, stale: true },
  },
  // ── content.video
  {
    id: 'video.mp4-subtitles', kind: 'content.video',
    settings: {
      src: '/media/intro.mp4', poster: '/media/intro.jpg', showTitle: true, fit: 'cover', theme: 'cinema', loop: true, autoHideControls: false,
      subtitles: [{ label: 'English', srclang: 'en', src: '/media/intro.en.vtt' }, { label: 'No language', src: '/media/x.vtt' }, { label: 'Bad', srclang: 'xx', src: 'javascript:alert(1)' }],
    },
    host: { resolveUrlPrefix: '/tenant-7', title: 'Intro' },
  },
  {
    id: 'video.hls-autoplay-turkish', kind: 'content.video',
    settings: { src: 'https://cdn.example.com/live/stream.m3u8?token=1', autoPlay: true, theme: 'broadcast', showTitle: true },
    locale: 'tr-TR',
    host: { title: 'Gate camera' },
  },
  {
    id: 'video.bound-source-wins', kind: 'content.video',
    settings: { src: 'https://cdn.example.com/default.mp4', startMuted: true },
    data: { source: scalar('https://cdn.example.com/cam/7.m3u8') },
  },
  {
    id: 'video.bound-refused-falls-back', kind: 'content.video',
    settings: { src: 'https://cdn.example.com/default.mp4' },
    data: { source: scalar('javascript:alert(1)') },
  },
  { id: 'video.empty', kind: 'content.video', settings: {}, data: {} },
];
