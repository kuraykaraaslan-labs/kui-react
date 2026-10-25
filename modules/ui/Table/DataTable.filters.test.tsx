import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import { activeFilterValues, isFilterValueActive, matchFilterField } from './core/filterPanel';
import type { Column, DataTableFetchArgs, DataTableFilterField } from './types';

type Device = { id: string; name: string; status: string; gateway: string; online: boolean; signal: number; tags: string[]; seen: string };

const DEVICES: Device[] = [
  { id: '1', name: 'Pump A',  status: 'active',  gateway: 'gw-1', online: true,  signal: 80, tags: ['north'], seen: '2026-10-01T10:00:00Z' },
  { id: '2', name: 'Pump B',  status: 'offline', gateway: 'gw-2', online: false, signal: 20, tags: ['south'], seen: '2026-10-10T10:00:00Z' },
  { id: '3', name: 'Valve C', status: 'active',  gateway: 'gw-2', online: true,  signal: 55, tags: ['north', 'south'], seen: '2026-10-20T10:00:00Z' },
];
const COLUMNS: Column<Device>[] = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status' },
];
const FIELDS: DataTableFilterField<Device>[] = [
  { id: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Offline', value: 'offline' }] },
  { id: 'gateway', label: 'Gateway', type: 'checkboxes', options: [{ label: 'GW 1', value: 'gw-1' }, { label: 'GW 2', value: 'gw-2' }] },
  { id: 'online', label: 'Online only', type: 'checkbox' },
  { id: 'name', label: 'Name contains', type: 'text' },
];

function names() {
  return screen.queryAllByRole('row').slice(1).map((r) => within(r).queryAllByRole('cell')[0]?.textContent);
}

describe('filter panel helpers', () => {
  const range: DataTableFilterField<Device> = { id: 'signal', label: 'Signal', type: 'range', min: 0, max: 100 };
  const dates: DataTableFilterField<Device> = { id: 'seen', label: 'Seen', type: 'daterange' };

  it('treats empty values and a full range as unset', () => {
    expect(isFilterValueActive(FIELDS[0], '')).toBe(false);
    expect(isFilterValueActive(FIELDS[1], [])).toBe(false);
    expect(isFilterValueActive(FIELDS[2], false)).toBe(false);
    expect(isFilterValueActive(range, [0, 100])).toBe(false);
    expect(isFilterValueActive(range, [10, 100])).toBe(true);
    expect(isFilterValueActive(dates, { from: null, to: null })).toBe(false);
    expect(activeFilterValues([...FIELDS, range], { status: 'active', gateway: [], signal: [0, 100], stray: 'x' }))
      .toEqual({ status: 'active' });
  });

  it('matches rows by field type', () => {
    expect(matchFilterField(FIELDS[1], DEVICES[0], ['gw-2'])).toBe(false);
    expect(matchFilterField(range, DEVICES[2], [50, 60])).toBe(true);
    expect(matchFilterField(dates, DEVICES[1], { from: '2026-10-05', to: '2026-10-15' })).toBe(true);
    expect(matchFilterField(dates, DEVICES[2], { from: '2026-10-05', to: '2026-10-15' })).toBe(false);
    const tags: DataTableFilterField<Device> = { id: 'tags', label: 'Tags', type: 'multiselect', options: [] };
    expect(matchFilterField(tags, DEVICES[2], ['south'])).toBe(true);
    const custom: DataTableFilterField<Device> = { id: 'x', label: 'X', type: 'custom', render: () => null, match: (r) => r.signal > 50 };
    expect(matchFilterField(custom, DEVICES[1], true)).toBe(false);
  });
});

describe('DataTable filter panel', () => {
  it('without filterFields there is no Filters button (unchanged)', () => {
    render(<DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false} />);
    expect(screen.queryByRole('button', { name: /filters/i })).toBeNull();
  });

  it('opens the panel, applies on Apply only and counts active fields', async () => {
    const user = userEvent.setup();
    const onFilterValuesChange = vi.fn();
    render(
      <DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false}
        filterFields={FIELDS} onFilterValuesChange={onFilterValuesChange} />,
    );
    const toggle = screen.getByRole('button', { name: /filters/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('form', { name: 'Filters' });
    expect(toggle).toHaveAttribute('aria-controls', panel.id);

    await user.selectOptions(within(panel).getByLabelText('Status'), 'active');
    await user.click(within(panel).getByLabelText('Online only'));
    expect(names()).toEqual(['Pump A', 'Pump B', 'Valve C']); // draft only

    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    expect(names()).toEqual(['Pump A', 'Valve C']);
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({ status: 'active', online: true });
    expect(within(toggle).getByText('2')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Reset' }));
    expect(names()).toEqual(['Pump A', 'Pump B', 'Valve C']);
    expect(within(panel).getByLabelText('Status')).toHaveValue('');
  });

  it('applies on Enter and at once with filtersLive', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false}
        filterFields={FIELDS} defaultFiltersOpen />,
    );
    await user.type(screen.getByLabelText('Name contains'), 'valve{Enter}');
    expect(names()).toEqual(['Valve C']);
    unmount();

    render(
      <DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false}
        filterFields={FIELDS} defaultFiltersOpen filtersLive />,
    );
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'GW 1' }));
    expect(names()).toEqual(['Pump A']);
  });

  it('sends the set values to fetchPage in server mode and goes back to page 1', async () => {
    const user = userEvent.setup();
    const fetchPage = vi.fn(async (args: DataTableFetchArgs) => ({
      rows: DEVICES.filter((d) => !args.filterValues.status || d.status === args.filterValues.status)
        .slice((args.page - 1) * args.pageSize, args.page * args.pageSize),
      total: 3,
    }));
    render(
      <DataTable columns={COLUMNS} mode="server" fetchPage={fetchPage} pageSize={2} searchable={false}
        filterFields={FIELDS} defaultFiltersOpen />,
    );
    await waitFor(() => expect(screen.getByText('Pump A')).toBeInTheDocument());
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ filterValues: {} }));

    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));

    await user.selectOptions(screen.getByLabelText('Status'), 'offline');
    await user.click(screen.getByRole('checkbox', { name: 'GW 2' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, filterValues: { status: 'offline', gateway: ['gw-2'] } }),
      ),
    );
  });

  it('follows filterFields that change at runtime (e.g. a definition loaded from the server)', async () => {
    const user = userEvent.setup();
    const fetchPage = vi.fn(async () => ({ rows: DEVICES, total: 3 }));
    // Definitions as plain JSON, the way a backend would send them.
    const fromServer = JSON.parse(JSON.stringify(FIELDS.slice(0, 2))) as DataTableFilterField<Device>[];
    const { rerender } = render(
      <DataTable columns={COLUMNS} mode="server" fetchPage={fetchPage} searchable={false}
        filterFields={fromServer} defaultFiltersOpen />,
    );
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.click(screen.getByRole('checkbox', { name: 'GW 1' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterValues: { status: 'active', gateway: ['gw-1'] } })));

    // The server drops "status" and adds a gateway option and a new field.
    const next: DataTableFilterField<Device>[] = [
      { id: 'gateway', label: 'Gateway', type: 'checkboxes', options: [
        { label: 'GW 1', value: 'gw-1' }, { label: 'GW 2', value: 'gw-2' }, { label: 'GW 3', value: 'gw-3' }] },
      { id: 'online', label: 'Online only', type: 'checkbox' },
    ];
    rerender(
      <DataTable columns={COLUMNS} mode="server" fetchPage={fetchPage} searchable={false}
        filterFields={next} defaultFiltersOpen />,
    );
    expect(screen.queryByLabelText('Status')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'GW 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Online only')).toBeInTheDocument();
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filterValues: { gateway: ['gw-1'] } })));
    expect(within(screen.getByRole('button', { name: /filters/i })).getByText('1')).toBeInTheDocument();
  });

  it('keeps the draft while a controlled parent re-renders with equal values', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false}
        filterFields={FIELDS} defaultFiltersOpen filterValues={{}} />,
    );
    await user.type(screen.getByLabelText('Name contains'), 'pu');
    rerender(
      <DataTable columns={COLUMNS} rows={DEVICES} mode="static" searchable={false}
        filterFields={FIELDS} defaultFiltersOpen filterValues={{}} />,
    );
    expect(screen.getByLabelText('Name contains')).toHaveValue('pu');
  });
});
