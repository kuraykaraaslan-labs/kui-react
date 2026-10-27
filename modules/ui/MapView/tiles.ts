// The basemap: OpenStreetMap's standard tiles by default, or the installation's own tile source (`MapTileSource`,
// set once with `MapTilesProvider`). Pure (no React, no Leaflet), so a host's server can check a source too.

import type { MapTiles, MapTileSource } from './types';

export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * The default basemap: OpenStreetMap's standard tiles, keyless, with their attribution; the dark theme draws them
 * darkened. OSM's tile policy fits light use: an installation with real traffic sets a keyed provider of its own.
 */
export const OSM_TILES: MapTileSource = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: OSM_ATTRIBUTION,
  maxZoom: 19,
};

/** A source as the light / dark tile pair a map draws: `darkUrl` for the dark theme, else the light tiles darkened. */
export function tileSourceTiles(source: MapTileSource): { light: MapTiles; dark: MapTiles } {
  const light: MapTiles = {
    url: source.url,
    attribution: source.attribution,
    ...(source.subdomains !== undefined ? { subdomains: source.subdomains } : {}),
    ...(source.maxZoom !== undefined ? { maxZoom: source.maxZoom } : {}),
  };
  return { light, dark: source.darkUrl ? { ...light, url: source.darkUrl } : { ...light, dim: true } };
}

// An https URL template with {z}, {x} and {y} and no quotes, angle brackets, backslashes, spaces or control characters.
const TILE_URL_RE = /^https:\/\/[^\s"'<>\\\u0000-\u001f\u007f]{1,480}$/;
const tileUrl = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const url = v.trim();
  return TILE_URL_RE.test(url) && ['{z}', '{x}', '{y}'].every((p) => url.includes(p)) ? url : undefined;
};

// A link in an attribution: an https address and plain text, nothing else.
const ATTRIBUTION_LINK_RE = /<a href="(https:\/\/[^\s"'<>\\]{1,200})">([^<>]{1,120})<\/a>/g;
const escapeText = (t: string): string => t.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Attribution HTML that may only hold text, entities and `<a href="https://…">text</a>` links; any other markup is escaped. */
export function safeAttribution(html: string): string {
  let out = '';
  let at = 0;
  for (const m of html.matchAll(ATTRIBUTION_LINK_RE)) {
    out += escapeText(html.slice(at, m.index)) + `<a href="${m[1]}">${escapeText(m[2])}</a>`;
    at = (m.index ?? 0) + m[0].length;
  }
  return out + escapeText(html.slice(at));
}

/**
 * A host's tile source, checked: the URLs are https templates with {z} {x} {y}, the subdomains short letters or digits,
 * the deepest zoom a whole number from 1 to 22 and the attribution text with plain links (it is written into the page).
 * Returns `undefined` when the URL or the attribution is missing or unusable; a bad optional field is dropped.
 */
export function safeTileSource(value: unknown): MapTileSource | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const url = tileUrl(v.url);
  const attribution = typeof v.attribution === 'string' ? v.attribution.trim() : '';
  if (!url || !attribution || attribution.length > 500) return undefined;
  const subs = typeof v.subdomains === 'string' ? v.subdomains.trim() : Array.isArray(v.subdomains) ? v.subdomains : undefined;
  const subdomains = typeof subs === 'string'
    ? (/^[a-z0-9]{1,10}$/i.test(subs) ? subs : undefined)
    : subs && subs.length > 0 && subs.length <= 10 && subs.every((s) => typeof s === 'string' && /^[a-z0-9-]{1,20}$/i.test(s)) ? subs as string[] : undefined;
  const maxZoom = typeof v.maxZoom === 'number' && Number.isInteger(v.maxZoom) && v.maxZoom >= 1 && v.maxZoom <= 22 ? v.maxZoom : undefined;
  const darkUrl = tileUrl(v.darkUrl);
  return {
    url,
    attribution: safeAttribution(attribution),
    ...(subdomains ? { subdomains } : {}),
    ...(maxZoom !== undefined ? { maxZoom } : {}),
    ...(darkUrl ? { darkUrl } : {}),
  };
}
