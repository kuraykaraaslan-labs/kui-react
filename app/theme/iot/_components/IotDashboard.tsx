'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '@/libs/utils/cn';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faMicrochip, faCircleCheck, faCircleExclamation, faBell, faTemperatureHalf, faGauge, faBolt, faFan,
  faWifi, faBatteryHalf, faLocationDot, faTable, faChartLine, faChartPie, faChartColumn, faChartArea,
  faToggleOn, faSliders, faHashtag, faImage, faLink, faAlignLeft, faCircleDot, faList, faTimeline,
  faMapLocationDot, faTableCells, faBraille, faChartSimple, faArrowTrendUp, faBarsProgress, faGaugeHigh,
  faGaugeSimple, faCirclePlay, faWindowMaximize, faDroplet, faLightbulb, faPowerOff, faServer, faRotateLeft,
  faCartShopping, faRotateRight, faBook, faUsers, faTriangleExclamation, faCircleInfo, faCircleXmark,
  faLeaf, faPiggyBank, faBug, faPercent, faReceipt, faFlagCheckered,
} from '@fortawesome/free-solid-svg-icons';
import {
  WidgetBoard, WidgetKitProvider, BUILTIN_KINDS, BUILTIN_VIEWS, exportBoard, useLocalSetting,
  type BoardDocument, type BoardPlacement, type SlotData,
} from '@/modules/app/WidgetKit';
import { DEFAULT_IOT_BOARD, DEMO_SOURCES, sourceData } from './iot-dashboard.data';

const STORAGE_KEY = 'kui.theme.iot.dashboard';

const ICONS: Record<string, IconDefinition> = {
  microchip: faMicrochip, 'circle-check': faCircleCheck, 'circle-exclamation': faCircleExclamation, bell: faBell,
  'temperature-half': faTemperatureHalf, gauge: faGauge, bolt: faBolt, fan: faFan, wifi: faWifi, 'battery-half': faBatteryHalf,
  'location-dot': faLocationDot, table: faTable, 'chart-line': faChartLine, 'chart-pie': faChartPie, 'chart-column': faChartColumn,
  'chart-area': faChartArea, 'toggle-on': faToggleOn, sliders: faSliders, hashtag: faHashtag, image: faImage, link: faLink,
  'align-left': faAlignLeft, 'circle-dot': faCircleDot, 'list-ul': faList, list: faList, timeline: faTimeline,
  'map-location-dot': faMapLocationDot, 'table-cells': faTableCells, braille: faBraille, 'chart-simple': faChartSimple,
  'arrow-trend-up': faArrowTrendUp, 'bars-progress': faBarsProgress, 'gauge-high': faGaugeHigh, 'gauge-simple': faGaugeSimple,
  'circle-play': faCirclePlay, 'window-maximize': faWindowMaximize, droplet: faDroplet, lightbulb: faLightbulb,
  'power-off': faPowerOff, server: faServer, 'cart-shopping': faCartShopping, 'rotate-right': faRotateRight,
  book: faBook, users: faUsers, 'triangle-exclamation': faTriangleExclamation, 'circle-info': faCircleInfo,
  'circle-xmark': faCircleXmark, leaf: faLeaf, 'piggy-bank': faPiggyBank, bug: faBug, percent: faPercent,
  receipt: faReceipt, 'flag-checkered': faFlagCheckered,
};

/** 'fas fa-bell' → the bell; unknown names draw nothing. */
export function renderIcon(name: string, props: { className?: string; style?: CSSProperties }) {
  // The wrapper carries the size and colour (FontAwesome draws in currentColor).
  const key = name.split(/\s+/).find((p) => p.startsWith('fa-') && !['fa-solid', 'fa-regular'].includes(p))?.slice(3);
  const icon = key ? ICONS[key] : undefined;
  return icon ? (
    <span className={cn("inline-flex items-center justify-center", props.className)} style={props.style}>
      <FontAwesomeIcon icon={icon} className="h-full w-full" aria-hidden="true" />
    </span>
  ) : null;
}

/** The stored board, or the demo layout when there is none (or it does not parse). */
function parseBoard(raw: string | null): BoardDocument {
  if (!raw) return DEFAULT_IOT_BOARD;
  try { return JSON.parse(raw) as BoardDocument; } catch { return DEFAULT_IOT_BOARD; }
}

/** The Data tab of a placement in this demo: bind each slot to one of the demo sources of its shape. */
function DemoDataEditor({ placement, update }: { placement: BoardPlacement; update: (p: BoardPlacement) => void }) {
  const kind = BUILTIN_KINDS.find((k) => k.type === placement.type);
  const binding = (placement.binding ?? {}) as Record<string, string>;
  if (!kind || kind.slots.length === 0) return <p className="text-xs text-text-secondary">This widget has no data.</p>;
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">Data source</legend>
      {kind.slots.map((slot) => (
        <label key={slot.key} className="flex flex-col gap-1 text-xs text-text-secondary">
          {slot.label}{slot.required ? ' *' : ''}
          <select value={binding[slot.key] ?? ''}
            onChange={(e) => {
              const next = { ...binding };
              if (e.target.value) next[slot.key] = e.target.value; else delete next[slot.key];
              update({ ...placement, binding: next });
            }}
            className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <option value="">Not bound</option>
            {DEMO_SOURCES.filter((s) => s.data.shape === slot.shape).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The IoT theme's dashboard, built on WidgetKit: every card is a settings-template-driven widget
 * that can be edited ThingsBoard-style, and the whole board (every card with its settings and data
 * binding) exports to and imports from one JSON file. Edits stay in this browser.
 */
const noop = () => () => {};

export function IotDashboard() {
  // The demo's data and the saved board exist only in the browser (timestamps relative to "now",
  // localStorage): render the board after hydration so server and client agree.
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const [stored, setStored] = useLocalSetting(STORAGE_KEY);
  const doc = useMemo(() => parseBoard(stored), [stored]);
  const [pump, setPump] = useState<boolean>(true);
  const save = (next: BoardDocument) => setStored(JSON.stringify(exportBoard(next, BUILTIN_KINDS)));

  const data = useMemo(() => {
    const out: Record<string, Record<string, SlotData | undefined>> = {};
    for (const p of doc.placements) {
      const b = (p.binding ?? {}) as Record<string, string>;
      out[p.id] = Object.fromEntries(Object.entries(b).map(([slot, key]) => [slot,
        key === 'pump.on' ? { shape: 'scalar', value: pump, fetchedAt: new Date().toISOString() } as SlotData : sourceData(key)]));
    }
    return out;
  }, [doc.placements, pump]);

  if (!isClient) {
    return <div className="h-full p-6" aria-busy="true"><div className="h-96 animate-pulse rounded-xl bg-surface-sunken" /></div>;
  }

  return (
    <WidgetKitProvider value={{ renderIcon }}>
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-6">
        <div className="flex justify-end">
          <button type="button" onClick={() => { void confirmDialog({ title: 'Reset dashboard', message: 'The dashboard goes back to the demo layout; your changes to it are lost.', tone: 'warning', confirmLabel: 'Reset' }).then((ok) => { if (ok) save(DEFAULT_IOT_BOARD); }); }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faRotateLeft} className="h-3 w-3" aria-hidden="true" /> Reset demo
          </button>
        </div>
        <WidgetBoard
          doc={doc}
          onChange={save}
          data={data}
          kinds={BUILTIN_KINDS}
          views={BUILTIN_VIEWS}
          renderDataEditor={(p, update) => <DemoDataEditor placement={p} update={update} />}
          onControl={async (id, req) => {
            if (id === 'pump' && req.kind === 'set') {
              await new Promise((r) => setTimeout(r, 400));
              setPump(Boolean(req.value));
            }
          }}
          controlDisabledReason={(p) => (p.id === 'pump' ? undefined : 'Demo: only the coolant pump is wired.')}
        />
      </div>
    </WidgetKitProvider>
  );
}
