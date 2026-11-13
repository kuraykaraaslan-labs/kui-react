import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type RpcCatalog } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import { rpcMaskedPaths, rpcPresetOf, rpcStatusRank, withoutRpcPaths, type RpcCommand, type RpcRequest } from '../types/rpc';
import { RpcSendPanel } from './RpcSendPanel';
import { RpcRequestDetail } from './RpcRequestDetail';
import { RpcRequestList, rpcDuration } from './RpcRequestList';
import { RpcConsoleView } from './RpcConsoleView';
import { rpcParamProblems, rpcParamsToSend } from './rpc-params';
import { IOT_MESSAGES } from '../messages';

/* NB 41-ui-fixes/23: masked values, one send, the outcome told as it is, the confirmation, gating, live merging. */

const T0 = new Date('2026-10-24T12:00:00Z');
const WIFI: RpcCommand = {
  method: 'net.wifi.set', label: 'Set Wi-Fi', tier: 'privileged', highImpact: false, oneway: false, sendable: true, maskedParams: ['psk'],
  paramsSchema: { ssid: { label: 'Network', type: 'text', required: true }, psk: { label: 'Password', type: 'text', required: true } },
};
const PING: RpcCommand = {
  method: 'sys.ping', label: 'Ping', tier: 'basic', highImpact: false, oneway: false, sendable: true,
  paramsSchema: { host: { label: 'Host', type: 'text', required: true }, count: { label: 'Count', type: 'number', min: 1, max: 10 } },
};
const SYNC: RpcCommand = { method: 'cfg.sync', label: 'Sync', tier: 'basic', highImpact: false, oneway: true, paramsSchema: {}, sendable: true };
const REBOOT: RpcCommand = {
  method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, confirmText: 'REBOOT', oneway: true, sendable: true,
  paramsSchema: { delay: { label: 'Delay', type: 'number' }, token: { label: 'Token', type: 'text' } }, maskedParams: ['token'],
};
const req = (id: string, over: Partial<RpcRequest> = {}): RpcRequest => ({
  rpcId: id, deviceId: 'd1', method: 'sys.ping', oneway: false, persistent: false, status: 'QUEUED', source: 'console', createdAt: T0, ...over,
});

describe('masked values never come back as values (1.1, 1.2)', () => {
  it('finds the masked paths: the host\'s, else the command\'s and every mask', () => {
    expect(rpcMaskedPaths({ params: { a: '***' }, maskedPaths: ['psk'] })).toEqual(['psk']);
    expect(rpcMaskedPaths({ params: { ssid: 'x', psk: '***', wifi: { password: '***', ok: 1 } } }, WIFI).sort()).toEqual(['psk', 'wifi.password']);
    expect(withoutRpcPaths({ a: 1, w: { p: '***', s: 2 }, l: [{ t: '***' }] }, ['w.p', 'l.0.t'])).toEqual({ a: 1, w: { s: 2 }, l: [{}] });
  });

  it('"Send again" carries the request\'s own settings and leaves its masked values out (N1)', () => {
    const r = req('a', { method: 'net.wifi.set', params: { ssid: 'Home', psk: '***' }, maskedPaths: ['psk'], persistent: true, oneway: false, timeoutMs: 20_000, expiresAt: new Date(T0.getTime() + 3_600_000) });
    expect(rpcPresetOf(r)).toEqual({ method: 'net.wifi.set', params: { ssid: 'Home' }, maskedPaths: ['psk'], oneway: false, persistent: true, timeoutMs: 20_000, expiresInS: 3600 });
  });

  it('types a masked parameter in a password field and asks for it again instead of sending the mask', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const preset = rpcPresetOf(req('a', { method: 'net.wifi.set', params: { ssid: 'Home', psk: '***' }, maskedPaths: ['psk'] }));
    render(<RpcSendPanel commands={[WIFI]} onSend={onSend} preset={preset} />);
    const psk = screen.getByLabelText(/Password/) as HTMLInputElement;
    expect(psk.type).toBe('password');
    expect(psk.value).toBe('');
    expect((screen.getByLabelText(/Network/) as HTMLInputElement).type).toBe('text');
    expect(screen.getByText('Hidden values are not sent again: enter Password again.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    await user.type(psk, 's3cret');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ method: 'net.wifi.set', params: { ssid: 'Home', psk: 's3cret' } })));
  });
});

describe('the send panel (1.5, 1.19, N1)', () => {
  it('checks what the host checks: required values, ranges, the timeout and the expiry', () => {
    expect(rpcParamProblems(PING.paramsSchema, { count: 20 }, IOT_MESSAGES)).toEqual({ host: 'Host is required.', count: 'At most 10.' });
    expect(rpcParamsToSend(PING.paramsSchema, { host: 'a', count: undefined })).toEqual({ host: 'a' });
    expect(rpcParamsToSend({ on: { label: 'On', type: 'boolean' } }, {})).toEqual({ on: false });
  });

  it('refuses a timeout or an expiry out of range, and puts the host\'s parameter refusal on its field', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new IotApiError('validation', 'Some values were not accepted.', { fieldErrors: { 'params.host': 'Not a host this device can reach.', params: 'x' } }));
    render(<RpcSendPanel commands={[PING]} onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.ping');
    await user.type(screen.getByLabelText(/Host/), 'nowhere');
    await user.type(screen.getByLabelText('Answer timeout (seconds)'), '601');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Between 1 and 600 seconds.')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Answer timeout (seconds)'));
    await user.click(screen.getByLabelText(/persistent/));
    await user.type(screen.getByLabelText('Give up after (minutes)'), '20000');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Between 1 and 10080 minutes (7 days).')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Give up after (minutes)'));
    await user.type(screen.getByLabelText('Give up after (minutes)'), '30');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ persistent: true, expiresInS: 1800 })));
    expect(await screen.findByText('Not a host this device can reach.')).toBeInTheDocument();
    expect(screen.getByText('Some values were not accepted.')).toBeInTheDocument();
  });

  it('offers one-way only for a raw method; a catalog command\'s one-way is shown, and a preset replaces earlier choices', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RpcSendPanel commands={[SYNC, PING]} canSendRaw onSend={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'cfg.sync');
    expect(screen.queryByLabelText(/one-way/)).toBeNull();
    expect(screen.getByText('One-way: the device does not answer this command (set in the catalog).')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Command'), '__raw__');
    expect(screen.getByLabelText(/one-way/)).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.ping');
    await user.click(screen.getByLabelText(/persistent/));
    rerender(<RpcSendPanel commands={[SYNC, PING]} canSendRaw onSend={vi.fn()} preset={{ method: 'sys.ping', params: { host: 'h' }, persistent: false, timeoutMs: 15_000 }} />);
    expect(screen.getByLabelText(/persistent/)).not.toBeChecked();
    expect(screen.getByLabelText('Answer timeout (seconds)')).toHaveValue(15);
  });

  it('sends once: the key is kept after a send that got no answer, renewed after an answer', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn()
      .mockRejectedValueOnce(new IotApiError('unavailable', ''))
      .mockRejectedValueOnce(new IotApiError('validation', 'Refused.'))
      .mockResolvedValue(undefined);
    render(<RpcSendPanel commands={[PING]} onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.ping');
    await user.type(screen.getByLabelText(/Host/), 'h');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/the command may have been sent/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(3));
    const keys = onSend.mock.calls.map((c) => c[0].requestKey);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});

describe('the high-impact confirmation (1.6, N4)', () => {
  it('names the device, the command and every parameter (a masked one as hidden), and stays open with the refusal', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValueOnce(new IotApiError('validation', 'The typed confirmation does not match.')).mockResolvedValue(undefined);
    render(<RpcSendPanel commands={[REBOOT]} deviceName="Pump 7" onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.reboot');
    await user.type(screen.getByLabelText('Delay'), '5');
    await user.type(screen.getByLabelText('Token'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send Reboot (sys.reboot) to Pump 7?' });
    expect(within(dialog).getByText('Delay').nextSibling).toHaveTextContent('5');
    expect(within(dialog).getByText('Token').nextSibling).toHaveTextContent('hidden');
    expect(dialog).not.toHaveTextContent('abc');
    const phrase = within(dialog).getByLabelText('Type REBOOT to confirm');
    await user.type(phrase, 'REBOOT');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await within(dialog).findByText('The typed confirmation does not match.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(phrase).toHaveValue('REBOOT');
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSend).toHaveBeenCalledTimes(2);
  });
});

describe('the request detail and list (1.7, 1.21)', () => {
  it('words a stored error by its reason with what the device said, and times to the second', () => {
    render(<RpcRequestDetail open request={req('a', { status: 'FAILED', error: 'bad_params: ssid', errorReason: 'device_bad_params', errorDetail: 'ssid too long', completedAt: T0 })} onClose={vi.fn()} />);
    expect(screen.getByText('The device refused the parameters.')).toBeInTheDocument();
    expect(screen.getByText('The device said: ssid too long')).toBeInTheDocument();
    expect(screen.queryByText('bad_params: ssid')).toBeNull();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/\d{2}:\d{2}:\d{2}/);
  });

  it('asks before cancelling a request that already left, and is busy while it cancels', async () => {
    const user = userEvent.setup();
    let done!: () => void;
    const onCancel = vi.fn(() => new Promise<void>((r) => { done = r; }));
    render(<RpcRequestDetail open request={req('a', { status: 'SENT', sentAt: T0 })} onClose={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel command' }));
    const ask = await screen.findByRole('dialog', { name: 'Cancel sys.ping?' });
    expect(ask).toHaveTextContent(/may have received it/);
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Cancel command' }));
    expect(onCancel).toHaveBeenCalledWith('a');
    act(() => done());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cancel sys.ping?' })).toBeNull());
  });

  it('writes durations in the viewer\'s units and digits', () => {
    expect(rpcDuration(850, IOT_MESSAGES.units, 'en')).toBe('850 ms');
    expect(rpcDuration(1500, { ...IOT_MESSAGES.units, seconds: '{n} sn' }, 'tr')).toBe('1,5 sn');
    render(<RpcRequestList requests={[req('a', { status: 'SUCCESSFUL', completedAt: new Date(T0.getTime() + 180_000) })]} />);
    expect(screen.getByText('3 min')).toBeInTheDocument();
  });

  it('never moves a status back', () => {
    expect(rpcStatusRank('SENT')).toBeGreaterThan(rpcStatusRank('QUEUED'));
    expect(rpcStatusRank('FAILED')).toBe(rpcStatusRank('SUCCESSFUL'));
  });
});

describe('RpcConsoleView (1.3, 1.4, 1.7, 1.10, 1.12–1.15)', () => {
  function fakes(catalog: Partial<RpcCatalog> = {}, opts: { refuse?: boolean } = {}) {
    const subs = new Set<IotLiveSubscription>();
    const live: IotLive & { emit(p: unknown): void; snapshot(p: unknown): void } = {
      state: 'live',
      subscribe(s) {
        subs.add(s as IotLiveSubscription);
        if (opts.refuse) queueMicrotask(() => s.onError?.('forbidden'));
        return () => { subs.delete(s as IotLiveSubscription); };
      },
      onState: () => () => undefined,
      emit(p) { for (const s of subs) s.onLive(p); },
      snapshot(p) { for (const s of subs) s.onSnapshot?.(p); },
    };
    const adapter: IotAdapter = {
      rpc: {
        methods: vi.fn().mockResolvedValue({ commands: [PING, WIFI], canSendRaw: false, supported: true, ...catalog }),
        send: vi.fn().mockResolvedValue(req('new', { status: 'FAILED', error: 'device offline', errorReason: 'device_offline' })),
        list: vi.fn().mockResolvedValue({ items: [req('old', { status: 'SUCCESSFUL', method: 'net.status', tier: 'basic', completedAt: T0 })], nextCursor: null }),
        get: vi.fn().mockImplementation(async (id: string) => req(id, { status: 'SUCCESSFUL', method: 'net.status', tier: 'basic', params: { psk: '***' }, maskedPaths: ['psk'] })),
        cancel: vi.fn(),
        parseLive: (p) => p as never,
        parseSnapshot: (p) => (p as { requests: RpcRequest[] }).requests,
      },
    };
    return { live, adapter, subs };
  }

  it('tells the outcome the host answered: a failed send by its reason, not "sent"', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const { live, adapter } = fakes();
    render(<IotAdapterProvider adapter={adapter} live={live} notify={notify}><RpcConsoleView deviceId="d1" deviceOnline={false} /></IotAdapterProvider>);
    await user.selectOptions(await screen.findByLabelText('Command'), 'sys.ping');
    expect(screen.getByText(/The device is offline: without "persistent"/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Host/), 'h');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'error', message: 'The device is offline, so the command was not sent.' }));
    // and the line under the form keeps saying it
    const line = screen.getByRole('status', { name: 'Last command' });
    expect(within(line).getByText('The device is offline, so the command was not sent.')).toBeInTheDocument();
  });

  it('reads the history again at once when a send got no answer', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes();
    (adapter.rpc!.send as ReturnType<typeof vi.fn>).mockRejectedValue(new IotApiError('unavailable', ''));
    // the history under the form; behind its button it is read when opened
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" history="inline" /></IotAdapterProvider>);
    await screen.findByText('net.status');
    const reads = (adapter.rpc!.list as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.ping');
    await user.type(screen.getByLabelText(/Host/), 'h');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/the command may have been sent/)).toBeInTheDocument();
    await waitFor(() => expect((adapter.rpc!.list as ReturnType<typeof vi.fn>).mock.calls.length).toBe(reads + 1));
  });

  it('says when the catalog could not be read, with a retry', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes();
    (adapter.rpc!.methods as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new IotApiError('unavailable', ''));
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    expect(await screen.findByText('The commands of this device could not be read, so nothing can be sent yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Command')).toBeInTheDocument();
  });

  it('offers Send again and Cancel only for what the viewer may send; Send again leaves the masked values out', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes({ commands: [{ ...PING, sendable: false }, WIFI] });
    (adapter.rpc!.list as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [
      req('p', { status: 'QUEUED', method: 'sys.ping', tier: 'basic' }),
      req('w', { status: 'SUCCESSFUL', method: 'net.wifi.set', tier: 'privileged', completedAt: T0 }),
    ], nextCursor: null });
    (adapter.rpc!.get as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => (id === 'p'
      ? req('p', { status: 'QUEUED', method: 'sys.ping', tier: 'basic' })
      : req('w', { status: 'SUCCESSFUL', method: 'net.wifi.set', tier: 'privileged', completedAt: T0, params: { ssid: 'Home', psk: '***' }, maskedPaths: ['psk'] })));
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await user.click(await screen.findByText('sys.ping'));
    const modal = await screen.findByRole('dialog', { name: 'Command sys.ping' });
    expect(within(modal).queryByRole('button', { name: 'Send again' })).toBeNull();
    expect(within(modal).queryByRole('button', { name: 'Cancel command' })).toBeNull();
    await user.click(within(modal).getByRole('button', { name: 'Back to history' }));
    await user.click(await within(modal).findByText('net.wifi.set'));
    await waitFor(() => expect(screen.getByText(/"ssid": "Home"/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Send again' }));
    // "Send again" closes the history and fills the form
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByLabelText(/Network/)).toHaveValue('Home');
    expect(screen.getByLabelText(/Password/)).toHaveValue('');
  });

  it('merges the snapshot, never moves a row back, and polls a refused subscription', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes();
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await screen.findByText('net.status');
    expect(screen.getByText('Live')).toBeInTheDocument();
    act(() => live.snapshot({ requests: [req('late', { status: 'SENT', method: 'sys.reboot', createdAt: new Date(T0.getTime() + 1000) })] }));
    expect(await screen.findByText('sys.reboot')).toBeInTheDocument();
    act(() => live.emit({ request: req('old', { status: 'SENT', method: 'net.status' }) }));
    expect(within(screen.getByText('net.status').closest('tr')!).getByText('Successful')).toBeInTheDocument();
  });

  it('a refused subscription reads as polling', async () => {
    const user = userEvent.setup();
    const { live, adapter } = fakes({}, { refuse: true });
    render(<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await screen.findByText('net.status');
    expect(await screen.findByText('Updates every 30 s')).toBeInTheDocument();
  });
});

describe('review fixes (41-ui-fixes/23 C1, C7, C9, C10, C12)', () => {
  it('C1: a hidden value left out by "Send again" is marked and nothing is sent until it is entered, optional or raw', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const optional: RpcCommand = { ...WIFI, paramsSchema: { ssid: { label: 'Network', type: 'text', required: true }, psk: { label: 'Password', type: 'text' } } };
    const { rerender } = render(<RpcSendPanel commands={[optional]} canSendRaw onSend={onSend}
      preset={{ method: 'net.wifi.set', params: { ssid: 'Home' }, maskedPaths: ['psk'] }} />);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('A hidden value: enter it again.')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Password/), 'x');
    expect(screen.queryByText(/Hidden values are not sent again/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ params: { ssid: 'Home', psk: 'x' } })));
    // raw: the JSON must carry the path again (not the mask)
    rerender(<RpcSendPanel commands={[optional]} canSendRaw onSend={onSend}
      preset={{ method: 'net.other', params: { ssid: 'Home', wifi: { psk: '***' } }, maskedPaths: ['wifi.psk'] }} />);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    // the note and the mark on the JSON box
    expect(screen.getAllByText('Hidden values are not sent again: enter wifi.psk again.')).toHaveLength(2);
  });

  it('C7: a name the host holds secret is a password field and hidden in the confirmation; "Send again" leaves it out', async () => {
    const user = userEvent.setup();
    const secret = (n: string, raw: boolean) => /pass|token/i.test(n) || (raw && n === 'key');
    const CMD: RpcCommand = { method: 'sys.set', label: 'Set', tier: 'basic', highImpact: true, oneway: false, sendable: true,
      paramsSchema: { wifi_password: { label: 'Wi-Fi password', type: 'text' }, key: { label: 'Key', type: 'text' } } };
    render(<RpcSendPanel commands={[CMD]} isSecretParam={secret} onSend={vi.fn().mockResolvedValue(undefined)} />);
    await user.selectOptions(screen.getByLabelText('Command'), 'sys.set');
    expect((screen.getByLabelText('Wi-Fi password') as HTMLInputElement).type).toBe('password');
    expect((screen.getByLabelText('Key') as HTMLInputElement).type).toBe('text');
    await user.type(screen.getByLabelText('Wi-Fi password'), 'pw1');
    await user.type(screen.getByLabelText('Key'), 'pump');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).not.toHaveTextContent('pw1');
    expect(dialog).toHaveTextContent('pump');
    expect(rpcMaskedPaths({ params: { api_token: 'abc', key: 'k' } }, null, secret).sort()).toEqual(['api_token', 'key']);
    expect(rpcMaskedPaths({ params: { key: 'k' } }, { maskedParams: [] }, secret)).toEqual([]);
  });

  it('C10: the params check reads a text\'s max (as the host does) and refuses a type the host does not send', () => {
    expect(rpcParamProblems({ t: { label: 'T', type: 'text', maxLength: 2 } }, { t: 'abc' }, IOT_MESSAGES)).toEqual({});
    expect(rpcParamProblems({ t: { label: 'T', type: 'text', max: 2 } }, { t: 'abc' }, IOT_MESSAGES)).toEqual({ t: 'At most 2 characters.' });
    expect(rpcParamProblems({ c: { label: 'C', type: 'color' } }, { c: '#fff' }, IOT_MESSAGES)).toEqual({ c: 'This kind of parameter cannot be sent.' });
  });

  it('C12: "Send again" waits for the full read of the request', async () => {
    let answer!: (r: RpcRequest) => void;
    const adapter: IotAdapter = {
      rpc: {
        methods: vi.fn().mockResolvedValue({ commands: [WIFI], canSendRaw: false, supported: true }),
        send: vi.fn(), cancel: vi.fn(),
        list: vi.fn().mockResolvedValue({ items: [req('w', { method: 'net.wifi.set', status: 'SUCCESSFUL', completedAt: T0 })], nextCursor: null }),
        get: vi.fn(() => new Promise<RpcRequest>((r) => { answer = r; })),
      },
    };
    const user = userEvent.setup();
    render(<IotAdapterProvider adapter={adapter}><RpcConsoleView deviceId="d1" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await user.click(await screen.findByText('net.wifi.set'));
    await waitFor(() => expect(adapter.rpc!.get).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Send again' })).toBeDisabled();
    act(() => answer(req('w', { method: 'net.wifi.set', status: 'SUCCESSFUL', completedAt: T0, params: { ssid: 'Home', psk: '***' }, maskedPaths: ['psk'] })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send again' })).toBeEnabled());
  });
});
