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

describe('AddRelationDrawer', () => {
  it('offers the device list without this device, and saves this device FEEDS the picked one', async () => {
    const s = setup();
    const onSaved = vi.fn();
    render(
      <IotAdapterProvider adapter={s.adapter} capabilities={{ canPlaceDevices: true }} notify={s.notify}>
        <AddRelationDrawer open entity={{ type: 'DEVICE', id: 'd1', name: 'Tank 1' }} onClose={() => undefined} onSaved={onSaved} />
      </IotAdapterProvider>,
    );
    const group = await screen.findByRole('radiogroup');
    expect(within(group).queryByText('Tank 1')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Relation'), 'FEEDS');
    await userEvent.click(within(group).getByLabelText('Pump 2'));
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
    const group = await screen.findByRole('radiogroup');
    await userEvent.click(within(group).getByLabelText('Pump 3'));
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
    const group = await screen.findByRole('radiogroup');
    await userEvent.click(within(group).getByLabelText('Pump 2'));
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
