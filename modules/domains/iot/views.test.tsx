import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider, useIotAdapter } from './api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from './api/adapter';
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

  it('creates a device and shows its token once, gone when the drawer closes', async () => {
    const user = userEvent.setup();
    wrap(<DeviceListView hrefs={{ device: (id) => `/d/${id}` }} now={NOW} />);
    await user.click(await screen.findByRole('button', { name: /New device/ }));
    await user.click(screen.getByRole('button', { name: 'Create device' }));
    expect(screen.getByText('A name is required.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), 'New');
    await user.click(screen.getByRole('button', { name: 'Create device' }));
    await user.click(await screen.findByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('issued-secret')).toHaveTextContent('TOKEN-ONCE');
    await user.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByTestId('issued-secret')).toBeNull());
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
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect((adapter.devices!.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before + 1);
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
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
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
    await waitFor(() => expect(adapter.devices!.update).toHaveBeenCalledWith('d1', { name: 'Pump 5', label: 'Boiler room' }));
    await waitFor(() => expect(adapter.devices!.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
