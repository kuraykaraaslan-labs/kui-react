import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotCapabilities, IotRpcCatalogApi } from '../api/adapter';
import type { RpcCatalogCommand, RpcCommandInput } from '../types/rpc';
import { RpcCommandCatalogEditor } from './RpcCommandCatalogEditor';

const CATALOG: RpcCatalogCommand[] = [
  { commandId: 'c1', method: 'sys.info', label: 'System information', tier: 'basic', highImpact: false, oneway: false, paramsSchema: {} },
  { commandId: 'c2', method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, confirmText: 'REBOOT', oneway: true, paramsSchema: {} },
];

function setup(caps: Partial<IotCapabilities> = { canManageRpcCommands: true }, supported = true) {
  const api: IotRpcCatalogApi = {
    list: vi.fn(async () => ({ commands: CATALOG, supported })),
    create: vi.fn(async (_p, c) => ({ ...c, commandId: 'c9' })),
    update: vi.fn(async (_p, id, patch) => ({ ...CATALOG.find((c) => c.commandId === id)!, ...patch })),
    remove: vi.fn(async () => undefined),
    exportAll: vi.fn(async () => CATALOG.map(({ commandId: _id, ...rest }) => rest)),
    importAll: vi.fn(async (_p: string, commands: RpcCommandInput[]) => commands.map((c, i) => ({ ...c, commandId: `i${i}` }))),
  };
  const adapter: IotAdapter = { rpcCatalog: api };
  render(<IotAdapterProvider adapter={adapter} capabilities={caps}><RpcCommandCatalogEditor profileId="p1" /></IotAdapterProvider>);
  return api;
}

describe('RpcCommandCatalogEditor', () => {
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
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
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
