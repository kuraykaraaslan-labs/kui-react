import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import { applySort } from './core/useTable';
import type { Column } from './types';

type Row = { id: string; severity: string };
const RANK: Record<string, number> = { CRITICAL: 0, MAJOR: 1, MINOR: 2 };
const ROWS: Row[] = [{ id: '1', severity: 'MINOR' }, { id: '2', severity: 'CRITICAL' }, { id: '3', severity: 'MAJOR' }];
const COLUMNS: Column<Row>[] = [{ key: 'severity', header: 'Severity', sortable: true, sortValue: (r) => RANK[r.severity] }];

describe('Column.sortValue (browser modes)', () => {
  it('sorts by the column\'s own value, not the cell text', () => {
    expect(applySort(ROWS, [{ key: 'severity', dir: 'asc' }], COLUMNS).map((r) => r.severity)).toEqual(['CRITICAL', 'MAJOR', 'MINOR']);
    // without the columns the raw value sorts (alphabetically)
    expect(applySort(ROWS, [{ key: 'severity', dir: 'asc' }]).map((r) => r.severity)).toEqual(['CRITICAL', 'MAJOR', 'MINOR'].sort());
  });

  it('a header click in paginated mode uses it', async () => {
    const user = userEvent.setup();
    render(<DataTable mode="paginated" rows={ROWS} columns={COLUMNS} />);
    await user.click(screen.getByRole('button', { name: /Severity/ }));
    const cells = within(screen.getByRole('table')).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(['CRITICAL', 'MAJOR', 'MINOR']);
  });
});
