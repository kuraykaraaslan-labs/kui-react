import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities, type IotRpcCatalogApi } from '../api/adapter';
import type { RpcCatalogCommand, RpcCommandInput } from '../types/rpc';
import { changedCommandFields, importDiff, RpcCommandCatalogEditor } from './RpcCommandCatalogEditor';

/* NB 41-ui-fixes/23 1.9, 1.16, 1.17, 1.19: what a catalog change breaks, concurrent edits, capabilities, the host's checks. */

const CATALOG: RpcCatalogCommand[] = [
  { commandId: 'c1', method: 'sys.info', label: 'System information', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {}, version: 3 },
  { commandId: 'c2', method: 'scada.set_value', label: 'Set a value', tier: 'basic', highImpact: false, oneway: false, version: 1, paramsSchema: { key: { label: 'Key', type: 'text' } } },
];

function setup(caps: Partial<IotCapabilities> | null = { canManageRpcCommands: true }, over: Partial<IotRpcCatalogApi> = {}, adapterCaps?: IotAdapter['capabilities']) {
  const api: IotRpcCatalogApi = {
    list: vi.fn(async () => ({ commands: CATALOG, supported: true })),
    create: vi.fn(async (_p, c) => ({ ...c, commandId: 'c9' })),
    update: vi.fn(async (_p, id, patch) => ({ ...CATALOG.find((c) => c.commandId === id)!, ...patch })),
    remove: vi.fn(async () => undefined),
    exportAll: vi.fn(async () => []),
    importAll: vi.fn(async (_p: string, commands: RpcCommandInput[]) => commands.map((c, i) => ({ ...c, commandId: `i${i}` }))),
    ...over,
  };
  const adapter: IotAdapter = { rpcCatalog: api, ...(adapterCaps ? { capabilities: adapterCaps } : {}) };
  render(<IotAdapterProvider adapter={adapter} capabilities={caps ?? undefined}><RpcCommandCatalogEditor profileId="p1" /></IotAdapterProvider>);
  return api;
}

describe('the catalog editor', () => {
  it('sends only what changed, with the version it read', () => {
    const was = { ...CATALOG[0]!, maskedParams: [] } as RpcCommandInput;
    expect(changedCommandFields(was, { ...was, label: 'Info', tier: 'privileged' })).toEqual({ label: 'Info', tier: 'privileged' });
    expect(changedCommandFields(was, { ...was })).toEqual({});
    expect(importDiff(CATALOG, [{ ...CATALOG[0]!, label: 'Other' }, { method: 'net.status', label: 'Net', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {} }]))
      .toEqual({ removed: ['scada.set_value'], changed: ['sys.info'], added: ['net.status'] });
  });

  it('says what removing a command breaks', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('Set a value');
    await user.click(screen.getByRole('button', { name: 'Remove scada.set_value' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/only as a raw method/);
    expect(dialog).toHaveTextContent(/board controls that send it are refused/);
    expect(dialog).toHaveTextContent(/no longer have their parameters checked/);
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('p1', 'c2'));
  });

  it('asks before a tier change that boards cannot send, and sends the change with its version', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('Set a value');
    await user.click(screen.getByRole('button', { name: 'Edit scada.set_value' }));
    await user.selectOptions(screen.getByLabelText('Tier'), 'privileged');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    const ask = await screen.findByRole('dialog', { name: 'Move scada.set_value from Basic to Privileged?' });
    expect(ask).toHaveTextContent(/those that send scada.set_value will be refused/);
    await user.click(within(ask).getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('p1', 'c2', { tier: 'privileged' }, { expectedVersion: 1 }));
  });

  it('refuses a command changed meanwhile and reloads it', async () => {
    const user = userEvent.setup();
    const fresh = { ...CATALOG[0]!, label: 'Changed by someone', version: 4 };
    const list = vi.fn().mockResolvedValueOnce({ commands: CATALOG, supported: true }).mockResolvedValue({ commands: [fresh, CATALOG[1]!], supported: true });
    const api = setup(undefined, { list, update: vi.fn().mockRejectedValue(new IotApiError('stale', 'changed')) });
    await screen.findByText('System information');
    await user.click(screen.getByRole('button', { name: 'Edit sys.info' }));
    await user.type(screen.getByLabelText(/^Label/), '!');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    expect(await screen.findByText(/Someone changed this command while you were editing it/)).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith('p1', 'c1', { label: 'System information!' }, { expectedVersion: 3 });
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText(/^Label/)).toHaveValue('Changed by someone'));
  });

  it('checks the timeout and the masked names as the host does', async () => {
    const user = userEvent.setup();
    const api = setup();
    await screen.findByText('Set a value');
    await user.click(screen.getByRole('button', { name: 'Edit scada.set_value' }));
    await user.type(screen.getByLabelText(/^Default timeout/), '1500.5');
    await user.type(screen.getByLabelText(/^Masked parameters/), 'key, psk');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    expect(await screen.findByText('A whole number of milliseconds from 1000 to 600000.')).toBeInTheDocument();
    expect(screen.getByText('Not a parameter of this command: psk.')).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('an import lists what it removes, changes and adds before the typed confirmation', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Set a value');
    await user.click(screen.getByRole('button', { name: 'Import' }));
    const box = screen.getByRole('textbox', { name: 'Import a command catalog' });
    await user.click(box);
    await user.paste(JSON.stringify({ commands: [{ ...CATALOG[0], label: 'Info' }] }));
    await user.click(screen.getByRole('button', { name: 'Replace the catalog' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace the catalog' });
    expect(dialog).toHaveTextContent('Removed (1): scada.set_value');
    expect(dialog).toHaveTextContent('Changed (1): sys.info');
    expect(dialog).toHaveTextContent(/Removed commands can be sent only as raw methods/);
  });

  it('is not "read-only" while its capabilities are unknown, and offers to ask them again', async () => {
    const user = userEvent.setup();
    const ask = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ canManageRpcCommands: true });
    setup(null, {}, ask);
    expect(await screen.findByText(/could not be read, so nothing can be changed yet/)).toBeInTheDocument();
    expect(screen.queryByText('You can view the commands but not change them.')).toBeNull();
    await user.click(within(screen.getByText(/could not be read, so nothing can be changed yet/).closest('div')!).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Add command' })).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(2);
  });
});
