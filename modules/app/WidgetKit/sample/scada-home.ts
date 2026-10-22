// The process diagram sample (pure data): a small home network built from the four home symbols, with the readings that
// animate it. A smart plug powers the Wi-Fi router over a cable; the router is wired to the television and the security
// camera. The scene settings place symbols by coordinates (their centres) and join them with connections that route
// themselves; the readings are one table, a row per symbol or connection id. The router settings are a record the
// gallery's form widget edits.

import type { SlotData } from '../kind';

type Row = Record<string, unknown>;
type Elem = Record<string, unknown>;

const E = (id: string, symbol: string, x: number, y: number, extra: Elem = {}): Elem => ({ id, symbol, x, y, ...extra });
const L = (from: string, to: string, kind: string, extra: Elem = {}): Elem => ({ from, to, kind, ...extra });

export interface ScadaScene {
  /** The sample source that holds the readings. */
  source: string;
  title: string;
  settings: Record<string, unknown>;
  rows: Row[];
}

const table = (rows: Row[], now: number): SlotData => ({
  shape: 'table',
  fetchedAt: new Date(now).toISOString(),
  columns: [
    { key: 'id', label: 'Symbol', type: 'text' }, { key: 'value', label: 'Reading', type: 'number' }, { key: 'value2', label: 'Second reading', type: 'number' },
    { key: 'running', label: 'Running', type: 'text' }, { key: 'status', label: 'Status', type: 'text' }, { key: 'label', label: 'Name', type: 'text' },
  ],
  rows,
});

// Power is a `cable`, Ethernet a `line`. The plug's load is its reading; the camera reports a warning (motion seen).

export const HOME_SCENE: ScadaScene = {
  source: 'sample.scada.home',
  title: 'Home network',
  settings: {
    width: 760, height: 420, scale: 0.8, background: 'dots',
    elements: [
      E('plug', 'home.plug.smart', 120, 300, { label: 'Smart plug', min: 0, max: 60, unit: 'W', decimals: 0 }),
      E('router', 'home.router', 320, 170, { label: 'Wi-Fi router', labelPos: 't' }),
      E('tv', 'home.tv', 560, 110, { label: 'Television' }),
      E('cam', 'home.camera.security', 560, 300, { label: 'Porch camera' }),
    ],
    links: [
      L('plug.r', 'router.b', 'cable', { id: 'power' }),
      L('router.r', 'tv.l', 'line', { id: 'lan' }),
      L('router.r', 'cam.l', 'line', { id: 'lan' }),
    ],
  },
  rows: [
    { id: 'plug', running: true, value: 9 },
    { id: 'router', running: true },
    { id: 'tv', running: true },
    { id: 'cam', running: true, status: 'warning', label: 'Porch camera · motion' },
    { id: 'power', running: true },
    { id: 'lan', running: true },
  ],
};

/** The router's settings: a record the form widget edits (labels, units and words come from the source). */
export const ROUTER_SETTINGS: SlotData['record'] = { maxDevices: 32, downLimit: 500, band: 'auto', guest: true };

/** The diagram's readings and the router settings as sample sources (`sample.scada.home*`). */
export function homeSources(now: number): Array<{ key: string; label: string; data: SlotData }> {
  return [
    { key: HOME_SCENE.source, label: `Sample · ${HOME_SCENE.title} readings`, data: table(HOME_SCENE.rows, now) },
    {
      key: 'sample.scada.home.params', label: 'Sample · Router settings (record)',
      data: {
        shape: 'record' as const, fetchedAt: new Date(now).toISOString(), record: ROUTER_SETTINGS,
        recordMeta: {
          maxDevices: { label: 'Most devices', decimals: 0, kind: 'number' as const },
          downLimit: { label: 'Download limit', unit: 'Mbit/s', decimals: 0, kind: 'number' as const },
          band: { label: 'Band', kind: 'enum' as const, valueMap: { auto: { label: 'Automatic' }, low: { label: '2.4 GHz' }, high: { label: '5 GHz' } } },
          guest: { label: 'Guest Wi-Fi', kind: 'boolean' as const },
        },
      } satisfies SlotData,
    },
  ];
}
