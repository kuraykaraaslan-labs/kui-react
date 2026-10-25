import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BusiestTab } from './BusiestTab';

afterEach(cleanup);

// the kit DataTable's headings order the 30 busiest blocks; the router's LuCI editor does the same (debugperf.js)
const STATS = { a: { in: 9, out: 7, errors: 0, avgMs: 0.5 }, b: { in: 1, out: 1, errors: 0, avgMs: 2 } };
const NAMES = { a: 'compare', b: 'event' };
const rows = () => within(screen.getByTestId('insight-perf-rows')).getAllByRole('row').slice(1).map((r) => r.textContent);
const heading = (name: RegExp) => screen.getByRole('columnheader', { name });

describe('BusiestTab headings', () => {
  it('turn the sorted counter around, order by name, and a sort button goes back to its counter', () => {
    render(<BusiestTab nodeStats={STATS} nodeNames={NAMES} />);
    expect(rows()[0]).toContain('compare');
    expect(heading(/^In/)).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(heading(/^In/)).getByRole('button'));
    expect(rows()[0]).toContain('event');
    expect(heading(/^In/)).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(heading(/^Block/)).getByRole('button'));
    expect(rows().map((r) => r?.slice(0, 5))).toEqual(['compa', 'event']);
    expect(screen.getByTestId('insight-perf-in')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(heading(/^Block/)).getByRole('button'));
    expect(rows()[0]).toContain('event');
    fireEvent.click(screen.getByTestId('insight-perf-ms'));
    expect(heading(/^ms/)).toHaveAttribute('aria-sort', 'descending');
    expect(rows()[0]).toContain('event');
  });
});
