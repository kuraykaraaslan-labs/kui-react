import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CitationChip, EvidenceList, CitedText, evidenceDomId, type EvidenceItem } from './index';

const items: EvidenceItem[] = [
  { id: 'log-1', kind: 'log', title: 'checkout 500 burst', summary: '412 errors in 2 min', href: '/logs?q=abc', source: 'loki', timestamp: 1_700_000_000_000 },
  { id: 'dep-9', kind: 'deploy', title: 'Release 4.12.0', timestamp: '2026-10-18T08:00:00Z' },
  { id: 'x', kind: 'custom-kind', title: 'Something else', index: 7 },
];

describe('CitationChip', () => {
  it('is a link to the matching evidence row, named with its title', () => {
    render(<CitationChip index={2} evidenceId="dep-9" title="Release 4.12.0" />);
    const link = screen.getByRole('link', { name: 'Evidence 2: Release 4.12.0' });
    expect(link).toHaveAttribute('href', `#${evidenceDomId('evidence', 'dep-9')}`);
    expect(link).toHaveTextContent('[2]');
  });

  it('honours an href, a prefix and onSelect', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<CitationChip index={1} evidenceId="a" idPrefix="ai" onSelect={onSelect} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '#ai-a');
    fireEvent.click(screen.getByRole('link'));
    expect(onSelect).toHaveBeenCalledWith('a');
    rerender(<CitationChip index={1} evidenceId="a" href="/elsewhere" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/elsewhere');
  });

  it('renders a dropped citation as text with a name that says so, not as a link', () => {
    render(<CitationChip index={4} evidenceId="4" status="dropped" />);
    expect(screen.queryByRole('link')).toBeNull();
    const chip = screen.getByLabelText(/no matching evidence/);
    expect(chip).toHaveAttribute('data-citation', 'dropped');
    expect(chip).toHaveTextContent('[4]');
  });
});

describe('EvidenceList', () => {
  it('lists items in order with numbers, kind labels and an openable title', () => {
    render(<EvidenceList items={items} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('[1]');
    expect(rows[0]).toHaveTextContent('Log');
    expect(within(rows[0]).getByRole('link', { name: /checkout 500 burst/ })).toHaveAttribute('href', '/logs?q=abc');
    expect(rows[2]).toHaveTextContent('[7]');
    expect(rows[2]).toHaveTextContent('custom-kind');
    expect(rows[0].id).toBe('evidence-log-1');
  });

  it('gives a row without a link an Open button when onOpen is set', () => {
    const onOpen = vi.fn();
    render(<EvidenceList items={items} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Release 4.12.0' }));
    expect(onOpen).toHaveBeenCalledWith(items[1]);
    fireEvent.click(screen.getByRole('link', { name: /checkout 500 burst/ }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
  });

  it('highlights the active row', () => {
    render(<EvidenceList items={items} activeId="dep-9" />);
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('data-active', 'true');
    expect(screen.getAllByRole('listitem')[0]).not.toHaveAttribute('data-active');
  });

  it('shows dropped claims apart, with text that says they were removed', () => {
    const { container } = render(
      <EvidenceList items={items} droppedClaims={[{ id: 'c1', text: 'The database was down.', reason: 'no citation' }, { id: 'c2', text: 'Cache is cold.' }]} />,
    );
    const dropped = container.querySelector('[data-part="dropped"]')!;
    expect(dropped).toHaveAttribute('role', 'status');
    expect(dropped).toHaveTextContent('Dropped claims');
    expect(dropped).toHaveTextContent('2 claims removed');
    expect(dropped).toHaveTextContent('The database was down.');
    expect(dropped).toHaveTextContent('(Reason: no citation)');
  });

  it('shows an empty message and no dropped block when there is nothing', () => {
    const { container } = render(<EvidenceList items={[]} />);
    expect(screen.getByText('No evidence was cited.')).toBeInTheDocument();
    expect(container.querySelector('[data-part="dropped"]')).toBeNull();
  });

  it('takes its text from messages and can hide the heading', () => {
    render(<EvidenceList items={items} heading={false} messages={{ kinds: { log: 'Journal' } as never, heading: 'Preuves' }} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('region', { name: 'Preuves' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Journal');
  });
});

describe('CitedText', () => {
  it('turns [n] into chips and marks a number with no evidence as dropped', () => {
    const { container } = render(<CitedText text="Errors began after the deploy [2] and hit checkout [1]. Cache was cold [9]." evidence={items} />);
    expect(screen.getByRole('link', { name: /Evidence 2: Release/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Evidence 1: checkout/ })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-citation="dropped"]')).toHaveLength(1);
    expect(container.textContent).toContain('Errors began after the deploy');
  });

  it('matches by the item index, not the position', () => {
    render(<CitedText text="See [7]." evidence={items} />);
    expect(screen.getByRole('link', { name: /Evidence 7: Something else/ })).toBeInTheDocument();
  });
});
