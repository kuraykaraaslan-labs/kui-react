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
