import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import type { SlotData } from '../kind';
import { MIN_FIT_SCALE, fitScale } from '../card-logic';
import { FitBox } from '../FitBox';
import { PlacementCard } from '../PlacementCard';
import { STAT_ATTRIBUTES, STAT_ATTRIBUTES_KIND } from '../templates/stat-attributes';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { STAT_ATTRIBUTES_VIEW } from '../views/StatAttributesView';
import { DATA_TABLE_VIEW } from '../views/DataTableView';
import { STATE_VIEW } from '../views/StateView';
import { CONTROL_SWITCH_VIEW } from '../views/ControlSwitchView';

/**
 * A card whose content has a height of its own, in a fixed-height cell smaller than it needs, shows all of it scaled down instead of
 * cutting it off under the header (a two-row "Site" card cut the site's name, place and status in half).
 */
const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const record: SlotData = { shape: 'record', record: { name: 'Park North 1', place: 'Lumivale', status: 'Warning' }, fetchedAt: '2026-10-31T09:59:00.000Z' } as SlotData;

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('fitScale', () => {
  it('leaves content that fits, or that is not measured yet, at full size', () => {
    expect(fitScale(100, 80)).toBe(1);
    expect(fitScale(100, 100)).toBe(1);
    expect(fitScale(0, 80)).toBe(1);
  });

  it('scales content that needs more height down to the body', () => {
    expect(fitScale(98, 109)).toBeCloseTo(0.899, 3);
    expect(fitScale(80, 100)).toBe(0.8);
  });

  it('never goes under the smallest readable scale', () => {
    expect(fitScale(22, 55)).toBe(MIN_FIT_SCALE);
  });
});

describe('the kinds whose content has a height of its own', () => {
  it('are fitted; the ones that scroll or draw to the card are not', () => {
    expect([STAT_ATTRIBUTES_VIEW, STATE_VIEW, CONTROL_SWITCH_VIEW].every((v) => v.fit)).toBe(true);
    expect(DATA_TABLE_VIEW.fit).toBeUndefined();
  });
});

describe('PlacementCard', () => {
  const attributes = (fixedHeight: boolean) => render(
    <PlacementCard title="Site" template={STAT_ATTRIBUTES} slots={STAT_ATTRIBUTES_KIND.slots} view={STAT_ATTRIBUTES_VIEW}
      settings={{ layout: 'columns' }} data={{ record }} now={NOW} fixedHeight={fixedHeight} />,
  );

  it('fits a fitted kind in a fixed-height cell', () => {
    const { container } = attributes(true);
    expect(container.querySelector('[data-part="fit"]')).not.toBeNull();
    expect(container.textContent).toContain('Park North 1');
  });

  it('leaves it alone where the card grows with its content', () => {
    expect(attributes(false).container.querySelector('[data-part="fit"]')).toBeNull();
  });

  it('never fits a kind that scrolls', () => {
    const { container } = render(
      <PlacementCard title="Devices" template={DATA_TABLE} slots={DATA_TABLE_KIND.slots} view={DATA_TABLE_VIEW} settings={{}}
        data={{ rows: { shape: 'table', columns: [{ key: 'name', label: 'Name', type: 'text' }], rows: [{ name: 'a' }], fetchedAt: '2026-10-31T09:59:00.000Z' } as SlotData }}
        now={NOW} fixedHeight />,
    );
    expect(container.querySelector('[data-part="fit"]')).toBeNull();
  });
});

describe('FitBox', () => {
  /** A body `available` px high and content that needs `needed` px, as a browser would measure them. */
  const measured = (available: number, needed: number) => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.dataset.part === 'fit' ? available : 0; });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(needed);
  };
  const inner = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="fit"] > div')!;

  it('draws content that needs more height scaled down into the body, laid out in a box as much larger', () => {
    measured(80, 100);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(container.querySelector('[data-part="fit"]')!.getAttribute('data-scale')).toBe('0.8');
    expect(inner(container).style.transform).toBe('scale(0.8)');
    expect(inner(container).style.width).toBe('125%');
    expect(inner(container).style.height).toBe('125%');
  });

  it('leaves content that fits at full size', () => {
    measured(120, 100);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(inner(container).style.transform).toBe('');
    expect(inner(container).style.height).toBe('100%');
  });
});
