import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ScenePalette, SYMBOL_DRAG_TYPE } from '../views/ScenePalette';
import { moveInGrid, paletteSections, RECENT_MAX, symbolThumb } from '../views/scene-palette-logic';
import { SCADA_SYMBOLS } from '../views/scada-logic';

// The palette draws a thumbnail for every symbol of the library (about 540): a mount takes seconds in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const tiles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="option"]')];
const keys = (c: HTMLElement) => tiles(c).map((t) => t.getAttribute('data-symbol'));

describe('paletteSections', () => {
  it('lists recent symbols on top while nothing is searched, once each, valid ones only, at most the cap', () => {
    const recent = ['pump.motor', 'nope', 'pump.motor', ...SCADA_SYMBOLS.slice(0, 20)];
    const s = paletteSections({ recent });
    expect(s.recent[0]).toBe('pump.motor');
    expect(s.recent).not.toContain('nope');
    expect(new Set(s.recent).size).toBe(s.recent.length);
    expect(s.recent.length).toBe(RECENT_MAX);
    expect(s.results).toHaveLength(SCADA_SYMBOLS.length);
  });
  it('shows no recent row while a search is typed, and only the recent ones the filters keep', () => {
    expect(paletteSections({ query: 'valve', recent: ['pump.motor'] }).recent).toEqual([]);
    expect(paletteSections({ family: 'sld', recent: ['pump.motor', 'sld.fuse'] }).recent).toEqual(['sld.fuse']);
    expect(paletteSections({ sector: 'telecom', recent: ['pump.motor'] }).recent).toEqual([]);
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
    expect(symbolThumb('pump.motor')).toBe(symbolThumb('pump.motor'));
    expect(symbolThumb('nope')).toBeNull();
  });
});

describe('ScenePalette', () => {
  it('draws a tile for every symbol of the registry with its name and key, in a listbox', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'Symbols' })).toBeInTheDocument();
    expect(keys(container)).toHaveLength(SCADA_SYMBOLS.length);
    const tile = container.querySelector('[data-symbol="pump.motor"]')!;
    expect(tile).toHaveTextContent('Motor pump');
    expect(tile).toHaveTextContent('pump.motor');
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
    fireEvent.change(box, { target: { value: 'pump' } });
    expect(keys(container)[0]).toBe('pump.motor');
    fireEvent.change(box, { target: { value: 'heat exchanger' } });
    expect(keys(container).slice(0, 2)).toEqual(expect.arrayContaining(['process.exchanger.plate', 'process.exchanger.shell']));
    fireEvent.change(box, { target: { value: 'zzzzqq' } });
    expect(tiles(container)).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent(/No symbol matches/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(tiles(container)).toHaveLength(SCADA_SYMBOLS.length);
  });
  it('filters by family and sector chips, and offers a sector only when the family has it', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} />);
    const fam = screen.getByRole('group', { name: 'Family' });
    fireEvent.click(within(fam).getByRole('button', { name: 'Single-line' }));
    expect(keys(container)).toHaveLength(16);
    expect(within(fam).getByRole('button', { name: 'Single-line' })).toHaveAttribute('aria-pressed', 'true');
    const sec = screen.getByRole('group', { name: 'Sector' });
    expect(within(sec).queryByRole('button', { name: 'Telecom' })).toBeNull();
    fireEvent.click(within(sec).getByRole('button', { name: 'Electrical' }));
    expect(keys(container)).toHaveLength(16);
    fireEvent.click(within(fam).getByRole('button', { name: 'All families' }));
    fireEvent.click(within(sec).getByRole('button', { name: 'Telecom' }));
    expect(keys(container)).toEqual(expect.arrayContaining(['telecom.ups', 'telecom.rack']));
    expect(keys(container)).not.toContain('pump.motor');
    fireEvent.click(within(sec).getByRole('button', { name: 'Telecom' }));
    expect(keys(container)).toHaveLength(SCADA_SYMBOLS.length);
  });
  it('shows recent symbols on top, and hides them while searching', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} recent={['sld.fuse', 'pump.motor']} />);
    expect(keys(container).slice(0, 2)).toEqual(['sld.fuse', 'pump.motor']);
    expect(screen.getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fuse' } });
    expect(screen.queryByRole('group', { name: 'Recent' })).toBeNull();
    expect(keys(container)[0]).toBe('sld.fuse');
  });
  it('adds on a click, never twice, and on Enter or Space', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} />);
    const tile = container.querySelector<HTMLElement>('[data-symbol="valve"]')!;
    fireEvent.click(tile);
    fireEvent.doubleClick(tile);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('valve');
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onAdd).toHaveBeenCalledTimes(3);
  });
  it('adds on a double click only, when asked', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} addOn="doubleClick" />);
    const tile = container.querySelector<HTMLElement>('[data-symbol="valve"]')!;
    fireEvent.click(tile);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.doubleClick(tile);
    expect(onAdd).toHaveBeenCalledWith('valve');
  });
  it('adds the first match on Enter in the search box and moves into the grid with the down arrow', () => {
    const onAdd = vi.fn();
    const { container } = render(<ScenePalette onAdd={onAdd} />);
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'ups' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('telecom.ups');
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
    fireEvent.keyDown(all[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[4]);
    fireEvent.keyDown(all[4], { key: 'ArrowUp' });
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
    const tile = container.querySelector<HTMLElement>('[data-symbol="breaker"]')!;
    expect(tile.draggable).toBe(true);
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (t: string, v: string) => { data[t] = v; }, effectAllowed: '' };
    fireEvent.dragStart(tile, { dataTransfer });
    expect(data[SYMBOL_DRAG_TYPE]).toBe('breaker');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(onDragStart).toHaveBeenCalledWith('breaker', expect.anything());
  });
  it('takes the host\'s texts over the English ones', () => {
    render(<ScenePalette onAdd={() => {}} messages={{ search: 'Sembol ara', families: { sld: 'Tek hat' } }} />);
    expect(screen.getByRole('searchbox', { name: 'Sembol ara' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tek hat' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Family' })).getByRole('button', { name: 'Water' })).toBeInTheDocument();
  });
});
