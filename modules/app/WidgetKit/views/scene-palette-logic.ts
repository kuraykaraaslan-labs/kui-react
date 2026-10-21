// The palette's pure parts (no React): which tiles show for a search, a family and a sector, how the arrow keys move
// through a grid that has a "recent" row above the results, and the thumbnail each symbol is drawn with.

import type { SlotData } from '../kind';
import { isScadaSymbol, scadaModel, type ScadaSymbol } from './scada-logic';
import { searchSymbols } from './scada-aliases';
import type { SvgNode } from './svg-node';

/** How many recently used symbols the palette shows. */
export const RECENT_MAX = 8;

export interface PaletteFilter { query?: string; family?: string; sector?: string; recent?: readonly string[]; locale?: string }

export interface PaletteSections {
  /** Recently used symbols that are still in the library (and in the family and sector chosen); none while a search is typed. */
  recent: string[];
  /** Everything that matches, best first. */
  results: string[];
}

/** The tiles for a search, a family and a sector: "recent" on top when nothing is searched, then the ranked results. */
export function paletteSections(f: PaletteFilter): PaletteSections {
  const results = searchSymbols(f.query ?? '', { locale: f.locale, family: f.family, sector: f.sector });
  if ((f.query ?? '').trim()) return { recent: [], results };
  const shown = new Set(results);
  const recent: string[] = [];
  for (const k of f.recent ?? []) {
    if (recent.length >= RECENT_MAX) break;
    if (isScadaSymbol(k) && shown.has(k) && !recent.includes(k)) recent.push(k);
  }
  return { recent, results };
}

export interface GridPos { section: number; index: number }
export type GridKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/**
 * Where an arrow key leads in a grid of sections laid out `cols` wide (`sizes` = tiles per section). Left and right walk
 * the tiles one by one across the end of a row and of a section; up and down keep the column, crossing into the next
 * or previous section at its nearest tile in that column; Home and End go to the first and the last tile of all.
 * A position outside the grid is taken to the first tile. Returns the same position at the edges.
 */
export function moveInGrid(sizes: readonly number[], cols: number, pos: GridPos, key: GridKey): GridPos {
  const sec = sizes.map((n, i) => ({ n, i })).filter((s) => s.n > 0);
  if (!sec.length) return pos;
  const c = Math.max(1, Math.floor(cols));
  const at = sec.findIndex((s) => s.i === pos.section);
  if (at < 0 || pos.index < 0 || pos.index >= sec[at].n) return { section: sec[0].i, index: 0 };
  const here = sec[at];
  if (key === 'Home') return { section: sec[0].i, index: 0 };
  if (key === 'End') { const l = sec[sec.length - 1]; return { section: l.i, index: l.n - 1 }; }
  if (key === 'ArrowRight') {
    if (pos.index + 1 < here.n) return { section: here.i, index: pos.index + 1 };
    return at + 1 < sec.length ? { section: sec[at + 1].i, index: 0 } : pos;
  }
  if (key === 'ArrowLeft') {
    if (pos.index > 0) return { section: here.i, index: pos.index - 1 };
    return at > 0 ? { section: sec[at - 1].i, index: sec[at - 1].n - 1 } : pos;
  }
  const col = pos.index % c;
  if (key === 'ArrowDown') {
    if (pos.index + c < here.n) return { section: here.i, index: pos.index + c };
    // A short last row: the last tile is the nearest below. On the last row: the next section's first row.
    const lastRowStart = Math.floor((here.n - 1) / c) * c;
    if (pos.index < lastRowStart) return { section: here.i, index: here.n - 1 };
    if (at + 1 >= sec.length) return pos;
    const next = sec[at + 1];
    return { section: next.i, index: Math.min(col, next.n - 1) };
  }
  // ArrowUp
  if (pos.index - c >= 0) return { section: here.i, index: pos.index - c };
  if (at === 0) return pos;
  const prev = sec[at - 1];
  const lastRowStart = Math.floor((prev.n - 1) / c) * c;
  return { section: prev.i, index: Math.min(lastRowStart + col, prev.n - 1) };
}

export interface SymbolThumb { viewBox: string; nodes: SvgNode[] }

const scalar = (value: number | boolean): SlotData => ({ shape: 'scalar', value });
const THUMBS = new Map<string, SymbolThumb>();

/**
 * A symbol drawn for the palette from its own drawing: running, with something to show where it has a level or a dial,
 * in the quiet ink (not the running green, a grid of 243 would shout), no animation, no name and no number. Pure, so
 * each is drawn once and kept.
 */
export function symbolThumb(key: string): SymbolThumb | null {
  if (!isScadaSymbol(key)) return null;
  const hit = THUMBS.get(key);
  if (hit) return hit;
  const m = scadaModel(
    { symbol: key as ScadaSymbol, animation: false, showLabel: false, showValue: false, runningColor: 'var(--text-secondary)', length: 1 },
    { running: scalar(true), value: scalar(60), value2: scalar(40) },
    { animate: false },
  );
  const thumb = { viewBox: m.viewBox, nodes: m.nodes };
  THUMBS.set(key, thumb);
  return thumb;
}
