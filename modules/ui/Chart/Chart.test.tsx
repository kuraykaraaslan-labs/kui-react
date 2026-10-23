import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GaugeChart, HeatmapChart, LineChart, AreaChart, BarChart, PieChart, DonutChart, ScatterChart } from './index';
import {
  stepPath, continuePath, dashArray, resolveDomain, seriesStats, niceTicks, alignedDomain, groupedStackTops, stackKeys,
  linearRegression, pointPath, topsExtent,
} from './charts/_helpers';
import { formatTick, dayMonthText } from './charts/_time';

// jsdom has no layout: give the ResponsiveContainer a width so charts draw.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 480, height: 240, x: 0, y: 0, top: 0, left: 0, right: 480, bottom: 240, toJSON() {} });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('GaugeChart', () => {
  it('is a meter with value, range and band name', () => {
    render(<GaugeChart value={72} min={0} max={100} unit="%" bands={[{ to: 50, tone: 'success' }, { to: 100, tone: 'error' }]} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', '72');
    expect(meter.getAttribute('aria-valuetext')).toContain('error');
  });
  it('clamps the arc but keeps the real value in the text', () => {
    render(<GaugeChart value={250} max={100} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter.getAttribute('aria-valuetext')).toContain('250');
  });
  it('shows no value and the stale hint when asked', () => {
    render(<GaugeChart value={null} stale />);
    expect(screen.getByRole('meter')).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByText('stale')).toBeInTheDocument();
  });
  it('draws bands as a thin outer line by default, or tinted on the track', () => {
    const bands = [{ to: 50, color: '#00ff00' }, { to: 100, color: '#ff0000' }];
    const { container, rerender } = render(<GaugeChart value={72} bands={bands} />);
    let b = container.querySelectorAll('[data-part="band"]');
    expect(b).toHaveLength(2);
    expect(b[0].getAttribute('stroke-opacity')).toBeNull();
    expect(Number(b[0].getAttribute('stroke-width'))).toBeLessThan(16);
    rerender(<GaugeChart value={72} bands={bands} bandStyle="track" bandOpacity={0.6} />);
    b = container.querySelectorAll('[data-part="band"]');
    expect(b[0].getAttribute('stroke-opacity')).toBe('0.6');
    expect(b[0].getAttribute('stroke-width')).toBe('16');
  });
  it('writes the value, caption, min / max and tick labels as HTML text', () => {
    const { container } = render(<GaugeChart value={72} unit="%" label="CPU" ticks={3} tickLabels showMinMax />);
    expect(container.querySelector('svg text')).toBeNull();
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe('72%');
    expect(container.querySelector('[data-part="caption"]')?.textContent).toBe('CPU');
    expect(container.querySelector('[data-part="min"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-part="max"]')?.textContent).toBe('100');
    expect(container.querySelectorAll('[data-part="tick-label"]')).toHaveLength(1);
  });
  it('custom value content, needle styles and the level layout', () => {
    const { container, rerender } = render(<GaugeChart value={40} valueContent={<b>forty</b>} needle needleStyle="arrow" />);
    expect(screen.getByText('forty')).toBeInTheDocument();
    expect(container.querySelector('path[data-part="needle"]')).toBeTruthy();
    rerender(<GaugeChart value={40} layout="level" needle needleStyle="marker" />);
    expect(container.querySelector('[data-layout="level"]')).toBeTruthy();
    expect(container.querySelector('[data-part="bulb"]')).toBeTruthy();
    expect((container.querySelector('[data-part="bar"]') as HTMLElement).style.height).toContain('40%');
  });
});

const day = (n: number) => `2026-10-0${n}T00:00:00Z`;
const series = [{ id: 'a', name: 'A', data: [{ x: day(1), y: 1 }, { x: day(2), y: 3 }, { x: day(3), y: 2 }] }];

describe('time axis', () => {
  it('Line and Area render through xAxis="time" and the xScale alias', () => {
    const { container, rerender } = render(<LineChart series={series} xAxis="time" />);
    expect(container.querySelector('svg')).toBeTruthy();
    rerender(<AreaChart series={series} xScale="time" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
  it('stacked Bar and Area render', () => {
    const two = [...series, { id: 'b', name: 'B', data: [{ x: day(1), y: 2 }, { x: day(2), y: 1 }, { x: day(3), y: 1 }] }];
    const { container, rerender } = render(<BarChart series={two} stacked />);
    expect(container.querySelector('svg')).toBeTruthy();
    rerender(<AreaChart series={two} stacked />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('zoom reset label', () => {
  it('is not shown until zoomed', () => {
    render(<LineChart series={series} xAxis="time" resetZoomLabel="Reset" />);
    expect(screen.queryByText('Reset')).toBeNull();
  });
});

describe('HeatmapChart', () => {
  it('renders without crashing for sparse cells', () => {
    const { container } = render(<HeatmapChart cells={[{ x: 'Mon', y: '1', value: 1 }, { x: 'Tue', y: '2', value: null }]} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

const cats = [
  { id: 'a', name: 'A', data: [{ x: 'Mon', y: 1 }, { x: 'Tue', y: 3 }, { x: 'Wed', y: 2 }] },
  { id: 'b', name: 'B', data: [{ x: 'Mon', y: 2 }, { x: 'Tue', y: 1 }, { x: 'Wed', y: 4 }] },
];

describe('helpers for the settings surface', () => {
  it('step paths retrace in reverse; dash patterns; domains; stats', () => {
    expect(stepPath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M0 0 H10 V5');
    expect(stepPath([{ x: 10, y: 5 }, { x: 0, y: 0 }], 'before')).toBe('M10 5 V0 H0');
    expect(continuePath([{ x: 1, y: 2 }, { x: 3, y: 4 }], 'linear', 'after')).toBe('L1 2 L3 4');
    expect(dashArray('solid')).toBeUndefined();
    expect(dashArray('dotted', 2)).toBe('0 4');
    expect(resolveDomain({ min: 0, max: 10 }, { thresholds: [{ value: 15 }] })).toEqual({ min: 0, max: 15 });
    expect(resolveDomain({ min: 0, max: 10 }, { min: 2, max: 8, thresholds: [{ value: 15 }] })).toEqual({ min: 2, max: 8 });
    expect(seriesStats(cats[0])).toEqual({ latest: 2, min: 1, max: 3, avg: 2, total: 6 });
  });
});

describe('Line / Area settings props', () => {
  it('per-series stroke style, width, points and step curve', () => {
    const styled = [{ ...cats[0], lineStyle: 'dashed' as const, strokeWidth: 5, showPoints: true }, cats[1]];
    const { container } = render(<LineChart series={styled} curve="step" />);
    const lines = container.querySelectorAll('path[data-line]');
    expect(lines[0].getAttribute('stroke-dasharray')).toBe('15 10');
    expect(lines[0].getAttribute('stroke-width')).toBe('5');
    expect(lines[0].getAttribute('d')).toContain('H');
    expect(lines[1].getAttribute('stroke-dasharray')).toBeNull();
    expect(container.querySelectorAll('g[data-series="a"] circle[data-point]')).toHaveLength(3);
  });
  it('a hidden series is toggled from the legend', () => {
    const { container } = render(<LineChart series={[cats[0], { ...cats[1], hidden: true }]} />);
    expect(container.querySelectorAll('path[data-line]')).toHaveLength(1);
    const b = screen.getByRole('button', { name: 'B' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(b);
    expect(container.querySelectorAll('path[data-line]')).toHaveLength(2);
    expect(b).toHaveAttribute('aria-pressed', 'true');
  });
  it('legend position, values and style; plain list by default', () => {
    const { container, rerender } = render(<LineChart series={cats} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.firstElementChild?.lastElementChild?.tagName).toBe('UL');
    rerender(<LineChart series={cats} legendPosition="top" legendValues={['latest', 'max']} legendStyle={{ color: 'rgb(1, 2, 3)' }} yFormat={(v) => `${v} u`} />);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe('UL');
    expect(screen.getByText('2 u · max 3 u')).toBeInTheDocument();
    expect((container.querySelector('ul') as HTMLElement).style.color).toBe('rgb(1, 2, 3)');
  });
  it('fixed y bounds, axis titles, thresholds, grid colour and tick style', () => {
    const { container } = render(
      <AreaChart series={cats} yMin={0} yMax={100} yLabel="Load" xLabel="Day" gridColor="#123456"
        tickStyle={{ color: '#654321', fontSize: 13 }} thresholds={[{ value: 80, label: 'Max', color: '#ff0000', style: 'solid' }]} />,
    );
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Load')).toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(container.querySelector('[data-threshold="80"] line')?.getAttribute('stroke')).toBe('#ff0000');
    expect(container.querySelector('line[stroke="#123456"]')).toBeTruthy();
    expect(screen.getByText('Mon').getAttribute('fill')).toBe('#654321');
  });
  it('time axis takes the same props and a time zone', () => {
    const { container } = render(<LineChart series={series} xAxis="time" curve="linear" thresholds={[{ value: 2 }]} timeZone="UTC" legendPosition="right" />);
    expect(container.querySelector('[data-threshold="2"]')).toBeTruthy();
    expect(container.querySelector('path[data-line]')?.getAttribute('d')).toMatch(/L/);
  });
  it('fill opacity per series; a line with fillOpacity gets an area', () => {
    const { container } = render(<LineChart series={[{ ...cats[0], fillOpacity: 0.5 }]} />);
    expect(container.querySelector('path[data-area]')?.getAttribute('opacity')).toBe('0.5');
  });
});

describe('BarChart settings props', () => {
  it('horizontal orientation and value labels', () => {
    const { container } = render(<BarChart series={[cats[0]]} orientation="horizontal" showValues yFormat={(v) => `${v}%`} />);
    const bars = [...container.querySelectorAll('g[data-series] path[data-bar]')];
    expect(new Set(bars.map((r) => r.getAttribute('data-x'))).size).toBe(1);
    expect([...container.querySelectorAll('[data-value-label]')].map((t) => t.textContent)).toEqual(['1%', '3%', '2%']);
  });
  it('vertical thresholds on horizontal bars', () => {
    const { container } = render(<BarChart series={[cats[0]]} orientation="horizontal" thresholds={[{ value: 2 }]} />);
    const l = container.querySelector('[data-threshold="2"] line')!;
    expect(l.getAttribute('x1')).toBe(l.getAttribute('x2'));
  });
});

describe('Pie / Donut settings props', () => {
  const pie = [{ id: 'p', name: 'p', data: [{ x: 'A', y: 30 }, { x: 'B', y: 10 }] }];
  it('slice labels, legend values, centre on/off', () => {
    const { container, rerender } = render(<PieChart series={pie} labels="percent" legendValue="value" valueFormat={(v) => `${v} kg`} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('30 kg')).toBeInTheDocument();
    rerender(<DonutChart series={pie} centerLabel="Total" valueFormat={(v) => `${v} kg`} />);
    expect(container.querySelector('[data-center]')?.textContent).toBe('40 kg');
    expect(screen.getByText('Total')).toBeInTheDocument();
    rerender(<DonutChart series={pie} showCenter={false} />);
    expect(container.querySelector('[data-center]')).toBeNull();
  });
  it('legend toggle hides a slice', () => {
    const { container } = render(<PieChart series={pie} legendToggle />);
    expect(container.querySelectorAll('svg path')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(container.querySelectorAll('svg path').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('slices are plain shapes in one picture until onSliceClick makes them buttons', () => {
    const points = [{ id: 'p', name: 'p', data: [{ x: 'A', y: 3 }, { x: 'B', y: null }, { x: 'C', y: 1 }] }];
    const plain = render(<PieChart series={points} />);
    expect(plain.container.querySelector('svg')).toHaveAttribute('role', 'img');
    expect(plain.container.querySelectorAll('path[role="button"]')).toHaveLength(0);
    plain.unmount();
    const onSliceClick = vi.fn();
    const { container } = render(<PieChart series={points} onSliceClick={onSliceClick} valueFormat={(v) => `${v} kg`} />);
    expect(container.querySelector('svg')).toHaveAttribute('role', 'group');
    const buttons = container.querySelectorAll('path[role="button"]');
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute('aria-label')).toBe('C, 1 kg');
    expect(buttons[1]).toHaveAttribute('tabindex', '0');
    // The index is the point's place in the data: the null point in between is counted.
    fireEvent.keyDown(buttons[1], { key: 'Enter' });
    expect(onSliceClick).toHaveBeenCalledWith({ index: 2, name: 'C', value: 1, color: 'var(--secondary)' });
    fireEvent.click(buttons[0]);
    expect(onSliceClick).toHaveBeenLastCalledWith({ index: 0, name: 'A', value: 3, color: 'var(--primary)' });
  });
});

describe('ScatterChart settings props', () => {
  it('x bounds and formats, axis titles', () => {
    render(<ScatterChart series={[{ id: 's', name: 's', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }]} xMin={0} xMax={10} xFormat={(v) => `${v} m`} xLabel="Distance" />);
    expect(screen.getByText('10 m')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
  });
});

describe('HeatmapChart settings props', () => {
  const cells = [{ x: 'Mon', y: '1', value: 1 }, { x: 'Tue', y: '1', value: 9 }];
  it('banded colours, cell values, banded legend', () => {
    const { container } = render(
      <HeatmapChart cells={cells} showValues colorFor={(v) => (v > 5 ? '#ff0000' : undefined)} legendItems={[{ color: '#ff0000', label: 'Hot' }]} />,
    );
    expect(container.querySelectorAll('rect[fill="#ff0000"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-cell-label]')).toHaveLength(2);
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });
  it('legend on the right', () => {
    const { container } = render(<HeatmapChart cells={cells} legendPosition="right" />);
    expect(container.firstElementChild?.lastElementChild?.getAttribute('data-heat-legend')).toBe('scale');
  });
});

describe('domains, second axis, stacks, regression', () => {
  it('a resolved domain is spanned exactly by its ticks', () => {
    for (const [lo, hi] of [[16.6, 25.3], [0, 351], [3, 7.2], [-12, 48]]) {
      const d = resolveDomain({ min: lo, max: hi }, { count: 4 });
      const t = niceTicks(d.min, d.max, 4);
      expect(t[0]).toBeCloseTo(d.min, 9);
      expect(t[t.length - 1]).toBeCloseTo(d.max, 9);
    }
    expect(resolveDomain({ min: 0, max: 80 }, { count: 8 }).max).toBe(80);
  });
  it('the right axis takes the left grid: same intervals, round step, covering its data', () => {
    const r = alignedDomain({ min: 41, max: 53 }, 3);
    expect(r.ticks).toHaveLength(4);
    expect(r.min).toBeLessThanOrEqual(41);
    expect(r.max).toBeGreaterThanOrEqual(53);
    expect(r.ticks[1] - r.ticks[0]).toBe(5);
    expect(alignedDomain({ min: 0, max: 1 }, 2, { min: 0, max: 100 }).ticks).toEqual([0, 50, 100]);
  });
  it('stack groups: series sharing a key stack, others stand alone; extents can leave zero out', () => {
    const s = [
      { id: 'a', name: 'a', data: [{ x: 1, y: 1 }], stack: 'g' },
      { id: 'b', name: 'b', data: [{ x: 1, y: 2 }], stack: 'g' },
      { id: 'c', name: 'c', data: [{ x: 1, y: 5 }] },
    ];
    const keys = stackKeys(s, false);
    expect(keys[2]).toBeNull();
    const { tops, below } = groupedStackTops(s, keys);
    expect(tops.map((t) => t[0])).toEqual([1, 3, 5]);
    expect(below).toEqual([-1, 0, -1]);
    expect(topsExtent([[5, 7]], false)).toEqual({ min: 5, max: 7 });
    expect(topsExtent([[5, 7]])).toEqual({ min: 0, max: 7 });
  });
  it('linear regression and point shapes', () => {
    expect(linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }])).toEqual({ slope: 2, intercept: 1 });
    expect(linearRegression([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
    expect(pointPath('diamond', 10, 10, 4)).toMatch(/^M10 5L15 10/);
  });
  it('time ticks are 24 h; dates read d MMM', () => {
    const t = Date.UTC(2026, 9, 6, 15, 30);
    expect(formatTick(t, 3_600_000, 'en-US', 'UTC')).toBe('15:30');
    expect(dayMonthText(t, 'en-US', 'UTC')).toBe('6 Oct');
  });
});

describe('chart settings surface (phase 21 depth)', () => {
  it('right axis on lines: two value axes and a title on the right', () => {
    const two = [cats[0], { ...cats[1], yAxis: 'right' as const }];
    const { container } = render(<LineChart series={two} yFormat={(v) => `${v}L`} y2Format={(v) => `${v}R`} y2Label="Right" />);
    const t = [...container.querySelectorAll('svg text')].map((x) => x.textContent ?? '');
    expect(t.filter((x) => x.endsWith('L')).length).toBeGreaterThan(1);
    expect(t.filter((x) => x.endsWith('R')).length).toBe(t.filter((x) => x.endsWith('L')).length);
    expect(screen.getByText('Right')).toBeInTheDocument();
  });
  it('gradient fills, point shapes and value labels on lines', () => {
    const { container } = render(<AreaChart series={[{ ...cats[0], fillGradient: true, showPoints: true, pointShape: 'square' }]} showValues />);
    expect(container.querySelector('linearGradient')).toBeTruthy();
    expect(container.querySelectorAll('path[data-point]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-value-label]').length).toBeGreaterThan(0);
  });
  it('bars: category ticks, markers, end-rounded paths, hidden axis labels', () => {
    const { container } = render(
      <BarChart series={[cats[0]]} categoryTicks={[{ at: 0, label: 'E0' }, { at: 3, label: 'E3' }]} markers={[{ at: 1.5, label: 'Mean' }]} showYAxis={false} />,
    );
    expect(screen.getByText('E0')).toBeInTheDocument();
    expect(screen.getByText('E3')).toBeInTheDocument();
    expect(screen.queryByText('Mon')).toBeNull();
    expect(container.querySelector('[data-marker="Mean"] line')).toBeTruthy();
    expect(container.querySelector('path[data-bar]')?.getAttribute('d')).toMatch(/Q/);
  });
  it('scatter trend line and point opacity; pie outside labels and grid legend', () => {
    const sc = render(<ScatterChart series={[{ id: 's', name: 's', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2.5 }] }]} trendLine pointOpacity={0.4} />);
    expect(sc.container.querySelector('line[data-trend]')).toBeTruthy();
    expect(sc.container.querySelector('circle')?.getAttribute('fill-opacity')).toBe('0.4');
    const pie = render(<PieChart series={[{ id: 'p', name: 'p', data: [{ x: 'A', y: 3 }, { x: 'B', y: 1 }] }]} labels="name" labelPosition="outside" legendLayout="grid" />);
    expect(pie.container.querySelectorAll('polyline')).toHaveLength(2);
    expect((pie.container.querySelector('ul') as HTMLElement).className).toContain('grid');
  });
  it('heatmap: low/high colours, value label colour follows the cell, legend format', () => {
    const { container } = render(
      <HeatmapChart cells={[{ x: 'a', y: '1', value: 0 }, { x: 'b', y: '1', value: 10 }]} color="#ff0000" colorLow="#0000ff" showValues legendFormat={(v) => `${v}!`} />,
    );
    expect(container.querySelector('rect')?.getAttribute('fill')).toContain('color-mix');
    const labels = [...container.querySelectorAll('[data-cell-label]')];
    expect(labels[0].getAttribute('fill')).toBe('var(--text-primary)');
    expect(labels[1].getAttribute('fill')).toBe('var(--surface-base)');
    expect(screen.getByText('10!')).toBeInTheDocument();
  });
  it('a stacked tooltip can add a total row and drop its heading', () => {
    const { container } = render(<BarChart series={cats} stacked tooltipTotal tooltipHeader={false} />);
    fireEvent.mouseMove(container.querySelector('svg')!, { clientX: 100, clientY: 100 });
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('[data-tooltip-total]')?.textContent).toMatch(/Total/);
    expect(tip.textContent).not.toMatch(/Mon/);
  });
  it('the total row takes tooltipTotalLabel (bar and stacked area)', () => {
    const { container, unmount } = render(<BarChart series={cats} stacked tooltipTotal tooltipTotalLabel="Toplam" />);
    fireEvent.mouseMove(container.querySelector('svg')!, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip').querySelector('[data-tooltip-total]')?.textContent).toMatch(/^Toplam/);
    unmount();
    const area = render(<AreaChart series={cats} stacked tooltipTotal tooltipTotalLabel="Toplam" />);
    fireEvent.mouseMove(area.container.querySelector('svg')!, { clientX: 100, clientY: 100 });
    const total = screen.getByRole('tooltip').querySelector('[data-tooltip-total]')?.textContent ?? '';
    expect(total).toMatch(/^Toplam/);
    expect(total).not.toMatch(/Total/);
  });
});
