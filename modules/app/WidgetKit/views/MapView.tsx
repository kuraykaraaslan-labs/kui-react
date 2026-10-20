'use client';
import { useMemo, useState } from 'react';
import { MapCanvas, type MapTilesConfig } from '@/modules/ui/MapView';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { useKitMessages } from '../WidgetKitContext';
import { expandLinkTemplate } from './DataTableView';
import { MAP_LAYER_BOX_CLASS, MAP_LAYER_LABEL_CLASS, MAP_LEGEND_ITEM_CLASS, mapCsv, mapIsEmpty, mapModel } from './map-logic';

export * from './map-logic';

type Row = Record<string, unknown>;

export type MapWidgetViewProps = WidgetViewProps & {
  /** Run the placement's marker-click actions with the marker's row. */
  onMarkerClick?: (row: Row) => void;
  /** Navigate to a marker's (validated, internal) link on click; without it, the link is offered in the tooltip only. */
  onNavigate?: (href: string) => void;
  /** The platform's tile server, used by the "Follow the theme" style. */
  tiles?: MapTilesConfig;
  loadingLabel?: string;
  ariaLabel?: string;
  legendLabel?: string;
  /** The layer switch's texts (its group name and the three layers). */
  layerLabels?: { layers?: string; markers?: string; zones?: string; routes?: string };
};

/** `map`: bound rows as markers on a card-less map that fills the card, with an optional colour legend. */
export function MapWidgetView({
  settings, data, locale, renderLink, onMarkerClick, onNavigate, tiles, loadingLabel, ariaLabel, legendLabel, layerLabels, resolveUrl,
}: MapWidgetViewProps) {
  const kit = useKitMessages();
  const hasMarkerClick = !!onMarkerClick;
  const hasNavigate = !!onNavigate;
  // A host's inline `layerLabels` object is a new identity each render: key it by value so the markers stay stable.
  const layerKey = JSON.stringify(layerLabels ?? null);
  const g = useMemo(
    () => mapModel(settings, data, locale, {
      messages: { map: kit.map, common: kit.common }, resolveUrl, tiles, loadingLabel, ariaLabel, legendLabel,
      layerLabels: JSON.parse(layerKey) as MapWidgetViewProps['layerLabels'] ?? undefined, hasMarkerClick, hasNavigate,
    }),
    [settings, data, locale, kit.map, kit.common, resolveUrl, tiles, loadingLabel, ariaLabel, legendLabel, layerKey, hasMarkerClick, hasNavigate],
  );
  const { markers, zones, routes, legend, layers } = g;
  // The layer switch (20.3d): which layers are on. Hidden ones still frame the view, so switching never moves the map.
  const [shown, setShown] = useState({ markers: true, zones: true, routes: true });

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
        markers={markers}
        zones={zones}
        routes={routes}
        showMarkers={shown.markers}
        showZones={shown.zones}
        showRoutes={shown.routes}
        {...g.canvas}
        renderLink={renderLink}
        onMarkerClick={g.clickable ? handleClick : undefined}
      />
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
