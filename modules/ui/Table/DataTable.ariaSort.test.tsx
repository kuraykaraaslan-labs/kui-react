import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { Column } from './types';

type Row = { id: string; name: string; status: string; note: string };

const ROWS: Row[] = [
  { id: '1', name: 'Acme', status: 'active', note: 'a' },
  { id: '2', name: 'Globex', status: 'archived', note: 'b' },
];
const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'status', header: 'Status', sortable: true },
  { key: 'note', header: 'Note' },
];

// ARIA only defines "ascending" / "descending" / "none" / "other" for aria-sort, so the
// internal 'asc' / 'desc' directions must be mapped, never passed straight through.
describe('DataTable aria-sort', () => {
  it('maps the sort direction to ARIA values and leaves unsortable columns without aria-sort', () => {
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        initialSort={[{ key: 'name', dir: 'desc' }]} />,
    );
    const [name, status, note] = screen.getAllByRole('columnheader');
    expect(name).toHaveAttribute('aria-sort', 'descending');
    expect(status).toHaveAttribute('aria-sort', 'none');
    expect(note).not.toHaveAttribute('aria-sort');
  });

  it('maps asc to ascending', () => {
    render(
      <DataTable columns={COLUMNS} rows={ROWS} mode="static" searchable={false}
        initialSort={[{ key: 'status', dir: 'asc' }]} />,
    );
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'ascending');
  });
});
