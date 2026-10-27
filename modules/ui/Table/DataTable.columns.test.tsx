import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './index';
import { columnChoicesKey } from './core/columnVisibility';
import type { Column } from './types';

// The column chooser (`columnChooser`, `tableId`): opt-in, saved on this device by table id.

type Row = { id: string; name: string; status: string; owner: string; serial: string };

const ROWS: Row[] = [
  { id: 'a', name: 'Pump 1', status: 'Running', owner: 'Ada', serial: 'SN-1' },
  { id: 'b', name: 'Pump 2', status: 'Stopped', owner: 'Bo', serial: 'SN-2' },
];
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', hideable: false },
  { key: 'status', header: 'Status' },
  { key: 'owner', header: 'Owner' },
  { key: 'serial', header: 'Serial', defaultHidden: true },
];

const headings = () => screen.getAllByRole('columnheader').map((h) => h.textContent);
const openChooser = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Columns/ }));
  return screen.getByRole('dialog', { name: 'Columns' });
};

afterEach(() => window.localStorage.clear());

describe('DataTable column chooser', () => {
  it('is off unless asked for', () => {
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} />);
    expect(screen.queryByRole('button', { name: /Columns/ })).toBeNull();
    // Without the chooser defaultHidden means nothing: every column shows.
    expect(headings()).toEqual(['Name', 'Status', 'Owner', 'Serial']);
  });

  it('starts from defaultHidden, lists only hideable columns, hides and shows cells too', async () => {
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser />);
    expect(headings()).toEqual(['Name', 'Status', 'Owner']);
    const panel = await openChooser(user);
    expect(within(panel).getAllByRole('checkbox').map((c) => (c as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'Status', 'Owner', 'Serial',
    ]);
    await user.click(within(panel).getByLabelText('Owner'));
    await user.click(within(panel).getByLabelText('Serial'));
    expect(headings()).toEqual(['Name', 'Status', 'Serial']);
    const firstRow = screen.getAllByRole('row').find((r) => r.dataset.rowKey === 'a')!;
    expect(within(firstRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Pump 1', 'Running', 'SN-1']);
    expect(screen.getByLabelText('1 hidden')).toHaveTextContent('1');
  });

  it('saves the choice on this device under tableId and brings it back', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser tableId="pumps" />);
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Status'));
    expect(columnChoicesKey('pumps')).toBe('kui.dataTable.columns.v1.pumps');
    expect(JSON.parse(window.localStorage.getItem(columnChoicesKey('pumps'))!)).toEqual({ status: false });
    unmount();

    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser tableId="pumps" />);
    expect(headings()).toEqual(['Name', 'Owner']);
  });

  it('keeps tables apart by tableId, and without one stores nothing', async () => {
    window.localStorage.setItem(columnChoicesKey('other'), JSON.stringify({ owner: false }));
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser />);
    expect(headings()).toEqual(['Name', 'Status', 'Owner']);
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Status'));
    expect(headings()).toEqual(['Name', 'Owner']);
    expect(window.localStorage.length).toBe(1);
  });

  it('Reset returns to the defaults and removes the stored choice', async () => {
    window.localStorage.setItem(columnChoicesKey('pumps'), JSON.stringify({ status: false, serial: true }));
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser tableId="pumps" />);
    expect(headings()).toEqual(['Name', 'Owner', 'Serial']);
    const panel = await openChooser(user);
    await user.click(within(panel).getByRole('button', { name: 'Reset' }));
    expect(headings()).toEqual(['Name', 'Status', 'Owner']);
    expect(window.localStorage.getItem(columnChoicesKey('pumps'))).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('always keeps one column', async () => {
    const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }];
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={columns} columnChooser />);
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Status'));
    expect(headings()).toEqual(['Name']);
    expect(within(panel).getByLabelText('Name')).toBeDisabled();
  });

  it('ignores a stored choice that hides every column or cannot be read', () => {
    const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }];
    window.localStorage.setItem(columnChoicesKey('all'), JSON.stringify({ name: false, status: false }));
    window.localStorage.setItem(columnChoicesKey('bad'), '{not json');
    const { unmount } = render(<DataTable mode="static" rows={ROWS} columns={columns} columnChooser tableId="all" />);
    expect(headings()).toEqual(['Name', 'Status']);
    unmount();
    render(<DataTable mode="static" rows={ROWS} columns={columns} columnChooser tableId="bad" />);
    expect(headings()).toEqual(['Name', 'Status']);
  });

  it('a stored choice that hides every column gives way to the defaults, and the next change starts from them', async () => {
    const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }, { key: 'status', header: 'Status' }];
    window.localStorage.setItem(columnChoicesKey('all'), JSON.stringify({ name: false, status: false }));
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={columns} columnChooser tableId="all" />);
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Status'));
    expect(headings()).toEqual(['Name']);
    expect(within(panel).getByLabelText('Status')).not.toBeChecked();
    expect(JSON.parse(window.localStorage.getItem(columnChoicesKey('all'))!)).toEqual({ status: false });
  });

  it('keeps a column that shows on every screen: one with hideBelow does not count', async () => {
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Name', hideBelow: 'md' },
      { key: 'status', header: 'Status' },
      { key: 'owner', header: 'Owner' },
    ];
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={ROWS} columns={columns} columnChooser />);
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Owner'));
    expect(headings()).toEqual(['Name', 'Status']);
    expect(within(panel).getByLabelText('Status')).toBeDisabled();
    expect(within(panel).getByLabelText('Name')).toBeEnabled();
  });

  it('a Reset in another table with the same tableId brings back the defaults here too', async () => {
    const user = userEvent.setup();
    render(
      <>
        <div data-testid="one"><DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser tableId="x" /></div>
        <div data-testid="two"><DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser tableId="x" /></div>
      </>,
    );
    const one = screen.getByTestId('one');
    const two = screen.getByTestId('two');
    const heads = (el: HTMLElement) => within(el).getAllByRole('columnheader').map((h) => h.textContent);
    await user.click(within(one).getByRole('button', { name: /Columns/ }));
    await user.click(within(one).getByLabelText('Status'));
    expect(heads(two)).toEqual(['Name', 'Owner']);
    await user.click(within(two).getByRole('button', { name: /Columns/ }));
    await user.click(within(two).getByRole('button', { name: 'Reset' }));
    expect(heads(one)).toEqual(['Name', 'Status', 'Owner']);
    await user.click(within(one).getByRole('button', { name: /Columns/ }));
    expect(within(one).getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('hiding the column the rows are sorted by takes it out of the sort', async () => {
    const rows: Row[] = [
      { id: 'a', name: 'Pump 1', status: 'Running', owner: 'Zed', serial: 'SN-1' },
      { id: 'b', name: 'Pump 2', status: 'Stopped', owner: 'Ada', serial: 'SN-2' },
    ];
    const user = userEvent.setup();
    render(<DataTable mode="static" rows={rows} columns={COLUMNS} columnChooser defaultSort={[{ key: 'owner', dir: 'asc' }]} />);
    const firstName = () => within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;
    expect(firstName()).toBe('Pump 2');
    const panel = await openChooser(user);
    await user.click(within(panel).getByLabelText('Owner'));
    expect(firstName()).toBe('Pump 1');
    // Shown again, the column is not sorted again by itself.
    await user.click(within(panel).getByLabelText('Owner'));
    expect(headings()).toEqual(['Name', 'Status', 'Owner']);
    expect(firstName()).toBe('Pump 1');
  });

  it('a stored choice that hides the default sort column drops it from the sort', () => {
    const rows: Row[] = [
      { id: 'a', name: 'Pump 1', status: 'Running', owner: 'Zed', serial: 'SN-1' },
      { id: 'b', name: 'Pump 2', status: 'Stopped', owner: 'Ada', serial: 'SN-2' },
    ];
    window.localStorage.setItem(columnChoicesKey('sorted'), JSON.stringify({ owner: false }));
    render(
      <DataTable mode="static" rows={rows} columns={COLUMNS} columnChooser tableId="sorted"
        defaultSort={[{ key: 'owner', dir: 'asc' }]} />,
    );
    expect(headings()).toEqual(['Name', 'Status']);
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent).toBe('Pump 1');
  });

  it('closes on Escape and gives focus back to its button; no chooser in the card layout', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser />);
    await openChooser(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Columns' })).toBeNull();
    expect(screen.getByRole('button', { name: /Columns/ })).toHaveFocus();
    unmount();

    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser layout="cards" renderCard={(r) => r.name} />);
    expect(screen.queryByRole('button', { name: /Columns/ })).toBeNull();
  });

  it('takes its texts from messages', async () => {
    const user = userEvent.setup();
    render(
      <DataTable mode="static" rows={ROWS} columns={COLUMNS} columnChooser
        messages={{ columns: 'Show columns', resetColumns: 'Defaults', hiddenColumns: '{count} off' }} />,
    );
    await user.click(screen.getByRole('button', { name: /Show columns/ }));
    expect(screen.getByRole('dialog', { name: 'Show columns' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Defaults' })).toBeDisabled();
    expect(screen.getByLabelText('1 off')).toBeInTheDocument();
  });
});
