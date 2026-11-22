import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotAssetsApi, type IotDevicesApi } from '../api/adapter';
import type { AssetRelation } from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { AddRelationDrawer } from './AddRelationDrawer';
import { RelationsSection } from './RelationsSection';

/** NB iot-dashboard 09 §9.5 (W8bV-1): adding a typed relation from a device's relations, Save only, the host's refusal in words. */
const dev = (deviceId: string, name: string): DeviceRecord => ({ deviceId, name, deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false } as DeviceRecord);

function setup(o: { create?: IotAssetsApi['createRelation']; canPlace?: boolean } = {}) {
  const relations: AssetRelation[] = [];
  const createRelation = vi.fn(o.create ?? (async (input) => ({ ...input, relationId: 'r1', fromName: 'Tank 1', toName: 'Pump 2' })));
  const list = vi.fn(async (q: { search?: string }) => {
    const all = [dev('d1', 'Tank 1'), dev('d2', 'Pump 2'), dev('d3', 'Pump 3')];
    const items = q.search ? all.filter((d) => d.name.toLowerCase().includes(q.search!.toLowerCase())) : all;
    return { items, total: items.length };
  });
  const assets = {
    tree: async () => ({ nodes: [], truncated: false }),
    relations: async () => relations,
    createRelation,
    removeRelation: async () => undefined,
  } as unknown as IotAssetsApi;
  const adapter = { assets, devices: { list } as unknown as IotDevicesApi } as IotAdapter;
  const notify = vi.fn();
  return { adapter, createRelation, list, notify, canPlace: o.canPlace ?? true };
}

/** Types into the device ComboBox and picks the option named `name` (the search waits for its pause). */
async function pickDevice(text: string, name: string) {
  const input = screen.getByRole('searchbox', { name: 'Device' });
  await userEvent.click(input);
  await userEvent.type(input, text);
  const option = await screen.findByRole('option', { name: new RegExp(name) }, { timeout: 2000 });
  await userEvent.click(within(option).getByRole('button'));
}

describe('AddRelationDrawer', () => {
  it('offers the device list without this device, and saves this device FEEDS the picked one', async () => {
    const s = setup();
    const onSaved = vi.fn();
    render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: true }} notify={s.notify}>
        <AddRelationDrawer open entity={{ type: 'DEVICE', id: 'd1', name: 'Tank 1' }} onClose={() => undefined} onSaved={onSaved} />
      </IotAdapterProvider>,
    );
    await userEvent.selectOptions(screen.getByLabelText('Relation'), 'FEEDS');
    const input = screen.getByRole('searchbox', { name: 'Device' });
    await userEvent.click(input);
    await userEvent.type(input, 'Tank');
    await waitFor(() => expect(s.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'Tank' }), expect.anything()));
    // the ComboBox's own options (the Direction select also names this device)
    expect(screen.queryAllByRole('option').filter((o) => o.closest('[role="listbox"]') && /Tank 1/.test(o.textContent ?? ''))).toEqual([]);
    await userEvent.clear(input);
    await pickDevice('Pump', 'Pump 2');
    await userEvent.click(screen.getByRole('button', { name: 'Add relation' }));
    await waitFor(() => expect(s.createRelation).toHaveBeenCalledWith({ fromType: 'DEVICE', fromId: 'd1', toType: 'DEVICE', toId: 'd2', type: 'FEEDS' }));
    expect(onSaved).toHaveBeenCalled();
    expect(s.notify).toHaveBeenCalledWith({ tone: 'success', message: 'Relation added' });
  });

  it('turns the direction around, takes a custom type upper case and refuses Contains and a bad type before asking the host', async () => {
    const s = setup();
    render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: true }} notify={s.notify}>
        <AddRelationDrawer open entity={{ type: 'DEVICE', id: 'd1', name: 'Tank 1' }} onClose={() => undefined} />
      </IotAdapterProvider>,
    );
    await pickDevice('Pump', 'Pump 3');
    await userEvent.selectOptions(screen.getByLabelText('Relation'), '__custom__');
    const custom = screen.getByLabelText(/Relation type/);
    await userEvent.type(custom, '1bad');
    await userEvent.click(screen.getByRole('button', { name: 'Add relation' }));
    expect(s.createRelation).not.toHaveBeenCalled();
    await userEvent.clear(custom);
    await userEvent.type(custom, 'contains');
    await userEvent.click(screen.getByRole('button', { name: 'Add relation' }));
    expect(s.createRelation).not.toHaveBeenCalled();
    expect(screen.getByText(/Contains is a placement/)).toBeTruthy();
    await userEvent.clear(custom);
    await userEvent.type(custom, 'backup_of');
    await userEvent.selectOptions(screen.getByLabelText('Direction'), 'in');
    await userEvent.click(screen.getByRole('button', { name: 'Add relation' }));
    await waitFor(() => expect(s.createRelation).toHaveBeenCalledWith({ fromType: 'DEVICE', fromId: 'd3', toType: 'DEVICE', toId: 'd1', type: 'BACKUP_OF' }));
  });

  it('says the host refusal in words and keeps the drawer open (an edge that exists, another refusal)', async () => {
    const s = setup({ create: async () => { throw new IotApiError('conflict', 'dup'); } });
    const onClose = vi.fn();
    render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: true }} notify={s.notify}>
        <AddRelationDrawer open entity={{ type: 'DEVICE', id: 'd1' }} onClose={onClose} />
      </IotAdapterProvider>,
    );
    await pickDevice('Pump', 'Pump 2');
    await userEvent.click(screen.getByRole('button', { name: 'Add relation' }));
    expect(await screen.findByText('This relation already exists.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RelationsSection: Add relation', () => {
  it('shows the button only to a person who may change the topology, when the host can create relations', async () => {
    const s = setup();
    const { unmount } = render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: false }} notify={s.notify}>
        <RelationsSection entity={{ type: 'DEVICE', id: 'd1' }} />
      </IotAdapterProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add relation' })).toBeNull());
    unmount();
    render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: true }} notify={s.notify}>
        <RelationsSection entity={{ type: 'DEVICE', id: 'd1' }} entityName="Tank 1" />
      </IotAdapterProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Add relation' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
