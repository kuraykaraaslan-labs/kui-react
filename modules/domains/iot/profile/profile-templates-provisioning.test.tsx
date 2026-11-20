import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IOT_MESSAGES } from '../messages';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  blankProfileDraft, provisioningSettingsIssues, provisioningSettingsPatch, type DeviceProfile, type ProfileTemplate, type ProvisioningSettings,
  type TemplateUpdate,
} from '../types/profile';
import { DeviceProfileEditorView } from './DeviceProfileEditorView';
import { DeviceProfileListView } from './DeviceProfileListView';
import { defaultPicks, describeTemplateValue, templateFieldLabel } from './TemplateUpdateBanner';

/* NB iot_device_profile 02 §2.1 (provisioning settings in the editor), 00 §0.3 (the template update banner), 03 §3.3 (platform templates). */

const T0 = new Date('2026-11-20T12:00:00Z');
const m = IOT_MESSAGES as never;
const profile = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
  ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: null, isDefault: false, onlineRule: 'LIVE_SOCKET', createdAt: T0, updatedAt: T0, version: 4, ...over,
});
const SETTINGS: ProvisioningSettings = { provisionRateLimitPerHour: 60, autoActivate: false, certLifetimeDays: 365 };

function adapterOf(store: DeviceProfile[], over: Partial<IotAdapter> = {}, profilesOver: Partial<NonNullable<IotAdapter['profiles']>> = {}): IotAdapter {
  return {
    profiles: {
      options: async () => store.map((p) => ({ id: p.profileId, name: p.name })),
      get: vi.fn(async (id: string) => structuredClone(store.find((p) => p.profileId === id)!)),
      update: vi.fn(async (id: string, patch) => ({ ...store.find((p) => p.profileId === id)!, ...patch, version: 5 } as DeviceProfile)),
      usage: async (ids) => Object.fromEntries(ids.map((id) => [id, { devices: 0, references: [] }])),
      ...profilesOver,
    },
    ...over,
  };
}

function provisioningOf(settings: ProvisioningSettings = SETTINGS, setSettings = vi.fn(async (_id: string, patch: Partial<ProvisioningSettings>) => ({ ...settings, ...patch }))) {
  return {
    get: vi.fn(async () => ({ keys: [], availableStrategies: ['DISABLED' as const], rotationGrace: null, settings })),
    setStrategy: vi.fn(async (_id: string, s) => s),
    setSettings,
    rotate: vi.fn(),
    revoke: vi.fn(),
  };
}

function renderEditor(adapter: IotAdapter, caps: Partial<IotCapabilities>) {
  return render(<IotAdapterProvider adapter={adapter} capabilities={caps} locale="en-GB"><DeviceProfileEditorView profileId="p1" tab="provisioning" /></IotAdapterProvider>);
}

afterEach(() => cleanup());

describe('provisioning settings (02 §2.1)', () => {
  it('pure helpers: only the changed settings are sent; out-of-range or fractional numbers block', () => {
    expect(provisioningSettingsPatch(SETTINGS, { ...SETTINGS, autoActivate: true })).toEqual({ autoActivate: true });
    expect(provisioningSettingsPatch(SETTINGS, SETTINGS)).toEqual({});
    expect(provisioningSettingsIssues({ ...SETTINGS, provisionRateLimitPerHour: 0 })).toEqual({ provisionRateLimitPerHour: 'out_of_range' });
    expect(provisioningSettingsIssues({ ...SETTINGS, certLifetimeDays: 30.5 })).toEqual({ certLifetimeDays: 'out_of_range' });
    expect(provisioningSettingsIssues({ ...SETTINGS, certLifetimeDays: 826 })).toEqual({ certLifetimeDays: 'out_of_range' });
    expect(provisioningSettingsIssues(null)).toEqual({});
  });

  it('a viewer who manages provisioning edits the rate limit and auto-activation, and Save sends only them to the provisioning API', async () => {
    const user = userEvent.setup();
    const provisioning = provisioningOf();
    const adapter = adapterOf([profile()], { provisioning });
    renderEditor(adapter, { canManageProfiles: true, canManageProvisioning: true });
    const rate = await screen.findByLabelText('Registrations per key per hour');
    // the certificate lifetime is a platform template's (the host issues certificates only to factory units)
    expect(screen.queryByLabelText('Certificate lifetime (days)')).toBeNull();
    await user.clear(rate);
    await user.type(rate, '120');
    await user.click(screen.getByRole('switch', { name: /Activate new devices at once/ }));
    expect(screen.getByText(/can now add working devices/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(provisioning.setSettings).toHaveBeenCalledWith('p1', { provisionRateLimitPerHour: 120, autoActivate: true }));
    // nothing of the profile changed: no profile patch, the row is read back for its new version
    expect(adapter.profiles!.update).not.toHaveBeenCalled();
    expect(adapter.profiles!.get).toHaveBeenCalledTimes(2);
  });

  it('an out-of-range value blocks Save and is marked on the Provisioning tab', async () => {
    const user = userEvent.setup();
    const provisioning = provisioningOf();
    renderEditor(adapterOf([profile()], { provisioning }), { canManageProfiles: true, canManageProvisioning: true });
    const rate = await screen.findByLabelText('Registrations per key per hour');
    await user.clear(rate);
    await user.type(rate, '0');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(provisioning.setSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Fix the marked fields before saving.')).toBeTruthy();
  });

  it('a platform template shows the certificate lifetime', async () => {
    const provisioning = provisioningOf();
    renderEditor(adapterOf([profile({ platformTemplate: { key: 'dc620-dual', version: 3 } })], { provisioning }),
      { canManageProfiles: true, canManageProvisioning: true, canManageTemplates: true });
    expect(await screen.findByLabelText('Certificate lifetime (days)')).toHaveValue(365);
  });

  it('without the provisioning permission nothing is read and no setting is drawn', async () => {
    const provisioning = provisioningOf();
    renderEditor(adapterOf([profile()], { provisioning }), { canManageProfiles: true, canManageProvisioning: false });
    await screen.findByText('Provisioning strategy', { selector: 'h3' });
    expect(provisioning.get).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Registrations per key per hour')).toBeNull();
  });

  it('a refused settings write keeps the change in the form with the host\'s word on the field', async () => {
    const user = userEvent.setup();
    const provisioning = provisioningOf(SETTINGS, vi.fn(async () => { throw new IotApiError('validation', 'Too many'); }));
    renderEditor(adapterOf([profile()], { provisioning }), { canManageProfiles: true, canManageProvisioning: true });
    const rate = await screen.findByLabelText('Registrations per key per hour');
    await user.clear(rate);
    await user.type(rate, '99');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/The profile was not saved: Too many/)).toBeTruthy();
    expect(screen.getByLabelText('Registrations per key per hour')).toHaveValue(99);
  });
});

const UPDATE: TemplateUpdate = {
  templateKey: 'dc620-dual', fromVersion: 2, toVersion: 3,
  fields: [
    { field: 'rpcTimeoutDefaultSec', mine: 10, theirs: 20, edited: false },
    { field: 'description', mine: 'Ours', theirs: 'New text', edited: true },
    { field: 'certLifetimeDays', mine: 365, theirs: 730, edited: null, locked: true },
  ],
};

describe('TemplateUpdateBanner (00 §0.3, P0-E25)', () => {
  it('helpers: labels, short values, and only unchanged settings picked by default', () => {
    expect(templateFieldLabel('rpcTimeoutDefaultSec', IOT_MESSAGES as never)).toBe(IOT_MESSAGES.limits.rpcTimeoutDefaultSec);
    expect(templateFieldLabel('somethingNew', IOT_MESSAGES as never)).toBe('somethingNew');
    expect(describeTemplateValue('strictKeys', true, m)).toBe('Yes');
    expect(describeTemplateValue('onlineRule', 'LIVE_SOCKET', m)).toBe('Live connection');
    expect(describeTemplateValue('telemetrySchema', [{ key: 'a' }, { key: 'b' }], m, 'en')).toBe('2 keys: a, b');
    expect(describeTemplateValue('allowedNetworks', [], m)).toBe('none');
    expect(describeTemplateValue('rateLimits', { csr: '1:60' }, m)).toBe('csr: 1:60');
    expect(defaultPicks(UPDATE.fields)).toEqual(['rpcTimeoutDefaultSec']);
  });

  it('a copy without a newer template shows nothing; with one, the banner and the drawer apply only what is picked', async () => {
    const user = userEvent.setup();
    const copy = profile({ template: { key: 'dc620-dual', version: 2 } });
    const apply = vi.fn(async () => ({ ...copy, rpcTimeoutDefaultSec: 20, template: { key: 'dc620-dual', version: 3 }, version: 6 }));
    const get = vi.fn().mockResolvedValueOnce(UPDATE).mockResolvedValue(null);
    renderEditor(adapterOf([copy], {}, { templateUpdate: { get, apply } }), { canManageProfiles: true });
    await screen.findByText(/Template dc620-dual v3 is available \(this profile has v2\)/);
    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Changed here')).toBeTruthy();
    expect(within(drawer).getByText('Needs the provisioning permission')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: 'Apply 1 change' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith('p1', { toVersion: 3, fields: ['rpcTimeoutDefaultSec'], expectedVersion: 4 }));
    await waitFor(() => expect(screen.queryByText(/is available/)).toBeNull());
  });

  it('nothing picked keeps every value and still records the version', async () => {
    const user = userEvent.setup();
    const copy = profile({ template: { key: 'dc620-dual', version: 2 } });
    const apply = vi.fn(async () => ({ ...copy, version: 6 }));
    renderEditor(adapterOf([copy], {}, { templateUpdate: { get: vi.fn().mockResolvedValueOnce({ ...UPDATE, fields: [UPDATE.fields[1]] }).mockResolvedValue(null), apply } }),
      { canManageProfiles: true });
    await user.click(await screen.findByRole('button', { name: 'Review changes' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep this profile\'s values' }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith('p1', { toVersion: 3, fields: [], expectedVersion: 4 }));
  });

  it('a read-only viewer sees the differences but no Apply', async () => {
    const user = userEvent.setup();
    const copy = profile({ template: { key: 'dc620-dual', version: 2 } });
    renderEditor(adapterOf([copy], {}, { templateUpdate: { get: vi.fn(async () => UPDATE), apply: vi.fn() } }), { canManageProfiles: false });
    await user.click(await screen.findByRole('button', { name: 'Review changes' }));
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).queryByRole('button', { name: /Apply|Keep/ })).toBeNull();
  });

  it('a template that moved meanwhile is said so and read again', async () => {
    const user = userEvent.setup();
    const copy = profile({ template: { key: 'dc620-dual', version: 2 } });
    const get = vi.fn(async () => UPDATE);
    const apply = vi.fn(async () => { throw new IotApiError('conflict', 'moved', { details: { reason: 'template_moved' } }); });
    renderEditor(adapterOf([copy], {}, { templateUpdate: { get, apply } }), { canManageProfiles: true });
    await user.click(await screen.findByRole('button', { name: 'Review changes' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apply 1 change' }));
    expect(await screen.findByText(/The template changed again/)).toBeTruthy();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});

describe('Platform templates (03 §3.3)', () => {
  const T: ProfileTemplate = {
    templateKey: 'dc620-dual', templateVersion: 3, name: 'DC620 Dual', description: null, transportType: 'MQTT', topicSchemes: ['ROLTEK'],
    allowedAuthModes: ['ACCESS_TOKEN'], mqttTransport: 'TLS_REQUIRED', plaintextAllCommands: false, updatedAt: T0.toISOString(), copyProfileId: null, profileId: 'root-p',
  };
  const listAdapter = (list = vi.fn(async () => ({ items: [T], total: 1 }))): IotAdapter => ({
    profiles: {
      options: async () => [],
      list: async () => ({ items: [], total: 0 }),
      templates: { list, adopt: vi.fn() },
    },
  });

  it('only a viewer who publishes templates gets the header button', async () => {
    render(<IotAdapterProvider adapter={listAdapter()} capabilities={{ canManageProfiles: true }} locale="en-GB"><DeviceProfileListView hrefs={{ profile: (id) => `/p/${id}` }} /></IotAdapterProvider>);
    await screen.findByRole('heading', { name: IOT_MESSAGES.profiles.title });
    expect(screen.queryByRole('button', { name: /Platform templates/ })).toBeNull();
  });

  it('the drawer lists the published templates and a name opens the template\'s own profile', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const list = vi.fn(async () => ({ items: [T], total: 1 }));
    render(<IotAdapterProvider adapter={listAdapter(list)} capabilities={{ canManageProfiles: true, canPublishTemplates: true }} locale="en-GB">
      <DeviceProfileListView hrefs={{ profile: (id) => `/p/${id}` }} onOpen={onOpen} />
    </IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: /Platform templates/ }));
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('dc620-dual')).toBeTruthy();
    expect(within(drawer).getByText('v3')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: 'Open DC620 Dual' }));
    expect(onOpen).toHaveBeenCalledWith('root-p');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, sort: { key: 'name', dir: 'asc' } }), expect.anything());
  });
});
