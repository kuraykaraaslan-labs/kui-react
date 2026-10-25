import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DataTable } from './DataTable';
import { builtInDatePresets, filterChipText, isFilterValueActive, matchFilterField } from './core/filterPanel';
import { DEFAULT_MESSAGES, type Column, type DataTableFetchArgs, type DataTableFilterField, type DataTableQuery } from './types';

// Phase 11 (DataTable adoption): manual mode, server mode for real APIs, live rows, columns,
// sorting, filter chips / presets / number range, shell, card layout and messages.

type Order = { id: string; customer: string; amount: number; status: string; createdAt: string };

const ORDERS: Order[] = [
  { id: 'o1', customer: 'Acme', amount: 120, status: 'paid', createdAt: '2026-10-01' },
  { id: 'o2', customer: 'Globex', amount: 40, status: 'open', createdAt: '2026-10-05' },
  { id: 'o3', customer: 'Initech', amount: 300, status: 'paid', createdAt: '2026-10-09' },
];

const COLUMNS: Column<Order>[] = [
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'amount', header: 'Amount', sortable: true, sortKey: 'total_amount', align: 'right' },
  { key: 'status', header: 'Status', hideBelow: 'md' },
];

const STATUS: DataTableFilterField<Order> = {
  id: 'status',
  label: 'Status',
  type: 'select',
  options: [{ label: 'Paid', value: 'paid' }, { label: 'Open', value: 'open' }],
};

function bodyNames() {
  return screen.queryAllByRole('row').slice(1).map((r) => within(r).queryAllByRole('cell')[0]?.textContent);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('mode="manual"', () => {
  it('reports the first query on mount and every change, with outward sort keys', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable mode="manual" columns={COLUMNS} rows={ORDERS} total={30} pageSize={10}
        searchable={false} onQueryChange={onQueryChange} />,
    );
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange.mock.calls[0][0]).toMatchObject({ page: 1, pageSize: 10, sort: [], search: '' });

    await user.click(screen.getByRole('button', { name: /amount/i }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: [{ key: 'total_amount', dir: 'asc' }], page: 1 }),
    );
    // The header still shows the sort by its column key.
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('a controlled query is reported on change and follows the host', async () => {
    const user = userEvent.setup();
    const seen: DataTableQuery[] = [];
    function Host() {
      const [query, setQuery] = useState<Partial<DataTableQuery>>({ page: 1, sort: [] });
      return (
        <DataTable mode="manual" columns={COLUMNS} rows={ORDERS} total={30} searchable={false}
          query={query} onQueryChange={(q) => { seen.push(q); setQuery(q); }} />
      );
    }
    render(<Host />);
    await user.click(screen.getByRole('button', { name: /customer/i }));
    expect(seen.at(-1)?.sort).toEqual([{ key: 'customer', dir: 'asc' }]);
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending');
  });

  it('keeps the rows under a spinner while loading and shows the error with Retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender, container } = render(
      <DataTable mode="manual" columns={COLUMNS} rows={ORDERS} total={3} loading searchable={false} />,
    );
    expect(bodyNames()).toEqual(['Acme', 'Globex', 'Initech']);
    expect(container.querySelector('[data-part="busy"]')).not.toBeNull();

    rerender(<DataTable mode="manual" columns={COLUMNS} rows={[]} total={0} error="Server down" onRetry={onRetry} searchable={false} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Server down');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('applying the filter panel goes back to page 1 and reports the values once', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable mode="manual" columns={COLUMNS} rows={ORDERS} total={30} searchable={false}
        filterFields={[STATUS]} defaultFiltersOpen onQueryChange={onQueryChange} />,
    );
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    onQueryChange.mockClear();
    await user.selectOptions(screen.getByLabelText('Status'), 'paid');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filterValues: { status: 'paid' } }));
  });
});

describe('live rows', () => {
  it('marks new and leaving rows and moves focus between rows from the keyboard', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable mode="static" columns={COLUMNS} rows={ORDERS} searchable={false} onRowClick={onRowClick}
        rowState={(r) => (r.id === 'o1' ? 'new' : r.id === 'o2' ? 'leaving' : undefined)} />,
    );
    const first = screen.getByText('Acme').closest('tr')!;
    expect(first).toHaveAttribute('data-state', 'new');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('Globex').closest('tr')!.className).toContain('opacity-40');
    first.focus();
    await user.keyboard('{End}');
    expect(screen.getByText('Initech').closest('tr')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(ORDERS[2], expect.anything());
  });

  it('a refused row keeps its checkbox disabled with the reason, and select-all skips it', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable mode="static" columns={COLUMNS} rows={ORDERS} searchable={false} selectable
        isRowSelectable={(r) => (r.status === 'open' ? 'Open orders cannot be archived' : true)}
        rowSelectLabel={(r) => `Select ${r.customer}`} onSelectionChange={onSelectionChange} />,
    );
    const refused = screen.getByRole('checkbox', { name: 'Select Globex' });
    expect(refused).toBeDisabled();
    expect(refused).toHaveAttribute('title', 'Open orders cannot be archived');
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown rows' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['o1', 'o3']);
  });
});

describe('mode="server" for real APIs', () => {
  it('refetches the current page when reloadKey changes and passes an AbortSignal', async () => {
    const fetchPage = vi.fn(async (args: DataTableFetchArgs) => ({ rows: ORDERS, total: 3, args }));
    const { rerender } = render(
      <DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} reloadKey={1} />,
    );
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    rerender(<DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} reloadKey={2} />);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
  });

  it('aborts the older request when a newer query starts', async () => {
    const signals: AbortSignal[] = [];
    const fetchPage = vi.fn((args: DataTableFetchArgs) => {
      signals.push(args.signal!);
      return new Promise<{ rows: Order[]; total: number }>(() => {});
    });
    const { rerender } = render(<DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} reloadKey="a" />);
    rerender(<DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} reloadKey="b" />);
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('sends the outward sort key and keeps the rows on screen while the next page loads', async () => {
    const user = userEvent.setup();
    let resolveNext: ((v: { rows: Order[]; total: number }) => void) | null = null;
    const fetchPage = vi.fn((args: DataTableFetchArgs) =>
      args.sort.length === 0
        ? Promise.resolve({ rows: ORDERS, total: 3 })
        : new Promise<{ rows: Order[]; total: number }>((r) => { resolveNext = r; }),
    );
    const onLoaded = vi.fn();
    const { container } = render(
      <DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} onLoaded={onLoaded} searchable={false} />,
    );
    await screen.findByText('Acme');
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ total: 3 }));
    await user.click(screen.getByRole('button', { name: /amount/i }));
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ sort: [{ key: 'total_amount', dir: 'asc' }] }));
    // Still the old rows, under the overlay.
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(container.querySelector('[data-part="busy"]')).not.toBeNull();
    await act(async () => resolveNext?.({ rows: [ORDERS[1]], total: 1 }));
    expect(bodyNames()).toEqual(['Globex']);
  });

  it('waits for a pause in typing before searching', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchPage = vi.fn(async () => ({ rows: ORDERS, total: 3 }));
    render(<DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} searchDebounceMs={300} />);
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'a' } });
    fireEvent.change(box, { target: { value: 'ac' } });
    fireEvent.change(box, { target: { value: 'acm' } });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(350); });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'acm', page: 1 }));
  });

  it('the error row retries the same page', async () => {
    const user = userEvent.setup();
    const fetchPage = vi.fn()
      .mockRejectedValueOnce(new Error('Gateway timeout'))
      .mockResolvedValue({ rows: ORDERS, total: 3 });
    render(<DataTable mode="server" columns={COLUMNS} fetchPage={fetchPage} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Gateway timeout');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Acme')).toBeInTheDocument();
  });
});

describe('columns and sorting', () => {
  it('hides a column below its breakpoint, sets widths and renders a footer row', () => {
    const columns: Column<Order>[] = [
      { key: 'customer', header: 'Customer', width: '12rem', footer: 'Total' },
      { key: 'amount', header: 'Amount', align: 'right', footer: '460' },
      { key: 'status', header: 'Status', hideBelow: 'md' },
    ];
    const { container } = render(<DataTable mode="static" columns={columns} rows={ORDERS} searchable={false} />);
    const [customer, , status] = screen.getAllByRole('columnheader');
    expect(customer.getAttribute('style')).toContain('width: 12rem');
    expect(status.className).toContain('hidden md:table-cell');
    const footer = container.querySelector('tfoot')!;
    expect(within(footer as HTMLElement).getByText('Total')).toBeInTheDocument();
    expect(within(footer as HTMLElement).getByText('460')).toBeInTheDocument();
  });

  it('a sortable header is a button; multiSort={false} keeps one sort column even with shift', async () => {
    const user = userEvent.setup();
    render(<DataTable mode="static" columns={COLUMNS} rows={ORDERS} searchable={false} multiSort={false} />);
    await user.click(screen.getByRole('button', { name: /customer/i }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: /amount/i }));
    await user.keyboard('{/Shift}');
    const [customer, amount] = screen.getAllByRole('columnheader');
    expect(customer).toHaveAttribute('aria-sort', 'none');
    expect(amount).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('filters: chips, presets, number range, defaults', () => {
  const AMOUNT: DataTableFilterField<Order> = { id: 'amount', label: 'Amount', type: 'numberrange' };

  it('number ranges: active with either end, match inclusively, chip text', () => {
    expect(isFilterValueActive(AMOUNT, { min: null, max: null })).toBe(false);
    expect(isFilterValueActive(AMOUNT, { min: 50, max: null })).toBe(true);
    expect(matchFilterField(AMOUNT, ORDERS[0], { min: 100, max: 120 })).toBe(true);
    expect(matchFilterField(AMOUNT, ORDERS[1], { min: 100, max: null })).toBe(false);
    expect(filterChipText(AMOUNT, { min: 50, max: null })).toBe('Amount: ≥ 50');
    expect(filterChipText(STATUS, 'paid')).toBe('Status: Paid');
  });

  it('built-in date presets are relative to today', () => {
    const presets = builtInDatePresets(DEFAULT_MESSAGES, new Date(2026, 9, 25));
    expect(presets.map((p) => [p.label, p.from, p.to])).toEqual([
      ['Today', '2026-10-25', '2026-10-25'],
      ['Last 7 days', '2026-10-19', '2026-10-25'],
      ['Last 30 days', '2026-09-26', '2026-10-25'],
      ['This month', '2026-10-01', '2026-10-25'],
      ['Last month', '2026-09-01', '2026-09-30'],
    ]);
  });

  it('a field defaultValue applies on mount, shows as a chip, and the chip removes it', async () => {
    const user = userEvent.setup();
    render(
      <DataTable mode="static" columns={COLUMNS} rows={ORDERS} searchable={false}
        filterFields={[{ ...STATUS, defaultValue: 'paid' }, AMOUNT]} />,
    );
    expect(bodyNames()).toEqual(['Acme', 'Initech']);
    const chips = screen.getByRole('group', { name: 'Active filters' });
    expect(within(chips).getByText('Status: Paid')).toBeInTheDocument();
    await user.click(within(chips).getByRole('button', { name: 'Remove filter Status: Paid' }));
    expect(bodyNames()).toEqual(['Acme', 'Globex', 'Initech']);
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
  });

  it('"Clear all" clears the panel and the column filters', async () => {
    const user = userEvent.setup();
    const columns: Column<Order>[] = [
      { key: 'customer', header: 'Customer' },
      { key: 'status', header: 'Status', filter: { kind: 'select', options: [{ label: 'Paid', value: 'paid' }] } },
    ];
    render(
      <DataTable mode="static" columns={columns} rows={ORDERS} searchable={false}
        filterFields={[AMOUNT]} defaultFilterValues={{ amount: { min: 100, max: null } }} />,
    );
    expect(bodyNames()).toEqual(['Acme', 'Initech']);
    // A column filter chip appears next to the panel chip once a header filter is set.
    await user.click(screen.getByRole('button', { name: /filter status/i }));
    await user.selectOptions(screen.getByRole('combobox'), 'paid');
    await user.click(within(screen.getByRole('dialog', { name: 'Filter Status' })).getByRole('button', { name: 'Apply' }));
    const chips = await screen.findByRole('group', { name: 'Active filters' });
    expect(within(chips).getByText('Status: Paid')).toBeInTheDocument();
    await user.click(within(chips).getByRole('button', { name: 'Clear all' }));
    expect(bodyNames()).toEqual(['Acme', 'Globex', 'Initech']);
  });

  it('date-range presets fill the field', async () => {
    const user = userEvent.setup();
    const onFilterValuesChange = vi.fn();
    render(
      <DataTable mode="static" columns={COLUMNS} rows={ORDERS} searchable={false} defaultFiltersOpen filtersLive
        onFilterValuesChange={onFilterValuesChange}
        filterFields={[{ id: 'createdAt', label: 'Created', type: 'daterange', presets: [{ label: 'Early October', from: '2026-10-01', to: '2026-10-05' }] }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Early October' }));
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({ createdAt: { from: '2026-10-01', to: '2026-10-05' } });
    expect(bodyNames()).toEqual(['Acme', 'Globex']);
  });
});

describe('shell and card layout', () => {
  it('card variant draws the title, subtitle and header actions', () => {
    render(
      <DataTable mode="static" variant="card" columns={COLUMNS} rows={ORDERS} searchable={false}
        title="Orders" subtitle="3 orders" headerActions={<button type="button">New order</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('3 orders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New order' })).toBeInTheDocument();
  });

  it('the card layout renders renderCard per row with a "Sort by" select', async () => {
    const user = userEvent.setup();
    render(
      <DataTable mode="static" layout="cards" columns={COLUMNS} rows={ORDERS} searchable={false}
        renderCard={(r) => <article>{r.customer}</article>} />,
    );
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText('Sort by'), 'customer:desc');
    expect(within(list).getAllByRole('article').map((a) => a.textContent)).toEqual(['Initech', 'Globex', 'Acme']);
  });
});

describe('messages', () => {
  it('every range, empty and pagination string comes from messages', async () => {
    render(
      <DataTable mode="paginated" columns={COLUMNS} rows={ORDERS} pageSize={2}
        messages={{
          showingRange: '{start}-{end} / {total} gösteriliyor',
          nextPage: 'Sonraki sayfa',
          pageNumber: 'Sayfa {page}',
          pagination: 'Sayfalama',
          tableLabel: 'Siparişler',
        }} />,
    );
    expect(screen.getByText('1-2 / 3 gösteriliyor')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sayfalama' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sonraki sayfa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sayfa 2' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Siparişler' })).toBeInTheDocument();
  });

  it('a search that finds nothing names the query', async () => {
    const user = userEvent.setup();
    render(<DataTable mode="static" columns={COLUMNS} rows={ORDERS} messages={{ noResultsFor: 'Nothing for {search}' }} />);
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Nothing for zzz')).toBeInTheDocument();
  });
});
