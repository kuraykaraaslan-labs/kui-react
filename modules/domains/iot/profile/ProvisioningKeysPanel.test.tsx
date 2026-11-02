import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotProvisioningApi } from '../api/adapter';
import { blankProfileDraft, type DeviceProfile, type ProvisionKey, type ProvisioningInfo } from '../types/profile';
import { ProvisioningKeysPanel } from './ProvisioningKeysPanel';
import { ProvisioningSettingsCard } from './ProvisioningSettingsCard';
import { DeviceProfileEditorView } from './DeviceProfileEditorView';

const T0 = new Date('2026-10-24T12:00:00Z');
const SECRET = 'ps_0123456789abcdef0123456789abcdef';
const KEYS: ProvisionKey[] = [
  { provisionKeyId: 'pk-aaaa0001', provisionKey: 'pk_aaaa000100000001', state: 'active', createdAt: T0 },
  { provisionKeyId: 'pk-bbbb0002', provisionKey: 'pk_bbbb000200000002', state: 'retired', createdAt: new Date('2026-05-01T00:00:00Z'), graceUntil: new Date('2026-11-20T00:00:00Z') },
  { provisionKeyId: 'pk-cccc0003', provisionKey: 'pk_cccc000300000003', state: 'revoked', createdAt: new Date('2025-01-01T00:00:00Z'), revokedAt: new Date('2025-06-01T00:00:00Z'), revocationReason: 'leaked in a ticket' },
];
const info = (over: Partial<ProvisioningInfo> = {}): ProvisioningInfo => ({
  keys: KEYS.map((k) => ({ ...k })), availableStrategies: ['DISABLED', 'ALLOW_CREATE_NEW_DEVICES'], rotationGrace: { min: 0, max: 365, default: 30 }, ...over,
});

function api(over: Partial<IotProvisioningApi> = {}, first: ProvisioningInfo = info()): IotProvisioningApi & { [K in keyof IotProvisioningApi]-?: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async () => first),
    setStrategy: vi.fn(async (_id: string, s: string) => s),
    rotate: vi.fn(async () => ({ key: { provisionKeyId: 'pk-dddd0004', provisionKey: 'pk_dddd000400000004', state: 'active', createdAt: new Date() }, provisionSecret: SECRET })),
    revoke: vi.fn(async (_id: string, i: { provisionKeyId: string }) => ({ ...KEYS[0], provisionKeyId: i.provisionKeyId, state: 'revoked' })),
    ...over,
  } as never;
}

function renderPanel(provisioning: IotProvisioningApi, onInfo?: (i: ProvisioningInfo) => void) {
  const adapter: IotAdapter = { provisioning };
  return render(<IotAdapterProvider adapter={adapter} capabilities={{ canManageProvisioning: true }} locale="en-GB"><ProvisioningKeysPanel profileId="p1" onInfo={onInfo} /></IotAdapterProvider>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ProvisioningKeysPanel', () => {
  it('lists the keys in one table with plain states, hands the host what it serves, and never draws a secret', async () => {
    const onInfo = vi.fn();
    const p = api();
    renderPanel(p, onInfo);
    const table = await screen.findByRole('table', { name: 'Provisioning keys' });
    expect(within(table).getByText('pk-aaaa0001')).toBeInTheDocument();
    expect(within(table).getByText('pk_aaaa000100000001')).toBeInTheDocument();
    expect(within(table).getByText('In use')).toBeInTheDocument();
    expect(within(table).getByText('Old, still accepted')).toBeInTheDocument();
    expect(within(table).getByText('Revoked')).toBeInTheDocument();
    expect(within(table).getByText('leaked in a ticket')).toBeInTheDocument();
    expect(within(table).getByText('Until revoked')).toBeInTheDocument();
    // a revoked key has no Revoke; the others do
    expect(screen.getByRole('button', { name: 'Revoke pk-aaaa0001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke pk-bbbb0002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke pk-cccc0003' })).toBeNull();
    expect(screen.queryByText(/ps_/)).toBeNull();
    expect(screen.queryByText('Last used')).toBeNull(); // the host records no use
    expect(onInfo).toHaveBeenCalledWith(expect.objectContaining({ availableStrategies: ['DISABLED', 'ALLOW_CREATE_NEW_DEVICES'] }));
  });

  it('Replace key asks for the days the old key keeps working, then shows the secret once (masked, copyable) and drops it for good', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const p = api();
    renderPanel(p);
    await user.click(await screen.findByRole('button', { name: 'Replace key' }));
    const dialog = await screen.findByRole('dialog');
    const days = within(dialog).getByLabelText('Days the old key keeps working');
    expect(days).toHaveValue(30);
    await user.clear(days);
    await user.type(days, '7');
    await user.click(within(dialog).getByRole('button', { name: 'Replace key' }));
    await waitFor(() => expect(p.rotate).toHaveBeenCalledWith('p1', { graceDays: 7 }));

    const notice = await screen.findByTestId('issued-provision-key');
    expect(within(notice).getByText(/You will not see it again/)).toBeInTheDocument();
    expect(within(notice).getByText('pk-dddd0004')).toBeInTheDocument();
    const secret = within(notice).getByTestId('issued-provision-secret');
    expect(secret.textContent).not.toContain(SECRET);
    await user.click(within(notice).getByRole('button', { name: 'Show' }));
    expect(secret.textContent).toBe(SECRET);
    await user.click(within(notice).getByRole('button', { name: 'Copy Secret' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(p.get).toHaveBeenCalledTimes(2); // the list is read again after the rotation
    await user.click(within(notice).getByRole('button', { name: 'I have copied it' }));
    expect(screen.queryByTestId('issued-provision-key')).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
    expect(setItem.mock.calls.some((c) => String(c[1]).includes(SECRET))).toBe(false);
    expect(window.location.href).not.toContain(SECRET);
  });

  it('a factory template has no grace: the old key stays for its own units, and the rotation sends no days', async () => {
    const user = userEvent.setup();
    const p = api({}, info({ rotationGrace: null, keys: [{ ...KEYS[0] }, { ...KEYS[1], graceUntil: null }] }));
    renderPanel(p);
    expect(await screen.findByText('For the units made with it')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Replace key' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Days the old key keeps working')).toBeNull();
    expect(within(dialog).getByText(/stays accepted for the units already made with it/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Replace key' }));
    await waitFor(() => expect(p.rotate).toHaveBeenCalledWith('p1', {}));
  });

  it('Revoke goes through the ConfirmDialog: locked until a reason and the key id typed again', async () => {
    const user = userEvent.setup();
    const p = api();
    renderPanel(p);
    await user.click(await screen.findByRole('button', { name: 'Revoke pk-bbbb0002' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke key pk-bbbb0002?' });
    const confirm = within(dialog).getByRole('button', { name: 'Revoke' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Why are you revoking it?'), 'shared by mistake');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type the key id pk-bbbb0002 to confirm'), 'pk-bbbb000');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Type the key id pk-bbbb0002 to confirm'), '2');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(p.revoke).toHaveBeenCalledWith('p1', { provisionKeyId: 'pk-bbbb0002', confirmKeyId: 'pk-bbbb0002', reason: 'shared by mistake' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a refused revoke keeps the dialog open with the host\'s reason', async () => {
    const user = userEvent.setup();
    const p = api({ revoke: vi.fn(async () => { throw new IotApiError('conflict', 'This key is already revoked.'); }) });
    renderPanel(p);
    await user.click(await screen.findByRole('button', { name: 'Revoke pk-aaaa0001' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Why are you revoking it?'), 'leak');
    await user.type(within(dialog).getByLabelText('Type the key id pk-aaaa0001 to confirm'), 'pk-aaaa0001');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    expect(await within(dialog).findByText(/This key is already revoked/)).toBeInTheDocument();
  });

  it('without a key it says devices cannot register and Create key makes the first one at once', async () => {
    const user = userEvent.setup();
    const p = api({}, info({ keys: [] }));
    renderPanel(p);
    expect(await screen.findByText(/No provisioning key yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Create key' }));
    await waitFor(() => expect(p.rotate).toHaveBeenCalledWith('p1', {}));
    expect(await screen.findByTestId('issued-provision-key')).toBeInTheDocument();
  });

  it('a read error offers Retry', async () => {
    const user = userEvent.setup();
    const p = api({ get: vi.fn().mockRejectedValueOnce(new IotApiError('unavailable', 'The server did not answer.')).mockResolvedValue(info()) });
    renderPanel(p);
    expect(await screen.findByText('The server did not answer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Provisioning keys' })).toBeInTheDocument();
  });
});

describe('the strategy with the keys', () => {
  it('the card notes that no device can register while the strategy is Disabled (only with the keys)', () => {
    const { rerender } = render(<ProvisioningSettingsCard strategy="DISABLED" keys={<p>keys</p>} />);
    expect(screen.getByText(/Provisioning is off for this profile/)).toBeInTheDocument();
    rerender(<ProvisioningSettingsCard strategy="ALLOW_CREATE_NEW_DEVICES" availableStrategies={['DISABLED', 'ALLOW_CREATE_NEW_DEVICES']} keys={<p>keys</p>} />);
    expect(screen.queryByText(/Provisioning is off for this profile/)).toBeNull();
    rerender(<ProvisioningSettingsCard strategy="DISABLED" />);
    expect(screen.queryByText(/Provisioning is off for this profile/)).toBeNull();
  });

  it('the editor saves a changed strategy through provisioning.setStrategy, apart from the profile patch', async () => {
    const user = userEvent.setup();
    const profile: DeviceProfile = { ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: null, isDefault: false, onlineRule: 'LIVE_SOCKET', createdAt: T0, updatedAt: T0 };
    const update = vi.fn(async (_id: string, patch: Partial<DeviceProfile>) => ({ ...profile, ...patch }));
    const p = api();
    const adapter: IotAdapter = { profiles: { options: async () => [], get: async () => structuredClone(profile), update }, provisioning: p };
    render(
      <IotAdapterProvider adapter={adapter} capabilities={{ canManageProfiles: true, canManageProvisioning: true }} locale="en-GB">
        <DeviceProfileEditorView profileId="p1" tab="provisioning" availableStrategies={['DISABLED', 'ALLOW_CREATE_NEW_DEVICES']} provisioningKeys={<ProvisioningKeysPanel profileId="p1" />} />
      </IotAdapterProvider>,
    );
    await user.selectOptions(await screen.findByLabelText('Provisioning strategy'), 'ALLOW_CREATE_NEW_DEVICES');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(p.setStrategy).toHaveBeenCalledWith('p1', 'ALLOW_CREATE_NEW_DEVICES'));
    expect(update).not.toHaveBeenCalled(); // nothing else changed
  });
});
