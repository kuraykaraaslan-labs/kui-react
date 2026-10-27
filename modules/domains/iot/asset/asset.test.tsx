import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotAssetsApi, type IotCapabilities } from '../api/adapter';
import {
  assetPath, devicesBelow, filterAssets, flattenAssets, subtreeIds, withoutAssets, type AssetNode, type AssetRecord, type PlacedDevice,
} from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { AssetKindBadge } from './AssetKindBadge';
import { AssetTree } from './AssetTree';
import { MoveAssetDialog } from './MoveAssetDialog';
import { AssetDetailView } from './AssetDetailView';
import { AssetFormDrawer } from './AssetFormDrawer';
import { DevicePlacementPanel } from './DevicePlacementPanel';
import { PlaceDevicesDialog } from './PlaceDevicesDialog';
import { assetKindLabel } from './asset-kind';
import { mergeIotMessages } from '../messages';

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

function fakeAssets(over: Partial<IotAssetsApi> = {}): IotAssetsApi {
  return {
    tree: vi.fn().mockResolvedValue({ nodes: TREE, truncated: false }),
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

describe('AssetDetailView', () => {
  it('shows the path, the header, the inherited time zone, and the devices with their state and address', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets();
    wrap(<AssetDetailView assetId="press-line" nodes={TREE} hrefs={{ asset: (id) => `/a/${id}`, device: (id) => `/d/${id}` }} now={NOW} />, assets);
    expect(await screen.findByRole('heading', { name: 'Press line' })).toBeInTheDocument();
    const crumbs = screen.getByRole('navigation', { name: 'Asset path' });
    expect(within(crumbs).getByRole('link', { name: /Berlin plant/ })).toHaveAttribute('href', '/a/plant');
    expect(screen.getByText('Europe/Berlin (from Hall A)')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Attributes' })).getByText('tonnage')).toBeInTheDocument();
    expect(screen.getByText('800')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Devices' }));
    expect(await screen.findByRole('link', { name: /Press sensor/ })).toHaveAttribute('href', '/d/d1');
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Press 3' })).toHaveAttribute('href', '/a/press-3');
    expect(assets.devices).toHaveBeenCalledWith('press-line', { page: 1, pageSize: 20, recursive: true }, expect.anything());
    await user.click(screen.getByRole('button', { name: 'Remove placement: Press sensor' }));
    await waitFor(() => expect(assets.setPlacement).toHaveBeenCalledWith('d1', null));
  });

  it('pages the devices tab with the table\'s own pagination and rows per page', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets({ devices: vi.fn().mockResolvedValue({ items: PLACED, total: 45 }) });
    wrap(<AssetDetailView assetId="press-line" nodes={TREE} />, assets);
    await user.click(await screen.findByRole('tab', { name: 'Devices' }));
    await screen.findByText('Press sensor');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(assets.devices).toHaveBeenLastCalledWith('press-line', { page: 2, pageSize: 20, recursive: true }, expect.anything()));
    await user.selectOptions(screen.getByLabelText(/Rows per page/), '50');
    await waitFor(() => expect(assets.devices).toHaveBeenLastCalledWith('press-line', { page: 1, pageSize: 50, recursive: true }, expect.anything()));
  });

  it('lists the child assets in a DataTable that opens a child, and says when there are none', async () => {
    const user = userEvent.setup();
    const onOpenAsset = vi.fn();
    const { unmount } = wrap(<AssetDetailView assetId="press-line" nodes={TREE} onOpenAsset={onOpenAsset} />, fakeAssets());
    await screen.findByRole('heading', { name: 'Press line' });
    await user.click(screen.getByRole('tab', { name: 'Child assets' }));
    const table = await screen.findByRole('table', { name: 'Child assets' });
    const row = within(table).getAllByRole('row')[1];
    expect(within(row).getAllByRole('cell').map((c) => c.textContent)).toEqual(['MachinePress 3', '0', '2']);
    await user.click(within(row).getByRole('button', { name: /Press 3/ }));
    expect(onOpenAsset).toHaveBeenCalledWith('press-3');
    unmount();
    wrap(<AssetDetailView assetId="hub" nodes={TREE} />, fakeAssets({ get: vi.fn().mockResolvedValue({ ...RECORD, assetId: 'hub', name: 'Logistics hub', ancestors: [], childCount: 0 }) }));
    await screen.findByRole('heading', { name: 'Logistics hub' });
    await user.click(screen.getByRole('tab', { name: 'Child assets' }));
    expect(within(await screen.findByRole('table', { name: 'Child assets' })).getByText('No child assets.')).toBeInTheDocument();
  });

  it('says why a delete was refused, and hides every action without the capabilities', async () => {
    const user = userEvent.setup();
    const assets = fakeAssets({ remove: vi.fn().mockRejectedValue(new IotApiError('conflict', 'This asset still has child assets: move or delete them first.')) });
    const { notify, unmount } = wrap(<AssetDetailView assetId="press-line" nodes={TREE} />, assets);
    await screen.findByRole('heading', { name: 'Press line' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findAllByRole('button', { name: 'Delete' });
    expect(confirm.length).toBeGreaterThan(1);
    await user.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'error', message: 'This asset cannot be deleted: This asset still has child assets: move or delete them first.' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    unmount();
    wrap(<AssetDetailView assetId="press-line" nodes={TREE} />, fakeAssets(), {});
    await screen.findByRole('heading', { name: 'Press line' });
    for (const name of ['Add child', 'Edit', 'Move to…', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull();
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
