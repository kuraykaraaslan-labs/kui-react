import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { Column } from './types';

type Row = { id: string; name: string };
const ROWS: Row[] = [{ id: '1', name: 'Acme' }];
const COLUMNS: Column<Row>[] = [{ key: 'name', header: 'Name' }];

describe('DataTable search box', () => {
  it('has an accessible name of its own, "Search" by default; the placeholder stays a hint', () => {
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} searchPlaceholder="Name or code" />);
    const box = screen.getByRole('searchbox', { name: 'Search' });
    expect(box).toHaveAttribute('placeholder', 'Name or code');
  });

  it('takes the name from the messages', () => {
    render(<DataTable mode="static" rows={ROWS} columns={COLUMNS} messages={{ search: 'Ara' }} />);
    expect(screen.getByRole('searchbox', { name: 'Ara' })).toHaveAttribute('placeholder', 'Search…');
  });
});
