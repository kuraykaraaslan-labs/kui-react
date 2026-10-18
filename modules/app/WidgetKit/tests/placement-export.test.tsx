import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SlotData } from '../kind';
import { DATA_TABLE, DATA_TABLE_KIND } from '../templates/data-table';
import { DATA_TABLE_VIEW } from '../views/DataTableView';
import { PlacementCard } from '../PlacementCard';
import { WidgetKitProvider } from '../WidgetKitContext';

const table = (rows: Array<Record<string, unknown>>): SlotData => ({
  shape: 'table', columns: [{ key: 'name', label: 'Name', type: 'text' }], rows, fetchedAt: '2026-10-16T10:00:00.000Z',
} as SlotData);

let written: string[];
beforeEach(() => {
  written = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => { void b.text().then((t) => written.push(t)); return 'blob:x'; }, revokeObjectURL: () => {} }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const card = (extra: Partial<Parameters<typeof PlacementCard>[0]> = {}) => render(
  <PlacementCard title="Devices" template={DATA_TABLE} slots={DATA_TABLE_KIND.slots} view={DATA_TABLE_VIEW}
    settings={{}} data={{ rows: table([{ name: 'page-1' }]) }} now={Date.parse('2026-10-16T10:00:00.000Z')} {...extra} />,
);

describe('PlacementCard CSV export', () => {
  it('writes the shown rows by default', async () => {
    card();
    fireEvent.click(screen.getByRole('button', { name: 'Download data (CSV)' }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toContain('page-1');
  });

  it('writes what exportData returns (every page of a server-paged table), not just the page on screen', async () => {
    const exportData = vi.fn(async () => ({ rows: table([{ name: 'page-1' }, { name: 'page-2' }]) }));
    card({ exportData });
    fireEvent.click(screen.getByRole('button', { name: 'Download data (CSV)' }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(exportData).toHaveBeenCalledTimes(1);
    expect(written[0]).toContain('page-2');
  });

  it('exports nothing when exportData rejects', async () => {
    const exportData = vi.fn(async () => { throw new Error('offline'); });
    card({ exportData });
    fireEvent.click(screen.getByRole('button', { name: 'Download data (CSV)' }));
    await waitFor(() => expect(exportData).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(written).toEqual([]);
  });
});

describe('PlacementCard full screen', () => {
  it('names the close button with card.closeFullscreen', () => {
    render(
      <WidgetKitProvider value={{ messages: { card: { fullscreen: 'Tam ekran', closeFullscreen: 'Tam ekranı kapat' } } }}>
        <PlacementCard title="Devices" template={DATA_TABLE} slots={DATA_TABLE_KIND.slots} view={DATA_TABLE_VIEW}
          settings={{}} data={{ rows: table([{ name: 'page-1' }]) }} now={Date.parse('2026-10-16T10:00:00.000Z')} />
      </WidgetKitProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tam ekran' }));
    expect(screen.getByRole('button', { name: 'Tam ekranı kapat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
  });
});
