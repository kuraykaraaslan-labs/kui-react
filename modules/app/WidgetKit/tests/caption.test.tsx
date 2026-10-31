import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { SlotData } from '../kind';
import { captionOf } from '../views/caption';
import { PlacementCard } from '../PlacementCard';
import { STAT_VALUE, STAT_VALUE_KIND } from '../templates/stat-value';
import { STAT_VALUE_VIEW } from '../views/StatValueView';
import { STATE_VIEW } from '../views/StateView';
import { STATE, STATE_KIND } from '../templates/state';

/** A caption that only repeats the card's title drawn above it costs a line in a small card and says nothing new. */
const NOW = Date.parse('2026-10-31T10:00:00.000Z');
const value = (v: unknown, label?: string): SlotData => ({ shape: 'value', value: v, fetchedAt: '2026-10-31T09:59:00.000Z', ...(label ? { meta: { label } } : {}) } as SlotData);

describe('captionOf', () => {
  it('leaves out a caption equal to the shown title, trimmed and without case', () => {
    expect(captionOf('Active alarms', { title: 'Active alarms', titleShown: true })).toBeUndefined();
    expect(captionOf(' active ALARMS ', { title: 'Active alarms', titleShown: true })).toBeUndefined();
  });

  it('keeps a different caption, and any caption when the header does not show the title', () => {
    expect(captionOf('Place them on Sites & Assets', { title: 'Devices with a place but no site', titleShown: true })).toBe('Place them on Sites & Assets');
    expect(captionOf('Active alarms', { title: 'Active alarms', titleShown: false })).toBe('Active alarms');
    expect(captionOf('Active alarms', { titleShown: true })).toBe('Active alarms');
    expect(captionOf(undefined, { title: 'x', titleShown: true })).toBeUndefined();
  });
});

describe('cards', () => {
  const stat = (title: string, card: Record<string, unknown>, data = value(70, 'Active alarms')) => render(
    <PlacementCard title={title} template={STAT_VALUE} slots={STAT_VALUE_KIND.slots} view={STAT_VALUE_VIEW} settings={{ $card: card }}
      data={{ value: data }} now={NOW} />,
  ).container;
  const labels = (c: HTMLElement) => [...c.querySelectorAll('section > div span')].map((e) => e.textContent).filter((t) => t === 'Active alarms');

  it('a stat whose source label is its title draws the title once', () => {
    const c = stat('Active alarms', {});
    expect(c.querySelector('h3')?.textContent).toBe('Active alarms');
    expect(labels(c)).toEqual([]);
    expect(c.textContent).toContain('70');
  });

  it('keeps the label when the card hides its title', () => {
    expect(labels(stat('Active alarms', { showTitle: false }))).toEqual(['Active alarms']);
  });

  it('a lamp whose label is its title draws the title once', () => {
    const c = render(
      <PlacementCard title="Phase 1" template={STATE} slots={STATE_KIND.slots} view={STATE_VIEW}
        settings={{ layout: 'lamp', label: 'Phase 1' }} data={{ value: value(1) }} now={NOW} />,
    ).container;
    expect(c.textContent?.match(/Phase 1/g)).toHaveLength(1);
  });
});
