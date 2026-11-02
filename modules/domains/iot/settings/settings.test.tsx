import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DeviceSettings, DeviceSettingsSchema, SettingsSchemaNode, SettingsSection } from '../types/settings';
import { DeviceSettingsView } from './DeviceSettingsView';
import { BaselineEditorDrawer } from './BaselineEditorDrawer';
import { JobDetailView } from './JobDetailView';
import type { SettingsFleetAdapter } from './settings-adapter';
import type { SettingsBaseline, SettingsJobView } from '../types/settings';
import { SecretField } from './SecretField';
import { SettingsApiError, type DeviceSettingsAdapter } from './settings-adapter';
import { flattenSettingsMessages, SETTINGS_MESSAGES, settingsMessagesFrom } from './messages';
import { redirectExposesWan, ruleExposesWan, presetFor, sectionWarnings, zonesOf, fieldLabel, valueLabel } from './settings-presets';
import { differences, nodeKind, prepareForEdit, prepareForSave, validateValues } from './settings-schema';

/** The device settings views (next-boilerplate docs/concepts/iot-device-settings 05) over a small manifest shaped like the roltek-420 one. */
const port = { type: 'integer', minimum: 1, maximum: 65535, format: 'port' } as const;
const zone = { type: 'string', maxLength: 32, pattern: '^[a-z][a-z0-9_]{0,31}$' } as const;
const MANIFEST: DeviceSettingsSchema = {
  hash: 'h1', model: 'roltek-420', fw: '1.4.2', released: '2026-10-01', verified: true,
  sections: {
    firewall: { title: { en: 'Firewall', tr: 'Güvenlik duvarı' }, schema: { type: 'object', required: ['zones'], 'x-roltek': { class: 'admin', connectivity: true, restarts: 'service:firewall' }, properties: {
      zones: { type: 'array', maxItems: 16, items: { type: 'object', required: ['name', 'input', 'forward'], properties: { name: zone, networks: { type: 'array', items: zone }, input: { type: 'string', enum: ['ACCEPT', 'REJECT', 'DROP'] }, forward: { type: 'string', enum: ['ACCEPT', 'REJECT', 'DROP'] }, masquerade: { type: 'boolean', default: false } } } },
    } } },
    firewall_redirects: { title: { en: 'Port forwards' }, schema: { type: 'object', required: ['redirects'], 'x-roltek': { class: 'admin', connectivity: true }, properties: {
      redirects: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['name', 'proto', 'srcDport', 'destIp', 'destPort'], properties: {
        name: { type: 'string', maxLength: 64 }, enabled: { type: 'boolean', default: true }, src: zone, proto: { type: 'string', enum: ['tcp', 'udp'] }, srcDport: port,
        destIp: { type: 'string', format: 'ipv4' }, destPort: port, exposesWan: { type: 'boolean', default: false, 'x-roltek': { class: 'dangerous' } },
      } } },
    } } },
    wifi: { title: { en: 'Wi-Fi' }, schema: { type: 'object', required: ['ssids'], 'x-roltek': { class: 'admin', restarts: 'network' }, properties: {
      country: { type: 'string', maxLength: 2, 'x-roltek': { remote: false } },
      radios: { type: 'array', maxItems: 3, items: { type: 'object', required: ['band', 'channel'], properties: { band: { type: 'string', enum: ['2g', '5g'] }, channel: { oneOf: [{ const: 'auto' }, { type: 'integer', minimum: 1, maximum: 233 }] } } } },
      ssids: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['ssid', 'band', 'security'], properties: {
        ssid: { type: 'string', minLength: 1, maxLength: 32 }, band: { type: 'string', enum: ['2g', '5g'] }, security: { type: 'string', enum: ['open', 'wpa2-psk'] },
        key: { type: 'string', minLength: 8, maxLength: 63, 'x-roltek': { sensitive: true } }, hidden: { type: 'boolean', default: false },
      } } },
    } } },
    lte: { title: { en: 'LTE' }, schema: { type: 'object', required: ['apns', 'activeApn'], 'x-roltek': { class: 'admin', connectivity: true, confirmS: 300, restarts: 'network' }, properties: {
      apns: { type: 'array', maxItems: 8, items: { type: 'object', required: ['name', 'apn'], properties: { name: { type: 'string', maxLength: 32 }, apn: { type: 'string', maxLength: 64 } } } },
      activeApn: { type: 'string', maxLength: 32 },
      bands: { type: 'array', maxItems: 32, items: { type: 'integer', minimum: 1, maximum: 255 }, 'x-roltek': { class: 'dangerous' } },
      mode: { type: 'string', enum: ['auto', '4g', '5g'], 'x-roltek': { class: 'dangerous' } },
    } } },
  },
};
const wifi = MANIFEST.sections.wifi.schema;
const DOCS: Record<string, Record<string, unknown>> = {
  firewall: { zones: [{ name: 'lan', input: 'ACCEPT', forward: 'ACCEPT' }, { name: 'wan', networks: ['wan'], input: 'REJECT', forward: 'REJECT', masquerade: true }] },
  firewall_redirects: { redirects: [] },
  wifi: { country: 'TR', radios: [{ band: '2g', channel: 'auto' }], ssids: [{ ssid: 'Office', band: '2g', security: 'wpa2-psk', key: { set: true } }, { ssid: 'Guest', band: '2g', security: 'wpa2-psk', key: { set: true } }] },
  lte: { apns: [{ name: 'Internet', apn: 'internet' }], activeApn: 'Internet', bands: [1, 3], mode: 'auto' },
};
const section = (id: string, o: Partial<SettingsSection> = {}): SettingsSection => ({
  section: id, title: MANIFEST.sections[id].title ?? null, class: 'admin', manifestHash: 'h1', manifestCurrent: true, state: 'applied', desiredRev: 3,
  desired: structuredClone(DOCS[id]), reportedRev: 3, reported: structuredClone(DOCS[id]), reportedState: 'applied', origin: 'cloud', error: null,
  appliedAt: '2026-11-02T10:00:00Z', drift: false, pendingSince: null, expiresAt: null, ...o,
});
const settings = (o: Partial<DeviceSettings> = {}): DeviceSettings => ({
  deviceId: 'd1', model: 'roltek-420', fw: '1.4.2', supported: true, manifest: { hash: 'h1', verified: true, released: '2026-10-01' }, writable: true,
  sections: Object.keys(MANIFEST.sections).map((id) => section(id)), viewer: { classes: ['operate', 'admin', 'dangerous'] }, ...o,
});
function adapterOf(s: DeviceSettings, write?: DeviceSettingsAdapter['write']): DeviceSettingsAdapter & { write: ReturnType<typeof vi.fn> } {
  return {
    read: vi.fn(async () => structuredClone(s)),
    schema: vi.fn(async () => structuredClone(MANIFEST)),
    history: vi.fn(async () => ({ data: [], total: 0 })),
    write: vi.fn(write ?? (async (_d, id, input) => (input.dryRun
      ? { dryRun: true as const, section: id, rev: 4, class: 'admin' as const, paths: [{ path: 'ssids.0.ssid', before: 'Office', after: 'Shop' }], needsConfirm: false, secrets: 0, manifestHash: 'h1' }
      : { section: id, rev: 4, state: 'pending' as const, delivered: true, manifestHash: 'h1', manifestVerified: true }))),
    reapply: vi.fn(async (_d, id) => ({ section: id, rev: 4, state: 'pending' as const, delivered: true, manifestHash: 'h1', manifestVerified: true })),
  };
}

describe('settings-schema', () => {
  it('tells the kinds of control apart', () => {
    const p = wifi.properties!;
    expect(nodeKind(p.country)).toBe('fixed');
    expect(nodeKind(p.ssids)).toBe('object-list');
    expect(nodeKind(p.ssids.items!.properties!.key)).toBe('secret');
    expect(nodeKind(p.radios.items!.properties!.channel)).toBe('choice');
    expect(nodeKind(MANIFEST.sections.lte.schema.properties!.bands)).toBe('scalar-list');
    expect(nodeKind(p.ssids.items!.properties!.band)).toBe('scalar');
  });

  it('keeps a secret where it was read, finds one that moved and one left blank', () => {
    const edit = prepareForEdit(wifi, DOCS.wifi);
    expect((edit.ssids as Array<Record<string, unknown>>)[1].key).toEqual({ $keep: true, $at: 'ssids.1.key' });
    expect(prepareForSave(wifi, edit)).toMatchObject({ moved: [], blank: [] });
    expect((prepareForSave(wifi, edit).values.ssids as Array<Record<string, unknown>>)[0].key).toEqual({ $keep: true });
    // the first network removed: the second one's password moved to index 0 and cannot be kept by position
    const shifted = { ...edit, ssids: [(edit.ssids as unknown[])[1]] };
    expect(prepareForSave(wifi, shifted).moved).toEqual(['ssids.0.key']);
    const blank = { ...edit, ssids: [{ ...(edit.ssids as Array<Record<string, unknown>>)[0], key: '' }] };
    expect(prepareForSave(wifi, blank).blank).toEqual(['ssids.0.key']);
  });

  it('checks values against the manifest subset before the server does', () => {
    const r = MANIFEST.sections.firewall_redirects.schema;
    const issues = validateValues(r, { redirects: [{ name: 'Cam', proto: 'tcp', srcDport: 70000, destIp: '10.0.0.300', destPort: 80, extra: 1 }] });
    expect(issues.map((i) => `${i.path}:${i.code}`).sort()).toEqual(['redirects.0.destIp:format', 'redirects.0.extra:unknown', 'redirects.0.srcDport:maximum']);
    expect(validateValues(wifi, { ssids: [{ band: '2g', security: 'open' }], radios: [{ band: '2g', channel: 'fast' }] }).map((i) => i.code).sort()).toEqual(['required', 'type']);
    expect(validateValues(wifi, { ssids: [], radios: [{ band: '2g', channel: 36 }] })).toEqual([]);
  });

  it('says where desired and reported differ, a secret only by whether it is set', () => {
    const d = differences(wifi, DOCS.wifi, { ...DOCS.wifi, ssids: [{ ssid: 'Office-old', band: '2g', security: 'wpa2-psk', key: { set: false } }] });
    expect(d.map((x) => x.path)).toEqual(['ssids.0.key', 'ssids.0.ssid', 'ssids.1.band', 'ssids.1.key', 'ssids.1.security', 'ssids.1.ssid']);
    expect(d[0]).toMatchObject({ sensitive: true, desired: true, reported: false });
  });
});

describe('settings-presets', () => {
  const zones = zonesOf(DOCS.firewall);
  it('marks what opens a service to the internet', () => {
    expect(zones).toEqual([{ name: 'lan', wan: false }, { name: 'wan', wan: true }]);
    expect(ruleExposesWan({ src: 'wan', target: 'ACCEPT', proto: 'tcp', destPort: 22 }, zones)).toBe(true);
    expect(ruleExposesWan({ src: 'lan', dest: 'wan', target: 'ACCEPT' }, zones)).toBe(false);
    expect(ruleExposesWan({ src: 'wan', target: 'ACCEPT', enabled: false }, zones)).toBe(false);
    expect(redirectExposesWan({ name: 'Cam', destPort: 554 }, zones)).toBe(true);
    expect(redirectExposesWan({ name: 'Cam', src: 'lan' }, zones)).toBe(false);
    const ctx = { sections: { firewall: DOCS.firewall }, m: SETTINGS_MESSAGES };
    const derived = presetFor('firewall_redirects').lists!.redirects.derive!({ name: 'Cam', srcDport: 8554 }, ctx, MANIFEST.sections.firewall_redirects.schema.properties!.redirects.items!);
    expect(derived.exposesWan).toBe(true);
    expect(sectionWarnings('firewall_redirects', { redirects: [{ name: 'Cam', srcDport: 8554 }] }, ctx)).toEqual(['Cam: Opens port 8554 to the internet.']);
  });
  it('labels from the manifest first, then the kit, then the name', () => {
    expect(fieldLabel(SETTINGS_MESSAGES, 'wifi', 'ssids.ssid', 'ssid', { title: { en: 'SSID', tr: 'Ağ adı' } }, 'tr-TR')).toBe('Ağ adı');
    expect(fieldLabel(SETTINGS_MESSAGES, 'wifi', 'ssids.ssid', 'ssid', {})).toBe('Network name');
    expect(fieldLabel(SETTINGS_MESSAGES, 'x', 'fooBar', 'fooBar', {})).toBe('Foo bar');
    expect(valueLabel(SETTINGS_MESSAGES, 'lte', 'mode', '5g')).toBe('5G only');
    expect(valueLabel(SETTINGS_MESSAGES, 'wifi', 'ssids.band', '5g')).toBe('5 GHz');
  });
});

describe('messages', () => {
  it('translates every text through the host, fields keeping their dots', () => {
    const keys: string[] = [];
    const m = settingsMessagesFrom((k, en) => { keys.push(k); return `T:${en}`; });
    expect(m.fields['wifi.ssids.ssid']).toBe('T:Network name');
    expect(m.fleet.jobState.running).toBe('T:Running');
    expect(keys).toContain('fields.wifi.ssids.ssid');
    expect(keys.length).toBe(Object.keys(flattenSettingsMessages()).length);
  });
});

describe('SecretField', () => {
  it('never shows the value: Change, type, keep the current one', async () => {
    const onChange = vi.fn();
    const kept = { $keep: true, $at: 'ssids.0.key' };
    const { rerender } = render(<SecretField id="k" label="Password" value={kept} onChange={onChange} />);
    expect(screen.getByText('Set')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    rerender(<SecretField id="k" label="Password" value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Keep the current one' }));
    expect(onChange).toHaveBeenLastCalledWith(kept);
  });
});

describe('DeviceSettingsView', () => {
  it('says why a device takes no settings', async () => {
    render(<DeviceSettingsView adapter={adapterOf(settings({ supported: false, reason: 'manifest_unknown', sections: [], model: 'x1', fw: '0.1' }))} deviceId="d1" pollMs={0} />);
    expect(await screen.findByText('The settings of this model are not known yet')).toBeTruthy();
    expect(screen.getByText(/Model x1 with firmware 0.1/)).toBeTruthy();
  });

  it('lists the sections of the manifest with their state, the unverified and read-only notices', async () => {
    const s = settings({ writable: false, manifest: { hash: 'h1', verified: false, released: '2024-01-01' } });
    s.sections[2] = section('wifi', { state: 'pending' });
    s.sections[3] = section('lte', { drift: true });
    render(<DeviceSettingsView adapter={adapterOf(s)} deviceId="d1" pollMs={0} />);
    expect(await screen.findByText('Wi-Fi')).toBeTruthy();
    expect(screen.getAllByText('Unverified settings list').length).toBeGreaterThan(0);
    expect(screen.getByText('Read only: update the firmware to change settings')).toBeTruthy();
    expect(screen.getByText('On its way')).toBeTruthy();
    expect(screen.getByText('Changed on the device')).toBeTruthy();
  });

  it('changes an SSID: the row drawer, a dry run, the confirmation, then the write with If-Match and the kept password', async () => {
    const a = adapterOf(settings());
    render(<DeviceSettingsView adapter={a} deviceId="d1" pollMs={0} />);
    await userEvent.click(await screen.findByText('Wi-Fi'));
    const drawer = await screen.findByRole('dialog', { name: 'Wi-Fi settings' });
    expect(within(drawer).getByText(/Set on the device/)).toBeTruthy();
    await userEvent.click(within(drawer).getByText('Office'));
    const row = await screen.findByRole('dialog', { name: /Wi-Fi networks: Office/ });
    const name = within(row).getByLabelText(/Network name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Shop');
    await userEvent.click(within(row).getByRole('button', { name: 'Done' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const ask = await screen.findByRole('dialog', { name: 'Save these changes?' });
    expect(within(ask).getByText(/Office → Shop/)).toBeTruthy();
    expect(within(ask).getByText(/restarts the device's network/)).toBeTruthy();
    await userEvent.click(within(ask).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(a.write).toHaveBeenCalledTimes(2));
    const [, sectionId, input] = a.write.mock.calls[1];
    expect(sectionId).toBe('wifi');
    expect(input).toMatchObject({ ifMatch: 3 });
    expect(input.values.ssids[0]).toEqual({ ssid: 'Shop', band: '2g', security: 'wpa2-psk', key: { $keep: true } });
    expect(input.values.country).toBe('TR');
  });

  it('asks for the section name typed before a change that can cut the device off', async () => {
    const a = adapterOf(settings(), async (_d, id, input) => (input.dryRun
      ? { dryRun: true, section: id, rev: 4, class: 'dangerous', paths: [{ path: 'mode', before: 'auto', after: '4g' }], needsConfirm: true, secrets: 0, manifestHash: 'h1' }
      : { section: id, rev: 4, state: 'pending', delivered: true, manifestHash: 'h1', manifestVerified: true }));
    render(<DeviceSettingsView adapter={a} deviceId="d1" pollMs={0} />);
    await userEvent.click(await screen.findByText('LTE'));
    const drawer = await screen.findByRole('dialog', { name: 'LTE settings' });
    await userEvent.selectOptions(within(drawer).getByLabelText(/Network mode/), '4g');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    const ask = await screen.findByRole('dialog', { name: 'This change can cut the device off' });
    expect(within(ask).getByText(/undoes it by itself within 300 seconds/)).toBeTruthy();
    const go = within(ask).getByRole('button', { name: 'Save anyway' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.type(within(ask).getByLabelText(/Type LTE to confirm/), 'LTE');
    expect(go.disabled).toBe(false);
    await userEvent.click(go);
    await waitFor(() => expect(a.write).toHaveBeenCalledTimes(2));
    expect(a.write.mock.calls[1][2]).toMatchObject({ confirm: true, values: { mode: '4g' } });
  });

  it('warns on a port forward that opens a service to the internet', async () => {
    render(<DeviceSettingsView adapter={adapterOf(settings())} deviceId="d1" pollMs={0} />);
    await userEvent.click(await screen.findByText('Port forwards'));
    const drawer = await screen.findByRole('dialog', { name: 'Port forwards settings' });
    await userEvent.click(within(drawer).getByRole('button', { name: /Add/ }));
    const row = await screen.findByRole('dialog', { name: /New entry: Port forwards/ });
    expect(within(row).getByText(/Opens every port to the internet/)).toBeTruthy();
  });

  it('puts the server\'s field paths under the fields', async () => {
    const a = adapterOf(settings(), async () => { throw new SettingsApiError('Some values do not fit the device.', 422, { reason: 'invalid_values', issues: [{ path: 'activeApn', code: 'maxLength' }] }); });
    render(<DeviceSettingsView adapter={a} deviceId="d1" pollMs={0} />);
    await userEvent.click(await screen.findByText('LTE'));
    const drawer = await screen.findByRole('dialog', { name: 'LTE settings' });
    await userEvent.selectOptions(within(drawer).getByLabelText(/Network mode/), '4g');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    expect((await within(drawer).findAllByText('Profile in use: at most 32 characters')).length).toBeGreaterThan(0);
  });
});

function fleetOf(o: Partial<SettingsFleetAdapter> = {}): SettingsFleetAdapter {
  const job: SettingsJobView = {
    job: {
      jobId: 'j1', name: 'Shop Wi-Fi', baselineId: 'b1', sections: {}, selector: { models: ['roltek-420'] }, waveSizes: [1, 3, 21], gates: { minApplied: 0.95, maxReverted: 0.01 },
      onConflict: 'queue', offlineExpiryDays: 7, waveTimeoutMin: 30, confirmDangerous: false, state: 'paused', settling: false, pauseReason: 'gate_failed', currentWave: 1,
      waveStartedAt: 0, createdBy: 'u1', createdAt: 0, finishedAt: null,
    },
    waves: [
      { wave: 0, size: 1, counters: { queued: 0, sent: 0, applied: 1, reverted: 0, rejected: 0, skipped: 0, offline: 0, superseded: 0, total: 1 }, verdict: 'ok', overridden: false },
      { wave: 1, size: 3, counters: { queued: 0, sent: 0, applied: 2, reverted: 1, rejected: 0, skipped: 0, offline: 0, superseded: 0, total: 3 }, verdict: 'gate_failed', overridden: false },
      { wave: 2, size: 21, counters: { queued: 21, sent: 0, applied: 0, reverted: 0, rejected: 0, skipped: 0, offline: 0, superseded: 0, total: 21 }, verdict: null, overridden: false },
    ],
    totals: { queued: 21, sent: 0, applied: 3, reverted: 1, rejected: 0, skipped: 0, offline: 0, superseded: 0, total: 25 },
  };
  return {
    models: vi.fn(async () => [{ model: 'roltek-420', devices: 25, firmwares: ['1.4.2'], manifest: { hash: 'h1', fw: '1.4.2', released: '2026-10-01', verified: true } }]),
    modelSchema: vi.fn(async () => structuredClone(MANIFEST)),
    profiles: vi.fn(async () => []),
    devices: vi.fn(async () => ({ data: [], total: 0 })),
    baselines: { list: vi.fn(), get: vi.fn(), create: vi.fn(async (i) => ({ ...i, baselineId: 'b2', createdBy: null, createdAt: '', updatedAt: '' })), update: vi.fn(async (id, i) => ({ ...i, baselineId: id, createdBy: null, createdAt: '', updatedAt: '' })), remove: vi.fn() },
    jobs: {
      list: vi.fn(), get: vi.fn(async () => ({ ...structuredClone(job), canManage: true })), targets: vi.fn(async () => ({ data: [], total: 0 })), create: vi.fn(),
      pause: vi.fn(), resume: vi.fn(async () => job.job), cancel: vi.fn(),
    },
    ...o,
  } as SettingsFleetAdapter;
}

describe('BaselineEditorDrawer', () => {
  it('keeps only what is included, never a password', async () => {
    const b: SettingsBaseline = {
      baselineId: 'b1', name: 'Shop Wi-Fi', description: null, models: ['roltek-420'], sections: { wifi: { ssids: [{ ssid: 'Shop', band: '2g', security: 'open' }] } },
      driftPolicy: 'REPORT', offlineExpiryDays: 7, createdBy: null, createdAt: '', updatedAt: '',
    };
    const fleet = fleetOf();
    render(<BaselineEditorDrawer open adapter={fleet} baseline={b} canManage onClose={() => undefined} onSaved={() => undefined} />);
    const drawer = await screen.findByRole('dialog', { name: 'Shop Wi-Fi' });
    await screen.findAllByText('Wi-Fi networks');
    expect(within(drawer).queryByText('Password')).toBeNull();
    expect(within(drawer).getByText(/Passwords and keys are not part of a baseline/)).toBeTruthy();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fleet.baselines.update).toHaveBeenCalled());
    expect((fleet.baselines.update as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ sections: { wifi: { ssids: [{ ssid: 'Shop', band: '2g', security: 'open' }] } }, models: ['roltek-420'] });
    await userEvent.click(within(drawer).getByLabelText(/Include: Wi-Fi networks/));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fleet.baselines.update).toHaveBeenCalledTimes(2));
    expect((fleet.baselines.update as ReturnType<typeof vi.fn>).mock.calls[1][1].sections).toEqual({});
  });
});

describe('JobDetailView', () => {
  it('says why a job paused and asks before going on past a failed wave', async () => {
    const fleet = fleetOf();
    render(<JobDetailView adapter={fleet} jobId="j1" pollMs={0} />);
    expect(await screen.findByText(/wave 2 did not pass its check \(66.7 % applied, 33.3 % undone\)/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Go on anyway' }));
    const ask = await screen.findByRole('dialog', { name: 'Go on past a failed wave?' });
    expect(within(ask).getByText(/This is recorded/)).toBeTruthy();
    await userEvent.click(within(ask).getByRole('button', { name: 'Go on anyway' }));
    await waitFor(() => expect(fleet.jobs.resume).toHaveBeenCalledWith('j1'));
  });
});

void (null as unknown as SettingsSchemaNode);
