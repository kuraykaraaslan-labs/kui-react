import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, RpcCatalog } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import { isRefusedRpcMethod, type RpcCommand, type RpcRequest } from '../types/rpc';
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
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'sys.ping', params: { host: '8.8.8.8' } }));
  });

  it('asks for the typed phrase of a high-impact command, and a click confirmation without one', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<RpcSendPanel commands={COMMANDS} onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.reboot');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send sys.reboot?' });
    await user.type(within(dialog).getByLabelText('Type REBOOT to confirm'), 'REBOOT');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'sys.reboot', confirm: true, confirmText: 'REBOOT' }));
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.restart');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Send sys.restart?' })).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenLastCalledWith({ method: 'sys.restart', confirm: true }));
  });

  it('sends raw RPC only with the capability, refuses a non-object, and warns about an offline device', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<RpcSendPanel commands={COMMANDS} onSend={onSend} />);
    expect([...(screen.getByLabelText('Command') as HTMLSelectElement).options].map((o) => o.value)).not.toContain('__raw__');
    rerender(<RpcSendPanel commands={COMMANDS} onSend={onSend} canSendRaw deviceOnline={false} />);
    await user.selectOptions(screen.getByLabelText('Command'), '__raw__');
    await user.type(screen.getByLabelText('Method name'), 'ubus.call');
    const params = screen.getByLabelText('Parameters (JSON object)');
    await user.clear(params);
    await user.type(params, '[[1]');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Not a JSON object.')).toBeInTheDocument();
    expect(screen.getByText(/The device is offline/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/persistent/));
    expect(screen.queryByText(/The device is offline/)).toBeNull();
    await user.clear(params);
    await user.type(params, '{{"path":"system"}');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ method: 'ubus.call', params: { path: 'system' }, persistent: true }));
  });

  it('is disabled with the reason for a ThingsBoard-scheme device (OD-85)', () => {
    render(<RpcSendPanel commands={[]} supported={false} onSend={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Commands' })).toHaveTextContent(/not available for devices on the ThingsBoard compatible scheme/);
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
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.info');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(adapter.rpc!.send).toHaveBeenCalledWith('d1', { method: 'sys.info' }));
    const row = (await screen.findByText('Queued')).closest('tr')!;
    expect(row).toHaveAttribute('data-state', 'new');
    act(() => live.emit({ request: req('new', { status: 'SUCCESSFUL', completedAt: new Date(T0.getTime() + 900) }) }));
    expect(await within(row).findByText('Successful')).toBeInTheDocument();
    await user.click(within(row).getByText('sys.info'));
    expect(await screen.findByText(/"ok": 1/)).toBeInTheDocument();
  });

  it('hides the send panel for a viewer who may send nothing, and is the fleet log without a device', async () => {
    const { live, adapter, subs } = fakes({ commands: COMMANDS.slice(2, 3) });
    const { unmount } = render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await screen.findByText('net.status');
    await waitFor(() => expect(adapter.rpc!.methods).toHaveBeenCalled());
    expect(screen.queryByLabelText('Command')).toBeNull();
    unmount();
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView /></IotAdapterProvider>);
    await screen.findByText('net.status');
    expect([...subs][0].params).toEqual({ deviceId: '*' });
    expect(adapter.rpc!.list).toHaveBeenLastCalledWith({ deviceId: undefined, limit: 25 }, expect.anything());
  });
});
