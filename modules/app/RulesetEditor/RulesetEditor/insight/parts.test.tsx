import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InsightPanel } from './InsightPanel';
import { Badge, Caps } from './parts';
import type { DebugMessage } from './types';

afterEach(cleanup);

describe('side bar parts, as the router draws them', () => {
  it('heading, badge with and without a dot', () => {
    const { container } = render(<><Caps>Errors while running</Caps><Badge tone="warning">not caught</Badge><Badge tone="success" dot>its error port</Badge></>);
    expect(screen.getByText('Errors while running').className).toContain('uppercase');
    const [warn, ok] = Array.from(container.querySelectorAll('span'));
    expect(warn.className).toContain('bg-warning-subtle');
    expect(warn.querySelector('span')).toBeNull();
    expect(ok.className).toContain('bg-success-subtle');
    expect(ok.querySelector('span')?.className).toContain('bg-success');
  });

  it('Errors: block names are primary links; a catcher has the arrow icon and a block that caught its own error the green badge with a dot', () => {
    const msgs: DebugMessage[] = [{ seq: 1, ts: 1, flow: 'f', node: 'n1', kind: 'error', text: 'boom' }];
    render(<InsightPanel defaultTab="errors" nodeNames={{ n1: 'A', n2: 'B' }} messages={msgs}
      runs={[{ ts: 1, errors: [{ node: 'n1', message: 'x', caught: 'n2' }, { node: 'n2', message: 'y', caught: 'n2' }] }]} />);
    const link = screen.getAllByTitle('Show this block')[0];
    expect(link.className).toContain('text-primary');
    expect(screen.getByTestId('insight-caught-link').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('insight-caught-rows')).toHaveTextContent('its error port');
    expect(screen.getByText('not caught')).toBeInTheDocument();
  });

  it('Busiest: the bar is the router\'s 3 px line and the sort buttons keep the 40 px height', () => {
    render(<InsightPanel defaultTab="busiest" nodeNames={{ n1: 'A' }} nodeStats={{ n1: { in: 2, out: 2, errors: 0, avgMs: 1 } }} />);
    expect(screen.getByTestId('insight-perf-in').className).toContain('min-h-10');
    expect(screen.getByTestId('insight-perf-rows').querySelector('td [aria-hidden=true]')?.className).toContain('h-[3px]');
  });
});
