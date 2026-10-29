import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ScenePalette, SYMBOL_DRAG_TYPE } from '../views/ScenePalette';
import { moveInGrid, paletteSections, RECENT_MAX, symbolThumb } from '../views/scene-palette-logic';
import { SCADA_SYMBOLS } from '../views/scada-logic';

const tiles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="option"]')];
const keys = (c: HTMLElement) => tiles(c).map((t) => t.getAttribute('data-symbol'));

describe('paletteSections', () => {
  it('lists recent symbols on top while nothing is searched, once each, valid ones only, at most the cap', () => {
    const recent = ['home.plug.smart', 'nope', 'home.plug.smart', ...SCADA_SYMBOLS, ...SCADA_SYMBOLS];
    const s = paletteSections({ recent });
    expect(s.recent[0]).toBe('home.plug.smart');
    expect(s.recent).not.toContain('nope');
    expect(new Set(s.recent).size).toBe(s.recent.length);
    expect(s.recent.length).toBe(Math.min(RECENT_MAX, SCADA_SYMBOLS.length));
    expect(s.results).toHaveLength(SCADA_SYMBOLS.length);
  });
  it('shows no recent row while a search is typed, and only the recent ones the filters keep', () => {
    expect(paletteSections({ query: 'camera', recent: ['home.plug.smart'] }).recent).toEqual([]);
    expect(paletteSections({ sector: 'telecom', recent: ['home.plug.smart', 'home.router'] }).recent).toEqual(['home.router']);
    expect(paletteSections({ sector: 'energy', recent: ['home.tv'] }).recent).toEqual([]);
  });
});

describe('moveInGrid', () => {
  const sizes = [3, 7];
  it('walks left and right across rows and sections, and stops at the ends', () => {
    expect(moveInGrid(sizes, 3, { section: 0, index: 0 }, 'ArrowRight')).toEqual({ section: 0, index: 1 });
    expect(moveInGrid(sizes, 3, { section: 0, index: 2 }, 'ArrowRight')).toEqual({ section: 1, index: 0 });
    expect(moveInGrid(sizes, 3, { section: 1, index: 0 }, 'ArrowLeft')).toEqual({ section: 0, index: 2 });
    expect(moveInGrid(sizes, 3, { section: 0, index: 0 }, 'ArrowLeft')).toEqual({ section: 0, index: 0 });
    expect(moveInGrid(sizes, 3, { section: 1, index: 6 }, 'ArrowRight')).toEqual({ section: 1, index: 6 });
  });
  it('keeps the column going up and down, crossing sections', () => {
    expect(moveInGrid(sizes, 3, { section: 1, index: 1 }, 'ArrowDown')).toEqual({ section: 1, index: 4 });
    expect(moveInGrid(sizes, 3, { section: 1, index: 4 }, 'ArrowDown')).toEqual({ section: 1, index: 6 });
    expect(moveInGrid(sizes, 3, { section: 1, index: 6 }, 'ArrowDown')).toEqual({ section: 1, index: 6 });
    expect(moveInGrid(sizes, 3, { section: 0, index: 1 }, 'ArrowDown')).toEqual({ section: 1, index: 1 });
    expect(moveInGrid(sizes, 3, { section: 1, index: 2 }, 'ArrowUp')).toEqual({ section: 0, index: 2 });
    expect(moveInGrid([2, 7], 3, { section: 1, index: 2 }, 'ArrowUp')).toEqual({ section: 0, index: 1 });
    expect(moveInGrid(sizes, 3, { section: 0, index: 1 }, 'ArrowUp')).toEqual({ section: 0, index: 1 });
  });
  it('goes home and end, skips an empty section, and recovers from a position outside the grid', () => {
    expect(moveInGrid([0, 5], 2, { section: 1, index: 3 }, 'Home')).toEqual({ section: 1, index: 0 });
    expect(moveInGrid([3, 5], 2, { section: 0, index: 0 }, 'End')).toEqual({ section: 1, index: 4 });
    expect(moveInGrid([0, 5], 2, { section: 1, index: 4 }, 'ArrowUp')).toEqual({ section: 1, index: 2 });
    expect(moveInGrid([3, 5], 2, { section: 1, index: 99 }, 'ArrowLeft')).toEqual({ section: 0, index: 0 });
    expect(moveInGrid([0, 0], 2, { section: 0, index: 0 }, 'ArrowDown')).toEqual({ section: 0, index: 0 });
  });
});

describe('symbolThumb', () => {
  it('draws every symbol once from its own drawing, running and still', () => {
    for (const k of SCADA_SYMBOLS) {
      const t = symbolThumb(k);
      expect(t, k).not.toBeNull();
      expect(t!.nodes.length, k).toBeGreaterThan(0);
      expect(JSON.stringify(t!.nodes)).not.toContain('animate');
    }
    expect(symbolThumb('home.router')).toBe(symbolThumb('home.router'));
    expect(symbolThumb('nope')).toBeNull();
  });
});

describe('ScenePalette', () => {
  it('draws a tile for every symbol of the registry with its name (the key only in the tooltip, m-R3-07), in a listbox', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'Symbols' })).toBeInTheDocument();
    expect(keys(container)).toHaveLength(SCADA_SYMBOLS.length);
    const tile = container.querySelector('[data-symbol="home.plug.smart"]')!;
    expect(tile).toHaveTextContent('Smart plug');
    expect(tile).not.toHaveTextContent('home.plug.smart');
    expect(tile).toHaveAttribute('title', 'Smart plug (home.plug.smart)');
    expect(tile.querySelector('svg')!.children.length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(`${SCADA_SYMBOLS.length} symbols`);
  });
  it('renders every thumbnail in a bounded time', () => {
    const t = performance.now();
    render(<ScenePalette onAdd={() => {}} />);
    const ms = performance.now() - t;
    // Measured about 170 ms for the whole grid (jsdom, thumbnails already drawn); the grid is not windowed, tiles off screen
    // are skipped by the browser (`content-visibility`). The bound only catches a regression to something unusable.
    expect(ms).toBeLessThan(6000);
  });
  it('searches with the ranking: the plain name first, and says when nothing matches', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    const box = screen.getByRole('searchbox', { name: 'Search symbols' });
    fireEvent.change(box, { target: { value: 'router' } });
    expect(keys(container)[0]).toBe('home.router');
    fireEvent.change(box, { target: { value: 'smart' } });
    expect(keys(container).slice(0, 2)).toEqual(expect.arrayContaining(['home.plug.smart', 'home.tv']));
    fireEvent.change(box, { target: { value: 'zzzzqq' } });
    expect(tiles(container)).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent(/No symbol matches/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(tiles(container)).toHaveLength(SCADA_SYMBOLS.length);
  });
  it('filters by sector, leaves out a filter with one choice, and clears the filters', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    // One family only: a family filter would narrow nothing.
    expect(screen.queryByRole('combobox', { name: 'Family' })).toBeNull();
    const sec = screen.getByRole('combobox', { name: 'Sector' });
    expect(within(sec).getAllByRole('option').map((o) => o.textContent)).toEqual(['All sectors', 'Home', 'Telecom', 'Energy', 'Safety', 'City']);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    fireEvent.change(sec, { target: { value: 'energy' } });
    expect(keys(container)).toEqual(['home.plug.smart']);
    fireEvent.change(sec, { target: { value: 'telecom' } });
    expect(keys(container)).toEqual(['home.router']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(sec).toHaveValue('');
    expect(keys(container)).toHaveLength(SCADA_SYMBOLS.length);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
  it('shows recent symbols on top, and hides them while searching', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} recent={['home.camera.security', 'home.router']} />);
    expect(keys(container).slice(0, 2)).toEqual(['home.camera.security', 'home.router']);
    expect(screen.getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cctv' } });
    expect(screen.queryByRole('group', { name: 'Recent' })).toBeNull();
    expect(keys(container)[0]).toBe('home.camera.security');
  });
  it('adds on a click, never twice, and on Enter or Space', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} />);
    const tile = container.querySelector<HTMLElement>('[data-symbol="home.plug.smart"]')!;
    fireEvent.click(tile);
    fireEvent.doubleClick(tile);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('home.plug.smart');
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onAdd).toHaveBeenCalledTimes(3);
  });
  it('adds on a double click only, when asked', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} addOn="doubleClick" />);
    const tile = container.querySelector<HTMLElement>('[data-symbol="home.plug.smart"]')!;
    fireEvent.click(tile);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.doubleClick(tile);
    expect(onAdd).toHaveBeenCalledWith('home.plug.smart');
  });
  it('adds the first match on Enter in the search box and moves into the grid with the down arrow', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} />);
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'outlet' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('home.plug.smart');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    return new Promise<void>((resolve) => requestAnimationFrame(() => {
      expect(document.activeElement).toBe(tiles(container)[0]);
      resolve();
    }));
  });
  it('moves through the grid with the arrow keys (3 columns without a layout), one tab stop at a time', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    const all = tiles(container);
    expect(all.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    all[0].focus();
    fireEvent.keyDown(all[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1]);
    // Four tiles, three to a row: below the second is the short last row's only tile.
    fireEvent.keyDown(all[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[3]);
    fireEvent.keyDown(all[3], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(all[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1], { key: 'End' });
    expect(document.activeElement).toBe(all.at(-1));
    fireEvent.keyDown(all.at(-1)!, { key: 'Home' });
    expect(document.activeElement).toBe(all[0]);
    expect(all.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    expect(all[0].tabIndex).toBe(0);
    expect(all[1].getAttribute('aria-selected')).toBe('false');
  });
  it('drags a tile carrying the symbol key and tells the shell', () => {
    const onDragStart = vi.fn();
    const { container } = render(<ScenePalette onAdd={() => {}} onDragStart={onDragStart} />);
    const tile = container.querySelector<HTMLElement>('[data-symbol="home.tv"]')!;
    expect(tile.draggable).toBe(true);
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (t: string, v: string) => { data[t] = v; }, effectAllowed: '' };
    fireEvent.dragStart(tile, { dataTransfer });
    expect(data[SYMBOL_DRAG_TYPE]).toBe('home.tv');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(onDragStart).toHaveBeenCalledWith('home.tv', expect.anything());
  });
  it('takes the host\'s texts over the English ones', () => {
    render(<ScenePalette onAdd={() => {}} messages={{ search: 'Sembol ara', allSectors: 'Every sector', sectors: { telecom: 'Telecoms' } }} />);
    expect(screen.getByRole('searchbox', { name: 'Sembol ara' })).toBeInTheDocument();
    const sec = screen.getByRole('combobox', { name: 'Sector' });
    expect(within(sec).getByRole('option', { name: 'Every sector' })).toBeInTheDocument();
    expect(within(sec).getByRole('option', { name: 'Telecoms' })).toBeInTheDocument();
    expect(within(sec).getByRole('option', { name: 'Energy' })).toBeInTheDocument();
  });
});
