import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DescriptionList } from './DescriptionList';
import { BarList } from './BarList';
import { OrgChart, buildOrgTree, type OrgTreeNode } from './OrgChart';

// Phase 11.10–11.12: the collection components next-boilerplate's detail, report and org pages use.

describe('DescriptionList', () => {
  it('draws label/value pairs, a dash for empty values, hides hidden items', () => {
    render(
      <DescriptionList
        items={[
          { label: 'Code', value: 'INV-1001', mono: true },
          { label: 'Customer', value: '' },
          { label: 'Secret', value: 'x', hidden: true },
        ]}
      />,
    );
    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual(['Code', 'Customer']);
    const values = screen.getAllByRole('definition');
    expect(values[0]).toHaveTextContent('INV-1001');
    expect(values[1]).toHaveTextContent('—');
  });

  it('copies a value with the copy button', async () => {
    const user = userEvent.setup();
    // userEvent installs its own clipboard stub; watch that one.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(<DescriptionList items={[{ label: 'Key', value: 'abc-123', copyValue: 'abc-123' }]} messages={{ copy: 'Kopyala' }} />);
    await user.click(screen.getByRole('button', { name: 'Kopyala' }));
    expect(writeText).toHaveBeenCalledWith('abc-123');
  });
});

describe('BarList', () => {
  it('sorts by value, scales bars to the largest value and shows shares', () => {
    const { container } = render(
      <BarList
        ariaLabel="Carts by status"
        showPercent
        items={[
          { label: 'Open', value: 10 },
          { label: 'Paid', value: 30 },
          { label: 'Abandoned', value: 20 },
        ]}
      />,
    );
    const rows = within(screen.getByRole('list', { name: 'Carts by status' })).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent?.split(/\d/)[0])).toEqual(['Paid', 'Abandoned', 'Open']);
    const bars = container.querySelectorAll<HTMLElement>('[data-part="bar-row"] [aria-hidden="true"] > div');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[2].style.width).toMatch(/^33\.3/);
    expect(rows[0]).toHaveTextContent('50.0%');
  });

  it('shows the empty message and respects limit and links', () => {
    const { rerender } = render(<BarList items={[]} emptyMessage="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    rerender(<BarList limit={1} items={[{ label: 'A', value: 1, href: '/a' }, { label: 'B', value: 2, href: '/b' }]} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/b');
  });
});

type Person = { id: string; name: string; managerId: string | null };
const PEOPLE: Person[] = [
  { id: 'ceo', name: 'Ada', managerId: null },
  { id: 'cto', name: 'Grace', managerId: 'ceo' },
  { id: 'cfo', name: 'Katherine', managerId: 'ceo' },
  { id: 'dev', name: 'Linus', managerId: 'cto' },
  { id: 'dev2', name: 'Margaret', managerId: 'cto' },
];

function Chart(props: { highlight?: (n: OrgTreeNode<Person>) => boolean; onNodeClick?: (n: OrgTreeNode<Person>) => void; defaultExpandedDepth?: number }) {
  return (
    <OrgChart<OrgTreeNode<Person>>
      ariaLabel="Organisation"
      roots={buildOrgTree(PEOPLE, (p) => p.id, (p) => p.managerId)}
      getId={(n) => n.node.id}
      getChildren={(n) => n.children}
      renderNode={(n, ctx) => <div data-testid={`card-${n.node.id}`} data-hl={ctx.highlighted}>{n.node.name}</div>}
      {...props}
    />
  );
}

describe('OrgChart', () => {
  it('builds the tree from parent ids and opens the first levels', () => {
    render(<Chart defaultExpandedDepth={1} />);
    expect(screen.getByRole('tree', { name: 'Organisation' })).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
    // Depth 2 is collapsed: its toggle says how many are hidden.
    expect(screen.queryByText('Linus')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand' })).toHaveTextContent('2 more');
  });

  it('a highlight opens the path to the match and marks it', () => {
    render(<Chart defaultExpandedDepth={0} highlight={(n) => n.node.name === 'Margaret'} />);
    expect(screen.getByTestId('card-dev2')).toHaveAttribute('data-hl', 'true');
    expect(screen.getByTestId('card-dev2').closest('[role="treeitem"]')).toHaveAttribute('data-highlighted', 'true');
  });

  it('is a keyboard tree: down opens and enters a child, right moves to a sibling, Enter clicks', async () => {
    const user = userEvent.setup();
    const onNodeClick = vi.fn();
    render(<Chart defaultExpandedDepth={0} onNodeClick={onNodeClick} />);
    const root = screen.getByText('Ada').closest('[role="treeitem"]') as HTMLElement;
    root.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByText('Grace');
    await vi.waitFor(() => expect(screen.getByText('Grace').closest('[role="treeitem"]')).toHaveFocus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Katherine').closest('[role="treeitem"]')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onNodeClick.mock.lastCall![0].node.id).toBe('cfo');
    await user.keyboard('{ArrowUp}');
    expect(root).toHaveFocus();
  });
});
