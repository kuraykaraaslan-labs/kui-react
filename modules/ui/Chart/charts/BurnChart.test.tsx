import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BurnChart } from './BurnChart';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 720, height: 400, x: 0, y: 0, top: 0, left: 0, right: 720, bottom: 400, toJSON() {} });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const D = 24 * 3_600_000;
const T0 = Date.UTC(2026, 9, 1);
const budget = Array.from({ length: 8 }, (_, i) => ({ t: T0 + i * D, value: 100 - i * 8 }));
const burn = Array.from({ length: 8 }, (_, i) => ({ t: T0 + i * D, value: i === 6 ? 7.2 : 1.1 + i * 0.1 }));
const base = { budget, burnRate: burn, locale: 'en-US', timeZone: 'UTC' };

describe('BurnChart', () => {
  it('draws the budget line, the burn-rate line and both panels', () => {
    const { container } = render(<BurnChart {...base} />);
    expect(container.querySelector('[data-series="budget"]')).not.toBeNull();
    expect(container.querySelector('[data-series="burn"]')).not.toBeNull();
    expect(container.querySelector('[data-panel="budget"]')).not.toBeNull();
    expect(container.querySelector('[data-panel="burn"]')).not.toBeNull();
  });

  it('draws only the panel it has data for', () => {
    const { container, rerender } = render(<BurnChart budget={budget} locale="en-US" timeZone="UTC" />);
    expect(container.querySelector('[data-panel="burn"]')).toBeNull();
    rerender(<BurnChart burnRate={burn} locale="en-US" timeZone="UTC" />);
    expect(container.querySelector('[data-panel="budget"]')).toBeNull();
    expect(container.querySelector('[data-panel="burn"]')).not.toBeNull();
  });

  it('draws the default four tiers as labelled thresholds', () => {
    const { container } = render(<BurnChart {...base} />);
    const labels = [...container.querySelectorAll('[data-threshold-label]')].map((n) => n.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Page 14.4× · 1 h', 'Page 6× · 6 h', 'Ticket 3× · 1 d', 'Ticket 1× · 3 d']));
    expect(container.querySelectorAll('[data-part="tier-band"]').length).toBeGreaterThan(0);
  });

  it('takes custom tiers, or none', () => {
    const { container, rerender } = render(<BurnChart {...base} tiers={[{ id: 'x', label: 'Alert', rate: 2, tone: 'error' }]} />);
    expect([...container.querySelectorAll('[data-threshold-label]')].map((n) => n.textContent)).toContain('Alert 2×');
    expect(screen.queryByText(/Page 14.4×/)).toBeNull();
    rerender(<BurnChart {...base} tiers={[]} />);
    expect(container.querySelectorAll('[data-threshold]').length).toBe(1); // only the budget's zero line
  });

  it('projects the budget to zero, dashed, and labels the date', () => {
    const { container } = render(<BurnChart {...base} />);
    const proj = container.querySelector('[data-series="projection"]')!;
    expect(proj).toHaveAttribute('stroke-dasharray');
    expect(container.querySelector('[data-part="exhaustion"]')).toHaveTextContent(/Budget runs out/);
    expect(screen.getByText(/Budget runs out/, { selector: '[data-part="summary"]' })).toBeInTheDocument();
  });

  it('can hide the projection', () => {
    const { container } = render(<BurnChart {...base} projection={false} />);
    expect(container.querySelector('[data-series="projection"]')).toBeNull();
    expect(container.querySelector('[data-part="exhaustion"]')).toBeNull();
  });

  it('cuts the projection at the window end and says the budget lasts when it does', () => {
    const slow = Array.from({ length: 6 }, (_, i) => ({ t: T0 + i * D, value: 100 - i }));
    const { container } = render(<BurnChart budget={slow} windowEnd={T0 + 30 * D} locale="en-US" timeZone="UTC" />);
    expect(container.querySelector('[data-part="window-end"]')).toHaveTextContent('Window end');
    expect(container.querySelector('[data-part="exhaustion"]')).toBeNull();
    expect(document.querySelector('[data-part="summary"]')).toHaveTextContent('Budget lasts the whole window');
    expect(screen.queryByText(/Page 14.4×/)).toBeNull(); // no burn panel, so no tier legend
  });

  it('says the budget is spent when it is', () => {
    const spent = [{ t: T0, value: 30 }, { t: T0 + D, value: 5 }, { t: T0 + 2 * D, value: -4 }];
    render(<BurnChart budget={spent} locale="en-US" timeZone="UTC" />);
    expect(screen.getByText(/Budget is spent/, { selector: '[data-part="summary"]' })).toBeInTheDocument();
  });

  it('writes a text summary: latest budget and its state, burn rate and the tier it is in', () => {
    render(<BurnChart {...base} />);
    const summary = document.querySelector('[data-part="summary"]')!;
    expect(summary).toHaveTextContent('Error budget remaining: 44% (healthy).');
    expect(summary).toHaveTextContent('Burn rate: 1.8×.');
    expect(summary).toHaveTextContent('At or above the Ticket 1× (3 d) threshold.');
    expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', summary.id);
  });

  it('names the tier a high burn rate is in', () => {
    const hot = [{ t: T0, value: 2 }, { t: T0 + D, value: 15 }];
    render(<BurnChart burnRate={hot} locale="en-US" timeZone="UTC" />);
    expect(document.querySelector('[data-part="summary"]')).toHaveTextContent('Page 14.4× (1 h) threshold');
  });

  it('draws annotations with accessible names and keyboard focus', () => {
    const { container } = render(<BurnChart {...base} annotations={[{ id: 'd1', t: T0 + 3 * D, label: 'Deploy 4.12.0', tone: 'info' }, { id: 'i1', t: T0 + 6 * D, label: 'Incident 218', tone: 'error' }]} />);
    const notes = container.querySelectorAll('[data-annotation]');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toHaveAttribute('tabindex', '0');
    expect(notes[0].getAttribute('aria-label')).toContain('Deploy 4.12.0');
    expect(document.querySelector('[data-part="summary"]')).toHaveTextContent('2 annotations.');
  });

  it('shows a tooltip with both values on hover and clears it on leave', () => {
    const { container } = render(<BurnChart {...base} />);
    const svg = container.querySelector('svg')!;
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 80 });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Error budget remaining');
    expect(tip).toHaveTextContent('Burn rate');
    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('steps through the points with the arrow keys, Home, End and Escape', () => {
    render(<BurnChart {...base} />);
    const group = screen.getByRole('group');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('100%');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('92%');
    fireEvent.keyDown(group, { key: 'End' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('44%');
    fireEvent.keyDown(group, { key: 'ArrowRight' }); // clamped
    expect(screen.getByRole('tooltip')).toHaveTextContent('44%');
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('lists a legend of the lines and tiers', () => {
    render(<BurnChart {...base} />);
    const legend = screen.getByRole('list', { name: 'Burn-rate tiers' });
    expect(legend).toHaveTextContent('Error budget remaining');
    expect(legend).toHaveTextContent('Projected at the recent pace');
    expect(legend).toHaveTextContent('Page 14.4× (1 h)');
  });

  it('shows an empty state and takes its text from messages', () => {
    const { rerender } = render(<BurnChart />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    rerender(<BurnChart {...base} messages={{ label: 'Consommation du budget', budget: 'Budget restant' }} />);
    expect(screen.getByRole('group', { name: 'Consommation du budget' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Burn-rate tiers' })).toHaveTextContent('Budget restant');
  });
});
