import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  blankProfileDraft, isNetwork, parseLimitString, profileDraftIssues, profilePatch, draftOf, DEFAULT_RATE_LIMITS,
  type DeviceProfile, type DeviceProfileDraft, type ProfileAuthMode, type ProfileRateLimits, type ProfileTransport,
} from '../types/profile';
import { OnlineRuleField, formatSeconds, type OnlineRuleValue } from './OnlineRuleField';
import { AuthModeSelector } from './AuthModeSelector';
import { ProtocolMappingCard } from './ProtocolMappingCard';
import { RateLimitEditor } from './RateLimitEditor';
import { TelemetryKeySchemaTable } from './TelemetryKeySchemaTable';
import { CfgSchemaTable, parseCfgEnum } from './CfgSchemaTable';
import { ProvisioningSettingsCard } from './ProvisioningSettingsCard';
import { NewDeviceProfileDrawer } from './NewDeviceProfileDrawer';
import { DeviceProfileEditorView } from './DeviceProfileEditorView';
import { DeviceProfileListView } from './DeviceProfileListView';

const T0 = new Date('2026-10-24T12:00:00Z');
const profile = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
  ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: null, isDefault: false, onlineRule: 'LIVE_SOCKET', createdAt: T0, updatedAt: T0, ...over,
});
const ALL: Partial<IotCapabilities> = { canManageProfiles: true, canManageAlarmRules: true, canManageRpcCommands: true };

function Wrap({ adapter, caps = ALL, children }: { adapter: IotAdapter; caps?: Partial<IotCapabilities>; children: React.ReactNode }) {
  return <IotAdapterProvider adapter={adapter} capabilities={caps} locale="en-GB">{children}</IotAdapterProvider>;
}

describe('profile rules (mirrors of the host)', () => {
  it('parses limit strings as the protocol writes them', () => {
    expect(parseLimitString('10:1,300:60')).toEqual([{ count: 10, seconds: 1 }, { count: 300, seconds: 60 }]);
    for (const bad of ['', '10', '0:1', '10:0', '300:60,10:1', '10:1,20:1', '1:1,2:2,3:3,4:4,5:5', 'a:b', '10:1,']) expect(parseLimitString(bad), bad).toBeNull();
  });

  it('OD-63: a blank draft has no online rule and is not saveable; the transport only forbids', () => {
    const d = blankProfileDraft('New');
    expect(d.onlineRule).toBeNull();
    expect(profileDraftIssues(d).onlineRule).toBe('online_rule_required');
    for (const t of ['HTTP', 'LORAWAN'] as ProfileTransport[]) expect(profileDraftIssues({ ...d, transportType: t, onlineRule: 'LIVE_SOCKET' }).onlineRule).toBe('online_rule_not_allowed');
    for (const t of ['MQTT', 'ANY'] as ProfileTransport[]) expect(profileDraftIssues({ ...d, transportType: t, onlineRule: 'LIVE_SOCKET' }).onlineRule).toBeUndefined();
  });

  it('OD-57: the interval is required only for the window rule, the factor is 1.5 to 10 with one decimal', () => {
    const d: DeviceProfileDraft = { ...blankProfileDraft('x'), onlineRule: 'UPLINK_WINDOW' };
    expect(profileDraftIssues(d).expectedIntervalS).toBe('expected_interval_required');
    expect(profileDraftIssues({ ...d, expectedIntervalS: 30 }).expectedIntervalS).toBe('out_of_range');
    expect(profileDraftIssues({ ...d, expectedIntervalS: 600 }).expectedIntervalS).toBeUndefined();
    expect(profileDraftIssues({ ...d, onlineRule: 'LAST_SEEN_ONLY' }).expectedIntervalS).toBeUndefined();
    expect(profileDraftIssues({ ...d, expectedIntervalS: 600, onlineWindowFactor: 1.4 }).onlineWindowFactor).toBe('out_of_range');
    expect(profileDraftIssues({ ...d, expectedIntervalS: 600, onlineWindowFactor: 10.5 }).onlineWindowFactor).toBe('out_of_range');
    expect(profileDraftIssues({ ...d, expectedIntervalS: 600, onlineWindowFactor: 2.25 }).onlineWindowFactor).toBe('out_of_range');
    expect(profileDraftIssues({ ...d, expectedIntervalS: 600, onlineWindowFactor: 2.5 }).onlineWindowFactor).toBeUndefined();
  });

  it('checks schemes, auth modes, caps, networks, limits and keys like the host', () => {
    const d: DeviceProfileDraft = { ...blankProfileDraft('x'), onlineRule: 'LIVE_SOCKET' };
    expect(profileDraftIssues(d)).toEqual({});
    expect(profileDraftIssues({ ...d, topicSchemes: [] }).topicSchemes).toBe('topic_scheme_required');
    expect(profileDraftIssues({ ...d, allowedAuthModes: [] }).allowedAuthModes).toBe('auth_mode_required');
    expect(profileDraftIssues({ ...d, rawMaxBytes: 8192, payloadMaxBytes: 4096 }).rawMaxBytes).toBe('raw_exceeds_payload');
    expect(profileDraftIssues({ ...d, maxTopicDepth: 17 }).maxTopicDepth).toBe('out_of_range');
    expect(profileDraftIssues({ ...d, rateLimits: { ...DEFAULT_RATE_LIMITS, csr: '1:0' } })['rateLimits.csr']).toBe('invalid_limit');
    expect(profileDraftIssues({ ...d, allowedNetworks: ['10.0.0.0/8', '2001:db8::/32', '192.0.2.7'] }).allowedNetworks).toBeUndefined();
    expect(profileDraftIssues({ ...d, allowedNetworks: ['::ffff:203.0.113.7'] }).allowedNetworks).toBe('invalid_network');
    for (const bad of ['10.0.0.0/33', '300.1.1.1', 'example.com', '10.0.0.0/08', '1::2::3']) expect(isNetwork(bad), bad).toBe(false);
    expect(profileDraftIssues({ ...d, telemetrySchema: [{ key: 'fw_version' }] }).telemetrySchema).toBe('invalid_key');
    expect(profileDraftIssues({ ...d, telemetrySchema: [{ key: 'a' }, { key: 'a' }] }).telemetrySchema).toBe('duplicate_key');
    expect(profileDraftIssues({ ...d, cfgSchema: [{ key: 'speed', type: 'integer' }] }).cfgSchema).toBe('invalid_key');
  });

  it('an edit sends only what changed (a rate-limit family on its own)', () => {
    const base = draftOf(profile());
    const draft = { ...base, name: 'Pumps 2', rateLimits: { ...base.rateLimits, csr: '2:3600' } };
    expect(profilePatch(base, draft)).toEqual({ name: 'Pumps 2', rateLimits: { csr: '2:3600' } });
    expect(profilePatch(base, base)).toEqual({});
  });
});

function RuleHarness({ transport, initial, onValue }: { transport: ProfileTransport; initial: OnlineRuleValue; onValue?: (v: OnlineRuleValue) => void }) {
  const [v, setV] = useState(initial);
  return <OnlineRuleField value={v} transport={transport} onChange={(n) => { setV(n); onValue?.(n); }} />;
}

describe('OnlineRuleField (OD-57, OD-63)', () => {
  it('starts with nothing chosen and disables the live connection for LoRaWAN with the reason', () => {
    render(<RuleHarness transport="LORAWAN" initial={{ onlineRule: null, expectedIntervalS: null, onlineWindowFactor: 3 }} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => !r.checked)).toBe(true);
    expect(screen.getByRole('radio', { name: /Live connection/ })).toBeDisabled();
    expect(screen.getByText('LoRaWAN devices have no live connection.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Expected interval/)).toBeNull();
  });

  it('shows the interval and the factor only for the window rule, with the offline hint', async () => {
    const user = userEvent.setup();
    render(<RuleHarness transport="HTTP" initial={{ onlineRule: null, expectedIntervalS: null, onlineWindowFactor: 3 }} />);
    await user.click(screen.getByRole('radio', { name: /Recent message/ }));
    await user.type(screen.getByLabelText(/Expected interval/), '600');
    expect(screen.getByText('Shown offline after 30 min without a message.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Factor/));
    await user.type(screen.getByLabelText(/^Factor/), '6');
    expect(screen.getByText('Shown offline after 1 h without a message.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Last seen only/ }));
    expect(screen.queryByLabelText(/Expected interval/)).toBeNull();
    expect(formatSeconds(86_400)).toBe('1 d');
  });

  it('keeps a chosen rule that the transport no longer allows and says why', () => {
    render(<RuleHarness transport="HTTP" initial={{ onlineRule: 'LIVE_SOCKET', expectedIntervalS: null, onlineWindowFactor: 3 }} />);
    expect((screen.getByRole('radio', { name: /Live connection/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('This transport cannot use the chosen online rule');
  });
});

describe('transport and auth pieces', () => {
  it('OD-163: MQTT basic is a username and a password, no client-ID-only mode; the last mode cannot be unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function H() { const [v, setV] = useState<ProfileAuthMode[]>(['ACCESS_TOKEN']); return <AuthModeSelector value={v} onChange={(n) => { setV(n); onChange(n); }} />; }
    render(<H />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByText('MQTT basic (username and password)')).toBeInTheDocument();
    expect(screen.queryByText(/client ID only/i)).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Access token/ })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /X\.509/ }));
    expect(onChange).toHaveBeenLastCalledWith(['ACCESS_TOKEN', 'X509_CERTIFICATE']);
  });

  it('OD-43: both topic schemes may be on, the last one cannot be unchecked; ThingsBoard says telemetry and attributes only', async () => {
    const user = userEvent.setup();
    function H() {
      const [v, setV] = useState({ topicSchemes: ['ROLTEK'] as Array<'ROLTEK' | 'TB'>, anyTopicEnabled: true, prefixKeysWithTopic: false, maxTopicDepth: 8, maxTopicLength: 128, maxDistinctTopicsPerDevice: 50, rawMaxBytes: 4096 });
      return <ProtocolMappingCard value={v} onChange={(p) => setV({ ...v, ...p })} />;
    }
    render(<H />);
    expect(screen.getByRole('checkbox', { name: /Roltek default/ })).toBeDisabled();
    expect(screen.getByText(/no RPC, claiming, provisioning or gateway API/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /ThingsBoard compatible/ }));
    expect(screen.getByText(/old and new firmware can share this profile/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Roltek default/ })).toBeEnabled();
    expect((screen.getByLabelText(/Max topic depth/) as HTMLInputElement).value).toBe('8');
    expect((screen.getByLabelText(/Max raw payload/) as HTMLInputElement).value).toBe('4096');
  });

  it('the rate-limit editor writes the protocol notation and keeps an invalid family as typed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function H() { const [v, setV] = useState<ProfileRateLimits>({ ...DEFAULT_RATE_LIMITS }); return <RateLimitEditor value={v} onChange={(n) => { setV(n); onChange(n); }} />; }
    render(<H />);
    const count = screen.getByLabelText('Certificate requests: Count 1');
    await user.clear(count);
    await user.type(count, '2');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ csr: '2:3600' }));
    await user.click(screen.getByRole('button', { name: 'Add a window (Connects)' }));
    expect(onChange.mock.calls.at(-1)![0].connects).toBe('6:60,:3600');
    expect(parseLimitString(onChange.mock.calls.at(-1)![0].connects)).toBeNull();
    await user.type(screen.getByLabelText('Connects: Count 2'), '30');
    expect(onChange.mock.calls.at(-1)![0].connects).toBe('6:60,30:3600');
  });

  it('schema tables: read-only from firmware, enum parsing, a bad key marked', () => {
    const { container } = render(<TelemetryKeySchemaTable value={[{ key: 'temperature', unit: '°C' }]} fromFirmware="roltek-esp32 1.8.2" />);
    expect(screen.getByText('From firmware roltek-esp32 1.8.2')).toBeInTheDocument();
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(parseCfgEnum('1, 2, x', 'integer')).toEqual([1, 2]);
    expect(parseCfgEnum('true,maybe', 'boolean')).toEqual([true]);
    expect(parseCfgEnum('', 'string')).toBeUndefined();
    render(<CfgSchemaTable value={[{ key: 'speed', type: 'integer' }]} onChange={() => undefined} />);
    expect(screen.getByLabelText('Key 1')).toHaveAttribute('aria-invalid', 'true');
  });

  it('schema tables are the kit DataTable: typed keys keep their row, rows are added and removed, empty says so', async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    function Cfg() {
      const [v, setV] = useState<Parameters<typeof CfgSchemaTable>[0]['value']>([{ key: 'cfg.a', type: 'integer' }]);
      return <CfgSchemaTable value={v} onChange={(n) => { seen.push(n); setV(n); }} />;
    }
    const { unmount } = render(<Cfg />);
    const table = screen.getByRole('table', { name: 'Configuration keys' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Key', 'Type', 'Label', 'Min / Max', 'Allowed values', 'Secret (write-only)', 'Actions']);
    const key = screen.getByLabelText('Key 1');
    await user.clear(key);
    await user.type(key, 'cfg.speed');
    expect(screen.getByLabelText('Key 1')).toBe(key);
    expect(key).toHaveFocus();
    expect(seen.at(-1)).toEqual([{ key: 'cfg.speed', type: 'integer' }]);
    await user.type(screen.getByLabelText('Allowed values cfg.speed'), '1, 2,');
    expect(screen.getByLabelText('Allowed values cfg.speed')).toHaveValue('1, 2,');
    expect(seen.at(-1)).toEqual([{ key: 'cfg.speed', type: 'integer', enum: [1, 2] }]);
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect(screen.getByLabelText('Key 2')).toHaveValue('cfg.');
    await user.click(screen.getByRole('button', { name: 'Remove cfg.speed' }));
    expect(seen.at(-1)).toEqual([{ key: 'cfg.', type: 'integer' }]);
    expect(screen.getByLabelText('Key 1')).toHaveValue('cfg.');
    unmount();

    const onChange = vi.fn();
    render(<TelemetryKeySchemaTable value={[]} onChange={onChange} />);
    const tele = screen.getByRole('table', { name: 'Telemetry keys' });
    expect(within(tele).getByText('No keys yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect(onChange).toHaveBeenLastCalledWith([{ key: '' }]);
  });

  it('provisioning keys are a disabled placeholder without the host: no key, no secret, no button', () => {
    render(<ProvisioningSettingsCard strategy="DISABLED" />);
    const box = screen.getByTestId('provisioning-keys-placeholder');
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(within(box).queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Provisioning strategy')).toBeDisabled();
    expect(screen.getByRole('option', { name: /Allow creating new devices \(not available yet\)/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Roltek factory/ })).toBeNull();
  });
});

function profilesAdapter(over: Partial<NonNullable<IotAdapter['profiles']>> = {}, store = [profile({ isDefault: true }), profile({ profileId: 'p2', name: 'Meters', transportType: 'HTTP', onlineRule: 'UPLINK_WINDOW', expectedIntervalS: 600 })]): IotAdapter {
  return {
    profiles: {
      transports: ['MQTT', 'HTTP', 'ANY', 'LORAWAN'],
      options: async () => store.map((p) => ({ id: p.profileId, name: p.name })),
      list: async (q) => ({ items: store.filter((p) => !q.transportType || p.transportType === q.transportType), total: store.length }),
      get: async (id) => structuredClone(store.find((p) => p.profileId === id)!),
      create: vi.fn(async (input) => profile({ ...input, profileId: 'p9' } as Partial<DeviceProfile>)),
      update: vi.fn(async (id, patch) => ({ ...store.find((p) => p.profileId === id)!, ...patch } as DeviceProfile)),
      remove: vi.fn(async () => { throw new IotApiError('conflict', 'The device profile is still in use by 2 devices (iot_device).'); }),
      setDefault: vi.fn(async (id) => ({ ...store.find((p) => p.profileId === id)!, isDefault: true })),
      usage: async (ids) => Object.fromEntries(ids.map((id) => [id, { devices: id === 'p1' ? 12 : 0, references: id === 'p1' ? [{ moduleId: 'iot_device', count: 12, label: 'devices' }] : [] }])),
      ...over,
    },
  };
}

describe('NewDeviceProfileDrawer (OD-63)', () => {
  it.each(['MQTT', 'HTTP', 'LORAWAN'] as ProfileTransport[])('keeps Create disabled until a rule is chosen (%s), and the transport never picks one', async (transport) => {
    const user = userEvent.setup();
    const adapter = profilesAdapter();
    render(<Wrap adapter={adapter}><NewDeviceProfileDrawer open onClose={() => undefined} /></Wrap>);
    await user.type(screen.getByLabelText(/^Name/), 'Boilers');
    await user.selectOptions(screen.getByLabelText('Transport'), transport);
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).every((r) => !r.checked)).toBe(true);
    expect(screen.getByText('Choose how this profile decides online.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Last seen only/ }));
    await user.selectOptions(screen.getByLabelText('Transport'), 'ANY');
    expect((screen.getByRole('radio', { name: /Last seen only/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    await waitFor(() => expect(adapter.profiles!.create).toHaveBeenCalledWith({ name: 'Boilers', description: null, transportType: 'ANY', onlineRule: 'LAST_SEEN_ONLY' }));
  });
});

describe('DeviceProfileEditorView', () => {
  it('saves only the changed fields, and blocks a transport the stored rule cannot serve until another rule is picked', async () => {
    const user = userEvent.setup();
    const adapter = profilesAdapter();
    render(<Wrap adapter={adapter}><DeviceProfileEditorView profileId="p1" extraTabs={[{ id: 'alarm-rules', label: 'Alarm rules', content: <p>rules</p> }]} /></Wrap>);
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['General', 'Transport & auth', 'Online status', 'Limits', 'Telemetry keys', 'Configuration keys', 'Provisioning', 'Alarm rules']);
    await user.click(screen.getByRole('tab', { name: /Transport & auth/ }));
    await user.selectOptions(screen.getByLabelText('Transport'), 'LORAWAN');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: /Online status/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('This transport cannot use the chosen online rule');
    await user.click(screen.getByRole('radio', { name: /Last seen only/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalledWith('p1', { transportType: 'LORAWAN', onlineRule: 'LAST_SEEN_ONLY' }));
  });

  it('shows the host\'s refusal as it comes', async () => {
    const user = userEvent.setup();
    const adapter = profilesAdapter({ update: vi.fn(async () => { throw new IotApiError('validation', 'The chosen online rule cannot be used with this transport (online_rule_not_allowed).'); }) });
    render(<Wrap adapter={adapter}><DeviceProfileEditorView profileId="p1" /></Wrap>);
    await user.clear(await screen.findByLabelText(/^Name/));
    await user.type(screen.getByLabelText(/^Name/), 'Pumps B');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/online_rule_not_allowed/)).toBeInTheDocument();
  });

  it('is read-only without canManageProfiles and never offers delete for the default profile', async () => {
    const adapter = profilesAdapter();
    const { unmount } = render(<Wrap adapter={adapter} caps={{}}><DeviceProfileEditorView profileId="p1" /></Wrap>);
    expect(await screen.findByLabelText(/^Name/)).toBeDisabled();
    expect(screen.getByText('You can view this profile but not change it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete profile/ })).toBeNull();
    unmount();
    render(<Wrap adapter={adapter}><DeviceProfileEditorView profileId="p1" /></Wrap>);
    expect(await screen.findByRole('button', { name: /Delete profile/ })).toBeDisabled();
    expect(screen.getAllByText('12 devices').length).toBeGreaterThan(0);
  });
});

describe('DeviceProfileListView', () => {
  it('lists with device counts, filters through the adapter, makes a profile the default and shows a refused delete', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const adapter = profilesAdapter();
    const list = vi.spyOn(adapter.profiles!, 'list');
    render(<IotAdapterProvider adapter={adapter} capabilities={ALL} notify={notify}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></IotAdapterProvider>);
    const row = (await screen.findByText('Meters')).closest('tr')!;
    await waitFor(() => expect(within(screen.getByText('Pumps').closest('tr')!).getByText('12')).toBeInTheDocument());
    await user.click(within(row).getByRole('button', { name: 'Make default' }));
    await waitFor(() => expect(adapter.profiles!.setDefault).toHaveBeenCalledWith('p2'));
    await user.click(within(row).getByRole('button', { name: 'Delete Meters' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'error', message: 'The device profile is still in use by 2 devices (iot_device).' }));
    expect(within(screen.getByText('Pumps').closest('tr')!).getByRole('button', { name: /Delete Pumps/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Transport'), 'HTTP');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ transportType: 'HTTP', page: 1 }), expect.anything()));
    await user.click(within(screen.getByRole('columnheader', { name: /Updated/ })).getByRole('button'));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: { key: 'updated', dir: 'asc' }, transportType: 'HTTP' }), expect.anything()));
    expect(screen.queryByRole('columnheader', { name: /Devices/ })).not.toHaveAttribute('aria-sort');
  });

  it('offers no create, default or delete without canManageProfiles', async () => {
    render(<Wrap adapter={profilesAdapter()} caps={{}}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></Wrap>);
    await screen.findByText('Meters');
    expect(screen.queryByRole('button', { name: /New profile/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make default' })).toBeNull();
  });
});
