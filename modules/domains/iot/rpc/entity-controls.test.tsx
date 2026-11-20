import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmHost } from '@/modules/ui/ConfirmDialog';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCommandBindingsApi, type IotEntityControlsApi } from '../api/adapter';
import { mergeIotMessages } from '../messages';
import type { CommandBinding, EntityControl, EntityControlsView } from '../types/rpc';
import { EntityControlsDrawer } from './EntityControlsDrawer';
import { CommandBindingEditorDrawer, RpcCommandBindingsDrawer } from './RpcCommandBindingsDrawer';
import { boundText, controlParams, draftOf, inputOf, paramMapOf, paramRowsOf } from './entity-controls';

const m = mergeIotMessages();
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const IDENTIFY: EntityControl = { name: 'identify', label: 'Identify', params: {}, tier: 'basic', confirmation: 'none' };
const TURN_OFF: EntityControl = { name: 'turn_off', label: 'Turn off', params: {}, tier: 'privileged', confirmation: 'confirm' };
const SET_VALUE: EntityControl = {
  name: 'set_value', label: 'Set value', tier: 'privileged', confirmation: 'confirm',
  params: { value: { type: 'number', label: 'Value', required: true, min: 0, max: 100 } },
};
const RESTART: EntityControl = { name: 'restart', label: 'Restart', params: {}, tier: 'critical', confirmation: 'typed', confirmText: 'RESTART' };

const view = (over: Partial<EntityControlsView> = {}): EntityControlsView => ({
  kind: 'iot_device', entityId: D, controls: [IDENTIFY, TURN_OFF, SET_VALUE, RESTART], permitted: true,
  sinks: [{
    sink: 'iot_rpc',
    bindings: [
      { control: 'identify', targets: [{ targetId: 'b1', label: 'Pump 7 · Blink', tier: 'basic' }] },
      { control: 'turn_off', targets: { count: 2 } },
      { control: 'set_value', targets: [{ targetId: 'b3', label: 'Pump 7 · Set speed', tier: 'privileged' }] },
      { control: 'restart', targets: [{ targetId: 'b4', label: 'Pump 7 · Reboot', tier: 'critical' }] },
    ],
  }],
  failedSinks: [],
  ...over,
});

const BINDING: CommandBinding = {
  bindingId: 'bnd1', targetKind: 'iot_device', targetKindLabel: 'IoT devices', targetEntityId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', targetLabel: 'Cold room sensor',
  control: 'set_value', controlLabel: 'Set value', controlTier: 'privileged', position: 0, deviceId: D, deviceName: 'Pump 7', targetType: 'COMMAND',
  method: 'set_speed', commandLabel: 'Set speed', paramMap: { rpm: { from: 'control', param: 'value' } }, tier: 'privileged', highImpact: false, enabled: true,
  note: null, state: 'ok', version: 3, updatedAt: '2026-11-20T10:00:00Z',
};

function bindingsApi(over: Partial<IotCommandBindingsApi> = {}): IotCommandBindingsApi {
  return {
    list: vi.fn(async () => ({ items: [BINDING], total: 1 })),
    create: vi.fn(async (input) => ({ ...BINDING, ...input, bindingId: 'new' } as CommandBinding)),
    update: vi.fn(async (_id, patch) => ({ ...BINDING, ...patch } as CommandBinding)),
    remove: vi.fn(async () => undefined),
    check: vi.fn(async () => []),
    kinds: vi.fn(async () => [{ kind: 'iot_device', label: 'IoT devices', controls: [IDENTIFY, TURN_OFF, SET_VALUE, RESTART] }]),
    targets: vi.fn(async () => [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', label: 'Cold room sensor' }]),
    commands: vi.fn(async () => ({
      commands: [{ method: 'set_speed', label: 'Set speed', tier: 'privileged' as const, highImpact: false, paramsSchema: { rpm: { label: 'Speed', type: 'number' as const, required: true } } }],
      attributesAllowed: true,
    })),
    ...over,
  };
}

function controlsApi(over: Partial<IotEntityControlsApi> = {}): IotEntityControlsApi {
  return {
    describe: vi.fn(async () => view()),
    send: vi.fn(async () => ({ outcome: 'dispatched' as const, failedSinks: [], targets: [{ sink: 'iot_rpc', targetId: 'b1', label: 'Pump 7 · Blink', outcome: 'queued' as const }] })),
    ...over,
  };
}

function renderWith(adapter: IotAdapter, ui: React.ReactNode) {
  return render(<IotAdapterProvider adapter={adapter} capabilities={{}}><ConfirmHost />{ui}</IotAdapterProvider>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('the helpers', () => {
  it('words the bound targets: labels, a count when some are hidden, or not connected', () => {
    expect(boundText(view(), 'identify', m)).toBe('Pump 7 · Blink');
    expect(boundText(view(), 'turn_off', m)).toBe('2 devices');
    expect(boundText(view({ sinks: [] }), 'turn_off', m)).toBe('Not connected to any device');
  });

  it('checks a control\'s values before sending', () => {
    expect(controlParams(SET_VALUE, { value: '' }, m).problems).toEqual({ value: 'Required' });
    expect(controlParams(SET_VALUE, { value: '101' }, m).problems).toEqual({ value: 'At most 100' });
    expect(controlParams(SET_VALUE, { value: 'x' }, m).problems).toEqual({ value: 'Enter a number' });
    expect(controlParams(SET_VALUE, { value: '42,5' }, m)).toEqual({ params: { value: 42.5 }, problems: {} });
  });

  it('turns the param rows into the host\'s map and back, fixed values typed by the device param', () => {
    const schema = { rpm: { label: 'Speed', type: 'number' as const }, mode: { label: 'Mode', type: 'text' as const } };
    const rows = paramRowsOf({ rpm: { from: 'control', param: 'value' }, mode: { const: 'eco' } }, schema);
    expect(rows.map((r) => [r.key, r.source, r.value])).toEqual([['rpm', 'from:value', ''], ['mode', 'fixed', 'eco']]);
    expect(paramMapOf([...rows, { id: 'x', key: 'limit', source: 'fixed', value: '' }], schema)).toEqual({ rpm: { from: 'control', param: 'value' }, mode: { const: 'eco' } });
    expect(paramMapOf([{ id: 'a', key: 'speed_sp', source: 'fixed', value: '12' }])).toEqual({ speed_sp: { const: 12 } });
    expect(inputOf(draftOf(BINDING))).toMatchObject({ targetKind: 'iot_device', control: 'set_value', deviceId: D, method: 'set_speed', paramMap: { rpm: { from: 'control', param: 'value' } }, note: null });
  });
});

describe('EntityControlsDrawer', () => {
  it('lists the controls with tier and what is bound, and sends a control without confirmation with a press key', async () => {
    const api = controlsApi();
    const user = userEvent.setup();
    renderWith({ entityControls: api }, <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} recordName="Pump 7" />);
    expect(await screen.findByText('Identify')).toBeTruthy();
    expect(screen.getByText('2 devices')).toBeTruthy();
    expect(screen.getByText('High impact')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Send: Identify' }));
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
    const [, , control, body, key] = (api.send as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(control).toBe('identify');
    expect(body).toEqual({});
    expect(key).toMatch(/^press-[A-Za-z0-9:_-]+$/);
    expect(await screen.findByText('Queued')).toBeTruthy();
    // no "Bind a device…" without the permission
    expect(screen.queryByRole('button', { name: 'Bind a device…' })).toBeNull();
  });

  it('asks the values, then the confirmation naming the record, and sends confirmed', async () => {
    const api = controlsApi();
    const user = userEvent.setup();
    renderWith({ entityControls: api }, <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} recordName="Pump 7" />);
    await user.click(await screen.findByRole('button', { name: 'Send: Set value' }));
    const field = screen.getByLabelText(/Value/);
    await user.click(screen.getAllByRole('button', { name: 'Send' }).at(-1)!);
    expect(await screen.findByText('Required')).toBeTruthy();
    expect(api.send).not.toHaveBeenCalled();
    await user.type(field, '55');
    await user.click(screen.getAllByRole('button', { name: 'Send' }).at(-1)!);
    const dialog = await screen.findByRole('dialog', { name: 'Set value on Pump 7?' });
    await user.click(within(dialog).getByRole('button', { name: 'Set value' }));
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
    expect((api.send as ReturnType<typeof vi.fn>).mock.calls[0][3]).toEqual({ params: { value: 55 }, confirmed: true });
  });

  it('a typed control waits for the phrase', async () => {
    const api = controlsApi();
    const user = userEvent.setup();
    renderWith({ entityControls: api }, <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} recordName="Pump 7" />);
    await user.click(await screen.findByRole('button', { name: 'Send: Restart' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restart on Pump 7?' });
    const confirm = within(dialog).getByRole('button', { name: 'Restart' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(dialog).getByLabelText(/RESTART/), 'RESTART');
    await user.click(confirm);
    await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
    expect((api.send as ReturnType<typeof vi.fn>).mock.calls[0][3]).toEqual({ confirmed: true, confirmText: 'RESTART' });
  });

  it('keeps the press key for a retry after a failure, and a new one after an answer', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new IotApiError('unavailable', 'Network down'))
      .mockResolvedValue({ outcome: 'nothing_bound', failedSinks: ['iot_rpc'] });
    const api = controlsApi({ send });
    const user = userEvent.setup();
    renderWith({ entityControls: api }, <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} />);
    const btn = await screen.findByRole('button', { name: 'Send: Identify' });
    await user.click(btn);
    expect(await screen.findByText('Network down')).toBeTruthy();
    await user.click(btn);
    expect(await screen.findByText('Not connected to any device', { selector: 'p' })).toBeTruthy();
    expect(screen.getAllByText('Could not reach Device commands').length).toBeGreaterThan(0);
    await user.click(btn);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    const keys = send.mock.calls.map((c) => c[4]);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it('Send is disabled without the permission or with nothing bound', async () => {
    renderWith({ entityControls: controlsApi({ describe: vi.fn(async () => view({ permitted: false })) }) },
      <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} />);
    expect(((await screen.findByRole('button', { name: 'Send: Identify' })) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('You may not use these controls.')).toBeTruthy();
    cleanup();
    renderWith({ entityControls: controlsApi({ describe: vi.fn(async () => view({ sinks: [] })) }) },
      <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} />);
    expect(((await screen.findByRole('button', { name: 'Send: Identify' })) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Bind a device…" opens the editor with the record and control fixed', async () => {
    const user = userEvent.setup();
    renderWith({ entityControls: controlsApi(), commandBindings: bindingsApi() },
      <EntityControlsDrawer open onClose={() => undefined} kind="iot_device" entityId={D} recordName="Pump 7" canManageBindings />);
    await user.click((await screen.findAllByRole('button', { name: 'Bind a device…' }))[2]);
    const editor = await screen.findByRole('dialog', { name: 'New binding' });
    expect(within(editor).getByText('Pump 7')).toBeTruthy();
    await waitFor(() => expect((within(editor).getByLabelText('Control') as HTMLSelectElement).value).toBe('set_value'));
  });
});

describe('RpcCommandBindingsDrawer', () => {
  it('lists the bindings reaching the device in words, served by the host', async () => {
    const api = bindingsApi();
    renderWith({ commandBindings: api }, <RpcCommandBindingsDrawer open onClose={() => undefined} deviceId={D} deviceName="Pump 7" />);
    expect(await screen.findByText('IoT devices · Cold room sensor')).toBeTruthy();
    expect(screen.getByText('Set speed')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ deviceId: D, page: 1, sort: { key: 'updatedAt', dir: 'desc' } }));
    expect(screen.queryByRole('button', { name: 'New binding' })).toBeNull();
    // no id on screen
    expect(screen.queryByText(D)).toBeNull();
  });

  it('a manager opens a row: Check asks the host, Save sends the version, Delete asks first', async () => {
    const api = bindingsApi({ check: vi.fn(async () => [{ reason: 'binding_tier_above_control', message: 'The command is above the control\'s tier.' }]) });
    const user = userEvent.setup();
    renderWith({ commandBindings: api }, <RpcCommandBindingsDrawer open onClose={() => undefined} deviceId={D} deviceName="Pump 7" canManage />);
    expect(await screen.findByRole('button', { name: 'New binding' })).toBeTruthy();
    await user.click(await screen.findByText('IoT devices · Cold room sensor'));
    const editor = await screen.findByRole('dialog', { name: 'Edit binding' });
    await waitFor(() => expect(api.commands).toHaveBeenCalledWith(D, 'iot_device', 'set_value', expect.anything()));
    await user.click(within(editor).getByRole('button', { name: 'Check' }));
    expect(await within(editor).findByText('The command is above the control\'s tier.')).toBeTruthy();
    await user.click(within(editor).getByRole('checkbox', { name: 'Enabled' }));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('bnd1', expect.objectContaining({ enabled: false, method: 'set_speed' }), 3));
  });

  it('delete goes through the confirmation and sends the version', async () => {
    const api = bindingsApi();
    const user = userEvent.setup();
    renderWith({ commandBindings: api }, (
      <CommandBindingEditorDrawer open binding={BINDING} fixed={{ deviceId: D, deviceName: 'Pump 7' }} canManage onClose={() => undefined} />
    ));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this binding?' });
    expect(within(dialog).getByText('Set value on Cold room sensor will no longer reach Pump 7.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('bnd1', 3));
  });

  it('a reader sees the binding but no Check, Save or Delete', async () => {
    renderWith({ commandBindings: bindingsApi() }, (
      <CommandBindingEditorDrawer open binding={BINDING} fixed={{ deviceId: D, deviceName: 'Pump 7' }} onClose={() => undefined} />
    ));
    expect(await screen.findByRole('dialog', { name: 'Edit binding' })).toBeTruthy();
    for (const name of ['Check', 'Save', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull();
  });
});
