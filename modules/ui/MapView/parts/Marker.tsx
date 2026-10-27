'use client';
import type { ReactNode } from 'react';
import type * as LeafletLib from 'leaflet';
import type * as ReactLeaflet from 'react-leaflet';
import { Popup } from './Popup';
import { LABEL_CLASS, POPUP_CLASS, TIP_CLASS } from './styles';
import { VARIANT_HEX, markerSvg, safeMarkerColor, safeMarkerIcon, safeMarkerImage, type MapMarker } from '../types';

type MarkerProps = {
  marker: MapMarker;
  L: typeof LeafletLib;
  RLMarker: typeof ReactLeaflet.Marker;
  RLTooltip: typeof ReactLeaflet.Tooltip;
  RLPopup?: typeof ReactLeaflet.Popup;
  onMarkerClick?: (id: string) => void;
  /** A draggable marker was dropped (Leaflet coordinates). */
  onMarkerMove?: (id: string, position: [number, number]) => void;
  showLabel?: boolean;
  tooltipTrigger?: 'hover' | 'click' | 'none';
  renderLink?: (href: string, children: ReactNode, className?: string) => ReactNode;
};

export type MarkerIconSpec = {
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  tooltipAnchor: [number, number];
};

/**
 * The marker's HTML and geometry. Pure, so it is testable without Leaflet. Only a colour that
 * passes `safeMarkerColor` and an icon that passes `safeMarkerIcon` reach the HTML string.
 */
export function markerIcon(marker: MapMarker): MarkerIconSpec {
  const color = safeMarkerColor(marker.color) ?? VARIANT_HEX[marker.variant ?? 'primary'];
  const size = Math.min(64, Math.max(8, Number.isFinite(marker.size) ? (marker.size as number) : 24));
  const icon = marker.shape === 'icon' ? safeMarkerIcon(marker.icon) : undefined;
  const image = marker.shape === 'image' ? safeMarkerImage(marker.image) : undefined;
  const shape = (marker.shape === 'icon' && !icon) || (marker.shape === 'image' && !image) ? 'dot' : marker.shape ?? 'pin';
  if (shape === 'image' && image) {
    return {
      html: `<img src="${image}" alt="" draggable="false" style="display:block;width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))" />`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, -size / 2 - 2],
    };
  }
  if (shape === 'pin') {
    const h = Math.round(size * 1.5);
    return { html: markerSvg(color, size), iconSize: [size, h], iconAnchor: [size / 2, h], tooltipAnchor: [0, -h - 2] };
  }
  if (shape === 'icon') {
    return {
      html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;color:${color};font-size:${Math.round(size * 0.9)}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))"><i class="${icon}" aria-hidden="true"></i></span>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, -size / 2 - 2],
    };
  }
  // A dot or a circle may carry a short text (a count) in its middle.
  const text = markerText(marker.text);
  const inner = text
    ? `display:flex;align-items:center;justify-content:center;font:600 ${Math.max(9, Math.round(size * 0.42))}px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;`
    : 'display:block;';
  if (shape === 'circle') {
    return {
      html: `<span style="${inner}width:${size}px;height:${size}px;border-radius:9999px;background:color-mix(in srgb, ${color} 28%, transparent);border:2px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,0.25);box-sizing:border-box${text ? `;color:${color}` : ''}">${text}</span>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, -size / 2 - 2],
    };
  }
  return {
    html: `<span style="${inner}width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.4);box-sizing:border-box${text ? ';color:#ffffff;text-shadow:0 1px 1px rgba(0,0,0,0.45)' : ''}">${text}</span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], tooltipAnchor: [0, -size / 2 - 2],
  };
}

/** A marker's inner text, escaped for its HTML: at most 4 characters, '' when there is none. Pure. */
export function markerText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return [...String(value).trim()].slice(0, 4).join('')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Renders a single Leaflet marker (pin, dot, circle, icon or picture) with an optional tooltip, a permanent label
 * and a click-opened popup. Variant colours come from VARIANT_HEX; `marker.color` overrides them.
 */
export function MarkerPart({
  marker, L, RLMarker, RLTooltip, RLPopup, onMarkerClick, onMarkerMove, showLabel = false, tooltipTrigger = 'hover', renderLink,
}: MarkerProps) {
  const icon = L.divIcon({ className: '', ...markerIcon(marker) });

  // TODO M2: activeMarkerId visual state (scale + ring)

  // Leaflet's marker element is a keyboard-focusable role="button" div, but
  // has no accessible name unless one is set explicitly (axe:
  // aria-command-name). `alt` is react-leaflet's pass-through for it.
  const accessibleName = marker.tooltip?.title ?? marker.label ?? 'Map marker';
  const label = (marker.permanentLabel ?? showLabel) && marker.label ? marker.label : undefined;
  // A Leaflet marker holds one tooltip: with a permanent label, the details move to a click popup.
  const click = !!RLPopup && (tooltipTrigger === 'click' || !!label);
  const body = tooltipTrigger === 'none' ? null : marker.tooltip
    ? <Popup tooltip={marker.tooltip} renderLink={renderLink} />
    : !label && marker.label ? <span className="text-xs font-semibold">{marker.label}</span> : null;

  return (
    <RLMarker
      position={marker.position}
      icon={icon}
      alt={accessibleName}
      draggable={marker.draggable === true}
      eventHandlers={{
        click: () => onMarkerClick?.(marker.id),
        ...(marker.draggable ? { dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => { const p = e.target.getLatLng(); onMarkerMove?.(marker.id, [p.lat, p.lng]); } } : {}),
      }}
    >
      {label && (
        <RLTooltip permanent direction="right" offset={[6, 0]} className={LABEL_CLASS}>
          {label}
        </RLTooltip>
      )}
      {body && click && RLPopup && <RLPopup className={POPUP_CLASS} closeButton={false}>{body}</RLPopup>}
      {body && !click && <RLTooltip className={TIP_CLASS} direction="top" opacity={1}>{body}</RLTooltip>}
    </RLMarker>
  );
}
