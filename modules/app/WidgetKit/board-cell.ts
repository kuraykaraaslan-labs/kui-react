// The card's "Small screens" settings for the GRID CELL that holds it (next-boilerplate phase 21.4).
// WidgetCard puts the same classes on its own <section>, but on a board the grid item is the cell
// around the card: `order` on the card moves nothing, and a hidden card leaves an empty cell and its
// gap behind. Pure; kept out of settings/ and templates/ (not part of next-boilerplate's server copy).

import type { CSSProperties } from 'react';
import type { CardSettings } from './settings/types';

/** The classes are spelled out in full so Tailwind sees them. */
export function cardCellResponsive(card: Pick<CardSettings, 'hideOnMobile' | 'hideOnDesktop' | 'mobileOrder'> | null | undefined): {
  className: string;
  style: CSSProperties;
} {
  const order = typeof card?.mobileOrder === 'number' ? card.mobileOrder : undefined;
  const className = [
    card?.hideOnMobile && 'max-lg:hidden',
    card?.hideOnDesktop && 'lg:hidden',
    order !== undefined && 'max-lg:[order:var(--wk-mo)]',
  ].filter(Boolean).join(' ');
  return { className, style: order !== undefined ? ({ '--wk-mo': order } as CSSProperties) : {} };
}
