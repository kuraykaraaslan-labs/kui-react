import { describe, it, expect, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotCapabilities, IotDevicesApi, DeviceListQuery } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import type { DeviceLogEntry, DeviceRecord } from '../types/device';
import { IOT_MESSAGES } from '../messages';
import { DeviceLogTimeline, auditSummary } from './DeviceLogTimeline';
import { DeviceDetailView } from './DeviceDetailView';
import { DeviceListView } from './DeviceListView';
import { useDeviceLog } from './useDeviceLog';

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;

const LOG: DeviceLogEntry[] = [
  { id: 'a1', at: ago(5 * MIN), source: 'audit', kind: 'iot_device.device.updated', actor: { id: 'u1', name: 'Ada Lovelace' }, metadata: { fields: ['label', 'name'] } },
  { id: 'c1', at: ago(10 * MIN), source: 'connection', kind: 'connected', transport: 'mqtts', remoteIp: '203.0.113.7' },
  { id: 'a2', at: ago(20 * MIN), source: 'audit', kind: 'iot_device.attributes.saved', actor: { id: 'u2' }, metadata: { scope: 'SHARED', keys: ['cfg.mode'] } },
  { id: 'c2', at: ago(30 * MIN), source: 'connection', kind: 'disconnected', reason: 'keepalive_timeout' },
  { id: 'a3', at: ago(40 * MIN), source: 'audit', kind: 'iot_device.credential.rotated', actor: null, metadata: { credentialType: 'ACCESS_TOKEN' } },
  { id: 'a4', at: ago(50 * MIN), source: 'audit', kind: 'iot_widget.thing.done', actor: { id: 'u1', name: 'Ada Lovelace' } },
];

const DEVICES: DeviceRecord[] = [
  { deviceId: 'd1', name: 'Pump 4', deviceProfileId: 'p1', profileName: 'Pumps', status: 'ACTIVE', isGateway: false, online: true, lastActivityAt: ago(MIN), lastRemoteIp: '203.0.113.7', lastTransport: 'mqtts', fwTitle: 'esp32', fwVersion: '1.8.2' },
  { deviceId: 'd2', name: 'Probe 12', deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false, online: false, lastActivityAt: ago(9 * MIN) },
  { deviceId: 'd3', name: 'Meter 3', deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false, online: null, lastActivityAt: ago(60 * MIN) },
];

const ALL: Partial<IotCapabilities> = { canReadAttributes: true, canViewCredentials: false };

function fakeLive() {
  const subs = new Set<IotLiveSubscription>();
  const live: IotLive & { publish(kind: string, payload: unknown): void } = {
    get state() { return 'live' as const; },
    subscribe(sub) { subs.add(sub as IotLiveSubscription); return () => { subs.delete(sub as IotLiveSubscription); }; },
    onState() { return () => undefined; },
    publish(kind, payload) { for (const s of [...subs]) if (s.kind === kind) s.onLive(payload); },
  };
  return live;
}

function adapterWith(over: { log?: boolean } = {}): IotAdapter {
  return {
    profiles: { options: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Pumps' }]) },
    devices: {
      list: vi.fn().mockImplementation(async () => ({ items: DEVICES.map((d) => ({ ...d })), total: DEVICES.length })),
      get: vi.fn().mockImplementation(async (id: string) => {
        const d = DEVICES.find((x) => x.deviceId === id);
        return d ? { ...d } : { ...DEVICES[0], deviceId: id, name: `Elsewhere ${id}` };
      }),
      connections: vi.fn().mockResolvedValue({ items: [{ id: 'k1', at: ago(MIN), kind: 'connected', transport: 'mqtt', remoteIp: '198.51.100.4' }], total: 1 }),
      ...(over.log === false ? {} : {
        log: vi.fn().mockImplementation(async (_id: string, q: { page: number; pageSize: number; source?: string }) => {
          const rows = LOG.filter((e) => !q.source || e.source === q.source);
          return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length };
        }),
      }),
      parseState: (p: unknown) => p as never,
    },
    attributes: { list: vi.fn().mockResolvedValue([]), save: vi.fn(), remove: vi.fn() },
  };
}

function wrap(ui: React.ReactNode, o: { adapter?: IotAdapter; live?: IotLive | null } = {}) {
  return render(
    <IotAdapterProvider adapter={o.adapter ?? adapterWith()} live={o.live ?? null} capabilities={ALL} locale="en">{ui}</IotAdapterProvider>,
  );
}

describe('DeviceLogTimeline', () => {
  it('draws connection lines with the address and transport, and changes with who made them', () => {
    render(<DeviceLogTimeline entries={LOG} locale="en" />);
    expect(screen.getByText('Device edited')).toBeInTheDocument();
    expect(screen.getAllByText('by Ada Lovelace')).toHaveLength(2);
    expect(screen.getByText('Changed: Label, Name')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.7')).toBeInTheDocument();
    expect(screen.getByText('MQTTS')).toBeInTheDocument();
    expect(screen.getByText('Reason: No keep-alive in time')).toBeInTheDocument();
    // a member without a name, and the system
    expect(screen.getByText('by a team member')).toBeInTheDocument();
    expect(screen.getByText('Shared: cfg.mode')).toBeInTheDocument();
    expect(screen.getByText('by the system')).toBeInTheDocument();
    expect(screen.getByText('Type: Access token')).toBeInTheDocument();
    // an action the kit does not know is drawn neutral with its name
    expect(screen.getByText('Change: iot_widget.thing.done')).toBeInTheDocument();
  });

  it('summarises metadata without values: fields, status, keys, credential type, command, alarm', () => {
    const m = IOT_MESSAGES as never;
    const e = (kind: string, metadata: Record<string, unknown>): DeviceLogEntry => ({ id: 'x', at: NOW, source: 'audit', kind, metadata });
    // in words (NB 41-ui-fixes/22 6.3); a code the kit does not know stays as it is
    expect(auditSummary(e('iot_device.device.disabled', { from: 'ACTIVE', to: 'DISABLED' }), m)).toBe('Active → Disabled');
    expect(auditSummary(e('iot_device.device.updated', { fields: ['deviceProfileId', 'additionalInfo', 'colour'] }), m)).toBe('Changed: Profile, Additional info, colour');
    expect(auditSummary(e('iot_device.credential.set', { credentialType: 'MQTT_BASIC' }), m)).toBe('Type: MQTT basic (username and password)');
    expect(auditSummary(e('iot_device.attributes.saved', { scope: 'SERVER', keys: ['a', 'b'] }), m)).toBe('Server: a, b');
    expect(auditSummary(e('iot_device.device.updated', { from: 'ACTIVE', to: 'RETIRED' }), m)).toBe('Active → RETIRED');
    expect(auditSummary(e('iot_rpc.request.created', { method: 'sys.reboot', rpcId: 'r1' }), m)).toBe('Command sys.reboot');
    expect(auditSummary(e('iot_alarm.alarm.acknowledged', { alarmId: 'a1', alarmType: 'high_temperature' }), m)).toBe('Alarm high_temperature');
    expect(auditSummary(e('iot_device.device.created', {}), m)).toBeNull();
  });

  it('offers All / Connections / Changes and reports the choice; no Changes chip without audit rows', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const { rerender } = render(<DeviceLogTimeline entries={LOG} filter="all" onFilterChange={onFilterChange} locale="en" />);
    const group = screen.getByRole('group', { name: 'Show' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Connections', 'Changes']);
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: 'Changes' }));
    expect(onFilterChange).toHaveBeenCalledWith('audit');
    rerender(<DeviceLogTimeline entries={[]} filter="audit" onFilterChange={onFilterChange} locale="en" />);
    expect(screen.getByText('No changes yet.')).toBeInTheDocument();
    rerender(<DeviceLogTimeline entries={[]} sources={['connection']} onFilterChange={onFilterChange} locale="en" />);
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
  });

  it('compact: no chips, no day headings, no paging', () => {
    render(<DeviceLogTimeline entries={LOG.slice(0, 2)} compact hasMore onLoadMore={() => undefined} onFilterChange={() => undefined} locale="en" />);
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('DeviceDetailView: the Log tab', () => {
  it('replaces Connections, reads the log through the adapter and filters it', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    wrap(<DeviceDetailView deviceId="d1" tab="log" now={NOW} />, { adapter });
    expect(await screen.findByRole('tab', { name: 'Log' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Connections' })).toBeNull();
    expect(await screen.findByText('Device edited')).toBeInTheDocument();
    expect(adapter.devices!.log).toHaveBeenCalledWith('d1', { page: 1, pageSize: 50 }, expect.anything());
    await user.click(screen.getByRole('button', { name: 'Connections' }));
    await waitFor(() => expect(adapter.devices!.log).toHaveBeenLastCalledWith('d1', { page: 1, pageSize: 50, source: 'connection' }, expect.anything()));
    await waitFor(() => expect(screen.queryByText('Device edited')).toBeNull());
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('an old ?tab=connections link opens the Log tab', async () => {
    wrap(<DeviceDetailView deviceId="d1" tab="connections" now={NOW} />);
    expect(await screen.findByRole('tab', { name: 'Log' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a host without log() shows its connection log, with no Changes filter', async () => {
    const adapter = adapterWith({ log: false });
    wrap(<DeviceDetailView deviceId="d1" tab="log" now={NOW} />, { adapter });
    expect(await screen.findByText('198.51.100.4')).toBeInTheDocument();
    expect(adapter.devices!.connections).toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
  });
});

describe('DeviceListView: the quick view', () => {
  const hrefs = { device: (id: string) => `/d/${id}` };

  it('opens on a row click (not on the name link), with the header facts and the five newest log lines; the URL gets ?device by push', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={hrefs} onQueryChange={onQueryChange} now={NOW} />);
    const row = (await screen.findByText('Pump 4')).closest('tr')!;
    // the name is a link to the page: a click on it is the link's, no drawer
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/d/d1');
    await user.click(within(row).getAllByRole('cell')[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Device Pump 4' });
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'd1', page: 1 }), 'push');
    expect(within(dialog).getByText('Pumps')).toBeInTheDocument();
    expect(within(dialog).getByText('esp32 1.8.2')).toBeInTheDocument();
    expect(within(within(dialog).getByRole('region', { name: 'Quick view' })).getByText('203.0.113.7')).toBeInTheDocument();
    expect(within(dialog).getByText('1 of 3')).toBeInTheDocument();
    expect(await within(dialog).findByText('Device edited')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open full page' })).toHaveAttribute('href', '/d/d1');
    expect(within(dialog).getByRole('link', { name: 'Open the log' })).toHaveAttribute('href', '/d/d1?tab=log');
    expect(within(dialog).getByRole('button', { name: 'Previous device' })).toBeDisabled();
  });

  it('↑ / ↓ and Previous / Next move through the page without closing (replace, not push)', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={hrefs} onQueryChange={onQueryChange} now={NOW} />);
    await user.click(within((await screen.findByText('Pump 4')).closest('tr')!).getAllByRole('cell')[1]);
    await screen.findByRole('dialog', { name: 'Device Pump 4' });
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('dialog', { name: 'Device Probe 12' })).toBeInTheDocument();
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ device: 'd2' }), 'replace');
    await user.click(screen.getByRole('button', { name: 'Next device' }));
    expect(await screen.findByRole('dialog', { name: 'Device Meter 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next device' })).toBeDisabled();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('dialog', { name: 'Device Meter 3' })).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByRole('dialog', { name: 'Device Probe 12' })).toBeInTheDocument();
  });

  it('Esc closes it, drops ?device and puts focus on the row of the device last shown', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    wrap(<DeviceListView hrefs={hrefs} onQueryChange={onQueryChange} now={NOW} />);
    await user.click(within((await screen.findByText('Pump 4')).closest('tr')!).getAllByRole('cell')[1]);
    await screen.findByRole('dialog');
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    // focus is trapped in the drawer
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('dialog', { name: 'Device Probe 12' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const last = onQueryChange.mock.calls.at(-1)!;
    expect((last[0] as DeviceListQuery).device).toBeUndefined();
    expect(last[1]).toBe('replace');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Probe 12').closest('tr')));
  });

  it('a link with ?device opens it; Back (the host dropping it) closes it; a device off the page is read alone', async () => {
    const adapter = adapterWith();
    const ui = (device?: string) => (
      <IotAdapterProvider adapter={adapter} live={null} capabilities={ALL} locale="en">
        <DeviceListView hrefs={hrefs} initialQuery={{ device }} now={NOW} />
      </IotAdapterProvider>
    );
    const { rerender } = render(ui('d2'));
    expect(await screen.findByRole('dialog', { name: 'Device Probe 12' })).toBeInTheDocument();
    rerender(ui(undefined));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(ui('d9'));
    expect(await screen.findByRole('dialog', { name: 'Device Elsewhere d9' })).toBeInTheDocument();
    expect(adapter.devices!.get).toHaveBeenCalledWith('d9', expect.anything());
    // no neighbours for a device that is not on the page
    expect(screen.getByRole('button', { name: 'Previous device' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next device' })).toBeDisabled();
    expect(adapter.devices!.list).toHaveBeenCalledWith(expect.not.objectContaining({ device: expect.anything() }), expect.anything());
  });

  it('opens the full page and the log in the host\'s router (1.22)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    wrap(<DeviceListView hrefs={hrefs} onOpen={onOpen} now={NOW} />);
    await user.click(within((await screen.findByText('Pump 4')).closest('tr')!).getAllByRole('cell')[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Device Pump 4' });
    await user.click(within(dialog).getByRole('link', { name: 'Open the log' }));
    expect(onOpen).toHaveBeenLastCalledWith('/d/d1?tab=log');
    await user.click(within(dialog).getByRole('link', { name: 'Open full page' }));
    expect(onOpen).toHaveBeenLastCalledWith('/d/d1');
  });

  it('a device off the page is read again on every poll, so it does not freeze (1.16)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const adapter = adapterWith();
      let n = 0;
      (adapter.devices!.get as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => ({ ...DEVICES[0], deviceId: id, name: `Elsewhere ${id}`, online: n++ === 0 }));
      render(<IotAdapterProvider adapter={adapter} live={null} capabilities={ALL} locale="en"><DeviceListView hrefs={hrefs} initialQuery={{ device: 'd9' }} now={NOW} /></IotAdapterProvider>);
      const dialog = await screen.findByRole('dialog', { name: 'Device Elsewhere d9' });
      expect(within(dialog).getByText('Online')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(30_000); });
      expect(await within(dialog).findByText('Offline')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows the open device live', async () => {
    const user = userEvent.setup();
    const live = fakeLive();
    wrap(<DeviceListView hrefs={hrefs} now={NOW} />, { live });
    await user.click(within((await screen.findByText('Probe 12')).closest('tr')!).getAllByRole('cell')[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Device Probe 12' });
    expect(within(dialog).getByText(/Offline/)).toBeInTheDocument();
    act(() => live.publish('deviceState', { deviceId: 'd2', online: true, lastActivityAt: NOW, remoteIp: '192.0.2.44', transport: 'mqtt' }));
    expect(await within(dialog).findByText('192.0.2.44')).toBeInTheDocument();
    expect(within(dialog).getByText('Online')).toBeInTheDocument();
  });
});

describe('useDeviceLog', () => {
  it('drops a late answer of the previous device: the log neither shows it nor stays loading (1.13)', async () => {
    const line = (id: string): DeviceLogEntry => ({ id, at: NOW, source: 'connection', kind: 'connected' });
    const log = vi.fn().mockImplementation(async (id: string) => ({ items: [line(`${id}-1`)], total: 1 }));
    const api = { list: vi.fn(), get: vi.fn(), connections: vi.fn(), log } as unknown as IotDevicesApi;
    const { result, rerender } = renderHook(({ id }) => useDeviceLog(api, id, { pageSize: 5, errorText: 'x' }), { initialProps: { id: 'd1' } });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe('d1-1'));
    let late!: (v: unknown) => void;
    log.mockImplementationOnce(() => new Promise((r) => { late = r; }));
    act(() => result.current.reload());
    rerender({ id: 'd2' });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe('d2-1'));
    await act(async () => { late({ items: [line('d1-late')], total: 1 }); });
    expect(result.current.entries.map((e) => e.id)).toEqual(['d2-1']);
    expect(result.current.loading).toBe(false);
  });
});
