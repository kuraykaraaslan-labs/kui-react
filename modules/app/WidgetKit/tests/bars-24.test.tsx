import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { effective } from '../settings/engine';
import type { SlotData } from '../kind';
import { PlacementCard } from '../PlacementCard';
import { CHART_BAR, CHART_BAR_KIND } from '../templates/chart-bar';
import { CHART_BAR_VIEW } from '../views/BarChartView';
import { rowsToCategorySeries } from '../views/chart-data';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 480, height: 280, x: 0, y: 0, top: 0, left: 0, right: 480, bottom: 280, toJSON() {} });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const rows = [
  { site: 'Istanbul', level: 4.2 },
  { site: 'Ankara', level: 9 },
  { site: 'Izmir', level: 0 },
  { site: 'Bursa', level: -1.5 },
  { site: '', level: 5 },
  { site: 'Konya', level: 'n/a' },
];
const table: SlotData = { shape: 'table', columns: [{ key: 'site', label: 'Site', type: 'text' }, { key: 'level', label: 'Level (m)', type: 'number' }], rows };
const opts = { label: 'site', value: 'level' };

describe('rowsToCategorySeries', () => {
  it('one bar per usable row, in row order; zero and negative values stay', () => {
    const [s] = rowsToCategorySeries(rows, opts)!;
    expect(s.data.map((d) => [d.x, d.y])).toEqual([['Istanbul', 4.2], ['Ankara', 9], ['Izmir', 0], ['Bursa', -1.5]]);
  });
  it('orders by value, then cuts: the largest N', () => {
    expect(rowsToCategorySeries(rows, { ...opts, sort: 'desc', max: 2 })![0].data.map((d) => d.x)).toEqual(['Ankara', 'Istanbul']);
    expect(rowsToCategorySeries(rows, { ...opts, sort: 'asc', max: 2 })![0].data.map((d) => d.x)).toEqual(['Bursa', 'Izmir']);
  });
  it('is null without columns, rows or a usable value', () => {
    expect(rowsToCategorySeries(rows, { label: 'site' })).toBeNull();
    expect(rowsToCategorySeries(undefined, opts)).toBeNull();
    expect(rowsToCategorySeries([{ site: 'a', level: 'x' }], opts)).toBeNull();
  });
  it('names the series from the option, capping the count', () => {
    expect(rowsToCategorySeries(rows, { ...opts, name: 'Level (m)' })![0].name).toBe('Level (m)');
    const many = Array.from({ length: 300 }, (_, i) => ({ site: `s${i}`, level: i }));
    expect(rowsToCategorySeries(many, { ...opts, max: 500 })![0].data).toHaveLength(100);
  });
});

describe('chart.bar in category mode', () => {
  const settings = effective(CHART_BAR, { xAxis: 'category', categoryColumn: 'site', valueColumn: 'level' });
  it('is empty without usable rows and exports the table', () => {
    expect(CHART_BAR_VIEW.isEmpty!({ rows: table }, settings)).toBe(false);
    expect(CHART_BAR_VIEW.isEmpty!({ rows: { shape: 'table', rows: [] } }, settings)).toBe(true);
    expect(CHART_BAR_VIEW.isEmpty!({}, effective(CHART_BAR, { xAxis: 'category' }))).toBe(true);
    expect(CHART_BAR_VIEW.toCsv!({ rows: table }, settings, {})[0]).toEqual(['site', 'level']);
  });
  it('time mode is untouched', () => {
    const series: SlotData = { shape: 'series', series: [{ name: 'a', points: [{ t: '2026-10-01T00:00:00Z', v: 1 }] }] };
    expect(CHART_BAR_VIEW.isEmpty!({ series }, effective(CHART_BAR, {}))).toBe(false);
    expect(CHART_BAR_VIEW.toCsv!({ series }, effective(CHART_BAR, {}), {})[0]).toEqual(['time', 'series', 'value']);
  });
  it('draws the bars from the rows slot', () => {
    const { container } = render(
      <PlacementCard title="Levels" template={CHART_BAR} slots={CHART_BAR_KIND.slots} view={CHART_BAR_VIEW}
        settings={{ xAxis: 'category', categoryColumn: 'site', valueColumn: 'level' }} data={{ rows: table }} boundSlots={['rows']} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.textContent).toMatch(/Istanbul/);
  });
  it('either slot configures the card; with neither an editor is asked to bind data', () => {
    const card = (bound: string[]) => render(
      <PlacementCard title="Levels" template={CHART_BAR} slots={CHART_BAR_KIND.slots} view={CHART_BAR_VIEW} isEditor
        settings={{}} data={{}} boundSlots={bound} />,
    );
    const none = card([]);
    expect(none.container.textContent).toMatch(/Bind data to this widget/);
    none.unmount();
    expect(card(['rows']).container.textContent).not.toMatch(/Bind data to this widget/);
  });
});
