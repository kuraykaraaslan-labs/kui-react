import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { Column } from './types';

type Row = { id: string; name: string };
const COLUMNS: Column<Row>[] = [{ key: 'name', header: 'Name' }];

// a failed fetch without a message of its own shows the table's translated error text, never untranslated English
describe('DataTable error without text', () => {
  it.each([
    ['a plain object', () => Promise.reject({ status: 500 })],
    ['an Error without a message', () => Promise.reject(new Error(''))],
  ])('server mode: %s is the error state with messages.error and a Retry', async (_l, fetchPage) => {
    render(<DataTable<Row> mode="server" columns={COLUMNS} fetchPage={fetchPage} searchable={false} messages={{ error: 'Bir şeyler ters gitti.', retry: 'Yeniden dene' }} />);
    expect(await screen.findByText('Bir şeyler ters gitti.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeInTheDocument();
    expect(screen.queryByText('Fetch failed')).toBeNull();
  });

  it('server mode: an error with a message shows that message', async () => {
    render(<DataTable<Row> mode="server" columns={COLUMNS} fetchPage={() => Promise.reject(new Error('Forbidden'))} searchable={false} />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('manual mode: an empty error is the error state with messages.error', () => {
    render(<DataTable<Row> mode="manual" rows={[]} columns={COLUMNS} error="" onRetry={() => undefined} searchable={false} messages={{ error: 'Generic error' }} />);
    expect(screen.getByText('Generic error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
