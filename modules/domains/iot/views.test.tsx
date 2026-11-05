import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider, useIotAdapter } from './api/IotAdapterProvider';
import { IotApiError, type DeviceListQuery, type IotAdapter, type IotCapabilities } from './api/adapter';
import type { IotLive, IotLiveState, IotLiveSubscription } from './api/live';
import { DeviceListView } from './device/DeviceListView';
import { DeviceDetailView } from './device/DeviceDetailView';
import { AlarmListView } from './alarm/AlarmListView';
import { AlarmDetailView } from './alarm/AlarmDetailView';
import { AlarmBellMenu, AlarmBellSection, AlarmBellSource, useAlarmBellSource } from './alarm/AlarmBellMenu';
import { NotificationMenu, type NotificationItem } from '@/modules/domains/common/notification/NotificationMenu';
import { ConfirmHost } from '@/modules/ui/ConfirmDialog';
import type { Alarm } from './types/alarm';
import type { DeviceRecord } from './types/device';

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);

const DEVICES: DeviceRecord[] = [
  { deviceId: 'd1', name: 'Pump 4', deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false, online: true, lastActivityAt: ago(60_000) },
  { deviceId: 'd2', name: 'Probe 12', deviceProfileId: 'p1', status: 'QUARANTINED', isGateway: false, online: true, lastActivityAt: ago(60_000) },
];
const alarm = (id: string, patch: Partial<Alarm> = {}): Alarm => ({
  alarmId: id, type: 't', severity: 'MAJOR', status: 'OPEN', title: `Alarm ${id}`, deviceId: 'd1', deviceName: 'Pump 4', openedAt: ago(60_000),
  occurrences: 1, flapping: false, ...patch,
});

/** A fake live source: tests publish into it. */
function createFakeLive(initial: IotLiveState = 'live') {
  const subs = new Set<IotLiveSubscription>();
  const listeners = new Set<(s: IotLiveState) => void>();
  let state = initial;
  const live: IotLive & { publish(kind: string, payload: unknown): void; snapshot(kind: string): void; set(s: IotLiveState): void; subs: Set<IotLiveSubscription> } = {
    get state() { return state; },
    subscribe(sub) { subs.add(sub as IotLiveSubscription); return () => { subs.delete(sub as IotLiveSubscription); }; },
    onState(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    publish(kind, payload) { for (const s of [...subs]) if (s.kind === kind) s.onLive(payload); },
    snapshot(kind) { for (const s of [...subs]) if (s.kind === kind) s.onSnapshot?.({}); },
    set(s) { state = s; for (const l of listeners) l(s); },
    subs,
  };
  return live;
}

function createFakeAdapter(over: Partial<IotAdapter> = {}): IotAdapter {
  return {
    profiles: { options: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Pumps' }]) },
    devices: {
      list: vi.fn().mockImplementation(async (q) => ({ items: q.status ? DEVICES.filter((d) => d.status === q.status) : DEVICES, total: 2 })),
      get: vi.fn().mockImplementation(async (id: string) => ({ ...DEVICES.find((d) => d.deviceId === id)! })),
      create: vi.fn().mockResolvedValue({ device: { ...DEVICES[0], deviceId: 'd9', name: 'New' }, credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'TOKEN-ONCE' } }),
      activate: vi.fn().mockResolvedValue({ activated: 1 }),
      update: vi.fn().mockImplementation(async (id: string, patch: Record<string, unknown>) => ({ ...DEVICES.find((d) => d.deviceId === id)!, ...patch })),
      connections: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      quarantinedCount: vi.fn().mockResolvedValue(1),
      parseState: (p: unknown) => p as never,
    },
    credentials: { get: vi.fn().mockResolvedValue({ type: 'ACCESS_TOKEN' }), rotate: vi.fn().mockResolvedValue({ credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'NEW-ONE' } }) },
    attributes: { list: vi.fn().mockResolvedValue([]), save: vi.fn(), remove: vi.fn() },
    alarms: {
      list: vi.fn().mockResolvedValue({ items: [alarm('a1'), alarm('a2', { status: 'ACKNOWLEDGED' })], total: 2 }),
      get: vi.fn().mockResolvedValue(alarm('a1', { origin: { kind: 'profileRule', profileId: 'p1', ruleId: 'r1', ruleName: 'Too hot' }, runbook: 'Cool it down.' })),
      events: vi.fn().mockResolvedValue([{ eventId: 'e1', kind: 'opened', by: 'flow', at: ago(60_000) }]),
      acknowledge: vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId, i) => ({ alarmId, ok: i === 0 }))),
      clear: vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true }))),
      comment: vi.fn().mockResolvedValue(undefined),
      counts: vi.fn().mockResolvedValue({ open: 1, acknowledged: 1, bySeverity: { CRITICAL: 0, MAJOR: 2, MINOR: 0, WARNING: 0, INFO: 0 } }),
      parseLive: (p: unknown) => p as never,
    },
    ...over,
  };
}

const ALL: Partial<IotCapabilities> = {
  canCreateDevice: true, canEditDevice: true, canViewCredentials: true, canReadAttributes: true, canWriteAttributes: true, canActivateDevice: true,
  canReadAlarms: true, canAcknowledge: true, canClear: true, canComment: true, canDeleteDevice: true,
};

function wrap(ui: React.ReactNode, o: { adapter?: IotAdapter; live?: IotLive | null; caps?: Partial<IotCapabilities>; notify?: (n: unknown) => void } = {}) {
  return render(
    <IotAdapterProvider adapter={o.adapter ?? createFakeAdapter()} live={o.live ?? null} capabilities={o.caps ?? ALL} notify={o.notify} locale="en">
      {ui}
    </IotAdapterProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe('IotAdapterProvider', () => {
  it('throws a clear error without a provider, and nested providers merge their parts', () => {
    function Probe() { const a = useIotAdapter(); return <span>{Object.keys(a).sort().join(',')}</span>; }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/IotAdapterProvider/);
    render(<IotAdapterProvider adapter={{ name: 'a', devices: createFakeAdapter().devices }}><IotAdapterProvider adapter={{ alarms: createFakeAdapter().alarms }}><Probe /></IotAdapterProvider></IotAdapterProvider>);
    expect(screen.getByText('alarms,devices,name')).toBeInTheDocument();
  });

  it('asks the adapter for capabilities and fails closed until it answers', async () => {
    const adapter = createFakeAdapter({ capabilities: vi.fn().mockResolvedValue({ canViewCredentials: false, canReadAttributes: true }) });
    render(<IotAdapterProvider adapter={adapter}><DeviceDetailView deviceId="d1" /></IotAdapterProvider>);
    await screen.findByRole('heading', { name: 'Pump 4' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Attributes' })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Credentials' })).toBeNull();
  });
});

describe('DeviceListView', () => {
  it('lists devices, filters through the adapter and reports the query', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    expect(await screen.findByRole('link', { name: /Pump 4/ })).toHaveAttribute('href', '/d/d1');
    // the DataTable's own Filters panel, not a select beside the table
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Connection'), 'last_seen');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(adapter.devices!.list).toHaveBeenLastCalledWith(expect.objectContaining({ online: 'last_seen', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ online: 'last_seen' }), 'replace');
    expect(screen.getByRole('button', { name: /Remove filter Connection/ })).toBeInTheDocument();
  });

  it('edits a device from its row without opening the quick view, and the list reads again after the save', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    await screen.findByRole('link', { name: /Pump 4/ });
    await user.click(screen.getByRole('button', { name: 'Edit Pump 4' }));
    const drawer = await screen.findByRole('dialog', { name: 'Edit device' });
    expect(onQueryChange).not.toHaveBeenCalledWith(expect.objectContaining({ device: 'd1' }), expect.anything());
    await user.type(within(drawer).getByLabelText('Label'), 'Boiler room');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.devices!.update).toHaveBeenCalledWith('d1', { label: 'Boiler room' }));
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
  });

  it('shows no row Edit without the capability', async () => {
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} now={NOW} />, { caps: { ...ALL, canEditDevice: false } });
    await screen.findByRole('link', { name: /Pump 4/ });
    expect(screen.queryByRole('button', { name: 'Edit Pump 4' })).toBeNull();
  });

  it('sorts, searches and pages on the server through the table\'s own toolbar', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    (adapter.devices!.list as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ items: DEVICES, total: 45 }));
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    await screen.findByText('Pump 4');
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    expect(list).toHaveBeenCalledTimes(1); // the table's first report is the query already read
    expect(screen.queryByRole('columnheader', { name: /Profile/ })).not.toHaveAttribute('aria-sort');

    await user.click(within(screen.getByRole('columnheader', { name: /Last seen/ })).getByRole('button'));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'lastSeen', dir: 'asc' }, page: 1 }), expect.anything()));
    expect(screen.getByRole('columnheader', { name: /Last seen/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'lastSeen', dir: 'asc' } }), 'replace');

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, sort: { key: 'lastSeen', dir: 'asc' } }), expect.anything()));

    await user.selectOptions(screen.getByLabelText(/Rows per page/), '50');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 50 }), expect.anything()));

    await user.type(screen.getByRole('searchbox'), 'pump');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'pump', page: 1, pageSize: 50 }), expect.anything()));
  });

  it('starts from the host\'s query (sort, rows per page, filters) and shows it in the table', async () => {
    const adapter = createFakeAdapter();
    wrap(
      <DeviceListView hrefs={{ device: (id) => id }} initialQuery={{ page: 1, pageSize: 50, sort: { key: 'name', dir: 'desc' }, status: 'ACTIVE' }} now={NOW} />,
      { adapter },
    );
    await screen.findByText('Pump 4');
    expect(adapter.devices!.list).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 50, sort: { key: 'name', dir: 'desc' }, status: 'ACTIVE' }), expect.anything());
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByLabelText(/Rows per page/)).toHaveValue('50');
    expect(screen.getByRole('button', { name: /Remove filter Status/ })).toBeInTheDocument();
  });

  it('lets the viewer hide columns but the name, saved in this browser as iot.devices', async () => {
    const user = userEvent.setup();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter: createFakeAdapter() });
    await screen.findByText('Pump 4');
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    const panel = screen.getByRole('dialog', { name: 'Columns' });
    expect(within(panel).queryByLabelText('Name')).toBeNull();
    await user.click(within(panel).getByLabelText('Firmware'));
    expect(screen.queryByRole('columnheader', { name: /Firmware/ })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('kui.dataTable.columns.v1.iot.devices')!)).toEqual({ firmware: false });
    window.localStorage.clear();
  });

  it('keeps a filter applied from page 2: the list, the URL and the chip stay filtered on page 1', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    list.mockImplementation(async () => ({ items: DEVICES, total: 45 }));
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    await screen.findByText('Pump 4');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()));
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Connection'), 'last_seen');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ online: 'last_seen', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ online: 'last_seen', page: 1 }), 'replace');
    expect(screen.getByRole('button', { name: /Remove filter Connection/ })).toBeInTheDocument();
    // the Quarantined (n) quick filter from page 2 as well
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, online: 'last_seen' }), expect.anything()));
    await user.click(screen.getByRole('button', { name: 'Quarantined (1)' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'QUARANTINED', online: 'last_seen', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'QUARANTINED', page: 1 }), 'replace');
  });

  it('offers the Quarantined (n) filter and bulk Activate only with the capability', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const { unmount } = wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Quarantined (1)' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Select Probe 12' }));
    await user.click(screen.getByRole('button', { name: 'Activate (1)' }));
    expect(adapter.devices!.activate).toHaveBeenCalledWith(['d2']);
    unmount();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter: createFakeAdapter(), caps: { ...ALL, canActivateDevice: false } });
    await user.click(await screen.findByRole('button', { name: 'Quarantined (1)' }));
    expect(screen.queryByRole('checkbox', { name: 'Select Probe 12' })).toBeNull();
  });

  it('creates a device and shows its token once; the drawer waits for "I have stored it", and the token is gone after it', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} onOpen={onOpen} now={NOW} />);
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    await user.click(screen.getByRole('button', { name: 'Create device' }));
    expect(screen.getByText('A name is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), 'New');
    await user.click(screen.getByRole('button', { name: 'Create device' }));
    await user.click(await screen.findByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('issued-secret')).toHaveTextContent('TOKEN-ONCE');
    // NB 41-ui-fixes/21 1.1: Esc, the close button, Close and Open device all wait while the token is not stored
    const dialog = screen.getByRole('dialog', { name: 'New device' });
    expect(within(dialog).getByText(/Store the access token first/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    for (const b of within(dialog).getAllByRole('button', { name: 'Close' })) await user.click(b);
    expect(screen.getByTestId('issued-secret')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Close' }).some((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Open device' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'I have stored it' }));
    expect(screen.queryByTestId('issued-secret')).toBeNull();
    expect(within(dialog).getByText('The access token was handed over. It cannot be shown again.')).toBeInTheDocument();
    // Open device: the host's router on a plain click
    await user.click(within(dialog).getByRole('link', { name: 'Open device' }));
    expect(onOpen).toHaveBeenCalledWith('/d/d9');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New device' })).toBeNull());
  });

  it('Enter in a field creates; Create is disabled and the drawer stays while the create runs (1.14, 1.24)', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    let finish!: (v: unknown) => void;
    (adapter.devices!.create as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise((r) => { finish = r; }));
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    await user.type(screen.getByLabelText(/^Name/), 'Pump 9{Enter}');
    expect(adapter.devices!.create).toHaveBeenCalledTimes(1);
    const create = screen.getByRole('button', { name: 'Create device' });
    expect(create).toBeDisabled();
    await user.click(create);
    await user.keyboard('{Escape}');
    expect(adapter.devices!.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'New device' })).toBeInTheDocument();
    await act(async () => { finish({ device: { ...DEVICES[0], deviceId: 'd9', name: 'Pump 9' }, credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'T' } }); });
    expect(await screen.findByTestId('issued-secret')).toBeInTheDocument();
  });

  it('says when no credential was issued (a profile without access tokens), and who can set one (1.2, N4)', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    (adapter.devices!.create as ReturnType<typeof vi.fn>).mockResolvedValue({ device: { ...DEVICES[0], deviceId: 'd9', name: 'New' }, credential: null, secret: null });
    const { unmount } = wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} now={NOW} />, { adapter, caps: { ...ALL, canViewCredentials: false } });
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    await user.type(screen.getByLabelText(/^Name/), 'New{Enter}');
    expect(await screen.findByText(/No credential was issued/)).toHaveTextContent('An administrator can set one on its Credentials tab.');
    expect(screen.queryByTestId('issued-secret')).toBeNull();
    // nothing to store: Close closes at once
    expect(within(screen.getByRole('dialog', { name: 'New device' })).getByRole('link', { name: 'Open device' })).toHaveAttribute('href', '/d/d9');
    unmount();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    await user.type(screen.getByLabelText(/^Name/), 'New{Enter}');
    expect(await screen.findByText(/No credential was issued/)).toHaveTextContent('Set one on its Credentials tab.');
  });

  it('offers the host\'s ways to add a device beside "Other device", each in the drawer with "Choose another way" back to the choice', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const choice = {
      id: 'vendor', label: 'Vendor device', description: 'With the code on its screen',
      render: ({ added }: { close: () => void; added: () => void }) => <button type="button" onClick={added}>Claim it</button>,
    };
    wrap(<DeviceListView hrefs={{ device: (id) => id }} addChoices={[choice]} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    expect(screen.getByText('What are you adding?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Vendor device/ }));
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    const reads = list.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Claim it' }));
    await waitFor(() => expect(list.mock.calls.length).toBe(reads + 1));
    // never "Back": the host's screen may have a Back of its own (a wizard's previous step)
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Choose another way' }));
    await user.click(screen.getByRole('button', { name: /Other device/ }));
    expect(screen.getByRole('button', { name: 'Create device' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose another way' }));
    expect(screen.getByRole('button', { name: /Vendor device/ })).toBeInTheDocument();
  });

  it('opens a host choice at once when the role cannot create, and shows no New device without either', async () => {
    const user = userEvent.setup();
    const choice = { id: 'vendor', label: 'Vendor device', render: () => <p>vendor screen</p> };
    const { unmount } = wrap(<DeviceListView hrefs={{ device: (id) => id }} addChoices={[choice]} now={NOW} />, { caps: { ...ALL, canCreateDevice: false } });
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    expect(screen.getByText('vendor screen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose another way' })).toBeNull();
    unmount();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { caps: { ...ALL, canCreateDevice: false } });
    await screen.findByText('Pump 4');
    expect(screen.queryByRole('button', { name: /New device/ })).toBeNull();
  });

  it('opens the host\'s approval view from "Awaiting approval (n)" in place of the quick filter, and re-reads on a change', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const renderQuarantine = ({ changed }: { close: () => void; changed: () => void }) => <button type="button" onClick={changed}>Approve all</button>;
    wrap(<DeviceListView hrefs={{ device: (id) => id }} renderQuarantine={renderQuarantine} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Awaiting approval (1)' }));
    expect(screen.queryByRole('button', { name: 'Quarantined (1)' })).toBeNull();
    const dialog = screen.getByRole('dialog', { name: 'Devices awaiting approval' });
    const count = adapter.devices!.quarantinedCount as ReturnType<typeof vi.fn>;
    const before = count.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Approve all' }));
    await waitFor(() => expect(count.mock.calls.length).toBe(before + 1));
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Devices awaiting approval' })).toBeNull());
  });

  it('puts the host\'s more actions in a "⋯" menu, and draws none without them', async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<DeviceListView hrefs={{ device: (id) => id }} moreActions={[{ id: 'map', label: 'Readings mapping', href: '/bindings' }]} now={NOW} />);
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Readings mapping' })).toHaveAttribute('href', '/bindings');
    unmount();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />);
    await screen.findByText('Pump 4');
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('patches a row from deviceState live', async () => {
    const live = createFakeLive();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { live });
    await screen.findByText('Pump 4');
    expect(live.subs.size).toBe(1);
    expect([...live.subs][0].params).toEqual({ deviceId: '*' });
    act(() => live.publish('deviceState', { deviceId: 'd1', online: false, reason: 'keepalive_timeout' }));
    const row = screen.getByText('Pump 4').closest('tr')!;
    await waitFor(() => expect(within(row).getByText('Offline')).toBeInTheDocument());
  });

  it('re-reads every 30 s while the live source is not live', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = createFakeAdapter();
    const live = createFakeLive('polling');
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter, live });
    await screen.findByText('Pump 4');
    const before = (adapter.devices!.list as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect((adapter.devices!.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before + 1);
    act(() => live.set('live'));
    await act(async () => { vi.advanceTimersByTime(59_000); });
    expect((adapter.devices!.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before + 1);
    // while live, a slow re-read about every minute (41-ui-fixes/21 1.10)
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect((adapter.devices!.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before + 2);
  });

  it('while live: no slow re-read while the tab is hidden; a patch naming a device it does not show reads again once (1.10)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    const live = createFakeLive('live');
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter, live });
    await screen.findByText('Pump 4');
    const before = list.mock.calls.length;
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(list.mock.calls.length).toBe(before);
    hidden.mockRestore();
    // a device added elsewhere connects: one re-read soon after, and none again for the same device while it is not on this page
    act(() => { live.publish('deviceState', { deviceId: 'd7', online: true }); live.publish('deviceState', { deviceId: 'd8', online: true }); });
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(list.mock.calls.length).toBe(before + 1);
    await act(async () => { await Promise.resolve(); });
    act(() => live.publish('deviceState', { deviceId: 'd7', online: false }));
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(list.mock.calls.length).toBe(before + 1);
  });

  it('while live and filtered to online: a shown device that goes offline makes the list read again (1.10)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    const live = createFakeLive('live');
    wrap(<DeviceListView hrefs={{ device: (id) => id }} initialQuery={{ online: 'online' }} now={NOW} />, { adapter, live });
    await screen.findByText('Pump 4');
    const before = list.mock.calls.length;
    act(() => live.publish('deviceState', { deviceId: 'd1', online: true }));
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(list.mock.calls.length).toBe(before);
    act(() => live.publish('deviceState', { deviceId: 'd1', online: false }));
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(list.mock.calls.length).toBe(before + 1);
  });

  it('shows only the newest read: a late answer of an older query neither replaces the rows nor leaves the table loading (1.8)', async () => {
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    let late!: (v: unknown) => void;
    list.mockImplementationOnce(() => new Promise((r) => { late = r; }));
    const ui = (q: Partial<DeviceListQuery>) => (
      <IotAdapterProvider adapter={adapter} live={null} capabilities={ALL} locale="en"><DeviceListView hrefs={{ device: (id) => id }} initialQuery={q} now={NOW} /></IotAdapterProvider>
    );
    const { rerender } = render(ui({}));
    rerender(ui({ status: 'QUARANTINED' }));
    expect(await screen.findByText('Probe 12')).toBeInTheDocument();
    await act(async () => { late({ items: [{ ...DEVICES[0], name: 'Stale pump' }], total: 1 }); });
    expect(screen.queryByText('Stale pump')).toBeNull();
    expect(screen.getByText('Probe 12')).toBeInTheDocument();
  });

  it('moves a page past the end to the last page (1.9)', async () => {
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    list.mockImplementation(async (q: DeviceListQuery) => (q.page > 1 ? { items: [], total: 2 } : { items: DEVICES, total: 2 }));
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} initialQuery={{ page: 7 }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    expect(await screen.findByText('Pump 4')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.anything());
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), 'replace');
  });

  it('follows the host\'s query by value: the filters and page it names, its own rows per page when the host names none (1.19)', async () => {
    const adapter = createFakeAdapter();
    const list = adapter.devices!.list as ReturnType<typeof vi.fn>;
    const ui = (q: Partial<DeviceListQuery>) => (
      <IotAdapterProvider adapter={adapter} live={null} capabilities={ALL} locale="en"><DeviceListView hrefs={{ device: (id) => id }} initialQuery={q} pageSize={50} now={NOW} /></IotAdapterProvider>
    );
    const { rerender } = render(ui({ status: 'ACTIVE' }));
    await screen.findByText('Pump 4');
    rerender(ui({ status: 'ACTIVE' }));
    expect(list).toHaveBeenCalledTimes(1);
    rerender(ui({ online: 'offline', page: 2 }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ online: 'offline', page: 2, pageSize: 50 }), expect.anything()));
    expect(list.mock.calls.at(-1)![0]).not.toHaveProperty('status', 'ACTIVE');
  });

  it('opens a device in the host\'s router on a plain click; a modified click keeps the link (1.22)', async () => {
    const onOpen = vi.fn();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} onOpen={onOpen} now={NOW} />);
    const link = await screen.findByRole('link', { name: /Pump 4/ });
    fireEvent.click(link, { ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith('/d/d1');
  });

  it('cuts a typed search to what the host takes (N3)', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    wrap(<DeviceListView hrefs={{ device: (id) => id }} now={NOW} />, { adapter });
    await screen.findByText('Pump 4');
    await user.click(screen.getByRole('searchbox'));
    await user.paste('x'.repeat(140));
    await waitFor(() => expect(adapter.devices!.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'x'.repeat(128) }), expect.anything()));
  });

  it('says when the capabilities could not be read, with a retry (1.12)', async () => {
    const user = userEvent.setup();
    const capabilities = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(ALL);
    render(<IotAdapterProvider adapter={createFakeAdapter({ capabilities })} live={null} locale="en"><DeviceListView hrefs={{ device: (id) => id }} now={NOW} /></IotAdapterProvider>);
    expect(await screen.findByText(/could not be read, so nothing can be changed yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New device/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /New device/ })).toBeInTheDocument();
    expect(screen.queryByText(/could not be read, so nothing can be changed yet/)).toBeNull();
  });

  it('says when the profiles could not be read, and keeps a profile filter by the name its rows carry (1.11, N2)', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const options = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([{ id: 'p1', name: 'Pumps' }]);
    adapter.profiles = { options };
    (adapter.devices!.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [{ ...DEVICES[0], deviceProfileId: 'p7', profileName: 'Far pumps' }], total: 1 });
    wrap(<DeviceListView hrefs={{ device: (id) => id }} initialQuery={{ profileId: 'p7' }} now={NOW} />, { adapter });
    expect(await screen.findByText(/device profiles could not be read/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/device profiles could not be read/)).toBeNull());
    expect(options).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const select = within(screen.getByRole('form', { name: 'Filters' })).getByLabelText('Profile') as HTMLSelectElement;
    expect(select.value).toBe('p7');
    expect(select.selectedOptions[0].textContent).toBe('Far pumps');
  });
});

describe('DeviceDetailView', () => {
  it('hides the credentials tab without the capability and shows contributed tabs; no factory reset', async () => {
    wrap(<DeviceDetailView deviceId="d1" extraTabs={[{ id: 'alarms', label: 'Alarms', order: 50, content: <p>alarms here</p> }]} />, { caps: { ...ALL, canViewCredentials: false } });
    await screen.findByRole('heading', { name: 'Pump 4' });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Overview', 'Attributes', 'Log', 'Alarms']);
    expect(screen.queryByText(/factory reset/i)).toBeNull();
  });

  it('hides the credentials tab for a device that does not log in itself (its record says deviceCredentials: false), and only then', async () => {
    const base = createFakeAdapter();
    const adapter = createFakeAdapter({ devices: { ...base.devices!, get: vi.fn().mockImplementation(async (id: string) => ({ ...DEVICES.find((d) => d.deviceId === id)!, deviceCredentials: false })) } });
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
    await screen.findByRole('heading', { name: 'Pump 4' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Attributes', 'Log']);
    expect(adapter.credentials!.get).not.toHaveBeenCalled();
    cleanup();
    const unknown = createFakeAdapter({ devices: { ...base.devices!, get: vi.fn().mockImplementation(async (id: string) => ({ ...DEVICES.find((d) => d.deviceId === id)!, deviceCredentials: null })) } });
    wrap(<DeviceDetailView deviceId="d1" />, { adapter: unknown });
    await screen.findByRole('heading', { name: 'Pump 4' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Attributes', 'Credentials', 'Log']);
  });

  it('rotates the credential and shows the new secret once', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Rotate secret' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' }));
    await user.click(await screen.findByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('issued-secret')).toHaveTextContent('NEW-ONE');
    await user.click(screen.getByRole('button', { name: 'I have stored it' }));
    expect(screen.queryByTestId('issued-secret')).toBeNull();
  });

  it('edits the name, label and type of a device and sends only what changed; the page then reads the device again', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    wrap(<><ConfirmHost /><DeviceDetailView deviceId="d1" /></>, { adapter });
    await screen.findByRole('heading', { name: 'Pump 4' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    const name = within(drawer).getByLabelText(/^Name/);
    expect(name).toHaveValue('Pump 4');
    await user.clear(name);
    await user.type(name, 'Pump 5');
    expect(within(drawer).getByText(/ends the device's live connection/)).toBeInTheDocument();
    await user.type(within(drawer).getByLabelText('Label'), 'Boiler room');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    // a new name ends the live session: the ConfirmDialog asks first, and a "no" sends nothing
    const confirm = await screen.findByRole('dialog', { name: 'Save changes to Pump 4?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(adapter.devices!.update).not.toHaveBeenCalled();
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Save changes to Pump 4?' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.devices!.update).toHaveBeenCalledWith('d1', { name: 'Pump 5', label: 'Boiler room' }));
    await waitFor(() => expect(adapter.devices!.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('edits the profile, the status and the additional info; disabling asks first, a quarantined device keeps its status', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    (adapter.profiles!.options as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'p1', name: 'Pumps' }, { id: 'p2', name: 'Meters' }]);
    (adapter.devices!.get as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => ({ ...DEVICES.find((d) => d.deviceId === id)!, additionalInfo: { room: 'B2' } }));
    wrap(<><ConfirmHost /><DeviceDetailView deviceId="d1" /></>, { adapter });
    await screen.findByRole('heading', { name: 'Pump 4' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    const info = within(drawer).getByLabelText('Additional info');
    expect((info as HTMLTextAreaElement).value).toContain('"room": "B2"');
    await user.clear(info);
    await user.type(info, 'not json');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(within(drawer).getByText(/must be a JSON object/)).toBeInTheDocument();
    expect(adapter.devices!.update).not.toHaveBeenCalled();
    await user.clear(info);
    await user.selectOptions(within(drawer).getByLabelText('Status'), 'DISABLED');
    await user.selectOptions(within(drawer).getByLabelText(/^Profile/), 'p2');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    const confirm = await screen.findByRole('dialog', { name: 'Disable Pump 4?' });
    await user.click(within(confirm).getByRole('button', { name: 'Disable' }));
    await waitFor(() => expect(adapter.devices!.update).toHaveBeenCalledWith('d1', { profileId: 'p2', status: 'DISABLED', additionalInfo: null }));
  });

  it('offers no status choice for a quarantined device', async () => {
    const user = userEvent.setup();
    wrap(<DeviceDetailView deviceId="d2" />);
    await screen.findByRole('heading', { name: 'Probe 12' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).queryByLabelText('Status')).toBeNull();
    expect(within(drawer).getByText(/Approve it with Activate/)).toBeInTheDocument();
  });

  it('keeps the edit drawer open with the host\'s field error, refuses an empty name and offers Edit only with the capability', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    (adapter.devices!.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new IotApiError('validation', 'The label is too long.', { fieldErrors: { label: 'Too long.' } }));
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
    await screen.findByRole('heading', { name: 'Pump 4' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    await user.clear(within(drawer).getByLabelText(/^Name/));
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(within(drawer).getByText('A name is required.')).toBeInTheDocument();
    expect(adapter.devices!.update).not.toHaveBeenCalled();
    await user.type(within(drawer).getByLabelText(/^Name/), 'Pump 4');
    await user.type(within(drawer).getByLabelText('Label'), 'x');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect(await within(drawer).findByText('The label is too long.')).toBeInTheDocument();
    expect(within(drawer).getByText('Too long.')).toBeInTheDocument();
  });

  it('offers no Edit without the capability or without devices.update', async () => {
    const { unmount } = wrap(<DeviceDetailView deviceId="d1" />, { caps: { ...ALL, canEditDevice: false } });
    await screen.findByRole('heading', { name: 'Pump 4' });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    unmount();
    const adapter = createFakeAdapter();
    delete (adapter.devices as { update?: unknown }).update;
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
    await screen.findByRole('heading', { name: 'Pump 4' });
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('activates a quarantined device and follows its state live', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const live = createFakeLive();
    wrap(<DeviceDetailView deviceId="d2" />, { adapter, live });
    await user.click(await screen.findByRole('button', { name: 'Activate' }));
    expect(adapter.devices!.activate).toHaveBeenCalledWith(['d2']);
    expect([...live.subs][0].params).toEqual({ deviceId: 'd2' });
  });

  it('shows the error with a retry', async () => {
    const adapter = createFakeAdapter();
    (adapter.devices!.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new IotApiError('not_found', 'Device not found.'));
    wrap(<DeviceDetailView deviceId="dx" />, { adapter });
    expect(await screen.findByRole('alert')).toHaveTextContent('Device not found.');
  });
});

describe('AlarmListView', () => {
  it('bulk acknowledges with one note and reports done and skipped', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const notify = vi.fn();
    wrap(<AlarmListView hrefs={{ alarm: (id) => `/a/${id}` }} now={NOW} />, { adapter, notify });
    await user.click(await screen.findByRole('checkbox', { name: 'Select all rows on this page' }));
    await user.click(screen.getByRole('button', { name: 'Acknowledge (2)' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'on it');
    await user.click(within(dialog).getByRole('button', { name: 'Acknowledge (2)' }));
    await waitFor(() => expect(adapter.alarms!.acknowledge).toHaveBeenCalledWith(['a1', 'a2'], 'on it'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'info', message: '1 done, 1 skipped' }));
  });

  it('shows the counts, filters by severity and asks a resolved list for a bounded range', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} now={NOW} />, { adapter });
    expect(await screen.findByRole('button', { name: 'Open (1)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.click(within(panel).getByRole('checkbox', { name: 'Critical' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(adapter.alarms!.list).toHaveBeenLastCalledWith(expect.objectContaining({ severity: ['CRITICAL'] }), expect.anything()));
    // the status is the table's toolbar choice, always set
    expect(screen.getByLabelText('Status')).toHaveValue('active');
    await user.selectOptions(screen.getByLabelText('Status'), 'any');
    await waitFor(() => expect(adapter.alarms!.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'any', from: expect.any(String) }), expect.anything()));
  });

  it('keeps a status, a count chip or a severity applied from page 2', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const list = adapter.alarms!.list as ReturnType<typeof vi.fn>;
    list.mockResolvedValue({ items: [alarm('a1')], total: 45 });
    const onQueryChange = vi.fn();
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    await screen.findByText('Alarm a1');
    const toPage2 = async () => {
      await user.click(screen.getByRole('button', { name: 'Page 2' }));
      await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()));
    };
    await toPage2();
    await user.selectOptions(screen.getByLabelText('Status'), 'any');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'any', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'any', page: 1 }));
    expect(screen.getByLabelText('Status')).toHaveValue('any');
    await toPage2();
    await user.click(screen.getByRole('button', { name: 'Open (1)' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'OPEN', page: 1 }), expect.anything()));
    expect(screen.getByLabelText('Status')).toHaveValue('OPEN');
    await toPage2();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.click(within(panel).getByRole('checkbox', { name: 'Critical' }));
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'OPEN', severity: ['CRITICAL'], page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ severity: ['CRITICAL'], page: 1 }));
  });

  it('lets the viewer hide columns but the alarm, the list and a device\'s tab saved apart', async () => {
    const user = userEvent.setup();
    const { unmount } = wrap(<AlarmListView hrefs={{ alarm: (id) => id }} now={NOW} />, { adapter: createFakeAdapter() });
    await user.click(await screen.findByRole('button', { name: /Columns/ }));
    let panel = screen.getByRole('dialog', { name: 'Columns' });
    expect(within(panel).queryByLabelText('Alarm')).toBeNull();
    await user.click(within(panel).getByLabelText('Device'));
    expect(JSON.parse(window.localStorage.getItem('kui.dataTable.columns.v1.iot.alarms')!)).toEqual({ device: false });
    unmount();
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} deviceId="d1" now={NOW} />, { adapter: createFakeAdapter() });
    await user.click(await screen.findByRole('button', { name: /Columns/ }));
    panel = screen.getByRole('dialog', { name: 'Columns' });
    await user.click(within(panel).getByLabelText('Status'));
    expect(JSON.parse(window.localStorage.getItem('kui.dataTable.columns.v1.iot.device.alarms')!)).toEqual({ status: false });
    window.localStorage.clear();
  });

  it('acknowledges every open alarm of its device with one note', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    adapter.alarms!.acknowledge = vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true })));
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} deviceId="d1" now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Acknowledge all (1)' }));
    await user.type(screen.getByLabelText(/note/i), 'night shift');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Acknowledge all (1)' }));
    await waitFor(() => expect(adapter.alarms!.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN', deviceId: 'd1', pageSize: 100 })));
    expect(adapter.alarms!.acknowledge).toHaveBeenCalledWith(expect.any(Array), 'night shift');
  });

  it('puts a new live alarm on top of the first page and counts it elsewhere', async () => {
    const user = userEvent.setup();
    const live = createFakeLive();
    const adapter = createFakeAdapter();
    (adapter.alarms!.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [alarm('a1')], total: 45 });
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} now={NOW} />, { adapter, live });
    await screen.findByText('Alarm a1');
    act(() => live.publish('alarms', { alarm: alarm('a9', { title: 'Fresh one' }), transition: 'created' }));
    const row = (await screen.findByText('Fresh one')).closest('tr')!;
    expect(row).toHaveAttribute('data-state', 'new');
    act(() => live.publish('alarms', { alarm: alarm('a8', { severity: 'INFO' }), transition: 'updated' }));
    expect(screen.queryByText('Alarm a8')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    act(() => live.publish('alarms', { alarm: alarm('a7'), transition: 'created' }));
    expect(await screen.findByRole('button', { name: '1 new alarms: show' })).toBeInTheDocument();
  });

  it('sorts on the server, and a new live alarm in another order only counts toward the pill', async () => {
    const user = userEvent.setup();
    const live = createFakeLive();
    const adapter = createFakeAdapter();
    (adapter.alarms!.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [alarm('a1')], total: 1 });
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} now={NOW} />, { adapter, live });
    await screen.findByText('Alarm a1');
    await user.click(within(screen.getByRole('columnheader', { name: /Severity/ })).getByRole('button'));
    await waitFor(() => expect(adapter.alarms!.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'severity', dir: 'asc' }, page: 1 }), expect.anything()));
    act(() => live.publish('alarms', { alarm: alarm('a9', { title: 'Fresh one' }), transition: 'created' }));
    expect(await screen.findByRole('button', { name: '1 new alarms: show' })).toBeInTheDocument();
    expect(screen.queryByText('Fresh one')).toBeNull();
  });

  it('scopes to one device in its Alarms tab', async () => {
    const live = createFakeLive();
    const adapter = createFakeAdapter();
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} deviceId="d1" embedded />, { adapter, live });
    await screen.findByText('Alarm a1');
    expect(adapter.alarms!.list).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 'd1' }), expect.anything());
    expect([...live.subs][0].params).toEqual({ deviceId: 'd1' });
    expect(screen.queryByRole('heading', { name: 'Alarms' })).toBeNull();
  });
});

describe('AlarmDetailView', () => {
  it('acknowledges optimistically and rolls back when the alarm changed meanwhile', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    (adapter.alarms!.acknowledge as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ alarmId: 'a1', ok: false, reason: 'already_acknowledged' }]);
    const notify = vi.fn();
    wrap(<AlarmDetailView alarmId="a1" />, { adapter, notify });
    await user.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'info' })));
    expect(screen.getByText('Too hot', { exact: false })).toBeInTheDocument();
  });

  it('opens the runbook, adds a note, and hides actions without the capabilities', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const { unmount } = wrap(<AlarmDetailView alarmId="a1" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Runbook' }));
    expect(await screen.findByText('Cool it down.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText('Add a note'), 'checked');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(adapter.alarms!.comment).toHaveBeenCalledWith('a1', 'checked');
    unmount();
    wrap(<AlarmDetailView alarmId="a1" />, { adapter: createFakeAdapter(), caps: { canReadAlarms: true } });
    await screen.findByRole('button', { name: 'Runbook' });
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(screen.queryByLabelText('Add a note')).toBeNull();
  });

  it('follows its alarm live', async () => {
    const live = createFakeLive();
    wrap(<AlarmDetailView alarmId="a1" />, { live });
    await screen.findByRole('button', { name: 'Acknowledge' });
    act(() => live.publish('alarms', { alarm: alarm('a1', { status: 'RESOLVED' }), transition: 'cleared' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull());
  });
});

describe('AlarmBellMenu', () => {
  it('shows the count, lists the latest and acknowledges inline; nothing without read', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const { unmount } = wrap(<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => `/a/${id}` }} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Alarms: Open (1)' }));
    expect(screen.getByRole('link', { name: 'Alarm a1' })).toHaveAttribute('href', '/a/a1');
    await user.click(screen.getAllByRole('button', { name: 'Acknowledge' })[0]);
    expect(adapter.alarms!.acknowledge).toHaveBeenCalledWith(['a1']);
    unmount();
    const { container } = wrap(<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => id }} />, { caps: {} });
    expect(container).toBeEmptyDOMElement();
  });

  it('acknowledges every open alarm page by page from the panel, behind the confirmation with its note', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const open = [alarm('a1'), alarm('a2')];
    adapter.alarms!.list = vi.fn().mockImplementation(async (q: { status?: string }) => (q.status === 'OPEN'
      ? { items: open.splice(0), total: 2 }
      : { items: [alarm('a1')], total: 1 }));
    adapter.alarms!.acknowledge = vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true })));
    wrap(<><ConfirmHost /><AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => id }} now={NOW} /></>, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Alarms: Open (1)' }));
    await user.click(screen.getByRole('button', { name: 'Acknowledge all (1)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acknowledge all (1)' });
    expect(adapter.alarms!.acknowledge).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Shift handover');
    await user.click(within(dialog).getByRole('button', { name: 'Acknowledge all (1)' }));
    await waitFor(() => expect(adapter.alarms!.acknowledge).toHaveBeenCalledWith(['a1', 'a2'], 'Shift handover'));
    expect(adapter.alarms!.acknowledge).toHaveBeenCalledTimes(1);
  });

  it('as a section of another bell, reports its open count and shows its panel', async () => {
    const adapter = createFakeAdapter();
    const onCount = vi.fn();
    const { unmount } = wrap(<AlarmBellSection hrefs={{ alarms: '/alarms', alarm: (id) => `/a/${id}` }} now={NOW} onCount={onCount} />, { adapter });
    expect(await screen.findByRole('link', { name: 'Alarm a1' })).toBeInTheDocument();
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
    unmount();
    expect(onCount).toHaveBeenLastCalledWith(0);
  });

  it('follows the live events without asking the host again', async () => {
    const live = createFakeLive();
    const adapter = createFakeAdapter();
    wrap(<AlarmBellSection hrefs={HREFS} now={NOW} />, { adapter, live });
    // the first answer goes with the subscription's snapshot
    expect(adapter.alarms!.counts).not.toHaveBeenCalled();
    act(() => live.snapshot('alarms'));
    await screen.findByRole('link', { name: 'Alarm a1' });
    expect(screen.getByText('Open (1) · Acknowledged (1)')).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a7', { openedAt: ago(1_000), severity: 'CRITICAL' }), transition: 'created' }));
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Alarm a7', 'Alarm a1', 'Alarm a2', 'View all alarms']);
    expect(screen.getByText('Open (2) · Acknowledged (1)')).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a1', { status: 'ACKNOWLEDGED', acknowledgedAt: ago(0) }), transition: 'acknowledged' }));
    expect(screen.getByText('Open (1) · Acknowledged (2)')).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a2', { status: 'RESOLVED', acknowledgedAt: ago(0), resolvedAt: ago(0) }), transition: 'cleared' }));
    expect(screen.getByText('Open (1) · Acknowledged (1)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alarm a2' })).toBeNull();
    // a late copy of a1's opening changes nothing
    act(() => live.publish('alarms', { alarm: alarm('a1'), transition: 'created' }));
    expect(screen.getByText('Open (1) · Acknowledged (1)')).toBeInTheDocument();
    expect(adapter.alarms!.counts).toHaveBeenCalledTimes(1);
    expect(adapter.alarms!.list).toHaveBeenCalledTimes(1);
    // a reconnect (a later snapshot of the subscription) asks again
    act(() => live.snapshot('alarms'));
    await waitFor(() => expect(adapter.alarms!.counts).toHaveBeenCalledTimes(2));
  });
});

const HREFS = { alarms: '/alarms', alarm: (id: string) => `/a/${id}` };

/** A host bell: its own notifications and the alarms in one list. */
function OneList({ onNavigate, notes = [] }: { onNavigate?: (href: string) => void; notes?: NotificationItem[] }) {
  const source = useAlarmBellSource({ hrefs: HREFS, onNavigate });
  return <NotificationMenu items={notes} sources={source ? [source] : []} now={NOW} locale="en" />;
}

describe('useAlarmBellSource: the alarms in the one list of a notification menu', () => {
  it('lists each alarm with its look, device and time; an open one is unread and has Acknowledge; a click opens it', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const onNavigate = vi.fn();
    wrap(<OneList onNavigate={onNavigate} notes={[{ id: 'n1', title: 'Backup done', at: ago(30_000), read: false }]} />, { adapter });
    // one unread notification + one OPEN alarm
    const trigger = await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    await user.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(panel).getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)).toEqual(['Backup done', 'Alarm a1', 'Alarm a2']);
    const a1 = within(panel).getByText('Alarm a1').closest('li')!;
    expect(a1.querySelector('[data-severity="MAJOR"]')).not.toBeNull();
    expect(within(a1).getByText('Pump 4')).toBeInTheDocument();
    expect(within(a1).getByText('1 min. ago')).toBeInTheDocument();
    expect(within(within(panel).getByText('Alarm a2').closest('li')!).queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    await user.click(within(a1).getByRole('button', { name: 'Acknowledge' }));
    expect(adapter.alarms!.acknowledge).toHaveBeenCalledWith(['a1']);
    // acknowledged: read, and the badge has only the notification left, without asking the host again
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument());
    expect(adapter.alarms!.counts).toHaveBeenCalledTimes(1);
    // the old section's counts line, under the Alarms filter
    await user.click(within(panel).getByRole('button', { name: /^Alarms/ }));
    expect(within(panel).getByText(/^Open \(\d+\) · Acknowledged \(\d+\)$/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('link', { name: /Alarm a1/ }));
    expect(onNavigate).toHaveBeenCalledWith('/a/a1');
  });

  it('Acknowledge all (n) in the header goes through the confirmation; the footer opens the alarm list', async () => {
    const user = userEvent.setup();
    const adapter = createFakeAdapter();
    const onNavigate = vi.fn();
    wrap(<><ConfirmHost /><OneList onNavigate={onNavigate} /></>, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    await user.click(within(panel).getByRole('button', { name: 'Acknowledge all (1)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acknowledge all (1)' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(adapter.alarms!.acknowledge).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Notifications' })).getByRole('link', { name: 'View all alarms' }));
    expect(onNavigate).toHaveBeenCalledWith('/alarms');
  });

  it('nothing for a viewer who may not read alarms; the headless source hands it up and takes it back', async () => {
    const onSource = vi.fn();
    const { unmount } = wrap(<AlarmBellSource hrefs={HREFS} onSource={onSource} />);
    await waitFor(() => expect(onSource).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'alarms', unread: 1, items: expect.any(Array) })));
    unmount();
    expect(onSource).toHaveBeenLastCalledWith(null);
    const denied = vi.fn();
    wrap(<AlarmBellSource hrefs={HREFS} onSource={denied} />, { caps: {} });
    await act(async () => {});
    expect(denied).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'alarms' }));
  });
});
