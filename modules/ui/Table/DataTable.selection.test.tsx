import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, AdvancedDataTable } from './index';
import type { Column, DataTableFetchArgs } from './types';

type Row = { id: string; name: string; status: string };

const ROWS: Row[] = [
  { id: 'a', name: 'Acme', status: 'active' },
  { id: 'g', name: 'Globex', status: 'archived' },
  { id: 'i', name: 'Initech', status: 'active' },
];
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status' },
];

function rowOf(name: string) {
  return screen.getByText(name).closest('tr')!;
}
function checkboxOf(name: string) {
  return within(rowOf(name)).getByRole('checkbox');
}
function selectAll() {
  return screen.getByRole('checkbox', { name: 'Select all shown rows' });
}

describe('DataTable selection', () => {
  it('without selectable there is no checkbox column (unchanged)', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('selects by row id, marks the row and does not fire onRowClick', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        selectable onSelectionChange={onSelectionChange} onRowClick={onRowClick} />,
    );
    await user.click(checkboxOf('Globex'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['g']);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(rowOf('Globex')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('keeps the selection on the same rows after sorting', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false} selectable />);
    await user.click(checkboxOf('Acme'));
    await user.click(screen.getByText('Name')); // asc
    await user.click(screen.getByText('Name')); // desc: Acme moves to the bottom
    expect(checkboxOf('Acme')).toBeChecked();
    expect(checkboxOf('Initech')).not.toBeChecked();
  });

  it('the header checkbox selects the shown page only and goes indeterminate', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} pageSize={2} searchable={false}
        selectable onSelectionChange={onSelectionChange} />,
    );
    await user.click(checkboxOf('Acme'));
    expect((selectAll() as HTMLInputElement).indeterminate).toBe(true);

    await user.click(selectAll());
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'g']);

    // Page 2: Initech is not selected; selecting it keeps page 1's rows.
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(checkboxOf('Initech')).not.toBeChecked();
    await user.click(selectAll());
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'g', 'i']);

    // Clearing page 2 leaves page 1 alone.
    await user.click(selectAll());
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'g']);
  });

  it('honours controlled selectedRowIds and clears through the summary button', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        selectable selectedRowIds={['i']} onSelectionChange={onSelectionChange} />,
    );
    expect(checkboxOf('Initech')).toBeChecked();
    await user.click(checkboxOf('Acme'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['i', 'a']);
    expect(checkboxOf('Acme')).not.toBeChecked(); // parent did not update
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('uses rowId over row.id', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        selectable rowId={(r) => r.name} onSelectionChange={onSelectionChange} />,
    );
    await user.click(checkboxOf('Acme'));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['Acme']);
  });

  it('keeps the selection across server pages', async () => {
    const user = userEvent.setup();
    const all: Row[] = [...ROWS, { id: 'u', name: 'Umbrella', status: 'active' }];
    const fetchPage = async ({ page, pageSize }: DataTableFetchArgs) => ({
      rows: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    });
    render(<DataTable columns={COLUMNS} mode="server" fetchPage={fetchPage} pageSize={2} searchable={false} selectable />);
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
    await user.click(checkboxOf('Acme'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText('Initech')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /previous/i }));
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
    expect(checkboxOf('Acme')).toBeChecked();
  });
});

describe('DataTable expandable rows', () => {
  const renderExpanded = (r: Row) => (r.status === 'active' ? <p>Details of {r.name}</p> : null);

  it('gives a toggle only to rows with details and opens a full-width detail row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        selectable renderExpanded={renderExpanded} onRowClick={onRowClick} />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    expect(within(rowOf('Globex')).queryByRole('button', { name: 'Expand row' })).toBeNull();

    const toggle = within(rowOf('Acme')).getByRole('button', { name: 'Expand row' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(onRowClick).not.toHaveBeenCalled();

    const detail = screen.getByText('Details of Acme').closest('td')!;
    expect(detail).toHaveAttribute('colspan', '4');
    const collapse = within(rowOf('Acme')).getByRole('button', { name: 'Collapse row' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse.getAttribute('aria-controls')).toBe(detail.closest('tr')!.id);

    await user.click(collapse);
    expect(screen.queryByText('Details of Acme')).toBeNull();
  });
});

describe('DataTable stickyHeader', () => {
  it('makes the header sticky inside a capped scroll region', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false} stickyHeader />,
    );
    expect(container.querySelector('thead')).toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('region')).toHaveClass('overflow-auto', 'max-h-80');
  });
});

describe('AdvancedDataTable (deprecated wrapper)', () => {
  it('still reports positions in rows and shows _expanded content', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const rows = [
      { name: 'Alice', role: 'Admin', _expanded: <p>Alice details</p> },
      { name: 'Bob', role: 'Editor' },
    ];
    render(
      <AdvancedDataTable
        columns={[{ key: 'name', header: 'Name' }, { key: 'role', header: 'Role' }]}
        rows={rows}
        selectable
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(within(rowOf('Bob')).getByRole('checkbox'));
    expect(onSelectionChange).toHaveBeenLastCalledWith([1]);
    await user.click(screen.getByRole('button', { name: 'Expand row' }));
    expect(screen.getByText('Alice details')).toBeInTheDocument();
  });

  it('has no expand column when no row has _expanded', () => {
    render(
      <AdvancedDataTable
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ name: 'Alice' }]}
      />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });
});
