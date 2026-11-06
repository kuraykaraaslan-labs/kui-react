import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import type { AttributeEntry, DeviceCredential, DeviceRecord } from '../types/device';
import { DeviceDetailView } from './DeviceDetailView';
import { DeviceAttributeTable, attributeKeyProblem } from './DeviceAttributeTable';
import { DeviceCredentialPanel } from './DeviceCredentialPanel';
import { passwordProblem } from './SetCredentialDrawer';
import { EditDeviceDrawer } from './EditDeviceDrawer';
import { useDeviceLog } from './useDeviceLog';
import { IOT_MESSAGES } from '../messages';

/*
 * The device page round of NB 41-ui-fixes/22: credentials set and revoked, a secret kept until stored, delete naming what goes, a
 * page that stays current, attribute keys checked here, and a log that says what it could not read.
 */

const DEVICE: DeviceRecord = {
  deviceId: 'd1', name: 'Pump 4', deviceProfileId: 'p1', status: 'ACTIVE', isGateway: false, online: true, serial: 'RT-000123',
  allowedAuthModes: ['ACCESS_TOKEN', 'MQTT_BASIC'],
};

const ALL: Partial<IotCapabilities> = {
  canEditDevice: true, canViewCredentials: true, canReadAttributes: true, canWriteAttributes: true, canDeleteDevice: true,
};

function adapterWith(over: { device?: Partial<DeviceRecord>; credential?: DeviceCredential | null } & Partial<IotAdapter> = {}): IotAdapter {
  const { device, credential, ...rest } = over;
  return {
    devices: {
      list: vi.fn(),
      get: vi.fn().mockImplementation(async () => ({ ...DEVICE, ...device })),
      remove: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({ ...DEVICE, ...patch })),
      connections: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      log: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      deleteImpact: vi.fn().mockResolvedValue({ readingBindings: 3 }),
      parseState: (p: unknown) => p as never,
    },
    credentials: {
      get: vi.fn().mockResolvedValue(credential === undefined ? { type: 'ACCESS_TOKEN' } : credential),
      rotate: vi.fn().mockResolvedValue({ credential: { type: 'ACCESS_TOKEN' }, secret: { token: 'NEW-ONE' } }),
      set: vi.fn().mockResolvedValue({ credential: { type: 'MQTT_BASIC', username: 'pump-4' }, secret: { password: 'GENERATED-PW' } }),
      revoke: vi.fn().mockResolvedValue(undefined),
    },
    attributes: { list: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) },
    ...rest,
  };
}

function fakeLive() {
  const subs = new Set<IotLiveSubscription>();
  const live: IotLive & { publish(kind: string, payload: unknown): void } = {
    state: 'live',
    subscribe(sub) { subs.add(sub as IotLiveSubscription); return () => { subs.delete(sub as IotLiveSubscription); }; },
    onState: () => () => undefined,
    publish(kind, payload) { for (const s of [...subs]) if (s.kind === kind) s.onLive(payload); },
  };
  return live;
}

function wrap(ui: React.ReactNode, o: { adapter?: IotAdapter; caps?: Partial<IotCapabilities>; live?: IotLive | null; notify?: (n: unknown) => void } = {}) {
  return render(
    <IotAdapterProvider adapter={o.adapter ?? adapterWith()} live={o.live ?? null} capabilities={o.caps ?? ALL} notify={o.notify} locale="en" timeZone="UTC">
      {ui}
    </IotAdapterProvider>,
  );
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('credentials (1.1, 2.3, 4.1, N3)', () => {
  it('sets an MQTT-basic credential with the rules checked here, names the device when it replaces one, and keeps the generated password until stored', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Set credential' }));
    const drawer = await screen.findByRole('dialog', { name: 'Credential of Pump 4' });
    // only the types the profile allows
    expect([...within(drawer).getByLabelText('Type').querySelectorAll('option')].map((o) => o.value)).toEqual(['ACCESS_TOKEN', 'MQTT_BASIC']);
    await user.selectOptions(within(drawer).getByLabelText('Type'), 'MQTT_BASIC');
    await user.type(within(drawer).getByLabelText(/^Username/), 'provision');
    await user.type(within(drawer).getByLabelText('Password (optional)'), 'short');
    await user.click(within(drawer).getByRole('button', { name: 'Set credential' }));
    expect(within(drawer).getByText('"provision" is reserved for device provisioning.')).toBeInTheDocument();
    expect(within(drawer).getByText('At least 16 characters.')).toBeInTheDocument();
    expect(adapter.credentials!.set).not.toHaveBeenCalled();
    await user.clear(within(drawer).getByLabelText(/^Username/));
    await user.type(within(drawer).getByLabelText(/^Username/), 'pump-4');
    await user.clear(within(drawer).getByLabelText('Password (optional)'));
    await user.click(within(drawer).getByRole('button', { name: 'Set credential' }));
    // the device has a credential: replacing it asks first, naming the device
    const confirm = await screen.findByRole('dialog', { name: 'Replace the credential of Pump 4?' });
    expect(confirm).toHaveTextContent(/stops working at once/);
    await user.click(within(confirm).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(adapter.credentials!.set).toHaveBeenCalledWith('d1', { type: 'MQTT_BASIC', username: 'pump-4', clientId: null, password: null }));
    // the generated password is shown once, and nothing else is offered until it is stored
    expect(await screen.findByTestId('issued-secret')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Rotate secret' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set credential' })).toBeNull();
    expect(screen.getByText(/Store the new secret first/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I have stored it' }));
    expect(screen.queryByTestId('issued-secret')).toBeNull();
    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument();
  });

  it('marks the field the host refuses, and keeps the drawer open', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith({ credential: null });
    (adapter.credentials!.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new IotApiError('conflict', 'This MQTT username is already in use.', { fieldErrors: { username: 'Taken.' } }));
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Set credential' }));
    const drawer = await screen.findByRole('dialog', { name: 'Credential of Pump 4' });
    await user.selectOptions(within(drawer).getByLabelText('Type'), 'MQTT_BASIC');
    await user.type(within(drawer).getByLabelText(/^Username/), 'pump-4');
    await user.click(within(drawer).getByRole('button', { name: 'Set credential' }));
    // no credential to replace: no confirm
    expect(await within(drawer).findByText('This MQTT username is already in use.')).toBeInTheDocument();
    expect(within(drawer).getByText('Taken.')).toBeInTheDocument();
  });

  it('offers X.509 only with a certificate the host lists for the device, or says it cannot be used here', async () => {
    const user = userEvent.setup();
    const certificates = vi.fn().mockResolvedValue([{ id: 'c1', subject: 'RT-000123', expiresAt: '2027-01-01T00:00:00Z' }]);
    const base = adapterWith({ device: { allowedAuthModes: ['X509_CERTIFICATE'] }, credential: null });
    const adapter = { ...base, credentials: { ...base.credentials!, certificates } };
    const { unmount } = wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter, caps: { ...ALL, canAttachCertificates: true } });
    await user.click(await screen.findByRole('button', { name: 'Set credential' }));
    const drawer = await screen.findByRole('dialog', { name: 'Credential of Pump 4' });
    await waitFor(() => expect(certificates).toHaveBeenCalledWith({ deviceId: 'd1', serial: 'RT-000123' }, expect.anything()));
    await user.selectOptions(await within(drawer).findByLabelText(/^Certificate/), 'c1');
    await user.click(within(drawer).getByRole('button', { name: 'Set credential' }));
    await waitFor(() => expect(adapter.credentials.set).toHaveBeenCalledWith('d1', { type: 'X509_CERTIFICATE', certificateId: 'c1' }));
    unmount();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter: { ...adapter, credentials: { ...adapter.credentials, certificates: vi.fn() } } });
    await user.click(await screen.findByRole('button', { name: 'Set credential' }));
    expect(await screen.findByText(/needs the certificate authority/)).toBeInTheDocument();
  });

  it('revokes behind a danger confirm naming the device', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    const confirm = await screen.findByRole('dialog', { name: 'Revoke the credential of Pump 4?' });
    expect(confirm).toHaveTextContent(/live session ends/);
    await user.click(within(confirm).getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(adapter.credentials!.revoke).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText(/has no active credential/)).toBeInTheDocument();
  });

  it('a failed read is an error with a retry, not "no active credential"', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    (adapter.credentials!.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(''));
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />, { adapter });
    expect(await screen.findByText('The credential could not be read.')).toBeInTheDocument();
    expect(screen.queryByText(/has no active credential/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Set credential' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Rotate secret' })).toBeInTheDocument();
  });

  it('the rotate confirm names the device; a second secret shows masked and not "Copied"', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <IotAdapterProvider adapter={{}} capabilities={ALL} locale="en">
        <DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} secret={{ token: 'FIRST' }} onSecretDismiss={onDismiss} deviceName="Pump 4" />
      </IotAdapterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByTestId('issued-secret')).toHaveTextContent('FIRST');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    rerender(
      <IotAdapterProvider adapter={{}} capabilities={ALL} locale="en">
        <DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} secret={{ token: 'SECOND' }} onSecretDismiss={onDismiss} deviceName="Pump 4" />
      </IotAdapterProvider>,
    );
    expect(screen.getByTestId('issued-secret')).not.toHaveTextContent('SECOND');
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    rerender(
      <IotAdapterProvider adapter={{}} capabilities={ALL} locale="en">
        <DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN' }} deviceName="Pump 4" onRotate={vi.fn()} />
      </IotAdapterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Rotate secret' }));
    expect(await screen.findByRole('dialog', { name: 'Rotate the secret of Pump 4?' })).toBeInTheDocument();
  });

  it('asks before a link leaves the page while a secret is not stored; "Stay" stays, "Leave" goes on with the same click', async () => {
    const user = userEvent.setup();
    const followed = vi.fn((e: React.MouseEvent) => e.preventDefault());
    const adapter = adapterWith();
    wrap(<><a href="https://kui.example/elsewhere" onClick={followed}>Elsewhere</a><DeviceDetailView deviceId="d1" tab="credentials" /></>, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Rotate secret' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' }));
    await screen.findByTestId('issued-secret');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    const ask = await screen.findByRole('dialog', { name: IOT_MESSAGES.credential.leaveUnstored });
    expect(followed).not.toHaveBeenCalled();
    await user.click(within(ask).getByRole('button', { name: 'Stay' }));
    expect(followed).not.toHaveBeenCalled();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    await user.click(within(await screen.findByRole('dialog', { name: IOT_MESSAGES.credential.leaveUnstored })).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(followed).toHaveBeenCalledOnce());
    // once stored, nothing is asked
    await user.click(screen.getByRole('button', { name: 'I have stored it' }));
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(followed).toHaveBeenCalledTimes(2);
  });

  it('checks a chosen password the way the host does, apart from patterns and common words', () => {
    const m = IOT_MESSAGES.credential;
    expect(passwordProblem('short', {}, m)).toBe(m.passwordTooShort);
    expect(passwordProblem('aaaaaaaabbbbbbbb', {}, m)).toBe(m.passwordTooFewDistinct);
    expect(passwordProblem('Xy7#pump-4-Qz9!kL', { username: 'pump-4' }, m)).toBe(m.passwordContainsId);
    expect(passwordProblem('Xy7#Wq2!Lm9$Rt4%', { username: 'pump-4' }, m)).toBeNull();
  });
});

describe('delete (2.2)', () => {
  it('names the device, the reading bindings that go and what of its history stays; runs once', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    let finish: () => void = () => undefined;
    (adapter.devices!.remove as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise<void>((r) => { finish = r; }));
    const onDeleted = vi.fn();
    wrap(<DeviceDetailView deviceId="d1" onDeleted={onDeleted} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Delete device' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Pump 4?' });
    expect(confirm).toHaveTextContent('Its 3 reading bindings are removed');
    expect(confirm).toHaveTextContent("Its readings are removed; its attribute history stays until the workspace's data is purged.");
    await user.click(within(confirm).getByRole('button', { name: 'Delete device' }));
    const button = screen.getByRole('button', { name: /Delete device/ });
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    act(() => finish());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(adapter.devices!.remove).toHaveBeenCalledOnce();
    expect(adapter.devices!.deleteImpact).toHaveBeenCalledOnce();
  });

  it('a count that could not be read says "if it has any"; a failed delete says the delete failed', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const adapter = adapterWith();
    (adapter.devices!.deleteImpact as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('403'));
    (adapter.devices!.remove as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(''));
    wrap(<DeviceDetailView deviceId="d1" />, { adapter, notify });
    await user.click(await screen.findByRole('button', { name: 'Delete device' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Pump 4?' });
    expect(confirm).toHaveTextContent('Its reading bindings, if it has any, are removed');
    await user.click(within(confirm).getByRole('button', { name: 'Delete device' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'error', message: 'The device could not be deleted.' }));
  });
});

describe('a page that stays current (2.1, 4.1, 4.2, 6.3)', () => {
  it('re-reads slowly while live, says when a re-read failed, and refreshes the log on a connection change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = adapterWith();
    const live = fakeLive();
    wrap(<DeviceDetailView deviceId="d1" tab="log" />, { adapter, live });
    await screen.findByRole('heading', { name: 'Pump 4' });
    await waitFor(() => expect(adapter.devices!.log).toHaveBeenCalledTimes(1));
    (adapter.devices!.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(''));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(adapter.devices!.get).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/This may be out of date/)).toBeInTheDocument();
    act(() => live.publish('deviceState', { deviceId: 'd1', online: false, reason: 'keepalive_timeout' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(adapter.devices!.log).toHaveBeenCalledTimes(2);
  });

  it('says when the capabilities could not be read, with a retry; links a quarantined device to the host\'s quarantine page', async () => {
    const onOpen = vi.fn();
    const adapter = adapterWith({ device: { status: 'QUARANTINED', lastDisconnectAt: new Date(), lastDisconnectReason: 'keepalive_timeout' }, capabilities: vi.fn().mockRejectedValue(new Error('down')) });
    render(
      <IotAdapterProvider adapter={adapter} live={null} locale="en">
        <DeviceDetailView deviceId="d1" hrefs={{ quarantine: (id) => `/q?device=${id}` }} onOpen={onOpen} />
      </IotAdapterProvider>,
    );
    expect(await screen.findByText(/could not be read, so nothing can be changed yet/)).toBeInTheDocument();
    // unknown capabilities: no link to a page the viewer may not use (C7)
    expect(screen.queryByRole('link', { name: 'Review in Awaiting approval' })).toBeNull();
    // the Overview's disconnect reason in words
    expect(screen.getByText(/No keep-alive in time/)).toBeInTheDocument();
    cleanup();
    const { capabilities: _c, ...plain } = adapter;
    render(
      <IotAdapterProvider adapter={plain} live={null} locale="en" capabilities={{ ...ALL, canActivateDevice: true }}>
        <DeviceDetailView deviceId="d1" hrefs={{ quarantine: (id) => `/q?device=${id}` }} onOpen={onOpen} />
      </IotAdapterProvider>,
    );
    const link = await screen.findByRole('link', { name: 'Review in Awaiting approval' });
    expect(link).toHaveAttribute('href', '/q?device=d1');
    await userEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith('/q?device=d1');
  });

  it('says when the changes could not be read, and stops paging at the host\'s depth', async () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, at: new Date(Date.now() - i * 1000), source: 'connection' as const, kind: 'connected' }));
    const adapter = adapterWith();
    (adapter.devices!.log as ReturnType<typeof vi.fn>).mockImplementation(async (_id: string, q: { page: number }) => ({
      items: entries.map((e) => ({ ...e, id: `${e.id}-${q.page}` })), total: 5_000, auditAvailable: false, maxDepth: 100,
    }));
    const user = userEvent.setup();
    wrap(<DeviceDetailView deviceId="d1" tab="log" />, { adapter });
    expect(await screen.findByText(/changes could not be read this time/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Showing the newest 100 entries.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('the edit drawer does not close while it saves', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    let finish: () => void = () => undefined;
    (adapter.devices!.update as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise((r) => { finish = () => r({ ...DEVICE, label: 'x' }); }));
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Label'), 'x');
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    act(() => finish());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(adapter.devices!.update).toHaveBeenCalledOnce();
  });
});

describe('attributes (2.4, 4.3, 6.4, 6.6)', () => {
  const m = IOT_MESSAGES;
  it('checks a new key against the host\'s rules', () => {
    expect(attributeKeyProblem('room temp', 'SERVER', m)).toBe(m.attribute.keyInvalid);
    expect(attributeKeyProblem('_x', 'SERVER', m)).toBe(m.attribute.keyReserved);
    expect(attributeKeyProblem('fw_version', 'SHARED', m)).toBe(m.attribute.keyReserved);
    expect(attributeKeyProblem('valve.state', 'SHARED', m)).toBe(m.attribute.keyReserved);
    expect(attributeKeyProblem('cfg_hash', 'SERVER', m)).toBe(m.attribute.keyReserved);
    expect(attributeKeyProblem('cfg.mode', 'SERVER', m)).toBe(m.attribute.keyConfigShared);
    expect(attributeKeyProblem('cfg.mode', 'SHARED', m)).toBeNull();
    expect(attributeKeyProblem('k'.repeat(58), 'SHARED', m)).toBe(m.attribute.keySharedTooLong);
    expect(attributeKeyProblem('k'.repeat(58), 'SERVER', m)).toBeNull();
    expect(attributeKeyProblem('session_limits', 'SHARED', m)).toBe(m.attribute.keyReserved);
  });

  const entries = (rows: AttributeEntry[]) => ({ SERVER: rows, SHARED: rows, CLIENT: [] });

  it('asks before a new key replaces one the scope holds; refuses a reserved key before any request; says a failed save failed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('')).mockResolvedValue(undefined);
    wrap(<DeviceAttributeTable entries={entries([{ key: 'mode', value: 'eco', updatedAt: Date.UTC(2026, 10, 5, 9, 30, 15) }])} canWrite onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Add attribute' }));
    await user.type(screen.getByLabelText('New key'), '_secret');
    await user.type(screen.getByLabelText('Value'), '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(m.attribute.keyReserved)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('New key'));
    await user.type(screen.getByLabelText('New key'), 'mode');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const ask = await screen.findByRole('dialog', { name: 'mode already has a value. Replace it?' });
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'mode already has a value. Replace it?' })).getByRole('button', { name: 'Replace' }));
    // no answer from the host: the save says it failed
    expect(await screen.findByText('The attribute could not be saved.')).toBeInTheDocument();
    // "Updated" carries the exact time
    expect(screen.getByTitle(/09:30/)).toBeInTheDocument();
  });

  it('shows the sync column only when some shared key has a sync state', async () => {
    const user = userEvent.setup();
    const { rerender } = wrap(<DeviceAttributeTable defaultScope="SHARED" entries={entries([{ key: 'mode', value: 'eco' }])} />);
    expect(screen.queryByRole('columnheader', { name: 'Device' })).toBeNull();
    rerender(
      <IotAdapterProvider adapter={{}} capabilities={ALL} locale="en">
        <DeviceAttributeTable defaultScope="SHARED" entries={entries([{ key: 'cfg.mode', value: 'eco', sync: 'pending' }])} />
      </IotAdapterProvider>,
    );
    expect(await screen.findByRole('columnheader', { name: /Device/ })).toBeInTheDocument();
    void user;
  });
});

describe('useDeviceLog refresh', () => {
  it('puts what is new on top and keeps the pages shown', async () => {
    let round = 0;
    const log = vi.fn(async (_id: string, q: { page: number }) => {
      if (q.page === 2) return { items: [{ id: 'old', at: 1, source: 'connection' as const, kind: 'connected' }], total: 3 };
      round++;
      return { items: round > 1 ? [{ id: 'new', at: 3, source: 'connection' as const, kind: 'disconnected' }, { id: 'mid', at: 2, source: 'connection' as const, kind: 'connected' }] : [{ id: 'mid', at: 2, source: 'connection' as const, kind: 'connected' }], total: round > 1 ? 3 : 2 };
    });
    const api = { list: vi.fn(), get: vi.fn(), connections: vi.fn(), log };
    let state: ReturnType<typeof useDeviceLog> | null = null;
    function Probe() { state = useDeviceLog(api as never, 'd1', { pageSize: 1, errorText: 'x' }); return null; }
    render(<Probe />);
    await waitFor(() => expect(state!.entries.map((e) => e.id)).toEqual(['mid']));
    act(() => state!.more());
    await waitFor(() => expect(state!.entries.map((e) => e.id)).toEqual(['mid', 'old']));
    act(() => state!.refresh());
    await waitFor(() => expect(state!.entries.map((e) => e.id)).toEqual(['new', 'mid', 'old']));
  });
});

describe('review fixes (NB 41-ui-fixes/22 C2, C3, C8–C12)', () => {
  it('C2: back off the page while a secret is not stored asks; "Stay" keeps the guard entry, storing takes it off', async () => {
    const user = userEvent.setup();
    const before = window.history.length;
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />);
    await user.click(await screen.findByRole('button', { name: 'Rotate secret' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' }));
    await screen.findByTestId('issued-secret');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.history.length).toBe(before + 1);
    const guard = () => (window.history.state as Record<string, unknown> | null)?.__iotLeaveGuard;
    const mine = guard();
    expect(mine).toBeTruthy();
    act(() => window.history.back());
    const ask = await screen.findByRole('dialog', { name: IOT_MESSAGES.credential.leaveUnstored });
    expect(guard()).not.toBe(mine);
    await user.click(within(ask).getByRole('button', { name: 'Stay' }));
    // the guard entry is back
    await waitFor(() => expect(guard()).toBe(mine));
    await user.click(screen.getByRole('button', { name: 'I have stored it' }));
    // storing takes it off again: no extra step stays in history
    await waitFor(() => expect(guard()).not.toBe(mine));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('C2: "Leave" after back goes back for real, and is not asked again', async () => {
    const user = userEvent.setup();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />);
    await user.click(await screen.findByRole('button', { name: 'Rotate secret' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate secret' }));
    await screen.findByTestId('issued-secret');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => window.history.back());
    const ask = await screen.findByRole('dialog', { name: IOT_MESSAGES.credential.leaveUnstored });
    const back = vi.spyOn(window.history, 'back');
    await user.click(within(ask).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog', { name: IOT_MESSAGES.credential.leaveUnstored })).toBeNull();
  });

  it('C3: a failed re-read on focus keeps the rows with a stale line; focus and visibility read once; a late answer cannot overwrite a newer one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const list = vi.fn();
    const adapter = adapterWith({ attributes: { list, save: vi.fn().mockResolvedValue(undefined), remove: vi.fn() } });
    list.mockResolvedValueOnce([{ key: 'mode', value: 'eco' }]);
    wrap(<DeviceDetailView deviceId="d1" tab="attributes" />, { adapter });
    expect(await screen.findByText('mode')).toBeInTheDocument();
    list.mockRejectedValueOnce(new Error(''));
    act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(list).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/This may be out of date/)).toBeInTheDocument();
    expect(screen.getByText('mode')).toBeInTheDocument();
    // a slow focus read, then a newer read (Retry): the slow answer lands last and is dropped
    let slow: (v: unknown) => void = () => undefined;
    list.mockImplementationOnce(() => new Promise((r) => { slow = r; }));
    list.mockResolvedValueOnce([{ key: 'fresh', value: 1 }]);
    act(() => { window.dispatchEvent(new Event('focus')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await act(async () => { screen.getByRole('button', { name: 'Retry' }).click(); });
    expect(await screen.findByText('fresh')).toBeInTheDocument();
    await act(async () => { slow([{ key: 'old', value: 0 }]); });
    expect(screen.queryByText('old')).toBeNull();
    expect(screen.getByText('fresh')).toBeInTheDocument();
  });

  it('C8: a value nested deeper than the host allows is refused before any request', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    wrap(<DeviceAttributeTable entries={{ SERVER: [], SHARED: [], CLIENT: [] }} canWrite onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Add attribute' }));
    await user.type(screen.getByLabelText('New key'), 'deep');
    const deep = '[[[[[[[[[1]]]]]]]]]';
    await user.click(screen.getByLabelText('Value'));
    await user.paste(deep);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('A value may nest at most 8 levels.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('C9: credential dates are written in the host\'s time zone', () => {
    render(
      <IotAdapterProvider adapter={{}} capabilities={ALL} locale="en-GB" timeZone="Asia/Tokyo">
        <DeviceCredentialPanel credential={{ type: 'ACCESS_TOKEN', createdAt: '2026-11-05T23:30:00Z' }} />
      </IotAdapterProvider>,
    );
    expect(screen.getByText(/6 Nov 2026.*08:30/)).toBeInTheDocument();
  });

  it('C10: the delete button is busy while the bindings are counted; a count that takes too long says "if it has any"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const adapter = adapterWith();
    (adapter.devices!.deleteImpact as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => undefined));
    wrap(<DeviceDetailView deviceId="d1" />, { adapter });
    const button = await screen.findByRole('button', { name: /Delete device/ });
    act(() => button.click());
    await waitFor(() => expect(button).toBeDisabled());
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    const confirm = await screen.findByRole('dialog', { name: 'Delete Pump 4?' });
    expect(confirm).toHaveTextContent('if it has any');
  });

  it('C11: a fast double click opens one confirm (rotate, revoke, edit save)', async () => {
    const user = userEvent.setup();
    wrap(<DeviceDetailView deviceId="d1" tab="credentials" />);
    const rotate = await screen.findByRole('button', { name: 'Rotate secret' });
    act(() => { rotate.click(); rotate.click(); });
    await screen.findByRole('dialog', { name: 'Rotate the secret of Pump 4?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog');
    await user.clear(within(drawer).getByLabelText(/^Name/));
    await user.type(within(drawer).getByLabelText(/^Name/), 'Pump 5');
    const save = within(drawer).getByRole('button', { name: 'Save' });
    act(() => { save.click(); save.click(); });
    await screen.findByRole('dialog', { name: 'Save changes to Pump 4?' });
    expect(screen.getAllByRole('dialog', { name: 'Save changes to Pump 4?' })).toHaveLength(1);
  });

  it('C12: a device changed underneath the open drawer is said, and Save sends only the draft\'s own change', async () => {
    const user = userEvent.setup();
    const adapter = adapterWith();
    const device = { ...DEVICE, online: false };
    const view = (d: DeviceRecord) => (
      <IotAdapterProvider adapter={adapter} capabilities={ALL} locale="en">
        <EditDeviceDrawer open device={d} onClose={vi.fn()} />
      </IotAdapterProvider>
    );
    const { rerender } = render(view(device));
    const drawer = await screen.findByRole('dialog');
    await user.type(within(drawer).getByLabelText('Label'), 'Hall');
    // someone else renamed it; the page re-read it while the drawer is open
    rerender(view({ ...device, name: 'Pump 4b', type: 'pump' }));
    expect(within(drawer).getByText(/changed while you were editing/)).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adapter.devices!.update).toHaveBeenCalledWith('d1', { label: 'Hall' }));
  });
});
