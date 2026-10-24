import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { KeyedTable, type KeyedTableColumn } from './KeyedTable';

type Row = { id: string; name: string; ok: boolean };
const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', ok: true },
  { id: 'b', name: 'Bravo', ok: false },
  { id: 'c', name: 'Charlie', ok: true },
];
const COLUMNS: KeyedTableColumn<Row>[] = [
  { key: 'name', header: 'Name' },
  { key: 'ok', header: 'Ok', hideBelow: 'md', render: (r) => (r.ok ? 'yes' : 'no') },
];

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLTableRowElement;
}

describe('KeyedTable', () => {
  it('renders keyed rows, one row in the tab order, and hides a column below its breakpoint', () => {
    render(<KeyedTable caption="Things" rows={ROWS} getRowKey={(r) => r.id} columns={COLUMNS} />);
    expect(screen.getByRole('table', { name: 'Things' })).toBeInTheDocument();
    expect(rowOf('Alpha')).toHaveAttribute('data-row-key', 'a');
    expect(rowOf('Alpha')).toHaveAttribute('tabindex', '0');
    expect(rowOf('Bravo')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('columnheader', { name: 'Ok' }).className).toContain('hidden md:table-cell');
  });

  it('moves focus with the arrow keys, Home and End, and runs onRowClick with Enter and Space', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<KeyedTable caption="Things" rows={ROWS} getRowKey={(r) => r.id} columns={COLUMNS} onRowClick={onRowClick} />);
    rowOf('Alpha').focus();
    await user.keyboard('{ArrowDown}');
    expect(rowOf('Bravo')).toHaveFocus();
    await user.keyboard('{End}');
    expect(rowOf('Charlie')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(rowOf('Alpha')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(rowOf('Alpha')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0]);
    await user.keyboard('{ArrowDown} ');
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);
    await user.click(screen.getByText('Charlie'));
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[2]);
  });

  it('selects rows, skips a refused one in "select all", and does not run the row click from a checkbox', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <>
          <KeyedTable caption="Things" rows={ROWS} getRowKey={(r) => r.id} columns={COLUMNS} onRowClick={onRowClick}
            selection={{ selected, onChange: setSelected, isSelectable: (r) => (r.ok ? true : 'Not this one'), rowLabel: (r) => `Select ${r.name}` }} />
          <output>{[...selected].join(',')}</output>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Select Bravo' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Bravo' })).toHaveAttribute('title', 'Not this one');
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
    expect(screen.getByRole('status')).toHaveTextContent('a,c');
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(screen.getByRole('status')).toHaveTextContent('c');
    expect(onRowClick).not.toHaveBeenCalled();
    expect(rowOf('Charlie')).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the error with a retry, the loading text and the empty text', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(<KeyedTable caption="T" rows={[]} getRowKey={(r: Row) => r.id} columns={COLUMNS} error="Broken" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Broken');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<KeyedTable caption="T" rows={[]} getRowKey={(r: Row) => r.id} columns={COLUMNS} loading messages={{ loading: 'Wait' }} />);
    expect(screen.getByText('Wait')).toBeInTheDocument();
    rerender(<KeyedTable caption="T" rows={[]} getRowKey={(r: Row) => r.id} columns={COLUMNS} emptyText="Nothing" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });

  it('marks new and leaving rows', () => {
    render(<KeyedTable caption="T" rows={ROWS} getRowKey={(r) => r.id} columns={COLUMNS} rowState={(r) => (r.id === 'a' ? 'new' : r.id === 'b' ? 'leaving' : undefined)} />);
    expect(rowOf('Alpha')).toHaveAttribute('data-state', 'new');
    expect(rowOf('Alpha').className).toContain('bg-primary-subtle');
    expect(rowOf('Bravo').className).toContain('opacity-40');
    expect(rowOf('Charlie')).not.toHaveAttribute('data-state');
  });
});
