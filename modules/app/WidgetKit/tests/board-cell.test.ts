import { describe, expect, it } from 'vitest';
import { cardCellResponsive } from '../board-cell';

describe('cardCellResponsive', () => {
  it('no small-screen settings: no classes, no style', () => {
    expect(cardCellResponsive({})).toEqual({ className: '', style: {} });
    expect(cardCellResponsive(null)).toEqual({ className: '', style: {} });
  });

  it('an order sets the class and the variable it reads', () => {
    expect(cardCellResponsive({ mobileOrder: 3 })).toEqual({ className: 'max-lg:[order:var(--wk-mo)]', style: { '--wk-mo': 3 } });
    expect(cardCellResponsive({ mobileOrder: 0 }).style).toEqual({ '--wk-mo': 0 });
  });

  it('a cleared order (null) is no order', () => {
    expect(cardCellResponsive({ mobileOrder: null as unknown as number })).toEqual({ className: '', style: {} });
  });

  it('hides the cell on the side the card is hidden on', () => {
    expect(cardCellResponsive({ hideOnMobile: true }).className).toBe('max-lg:hidden');
    expect(cardCellResponsive({ hideOnDesktop: true }).className).toBe('lg:hidden');
    expect(cardCellResponsive({ hideOnMobile: true, hideOnDesktop: true, mobileOrder: 1 }).className)
      .toBe('max-lg:hidden lg:hidden max-lg:[order:var(--wk-mo)]');
  });
});
