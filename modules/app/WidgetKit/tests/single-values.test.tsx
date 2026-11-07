import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { validate, templateDefaults, effective } from '../settings/engine';
import type { SettingsTemplate, Sparse } from '../settings/types';
import type { ValueFormat } from '../settings/style';
import type { BuiltinKindSpec, SlotData, WidgetKindView } from '../kind';
import { STAT_SPARKLINE, STAT_SPARKLINE_KIND } from '../templates/stat-sparkline';
import { STAT_ATTRIBUTES, STAT_ATTRIBUTES_KIND } from '../templates/stat-attributes';
import { PROGRESS, PROGRESS_KIND } from '../templates/progress';
import { GAUGE, GAUGE_KIND } from '../templates/gauge';
import { STATE, STATE_KIND } from '../templates/state';
import { STAT_SPARKLINE_VIEW } from '../views/StatSparklineView';
import { STAT_ATTRIBUTES_VIEW } from '../views/StatAttributesView';
import { PROGRESS_VIEW } from '../views/ProgressView';
import { GAUGE_VIEW, rangesToBands } from '../views/GaugeView';
import { STATE_VIEW, evaluateState } from '../views/StateView';
import { WidgetKitProvider } from '../WidgetKitContext';

const KINDS: Array<[BuiltinKindSpec, SettingsTemplate, WidgetKindView]> = [
  [STAT_SPARKLINE_KIND, STAT_SPARKLINE, STAT_SPARKLINE_VIEW],
  [STAT_ATTRIBUTES_KIND, STAT_ATTRIBUTES, STAT_ATTRIBUTES_VIEW],
  [PROGRESS_KIND, PROGRESS, PROGRESS_VIEW],
  [GAUGE_KIND, GAUGE, GAUGE_VIEW],
  [STATE_KIND, STATE, STATE_VIEW],
];

describe.each(KINDS)('template $type', (kind, template) => {
  it('is builtin:<type>@1 with no migrations and the kind points at it', () => {
    expect(template.id).toBe(`builtin:${kind.type}`);
    expect(template.version).toBe(1);
    expect(template.migrations).toEqual([]);
    expect(kind.template).toBe(template);
    expect(template.namespace).toBe('');
  });
  it('validates its own defaults with no issues', () => {
    const defaults = templateDefaults(template);
    const r = validate(template, defaults);
    expect(r.issues).toEqual([]);
    expect(r.values).toEqual(defaults);
  });
  it('every field sits in a declared group and is since 1', () => {
    const groups = new Set(template.groups.map((g) => g.id));
    for (const [k, f] of Object.entries(template.fields)) {
      expect(groups.has(f.group as string), `${k} -> ${f.group}`).toBe(true);
      expect(f.since).toBe(1);
    }
  });
  it('every group has at least one field', () => {
    const used = new Set(Object.values(template.fields).map((f) => f.group));
    for (const g of template.groups) expect(used.has(g.id), g.id).toBe(true);
  });
});

describe('rules', () => {
  it('gauge refuses min >= max and start >= end angle', () => {
    expect(validate(GAUGE, { min: 10, max: 5 }).issues.map((i) => i.path)).toContain('max');
    expect(validate(GAUGE, { startAngle: 90, endAngle: 0 }).issues.map((i) => i.path)).toContain('endAngle');
  });
  it('gauge keeps today\'s inclusive-top boundary and dims when stale', () => {
    expect(templateDefaults(GAUGE).rangeEdges).toBe('to');
    expect(GAUGE.cardDefaults).toEqual({ staleDisplay: 'dim' });
  });
  it('format defaults reproduce today\'s decimals', () => {
    expect(STAT_SPARKLINE.formatDefaults).toEqual({ decimals: 0 });
    expect(STAT_ATTRIBUTES.formatDefaults).toEqual({});
    expect(GAUGE.formatDefaults).toEqual({ decimals: 0 });
    expect(STATE.format).toBe(false);
  });
});

const fmt: ValueFormat = { decimals: 0 };
function renderKind(view: WidgetKindView, template: SettingsTemplate, data: Record<string, SlotData | undefined>, stored: Sparse = {}, format: ValueFormat = fmt, extra: { stale?: boolean; editing?: boolean } = {}) {
  const View = view.View;
  return render(<View settings={effective(template, stored)} format={format} data={data} locale="en" {...extra} />);
}

const series = (vals: number[]): SlotData => ({
  shape: 'series',
  series: [{ name: 's', points: vals.map((v, i) => ({ t: `2026-10-0${i + 1}T00:00:00Z`, v })) }],
});

describe('stat.sparkline view', () => {
  it('shows the latest value, Stat\'s change chip, the span and the trend', () => {
    const { container } = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([10, 12, 15]) });
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe('15');
    const change = container.querySelector('[data-part="change"]')!;
    expect(change.textContent).toContain('+50.0 %');
    expect(change.textContent).toContain('over 2 d');
    expect(container.querySelector('[data-part="area"]')?.getAttribute('fill')).toMatch(/^url\(#/);
    expect(container.querySelector('[data-part="last"]')).toBeTruthy();
    expect(container.querySelector('[data-part="min"]')).toBeNull();
  });
  it('settings change the line, the fill, the markers and the layout', () => {
    const { container } = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([10, 8, 12, 15]) }, {
      layout: 'chart-only', fill: 'none', lineColor: '#ff0000', lineWidth: 3, curve: 'step', showMinMax: true, showLast: false,
    });
    expect(container.querySelector('[data-part="value"]')).toBeNull();
    expect(container.querySelector('[data-part="area"]')).toBeNull();
    const line = container.querySelector('[data-part="line"]')!;
    expect(line.getAttribute('stroke')).toBe('#ff0000');
    expect(line.getAttribute('stroke-width')).toBe('3');
    expect(line.getAttribute('d')).toContain('H');
    expect(container.querySelector('[data-part="min"]')).toBeTruthy();
    expect(container.querySelector('[data-part="max"]')).toBeTruthy();
    expect(container.querySelector('[data-part="last"]')).toBeNull();
    const flat = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([10, 12]) }, { fill: 'opacity', fillOpacity: 40, lineColor: '#00ff00' });
    const area = flat.container.querySelector('[data-part="area"]')!;
    expect(area.getAttribute('fill')).toBe('#00ff00');
    expect(area.getAttribute('fill-opacity')).toBe('0.4');
  });
  it('the change badge, its meaning, the ranges and the time text', () => {
    const r = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([10, 8]) }, {
      showChange: 'delta', increaseIs: 'bad', ranges: [{ to: 9, color: '#00ff00' }], rangeTarget: 'both', timeRange: 'custom', timeRangeText: 'since Monday',
    });
    const change = r.container.querySelector('[data-part="change"]')!;
    expect(change.textContent).toContain('-2');
    expect(change.textContent).toContain('since Monday');
    expect((change.querySelector('[style]') as HTMLElement).style.color).toBe('var(--success)');
    expect((r.container.querySelector('[data-part="value"] > span') as HTMLElement).style.color).toBe('rgb(0, 255, 0)');
    expect(r.container.querySelector('[data-part="line"]')?.getAttribute('stroke')).toBe('#00ff00');
    const off = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([10, 8]) }, { showChange: 'off', timeRange: 'off', label: 'Hall 2' });
    expect(off.container.querySelector('[data-part="change"]')).toBeNull();
    expect(off.container.textContent).not.toContain('over');
    expect(off.container.textContent).toContain('Hall 2');
  });
  it('every layout renders the number', () => {
    for (const layout of ['stacked', 'value-top', 'inline', 'overlay']) {
      const { container, unmount } = renderKind(STAT_SPARKLINE_VIEW, STAT_SPARKLINE, { series: series([1, 2]) }, { layout });
      expect(container.querySelector('[data-part="value"]')?.textContent, layout).toBe('2');
      unmount();
    }
  });
  it('is empty without points', () => {
    expect(STAT_SPARKLINE_VIEW.isEmpty!({}, {})).toBe(true);
    expect(STAT_SPARKLINE_VIEW.isEmpty!({ series: { shape: 'series', series: [] } }, {})).toBe(true);
    expect(STAT_SPARKLINE_VIEW.isEmpty!({ series: series([1]) }, {})).toBe(false);
  });
});

describe('stat.attributes view', () => {
  const record: SlotData = { shape: 'record', record: { serialNo: 'A-1', temp: 21.456, reading: 17.4, count: 3, online: true, note: null } };
  it('lists every key humanised with automatic decimals', () => {
    const { container } = renderKind(STAT_ATTRIBUTES_VIEW, STAT_ATTRIBUTES, { record }, {}, {});
    expect(container.querySelector('[data-layout="list"]')).toBeTruthy();
    expect(screen.getByText('Serial no')).toBeInTheDocument();
    expect(screen.getByText('21.46')).toBeInTheDocument();
    expect(screen.getByText('17.4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(container.querySelectorAll('.border-b')).toHaveLength(6);
  });
  it('fields, units, decimals, colours, ranges, layout and max rows drive the output', () => {
    const { container } = renderKind(STAT_ATTRIBUTES_VIEW, STAT_ATTRIBUTES, { record }, {
      layout: 'grid-2', maxRows: 3, emptyValue: 'n/a', dividers: false,
      fields: [{ key: 'temp', label: 'Temperature', unit: '°C', decimals: 1, color: '#123456' }, { key: 'note' }, { key: 'count', ranges: [{ from: 2, color: '#ff0000' }] }, { key: 'online' }],
    });
    expect(container.querySelector('[data-layout="grid-2"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-part="row"]')).toHaveLength(3);
    const v = screen.getByText('21.5');
    expect(v.parentElement!.style.color).toBe('rgb(18, 52, 86)');
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('3').parentElement!.style.color).toBe('rgb(255, 0, 0)');
    expect(container.querySelector('.border-b')).toBeNull();
  });
  it('list options: dividers, striped rows and alignment; columns layout', () => {
    const { container } = renderKind(STAT_ATTRIBUTES_VIEW, STAT_ATTRIBUTES, { record }, { dividers: false, striped: true, alignment: 'start' });
    expect(container.querySelector('.border-b')).toBeNull();
    const row = container.querySelector('[data-layout="list"] > div')!;
    expect(row.className).toContain('even:bg-surface-overlay/60');
    expect(row.className).toContain('grid');
    const c = renderKind(STAT_ATTRIBUTES_VIEW, STAT_ATTRIBUTES, { record }, { layout: 'columns', fields: [{ key: 'count' }, { key: 'temp' }] });
    expect(c.container.querySelector('[data-layout="columns"]')?.className).toContain('grid-flow-col');
  });
  it('a field with no label of its own reads the source\'s label for the key, in the viewer\'s language', () => {
    const site: SlotData = {
      shape: 'record', record: { name: 'Antalya', place: 'Türkiye', status: 'Uyarı' },
      recordMeta: { name: { label: 'Ad' }, place: { label: { en: 'Place', tr: 'Yer' } } },
    };
    const fields = [{ key: 'name' }, { key: 'place' }, { key: 'status' }, { key: 'name', label: 'Mine' }];
    const View = STAT_ATTRIBUTES_VIEW.View;
    render(<View settings={effective(STAT_ATTRIBUTES, { fields })} format={fmt} data={{ record: site }} locale="tr" />);
    expect(screen.getByText('Ad')).toBeInTheDocument();
    expect(screen.getByText('Yer')).toBeInTheDocument();
    // no label anywhere: the key in words; a label of its own wins over the source's
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Mine')).toBeInTheDocument();
  });
  it('exports key,value CSV and is empty without a record', () => {
    const rows = STAT_ATTRIBUTES_VIEW.toCsv!({ record }, effective(STAT_ATTRIBUTES, { fields: [{ key: 'count' }, { key: 'temp', unit: '°C' }] }), {});
    expect(rows).toEqual([['key', 'value'], ['count', '3'], ['temp', '21.46 °C']]);
    expect(STAT_ATTRIBUTES_VIEW.isEmpty!({}, {})).toBe(true);
    expect(STAT_ATTRIBUTES_VIEW.isEmpty!({ record: { shape: 'record', record: {} } }, {})).toBe(true);
  });
});

describe('progress view', () => {
  const value: SlotData = { shape: 'scalar', value: 42 };
  const fill = () => screen.getByRole('progressbar').querySelector(':scope > div:last-child') as HTMLElement;
  it('shows value of target and a bar', () => {
    const { container } = renderKind(PROGRESS_VIEW, PROGRESS, { value });
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe('42');
    expect(container.querySelector('[data-part="secondary"]')?.textContent).toBe('of 100');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });
  it('a bound target wins; percent text, colours, thickness, scale and ranges apply', () => {
    const { container } = renderKind(PROGRESS_VIEW, PROGRESS, { value, target: { shape: 'scalar', value: 84 } }, {
      valueText: 'percent', barColor: '#ff0000', trackColor: '#000000', thickness: 20, showTicks: true, tickCount: 1,
    });
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe('50%');
    const bar = screen.getByRole('progressbar');
    expect(bar.style.height).toBe('20px');
    expect(bar.style.background).toBe('rgb(0, 0, 0)');
    expect(fill().style.background).toBe('rgb(255, 0, 0)');
    expect(container.querySelector('[data-part="ticks"]')?.textContent).toBe('04284');
  });
  it('ranges colour the bar or show as zones; gradient, marker and text position', () => {
    const r = renderKind(PROGRESS_VIEW, PROGRESS, { value }, { ranges: [{ from: 40, color: '#00ff00' }] });
    expect(fill().style.background).toBe('rgb(0, 255, 0)');
    r.unmount();
    const z = renderKind(PROGRESS_VIEW, PROGRESS, { value }, {
      ranges: [{ to: 50, color: '#ff0000' }, { from: 50, color: '#00ff00' }], rangeDisplay: 'track', barGradient: true, marker: 60, textPosition: 'below',
    });
    expect(z.container.querySelectorAll('[data-part="segment"]')).toHaveLength(2);
    expect(fill().style.backgroundImage).toContain('linear-gradient');
    expect((z.container.querySelector('[data-part="mark"]') as HTMLElement).style.left).toBe('60%');
    const valueEl = z.container.querySelector('[data-part="value"]')!;
    expect(screen.getByRole('progressbar').compareDocumentPosition(valueEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('ring and half ring layouts', () => {
    const { container, unmount } = renderKind(PROGRESS_VIEW, PROGRESS, { value }, { layout: 'ring' });
    expect(container.querySelector('[data-shape="circle"]')).toBeTruthy();
    expect(container.querySelector('[data-part="value"]')?.textContent).toBe('42');
    unmount();
    const h = renderKind(PROGRESS_VIEW, PROGRESS, { value }, { layout: 'semicircle', valueText: 'none' });
    expect(h.container.querySelector('[data-shape="semicircle"]')).toBeTruthy();
    expect(h.container.querySelector('[data-part="value"]')).toBeNull();
  });
  it('is empty without a number', () => {
    expect(PROGRESS_VIEW.isEmpty!({}, {})).toBe(true);
    expect(PROGRESS_VIEW.isEmpty!({ value: { shape: 'scalar', value: null } }, {})).toBe(true);
  });
});

describe('gauge scale help', () => {
  it('next-boilerplate phase 53.2.10 (re-run 4 #28): names the Data tab\'s Minimum and Maximum, never a "slot"', () => {
    const fields = GAUGE.fields as Record<string, { description?: string }>;
    expect(fields.min.description).toMatch(/^Used when no value is chosen for Minimum on the Data tab\./);
    expect(fields.max.description).toMatch(/^Used when no value is chosen for Maximum on the Data tab\./);
    for (const f of Object.values(fields)) expect(f.description ?? '').not.toMatch(/\bslots?\b/i);
    // the names it gives are the Data tab's own
    expect(GAUGE_KIND.slots.filter((s) => s.key !== 'value').map((s) => s.label)).toEqual(['Minimum', 'Maximum']);
  });
});

describe('gauge view', () => {
  const value: SlotData = { shape: 'scalar', value: 72 };
  it('renders a meter with defaults: outer range line, rounded arc, the number as a metric', () => {
    const { container } = renderKind(GAUGE_VIEW, GAUGE, { value }, { ranges: [{ to: 50, color: '#00ff00' }, { from: 50, color: '#ff0000' }] }, { decimals: 0, unit: '%' });
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '72');
    expect(container.querySelector('[data-layout="arc"]')).toBeTruthy();
    expect(container.querySelector('[data-part="min"]')?.textContent).toBe('0');
    expect(container.querySelector('[data-part="bar"]')?.getAttribute('stroke')).toBe('#ff0000');
    expect(container.querySelector('[data-part="bar"]')?.getAttribute('stroke-linecap')).toBe('round');
    const bands = container.querySelectorAll('[data-part="band"]');
    expect(bands).toHaveLength(2);
    expect(bands[0].getAttribute('stroke-opacity')).toBeNull();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });
  it('bar layout: ranges colour the bar only, needle, ticks, min/max and colours', () => {
    const { container } = renderKind(GAUGE_VIEW, GAUGE, { value, max: { shape: 'scalar', value: 200 } }, {
      layout: 'bar-horizontal', needle: true, ticks: 5, tickLabels: true, showMinMax: false, trackColor: '#111111', thickness: 10,
      ranges: [{ to: 50, color: '#00ff00' }, { from: 50, color: '#ff0000', label: 'Hot' }], rangeDisplay: 'off',
    });
    expect(container.querySelector('[data-layout="bar-horizontal"]')).toBeTruthy();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemax', '200');
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toContain('Hot');
    expect((container.querySelector('[data-part="bar"]') as HTMLElement).style.background).toBe('rgb(255, 0, 0)');
    expect((container.querySelector('[data-part="track"]') as HTMLElement).style.background).toBe('rgb(17, 17, 17)');
    expect(container.querySelector('[data-part="needle"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-part="tick"]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-part="tick-label"]')).toHaveLength(5);
    expect(container.querySelector('[data-part="min"]')).toBeNull();
    expect(container.querySelector('[data-part="band"]')).toBeNull();
  });
  it('constant bar colour with a tinted track; donut, caption and value off', () => {
    const { container } = renderKind(GAUGE_VIEW, GAUGE, { value }, {
      layout: 'donut', showValue: false, unitTitle: 'Load', barColor: '#0000ff', barColorMode: 'constant', rangeDisplay: 'track', rangeOpacity: 50,
      ranges: [{ to: 100, color: '#ff0000' }],
    });
    expect(container.querySelector('[data-layout="donut"]')).toBeTruthy();
    expect(container.querySelector('[data-part="bar"]')?.getAttribute('stroke')).toBe('#0000ff');
    const band = container.querySelectorAll('[data-part="band"]');
    expect(band).toHaveLength(1);
    expect(band[0].getAttribute('stroke-opacity')).toBe('0.5');
    expect(container.querySelector('[data-part="value"]')).toBeNull();
    expect(container.querySelector('[data-part="caption"]')?.textContent).toBe('Load');
  });
  it('needle styles, the level layout, the head and the value colour', () => {
    const a = renderKind(GAUGE_VIEW, GAUGE, { value }, { needle: true, needleStyle: 'arrow', label: 'Core 1', valueColor: '#123456' });
    expect(a.container.querySelector('path[data-part="needle"]')).toBeTruthy();
    expect(screen.getByText('Core 1')).toBeInTheDocument();
    expect(screen.getByText('72').parentElement!.style.color).toBe('rgb(18, 52, 86)');
    a.unmount();
    const l = renderKind(GAUGE_VIEW, GAUGE, { value }, { layout: 'level', needle: true, needleStyle: 'marker' });
    expect(l.container.querySelector('[data-layout="level"]')).toBeTruthy();
    expect(l.container.querySelector('[data-part="bulb"]')).toBeTruthy();
    expect(l.container.querySelector('[data-part="needle"]')).toBeTruthy();
  });
  it('maps ranges to bands and is empty without a value', () => {
    expect(rangesToBands([{ to: 10, color: 'var(--success)' }, { from: 10, color: 'bad;' }])).toEqual([{ to: 10, color: 'var(--success)' }]);
    expect(GAUGE_VIEW.isEmpty!({}, {})).toBe(true);
  });
  it('a value off the scale stops at its end and is marked, never drawn past it (NB run 3, item 110)', () => {
    const a = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: 800 } }, { needle: true });
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('data-off-scale', 'above');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter.getAttribute('aria-valuetext')).toContain('Above the scale');
    expect(a.container.querySelector('[data-part="bar"]')?.getAttribute('stroke-dasharray')).toBe('1 1');
    expect(a.container.querySelector('[data-part="off-scale"]')?.textContent).toBe('Above the scale');
    // not while the board is only viewed
    expect(a.container.querySelector('[data-part="off-scale-hint"]')).toBeNull();
    a.unmount();
    const b = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: -5 } }, { layout: 'bar-horizontal', showValue: false });
    expect(screen.getByRole('meter')).toHaveAttribute('data-off-scale', 'below');
    expect(b.container.querySelector('[data-part="off-scale"]')?.textContent).toBe('Below the scale');
    expect(b.container.querySelector('[data-part="bar"]')).toBeNull();
    b.unmount();
    const c = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: 100 } });
    expect(screen.getByRole('meter')).not.toHaveAttribute('data-off-scale');
    expect(c.container.querySelector('[data-part="off-scale"]')).toBeNull();
  });
  it('while the board is edited, a value far off the scale says where to set it; one just past an end does not', () => {
    const far = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: 800 } }, {}, fmt, { editing: true });
    expect(far.container.querySelector('[data-part="off-scale-hint"]')?.textContent).toBe('Far off the scale: set Minimum and Maximum in the card settings.');
    far.unmount();
    const near = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: 150 } }, {}, fmt, { editing: true });
    expect(near.container.querySelector('[data-part="off-scale"]')).toBeTruthy();
    expect(near.container.querySelector('[data-part="off-scale-hint"]')).toBeNull();
    near.unmount();
    const on = renderKind(GAUGE_VIEW, GAUGE, { value: { shape: 'scalar', value: 800 } }, { max: 1100 }, fmt, { editing: true });
    expect(on.container.querySelector('[data-part="off-scale"]')).toBeNull();
    expect(on.container.querySelector('[data-part="off-scale-hint"]')).toBeNull();
  });
  it('off-scale words come from the host\'s messages', () => {
    const View = GAUGE_VIEW.View;
    const { container } = render(
      <WidgetKitProvider value={{ messages: { charts: { aboveScale: 'Ölçeğin üstünde', scaleHint: 'Ölçeği ayarlayın.' } } }}>
        <View settings={effective(GAUGE, {})} format={fmt} data={{ value: { shape: 'scalar', value: 900 } }} locale="tr" editing />
      </WidgetKitProvider>,
    );
    expect(container.querySelector('[data-part="off-scale"]')?.textContent).toBe('Ölçeğin üstünde');
    expect(container.querySelector('[data-part="off-scale-hint"]')?.textContent).toBe('Ölçeği ayarlayın.');
  });
});

describe('state view', () => {
  const states = [
    { match: 'on', label: 'Running', color: '#00aa00', icon: 'fas fa-check' },
    { gte: 80, label: 'Hot', color: '#ff0000', background: '#ffeeee', pulse: true },
  ];
  it('first matching rule wins, fallback and unknown otherwise', () => {
    const s = effective(STATE, { states, fallbackLabel: 'Other' });
    expect(evaluateState('ON', s).label).toBe('Running');
    expect(evaluateState(90, s)).toMatchObject({ label: 'Hot', color: '#ff0000', background: '#ffeeee', pulse: true });
    expect(evaluateState(10, s).label).toBe('Other');
    expect(evaluateState(null, s)).toMatchObject({ label: 'Unknown', unknown: true });
    expect(evaluateState('on', s, true).label).toBe('Unknown');
    expect(evaluateState('on', effective(STATE, { states, staleAsUnknown: false }), true).label).toBe('Running');
  });
  it('an on / off value no rule names reads On / Off, never 1 / 0 or true / false (a boolean, or 1 / 0 the source calls a boolean)', () => {
    const s = effective(STATE, {});
    expect(evaluateState(true, s)).toMatchObject({ label: 'On', color: 'var(--success)', matched: true });
    expect(evaluateState(false, s)).toMatchObject({ label: 'Off', lit: false, matched: true });
    expect(evaluateState(1, s, false, 'Unknown', { kind: 'boolean' }).label).toBe('On');
    expect(evaluateState(0, s, false, 'Unknown', { kind: 'boolean' }).label).toBe('Off');
    expect(evaluateState('1', s, false, 'Unknown', { kind: 'boolean' }).label).toBe('On');
    // the host's words win; a plain 1 with no word from the source is a number, as before
    expect(evaluateState(1, s, false, 'Unknown', { kind: 'boolean' }, { on: 'Açık', off: 'Kapalı' }).label).toBe('Açık');
    expect(evaluateState(1, s).label).toBe('1');
    // a rule or the source's own word still comes first
    expect(evaluateState(true, effective(STATE, { states: [{ match: 'true', label: 'Running' }] })).label).toBe('Running');
    expect(evaluateState(1, s, false, 'Unknown', { kind: 'boolean', valueMap: { '1': { label: 'Open' } } }).label).toBe('Open');
  });
  it('the big layout puts the state where Stat\'s number sits, with how long it has held', () => {
    const at = new Date(Date.now() - 42 * 60_000).toISOString();
    const { container } = renderKind(STATE_VIEW, STATE, { value: { shape: 'scalar', value: 90, fetchedAt: at } }, { states, label: 'Press A1' });
    expect(container.querySelector('[data-layout="big"]')).toBeTruthy();
    const label = container.querySelector('[data-part="label"]') as HTMLElement;
    expect(label.textContent).toBe('Hot');
    expect(label.style.color).toBe('rgb(255, 0, 0)');
    expect(screen.getByText('Press A1')).toBeInTheDocument();
    expect(container.querySelector('[data-part="since"]')?.textContent).toBe('for 42 min');
  });
  it('layouts, raw value, pulse, alignment and colours change it', () => {
    const b = renderKind(STATE_VIEW, STATE, { value: { shape: 'scalar', value: 90 } }, { states, layout: 'badge', showSince: false });
    const badge = b.container.querySelector('[data-part="badge"]') as HTMLElement;
    expect(badge.textContent).toBe('Hot');
    expect(badge.className).toContain('motion-safe:animate-pulse');
    expect(b.container.querySelector('[data-part="since"]')).toBeNull();
    b.unmount();
    const r = renderKind(STATE_VIEW, STATE, { value: { shape: 'scalar', value: 90 } }, { states, layout: 'tile', showValue: true });
    expect((r.container.querySelector('[data-layout="tile"]') as HTMLElement).style.background).toBe('rgb(255, 238, 238)');
    expect(r.container.querySelector('[data-part="value"]')?.textContent).toBe('90');
    r.unmount();
    const d = renderKind(STATE_VIEW, STATE, { value: { shape: 'scalar', value: 'x' } }, { layout: 'dot', fallbackColor: '#0000ff' });
    expect((d.container.querySelector('[data-part="dot"]') as HTMLElement).style.background).toBe('rgb(0, 0, 255)');
    expect(d.container.querySelector('.motion-safe\\:animate-ping')).toBeNull();
    d.unmount();
    const p = renderKind(STATE_VIEW, STATE, { value: { shape: 'scalar', value: 95 } }, { states, layout: 'dot', alignment: 'center' });
    expect(p.container.querySelector('.motion-safe\\:animate-ping')).toBeTruthy();
    expect(p.container.querySelector('.justify-center')).toBeTruthy();
  });
  it('is empty only without an answer', () => {
    expect(STATE_VIEW.isEmpty!({}, {})).toBe(true);
    expect(STATE_VIEW.isEmpty!({ value: { shape: 'scalar', value: null } }, {})).toBe(false);
  });
});
