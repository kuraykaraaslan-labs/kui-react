import { describe, it, expect } from 'vitest';
import { fitRect, normalizeGridCols, resolveOverlaps, scaleLayout, scaleWidth } from '../settings/grid';

const r = (id: string, x: number, y: number, w: number, h = 2) => ({ id, x, y, w, h });

describe('grid columns (12 or 24, as next-boilerplate 21.10)', () => {
  it('normalizes a column count: 24 stays, anything else is 12', () => {
    expect(normalizeGridCols(24)).toBe(24);
    expect(normalizeGridCols(12)).toBe(12);
    expect(normalizeGridCols('24')).toBe(12);
    expect(normalizeGridCols(undefined)).toBe(12);
    expect(normalizeGridCols(36)).toBe(12);
  });

  it('scales a width as the same share, at least 1 and never wider than the grid', () => {
    expect(scaleWidth(3, 12, 24)).toBe(6);
    expect(scaleWidth(1, 24, 12)).toBe(1);
    expect(scaleWidth(12, 12, 24)).toBe(24);
    expect(scaleWidth(30, 12, 24)).toBe(24);
  });

  it('clamps a card into the grid', () => {
    expect(fitRect(r('a', 10, 0, 6), 12)).toMatchObject({ x: 6, w: 6 });
    expect(fitRect(r('a', -2, 0, 40), 24)).toMatchObject({ x: 0, w: 24 });
    const ok = r('a', 1, 0, 3);
    expect(fitRect(ok, 12)).toBe(ok);
  });

  it('12 → 24 doubles every edge exactly; 24 → 12 → back keeps an even layout', () => {
    const twelve = [r('a', 0, 0, 3), r('b', 3, 0, 9), r('c', 0, 2, 12)];
    const twentyFour = scaleLayout(twelve, 12, 24);
    expect(twentyFour).toEqual([r('a', 0, 0, 6), r('b', 6, 0, 18), r('c', 0, 2, 24)]);
    expect(scaleLayout(twentyFour, 24, 12)).toEqual(twelve);
  });

  it('24 → 12 pushes narrow neighbours that land on the same column down, nothing up', () => {
    // Three 1-column cards on 24: b and c both round to column 1 of 12.
    const out = scaleLayout([r('a', 0, 0, 1), r('b', 1, 0, 1), r('c', 2, 0, 1), r('d', 4, 6, 2)], 24, 12);
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 1 });
    expect(out[1]).toMatchObject({ x: 1, y: 0, w: 1 });
    expect(out[2]).toMatchObject({ x: 1, y: 2, w: 1 });
    expect(out[3]).toMatchObject({ x: 2, y: 6, w: 1 });
  });

  it('leaves a layout without overlaps as it is', () => {
    const items = [r('a', 0, 0, 6), r('b', 6, 0, 6), r('c', 0, 5, 12)];
    const out = resolveOverlaps(items);
    out.forEach((o, i) => expect(o).toBe(items[i]));
  });
});
