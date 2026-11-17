import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, RpcCatalog } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import { isRefusedRpcMethod, rpcCommandKeyOf, rpcCustomMethodOf, rpcPresetOf, rpcWireMethodOf, type RpcCommand, type RpcRequest } from '../types/rpc';
import { paramRowIssues, paramRowsOf, paramsSchemaOf } from './RpcParamsBuilder';
import { RpcStatusBadge } from './RpcStatusBadge';
import { RpcSendPanel } from './RpcSendPanel';
import { RpcRequestList, rpcDurationMs } from './RpcRequestList';
import { RpcRequestDetail } from './RpcRequestDetail';
import { RpcConsoleView } from './RpcConsoleView';

const T0 = new Date('2026-10-24T12:00:00Z');
const COMMANDS: RpcCommand[] = [
  { method: 'sys.info', label: 'Info', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {}, sendable: true },
  { method: 'sys.ping', label: 'Ping', tier: 'basic', highImpact: false, oneway: false, sendable: true, paramsSchema: { host: { label: 'Host', type: 'text', required: true } } },
  { method: 'cfg.sync', label: 'Sync', tier: 'privileged', highImpact: false, oneway: true, paramsSchema: {}, sendable: false },
  { method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, confirmText: 'REBOOT', oneway: true, paramsSchema: {}, sendable: true },
  { method: 'sys.restart', label: 'Restart', tier: 'critical', highImpact: true, oneway: true, paramsSchema: {}, sendable: true },
  { method: 'sys.factory_reset', label: 'Factory reset', tier: 'critical', highImpact: true, oneway: true, paramsSchema: {}, sendable: true },
];
const req = (id: string, over: Partial<RpcRequest> = {}): RpcRequest => ({
  rpcId: id, deviceId: 'd1', method: 'sys.info', oneway: false, persistent: false, status: 'QUEUED', source: 'console', createdAt: T0, ...over,
});

describe('OD-8 and status', () => {
  it('refuses every factory-reset spelling', () => {
    for (const m of ['sys.factory_reset', 'factoryReset', 'FACTORY-RESET', 'sys.factoryDefaults', 'cloud.forget']) expect(isRefusedRpcMethod(m), m).toBe(true);
    expect(isRefusedRpcMethod('sys.reboot')).toBe(false);
  });

  it('labels a status and its outcome', () => {
    render(<><RpcStatusBadge status="TIMEOUT" outcome="unknown" /><RpcStatusBadge status="SUCCESSFUL" /></>);
    expect(screen.getByText('Timed out')).toHaveAttribute('title', 'No answer: the outcome is unknown');
    expect(screen.getByText('Successful')).toBeInTheDocument();
  });
});

describe('the method a device receives and the command key (rpc-wire-method)', () => {
  it('sends the wire method, else the key; makes a key from a label; records a custom payload under its own method', () => {
    expect(rpcWireMethodOf({ method: 'relay_on', wireMethod: 'setValue' })).toBe('setValue');
    expect(rpcWireMethodOf({ method: 'sys.info', wireMethod: null })).toBe('sys.info');
    expect(rpcWireMethodOf({ method: 'sys.info', wireMethod: '  ' })).toBe('sys.info');
    expect(rpcCommandKeyOf('Röle 1 aç')).toBe('role_1_ac');
    expect(rpcCommandKeyOf('Röle 1 aç', ['role_1_ac', 'role_1_ac_2'])).toBe('role_1_ac_3');
    expect(rpcCommandKeyOf('42 volts')).toBe('cmd_42_volts');
    expect(rpcCommandKeyOf('!!!')).toBe('command');
    expect(rpcCustomMethodOf({ method: 'setValue', params: {} })).toBe('setValue');
    expect(rpcCustomMethodOf({ method: 'set value' })).toBe('custom');
    expect(rpcCustomMethodOf([1, 2])).toBe('custom');
  });

  it('"Send again" of a custom payload brings the payload back with its masked values to type again', () => {
    const r = req('c', { method: 'setValue', tier: 'raw', payload: { method: 'setValue', params: { psk: '***', ch: 1 } } });
    expect(rpcPresetOf(r, null)).toEqual(expect.objectContaining({ method: 'setValue', payload: { method: 'setValue', params: { psk: '***', ch: 1 } }, maskedPaths: ['params.psk'] }));
  });

  it('keeps a parameter\'s value through the rows and checks it against the type, range and choices', () => {
    const schema = {
      ch: { label: 'Channel', type: 'number' as const, min: 1, max: 4, value: 2 },
      on: { label: 'On', type: 'boolean' as const, value: false },
      mode: { label: 'Mode', type: 'select' as const, options: ['auto', 'manual'], value: 'auto' },
      extra: { label: 'Extra', type: 'json' as const, value: { a: 1 } },
    };
    const rows = paramRowsOf(schema)!;
    expect(rows.map((r) => r.value)).toEqual(['2', 'false', 'auto', '{"a":1}']);
    expect(paramsSchemaOf(rows)).toEqual(schema);
    expect(paramRowIssues([{ ...rows[0]!, value: '9' }, { ...rows[2]!, value: 'other' }, { ...rows[3]!, value: '{' }])).toEqual({
      0: { value: 'value_invalid' }, 1: { value: 'value_invalid' }, 2: { value: 'value_invalid' },
    });
    expect(paramsSchemaOf([{ ...rows[0]!, value: '' }])).toEqual({ ch: { label: 'Channel', type: 'number', min: 1, max: 4 } });
  });
});

describe('RpcSendPanel', () => {
  it('never offers a factory reset, greys a tier the viewer may not send, validates declared params', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<RpcSendPanel commands={COMMANDS} onSend={onSend} />);
    const select = screen.getByLabelText('Command') as HTMLSelectElement;
    const options = [...select.options].map((o) => o.value);
    expect(options).not.toContain('sys.factory_reset');
    expect([...select.options].find((o) => o.value === 'cfg.sync')!.textContent).toMatch(/may not send/);
    await user.selectOptions(select, 'cfg.sync');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.selectOptions(select, 'sys.ping');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Host/), '8.8.8.8');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'sys.ping', params: { host: '8.8.8.8' }, requestKey: expect.stringMatching(/^rpc-/) }));
  });

  it('asks for the typed phrase of a high-impact command, and a click confirmation without one', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<RpcSendPanel commands={COMMANDS} onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.reboot');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send Reboot?' });
    await user.type(within(dialog).getByLabelText('Type REBOOT to confirm'), 'REBOOT');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ method: 'sys.reboot', confirm: true, confirmText: 'REBOOT' })));
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.restart');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Send Restart?' })).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenLastCalledWith({ method: 'sys.restart', confirm: true, requestKey: expect.any(String) }));
  });

  it('sends a one-time custom payload only with the raw capability, refuses invalid JSON, and warns about an offline device', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<RpcSendPanel commands={COMMANDS} onSend={onSend} />);
    expect([...(screen.getByLabelText('Command') as HTMLSelectElement).options].map((o) => o.value)).not.toContain('__custom__');
    rerender(<RpcSendPanel commands={COMMANDS} onSend={onSend} canSendRaw deviceOnline={false} />);
    await user.selectOptions(screen.getByLabelText('Command'), '__custom__');
    const box = screen.getByLabelText('Payload (JSON)') as HTMLTextAreaElement;
    // it starts from the envelope with the default method
    expect(JSON.parse(box.value)).toEqual({ method: 'setValue', params: {} });
    expect(screen.getByText(/The device is offline/)).toBeInTheDocument();
    await user.clear(box);
    await user.click(box);
    await user.paste('{"method": ');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Not valid JSON.')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
    await user.clear(box);
    await user.click(box);
    await user.paste('{"cmd": "relay", "on": true}');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'custom', payload: { cmd: 'relay', on: true }, requestKey: expect.any(String) }));
    await user.clear(box);
    await user.click(box);
    await user.paste('{"method": "ubus.call", "params": {"path": "system"}}');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenLastCalledWith({ method: 'ubus.call', payload: { method: 'ubus.call', params: { path: 'system' } }, requestKey: expect.any(String) }));
    // a factory reset is refused there too (OD-8)
    await user.clear(box);
    await user.click(box);
    await user.paste('{"method": "sys.factory_reset"}');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText(/never a command/)).toBeInTheDocument();
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('sends a ready command with one button: the catalog gives the values, only a required one without a value is asked for', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const relay: RpcCommand = {
      method: 'relay_on', wireMethod: 'setValue', label: 'Relay on', tier: 'basic', highImpact: false, oneway: false, sendable: true,
      paramsSchema: { ch: { label: 'Channel', type: 'number', value: 2 }, on: { label: 'On', type: 'boolean', value: true }, note: { label: 'Note', type: 'text' } },
    };
    render(<RpcSendPanel commands={[relay]} onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'relay_on');
    // nothing to fill in: no parameter fields, no timeout, no persistence
    expect(screen.queryByLabelText(/Channel/)).toBeNull();
    expect(screen.queryByLabelText(/Note/)).toBeNull();
    expect(screen.queryByLabelText(/timeout/i)).toBeNull();
    expect(screen.queryByLabelText(/persistent/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'relay_on', params: { ch: 2, on: true }, requestKey: expect.any(String) }));
  });

  it('is disabled with the reason for a Legacy-scheme device (OD-85)', () => {
    render(<RpcSendPanel commands={[]} supported={false} onSend={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Commands' })).toHaveTextContent(/not available for devices on the Legacy compatible scheme/);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });
});

describe('RpcRequestList and RpcRequestDetail', () => {
  it('lists requests with duration and source, opens one by keyboard', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    expect(rpcDurationMs({ createdAt: T0, completedAt: new Date(T0.getTime() + 1500) })).toBe(1500);
    expect(rpcDurationMs({ createdAt: T0, completedAt: null })).toBeNull();
    render(<RpcRequestList requests={[req('a', { status: 'SUCCESSFUL', completedAt: new Date(T0.getTime() + 1500), source: 'dashboard_control' })]} onOpen={onOpen} showDevice now={T0.getTime()} />);
    expect(screen.getByText('1.5 s')).toBeInTheDocument();
    expect(screen.getByText('A dashboard control')).toBeInTheDocument();
    screen.getByText('sys.info').closest('tr')!.focus();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ rpcId: 'a' }));
  });

  it('shows the answer, offers cancel only before delivery, and send again', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onRerun = vi.fn();
    const { rerender } = render(<RpcRequestDetail open request={req('a', { status: 'SUCCESSFUL', response: { uptime: 5 }, sentAt: T0, completedAt: T0 })} onClose={vi.fn()} onCancel={onCancel} onRerun={onRerun} />);
    expect(screen.getByText(/"uptime": 5/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel command' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send again' }));
    expect(onRerun).toHaveBeenCalled();
    rerender(<RpcRequestDetail open request={req('b', { status: 'QUEUED' })} onClose={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel command' }));
    expect(onCancel).toHaveBeenCalledWith('b');
    rerender(<RpcRequestDetail open request={req('c', { status: 'FAILED', error: 'device offline' })} onClose={vi.fn()} />);
    expect(screen.getByText('device offline')).toBeInTheDocument();
  });
});

describe('RpcConsoleView', () => {
  function fakes(catalog: Partial<RpcCatalog> = {}) {
    const subs = new Set<IotLiveSubscription>();
    const live: IotLive & { emit(p: unknown): void } = {
      state: 'live',
      subscribe(s) { subs.add(s as IotLiveSubscription); return () => { subs.delete(s as IotLiveSubscription); }; },
      onState: () => () => undefined,
      emit(p) { for (const s of subs) s.onLive(p); },
    };
    const adapter: IotAdapter = {
      rpc: {
        methods: vi.fn().mockResolvedValue({ commands: COMMANDS.slice(0, 2), canSendRaw: false, supported: true, ...catalog }),
        send: vi.fn().mockResolvedValue(req('new', { method: 'sys.info' })),
        list: vi.fn().mockResolvedValue({ items: [req('old', { status: 'SUCCESSFUL', method: 'net.status' })], nextCursor: null }),
        get: vi.fn().mockImplementation(async (id: string) => req(id, { status: 'SUCCESSFUL', response: { ok: 1 } })),
        cancel: vi.fn(),
        parseLive: (p) => p as never,
      },
    };
    return { live, adapter, subs };
  }

  it('sends from the catalog, shows the request at once and follows it live', async () => {
    const user = userEvent.setup();
    const { live, adapter, subs } = fakes();
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" now={T0.getTime()} /></IotAdapterProvider>);
    await screen.findByText('net.status');
    expect([...subs][0].params).toEqual({ deviceId: 'd1' });
    // the send panel is a modal; a sent command closes it
    expect(screen.queryByLabelText('Command')).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Send a command' }));
    const modal = await screen.findByRole('dialog', { name: 'Send a command' });
    await user.selectOptions(within(modal).getByLabelText('Command'), 'sys.info');
    await user.click(within(modal).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(adapter.rpc!.send).toHaveBeenCalledWith('d1', { method: 'sys.info', requestKey: expect.any(String) }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Send a command' })).toBeNull());
    const row = (await screen.findByText('Queued')).closest('tr')!;
    expect(row).toHaveAttribute('data-state', 'new');
    act(() => live.emit({ request: req('new', { status: 'SUCCESSFUL', completedAt: new Date(T0.getTime() + 900) }) }));
    expect(await within(row).findByText('Successful')).toBeInTheDocument();
    await user.click(within(row).getByText('sys.info'));
    expect(await screen.findByText(/"ok": 1/)).toBeInTheDocument();
  });

  it('shows a viewer who may send nothing the commands greyed, says when there are none, and is the fleet log without a device', async () => {
    const user = userEvent.setup();
    const { live, adapter, subs } = fakes({ commands: COMMANDS.slice(2, 3) });
    const first = render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await screen.findByText('net.status');
await user.click(await screen.findByRole('button', { name: 'Send a command' }));
    await user.selectOptions(await screen.findByLabelText('Command'), 'cfg.sync');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    first.unmount();
    const empty = fakes({ commands: [] });
    const second = render(<IotAdapterProvider adapter={empty.adapter} live={empty.live}><RpcConsoleView deviceId="d1" actions={<a href="/settings">Command settings</a>} /></IotAdapterProvider>);
    // the host's own link sits beside "Send a command", after it
    const button = await screen.findByRole('button', { name: 'Send a command' });
    expect(button.compareDocumentPosition(screen.getByRole('link', { name: 'Command settings' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(button);
    expect(await screen.findByText('The device profile declares no commands.')).toBeInTheDocument();
    second.unmount();
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView /></IotAdapterProvider>);
    await screen.findByText('net.status');
    expect([...subs][0].params).toEqual({ deviceId: '*' });
    expect(adapter.rpc!.list).toHaveBeenLastCalledWith(
      { deviceId: undefined, page: 1, pageSize: 25, limit: 25, search: undefined, sort: undefined, statuses: undefined, sources: undefined },
      expect.anything(),
    );
  });

  it('is a full list: a sort and a search go to the host with the page, and its total pages the table', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes();
    (adapter.rpc!.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [req('old', { status: 'SUCCESSFUL', method: 'net.status' })], nextCursor: null, total: 60 });
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await screen.findByText('net.status');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Method/ }));
    await waitFor(() => expect(adapter.rpc!.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: { key: 'method', dir: 'asc' } }), expect.anything()));
    await user.type(screen.getByRole('searchbox'), 'net');
    await waitFor(() => expect(adapter.rpc!.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'net' }), expect.anything()));
  });
});

describe('RpcRequestList in the browser', () => {
  it('without onQueryChange searches, sorts and pages the rows it holds', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 30 }, (_, i) => req(`r${i}`, { method: i % 2 ? `net.m${i}` : `sys.m${i}` }));
    render(<RpcRequestList requests={rows} />);
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
    await user.type(screen.getByRole('searchbox'), 'net.m1');
    await waitFor(() => expect(screen.queryByText('sys.m2')).toBeNull());
    expect(screen.getByText('net.m11')).toBeInTheDocument();
  });
});
