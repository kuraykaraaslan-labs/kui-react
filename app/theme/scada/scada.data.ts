// Sample data of the SCADA theme: the operator console of a small home network. The diagram and its readings are
// WidgetKit's sample (`HOME_SCENE`, the four home symbols); the status tiles, the device cards and the events read the
// same rows, so every number on the page agrees with the diagram. The clock is fixed (`SCADA_NOW`): relative times read
// the same on the server, in the browser and in kui-ejs, which keeps this file as src/data/scada.data.ts (only the
// import paths differ).

import type { SlotData } from '@/modules/app/WidgetKit';
import { HOME_SCENE, homeSources } from '@/modules/app/WidgetKit/sample/scada-home';

type Row = Record<string, unknown>;
type Settings = Record<string, unknown>;

/** One widget card of the console: a builtin kind, its stored settings and the bound data. */
export interface ScadaCard {
  key: string;
  kind: 'scada.scene' | 'scada.symbol' | 'data.feed';
  title: string;
  settings: Settings;
  data: Record<string, SlotData>;
}

/** A status tile (`StatCard`): a label, a value and, for an abnormal value, the text colour. */
export interface ScadaTile {
  id: string;
  label: string;
  value: string;
  accent?: string;
}

/** The demo's clock: every reading was taken at this time and every event is this many minutes older. */
export const SCADA_NOW = Date.parse('2026-10-22T09:00:00.000Z');
export const SCADA_LOCALE = 'en';

export const SCADA_BRAND = { name: 'Hearth', site: HOME_SCENE.title };
export const SCADA_USER = { name: 'Robin Hale', email: 'robin@hearth.home', role: 'OWNER' };

const at = (now: number, minAgo = 0) => new Date(now - minAgo * 60_000).toISOString();
const scalar = (value: unknown, now: number): SlotData => ({ shape: 'scalar', value: value as SlotData['value'], fetchedAt: at(now) });

const ROWS = new Map(HOME_SCENE.rows.map((r) => [String(r.id), r]));
const ELEMENTS = HOME_SCENE.settings.elements as Row[];
const isAlarm = (row: Row | undefined) => row?.status === 'warning' || row?.status === 'critical';

/** Where each device of the diagram is, or what it reports, printed under its symbol. */
const NOTES: Record<string, string> = {
  tv: 'Living room',
  router: 'Hallway',
  plug: 'Powers the router',
  cam: 'Motion at the door',
};

/** The four device cards: the diagram's symbols, each with its own reading. */
function deviceCards(now: number): ScadaCard[] {
  return ELEMENTS.map((e) => {
    const id = String(e.id);
    const row = ROWS.get(id) ?? {};
    const settings: Settings = { symbol: e.symbol, label: NOTES[id] ?? '' };
    if (typeof e.max === 'number') Object.assign(settings, { min: e.min ?? 0, max: e.max });
    if (typeof e.unit === 'string') settings.$format = { unit: e.unit, decimals: e.decimals ?? 0 };
    const data: Record<string, SlotData> = {};
    for (const k of ['value', 'running', 'status'] as const) if (row[k] !== undefined) data[k] = scalar(row[k], now);
    return { key: `device-${id}`, kind: 'scada.symbol', title: String(e.label), settings, data };
  });
}

/** Every state a symbol has, one symbol each: the state is the card title, what it means the label. */
const STATE_CARDS: Array<{ state: string; title: string; symbol: string; label: string; readings: Row; settings?: Settings }> = [
  { state: 'idle', title: 'Idle', symbol: 'home.tv', label: 'Bedroom TV, switched off', readings: { running: false } },
  { state: 'running', title: 'Running', symbol: 'home.router', label: 'Online, Wi-Fi up', readings: { running: true } },
  { state: 'warning', title: 'Warning', symbol: 'home.camera.security', label: 'Motion seen', readings: { running: true, status: 'warning' } },
  {
    state: 'critical', title: 'Critical', symbol: 'home.plug.smart', label: 'Heater plug overloaded',
    readings: { running: true, status: 'critical', value: 58 }, settings: { min: 0, max: 60, $format: { unit: 'W', decimals: 0 } },
  },
];

function stateCards(now: number): ScadaCard[] {
  return STATE_CARDS.map((c) => ({
    key: `state-${c.state}`,
    kind: 'scada.symbol',
    title: c.title,
    settings: { symbol: c.symbol, label: c.label, ...c.settings },
    data: Object.fromEntries(Object.entries(c.readings).map(([k, v]) => [k, scalar(v, now)])),
  }));
}

/** The recent events, newest first; `severity` names the marker colour. */
const EVENTS: Array<{ minAgo: number; title: string; description: string; severity: string }> = [
  { minAgo: 3, title: 'Motion at the porch', description: 'The porch camera started recording.', severity: 'warning' },
  { minAgo: 26, title: 'Television on', description: 'The living room TV joined the network.', severity: 'neutral' },
  { minAgo: 74, title: 'Plug load back to normal', description: 'The router draws 9 W again.', severity: 'success' },
  { minAgo: 190, title: 'Router firmware checked', description: 'The Wi-Fi router is up to date.', severity: 'neutral' },
  { minAgo: 410, title: 'Guest Wi-Fi opened', description: 'The guest network is on until midnight.', severity: 'info' },
];

function eventsCard(now: number): ScadaCard {
  return {
    key: 'events',
    kind: 'data.feed',
    title: 'Recent events',
    settings: { layout: 'list', colorColumn: 'severity', maxItems: EVENTS.length },
    data: {
      events: {
        shape: 'table', fetchedAt: at(now),
        columns: [
          { key: 'time', label: 'Time', type: 'date' }, { key: 'title', label: 'Event', type: 'text' },
          { key: 'description', label: 'Detail', type: 'text' }, { key: 'severity', label: 'Severity', type: 'text' },
        ],
        rows: EVENTS.map((e) => ({ time: at(now, e.minAgo), title: e.title, description: e.description, severity: e.severity })),
      },
    },
  };
}

/** The "Home network" diagram card, bound to the sample readings. */
function sceneCard(now: number): ScadaCard {
  const source = homeSources(now).find((s) => s.key === HOME_SCENE.source)!;
  return { key: 'scene', kind: 'scada.scene', title: HOME_SCENE.title, settings: { ...HOME_SCENE.settings }, data: { points: source.data } };
}

/** The status tiles, read from the diagram's rows. */
function tiles(): ScadaTile[] {
  const devices = ELEMENTS.map((e) => ROWS.get(String(e.id)));
  const online = devices.filter((r) => r?.running === true).length;
  const alarms = devices.filter(isAlarm).length;
  const plug = ROWS.get('plug');
  const unit = ELEMENTS.find((e) => e.id === 'plug')?.unit ?? '';
  const camera = ROWS.get('cam');
  return [
    { id: 'online', label: 'Devices online', value: `${online} / ${devices.length}` },
    { id: 'warnings', label: 'Active warnings', value: String(alarms), accent: alarms > 0 ? 'text-warning-fg' : undefined },
    { id: 'power', label: 'Power draw (smart plug)', value: `${String(plug?.value ?? '–')} ${String(unit)}`.trim() },
    { id: 'camera', label: 'Porch camera', value: camera?.running === true ? 'Recording' : 'Off' },
  ];
}

/** How many devices report a warning or an alarm (the sidebar and top bar badges). */
export const SCADA_ALARM_COUNT = ELEMENTS.filter((e) => isAlarm(ROWS.get(String(e.id)))).length;

/** Everything the Overview page draws. */
export function scadaOverview(now: number = SCADA_NOW) {
  return { tiles: tiles(), scene: sceneCard(now), events: eventsCard(now), devices: deviceCards(now), states: stateCards(now) };
}

// The legend: the four symbols, each in its four states, in a zone per symbol (two states a row).
const LEGEND_SYMBOLS = [
  { id: 'tv', symbol: 'home.tv', name: 'Television' },
  { id: 'router', symbol: 'home.router', name: 'Wi-Fi router' },
  { id: 'plug', symbol: 'home.plug.smart', name: 'Smart plug' },
  { id: 'cam', symbol: 'home.camera.security', name: 'Security camera' },
];
const LEGEND_STATES: Array<{ id: string; label: string; row: Row }> = [
  { id: 'idle', label: 'Idle', row: { running: false } },
  { id: 'running', label: 'Running', row: { running: true } },
  { id: 'warning', label: 'Warning', row: { running: true, status: 'warning' } },
  { id: 'critical', label: 'Critical', row: { running: true, status: 'critical' } },
];
const ZONE = { w: 240, h: 235, gap: 20, margin: 10 };

/** The legend card: a scene of 16 symbols in four zones, with the state under each. */
function legendCard(now: number): ScadaCard {
  const left = (i: number) => ZONE.margin + i * (ZONE.w + ZONE.gap);
  const shapes = LEGEND_SYMBOLS.map((s, i) => ({ kind: 'zone', x: left(i), y: ZONE.margin, w: ZONE.w, h: ZONE.h, text: s.name, tone: 'neutral' }));
  const elements = LEGEND_SYMBOLS.flatMap((s, i) => LEGEND_STATES.map((st, j) => ({
    id: `${s.id}-${st.id}`, symbol: s.symbol, x: left(i) + 65 + (j % 2) * 110, y: ZONE.margin + 72 + Math.floor(j / 2) * 105,
    label: st.label, showValue: false,
  })));
  const rows = LEGEND_SYMBOLS.flatMap((s) => LEGEND_STATES.map((st) => ({ id: `${s.id}-${st.id}`, ...st.row })));
  return {
    key: 'legend',
    kind: 'scada.scene',
    title: 'Legend',
    settings: {
      width: left(LEGEND_SYMBOLS.length) - ZONE.gap + ZONE.margin, height: ZONE.h + 2 * ZONE.margin, scale: 0.7,
      background: 'none', fit: 'canvas', shapes, elements, links: [],
    },
    data: { points: { shape: 'table', fetchedAt: at(now), rows } },
  };
}

/** Everything the Diagram page draws. */
export function scadaDiagram(now: number = SCADA_NOW) {
  return { scene: sceneCard(now), legend: legendCard(now) };
}
