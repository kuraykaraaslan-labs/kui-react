import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotAssetsApi, type IotCapabilities } from '../api/adapter';
import {
  NAMED_ASSET_KINDS, assetKindChoices, assetPath, devicesBelow, filterAssets, flattenAssets, locatedSites, siteTone, subtreeIds, withoutAssets,
  type AssetNode, type AssetRecord, type AssetRow, type AssetSummary, type PlacedDevice,
} from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { AssetKindBadge } from './AssetKindBadge';
import { AssetTree } from './AssetTree';
import { MoveAssetDialog } from './MoveAssetDialog';
import { AssetDrawer } from './AssetDrawer';
import { AssetsView } from './AssetsView';
import { AssetsMapDrawer, clusterAlarmText, siteMarkerSize, siteMarkerText } from './AssetsMapDrawer';
import { AssetFormDrawer } from './AssetFormDrawer';
import { DevicePlacementPanel } from './DevicePlacementPanel';
import { PlaceDevicesDialog } from './PlaceDevicesDialog';
import { assetKindIcon, assetKindLabel } from './asset-kind';
import { IOT_MESSAGES, mergeIotMessages } from '../messages';

const mapMounts = vi.hoisted(() => ({ n: 0 }));
vi.mock('@/modules/ui/MapView/MapCanvas', async () => {
  const { useEffect } = await import('react');
  return { MapCanvas: FakeMap };
  function FakeMap({ markers, onMarkerClick, cluster, clusterText }: { markers: Array<{ id: string }>; onMarkerClick?: (id: string) => void; cluster?: boolean; clusterText?: (ms: Array<{ id: string }>) => string }) {
    useEffect(() => { mapMounts.n += 1; }, []);
    return (
    <div data-testid="fake-map" data-markers={JSON.stringify(markers)} data-cluster={String(!!cluster)} data-cluster-text={clusterText?.(markers)}>
      {markers.map((mk) => <button key={mk.id} type="button" onClick={() => onMarkerClick?.(mk.id)}>{`marker ${mk.id}`}</button>)}
    </div>
    );
  }
});

const NOW = new Date('2026-10-24T12:00:00Z').getTime();

const n = (assetId: string, name: string, kind: string, children: AssetNode[] = [], deviceCount = 0, parentId: string | null = null): AssetNode => ({
  assetId, parentId, code: assetId.toUpperCase(), name, kind, childCount: children.length, deviceCount, children: children.map((c) => ({ ...c, parentId: assetId })),
});
const TREE: AssetNode[] = [
  n('plant', 'Berlin plant', 'SITE', [
    n('hall-a', 'Hall A', 'BUILDING', [n('press-line', 'Press line', 'LINE', [n('press-3', 'Press 3', 'MACHINE', [], 2)])]),
    n('hall-b', 'Hall B', 'BUILDING', [], 1),
  ]),
  n('hub', 'Logistics hub', 'SITE'),
];

const DEVICE: DeviceRecord = {
  deviceId: 'd1', name: 'Press sensor', deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false, online: true,
  lastActivityAt: new Date(NOW - 60_000), lastRemoteIp: '203.0.113.7', lastTransport: 'mqtt',
};
const RECORD: AssetRecord = {
  assetId: 'press-line', parentId: 'hall-a', code: 'PRESS-LINE', name: 'Press line', kind: 'LINE', description: 'Line 3 of hall A',
  timezone: null, effectiveTimezone: 'Europe/Berlin', attributes: { tonnage: 800 },
  ancestors: [{ assetId: 'plant', code: 'PLANT', name: 'Berlin plant', kind: 'SITE' }, { assetId: 'hall-a', code: 'HALL-A', name: 'Hall A', kind: 'BUILDING' }],
  childCount: 1, deviceCount: 2,
};
const PLACED: PlacedDevice[] = [{ device: DEVICE, placement: { assetId: 'press-3', code: 'PRESS-3', name: 'Press 3', kind: 'MACHINE' } }];
const row = (assetId: string, name: string, kind: string, location: string[], childCount: number, deviceCount: number, alarmCount: number, worstSeverity: AssetRow['worstSeverity'] = null): AssetRow => ({
  assetId, parentId: null, code: assetId.toUpperCase(), name, kind, location: location.map((l) => ({ assetId: l.toLowerCase(), name: l })), childCount, deviceCount, alarmCount, worstSeverity,
});
const ROWS: AssetRow[] = [
  row('plant', 'Berlin plant', 'SITE', [], 2, 3, 3, 'CRITICAL'),
  row('press-line', 'Press line', 'LINE', ['Berlin plant', 'Hall A'], 1, 2, 3, 'CRITICAL'),
  row('hub', 'Logistics hub', 'SITE', [], 0, 0, 0),
];

function fakeAssets(over: Partial<IotAssetsApi> = {}): IotAssetsApi {
  return {
    tree: vi.fn().mockResolvedValue({ nodes: TREE, truncated: false }),
    list: vi.fn().mockImplementation(async (q: { parentId?: string }) => (q.parentId
      ? { items: [{ ...row('press-3', 'Press 3', 'MACHINE', ['Berlin plant', 'Hall A', 'Press line'], 0, 2, 0) }], total: 1, alarms: true }
      : { items: ROWS, total: ROWS.length, alarms: true })),
    summary: vi.fn().mockImplementation(async () => SUMMARY),
    get: vi.fn().mockResolvedValue(RECORD),
    create: vi.fn().mockResolvedValue({ assetId: 'new-1' }),
    update: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    devices: vi.fn().mockResolvedValue({ items: PLACED, total: 1 }),
    place: vi.fn().mockResolvedValue(undefined),
    placement: vi.fn().mockResolvedValue({ assetId: 'press-3', path: [RECORD.ancestors[0], RECORD.ancestors[1], { assetId: 'press-3', code: 'PRESS-3', name: 'Press 3', kind: 'MACHINE' }] }),
    setPlacement: vi.fn().mockResolvedValue({ assetId: null, path: [] }),
    relations: vi.fn().mockResolvedValue([{ relationId: 'r1', fromType: 'ASSET', fromId: 'coolant', toType: 'ASSET', toId: 'press-line', type: 'FEEDS', fromName: 'Coolant station', toName: 'Press line' }]),
    removeRelation: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

function wrap(ui: React.ReactNode, assets: IotAssetsApi, caps: Partial<IotCapabilities> = { canManageAssets: true, canPlaceDevices: true }, extra: Partial<IotAdapter> = {}) {
  const notify = vi.fn();
  const adapter: IotAdapter = { assets, ...extra };
  return { notify, ...render(<IotAdapterProvider adapter={adapter} capabilities={caps} notify={notify}>{ui}</IotAdapterProvider>) };
}

describe('asset helpers', () => {
  it('walks, paths and counts the tree', () => {
    expect(flattenAssets(TREE).map((x) => x.assetId)).toEqual(['plant', 'hall-a', 'press-line', 'press-3', 'hall-b', 'hub']);
    expect(assetPath(TREE, 'press-3').map((x) => x.name)).toEqual(['Berlin plant', 'Hall A', 'Press line', 'Press 3']);
    expect(assetPath(TREE, 'nope')).toEqual([]);
    expect(devicesBelow(TREE[0])).toBe(3);
  });

  it('names a node and everything under it (a move never goes there), and drops them from a picker', () => {
    expect([...subtreeIds(TREE, 'hall-a')].sort()).toEqual(['hall-a', 'press-3', 'press-line']);
    const offered = flattenAssets(withoutAssets(TREE, subtreeIds(TREE, 'hall-a'))).map((x) => x.assetId);
    expect(offered).toEqual(['plant', 'hall-b', 'hub']);
  });

  it('filters by name or code and keeps each hit with its ancestors', () => {
    const { nodes, matches } = filterAssets(TREE, 'press-3');
    expect(flattenAssets(nodes).map((x) => x.assetId)).toEqual(['plant', 'hall-a', 'press-line', 'press-3']);
    expect([...matches]).toEqual(['press-3']);
    expect(filterAssets(TREE, '  ').nodes).toHaveLength(2);
    expect(filterAssets(TREE, 'zzz').nodes).toEqual([]);
  });
});

describe('AssetKindBadge', () => {
  it('draws a suggested kind with its label and a free kind with a neutral icon and its own name', () => {
    const { container, rerender } = render(<AssetKindBadge kind="building" />);
    expect(screen.getByText('Building')).toBeInTheDocument();
    expect(container.querySelector('[data-kind="BUILDING"][data-suggested="true"]')).not.toBeNull();
    rerender(<AssetKindBadge kind="COLD_STORE" />);
    expect(screen.getByText('Cold store')).toBeInTheDocument();
    expect(container.querySelector('[data-suggested="false"]')).not.toBeNull();
    rerender(<AssetKindBadge kind="SITE" iconOnly />);
    expect(screen.getByText('Site')).toHaveClass('sr-only');
    expect(assetKindLabel('LINE', mergeIotMessages({ assetKind: { LINE: 'Hat' } }))).toBe('Hat');
  });

  it('labels the kinds the platform seeds beside the suggested ones from the messages, with icons of their own, and keeps them out of the pickers', () => {
    const tr = mergeIotMessages({ assetKind: { PLANT: 'Tesis', REGION: 'Bölge', ZONE: 'Zon', DEPOT: 'Depo' } });
    expect(['plant', 'REGION', 'Zone', 'DEPOT'].map((k) => assetKindLabel(k, tr))).toEqual(['Tesis', 'Bölge', 'Zon', 'Depo']);
    expect(NAMED_ASSET_KINDS.map((k) => assetKindLabel(k, IOT_MESSAGES))).not.toContain(undefined);
    expect(new Set(['PLANT', 'REGION', 'ZONE', 'DEPOT'].map((k) => assetKindIcon(k).iconName)).has('cube')).toBe(false);
    const { container } = render(<AssetKindBadge kind="PLANT" messages={{ assetKind: { PLANT: 'Tesis' } }} />);
    expect(screen.getByText('Tesis')).toBeInTheDocument();
    expect(container.querySelector('[data-kind="PLANT"][data-suggested="false"]')).not.toBeNull();
    expect(assetKindChoices()).not.toContain('PLANT');
  });
});

describe('AssetTree', () => {
  it('lists the tree, searches with the ancestors kept, says when nothing matches, and selects', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AssetTree nodes={TREE} onSelect={onSelect} />);
    expect(screen.getByRole('tree', { name: 'Sites and assets' })).toBeInTheDocument();
    expect(screen.getByText('Logistics hub')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Search by name or code'), 'press 3');
    await waitFor(() => expect(screen.queryByText('Logistics hub')).toBeNull());
    expect(screen.getByText('Berlin plant')).toBeInTheDocument();
    expect(screen.getByText('Press 3')).toBeInTheDocument();
    await user.click(screen.getByText('Press 3'));
    expect(onSelect).toHaveBeenCalledWith('press-3');
    await user.clear(screen.getByPlaceholderText('Search by name or code'));
    await user.type(screen.getByPlaceholderText('Search by name or code'), 'zzz');
    expect(await screen.findByText('Nothing matches “zzz”.')).toBeInTheDocument();
  });

  it('labels the expand and collapse all toolbar from the kit messages', () => {
    render(<AssetTree nodes={TREE} messages={{ assets: { expandAll: 'Tümünü genişlet', collapseAll: 'Tümünü daralt' } }} />);
    expect(screen.getByRole('button', { name: 'Tümünü genişlet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tümünü daralt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull();
  });

  it('names the search clear button and the loading skeleton from the kit messages', async () => {
    const user = userEvent.setup();
    const messages = { common: { clearSearch: 'Aramayı temizle', loading: 'Yükleniyor…' } };
    const { rerender } = render(<AssetTree nodes={TREE} messages={messages} />);
    await user.type(screen.getByPlaceholderText('Search by name or code'), 'press');
    expect(screen.getByRole('button', { name: 'Aramayı temizle' })).toBeInTheDocument();
    rerender(<AssetTree nodes={[]} loading messages={messages} />);
    expect(screen.getByLabelText('Yükleniyor…')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByLabelText('Loading content')).toBeNull();
  });

  it('shows the empty state with the host action', () => {
    render(<AssetTree nodes={[]} emptyAction={<button type="button">New site</button>} />);
    expect(screen.getByText('No sites yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New site' })).toBeInTheDocument();
  });
});

describe('MoveAssetDialog (cycle prevention)', () => {
  it('never offers the asset or its descendants, moves to the top level, and shows the host refusal', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets({ move: vi.fn().mockRejectedValueOnce(new IotApiError('validation', 'An asset cannot be moved under itself.')).mockResolvedValue(undefined) });
    const onMoved = vi.fn();
    wrap(<MoveAssetDialog open asset={{ assetId: 'hall-a', name: 'Hall A', parentId: 'plant' }} nodes={TREE} onClose={() => undefined} onMoved={onMoved} />, assets);
    const dialog = screen.getByRole('dialog');
    const tree = within(dialog).getByRole('tree');
    expect(within(tree).queryByText('Hall A')).toBeNull();
    expect(within(tree).queryByText('Press line')).toBeNull();
    expect(within(tree).queryByText('Press 3')).toBeNull();
    expect(within(tree).getByText('Hall B')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Move here' })).toBeDisabled();
    await user.click(within(tree).getByText('Top level (no parent)'));
    await user.click(within(dialog).getByRole('button', { name: 'Move here' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('An asset cannot be moved under itself.');
    await user.click(within(dialog).getByRole('button', { name: 'Move here' }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith(null));
    expect(assets.move).toHaveBeenLastCalledWith('hall-a', null);
  });
});

describe('AssetDrawer', () => {
  it('shows the path, the header, the inherited time zone, and the devices with their state and address, as sections', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} hrefs={{ asset: (id) => `/a/${id}`, device: (id) => `/d/${id}` }} now={NOW} />, assets);
    expect(await screen.findByRole('heading', { name: 'Press line' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Asset path' });
    expect(within(crumbs).getByRole('link', { name: /Berlin plant/ })).toHaveAttribute('href', '/a/plant');
    expect(screen.getByText('Europe/Berlin (from Hall A)')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Attributes' })).getByText('tonnage')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    // no tabs: every section is on the page at once
    expect(screen.queryByRole('tab')).toBeNull();
    for (const name of ['Overview', 'Attributes', 'Devices', 'Child assets (1)', 'Relations']) expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Press sensor/ })).toHaveAttribute('href', '/d/d1');
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
    expect(screen.getAllByText('Online')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Press 3' })).toHaveAttribute('href', '/a/press-3');
    expect(assets.devices).toHaveBeenCalledWith('press-line', { page: 1, pageSize: 10, recursive: true }, expect.anything());
    expect(await screen.findByText('Coolant station')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove placement: Press sensor' }));
    await waitFor(() => expect(assets.setPlacement).toHaveBeenCalledWith('d1', null));
  });

  it('keeps the devices to two columns that fit the narrow drawer at any screen width, the place under the name', async () => {
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} hrefs={{ asset: (id) => `/a/${id}`, device: (id) => `/d/${id}` }} now={NOW} />, fakeAssets());
    const table = await screen.findByRole('table', { name: 'Devices' });
    await within(table).findByText('Press sensor');
    // no column hidden by a screen breakpoint: the drawer is 40rem wide on a wide screen too
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Connection', 'Remove placement']);
    const [device, connection] = within(table).getAllByRole('row')[1].querySelectorAll('td');
    expect(device.textContent).toBe('Press sensorPlaced on:MachinePress 3');
    expect(device.firstElementChild).toHaveClass('max-w-[8rem]', 'sm:max-w-[16rem]');
    // a phone: the dot alone and no address; from sm the text and the address under it
    const [dot, full] = connection.querySelectorAll('[data-state]');
    expect(dot).toHaveClass('sm:hidden');
    expect(full).toHaveClass('hidden', 'sm:inline-flex');
    expect(within(connection).getByText('203.0.113.7').parentElement).toHaveClass('hidden', 'sm:inline-flex');
  });

  it('pages the devices with the table\'s own pagination and rows per page', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets({ devices: vi.fn().mockResolvedValue({ items: PLACED, total: 45 }) });
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} />, assets);
    await screen.findByText('Press sensor');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(assets.devices).toHaveBeenLastCalledWith('press-line', { page: 2, pageSize: 10, recursive: true }, expect.anything()));
    await user.selectOptions(screen.getAllByLabelText(/Rows per page/)[0], '50');
    await waitFor(() => expect(assets.devices).toHaveBeenLastCalledWith('press-line', { page: 1, pageSize: 50, recursive: true }, expect.anything()));
  });

  it('reads the child assets through the list (parentId), opens a child and a path step in the drawer, and says when there are none', async () => {
    const user = userEvent.setup();
    const onOpenAsset = vi.fn();
    const assets = fakeAssets();
    const { unmount } = wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} onOpenAsset={onOpenAsset} />, assets);
    await screen.findByRole('heading', { name: 'Press line' });
    expect(assets.list).toHaveBeenCalledWith({ page: 1, pageSize: 10, parentId: 'press-line', sort: { key: 'name', dir: 'asc' } }, expect.anything());
    const table = await screen.findByRole('table', { name: 'Child assets' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['MachinePress 3', '0', '2']);
    await user.click(within(row).getByRole('button', { name: /Press 3/ }));
    expect(onOpenAsset).toHaveBeenCalledWith('press-3');
    await user.click(within(screen.getByRole('navigation', { name: 'Asset path' })).getByRole('button', { name: 'Hall A' }));
    expect(onOpenAsset).toHaveBeenCalledWith('hall-a');
    unmount();
    const none = fakeAssets({ get: vi.fn().mockResolvedValue({ ...RECORD, assetId: 'hub', name: 'Logistics hub', ancestors: [], childCount: 0 }) });
    wrap(<AssetDrawer assetId="hub" onClose={() => undefined} />, none);
    await screen.findByRole('heading', { name: 'Logistics hub' });
    expect(within(await screen.findByRole('table', { name: 'Child assets' })).getByText('No child assets.')).toBeInTheDocument();
    expect(none.list).not.toHaveBeenCalled();
  });

  it('pages the child assets, so every child of a large node is reachable', async () => {
    const user = userEvent.setup();
    const kids = Array.from({ length: 10 }, (_, i) => row(`room-${i}`, `Room ${i}`, 'ROOM', ['Berlin plant'], 0, 0, 0));
    const assets = fakeAssets({
      get: vi.fn().mockResolvedValue({ ...RECORD, childCount: 80 }),
      list: vi.fn().mockResolvedValue({ items: kids, total: 80, alarms: true }),
    });
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} onOpenAsset={() => undefined} />, assets);
    const table = await screen.findByRole('table', { name: 'Child assets' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(11));
    const section = screen.getByRole('region', { name: 'Child assets (80)' });
    await user.click(within(section).getByRole('button', { name: 'Page 8' }));
    await waitFor(() => expect(assets.list).toHaveBeenLastCalledWith({ page: 8, pageSize: 10, parentId: 'press-line', sort: { key: 'name', dir: 'asc' } }, expect.anything()));
  });

  it('opens the asset\'s board from the header when it has one and the host links boards', async () => {
    const assets = fakeAssets({ get: vi.fn().mockResolvedValue({ ...RECORD, defaultDashboardId: 'board-7' }) });
    const { unmount } = wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} hrefs={{ dashboard: (id) => `/boards/${id}` }} />, assets, {});
    await screen.findByRole('heading', { name: 'Press line' });
    // a viewer who may not manage assets still opens the board
    expect(within(screen.getByTestId('asset-drawer-header')).getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/boards/board-7');
    unmount();
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} hrefs={{ dashboard: (id) => `/boards/${id}` }} />, fakeAssets());
    await screen.findByRole('heading', { name: 'Press line' });
    expect(screen.queryByRole('link', { name: 'Open dashboard' })).toBeNull();
  });

  it('puts the host\'s own buttons in the header once the asset has loaded, for a viewer who may not manage assets too', async () => {
    const { unmount } = wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} actions={<button type="button">Host action</button>} />, fakeAssets(), {});
    // nothing before the asset has loaded
    expect(screen.queryByRole('button', { name: 'Host action' })).toBeNull();
    await screen.findByRole('heading', { name: 'Press line' });
    expect(within(screen.getByTestId('asset-drawer-header')).getByRole('button', { name: 'Host action' })).toBeInTheDocument();
    unmount();
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} />, fakeAssets(), {});
    await screen.findByRole('heading', { name: 'Press line' });
    expect(screen.queryByRole('button', { name: 'Host action' })).toBeNull();
  });

  it('keeps the actions in the header (labels fold to icons on a phone), moves with the tree read on demand, and says why a delete was refused', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets({ remove: vi.fn().mockRejectedValue(new IotApiError('conflict', 'This asset still has child assets: move or delete them first.')) });
    const { notify, unmount } = wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} />, assets);
    await screen.findByRole('heading', { name: 'Press line' });
    const header = screen.getByTestId('asset-drawer-header');
    const add = within(header).getByRole('button', { name: 'Add child' });
    expect(add.querySelector('span.hidden.sm\\:inline')).not.toBeNull();
    expect(within(header).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    // a 40 px touch target on a phone, each of them
    for (const b of within(header).getAllByRole('button')) expect(b).toHaveClass('max-sm:min-h-10', 'max-sm:min-w-10');
    expect(screen.getByRole('dialog', { name: 'Asset Press line' }).querySelector('.max-w-full')).not.toBeNull();
    expect(assets.tree).not.toHaveBeenCalled();
    // "Move to…" is a header button, as in the approved drawer
    await user.click(within(header).getByRole('button', { name: 'Move to…' }));
    await waitFor(() => expect(assets.tree).toHaveBeenCalled());
    expect(await screen.findByRole('dialog', { name: /Move “Press line”/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(within(header).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    const confirm = await screen.findAllByRole('button', { name: 'Delete' });
    await user.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'error', message: 'This asset cannot be deleted: This asset still has child assets: move or delete them first.' }));
    unmount();
    wrap(<AssetDrawer assetId="press-line" onClose={() => undefined} />, fakeAssets(), {});
    await screen.findByRole('heading', { name: 'Press line' });
    for (const name of ['Add child', 'Edit', 'Move to…', 'More actions']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});

const SUMMARY: AssetSummary = {
  sites: 2, sitesLocated: 1, assets: 6, devices: 4, placedDevices: 3, activeAlarms: 5, criticalAlarms: 2, unacknowledgedAlarms: 4, sitesWithAlarms: 1,
  kinds: ['DEPOT', 'LINE', 'SITE'], sitesTruncated: false, alarmsTruncated: false, alarms: true,
  siteList: [
    { assetId: 'plant', code: 'PLANT', name: 'Berlin plant', kind: 'SITE', lat: 52.5, lng: 13.4, assetCount: 5, deviceCount: 3, alarmCount: 3, worstSeverity: 'CRITICAL', alarmsBySeverity: { CRITICAL: 1, MINOR: 2 } },
    { assetId: 'hub', code: 'HUB', name: 'Logistics hub', kind: 'SITE', lat: null, lng: null, assetCount: 1, deviceCount: 0, alarmCount: 0, worstSeverity: null, alarmsBySeverity: {} },
  ],
};

describe('asset table helpers', () => {
  it('keeps the located sites and colours a site by its worst active alarm', () => {
    expect(locatedSites(SUMMARY.siteList).map((s) => s.assetId)).toEqual(['plant']);
    expect(siteTone({ alarmCount: 3, worstSeverity: 'MAJOR' })).toBe('error');
    expect(siteTone({ alarmCount: 1, worstSeverity: 'WARNING' })).toBe('warning');
    expect(siteTone({ alarmCount: 1, worstSeverity: 'INFO' })).toBe('info');
    expect(siteTone({ alarmCount: 0, worstSeverity: null })).toBe('success');
    expect(siteTone({ alarmCount: null, worstSeverity: null })).toBe('neutral');
  });

  it('offers the suggested kinds, then the custom kinds in use and the one asked for, each once', () => {
    expect(assetKindChoices(['SITE', 'PUMP_STATION', 'DEPOT'], 'VAULT')).toEqual(['SITE', 'BUILDING', 'FLOOR', 'ROOM', 'AREA', 'LINE', 'MACHINE', 'OTHER', 'DEPOT', 'PUMP_STATION', 'VAULT']);
    expect(assetKindChoices(undefined, 'SITE')).toHaveLength(8);
  });
});

describe('AssetsView', () => {
  it('draws the KPI row and the table with place, counts and alarms, and opens a row in the drawer (a history step)', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const onQueryChange = vi.fn();
    wrap(<AssetsView onQueryChange={onQueryChange} now={NOW} />, assets);
    const kpis = await screen.findByTestId('assets-kpis');
    await waitFor(() => expect(within(kpis).getByText('6')).toBeInTheDocument());
    expect(within(kpis).getByText('1 on the map')).toBeInTheDocument();
    expect(within(kpis).getByText('3 placed on an asset')).toBeInTheDocument();
    // the tenant's active alarms (an unplaced device's too, as the host counts them), critical and unacknowledged
    expect(within(kpis).getByText('5')).toBeInTheDocument();
    expect(within(kpis).getByText('2 critical · 4 unacknowledged')).toBeInTheDocument();
    expect(screen.queryByTestId('assets-alarms-partial')).toBeNull();
    expect(assets.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, expect.anything());
    const table = await screen.findByRole('table', { name: 'Sites & assets' });
    const head = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(head.join('|')).toMatch(/Asset.*Kind.*Place.*Child assets.*Devices.*Alarms/);
    const line = within(table).getByText('Press line').closest('tr')!;
    expect(within(line).getAllByText('Berlin plant › Hall A').length).toBeGreaterThan(0);
    expect(within(line).getByText('3 active')).toHaveAttribute('data-severity', 'CRITICAL');
    expect(within(within(table).getByText('Logistics hub').closest('tr')!).getByText('No issues')).toBeInTheDocument();
    await user.click(within(table).getByText('Press line'));
    expect(onQueryChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, asset: 'press-line' }, 'push');
    expect(await screen.findByRole('dialog', { name: 'Asset Press line' })).toBeInTheDocument();
  });

  it('sorts on the host, filters to alarms, and follows the asset and the map of the URL', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const onQueryChange = vi.fn();
    const { rerender } = wrap(<AssetsView onQueryChange={onQueryChange} initialQuery={{ alarmed: true, sort: { key: 'alarms', dir: 'desc' } }} />, assets);
    await screen.findByRole('table', { name: 'Sites & assets' });
    expect(assets.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, alarmed: true, sort: { key: 'alarms', dir: 'desc' } }, expect.anything());
    await user.click(screen.getByRole('button', { name: /Devices/ }));
    await waitFor(() => expect(assets.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'devices', dir: 'asc' }, alarmed: true }), expect.anything()));
    rerender(<IotAdapterProvider adapter={{ assets }} capabilities={{ canManageAssets: true }} notify={vi.fn()}><AssetsView initialQuery={{ asset: 'press-line' }} /></IotAdapterProvider>);
    expect(await screen.findByRole('dialog', { name: 'Asset Press line' })).toBeInTheDocument();
  });

  it('follows the filters of a URL it did not write (a link to the same page, Back), never the echo of its own report', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const reports: unknown[] = [];
    const view = (q: object) => (
      <IotAdapterProvider adapter={{ assets }} capabilities={{ canManageAssets: true }} notify={vi.fn()}>
        <AssetsView initialQuery={q} onQueryChange={(next) => reports.push(next)} />
      </IotAdapterProvider>
    );
    const { rerender } = render(view({ site: 'plant', kind: 'LINE' }));
    await screen.findByRole('table', { name: 'Sites & assets' });
    expect(assets.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, site: 'plant', kind: 'LINE' }, expect.anything());
    // the view's own change, then the host's URL catching up with it: one read, no step back
    await user.click(screen.getByRole('button', { name: /Devices/ }));
    await waitFor(() => expect(assets.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'devices', dir: 'asc' }, site: 'plant' }), expect.anything()));
    const calls = vi.mocked(assets.list).mock.calls.length;
    rerender(view({ site: 'plant', kind: 'LINE', sort: { key: 'devices', dir: 'asc' } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(assets.list).mock.calls.length).toBe(calls);
    // the sidebar's link to the bare page: the filters go too
    rerender(view({}));
    await waitFor(() => expect(assets.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }, expect.anything()));
  });

  it('offers the custom kinds in the Kind filter and says when the host counted only part of the alarms', async () => {
    const user = userEvent.setup();
    wrap(<AssetsView />, fakeAssets({ summary: vi.fn().mockResolvedValue({ ...SUMMARY, alarmsTruncated: true }) }));
    expect(await screen.findByTestId('assets-alarms-partial')).toHaveTextContent(/too many active alarms/);
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const kind = await screen.findByLabelText('Kind');
    expect(within(kind).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(expect.arrayContaining(['SITE', 'DEPOT']));
  });

  it('leaves the alarm KPI, column and filter out when the host shows no alarms, and shows the empty state with New site', async () => {
    const assets = fakeAssets({
      list: vi.fn().mockResolvedValue({ items: ROWS.map((r) => ({ ...r, alarmCount: null, worstSeverity: null })), total: ROWS.length, alarms: false }),
      summary: vi.fn().mockResolvedValue({ ...SUMMARY, alarms: false, activeAlarms: null, sitesWithAlarms: null }),
    });
    const { unmount } = wrap(<AssetsView />, assets);
    const table = await screen.findByRole('table', { name: 'Sites & assets' });
    await waitFor(() => expect(within(table).getByText('Press line')).toBeInTheDocument());
    expect(within(table).queryByRole('columnheader', { name: /Alarms/ })).toBeNull();
    await waitFor(() => expect(screen.getByTestId('assets-kpis').querySelector('[data-kpi="alarms"]')).toBeNull());
    unmount();
    wrap(<AssetsView />, fakeAssets({ list: vi.fn().mockResolvedValue({ items: [], total: 0, alarms: true }), summary: vi.fn().mockResolvedValue({ ...SUMMARY, sites: 0, assets: 0, siteList: [] }) }));
    expect(await screen.findByText('No sites yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New site/ }).length).toBeGreaterThan(1);
  });

  it('opens the map, lists the sites by alarm, and turns "List assets" into the site filter', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const onQueryChange = vi.fn();
    wrap(<AssetsView onQueryChange={onQueryChange} />, assets);
    await screen.findByRole('table', { name: 'Sites & assets' });
    await user.click(screen.getByRole('button', { name: 'Map' }));
    expect(onQueryChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, map: true }, 'push');
    const map = await screen.findByRole('dialog', { name: 'Sites on the map' });
    expect(within(map).getByText('2 sites · 1 with a location')).toBeInTheDocument();
    await user.click(within(map).getByRole('button', { name: /Berlin plant/ }));
    const card = await within(map).findByTestId('assets-map-site');
    expect(within(card).getByText('5 assets · 3 devices')).toBeInTheDocument();
    expect(card.querySelector('[data-severity="CRITICAL"]')).not.toBeNull();
    await user.click(within(card).getByRole('button', { name: 'List assets' }));
    await waitFor(() => expect(assets.list).toHaveBeenLastCalledWith(expect.objectContaining({ site: 'plant', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, site: 'plant' }, 'replace');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sites on the map' })).toBeNull());
  });

  it('wraps the header actions under the title and folds the place under the name on a phone', async () => {
    wrap(<AssetsView moreActions={[{ id: 'devices', label: 'Device list', href: '/d' }]} />, fakeAssets());
    const table = await screen.findByRole('table', { name: 'Sites & assets' });
    const actions = screen.getByRole('button', { name: 'Map' }).parentElement!;
    expect(actions).toHaveClass('flex-wrap');
    expect(actions.parentElement).toHaveClass('flex-wrap');
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
    for (const name of ['Map', 'More actions', 'New site']) expect(screen.getAllByRole('button', { name })[0]).toHaveClass('max-sm:min-h-10');
    await waitFor(() => expect(within(table).getByText('Press line')).toBeInTheDocument());
    expect(within(table).getAllByText('Berlin plant › Hall A').some((el) => el.classList.contains('md:hidden'))).toBe(true);
    expect(screen.getByTestId('assets-kpis')).toHaveClass('grid-cols-2');
  });
});

describe('AssetsMapDrawer', () => {
  it('draws the sites as circles coloured by the worst alarm with the alarm count inside, narrows to the sites with alarms, and opens a site from the map', async () => {
    const user = userEvent.setup();
    const onOpenSite = vi.fn();
    wrap(<AssetsMapDrawer onClose={() => undefined} summary={SUMMARY} onListAssets={() => undefined} onOpenSite={onOpenSite} alarmsHref={(id) => `/alarms?site=${id}`} />, fakeAssets());
    const map = await screen.findByTestId('fake-map');
    expect(JSON.parse(map.getAttribute('data-markers')!)).toEqual([
      { id: 'plant', position: [52.5, 13.4], variant: 'error', shape: 'dot', size: 40, text: '3', label: 'Berlin plant', tooltip: { title: 'Berlin plant', description: '3 devices · 3 active' } },
    ]);
    // the kit's table (check:tables in NB), one site a row, each a button
    const list = screen.getByRole('table', { name: 'Sites' });
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Berlin plant3 devices · 3 active', 'Logistics hub0 devices · 0 active · No location']);
    // fixed to the column's width: a long name is cut off with an ellipsis, the list never scrolls sideways
    expect(list).toHaveClass('table-fixed');
    expect(within(list).getByText('Berlin plant')).toHaveClass('truncate');
    await user.click(within(list).getByRole('button', { name: /Logistics hub/ }));
    expect(within(list).getByRole('button', { name: /Logistics hub/ })).toHaveAttribute('aria-current', 'true');
    expect(within(list).getByRole('button', { name: /Logistics hub/ }).closest('tr')).toHaveClass('bg-surface-overlay');
    await user.click(screen.getByRole('button', { name: 'Only with active alarms' }));
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await user.click(within(map).getByRole('button', { name: 'marker plant' }));
    const card = await screen.findByTestId('assets-map-site');
    expect(within(card).getByRole('link', { name: 'Alarms' })).toHaveAttribute('href', '/alarms?site=plant');
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    expect(onOpenSite).toHaveBeenCalledWith('plant');
  });

  it('sizes a site\'s circle by its devices (by area) and puts its active alarm count inside', () => {
    expect(siteMarkerSize(0, 35)).toBe(22);
    expect(siteMarkerSize(35, 35)).toBe(40);
    // a quarter of the devices: half the extra width
    expect(siteMarkerSize(9, 36)).toBe(31);
    expect(siteMarkerSize(5, 0)).toBe(22);
    expect(siteMarkerText(21)).toBe('21');
    expect(siteMarkerText(0)).toBeUndefined();
    expect(siteMarkerText(null)).toBeUndefined();
    expect(siteMarkerText(1200)).toBe('999+');
    // a cluster adds its sites' alarms up
    expect(clusterAlarmText([21, 25, null])).toBe('46');
    expect(clusterAlarmText([0, null])).toBe('');
  });

  it('clusters overlapping sites, fits every site back into view, and gives each control a phone touch target', async () => {
    const user = userEvent.setup();
    wrap(<AssetsMapDrawer onClose={() => undefined} summary={SUMMARY} onListAssets={() => undefined} onOpenSite={() => undefined} />, fakeAssets());
    expect((await screen.findByTestId('fake-map')).getAttribute('data-cluster')).toBe('true');
    // a cluster of every located site says their active alarms added up
    expect(screen.getByTestId('fake-map').getAttribute('data-cluster-text')).toBe('3');
    const mounts = mapMounts.n;
    await user.click(screen.getByRole('button', { name: 'Fit all' }));
    // a new map fits itself to the markers
    await waitFor(() => expect(mapMounts.n).toBe(mounts + 1));
    expect(screen.getByRole('button', { name: 'Fit all' })).toHaveClass('max-sm:min-h-10');
    expect(screen.getByRole('button', { name: 'Only with active alarms' })).toHaveClass('max-sm:min-h-10');
    await user.click(screen.getByRole('button', { name: 'marker plant' }));
    const card = await screen.findByTestId('assets-map-site');
    for (const b of within(card).getAllByRole('button')) expect(b).toHaveClass('max-sm:min-h-10');
  });

  it('names its loading skeleton, and the asset drawer\'s, from the kit messages', () => {
    const messages = { common: { loading: 'Yükleniyor…' } };
    const { unmount } = render(
      <IotAdapterProvider adapter={{ assets: fakeAssets({ get: () => new Promise(() => undefined) }) }} messages={messages}>
        <AssetsMapDrawer onClose={() => undefined} summary={null} onListAssets={() => undefined} onOpenSite={() => undefined} />
      </IotAdapterProvider>,
    );
    expect(screen.getByLabelText('Yükleniyor…')).toHaveAttribute('aria-busy', 'true');
    unmount();
    render(
      <IotAdapterProvider adapter={{ assets: fakeAssets({ get: () => new Promise(() => undefined) }) }} messages={messages}>
        <AssetDrawer assetId="press-line" onClose={() => undefined} />
      </IotAdapterProvider>,
    );
    expect(screen.getByLabelText('Yükleniyor…')).toHaveAttribute('aria-busy', 'true');
  });

  it('says when no site has a location, and draws neutral markers without alarms', () => {
    const plain = { ...SUMMARY, alarms: false, siteList: SUMMARY.siteList.map((s) => ({ ...s, alarmCount: null, worstSeverity: null, alarmsBySeverity: null })) };
    const { unmount } = wrap(<AssetsMapDrawer onClose={() => undefined} summary={plain} onListAssets={() => undefined} onOpenSite={() => undefined} />, fakeAssets());
    expect(JSON.parse(screen.getByTestId('fake-map').getAttribute('data-markers')!)[0].variant).toBe('neutral');
    expect(screen.queryByRole('button', { name: 'Only with active alarms' })).toBeNull();
    unmount();
    wrap(<AssetsMapDrawer onClose={() => undefined} summary={{ ...SUMMARY, siteList: [SUMMARY.siteList[1]] }} onListAssets={() => undefined} onOpenSite={() => undefined} />, fakeAssets());
    expect(screen.getByText(/No site has a location yet/)).toBeInTheDocument();
  });
});

describe('AssetFormDrawer', () => {
  it('creates under the parent with a custom kind upper-cased and no code (the host derives it), and checks coordinates', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const onSaved = vi.fn();
    wrap(<AssetFormDrawer open parent={{ assetId: 'hall-a', name: 'Hall A' }} onClose={() => undefined} onSaved={onSaved} />, assets);
    expect(screen.getByText('New asset in Hall A')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), 'Cold store 1');
    await user.selectOptions(screen.getByLabelText('Kind'), '__custom__');
    await user.type(screen.getByLabelText(/^Kind name/), 'cold_store');
    await user.type(screen.getByLabelText('Latitude'), '95');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Latitude is -90..90 and longitude -180..180.')).toBeInTheDocument();
    expect(assets.create).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Latitude'));
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(assets.create).toHaveBeenCalledWith({
      name: 'Cold store 1', kind: 'COLD_STORE', description: null, timezone: null, lat: null, lng: null, parentId: 'hall-a',
    }));
    expect(onSaved).toHaveBeenCalledWith('new-1');
  });
});

describe('PlaceDevicesDialog', () => {
  it('places the ticked devices in one call; a device already here is locked', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    const second: DeviceRecord = { ...DEVICE, deviceId: 'd2', name: 'Coolant probe', online: null };
    const devices = { list: vi.fn().mockResolvedValue({ items: [DEVICE, second], total: 2 }), get: vi.fn(), connections: vi.fn() };
    const onPlaced = vi.fn();
    wrap(<PlaceDevicesDialog open asset={{ assetId: 'press-3', name: 'Press 3' }} placedIds={new Set(['d1'])} onClose={() => undefined} onPlaced={onPlaced} />, assets, undefined, { devices });
    expect(await screen.findByLabelText('Coolant probe')).not.toBeChecked();
    expect(within(screen.getByRole('table', { name: 'Devices' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByLabelText('Press sensor')).toBeDisabled();
    await user.click(screen.getByLabelText('Coolant probe'));
    await user.click(screen.getByRole('button', { name: 'Place 1 devices' }));
    await waitFor(() => expect(assets.place).toHaveBeenCalledWith('press-3', ['d2']));
    expect(onPlaced).toHaveBeenCalledWith(['d2']);
  });

  it('searches the devices with the table\'s own search box', async () => {
    const user = userEvent.setup();
    const devices = { list: vi.fn().mockResolvedValue({ items: [DEVICE], total: 1 }), get: vi.fn(), connections: vi.fn() };
    wrap(<PlaceDevicesDialog open asset={{ assetId: 'press-3', name: 'Press 3' }} onClose={() => undefined} />, fakeAssets(), undefined, { devices });
    await screen.findByLabelText('Press sensor');
    await user.type(within(screen.getByRole('dialog')).getByRole('searchbox'), 'probe');
    await waitFor(() => expect(devices.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, search: 'probe' }, expect.anything()));
  });
});

describe('DevicePlacementPanel', () => {
  it('shows where the device is with links, removes the placement, and says when it is not placed', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    wrap(<DevicePlacementPanel deviceId="d1" hrefs={{ asset: (id) => `/a/${id}` }} />, assets);
    expect(await screen.findByRole('link', { name: 'Open asset' })).toHaveAttribute('href', '/a/press-3');
    expect(within(screen.getByRole('navigation', { name: 'Asset path' })).getByRole('link', { name: /Hall A/ })).toHaveAttribute('href', '/a/hall-a');
    await user.click(screen.getByRole('button', { name: 'Remove placement' }));
    await waitFor(() => expect(assets.setPlacement).toHaveBeenCalledWith('d1', null));
    expect(await screen.findByText('This device is not placed on any site or asset.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place on an asset' })).toBeInTheDocument();
  });

  it('offers no change without the capability', async () => {
    wrap(<DevicePlacementPanel deviceId="d1" />, fakeAssets(), {});
    await screen.findByText('Press 3');
    expect(screen.queryByRole('button', { name: 'Change placement' })).toBeNull();
  });
});
