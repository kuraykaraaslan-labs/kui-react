import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotRpcCatalogApi } from '../api/adapter';
import { IOT_MESSAGES } from '../messages';
import type { RpcCatalogCommand, RpcRequest } from '../types/rpc';
import { RpcCommandCatalogEditor } from './RpcCommandCatalogEditor';
import { RpcRequestDetail } from './RpcRequestDetail';
import { renderRpcPayload, rpcEnvelopeTemplate, rpcSampleParams, rpcTemplateOf, rpcTemplatePlaceholders } from './rpc-payload';

const m = IOT_MESSAGES;
const DC620 = { method: 'setValue', params: { Out1Lock: '{{state}}' } };

describe('a command\'s payload template (NB 63-licensed-devices LD-8)', () => {
  it('renders as the host does: typed whole placeholders, text inside strings, missing optional params dropped, nothing added', () => {
    const ctx = { requestId: 7, expirationTime: 1000 };
    expect(renderRpcPayload(DC620, { state: 1 }, ctx)).toEqual({ method: 'setValue', params: { Out1Lock: 1 } });
    expect(renderRpcPayload({ t: 'ch {{ch}}', o: '{{o}}', l: ['{{x}}', 1], id: '{{requestId}}' }, { ch: 2, o: { a: 1 } }, ctx)).toEqual({ t: 'ch 2', o: { a: 1 }, l: [1], id: 7 });
    expect(rpcTemplatePlaceholders({ a: 'x {{y}}', '{{k}}': ['{{z}}', '{{y}}'] })).toEqual(['y', 'z']);
  });

  it('says what the host would refuse: not JSON, an unknown placeholder, a reserved parameter name, too large', () => {
    expect(rpcTemplateOf('{', ['state'], m)).toEqual({ problem: m.rpcCatalog.jsonInvalid });
    expect(rpcTemplateOf(JSON.stringify(DC620), [], m)).toEqual({ problem: 'Not parameters of this command: {{state}}.' });
    expect(rpcTemplateOf('{}', ['requestId'], m)).toMatchObject({ problem: expect.stringContaining('requestId') });
    expect(rpcTemplateOf(JSON.stringify({ a: 'x'.repeat(5000) }), [], m)).toMatchObject({ problem: expect.stringContaining('4096') });
    expect(rpcTemplateOf(JSON.stringify(DC620), ['state'], m)).toEqual({ template: DC620 });
  });

  it('starts from the envelope written out, and previews with sample values', () => {
    expect(JSON.parse(rpcEnvelopeTemplate('relay.set', ['state']))).toEqual({ method: 'relay.set', params: { state: '{{state}}' }, expirationTime: '{{expirationTime}}' });
    expect(rpcSampleParams({ n: { label: 'N', type: 'number', min: 5 }, b: { label: 'B', type: 'boolean' }, s: { label: 'S', type: 'select', options: [{ value: 'x', label: 'X' }] } }))
      .toEqual({ n: 5, b: true, s: 'x' });
  });
});

function setup(catalog: RpcCatalogCommand[] = []) {
  const api: IotRpcCatalogApi = {
    list: vi.fn(async () => ({ commands: catalog, supported: true })),
    create: vi.fn(async (_p, c) => ({ ...c, commandId: 'c9' })),
    update: vi.fn(async (_p, id, patch) => ({ ...catalog.find((c) => c.commandId === id)!, ...patch })),
    remove: vi.fn(async () => undefined),
    exportAll: vi.fn(async () => []),
    importAll: vi.fn(async () => []),
  };
  const adapter: IotAdapter = { rpcCatalog: api };
  render(<IotAdapterProvider adapter={adapter} capabilities={{ canManageRpcCommands: true }}><RpcCommandCatalogEditor profileId="p1" /></IotAdapterProvider>);
  return api;
}

describe('the catalog editor\'s payload section', () => {
  it('is off by default; on, it starts from the envelope, checks as typed, previews and saves the template', async () => {
    const user = userEvent.setup();
    const api = setup();
    await user.click(await screen.findByRole('button', { name: 'Add command' }));
    await user.type(screen.getByLabelText(/^Method/), 'relay.set');
    await user.type(screen.getByLabelText(/^Label/), 'Relay 1');
    await user.click(screen.getByRole('button', { name: 'Add a parameter' }));
    await user.type(screen.getAllByLabelText(/^Name/)[0], 'state');
    await user.type(screen.getAllByLabelText(/^Label/)[1], 'State');
    expect(screen.queryByLabelText(/^Payload \(JSON\)/)).toBeNull();
    await user.click(screen.getByLabelText(/^Send my own JSON payload/));
    const box = screen.getByLabelText(/^Payload \(JSON\)/) as HTMLTextAreaElement;
    expect(JSON.parse(box.value)).toEqual({ method: 'relay.set', params: { state: '{{state}}' }, expirationTime: '{{expirationTime}}' });
    expect(screen.getByText(/Placeholders: \{\{state\}\}, \{\{requestId\}\}, \{\{expirationTime\}\}/)).toBeInTheDocument();
    await user.clear(box);
    await user.click(box);
    await user.paste('{"method":"setValue","params":{"Out1Lock":"{{state}}","x":"{{nope}}"}}');
    expect(screen.getByText('Not parameters of this command: {{nope}}.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    expect(api.create).not.toHaveBeenCalled();
    await user.clear(box);
    await user.click(box);
    await user.paste(JSON.stringify(DC620));
    expect(screen.getByRole('region', { name: 'Preview with sample values' })).toHaveTextContent('"Out1Lock": "text"');
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('p1', expect.objectContaining({ method: 'relay.set', payloadTemplate: DC620 })));
  });

  it('an edit that turns it off sends the template as null, and the list marks a command with its own payload', async () => {
    const user = userEvent.setup();
    const api = setup([{ commandId: 'c1', method: 'relay.set', label: 'Relay', tier: 'basic', highImpact: false, oneway: false,
      paramsSchema: { state: { label: 'State', type: 'number' } }, payloadTemplate: DC620 }]);
    expect(await screen.findByText('Own payload')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit relay.set' }));
    expect(JSON.parse((screen.getByLabelText(/^Payload \(JSON\)/) as HTMLTextAreaElement).value)).toEqual(DC620);
    await user.click(screen.getByLabelText(/^Send my own JSON payload/));
    await user.click(screen.getByRole('button', { name: 'Save command' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect((api.update as ReturnType<typeof vi.fn>).mock.calls[0][2]).toEqual({ payloadTemplate: null });
  });
});

describe('the request detail', () => {
  it('shows the payload a templated command sent beside the request', () => {
    const r: RpcRequest = {
      rpcId: 'r1', deviceId: 'd1', method: 'relay.set', params: { state: 1 }, payload: { method: 'setValue', params: { Out1Lock: 1 } }, oneway: false,
      persistent: false, status: 'SUCCESSFUL', tier: 'basic', createdAt: new Date(0).toISOString(),
    } as RpcRequest;
    render(<RpcRequestDetail request={r} open onClose={() => undefined} />);
    expect(screen.getByText('Payload sent (the command\'s own JSON)')).toBeInTheDocument();
    expect(screen.getByText(/"Out1Lock": 1/)).toBeInTheDocument();
  });
});
