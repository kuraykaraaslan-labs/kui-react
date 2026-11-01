import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { effective, templateDefaults, validate } from '../settings/engine';
import type { SettingsTemplate } from '../settings/types';
import type { BuiltinKindSpec, SlotData, WidgetKindView } from '../kind';
import { CHART_LINE, CHART_LINE_KIND } from '../templates/chart-line';
import { CHART_BAR, CHART_BAR_KIND } from '../templates/chart-bar';
import { CHART_AREA, CHART_AREA_KIND } from '../templates/chart-area';
import { CHART_PIE, CHART_PIE_KIND } from '../templates/chart-pie';
import { CHART_SCATTER, CHART_SCATTER_KIND } from '../templates/chart-scatter';
import { CHART_HISTOGRAM, CHART_HISTOGRAM_KIND } from '../templates/chart-histogram';
import { HEATMAP, HEATMAP_KIND } from '../templates/heatmap';
import { CHART_LINE_VIEW } from '../views/LineChartView';
import { CHART_BAR_VIEW } from '../views/BarChartView';
import { CHART_AREA_VIEW } from '../views/AreaChartView';
import { CHART_PIE_VIEW } from '../views/PieChartView';
import { CHART_SCATTER_VIEW } from '../views/ScatterChartView';
import { CHART_HISTOGRAM_VIEW } from '../views/HistogramChartView';
import { HEATMAP_VIEW } from '../views/HeatmapView';
import { WidgetKitProvider } from '../WidgetKitContext';
import { applySeriesRules, axisFormat, formatAxisLabels, histogramBins, mergeSeriesSlots, rowsToPieSeries, rowsToPieSlices, ruleFor, valueStats } from '../views/chart-data';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 480, height: 280, x: 0, y: 0, top: 0, left: 0, right: 480, bottom: 280, toJSON() {} });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const KINDS: Array<[BuiltinKindSpec, SettingsTemplate]> = [
  [CHART_LINE_KIND, CHART_LINE], [CHART_BAR_KIND, CHART_BAR], [CHART_AREA_KIND, CHART_AREA], [CHART_PIE_KIND, CHART_PIE],
  [CHART_SCATTER_KIND, CHART_SCATTER], [CHART_HISTOGRAM_KIND, CHART_HISTOGRAM], [HEATMAP_KIND, HEATMAP],
];

describe('chart templates', () => {
  it.each(KINDS.map(([k, t]) => [k.type, k, t] as const))('%s: id, v1, valid defaults, known groups', (_, kind, t) => {
    expect(t.id).toBe(`builtin:${kind.type}`);
    expect(kind.template).toBe(t);
    expect(t.version).toBe(1);
    expect(t.migrations).toEqual([]);
    expect(validate(t, templateDefaults(t)).issues).toEqual([]);
    const groups = new Set(t.groups.map((g) => g.id));
    for (const [key, f] of Object.entries(t.fields)) {
      expect(f.since, key).toBe(1);
      expect(groups.has(f.group ?? ''), `${kind.type}.${key} → ${f.group}`).toBe(true);
    }
    expect(kind.slots.length).toBeGreaterThan(0);
  });
  it('series charts have a repeatable series slot, export and full-screen buttons', () => {
    for (const k of [CHART_LINE_KIND, CHART_AREA_KIND]) {
      expect(k.slots).toEqual([{ key: 'series', label: 'Series', shape: 'series', required: true, repeatable: true }]);
    }
    // The bar chart can also draw one bar per row of a table (24.3a): either slot configures it.
    expect(CHART_BAR_KIND.slots).toEqual([
      { key: 'series', label: 'Series', shape: 'series', required: false, repeatable: true, anyOf: 'values' },
      { key: 'rows', label: 'Rows (one bar each)', shape: 'table', required: false, anyOf: 'values' },
    ]);
    for (const k of [CHART_LINE_KIND, CHART_BAR_KIND, CHART_AREA_KIND]) {
      expect(k.template.exportable).toBe(true);
      expect(k.template.cardDefaults).toEqual({ buttons: ['fullscreen', 'export'] });
    }
    // Automatic decimals: whole bin edges and visit counts print whole.
    expect(CHART_HISTOGRAM.formatDefaults).toEqual({});
    expect(HEATMAP.formatDefaults).toEqual({});
  });
  it('validates series items, colours and min below max', () => {
    const r = validate(CHART_LINE, {
      series: [{ key: '*', color: '#ff0000', lineStyle: 'dashed', width: 3 }, { key: 'temp', color: 'url(x)' }],
      yMin: 10, yMax: 5, curve: 'step',
    });
    expect(r.values.series).toEqual([{ key: '*', color: '#ff0000', lineStyle: 'dashed', width: 3 }, { key: 'temp' }]);
    expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['series.1.color', 'yMax']));
    expect(validate(CHART_LINE, { curve: 'spiral' }).issues).toHaveLength(1);
    expect(validate(CHART_BAR, { orientation: 'horizontal', valueLabels: 'value', stacked: true }).issues).toEqual([]);
  });
});

const series = (names: string[]): SlotData => ({
  shape: 'series',
  series: names.map((name, k) => ({
    name,
    points: [1, 2, 3, 4].map((d) => ({ t: `2026-10-0${d}T00:00:00Z`, v: d * (k + 1) + 0.5 })),
  })),
});
const table = (rows: Array<Record<string, unknown>>, columns?: SlotData['columns']): SlotData => ({ shape: 'table', rows, columns });

function renderView(view: WidgetKindView, t: SettingsTemplate, data: Record<string, SlotData | undefined>, stored: Record<string, unknown> = {}, format = {}) {
  const View = view.View;
  return render(<View settings={effective(t, stored)} format={{ ...t.formatDefaults, ...format }} data={data} locale="en" />);
}

describe('series chart views', () => {
  it('a stacked tooltip\'s total row takes charts.total (bar and area)', () => {
    for (const [view, t] of [[CHART_BAR_VIEW, CHART_BAR], [CHART_AREA_VIEW, CHART_AREA]] as const) {
      const View = view.View;
      const { container, unmount } = render(
        <WidgetKitProvider value={{ messages: { charts: { total: 'Toplam' } } }}>
          <View settings={effective(t, { stacked: true, tooltipTotal: true })} format={{ ...t.formatDefaults }} data={{ series: series(['a', 'b']) }} locale="en" />
        </WidgetKitProvider>,
      );
      fireEvent.mouseMove(container.querySelector('svg[aria-label]')!, { clientX: 100, clientY: 100 });
      const total = screen.getByRole('tooltip').querySelector('[data-tooltip-total]')?.textContent ?? '';
      expect(total).toMatch(/^Toplam/);
      expect(total).not.toMatch(/Total/);
      unmount();
    }
  });

  it('the zoom reset button takes the host text (line and area)', () => {
    for (const [view, t] of [[CHART_LINE_VIEW, CHART_LINE], [CHART_AREA_VIEW, CHART_AREA]] as const) {
      const View = view.View;
      const { container, unmount } = render(
        <WidgetKitProvider value={{ messages: { charts: { resetZoom: 'Yakınlaştırmayı sıfırla' } } }}>
          <View settings={effective(t, {})} format={{ ...t.formatDefaults }} data={{ series: series(['a']) }} locale="en" />
        </WidgetKitProvider>,
      );
      const svg = container.querySelector('svg[aria-label]')!;
      // The drag is a pointer gesture (a mouse, a pen or a finger alike).
      fireEvent.pointerDown(svg, { button: 0, clientX: 150, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(svg, { clientX: 350, clientY: 100, pointerId: 1 });
      fireEvent.pointerUp(svg, { clientX: 350, clientY: 100, pointerId: 1 });
      expect(screen.getByRole('button', { name: 'Yakınlaştırmayı sıfırla' })).toBeInTheDocument();
      expect(screen.queryByText('Reset zoom')).toBeNull();
      unmount();
    }
  });

  it('line: draws one path per series, applies colour / dash / width / step and hides a series until clicked', () => {
    const { container } = renderView(CHART_LINE_VIEW, CHART_LINE, { series: series(['temp', 'hum']) }, {
      curve: 'step',
      series: [{ key: 'temp', color: '#ff0000', lineStyle: 'dashed', width: 4, label: 'T: ${name}' }, { key: 'hum', startHidden: true }],
    });
    const lines = container.querySelectorAll('path[data-line]');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('stroke')).toBe('#ff0000');
    expect(lines[0].getAttribute('stroke-width')).toBe('4');
    expect(lines[0].getAttribute('stroke-dasharray')).toBeTruthy();
    expect(lines[0].getAttribute('d')).toMatch(/H/);
    expect(screen.getByText('T: temp')).toBeInTheDocument();
    const hum = screen.getByRole('button', { name: /hum/ });
    expect(hum).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(hum);
    expect(container.querySelectorAll('path[data-line]')).toHaveLength(2);
  });
  it('line: legend off, thresholds, axis title, legend values', () => {
    const { container, rerender } = renderView(CHART_LINE_VIEW, CHART_LINE, { series: series(['a', 'b']) }, {
      legend: 'none', thresholds: [{ value: 3, label: 'Limit', color: '#00ff00' }], yLabel: 'Temperature',
    });
    expect(container.querySelector('ul[role="list"]')).toBeNull();
    expect(container.querySelector('[data-threshold="3"] line')?.getAttribute('stroke')).toBe('#00ff00');
    expect(screen.getByText('Limit')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    rerender(<CHART_LINE_VIEW.View settings={effective(CHART_LINE, { legend: 'right', legendValues: ['max'] })} format={{ unit: '°C', decimals: 1 }} data={{ series: series(['a', 'b']) }} locale="en" />);
    expect(screen.getByText('max 4.5 °C')).toBeInTheDocument();
  });
  it('line: auto legend only with 2 or more series; multiple sources merge with renamed duplicates', () => {
    const { container } = renderView(CHART_LINE_VIEW, CHART_LINE, { series: series(['a']) });
    expect(container.querySelector('ul[role="list"]')).toBeNull();
    const merged = mergeSeriesSlots({ series: series(['a']), 'series#2': series(['a']) });
    expect(merged?.series?.map((s) => s.name)).toEqual(['a', 'a (2)']);
  });
  it('bar: horizontal bars with value labels; stacked', () => {
    const { container } = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a']) }, { orientation: 'horizontal', valueLabels: 'value' }, { decimals: 1 });
    const rects = [...container.querySelectorAll('g[data-series] path[data-bar]')];
    expect(rects).toHaveLength(4);
    // Horizontal: bars share x (the value axis starts at the left) and grow in width.
    expect(new Set(rects.map((r) => r.getAttribute('data-x'))).size).toBe(1);
    expect(container.querySelectorAll('[data-value-label]')).toHaveLength(4);
    expect([...container.querySelectorAll('[data-value-label]')].map((t) => t.textContent)).toEqual(['1.5', '2.5', '3.5', '4.5']);
    const stacked = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a', 'b']) }, { stacked: true });
    const a = [...stacked.container.querySelectorAll('g[data-series="a"] path[data-bar]')];
    const b = [...stacked.container.querySelectorAll('g[data-series="b"] path[data-bar]')];
    // Stacked: same x per category, b sits on top of a.
    expect(a[0].getAttribute('data-x')).toBe(b[0].getAttribute('data-x'));
    expect(Number(b[0].getAttribute('data-y')) + Number(b[0].getAttribute('data-h'))).toBeCloseTo(Number(a[0].getAttribute('data-y')), 5);
  });
  it('area: fill opacity follows the fill setting; gradient by default', () => {
    const grad = renderView(CHART_AREA_VIEW, CHART_AREA, { series: series(['a']) });
    expect(grad.container.querySelector('path[data-area]')?.getAttribute('data-fill')).toBe('gradient');
    expect(grad.container.querySelector('linearGradient stop')?.getAttribute('stop-opacity')).toBe(String(0.2 * 1.6));
    const { container } = renderView(CHART_AREA_VIEW, CHART_AREA, { series: series(['a']) }, { fill: 'solid', fillStyle: 'opacity' });
    expect(container.querySelector('path[data-area]')?.getAttribute('opacity')).toBe('0.6');
    const none = renderView(CHART_AREA_VIEW, CHART_AREA, { series: series(['a']) }, { fill: 'none' });
    expect(none.container.querySelector('path[data-area]')).toBeNull();
  });
  it('isEmpty and CSV', () => {
    expect(CHART_LINE_VIEW.isEmpty!({}, {})).toBe(true);
    expect(CHART_LINE_VIEW.isEmpty!({ series: { shape: 'series', series: [{ name: 'a', points: [] }] } }, {})).toBe(true);
    expect(CHART_LINE_VIEW.isEmpty!({ series: series(['a']) }, {})).toBe(false);
    const csv = CHART_BAR_VIEW.toCsv!({ series: series(['a']) }, {}, {});
    expect(csv[0]).toEqual(['time', 'series', 'value']);
    expect(csv[1]).toEqual(['2026-10-01T00:00:00Z', 'a', '1.5']);
  });
  it('series rules: exact beats *, ${name} labels, per-series unit', () => {
    const rules = [{ key: '*', unit: 'x', label: 'All ${name}' }, { key: 'a', unit: '°C', decimals: 0 }];
    expect(ruleFor('a', rules)).toMatchObject({ unit: '°C', label: 'All ${name}', decimals: 0 });
    const [s] = applySeriesRules([{ id: 'a', name: 'a', data: [] }], rules, { format: { decimals: 2 }, locale: 'en' });
    expect(s.name).toBe('All a');
    expect(s.format!(21.46)).toBe('21 °C');
  });
});

describe('pie view', () => {
  const rows = [{ label: 'A', value: 5 }, { label: 'B', value: 30 }, { label: 'C', value: 10 }, { label: 'D', value: 1 }];
  it('folds past max slices into Other, sorts, pins colours', () => {
    const s = rowsToPieSeries(rows, { label: 'label', value: 'value', max: 3, sort: 'desc', colors: [{ key: 'B', color: '#123456' }] });
    expect(s![0].data.map((p) => [p.x, p.y])).toEqual([['B', 30], ['C', 10], ['Other', 6]]);
    expect(s![0].data[0].color).toBe('#123456');
    const asData = rowsToPieSeries(rows, { label: 'label', value: 'value', sort: 'none' });
    expect(asData![0].data.map((p) => p.x)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('donut-total shows the total; value labels show shares', () => {
    const { container } = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { layout: 'donut-total', valueLabels: 'percent', totalLabel: 'All' });
    expect(container.querySelector('[data-center]')?.textContent).toBe('46');
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    const pie = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { layout: 'donut' });
    expect(pie.container.querySelector('[data-center]')).toBeNull();
  });
  it('isEmpty and CSV of declared columns', () => {
    expect(CHART_PIE_VIEW.isEmpty!({ slices: table([]) }, effective(CHART_PIE))).toBe(true);
    const csv = CHART_PIE_VIEW.toCsv!({ slices: table(rows, [{ key: 'label', label: 'Label', type: 'text' }, { key: 'value', label: 'Value', type: 'number' }]) }, {}, {});
    expect(csv[0]).toEqual(['label', 'value']);
    expect(csv[1]).toEqual(['A', '5']);
  });
});

describe('chart brush (onRangeSelect)', () => {
  const t = (d: number) => Date.parse(`2026-10-0${d}T00:00:00Z`);
  const LineView = CHART_LINE_VIEW.View;
  const line = (onRangeSelect?: (r: { from: number; to: number } | null) => void) => render(
    <LineView settings={effective(CHART_LINE, { showPoints: true })} format={{}} data={{ series: series(['a']) }} locale="en" onRangeSelect={onRangeSelect} />,
  );
  const svgOf = (c: HTMLElement) => c.querySelector('svg[aria-label]') as SVGSVGElement;
  const cx = (c: HTMLElement, i: number) => Number(c.querySelectorAll('circle[data-point]')[i].getAttribute('cx'));
  const drag = (svg: Element, from: number, to: number) => {
    fireEvent.pointerDown(svg, { button: 0, clientX: from, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: to, clientY: 100, pointerId: 1 });
  };
  const release = (svg: Element) => fireEvent.pointerUp(svg, { pointerId: 1 });

  it('without the prop a drag zooms locally, as before, and draws no selection band', () => {
    const { container } = line();
    const svg = svgOf(container);
    expect(svg).not.toHaveAttribute('tabindex');
    drag(svg, cx(container, 0), cx(container, 2));
    expect(container.querySelector('[data-range-band]')).toBeNull();
    release(svg);
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toBeInTheDocument();
  });

  it('a drag across the time axis reports the range in epoch ms, read from the pixel positions; the local zoom stands down', () => {
    const onRangeSelect = vi.fn();
    const { container } = line(onRangeSelect);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('tabindex', '0');
    drag(svg, cx(container, 1), cx(container, 2));
    expect(container.querySelector('[data-range-band] rect')).toBeTruthy();
    release(svg);
    expect(onRangeSelect).toHaveBeenCalledTimes(1);
    const [range] = onRangeSelect.mock.calls[0] as [{ from: number; to: number }];
    expect(Math.round(range.from)).toBe(t(2));
    expect(Math.round(range.to)).toBe(t(3));
    expect(container.querySelector('[data-range-band]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).toBeNull();
    // Dragged right to left, the range still reads from < to.
    drag(svg, cx(container, 3), cx(container, 0));
    release(svg);
    const [back] = onRangeSelect.mock.calls[1] as [{ from: number; to: number }];
    expect(Math.round(back.from)).toBe(t(1));
    expect(Math.round(back.to)).toBe(t(4));
    // A click, or a sliver, is not a brush.
    drag(svg, cx(container, 1), cx(container, 1) + 2);
    release(svg);
    expect(onRangeSelect).toHaveBeenCalledTimes(2);
  });

  it('a double click, and Escape while a band shows, ask for a reset with null', () => {
    const onRangeSelect = vi.fn();
    const { container } = line(onRangeSelect);
    const svg = svgOf(container);
    fireEvent.doubleClick(svg);
    expect(onRangeSelect).toHaveBeenLastCalledWith(null);
    // Nothing shows: Escape is not a reset.
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(onRangeSelect).toHaveBeenCalledTimes(1);
    drag(svg, cx(container, 0), cx(container, 3));
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(onRangeSelect).toHaveBeenCalledTimes(2);
    expect(onRangeSelect).toHaveBeenLastCalledWith(null);
    expect(container.querySelector('[data-range-band]')).toBeNull();
    // The cancelled drag reports nothing on release.
    release(svg);
    expect(onRangeSelect).toHaveBeenCalledTimes(2);
  });

  it('keyboard: the arrows move the end by a twentieth of the span, Shift + arrows the start, Enter reports it', () => {
    const onRangeSelect = vi.fn();
    const { container } = line(onRangeSelect);
    const svg = svgOf(container);
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(onRangeSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(container.querySelector('[data-range-band] rect')).toBeTruthy();
    fireEvent.keyDown(svg, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(svg, { key: 'Enter' });
    const step = (t(4) - t(1)) / 20;
    expect(onRangeSelect).toHaveBeenCalledWith({ from: t(1) + step, to: t(1) + 2 * step });
  });

  it('bars on timestamps report whole buckets, to the end of the last bar; bars on words offer no selection', () => {
    const onRangeSelect = vi.fn();
    const BarView = CHART_BAR_VIEW.View;
    const { container } = render(<BarView settings={effective(CHART_BAR, {})} format={{}} data={{ series: series(['a']) }} locale="en" onRangeSelect={onRangeSelect} />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute('tabindex', '0');
    const bars = [...container.querySelectorAll('path[data-bar]')];
    const mid = (i: number) => Number(bars[i].getAttribute('data-x')) + Number(bars[i].getAttribute('data-w')) / 2;
    drag(svg, mid(1), mid(2));
    expect(container.querySelector('[data-range-band] rect')).toBeTruthy();
    release(svg);
    expect(onRangeSelect).toHaveBeenCalledWith({ from: t(2), to: t(4) });
    drag(svg, mid(3) - 10, mid(3) + 10);
    release(svg);
    expect(onRangeSelect).toHaveBeenLastCalledWith({ from: t(4), to: t(4) + (t(4) - t(3)) });
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'Enter' });
    expect(onRangeSelect).toHaveBeenLastCalledWith({ from: t(1), to: t(3) });
    fireEvent.doubleClick(svg);
    expect(onRangeSelect).toHaveBeenLastCalledWith(null);
    // Categories that are words (one bar per row) have no instants to report.
    const words = render(
      <BarView settings={effective(CHART_BAR, { xAxis: 'category', categoryColumn: 'name', valueColumn: 'n' })} format={{}}
        data={{ rows: table([{ name: 'A', n: 1 }, { name: 'B', n: 2 }]) }} locale="en" onRangeSelect={onRangeSelect} />,
    );
    const wordsSvg = svgOf(words.container);
    expect(wordsSvg).not.toHaveAttribute('tabindex');
    drag(wordsSvg, 100, 300);
    expect(words.container.querySelector('[data-range-band]')).toBeNull();
  });
});

describe('scatter view', () => {
  const rows = [{ x: 1, y: 2, g: 'a' }, { x: 2, y: 3, g: 'b' }, { x: 3, y: 1, g: 'a' }];
  it('colours a single group with the point colour and sizes points', () => {
    const { container } = renderView(CHART_SCATTER_VIEW, CHART_SCATTER, { points: table(rows) }, { pointColor: '#abcdef', pointSize: 'lg', xLabel: 'Speed' });
    const dots = container.querySelectorAll('g[data-series] circle');
    expect(dots).toHaveLength(3);
    expect(dots[0].getAttribute('fill')).toBe('#abcdef');
    expect(dots[0].getAttribute('r')).toBe('6');
    expect(screen.getByText('Speed')).toBeInTheDocument();
  });
  it('one series per group, legend in auto mode', () => {
    const { container } = renderView(CHART_SCATTER_VIEW, CHART_SCATTER, { points: table(rows) }, { groupColumn: 'g', groupColors: [{ key: 'b', color: '#111111' }] });
    expect(container.querySelectorAll('g[data-series]')).toHaveLength(2);
    expect(container.querySelector('g[data-series="b"] circle')?.getAttribute('fill')).toBe('#111111');
    expect(screen.getByRole('button', { name: /a/ })).toBeInTheDocument();
  });
  it('isEmpty', () => {
    expect(CHART_SCATTER_VIEW.isEmpty!({ points: table([{ x: 'n/a', y: 1 }]) }, effective(CHART_SCATTER))).toBe(true);
  });
});

describe('histogram view', () => {
  const rows = [1, 2, 2, 3, 3, 3, 4, 9].map((value) => ({ value }));
  it('bins, colours the bars and prints counts', () => {
    const { container } = renderView(CHART_HISTOGRAM_VIEW, CHART_HISTOGRAM, { values: table(rows) }, { bins: 4, binEdges: 'exact', barColor: '#00aa00', valueLabels: 'value' });
    const rects = container.querySelectorAll('g[data-series] path[data-bar]');
    expect(rects).toHaveLength(4);
    expect(rects[0].getAttribute('fill')).toBe('#00aa00');
    expect(container.querySelectorAll('[data-value-label]')).toHaveLength(4);
    // The axis prints the bin edges; a bar's range is the tooltip heading (its category).
    expect([...container.querySelectorAll('svg text')].map((t) => t.textContent)).toEqual(expect.arrayContaining(['1', '3', '5', '7', '9']));
  });
  it('CSV is from,to,count; empty without numbers', () => {
    const csv = CHART_HISTOGRAM_VIEW.toCsv!({ values: table(rows) }, effective(CHART_HISTOGRAM, { bins: 2, binEdges: 'exact' }), {});
    expect(csv).toEqual([['from', 'to', 'count'], ['1', '5', '7'], ['5', '9', '1']]);
    // Round edges by default: 0–5, 5–10.
    expect(CHART_HISTOGRAM_VIEW.toCsv!({ values: table(rows) }, effective(CHART_HISTOGRAM, { bins: 2 }), {}))
      .toEqual([['from', 'to', 'count'], ['0', '5', '7'], ['5', '10', '1']]);
    expect(CHART_HISTOGRAM_VIEW.isEmpty!({ values: table([{ value: 'x' }]) }, effective(CHART_HISTOGRAM))).toBe(true);
  });
});

describe('heatmap view', () => {
  const rows = [{ x: 'Mon', y: '1', value: 10 }, { x: 'Tue', y: '1', value: 50 }, { x: 'Mon', y: '2', value: 90 }];
  it('sequential colour, cell labels', () => {
    const { container } = renderView(HEATMAP_VIEW, HEATMAP, { cells: table(rows) }, { color: '#ff00ff', valueLabels: 'value' });
    const cells = container.querySelectorAll('rect[fill="#ff00ff"]');
    expect(cells).toHaveLength(3);
    expect(container.querySelectorAll('[data-cell-label]')).toHaveLength(3);
    expect(container.querySelector('[data-heat-legend="scale"]')).toBeTruthy();
  });
  it('colour bands with a banded legend', () => {
    const { container } = renderView(HEATMAP_VIEW, HEATMAP, { cells: table(rows) }, {
      scale: 'bands', ranges: [{ to: 50, color: '#00ff00', label: 'Low' }, { from: 50, color: '#ff0000' }],
    });
    expect(container.querySelectorAll('rect[fill="#00ff00"]')).toHaveLength(1);
    expect(container.querySelectorAll('rect[fill="#ff0000"]')).toHaveLength(2);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(container.querySelector('[data-heat-legend="bands"]')).toBeTruthy();
  });
  it('legend off, isEmpty, CSV', () => {
    const { container } = renderView(HEATMAP_VIEW, HEATMAP, { cells: table(rows) }, { legend: 'none' });
    expect(container.querySelector('[data-heat-legend]')).toBeNull();
    expect(HEATMAP_VIEW.isEmpty!({}, effective(HEATMAP))).toBe(true);
    expect(HEATMAP_VIEW.toCsv!({ cells: table(rows) }, {}, {})[0]).toEqual(['x', 'y', 'value']);
  });
});

const texts = (container: HTMLElement) => [...container.querySelectorAll('svg text')].map((t) => t.textContent ?? '');

describe('series chart settings (phase 21 depth)', () => {
  it('right axis: a series on the right gets its own unit, ticks and title; thresholds pick their axis', () => {
    const { container } = renderView(CHART_LINE_VIEW, CHART_LINE, { series: series(['temp', 'hum']) }, {
      series: [{ key: 'temp', unit: '°C' }, { key: 'hum', unit: '%', axis: 'right' }],
      y2Label: 'Humidity', thresholds: [{ value: 7, axis: 'right', label: 'Dry' }],
    });
    const t = texts(container);
    expect(t.some((x) => x.endsWith('°C'))).toBe(true);
    expect(t.some((x) => x.endsWith('%'))).toBe(true);
    // The two axes never mix units.
    expect(t.some((x) => x.includes('°C') && x.includes('%'))).toBe(false);
    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(container.querySelector('[data-threshold="7"]')).toBeTruthy();
  });
  it('one axis with clashing units prints plain numbers; whole ticks print without decimals', () => {
    const s = applySeriesRules([{ id: 'a', name: 'a', data: [] }, { id: 'b', name: 'b', data: [] }], [{ key: 'a', unit: '°C' }, { key: 'b', unit: '%' }], { format: {} });
    expect(axisFormat(s, [{ key: 'a', unit: '°C' }, { key: 'b', unit: '%' }], {}, 'en')(20)).toBe('20');
    expect(axisFormat(s.slice(0, 1), [{ key: 'a', unit: '°C', decimals: 1 }], {}, 'en')(20)).toBe('20 °C');
    expect(axisFormat(s.slice(0, 1), [{ key: 'a', unit: '°C', decimals: 1 }], {}, 'en')(17.5)).toBe('17.5 °C');
  });
  it('line axis spans the data unless "start at zero"; area starts at zero', () => {
    const data = { series: { shape: 'series' as const, series: [{ name: 'a', points: [1, 2, 3].map((d) => ({ t: `2026-10-0${d}T00:00:00Z`, v: 50 + d })) }] } };
    expect(texts(renderView(CHART_LINE_VIEW, CHART_LINE, data).container)).not.toContain('0');
    expect(texts(renderView(CHART_LINE_VIEW, CHART_LINE, data, { yFromZero: true }).container)).toContain('0');
    expect(texts(renderView(CHART_AREA_VIEW, CHART_AREA, data).container)).toContain('0');
  });
  it('point shape and size, value labels, grid style, hidden axis labels', () => {
    const { container } = renderView(CHART_LINE_VIEW, CHART_LINE, { series: series(['a']) }, {
      showPoints: true, pointShape: 'diamond', pointSize: 6, valueLabels: 'value', gridStyle: 'solid', showXAxis: false,
    });
    expect(container.querySelectorAll('path[data-point]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-value-label]').length).toBeGreaterThan(0);
    expect(container.querySelector('g[data-grid="solid"]')).toBeTruthy();
    // Category / time labels are gone; value ticks stay.
    expect(texts(container).some((x) => /Oct|:/.test(x))).toBe(false);
  });
  it('per-series fill, point shape and stack group', () => {
    const [a, b] = applySeriesRules(
      [{ id: 'a', name: 'a', data: [] }, { id: 'b', name: 'b', data: [] }],
      [{ key: 'a', fill: 'gradient', pointShape: 'square', stack: 'g' }, { key: 'b', fill: 'none' }],
      { format: {} },
    );
    expect(a).toMatchObject({ fillGradient: true, fillOpacity: 0.25, pointShape: 'square', stack: 'g' });
    expect(b.fillOpacity).toBe(0);
  });
  it('bars: stack groups stand side by side; width, gap and value label position', () => {
    const { container } = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a', 'b', 'c']) }, {
      series: [{ key: 'a', stack: 'g' }, { key: 'b', stack: 'g' }], barWidth: 100, barGap: 0, valueLabels: 'value', valueLabelPosition: 'inside',
    });
    const x = (id: string) => container.querySelector(`g[data-series="${id}"] path[data-bar]`)!.getAttribute('data-x');
    expect(x('a')).toBe(x('b'));
    expect(x('c')).not.toBe(x('a'));
    const w100 = Number(container.querySelector('path[data-bar]')!.getAttribute('data-w'));
    const narrow = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a', 'b', 'c']) }, { series: [{ key: 'a', stack: 'g' }, { key: 'b', stack: 'g' }], barWidth: 50, barGap: 0 });
    expect(Number(narrow.container.querySelector('path[data-bar]')!.getAttribute('data-w'))).toBeCloseTo(w100 / 2, 1);
    // Inside labels take the surface colour (they sit on the bar).
    expect(container.querySelector('[data-value-label]')?.getAttribute('fill')).toBe('var(--surface-base)');
  });
  it('tooltip: heading on/off and a total row for stacks', () => {
    const { container } = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a', 'b']) }, { stacked: true, tooltipTotal: true, tooltipTime: false });
    fireEvent.mouseMove(container.querySelector('svg')!, { clientX: 200, clientY: 100 });
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('[data-tooltip-total]')).toBeTruthy();
    expect(tip.textContent).not.toMatch(/Oct/);
  });
  it('tooltip decimals override the series format', () => {
    const { container } = renderView(CHART_BAR_VIEW, CHART_BAR, { series: series(['a']) }, { tooltipDecimals: 3, series: [{ key: 'a', unit: 'kW' }] });
    fireEvent.mouseMove(container.querySelector('svg')!, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip').textContent).toMatch(/\d\.\d{3} kW/);
  });
  it('dates on a band axis read d MMM; times HH:mm', () => {
    expect(formatAxisLabels(['2026-10-06T00:00:00Z', '2026-10-20T00:00:00Z'], 'en', 'UTC')).toEqual(['6 Oct', '20 Oct']);
    expect(formatAxisLabels(['2026-10-06T13:00:00Z', '2026-10-06T15:30:00Z'], 'en', 'UTC')).toEqual(['13:00', '15:30']);
  });
  it('every new series-chart field validates with its defaults and rejects bad values', () => {
    expect(validate(CHART_LINE, { series: [{ key: 'a', axis: 'right', pointShape: 'square', fill: 'gradient' }], yTickCount: 6, gridStyle: 'dotted', y2Min: 0, y2Max: 10 }).issues).toEqual([]);
    expect(validate(CHART_LINE, { y2Min: 10, y2Max: 5 }).issues.map((i) => i.path)).toContain('y2Max');
    expect(validate(CHART_BAR, { barWidth: 5 }).issues).toHaveLength(1);
    expect(validate(CHART_BAR, { valueLabelPosition: 'top' }).issues).toHaveLength(1);
    expect(CHART_LINE.fields.zoom).toBeTruthy();
    expect(CHART_BAR.fields.zoom).toBeUndefined();
    expect(CHART_LINE.fields.stacked).toBeUndefined();
  });
});

describe('pie settings', () => {
  const rows = [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }];
  it('shares on slices by default; outside labels with leader lines; name and share', () => {
    const { container } = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) });
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(container.querySelector('polyline')).toBeNull();
    const out = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { labelPosition: 'outside', valueLabels: 'name-percent' });
    expect(out.container.querySelectorAll('polyline')).toHaveLength(3);
    expect(screen.getByText('A 50%')).toBeInTheDocument();
  });
  it('start angle turns the first slice; the legend sits below in a grid on a narrow card', () => {
    const a = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { sliceGap: 0 });
    const b = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { sliceGap: 0, startAngle: 90 });
    expect(a.container.querySelector('svg path')!.getAttribute('d')).not.toBe(b.container.querySelector('svg path')!.getAttribute('d'));
    // 480 × 280 is wide: auto puts the legend on the right as a list.
    expect((a.container.querySelector('ul') as HTMLElement).className).toContain('flex-col');
    const below = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { legend: 'bottom' });
    expect((below.container.querySelector('ul') as HTMLElement).className).toContain('grid');
  });
  it('tooltip prints the share only when asked', () => {
    const { container } = renderView(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { tooltipValue: 'percent' });
    fireEvent.mouseEnter(container.querySelector('svg path')!);
    expect(screen.getByRole('tooltip').textContent).toBe('A50%');
  });
});

describe('pie slice click (onSliceClick)', () => {
  const rows = [{ label: 'A', value: 5, id: 'a' }, { label: 'B', value: 30, id: 'b' }, { label: 'C', value: 10, id: 'c' }, { label: 'D', value: 1, id: 'd' }];
  const View = CHART_PIE_VIEW.View;
  const draw = (onSliceClick?: (row: Record<string, unknown>) => void, stored: Record<string, unknown> = {}) =>
    render(<View settings={effective(CHART_PIE, stored)} format={{}} data={{ slices: table(rows) }} locale="en" onSliceClick={onSliceClick} />);

  it('keeps the row behind every slice, and an aggregate behind the folded one', () => {
    const r = rowsToPieSlices(rows, { label: 'label', value: 'value', max: 3, sort: 'desc' })!;
    expect(r.series[0].data.map((p) => p.x)).toEqual(['B', 'C', 'Other']);
    expect(r.rows).toEqual([rows[1], rows[2], { label: 'Other', value: 6 }]);
    expect(r.rows[0]).toBe(rows[1]);
    // The slices themselves are what they were: the model and its golden do not change.
    expect(rowsToPieSeries(rows, { label: 'label', value: 'value', max: 3, sort: 'desc' })).toEqual(r.series);
  });
  it('without the prop the slices are plain shapes in one picture', () => {
    const { container } = draw();
    expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(container.querySelectorAll('[data-slice]')).toHaveLength(0);
    expect(container.querySelectorAll('path[role="button"]')).toHaveLength(0);
  });
  it('with the prop every slice is a focusable button named by its label and value, reporting its row', () => {
    const onSliceClick = vi.fn();
    const { container } = draw(onSliceClick, { maxSlices: 3 });
    expect(container.querySelector('svg')).toHaveAttribute('role', 'group');
    const slices = [...container.querySelectorAll('path[role="button"]')];
    expect(slices).toHaveLength(3);
    expect(slices[0]).toHaveAttribute('tabindex', '0');
    expect(slices[0].getAttribute('aria-label')).toBe('B, 30');
    expect(slices.map((s) => s.getAttribute('data-slice'))).toEqual(['0', '1', '2']);
    fireEvent.click(slices[0]);
    expect(onSliceClick).toHaveBeenLastCalledWith(rows[1]);
    fireEvent.keyDown(slices[1], { key: ' ' });
    expect(onSliceClick).toHaveBeenLastCalledWith(rows[2]);
    fireEvent.keyDown(slices[2], { key: 'Enter' });
    expect(onSliceClick).toHaveBeenLastCalledWith({ label: 'Other', value: 6 });
    // Other keys do nothing.
    fireEvent.keyDown(slices[0], { key: 'a' });
    expect(onSliceClick).toHaveBeenCalledTimes(3);
  });
});

describe('scatter, histogram and heatmap settings', () => {
  it('scatter: point shape and opacity, a trend line per group', () => {
    const rows = [{ x: 1, y: 2, g: 'a' }, { x: 2, y: 4, g: 'a' }, { x: 3, y: 6, g: 'a' }, { x: 1, y: 5, g: 'b' }, { x: 3, y: 1, g: 'b' }];
    const { container } = renderView(CHART_SCATTER_VIEW, CHART_SCATTER, { points: table(rows) }, { groupColumn: 'g', pointShape: 'triangle', pointOpacity: 0.5, trendLine: true });
    expect(container.querySelectorAll('g[data-series] path')).toHaveLength(5);
    expect(container.querySelector('g[data-series] path')?.getAttribute('fill-opacity')).toBe('0.5');
    expect(container.querySelectorAll('line[data-trend]')).toHaveLength(2);
  });
  it('histogram: round bin edges, mean and median markers', () => {
    expect(histogramBins([102, 138, 250, 466], 10, null, null, true)[0].from).toBe(100);
    expect(valueStats([1, 2, 3, 10])).toEqual({ mean: 4, median: 2.5 });
    const rows = [1, 2, 2, 3, 3, 3, 4, 9].map((value) => ({ value }));
    const { container } = renderView(CHART_HISTOGRAM_VIEW, CHART_HISTOGRAM, { values: table(rows) }, { showMean: true, showMedian: true, markerColor: '#123456' }, { unit: 'ms' });
    expect(container.querySelectorAll('[data-marker]')).toHaveLength(2);
    expect(screen.getByText('Mean 3.38 ms')).toBeInTheDocument();
    expect(screen.getByText('Median 3 ms')).toBeInTheDocument();
    expect(container.querySelector('[data-marker] line')?.getAttribute('stroke')).toBe('#123456');
  });
  it('heatmap: two-colour scale, cell gap and radius, compact legend ends', () => {
    const rows = [{ x: 'Mon', y: '1', value: 1000 }, { x: 'Tue', y: '1', value: 250000 }];
    const { container } = renderView(HEATMAP_VIEW, HEATMAP, { cells: table(rows) }, { color: '#ff0000', colorLow: '#00ff00', cellRadius: 6, cellGap: 0 });
    const cells = [...container.querySelectorAll('svg rect')];
    expect(cells[0].getAttribute('fill')).toMatch(/^color-mix\(in oklab, #ff0000 0%, #00ff00\)$/);
    expect(cells[1].getAttribute('fill')).toMatch(/#ff0000 100%/);
    expect(cells[0].getAttribute('rx')).toBe('6');
    const legend = container.querySelector('[data-heat-legend="scale"]')!;
    expect(legend.textContent).toContain('1K');
    expect(legend.textContent).toContain('250K');
  });
});

describe('chart texts from the host (WidgetKitProvider messages)', () => {
  const charts = { total: 'Toplam', other: 'Diğer', pieChart: 'Pasta grafik', lineChart: 'Çizgi grafik', mean: (v: string) => `Ort. ${v}`, count: 'Adet' };
  const inKit = (view: WidgetKindView, t: SettingsTemplate, data: Record<string, SlotData | undefined>, stored: Record<string, unknown> = {}) => {
    const View = view.View;
    return render(
      <WidgetKitProvider value={{ messages: { charts } }}>
        <View settings={effective(t, stored)} format={{ ...t.formatDefaults }} data={data} locale="en" />
      </WidgetKitProvider>,
    );
  };

  it('pie: the centre caption, the folded slice and the name; a placement caption wins', () => {
    const rows = [{ label: 'A', value: 5 }, { label: 'B', value: 30 }, { label: 'C', value: 10 }, { label: 'D', value: 1 }];
    const { unmount } = inKit(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { layout: 'donut-total', maxSlices: 3 });
    expect(screen.getByText('Toplam')).toBeInTheDocument();
    expect(screen.getAllByText('Diğer').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: 'Pasta grafik' })).toBeInTheDocument();
    unmount();
    inKit(CHART_PIE_VIEW, CHART_PIE, { slices: table(rows) }, { layout: 'donut-total', totalLabel: 'Sum', otherLabel: 'Rest', maxSlices: 3 });
    expect(screen.getByText('Sum')).toBeInTheDocument();
    expect(screen.getAllByText('Rest').length).toBeGreaterThan(0);
  });

  it('line chart name and histogram mean marker', () => {
    const { unmount } = inKit(CHART_LINE_VIEW, CHART_LINE, { series: series(['a']) });
    expect(screen.getByRole('img', { name: 'Çizgi grafik' })).toBeInTheDocument();
    unmount();
    const rows = [1, 2, 3, 4, 7].map((value) => ({ value }));
    inKit(CHART_HISTOGRAM_VIEW, CHART_HISTOGRAM, { values: table(rows) }, { showMean: true });
    expect(screen.getByText(/^Ort\. /)).toBeInTheDocument();
  });
});

describe('series names (next-boilerplate e2e run 1, V3-B7)', () => {
  it('a series is shown under the label its source gives it, in the viewer\'s language; its id stays the key the rules match', async () => {
    const { toTimeSeries, toBandSeries } = await import('../views/chart-data');
    const result: SlotData = {
      shape: 'series',
      series: [
        { name: 'savak_seviyesi', points: [{ t: '2026-10-31T10:00:00.000Z', v: 12 }], meta: { label: { en: 'Weir level', tr: 'Savak seviyesi' }, unit: 'cm' } },
        { name: 'pil', points: [{ t: '2026-10-31T10:00:00.000Z', v: 87 }] },
      ],
    };
    expect(toTimeSeries(result, 'tr')!.map((s) => [s.id, s.name])).toEqual([['savak_seviyesi', 'Savak seviyesi'], ['pil', 'pil']]);
    expect(toTimeSeries(result, 'en')!.map((s) => s.name)).toEqual(['Weir level', 'pil']);
    expect(toBandSeries(result, 'tr')!.map((s) => [s.id, s.name])).toEqual([['savak_seviyesi', 'Savak seviyesi'], ['pil', 'pil']]);
  });
});
