import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './index';
import type { Column, DataTableFilterField } from './types';

// Phase 11.16: the gaps NB's table migration hit (NB docs/phases/43-data-tables "Open after stage D/F").

type Row = { id: string; name: string; group: string; due: number | null; key: string; note?: string };

const ROWS: Row[] = [
  { id: 'a', name: 'Acme', group: 'Finance', due: 3, key: 'billing.read', note: 'reads invoices' },
  { id: 'b', name: 'Bolt', group: 'People', due: null, key: 'users.read' },
  { id: 'c', name: 'Core', group: 'Finance', due: 1, key: 'billing.write' },
  { id: 'd', name: 'Dyne', group: 'People', due: 10, key: 'users.invite' },
];
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'due', header: 'Due', sortable: true },
];

const bodyNames = () =>
  screen.getAllByRole('row').slice(1).filter((r) => r.dataset.rowKey).map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('DataTable gaps (phase 11.16)', () => {
  it('sorts empty values last in both directions, numbers by value', async () => {
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false} />);
    await user.click(screen.getByRole('button', { name: /Due/ }));
    expect(bodyNames()).toEqual(['Core', 'Acme', 'Dyne', 'Bolt']);
    await user.click(screen.getByRole('button', { name: /Due/ }));
    expect(bodyNames()).toEqual(['Dyne', 'Acme', 'Core', 'Bolt']);
  });

  it('searches searchValue, table searchText, and skips searchable: false columns', async () => {
    const user = userEvent.setup();
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Name', searchValue: (r) => `${r.name} ${r.key}` },
      { key: 'group', header: 'Group', searchable: false },
    ];
    render(<DataTable mode="static" rows={ROWS} columns={columns} searchText={(r) => r.note ?? ''} />);
    const box = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(box, 'users.invite');
    expect(bodyNames()).toEqual(['Dyne']);
    await user.clear(box);
    await user.type(box, 'invoices');
    expect(bodyNames()).toEqual(['Acme']);
    await user.clear(box);
    await user.type(box, 'Finance');
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it('groupBy draws a header row per group, groups in first-seen order, sorted within', async () => {
    const user = userEvent.setup();
    render(
      <DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false}
        groupBy={(r) => r.group} renderGroupHeader={(g, rows) => `${g} (${rows.length})`} />,
    );
    const headers = () => screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(headers()).toEqual(['Finance (2)', 'People (2)']);
    expect(screen.getAllByRole('rowheader')[0]).toHaveAttribute('colspan', '2');
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(headers()).toEqual(['Finance (2)', 'People (2)']);
    expect(bodyNames()).toEqual(['Core', 'Acme', 'Dyne', 'Bolt']);
  });

  it('groupBy in the card layout puts a heading before each group of cards', () => {
    render(
      <DataTable mode="static" layout="cards" rows={ROWS} columns={COLUMNS} searchable={false}
        groupBy={(r) => r.group} renderCard={(r) => <p>{r.name}</p>} />,
    );
    const lists = screen.getAllByRole('list');
    expect(lists.map((l) => l.getAttribute('aria-label'))).toEqual(['Finance', 'People']);
    expect(within(lists[1]).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bolt', 'Dyne']);
    expect(screen.getAllByText(/^(Finance|People)$/, { selector: 'h4' })).toHaveLength(2);
  });

  it('render gets the source index and id, unchanged by sorting', async () => {
    const user = userEvent.setup();
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Name', sortable: true, render: (r, { index, id }) => `${r.name}#${index}@${id}` },
    ];
    render(<DataTable mode="static" rows={ROWS} columns={columns} searchable={false} />);
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(bodyNames()).toEqual(['Dyne#3@d', 'Core#2@c', 'Bolt#1@b', 'Acme#0@a']);
  });

  it('a locked row is ticked and disabled, outside the count and select-all', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const bulk = vi.fn(() => null);
    render(
      <DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false} selectable
        isRowSelectionLocked={(r) => r.id === 'a'} onSelectionChange={onSelectionChange} bulkActions={bulk}
        rowSelectLabel={(r) => r.name} />,
    );
    const locked = screen.getByRole('checkbox', { name: 'Acme' });
    expect(locked).toBeChecked();
    expect(locked).toBeDisabled();
    expect(screen.queryByText(/selected/)).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown rows' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(['b', 'c', 'd']);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(bulk).toHaveBeenLastCalledWith(['b', 'c', 'd'], expect.any(Function));
    expect(screen.getByRole('checkbox', { name: 'Select all shown rows' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Select all shown rows' }));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    expect(locked).toBeChecked();
  });

  it('a default multi-column sort shows no priority numbers; a user multi-sort does', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false}
        defaultSort={[{ key: 'name', dir: 'asc' }, { key: 'due', dir: 'asc' }]} />,
    );
    expect(container.querySelector('[data-part="sort-order"]')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveTextContent(/^Name$/);
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: /Due/ }));
    await user.keyboard('{/Shift}');
    const orders = [...container.querySelectorAll('[data-part="sort-order"]')];
    expect(orders.map((o) => o.textContent)).toEqual(['1', '2']);
    expect(orders.every((o) => o.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('state="loading" says Loading… once', () => {
    render(<DataTable mode="static" rows={[]} columns={COLUMNS} state="loading" searchable={false} />);
    expect(screen.getAllByText('Loading…')).toHaveLength(1);
  });

  it('a required radio field in the toolbar has no Any, no chip, applies at once and survives Clear all', async () => {
    const user = userEvent.setup();
    const fields: DataTableFilterField<Row>[] = [
      { id: 'group', type: 'radio', label: 'Group', required: true, placement: 'toolbar',
        options: [{ value: 'Finance', label: 'Finance' }, { value: 'People', label: 'People' }] },
      { id: 'name', type: 'text', label: 'Name' },
    ];
    const onQueryChange = vi.fn();
    render(<DataTable mode="manual" rows={ROWS} columns={COLUMNS} filterFields={fields} onQueryChange={onQueryChange} />);
    const group = screen.getByRole('group', { name: 'Group' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Finance', 'People']);
    expect(within(group).getByRole('button', { name: 'Finance' })).toHaveAttribute('aria-pressed', 'true');
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ filterValues: { group: 'Finance' } }));
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters' })).not.toHaveTextContent(/\d/);
    await user.click(within(group).getByRole('button', { name: 'People' }));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ filterValues: { group: 'People' } }));
    // the panel holds only the other field
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    expect(within(panel).queryByText('Group')).toBeNull();
    await user.type(within(panel).getByLabelText('Name'), 'Ac');
    await user.click(within(panel).getByRole('button', { name: 'Reset' }));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ filterValues: { group: 'People' } }));
  });

  it('a required select in the panel has no Any option and starts on its first option', async () => {
    const user = userEvent.setup();
    const fields: DataTableFilterField<Row>[] = [
      { id: 'group', type: 'select', label: 'Group', required: true,
        options: [{ value: 'Finance', label: 'Finance' }, { value: 'People', label: 'People' }] },
    ];
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} filterFields={fields} defaultFiltersOpen searchable={false} />);
    expect(bodyNames()).toEqual(['Acme', 'Core']);
    const select = screen.getByLabelText('Group') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['Finance', 'People']);
    await user.selectOptions(select, 'People');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(bodyNames()).toEqual(['Bolt', 'Dyne']);
    expect(screen.queryByRole('group', { name: 'Active filters' })).toBeNull();
  });
});
