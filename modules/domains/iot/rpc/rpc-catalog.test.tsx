import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities, type IotRpcCatalogApi } from '../api/adapter';
import type { RpcCatalogCommand, RpcCommandInput } from '../types/rpc';
import { RpcCommandCatalogEditor } from './RpcCommandCatalogEditor';
import { paramRowIssues, paramRowsOf, paramsSchemaOf } from './RpcParamsBuilder';

const CATALOG: RpcCatalogCommand[] = [
  { commandId: 'c1', method: 'sys.info', label: 'System information', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {} },
  { commandId: 'c2', method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, confirmText: 'REBOOT', oneway: true, paramsSchema: {} },
];

function setup(caps: Partial<IotCapabilities> = { canManageRpcCommands: true }, supported = true, over: Partial<IotRpcCatalogApi> = {}) {
  const api: IotRpcCatalogApi = {
    list: vi.fn(async () => ({ commands: CATALOG, supported })),
    create: vi.fn(async (_p, c) => ({ ...c, commandId: 'c9' })),
    update: vi.fn(async (_p, id, patch) => ({ ...CATALOG.find((c) => c.commandId === id)!, ...patch })),
    remove: vi.fn(async () => undefined),
    exportAll: vi.fn(async () => CATALOG.map(({ commandId: _id, ...rest }) => rest)),
    importAll: vi.fn(async (_p: string, commands: RpcCommandInput[]) => commands.map((c, i) => ({ ...c, commandId: `i${i}` }))),
    ...over,
  };
  const adapter: IotAdapter = { rpcCatalog: api };
  render(<IotAdapterProvider adapter={adapter} capabilities={caps}><RpcCommandCatalogEditor profileId="p1" /></IotAdapterProvider>);
  return api;
}

describe('the parameter rows (UX-19)', () => {
  it('reads a schema into rows and writes it back, keeping what a row does not draw; a schema the rows cannot draw stays JSON', () => {
    const schema: RpcCommandInput['paramsSchema'] = {
      speed: { label: 'Speed', type: 'number', min: 0, max: 120, required: true, description: 'rpm', step: 5 },
      key: { label: 'Control', type: 'select', options: [{ value: 'pump', label: 'Pump' }, 'fan'] },
      value: { label: 'Value', type: 'json' },
    };
    const rows = paramRowsOf(schema)!;
    expect(rows.map((r) => [r.name, r.type, r.options])).toEqual([['speed', 'number', ''], ['key', 'select', 'pump=Pump, fan'], ['value', 'json', '']]);
    expect(paramsSchemaOf(rows)).toEqual(schema);
    expect(paramRowsOf({ notes: { label: 'Notes', type: 'textarea' } })).toBeNull();
    expect(paramRowsOf({ k: { label: 'K', type: 'select', options: ['a,b'] } })).toBeNull();
    expect(paramRowIssues([...rows, { ...rows[0], name: 'speed' }, { ...rows[1], name: '1x', label: ' ', options: '' }, { ...rows[0], name: 'm', min: '5', max: '1' }])).toEqual({
      3: { name: 'name_duplicate' },
      4: { name: 'name_invalid', label: 'label_required', options: 'options_required' },
      5: { range: 'range_invalid' },
    });
  });
});

describe('RpcCommandCatalogEditor', () => {
  it('UX-19: builds the parameters as fields, starts from a host template, and shows a refused parameter on the parameters in words', async () => {
    const user = userEvent.setup();
    const create = vi.fn(async () => { throw new IotApiError('validation', 'Validation error', { fieldErrors: { paramsSchema: 'mode.type: Invalid option' } }); });
    const api = setup(undefined, true, {
      create,
      templates: [{ id: 'set_value', label: 'Set a value (board controls)', command: { method: 'scada.set_value', label: 'Set a value', tier: 'basic', highImpact: false, oneway: false, paramsSchema: { key: { label: 'Key', type: 'text', required: true }, value: { label: 'Value', type: 'json', required: true } } } }],
    });
    await screen.findByText('System information');
    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.selectOptions(screen.getByLabelText(/^From a template/), 'set_value');
    expect(screen.getByLabelText(/^Method/)).toHaveValue('scada.set_value');
    expect(screen.getAllByLabelText(/^Name/).map((e) => (e as HTMLInputElement).value)).toEqual(['key', 'value']);
    await user.click(screen.getByRole('button', { name: 'Add a parameter' }));
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    // a new empty row: refused before anything is sent, on its own fields
    expect(screen.getByText('Check the parameters marked below.')).toBeInTheDocument();
    expect(screen.getAllByText('Letters, digits and _, starting with a letter or _.').length).toBeGreaterThan(0);
    expect(create).not.toHaveBeenCalled();
    await user.type(screen.getAllByLabelText(/^Name/)[2], 'mode');
    await user.type(screen.getAllByLabelText(/^Label/)[3], 'Mode');
    await user.selectOptions(screen.getAllByLabelText('Type')[2], 'select');
    await user.type(screen.getByLabelText(/^Choices/), 'auto=Automatic, manual');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]).toEqual(['p1', expect.objectContaining({
      method: 'scada.set_value',
      paramsSchema: {
        key: { label: 'Key', type: 'text', required: true },
        value: { label: 'Value', type: 'json', required: true },
        mode: { label: 'Mode', type: 'select', options: [{ value: 'auto', label: 'Automatic' }, 'manual'] },
      },
    })]);
    expect(await screen.findByText('Some fields were refused: see the messages under them.')).toBeInTheDocument();
    expect(screen.getByText('The parameters were refused: mode.type: Invalid option')).toBeInTheDocument();
    expect(screen.queryByText('Validation error')).toBeNull();
    // Advanced (JSON) shows the same schema, and back
    await user.click(screen.getByRole('button', { name: 'Advanced (JSON)' }));
    expect((screen.getByLabelText('Advanced (JSON)') as HTMLTextAreaElement).value).toContain('"manual"');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('adds a command and never accepts a factory reset (OD-8)', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('System information');
    expect(screen.getByText('Typed confirmation phrase: REBOOT')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add command' }));
    await user.type(screen.getByLabelText(/^Method/), 'sys.factory_reset');
    await user.type(screen.getByLabelText(/^Label/), 'Reset');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    expect(screen.getByText('A factory reset is never a command (no remote factory reset).')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/^Method/));
    await user.type(screen.getByLabelText(/^Method/), 'net.status');
    await user.selectOptions(screen.getByLabelText('Tier'), 'privileged');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('p1', expect.objectContaining({ method: 'net.status', label: 'Reset', tier: 'privileged', confirmText: null, maskedParams: [] })));
  });

  it('edits without ever sending the method, and removes', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('Reboot');
    await user.click(screen.getByRole('button', { name: 'Edit sys.reboot' }));
    expect(screen.getByLabelText(/^Method/)).toHaveAttribute('readonly');
    await user.clear(screen.getByLabelText(/^Label/));
    await user.type(screen.getByLabelText(/^Label/), 'Restart the router');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const [, id, patch] = (api.update as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('c2');
    expect(patch).not.toHaveProperty('method');
    expect(patch).toMatchObject({ label: 'Restart the router', confirmText: 'REBOOT', highImpact: true });
    await user.click(screen.getByRole('button', { name: 'Remove sys.info' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('p1', 'c1'));
  });

  it('imports only after the typed REPLACE, and refuses a catalog with a factory reset', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('Reboot');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const box = screen.getByRole('textbox', { name: 'Import a command catalog' });
    await user.click(box);
    await user.paste(JSON.stringify({ commands: [{ method: 'sys.factory_reset', label: 'x', tier: 'critical', highImpact: true, oneway: true, paramsSchema: {} }] }));
    await user.click(screen.getByRole('button', { name: 'Replace the catalog' }));
    expect(screen.getByText('A factory reset is never a command (no remote factory reset).')).toBeInTheDocument();
    await user.clear(box);
    await user.click(box);
    await user.paste(JSON.stringify({ commands: [{ method: 'sys.info', label: 'Info', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {} }] }));
    await user.click(screen.getByRole('button', { name: 'Replace the catalog' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace the catalog' });
    const confirm = within(dialog).getByRole('button', { name: 'Replace the catalog' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'REPLACE');
    await user.click(confirm);
    await waitFor(() => expect(api.importAll).toHaveBeenCalledWith('p1', [expect.objectContaining({ method: 'sys.info' })]));
  });

  it('is read-only without canManageRpcCommands but still exports; says when the profile takes no commands', async () => {
    const user = userEvent.setup();
    const api = setup({}, false);
    await screen.findByText('Reboot');
    expect(screen.queryByRole('button', { name: 'Add command' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.getByText(/speaks only the ThingsBoard topics/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(api.exportAll).toHaveBeenCalledWith('p1');
    expect((await screen.findByRole('textbox', { name: 'Command catalog (JSON)' }) as HTMLTextAreaElement).value).toContain('"sys.reboot"');
  });
});
