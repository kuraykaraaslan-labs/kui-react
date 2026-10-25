import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { Column } from './types';

// A host that draws its own look (the dashboard table widget): `unstyled`, per-row cell and row looks, the table's
// own classes and style, the scrolling region's classes, and row double clicks.

type Row = { id: string; name: string; temp: number };

const ROWS: Row[] = [
  { id: 'a', name: 'Boiler', temp: 80 },
  { id: 'b', name: 'Pump', temp: 20 },
];

const COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    thClass: 'h-8 px-2 text-xs font-medium',
    thStyle: { color: 'rgb(1, 2, 3)' },
    cellClassName: (r) => (r.temp > 50 ? 'h-9 hot' : 'h-9'),
    cellStyle: (r) => (r.temp > 50 ? { color: 'rgb(255, 0, 0)' } : undefined),
  },
  { key: 'temp', header: 'Temp', align: 'right', sortable: true },
];

const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('DataTable unstyled (a host-drawn look)', () => {
  it('leaves out the kit look and applies the host classes and styles', () => {
    render(
      <DataTable
        mode="manual"
        unstyled
        rows={ROWS}
        columns={COLUMNS}
        searchable={false}
        rowStyle={(r) => (r.id === 'b' ? { background: 'rgb(0, 0, 255)' } : undefined)}
        rowClassName={() => 'host-row'}
        tableClassName="border-separate text-[13px]"
        tableStyle={{ fontWeight: 600 }}
        scrollClassName="min-h-0 flex-1"
      />,
    );
    const table = screen.getByRole('table');
    expect(table.className).toContain('border-separate');
    expect(table.className).not.toContain('text-sm');
    expect(table.style.fontWeight).toBe('600');
    expect(table.parentElement!.className).toContain('min-h-0 flex-1');
    expect(table.parentElement!.className).not.toContain('rounded-lg border');
    expect(table.querySelector('thead')!.className).toBe('');
    expect(table.querySelector('tbody')!.className).toBe('');

    const head = screen.getByRole('columnheader', { name: /Name/ });
    expect(head.className).toContain('h-8 px-2 text-xs font-medium');
    expect(head.className).not.toMatch(/uppercase|px-4/);
    expect(head.style.color).toBe('rgb(1, 2, 3)');
    expect(within(head).getByRole('button').className).not.toContain('uppercase');
    // An end-aligned heading puts its arrow before the text.
    expect(within(screen.getByRole('columnheader', { name: /Temp/ })).getByRole('button').className).toContain('flex-row-reverse');

    const [boiler, pump] = bodyRows();
    expect(boiler.className).toContain('host-row');
    expect(boiler.className).not.toMatch(/hover:/);
    expect(pump.style.background).toBe('rgb(0, 0, 255)');
    const hot = within(boiler).getAllByRole('cell')[0];
    expect(hot.className).toContain('h-9 hot');
    expect(hot.className).not.toMatch(/px-4|py-3/);
    expect(hot.style.color).toBe('rgb(255, 0, 0)');
    expect(within(pump).getAllByRole('cell')[0].style.color).toBe('');
  });

  it('keeps the kit look without it, with the per-row cell classes added', () => {
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false} />);
    const cell = within(bodyRows()[0]).getAllByRole('cell')[0];
    expect(cell.className).toContain('px-4 py-3');
    expect(cell.className).toContain('hot');
    expect(screen.getByRole('table').className).toContain('text-sm');
    expect(screen.getByRole('columnheader', { name: /Name/ }).className).toContain('uppercase');
  });

  it('a row click gets the event, so the host can keep it in the table', () => {
    const outer = vi.fn();
    const onRowClick = vi.fn((_row: Row, e: { stopPropagation: () => void }) => e.stopPropagation());
    render(
      <div onClick={outer}>
        <DataTable mode="static" rows={ROWS} columns={COLUMNS} searchable={false} onRowClick={onRowClick} />
      </div>,
    );
    fireEvent.click(screen.getByText('Pump'));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1], expect.objectContaining({ type: 'click' }));
    expect(outer).not.toHaveBeenCalled();
  });

  it('double click runs onRowDoubleClick; Enter runs it when there is no row click; controls keep theirs', () => {
    const onRowDoubleClick = vi.fn();
    const withButton: Column<Row>[] = [...COLUMNS, { key: 'act', header: 'Act', render: () => <button type="button">Go</button> }];
    render(<DataTable mode="static" rows={ROWS} columns={withButton} searchable={false} onRowDoubleClick={onRowDoubleClick} />);
    fireEvent.doubleClick(screen.getByText('Boiler'));
    expect(onRowDoubleClick).toHaveBeenLastCalledWith(ROWS[0], expect.objectContaining({ type: 'dblclick' }));
    // Keyboard rows turn on by themselves for a double-click action.
    const pump = bodyRows()[1];
    expect(pump).toHaveAttribute('tabindex');
    fireEvent.keyDown(pump, { key: 'Enter' });
    expect(onRowDoubleClick).toHaveBeenLastCalledWith(ROWS[1], expect.anything());
    onRowDoubleClick.mockClear();
    fireEvent.doubleClick(within(pump).getByRole('button', { name: 'Go' }));
    expect(onRowDoubleClick).not.toHaveBeenCalled();
  });
});
