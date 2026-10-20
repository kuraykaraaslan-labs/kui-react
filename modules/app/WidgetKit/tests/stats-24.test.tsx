import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { effective } from '../settings/engine';
import { resolvePlacement } from '../settings/resolve';
import type { SlotData } from '../kind';
import { STAT_SPARKLINE, STAT_SPARKLINE_KIND } from '../templates/stat-sparkline';
import { STAT_VALUE } from '../templates/stat-value';
import { STAT_SPARKLINE_VIEW } from '../views/StatSparklineView';
import { STAT_VALUE_VIEW } from '../views/StatValueView';

const series = (vals: number[], fetchedAt?: string): SlotData => ({
  shape: 'series',
  fetchedAt,
  series: [{ name: 's', points: vals.map((v, i) => ({ t: `2026-10-0${i + 1}T00:00:00Z`, v })) }],
});

function spark(data: Record<string, SlotData>, stored = {}) {
  const View = STAT_SPARKLINE_VIEW.View;
  return render(<View settings={effective(STAT_SPARKLINE, stored)} format={{ decimals: 0 }} data={data} locale="en" />);
}

describe('stat.sparkline compare slot', () => {
  it('declares an optional scalar compare slot', () => {
    const slot = STAT_SPARKLINE_KIND.slots.find((s) => s.key === 'compare')!;
    expect(slot).toMatchObject({ shape: 'scalar', required: false });
  });
  it('without it the change is from the first point, as before', () => {
    const { container } = spark({ series: series([10, 12, 15]) });
    expect(container.querySelector('[data-part="change"]')?.textContent).toContain('+50.0 %');
  });
  it('with it the change is against the bound value, as a percentage and as an amount', () => {
    const data = { series: series([10, 12, 15]), compare: { shape: 'scalar', value: 30 } as SlotData };
    const pct = spark(data, { compareLabel: 'vs last week' });
    const change = pct.container.querySelector('[data-part="change"]')!;
    expect(change.textContent).toContain('-50.0 %');
    expect(change.textContent).toContain('vs last week');
    pct.unmount();
    const abs = spark(data, { showChange: 'delta' });
    expect(abs.container.querySelector('[data-part="change"]')?.textContent).toContain('-15');
  });
  it('a compare of zero cannot make a percentage; off hides the change', () => {
    const zero = spark({ series: series([10, 12, 15]), compare: { shape: 'scalar', value: 0 } as SlotData });
    expect(zero.container.querySelector('[data-part="change"]')).toBeNull();
    zero.unmount();
    const off = spark({ series: series([10, 12, 15]), compare: { shape: 'scalar', value: 5 } as SlotData }, { showChange: 'off' });
    expect(off.container.querySelector('[data-part="change"]')).toBeNull();
  });
  it('the source direction colours the change', () => {
    const r = resolvePlacement({ template: STAT_SPARKLINE, slotCount: 2, settings: {}, sourceMeta: { direction: 'lowerIsBetter' } });
    expect(r.settings.increaseIs).toBe('bad');
  });
});

describe('"Updated … ago"', () => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  it('is off unless asked for', () => {
    const { container } = render(<STAT_VALUE_VIEW.View settings={effective(STAT_VALUE, {})} format={{}} data={{ value: { shape: 'scalar', value: 4, fetchedAt: ago(5) } }} locale="en" />);
    expect(container.textContent).not.toMatch(/Updated/);
  });
  it('stat.value words the age of the value', () => {
    const { container } = render(<STAT_VALUE_VIEW.View settings={effective(STAT_VALUE, { showUpdated: true })} format={{}} data={{ value: { shape: 'scalar', value: 4, fetchedAt: ago(5) } }} locale="en" />);
    expect(container.textContent).toMatch(/Updated 5 minutes ago/);
  });
  it('stat.value without a time shows nothing', () => {
    const { container } = render(<STAT_VALUE_VIEW.View settings={effective(STAT_VALUE, { showUpdated: true })} format={{}} data={{ value: { shape: 'scalar', value: 4 } }} locale="en" />);
    expect(container.textContent).not.toMatch(/Updated/);
  });
  it('stat.sparkline uses the newest point, else the fetch time', () => {
    const now = Date.now();
    const recent: SlotData = { shape: 'series', series: [{ name: 's', points: [{ t: new Date(now - 3 * 3600_000).toISOString(), v: 1 }, { t: new Date(now - 2 * 3600_000).toISOString(), v: 2 }] }] };
    const a = spark({ series: recent }, { showUpdated: true });
    expect(a.container.textContent).toMatch(/Updated 2 hours ago/);
    a.unmount();
    const b = spark({ series: { shape: 'series', fetchedAt: ago(10), series: [{ name: 's', points: [{ t: 'x', v: 1 }, { t: 'y', v: 2 }] }] } }, { showUpdated: true });
    expect(b.container.textContent).toMatch(/Updated 10 minutes ago/);
  });
});
