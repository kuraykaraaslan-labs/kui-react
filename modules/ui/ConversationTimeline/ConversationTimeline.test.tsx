import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConversationTimeline, computeTotals, formatCost, type ConversationStep } from './index';

const steps: ConversationStep[] = [
  { id: 's1', type: 'model', title: 'Plan the investigation', model: 'model-a', tokens: { input: 1200, output: 340, cached: 800 }, cost: 0.0042, durationMs: 1800 },
  { id: 's2', type: 'tool', title: 'search_logs', summary: 'service=checkout level=error', durationMs: 420, input: '{"service":"checkout"}', output: '412 rows' },
  { id: 's3', type: 'tool', title: 'get_trace', status: 'error', durationMs: 90, summary: 'timeout' },
  { id: 's4', type: 'evidence', title: 'checkout 500 burst', summary: 'Evidence [1]' },
  { id: 's5', type: 'model', title: 'Write the answer', tokens: { input: 2000, output: 600 }, cost: 0.0101, durationMs: 2500 },
  { id: 's6', type: 'citation', title: 'Errors began after the 08:00 deploy', citation: { kept: true, index: 1 } },
  { id: 's7', type: 'citation', title: 'The database was down', citation: { kept: false, reason: 'cited nothing' } },
];

describe('computeTotals / formatCost', () => {
  it('sums tokens, cost and time and counts types, citations and errors', () => {
    expect(computeTotals(steps)).toMatchObject({
      steps: 7, inputTokens: 3200, outputTokens: 940, cachedTokens: 800, durationMs: 1800 + 420 + 90 + 2500,
      modelCalls: 2, toolCalls: 2, citationsKept: 1, citationsDropped: 1, errors: 1,
    });
    expect(computeTotals(steps).cost).toBeCloseTo(0.0143);
  });
  it('formats small amounts with more digits', () => {
    expect(formatCost(0.0042, 'USD', 'en-US')).toBe('$0.0042');
    expect(formatCost(12.5, 'USD', 'en-US')).toBe('$12.50');
    expect(formatCost(0.5, 'USD', 'en-US')).toBe('$0.50');
    expect(formatCost(0.0143, 'USD', 'en-US')).toBe('$0.0143');
    expect(formatCost(0, 'USD', 'en-US')).toBe('$0.00');
  });
});

describe('ConversationTimeline', () => {
  it('lists steps in order and names each type in text', () => {
    render(<ConversationTimeline steps={steps} locale="en-US" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[0]).toHaveTextContent('Model call');
    expect(items[1]).toHaveTextContent('Tool call');
    expect(items[3]).toHaveTextContent('Evidence');
    expect(items[5]).toHaveTextContent('Citation kept');
    expect(items[6]).toHaveTextContent('Citation dropped');
  });

  it('shows tokens, cost and time on a step and a total', () => {
    const { container } = render(<ConversationTimeline steps={steps} locale="en-US" />);
    expect(container.querySelectorAll('[data-part="metrics"]')[0]).toHaveTextContent('1.2k in · 340 out · $0.0042 · 1.8 s');
    const totals = container.querySelector('[data-part="totals"]')!;
    expect(totals).toHaveTextContent('Steps7');
    expect(totals).toHaveTextContent('3.2k in · 940 out');
    expect(totals).toHaveTextContent('800 cached');
    expect(totals).toHaveTextContent('$0.0143');
    expect(totals).toHaveTextContent('4.81 s');
    expect(totals).toHaveTextContent('1 failed');
    expect(totals).toHaveTextContent('1 kept');
    expect(totals).toHaveTextContent('1 dropped');
  });

  it('marks a failed step and a dropped citation as text, not only colour', () => {
    render(<ConversationTimeline steps={steps} />);
    const items = screen.getAllByRole('listitem');
    expect(items[2]).toHaveTextContent('(failed)');
    expect(items[2]).toHaveAttribute('data-status', 'error');
    expect(items[6]).toHaveAttribute('data-dropped', 'true');
  });

  it('collapses details behind a button with aria-expanded and aria-controls', () => {
    render(<ConversationTimeline steps={steps} />);
    const item = screen.getAllByRole('listitem')[1];
    const btn = within(item).getByRole('button', { name: 'Show details' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(btn.getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('hidden');
    fireEvent.click(btn);
    expect(within(item).getByRole('button', { name: 'Hide details' })).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveAttribute('hidden');
    expect(panel).toHaveTextContent('412 rows');
    expect(panel).toHaveTextContent('{"service":"checkout"}');
  });

  it('shows why a citation was dropped in its details', () => {
    render(<ConversationTimeline steps={steps} defaultExpandedIds={['s7']} />);
    expect(screen.getAllByRole('listitem')[6]).toHaveTextContent('Reason: cited nothing');
  });

  it('is controllable', () => {
    const onExpandedChange = vi.fn();
    render(<ConversationTimeline steps={steps} expandedIds={[]} onExpandedChange={onExpandedChange} />);
    fireEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button'));
    expect(onExpandedChange).toHaveBeenCalledWith(['s2']);
    expect(within(screen.getAllByRole('listitem')[1]).getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('lets totals be given and hidden', () => {
    const { container, rerender } = render(<ConversationTimeline steps={steps.slice(0, 1)} totals={{ cost: 1.5, steps: 40 }} locale="en-US" />);
    expect(container.querySelector('[data-part="totals"]')).toHaveTextContent('Steps40');
    expect(container.querySelector('[data-part="totals"]')).toHaveTextContent('$1.50');
    rerender(<ConversationTimeline steps={steps} hideTotals />);
    expect(container.querySelector('[data-part="totals"]')).toBeNull();
  });

  it('shows a running step and an empty state', () => {
    const { rerender } = render(<ConversationTimeline steps={[{ id: 'r', type: 'tool', title: 'query_metrics', status: 'running' }]} />);
    expect(screen.getByText('(running)')).toBeInTheDocument();
    rerender(<ConversationTimeline steps={[]} />);
    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument();
  });

  it('takes its text from messages', () => {
    render(<ConversationTimeline steps={steps} messages={{ label: 'Chronologie', types: { model: 'Appel du modèle' } as never }} />);
    expect(screen.getByRole('region', { name: 'Chronologie' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Appel du modèle');
  });
});
