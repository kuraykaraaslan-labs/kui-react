'use client';
import { useEffect, useMemo, useState } from 'react';
import { MapCanvas, type MapTilesConfig } from '@/modules/ui/MapView';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { expandLinkTemplate } from './DataTableView';
import { MAP_LAYER_BOX_CLASS, MAP_LAYER_LABEL_CLASS, MAP_LEGEND_ITEM_CLASS, REPLAY_SECONDS, mapCsv, mapIsEmpty, mapModel, replayMarkers } from './map-logic';

export * from './map-logic';

type Row = Record<string, unknown>;

export type MapWidgetViewProps = WidgetViewProps & {
  /** Run the placement's marker-click actions with the marker's row. */
  onMarkerClick?: (row: Row) => void;
  /** Navigate to a marker's (validated, internal) link on click; without it, the link is offered in the tooltip only. */
  onNavigate?: (href: string) => void;
  /** The platform's tile server, used by the "Follow the theme" style. */
  tiles?: MapTilesConfig;
  /** The platform's imagery provider, used by the "Satellite" style (else Esri's keyless imagery). */
  imagery?: MapTilesConfig;
  loadingLabel?: string;
  ariaLabel?: string;
  legendLabel?: string;
  /** The layer switch's texts (its group name and the three layers). */
  layerLabels?: { layers?: string; markers?: string; zones?: string; routes?: string };
};

/** `map`: bound rows as markers on a card-less map that fills the card, with an optional colour legend. */
export function MapWidgetView({
  settings, data, locale, renderLink, onMarkerClick, onNavigate, tiles, imagery, loadingLabel, ariaLabel, legendLabel, layerLabels, resolveUrl, onControl, controlDisabledReason,
}: MapWidgetViewProps) {
  const kit = useKitMessages();
  const hasMarkerClick = !!onMarkerClick;
  const hasNavigate = !!onNavigate;
  // A dropped marker is written back through the placement's command, when there is one and it is allowed.
  const movable = !!onControl && !controlDisabledReason;
  // A host's inline `layerLabels` object is a new identity each render: key it by value so the markers stay stable.
  const layerKey = JSON.stringify(layerLabels ?? null);
  const g = useMemo(
    () => mapModel(settings, data, locale, {
      messages: { map: kit.map, common: kit.common }, resolveUrl, tiles, imagery, loadingLabel, ariaLabel, legendLabel, movable,
      layerLabels: JSON.parse(layerKey) as MapWidgetViewProps['layerLabels'] ?? undefined, hasMarkerClick, hasNavigate,
    }),
    [settings, data, locale, kit.map, kit.common, resolveUrl, tiles, imagery, loadingLabel, ariaLabel, legendLabel, layerKey, hasMarkerClick, hasNavigate, movable],
  );
  const { markers, zones, routes, legend, layers } = g;
  // The layer switch (20.3d): which layers are on. Hidden ones still frame the view, so switching never moves the map.
  const [shown, setShown] = useState({ markers: true, zones: true, routes: true });

  // Route replay: viewer state (playing, where, how fast); the routes and their pace are the model's.
  const { replay } = g;
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(replay.speed);
  useEffect(() => { setSpeed(replay.speed); }, [replay.speed]);
  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const next = p + (dt * speed) / REPLAY_SECONDS;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  const timeText = (ms: number) => new Date(ms).toLocaleString(locale);
  const replayExtra = useMemo(
    () => (replay.enabled ? replayMarkers(replay.routes, progress, { start: kit.map.start, end: kit.map.end }, timeText) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replay.enabled, replay.routes, progress, kit.map.start, kit.map.end, locale],
  );
  const now = replay.timeSpan ? timeText(replay.timeSpan.from + progress * (replay.timeSpan.to - replay.timeSpan.from)) : `${Math.round(progress * 100)} %`;

  const handleMove = g.movable
    ? (id: string, [y, x]: [number, number]) => { if (g.rows[id]) void onControl?.({ kind: 'set', value: { id, x, y } }).catch(() => undefined); }
    : undefined;

  const handleClick = (id: string) => {
    const row = g.rows[id];
    if (!row) return;
    onMarkerClick?.(row);
    const href = expandLinkTemplate((settings as { linkTemplate?: string }).linkTemplate, row);
    if (href && onNavigate) onNavigate(href);
  };

  return (
    <div className="relative h-full min-h-40 w-full">
      <MapCanvas
        markers={replay.enabled ? [...markers, ...replayExtra] : markers}
        zones={zones}
        routes={routes}
        showMarkers={shown.markers}
        showZones={shown.zones}
        showRoutes={shown.routes}
        {...g.canvas}
        renderLink={renderLink}
        onMarkerClick={g.clickable ? handleClick : undefined}
        onMarkerMove={handleMove}
      />
      {replay.enabled && (
        <div role="group" aria-label={kit.map.replay} data-part="replay"
          className="absolute left-1/2 top-2 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-surface-raised/90 px-2.5 py-1.5 text-[11px] text-text-primary shadow-sm backdrop-blur-sm">
          <button type="button" className="rounded-md border border-border px-2 py-0.5 font-medium hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => { if (progress >= 1) setProgress(0); setPlaying((v) => !v); }}>
            {playing ? kit.map.pause : kit.map.play}
          </button>
          <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} aria-label={kit.map.position} className="h-1 min-w-24 flex-1"
            onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value) / 1000); }} />
          <span className="min-w-14 whitespace-nowrap tabular-nums text-text-secondary" data-part="replay-time">{now}</span>
          <span role="group" aria-label={kit.map.speed} className="flex gap-0.5">
            {replay.speeds.map((v) => (
              <button key={v} type="button" aria-pressed={speed === v}
                className={`rounded px-1.5 py-0.5 tabular-nums focus-visible:ring-2 focus-visible:ring-border-focus ${speed === v ? 'bg-primary text-primary-fg' : 'hover:bg-surface-sunken'}`}
                onClick={() => setSpeed(v)}>{v}×</button>
            ))}
          </span>
        </div>
      )}
      {g.showSwitch && (
        <fieldset data-part="layers" className={g.switchClass}>
          <legend className="sr-only">{g.layerText.layers}</legend>
          {layers.map((k) => (
            <label key={k} className={MAP_LAYER_LABEL_CLASS}>
              <input
                type="checkbox"
                className={MAP_LAYER_BOX_CLASS}
                checked={shown[k]}
                onChange={(e) => setShown((v) => ({ ...v, [k]: e.target.checked }))}
              />
              {g.layerText[k]}
            </label>
          ))}
        </fieldset>
      )}
      {legend.length > 0 && (
        <ul aria-label={g.legendLabel} data-part="legend" className={g.legendClass}>
          {legend.map((e) => (
            <li key={e.label} className={MAP_LEGEND_ITEM_CLASS}>
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className="min-w-0 truncate">{e.label}</span>
              {e.count !== undefined && <span className="ml-auto pl-2 tabular-nums text-text-secondary">{e.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const MAP_VIEW: WidgetKindView = {
  View: MapWidgetView,
  isEmpty: (data, settings) => mapIsEmpty(data, settings),
  toCsv: (data, settings) => mapCsv(data, settings),
  emptyShape: true,
};
