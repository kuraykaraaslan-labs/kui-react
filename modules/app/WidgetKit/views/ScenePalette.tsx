'use client';
// The symbol palette: every symbol of the registry by family and sector, searched by name and alias, drawn from its own
// drawing. Click, double click or Enter adds; a tile drags onto the canvas (`text/x-scada-symbol` carries the key).
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { cn } from '@/libs/utils/cn';
import { SCADA_SYMBOL_DEFS, type SymbolDef } from './scada-logic';
import { symbolFamilies, SECTORS } from './scada-aliases';
import { mergeMessages, DEFAULT_PALETTE_MESSAGES, type DeepPartial, type PaletteMessages } from './scene-editor-messages-panels';
import { moveInGrid, paletteSections, symbolThumb, type GridKey, type GridPos } from './scene-palette-logic';
import { SvgTree } from './SvgTree';
import { CONTROL, SMALL_BUTTON } from './scene-panel-ui';

/** The data type the canvas reads from a dragged tile. */
export const SYMBOL_DRAG_TYPE = 'text/x-scada-symbol';

export interface ScenePaletteProps {
  /** Add the symbol at the centre of the view (click or Enter) or by dragging it onto the canvas (the shell reads `onDragStart`). */
  onAdd: (symbol: string) => void;
  onDragStart?: (symbol: string, event: React.DragEvent | React.PointerEvent) => void;
  recent?: string[];
  locale?: string;
  /** Which gesture adds: a single click (default; touch friendly) or a double click. Enter always adds. */
  addOn?: 'click' | 'doubleClick';
  /** Any part of the panel's texts, in the host's language. */
  messages?: DeepPartial<PaletteMessages>;
  className?: string;
}

const DEFAULT_COLS = 3;
const TILE_MIN = 104;
const nameOf = (key: string) => (SCADA_SYMBOL_DEFS[key as keyof typeof SCADA_SYMBOL_DEFS] as SymbolDef | undefined)?.label ?? key;

/** A filter that narrows the list stands out from one left at "All". */
const filterClass = (on: boolean) => cn(CONTROL, 'min-w-0 flex-1 cursor-pointer truncate py-1 text-xs', on && 'border-primary bg-primary-subtle text-primary');

/**
 * The drawing of one tile. A symbol's thumbnail never changes, so the subtree is memoised by key: moving the focus, typing in the
 * search or any other re-render of the palette leaves the (several thousand) SVG nodes of the other tiles alone.
 */
const Thumb = memo(function Thumb({ symbol }: { symbol: string }) {
  const thumb = symbolThumb(symbol);
  return (
    <svg viewBox={thumb?.viewBox ?? '0 0 100 100'} preserveAspectRatio="xMidYMid meet" className="h-12 w-full" aria-hidden="true" focusable="false">
      {thumb && <SvgTree nodes={thumb.nodes} />}
    </svg>
  );
});

export function ScenePalette({ onAdd, onDragStart, recent, locale, addOn = 'click', messages, className }: ScenePaletteProps) {
  const m = useMemo(() => mergeMessages<PaletteMessages>(DEFAULT_PALETTE_MESSAGES, messages), [messages]);
  const base = useId();
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [sector, setSector] = useState('');
  const [active, setActive] = useState<GridPos>({ section: 0, index: 0 });
  const [cols, setCols] = useState(DEFAULT_COLS);
  const grid = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const sections = useMemo(() => paletteSections({ query, family, sector, recent, locale }), [query, family, sector, recent, locale]);
  const lists = [sections.recent, sections.results];
  const sizes = lists.map((l) => l.length);
  const families = useMemo(() => symbolFamilies(), []);
  // Only the sectors that have a symbol in the family chosen.
  const sectorsHere = useMemo(() => SECTORS.filter((s) => !family || paletteSections({ family, sector: s }).results.length > 0), [family]);

  // The grid is as many tiles wide as fit; the arrow keys need the number.
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setCols(Math.max(2, Math.floor(el.clientWidth / TILE_MIN)) || DEFAULT_COLS));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A search or filter that moves the tiles puts the single tab stop back on the first one.
  const [seen, setSeen] = useState(`${query}|${family}|${sector}`);
  if (seen !== `${query}|${family}|${sector}`) { setSeen(`${query}|${family}|${sector}`); setActive({ section: sizes[0] ? 0 : 1, index: 0 }); }
  const here = sizes[active.section] > active.index ? active : { section: sizes[0] ? 0 : 1, index: 0 };

  const tileId = (section: number, index: number) => `${base}-${section}-${index}`;
  const focusTile = (p: GridPos) => {
    setActive(p);
    requestAnimationFrame(() => document.getElementById(tileId(p.section, p.index))?.focus());
  };

  const onTileKey = (e: KeyboardEvent<HTMLDivElement>, key: string, p: GridPos) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(key); return; }
    if (e.key === 'Escape') { search.current?.focus(); return; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const to = moveInGrid(sizes, cols, p, e.key as GridKey);
      if (to.section !== p.section || to.index !== p.index) {
        setActive(to);
        document.getElementById(tileId(to.section, to.index))?.focus();
      }
    }
  };

  const onDrag = (e: DragEvent<HTMLDivElement>, key: string) => {
    e.dataTransfer.setData(SYMBOL_DRAG_TYPE, key);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(key, e);
  };

  const tile = (key: string, section: number, index: number) => {
    const on = here.section === section && here.index === index;
    return (
      <div
        key={`${section}:${key}`}
        id={tileId(section, index)}
        role="option"
        aria-selected={on}
        aria-label={m.add(nameOf(key))}
        tabIndex={on ? 0 : -1}
        draggable
        data-symbol={key}
        onFocus={() => setActive({ section, index })}
        onClick={addOn === 'click' ? () => onAdd(key) : () => setActive({ section, index })}
        onDoubleClick={addOn === 'doubleClick' ? () => onAdd(key) : undefined}
        onKeyDown={(e) => onTileKey(e, key, { section, index })}
        onDragStart={(e) => onDrag(e, key)}
        title={`${nameOf(key)} (${key})`}
        className={cn(
          'flex cursor-pointer select-none flex-col items-center gap-1 rounded-lg border bg-surface-raised p-1.5 text-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          on ? 'border-primary' : 'border-border hover:border-border-strong',
        )}
        // Tiles far off screen are not laid out or painted until they scroll near.
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' }}
      >
        <Thumb symbol={key} />
        <span className="w-full truncate text-xs font-medium leading-tight text-text-primary">{nameOf(key)}</span>
        <span className="w-full truncate font-mono text-[10px] leading-tight text-text-secondary">{key}</span>
      </div>
    );
  };

  const total = sections.results.length;
  return (
    <section aria-label={m.title} className={cn('flex min-h-0 flex-col gap-2', className)} data-panel="palette">
      <div className="relative">
        <input
          ref={search} type="search" value={query} aria-label={m.search} placeholder={m.searchPlaceholder} autoComplete="off" spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && total) { e.preventDefault(); focusTile(here); }
            else if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); }
            else if (e.key === 'Enter' && total) { e.preventDefault(); onAdd(sections.results[0]); }
          }}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 pr-9 text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        />
        {query && (
          <button type="button" aria-label={m.clearSearch} onClick={() => { setQuery(''); search.current?.focus(); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            ×
          </button>
        )}
      </div>

      {/* A filter with one choice narrows nothing, so it is left out. */}
      {(families.length > 1 || sectorsHere.length > 1) && (
        <div className="flex gap-2" data-part="filters">
          {families.length > 1 && (
            <select aria-label={m.familyGroup} title={m.familyGroup} value={family} onChange={(e) => { setFamily(e.target.value); setSector(''); }} className={filterClass(!!family)}>
              <option value="">{m.allFamilies}</option>
              {families.map((f) => <option key={f} value={f}>{m.families[f]}</option>)}
            </select>
          )}
          {sectorsHere.length > 1 && (
            <select aria-label={m.sectorGroup} title={m.sectorGroup} value={sector} onChange={(e) => setSector(e.target.value)} className={filterClass(!!sector)}>
              <option value="">{m.allSectors}</option>
              {sectorsHere.map((s) => <option key={s} value={s}>{m.sectors[s]}</option>)}
            </select>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-[11px] text-text-secondary">{total ? m.count(total) : m.none}</p>
        {(family || sector) && (
          <button type="button" onClick={() => { setFamily(''); setSector(''); }} className={cn(SMALL_BUTTON, 'shrink-0 text-[11px]')}>{m.clearFilters}</button>
        )}
      </div>

      <div ref={grid} className="min-h-0 flex-1 overflow-y-auto pr-1" data-part="grid">
        {total > 0 && (
          <div role="listbox" aria-label={m.list} aria-describedby={`${base}-hint`} className="space-y-3">
            {sections.recent.length > 0 && (
              <div role="group" aria-label={m.recent}>
                <p aria-hidden="true" className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">{m.recent}</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {sections.recent.map((k, i) => tile(k, 0, i))}
                </div>
              </div>
            )}
            <div role="group" aria-label={m.list}>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {sections.results.map((k, i) => tile(k, 1, i))}
              </div>
            </div>
          </div>
        )}
      </div>
      <p id={`${base}-hint`} className="text-[11px] text-text-secondary">{m.hint}</p>
    </section>
  );
}
