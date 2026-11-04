import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LoraDeviceForm, LoraDeviceTable, LoraFrameTable, LoraGatewayForm, LoraGatewayPanel, LoraGatewayTable, LoraJoinStateBadge, LoraStationSetup, isEui, isKey,
  loraJoinStateOf, LORA_DEVICE_SORT_KEYS,
} from '.';
import type { LoraDeviceRow, LoraGatewayRow } from '.';

const gw = { gatewayId: 'g1', name: 'Roof', eui: 'AA555A0000000001', protocol: 'BASICS_STATION' as const, status: 'ACTIVE' as const, region: 'EU868', lastSeenAt: null, live: { online: true, rttMs: 950, connectedAt: 1 } };

describe('LoRaWAN components (NB iot_lorawan 13)', () => {
  it('the gateway table shows online state and marks a slow round trip', () => {
    render(<LoraGatewayTable rows={[gw]} />);
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('950 ms').getAttribute('title')).toMatch(/RX2/);
  });
  it('the setup card shows the token only when it was just issued, and says how to get a new one otherwise', () => {
    const setup = { lnsUrl: 'wss://lns.example.com', routerInfoUrl: 'wss://lns.example.com/router-info', trustAvailable: true };
    const { rerender } = render(<LoraStationSetup gateway={gw} setup={setup} issued={{ token: 'lns_x', files: [{ name: 'tc.key', content: 'x' }] }} onDownload={() => undefined} />);
    expect(screen.getByText('Authorization: Bearer lns_x')).toBeTruthy();
    expect(screen.getByText(/shown only now/)).toBeTruthy();
    rerender(<LoraStationSetup gateway={gw} setup={setup} issued={null} />);
    expect(screen.queryByText(/Bearer/)).toBeNull();
    expect(screen.getByText(/Rotate the token/)).toBeTruthy();
    rerender(<LoraStationSetup gateway={{ ...gw, protocol: 'ROLTEK_LINK' }} setup={setup} />);
    expect(screen.getByText(/device certificate/)).toBeTruthy();
  });
  it('the forms refuse bad identifiers and hand normalised values on', () => {
    const onGw = vi.fn();
    render(<LoraGatewayForm onSubmit={onGw} />);
    fireEvent.click(screen.getByText('Add gateway'));
    expect(onGw).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Roof' } });
    fireEvent.change(screen.getByLabelText(/^Gateway EUI/), { target: { value: 'aa-55-5a-00-00-00-00-01' } });
    fireEvent.click(screen.getByText('Add gateway'));
    expect(onGw).toHaveBeenCalledWith({ name: 'Roof', eui: 'AA555A0000000001', region: 'EU868' });
    expect(isEui('0000000000000000')).toBe(false);
    expect(isKey('00112233445566778899aabbccddeeff')).toBe(true);
  });
  it('the device form needs a 32-hex AppKey and lower-cases it', () => {
    const onDev = vi.fn();
    render(<LoraDeviceForm onSubmit={onDev} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Cold room' } });
    fireEvent.change(screen.getByLabelText(/^DevEUI/), { target: { value: 'A840410000000001' } });
    fireEvent.change(screen.getByLabelText(/^AppKey/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onDev).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^AppKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onDev.mock.calls[0][0]).toMatchObject({ appKey: '00112233445566778899aabbccddeeff', joinEui: '0000000000000000', macVersion: '1.0.3', class: 'A' });
  });
  it('join states and frame results read as words, a foreign device without ids', () => {
    render(<LoraJoinStateBadge device={{ lastJoin: { state: 'join_mic_failed', at: 1 }, session: null }} />);
    expect(screen.getByText(/wrong AppKey/)).toBeTruthy();
    render(<LoraFrameTable rows={[{ t: 1, type: 'dropped', result: 'dropped', reason: 'foreign_tenant', gateways: [] }]} />);
    expect(screen.getByText('A device of another network')).toBeTruthy();
  });
});

const gw2: LoraGatewayRow = { gatewayId: 'g2', name: 'Barn', eui: 'AA555A0000000002', protocol: 'ROLTEK_LINK', status: 'ACTIVE', region: 'EU868', lastSeenAt: null, live: { online: false, rttMs: null, connectedAt: null } };
const dev = (id: string, name: string, extra: Partial<LoraDeviceRow> = {}): LoraDeviceRow => ({
  deviceId: id, name, devEui: `A84041000000000${id.slice(1)}`, joinEui: '0000000000000001', class: 'A', macVersion: '1.0.3', lastJoin: null, session: null, ...extra,
});
const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('LoRaWAN lists (sort, search, filters, paging)', () => {
  it('the gateway table sorts, searches and filters its rows in the browser without a host query', async () => {
    const user = userEvent.setup();
    render(<LoraGatewayTable rows={[gw, gw2]} />);
    expect(names()).toEqual(['Roof', 'Barn']);
    await user.click(within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button'));
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Barn', 'Roof']);
    for (const h of [/Gateway EUI/, /Protocol/, /Status/, /Region/]) expect(within(screen.getByRole('columnheader', { name: h })).getByRole('button')).toBeTruthy();
    await user.type(screen.getByRole('searchbox'), '0002');
    await waitFor(() => expect(names()).toEqual(['Barn']));
    await user.clear(screen.getByRole('searchbox'));
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Connection'), 'true');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(names()).toEqual(['Roof']));
    expect(screen.getByRole('combobox', { name: /Rows per page/ })).toBeTruthy();
  });

  it('with a host query the gateway table reports page, sort, search and filters under the API names', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<LoraGatewayTable rows={[gw]} total={45} onQueryChange={onQueryChange} />);
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20, sort: [], search: '' })));
    await user.click(within(screen.getByRole('columnheader', { name: /Region/ })).getByRole('button'));
    await waitFor(() => expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ sort: [{ key: 'region', dir: 'asc' }] })));
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Protocol'), 'BASICS_STATION');
    await user.selectOptions(within(panel).getByLabelText('Status'), 'DISABLED');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filterValues: { protocol: 'BASICS_STATION', status: 'DISABLED' } })));
    // the host's rows stay as they are: the table does not filter a served page itself
    expect(screen.getByText('Roof')).toBeTruthy();
    expect(screen.getByRole('button', { name: /next page/i })).toBeTruthy();
  });

  it('the device table shows the session, sorts by name, DevEUI, class and version, and filters by join state', async () => {
    const user = userEvent.setup();
    const rows = [
      dev('d1', 'Cold room', { lastJoin: { state: 'joined', at: 1 }, session: { devAddr: '26011234', fCntUp: 812, fCntDown: 3, lastUplinkAt: new Date(Date.now() - 60_000).toISOString(), status: 'ACTIVE' } }),
      dev('d2', 'Door', { lastJoin: { state: 'join_mic_failed', at: 1 }, class: 'C', macVersion: '1.0.2' }),
      dev('d3', 'Attic'),
    ];
    render(<LoraDeviceTable rows={rows} />);
    expect(screen.getByText('26011234')).toBeTruthy();
    expect(screen.getByText('812')).toBeTruthy();
    for (const h of [/^Name/, /DevEUI/, /Class/, /LoRaWAN/]) expect(within(screen.getByRole('columnheader', { name: h })).getByRole('button')).toBeTruthy();
    expect(within(screen.getByRole('columnheader', { name: /Join/ })).queryByRole('button')).toBeNull();
    await user.click(within(screen.getByRole('columnheader', { name: /^Name/ })).getByRole('button'));
    expect(names()).toEqual(['Attic', 'Cold room', 'Door']);
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Join'), 'refused');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(names()).toEqual(['Door']));
  });

  it('the device table shows when each device was added and sorts by it', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const rows = [dev('d1', 'Cold room', { createdAt: '2026-11-02T10:00:00.000Z' }), dev('d2', 'Door')];
    render(<LoraDeviceTable rows={rows} total={2} onQueryChange={onQueryChange} locale="en-GB" />);
    expect(screen.getByText(new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date('2026-11-02T10:00:00.000Z')))).toBeTruthy();
    expect(LORA_DEVICE_SORT_KEYS).toContain('createdAt');
    await user.click(within(screen.getByRole('columnheader', { name: /Added/ })).getByRole('button'));
    await waitFor(() => expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ sort: [{ key: 'createdAt', dir: 'asc' }] })));
  });

  it('a join is joined (accepted, or a session without a recorded join), refused, or never', () => {
    expect(loraJoinStateOf({ lastJoin: { state: 'joined', at: 1 }, session: null })).toBe('joined');
    expect(loraJoinStateOf({ lastJoin: null, session: { devAddr: '01', fCntUp: 1, fCntDown: 0, lastUplinkAt: null, status: 'ACTIVE' } })).toBe('joined');
    expect(loraJoinStateOf({ lastJoin: { state: 'devnonce_replay', at: 1 }, session: null })).toBe('refused');
    expect(loraJoinStateOf({ lastJoin: null, session: null })).toBe('never');
  });

  it('the frames log is newest first, sorts and searches in the browser', async () => {
    const user = userEvent.setup();
    render(<LoraFrameTable
      rows={[{ t: 1, type: 'up', result: 'processed', deviceId: 'd1', fCnt: 4, gateways: [] }, { t: 2, type: 'join', result: 'dropped', reason: 'join_mic_failed', deviceId: 'd2', gateways: [] }]}
      deviceName={(id) => (id === 'd1' ? 'Cold room' : 'Door')}
    />);
    expect(screen.getByRole('columnheader', { name: /Time/ })).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('row')[1].textContent).toMatch(/Door/);
    await user.type(screen.getByRole('searchbox'), 'cold');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText('Cold room')).toBeTruthy();
  });

  it('a frame of a device the host does not know is named by the row (deviceName), then by its DevEUI, and found by that name', async () => {
    const user = userEvent.setup();
    render(<LoraFrameTable
      rows={[
        { t: 3, type: 'up', result: 'processed', deviceId: 'd9', deviceName: 'Pump 9', devEui: '70B3D57ED0000009', gateways: [] },
        { t: 2, type: 'up', result: 'processed', deviceId: 'd8', devEui: '70B3D57ED0000008', gateways: [] },
        { t: 1, type: 'up', result: 'processed', deviceId: 'd1', deviceName: 'Old name', gateways: [] },
      ]}
      deviceName={(id) => (id === 'd1' ? 'Cold room' : undefined)}
    />);
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toMatch(/Pump 9/);
    expect(rows[1].textContent).not.toMatch(/70B3D57ED0000009/);
    expect(rows[2].textContent).toMatch(/70B3D57ED0000008/);
    expect(rows[3].textContent).toMatch(/Cold room/);
    await user.type(screen.getByRole('searchbox'), 'pump');
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
  });
});

describe('LoraGatewayPanel (a gateway under Devices)', () => {
  const setup = { lnsUrl: 'wss://lns.example.com', routerInfoUrl: null, trustAvailable: true };
  const station: LoraGatewayRow = { ...gw, deviceId: 'dev-1', mode: 'CLOUD', lastSeenAt: '2026-11-04T08:00:00.000Z', latitude: 41.015137, longitude: 28.97953, altitude: 40 };

  it('shows the connection and the facts, the slow link, the location, and the frames it heard', () => {
    render(<LoraGatewayPanel gateway={station} setup={setup} frames={[{ t: 1, type: 'up', result: 'processed', deviceId: 'd1', gateways: [{ gatewayId: 'g1', eui: gw.eui, rssi: -80, snr: 7 }] }]} deviceName={() => 'Cold room'} />);
    expect(screen.getByText('LoRaWAN gateway')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('950 ms')).toBeTruthy();
    expect(screen.getByText(/fall back to RX2/)).toBeTruthy();
    expect(screen.getByText('Cloud')).toBeTruthy();
    expect(screen.getByText('41.015137, 28.97953 · 40 m')).toBeTruthy();
    expect(screen.getByText('Cold room')).toBeTruthy();
    expect(screen.getByText(/Rotate the token/)).toBeTruthy();
  });

  it('shows the token only while it was just issued', () => {
    render(<LoraGatewayPanel gateway={station} setup={setup} issued={{ token: 'lns_once', files: null }} frames={[]} />);
    expect(screen.getByText('Authorization: Bearer lns_once')).toBeTruthy();
  });

  it('offers the host\'s actions by status and protocol: Rotate for Basics Station only, Enable for a disabled gateway, Remove', () => {
    const onRotate = vi.fn(); const onEnable = vi.fn(); const onDisable = vi.fn(); const onRemove = vi.fn();
    const props = { setup, frames: [], onRotate, onEnable, onDisable, onRemove };
    const { rerender } = render(<LoraGatewayPanel gateway={station} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rotate token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect([onRotate, onDisable, onRemove].every((f) => f.mock.calls.length === 1)).toBe(true);
    rerender(<LoraGatewayPanel gateway={{ ...gw2, status: 'DISABLED' }} {...props} />);
    expect(screen.queryByRole('button', { name: 'Rotate token' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(onEnable).toHaveBeenCalled();
    expect(screen.getByText('Not on the map')).toBeTruthy();
    rerender(<LoraGatewayPanel gateway={station} setup={setup} frames={[]} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('a loading or failed read says so', () => {
    const { rerender } = render(<LoraGatewayPanel gateway={null} setup={null} frames={[]} loading />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    rerender(<LoraGatewayPanel gateway={null} setup={null} frames={[]} error="Nope" />);
    expect(screen.getByText('Nope')).toBeTruthy();
  });
});
