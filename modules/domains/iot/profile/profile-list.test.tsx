import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotCapabilities, ProfileListQuery } from '../api/adapter';
import { blankProfileDraft, type DeviceProfile } from '../types/profile';
import { DeviceProfileListView } from './DeviceProfileListView';

/* NB 41-ui-fixes/20 1.8, 1.11, 1.13, 1.17, N4: the profile list shows the newest answer, never a page past the end, follows its host. */

const T0 = new Date('2026-10-24T12:00:00Z');
const profile = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
  ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: null, isDefault: false, onlineRule: 'LIVE_SOCKET', createdAt: T0, updatedAt: T0, ...over,
});
const ALL: Partial<IotCapabilities> = { canManageProfiles: true };

afterEach(() => cleanup());

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('DeviceProfileListView', () => {
  it('a late answer of an older read (a reload after Make default) never overwrites the rows of the current query (1.8)', async () => {
    const user = userEvent.setup();
    const pending: Array<{ q: ProfileListQuery; d: ReturnType<typeof deferred<{ items: DeviceProfile[]; total: number }>> }> = [];
    const adapter: IotAdapter = {
      profiles: {
        options: async () => [],
        setDefault: vi.fn(async () => profile({ isDefault: true })),
        list: (q) => {
          if (!pending.length && !q.transportType) { pending.push({ q, d: deferred() }); return Promise.resolve({ items: [profile()], total: 1 }); }
          const d = deferred<{ items: DeviceProfile[]; total: number }>();
          pending.push({ q, d });
          return d.promise;
        },
      },
    };
    const view = (q: Partial<ProfileListQuery>) => (
      <IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} initialQuery={q} /></IotAdapterProvider>
    );
    const { rerender } = render(view({ page: 1 }));
    await user.click(await screen.findByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    rerender(view({ page: 1, transportType: 'HTTP' }));
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(pending[2].q.transportType).toBe('HTTP');
    await act(async () => { pending[2].d.resolve({ items: [profile({ profileId: 'h', name: 'Meters' })], total: 1 }); });
    await act(async () => { pending[1].d.resolve({ items: [profile({ profileId: 'm', name: 'Old answer' })], total: 1 }); });
    expect(screen.getByText('Meters')).toBeInTheDocument();
    expect(screen.queryByText('Old answer')).toBeNull();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('follows a new host query, but a re-render with the same values never undoes the reader\'s own move (1.17)', async () => {
    const list = vi.fn(async (q: ProfileListQuery) => ({ items: [profile({ name: `${q.transportType ?? 'all'} p${q.page}` })], total: 45 }));
    const adapter: IotAdapter = { profiles: { options: async () => [], list } };
    const view = (q: Partial<ProfileListQuery>) => (
      <IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} initialQuery={q} /></IotAdapterProvider>
    );
    const user = userEvent.setup();
    const { rerender } = render(view({ page: 1 }));
    await screen.findByText('all p1');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await screen.findByText('all p2');
    rerender(view({ page: 1 }));
    expect(screen.getByText('all p2')).toBeInTheDocument();
    rerender(view({ page: 1, transportType: 'HTTP' }));
    expect(await screen.findByText('HTTP p1')).toBeInTheDocument();
  });

  it('a host query without a page size or a sort keeps the reader\'s own (NB 41-ui-fixes/20 C5)', async () => {
    const list = vi.fn(async (q: ProfileListQuery) => ({ items: [profile({ name: `${q.transportType ?? 'all'} s${q.pageSize}` })], total: 3 }));
    const adapter: IotAdapter = { profiles: { options: async () => [], list } };
    const onQueryChange = vi.fn();
    const view = (q: Partial<ProfileListQuery>) => (
      <IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} initialQuery={q} onQueryChange={onQueryChange} /></IotAdapterProvider>
    );
    const user = userEvent.setup();
    const { rerender } = render(view({ page: 1 }));
    await screen.findByText('all s20');
    await user.selectOptions(screen.getByLabelText(/Rows per page/), '50');
    await screen.findByText('all s50');
    // the host writes its URL back without the page size (it keeps only page and filters), then a filter arrives from its menu
    rerender(view({ page: 1 }));
    rerender(view({ page: 1, transportType: 'HTTP' }));
    expect(await screen.findByText('HTTP s50')).toBeInTheDocument();
  });

  it('a platform template offers Make default only to a viewer who manages templates (NB 41-ui-fixes/20 C7)', async () => {
    const adapter: IotAdapter = { profiles: { options: async () => [], setDefault: vi.fn(), list: async () => ({ items: [profile({ platformTemplate: { key: 'roltek-m1', version: 1 } })], total: 1 }) } };
    const { unmount } = render(<IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></IotAdapterProvider>);
    await screen.findByText('Pumps');
    expect(screen.queryByRole('button', { name: 'Make default' })).toBeNull();
    unmount();
    render(<IotAdapterProvider adapter={adapter} capabilities={{ ...ALL, canManageTemplates: true }}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></IotAdapterProvider>);
    expect(await screen.findByRole('button', { name: 'Make default' })).toBeInTheDocument();
  });

  it('a page past the end moves to the last page and tells the host (1.11)', async () => {
    const list = vi.fn(async (q: ProfileListQuery) => (q.page > 2 ? { items: [], total: 25 } : { items: [profile({ name: `Page ${q.page}` })], total: 25 }));
    const onQueryChange = vi.fn();
    render(<IotAdapterProvider adapter={{ profiles: { options: async () => [], list } }} capabilities={ALL}>
      <DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} initialQuery={{ page: 7 }} onQueryChange={onQueryChange} />
    </IotAdapterProvider>);
    expect(await screen.findByText('Page 2')).toBeInTheDocument();
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('a plain click opens the profile through the host; a modified click keeps the link (N4)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<IotAdapterProvider adapter={{ profiles: { options: async () => [], list: async () => ({ items: [profile()], total: 1 }) } }} capabilities={ALL}>
      <DeviceProfileListView hrefs={{ profile: (id) => `/profiles/${id}` }} onOpen={onOpen} />
    </IotAdapterProvider>);
    const link = (await screen.findByText('Pumps')).closest('a')!;
    expect(link).toHaveAttribute('href', '/profiles/p1');
    await user.click(link);
    expect(onOpen).toHaveBeenCalledWith('p1');
    onOpen.mockClear();
    await user.keyboard('{Control>}');
    await user.click(link);
    await user.keyboard('{/Control}');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a platform template is tagged and its delete names the reason to assistive tech (1.13, N2)', async () => {
    render(<IotAdapterProvider adapter={{ profiles: { options: async () => [], list: async () => ({ items: [profile({ platformTemplate: { key: 'roltek-m1', version: 2 } })], total: 1 }), remove: vi.fn() } }} capabilities={ALL}>
      <DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} />
    </IotAdapterProvider>);
    const row = (await screen.findByText('Pumps')).closest('tr')!;
    expect(within(row).getByText('Platform template')).toBeInTheDocument();
    const del = within(row).getByRole('button', { name: 'Delete Pumps' });
    expect(del).toBeDisabled();
    expect(del).toHaveAccessibleDescription(/A platform template cannot be deleted/);
  });

  it('capabilities that could not be read say so with a retry', async () => {
    const adapter: IotAdapter = { profiles: { options: async () => [], list: async () => ({ items: [profile()], total: 1 }) }, capabilities: async () => { throw new Error('down'); } };
    render(<IotAdapterProvider adapter={adapter}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></IotAdapterProvider>);
    expect(await screen.findByText(/What you may change here could not be read/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
