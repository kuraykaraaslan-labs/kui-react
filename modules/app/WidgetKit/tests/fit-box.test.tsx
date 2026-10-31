import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import type { SlotData } from '../kind';
import { MIN_FIT_SCALE, fitScale } from '../card-logic';
import { FitBox, fitStyle, settleScale } from '../FitBox';
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
  /**
   * A body `available` px high and content that needs `needed` px, as a browser lays them out: the content box is as high as the
   * style asks (100%, or 100/scale % when scaled) and its content overflows it when it needs more.
   */
  const measured = (available: number, needed: number | ((width: number) => number)) => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const isContent = (el: HTMLElement) => el.parentElement?.dataset.part === 'fit';
    const pct = (v: string) => (v.endsWith('%') ? Number.parseFloat(v) / 100 : 1);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.part === 'fit') return available;
      return isContent(this) ? available * pct(this.style.height) : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (!isContent(this)) return 0;
      const need = typeof needed === 'function' ? needed(300 * pct(this.style.width)) : needed;
      return Math.max(available * pct(this.style.height), need);
    });
  };
  const box = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="fit"]')!;
  const inner = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="fit"] > div')!;

  it('draws content that overflows scaled down into the body, laid out in a box as much larger', () => {
    measured(80, 100);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(box(container).getAttribute('data-scale')).toBe('0.8');
    expect(inner(container).style.transform).toBe('scale(0.8)');
    expect(inner(container).style.width).toBe('125%');
    expect(inner(container).style.height).toBe('125%');
  });

  it('anchors the scaled box to the top-left corner physically, so a right-to-left page does not push it out', () => {
    measured(80, 100);
    const { container } = render(<div dir="rtl"><FitBox><p>Park North 1</p></FitBox></div>);
    expect(inner(container).style.position).toBe('absolute');
    expect(inner(container).style.left).toBe('0px');
    expect(inner(container).style.top).toBe('0px');
    expect(fitStyle(0.8).transformOrigin).toBe('0 0');
  });

  it('leaves content that fits at full size, however large its flexible parts could grow', () => {
    measured(120, 100);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(inner(container).style.transform).toBe('');
    expect(inner(container).style.height).toBe('100%');
    expect(box(container).hasAttribute('data-scale')).toBe(false);
  });

  it('lowers the scale until nothing overflows when a wider box does not wrap less', () => {
    // needs 100 px at any width: 0.8 fits; content that needs more at the wider width than estimated is lowered again
    measured(80, (width) => (width > 300 ? 110 : 100));
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    const s = Number(box(container).getAttribute('data-scale'));
    expect(s).toBeLessThan(0.8);
    expect(80 / s).toBeGreaterThanOrEqual(110 - 1);
  });

  it('stops at the smallest readable scale and lets the body scroll', () => {
    measured(22, 55);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(box(container).getAttribute('data-scale')).toBe(String(MIN_FIT_SCALE));
  });

  it('clips horizontal overflow at the box, so a scrollbar it would add cannot change the height', () => {
    measured(120, 100);
    const { container } = render(<FitBox><p>Park North 1</p></FitBox>);
    expect(box(container).className).toContain('overflow-x-clip');
  });
});

describe('settleScale', () => {
  it('measures the real layout first: content that fits is never scaled', () => {
    const b = document.createElement('div');
    const c = document.createElement('div');
    b.appendChild(c);
    vi.spyOn(b, 'clientHeight', 'get').mockReturnValue(118);
    vi.spyOn(c, 'clientHeight', 'get').mockReturnValue(118);
    vi.spyOn(c, 'scrollHeight', 'get').mockReturnValue(118);
    expect(settleScale(b, c)).toBe(1);
    expect(c.style.height).toBe('100%');
  });

  it('leaves a box that is not laid out yet at full size', () => {
    const b = document.createElement('div');
    const c = document.createElement('div');
    expect(settleScale(b, c)).toBe(1);
  });
});
