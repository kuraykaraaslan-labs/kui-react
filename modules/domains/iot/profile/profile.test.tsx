import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  blankProfileDraft, isNetwork, nextKeyOrigins, parseLimitString, profileDraftIssues, profilePatch, draftOf, telemetryKeyChanges, DEFAULT_RATE_LIMITS,
  type DeviceProfile, type DeviceProfileDraft, type ProfileAuthMode, type ProfileRateLimits, type ProfileTransport,
} from '../types/profile';
import { OnlineRuleField, formatSeconds, type OnlineRuleValue } from './OnlineRuleField';
import { AuthModeSelector } from './AuthModeSelector';
import { ProtocolMappingCard } from './ProtocolMappingCard';
import { TransportPolicyCard, type TransportPolicyValue } from './TransportPolicyCard';
import { RateLimitEditor } from './RateLimitEditor';
import { TelemetryKeySchemaTable } from './TelemetryKeySchemaTable';
import { CfgSchemaTable, parseCfgEnum } from './CfgSchemaTable';
import { ProvisioningSettingsCard } from './ProvisioningSettingsCard';
import { NewDeviceProfileDrawer } from './NewDeviceProfileDrawer';
import { DeviceProfileEditorView } from './DeviceProfileEditorView';
import { DeviceProfileListView } from './DeviceProfileListView';
import { PROFILE_KEYS_RENAMED_EVENT } from './profile-key-events';

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

describe('plaintext commands (OD-160, gateway 12 §10)', () => {
  it('a blank draft lists no command; the list mirrors the host: exact names, no wildcard, never sys.factory_reset, at most 32, no twice', () => {
    const d = blankProfileDraft('x');
    expect(d.plaintextRpcMethods).toEqual([]);
    expect(profileDraftIssues({ ...d, plaintextRpcMethods: ['fan.set', 'sys.info'] }).plaintextRpcMethods).toBeUndefined();
    for (const bad of ['fan.*', 'sys.factory_reset', 'a b', '']) expect(profileDraftIssues({ ...d, plaintextRpcMethods: [bad] }).plaintextRpcMethods, bad).toBe('invalid_method');
    expect(profileDraftIssues({ ...d, plaintextRpcMethods: ['a', 'a'] }).plaintextRpcMethods).toBe('duplicate_method');
    expect(profileDraftIssues({ ...d, plaintextRpcMethods: Array.from({ length: 33 }, (_, i) => `m${i}`) }).plaintextRpcMethods).toBe('too_many_methods');
  });

  it('the card asks for the list only when plain MQTT is allowed, and says firmware and settings never go in clear', async () => {
    const user = userEvent.setup();
    function Host({ start }: { start: TransportPolicyValue }) {
      const [v, setV] = useState(start);
      return <TransportPolicyCard value={v} onChange={(p) => setV((x) => ({ ...x, ...p }))} />;
    }
    const base: TransportPolicyValue = { transportType: 'MQTT', mqttTransport: 'TLS_REQUIRED', allowTokenInUrl: false, allowedNetworks: [], plaintextRpcMethods: [] };
    const { unmount } = render(<Host start={base} />);
    expect(screen.queryByLabelText('Commands allowed without TLS')).toBeNull();
    unmount();
    render(<Host start={{ ...base, mqttTransport: 'PLAINTEXT_ALLOWED' }} />);
    const input = screen.getByLabelText('Commands allowed without TLS');
    await user.type(input, 'fan.set{Enter}');
    expect(screen.getByText('fan.set')).toBeTruthy();
    expect(screen.getByText(/Firmware updates and device settings are never sent in clear/)).toBeTruthy();
  });

  it('draftOf copies the list (a profile from an older host without it gets none)', () => {
    const d = blankProfileDraft('x');
    const p = { ...d, profileId: 'p1', isDefault: false, createdAt: '', updatedAt: '' } as unknown as DeviceProfile;
    expect(draftOf({ ...p, plaintextRpcMethods: ['fan.set'] }).plaintextRpcMethods).toEqual(['fan.set']);
    expect(draftOf({ ...p, plaintextRpcMethods: undefined as unknown as string[] }).plaintextRpcMethods).toEqual([]);
  });
});

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
    await user.clear(screen.getByLabelText(/Expected interval/));
    await user.type(screen.getByLabelText(/Expected interval/), '600');
    expect(screen.getByText('Shown offline after 30 min without a message.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Factor/));
    await user.type(screen.getByLabelText(/^Factor/), '6');
    expect(screen.getByText('Shown offline after 1 h without a message.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Last seen only/ }));
    expect(screen.queryByLabelText(/Expected interval/)).toBeNull();
    expect(formatSeconds(86_400)).toBe('1 d');
  });

  it('UX-61/63: recommends the live connection while nothing is chosen, fills the shortest interval, and an out-of-range error names the range', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [v, setV] = useState<OnlineRuleValue>({ onlineRule: null, expectedIntervalS: null, onlineWindowFactor: 3 });
      const issues = profileDraftIssues({ ...blankProfileDraft('x'), ...v });
      return <OnlineRuleField value={v} transport="MQTT" onChange={setV} errors={{ expectedIntervalS: issues.expectedIntervalS ? 'Out of the allowed range.' : undefined }} />;
    }
    render(<Harness />);
    expect(screen.getByText('Devices that keep an MQTT connection open usually use Live connection.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Recent message/ }));
    expect(screen.getByLabelText(/Expected interval/)).toHaveValue(60);
    expect(screen.queryByText(/Devices that keep an MQTT connection/)).toBeNull();
    await user.clear(screen.getByLabelText(/Expected interval/));
    await user.type(screen.getByLabelText(/Expected interval/), '20');
    expect(screen.getByText('Out of the allowed range. Allowed: 60 to 604800')).toBeInTheDocument();
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
    expect(onChange).toHaveBeenLastCalledWith([{ key: '', type: 'number' }]);
  });

  it('UX-85: types read in words, a new row starts as a number, and a new row is not red before it is typed in or left', async () => {
    const user = userEvent.setup();
    function Tele() {
      const [v, setV] = useState<Parameters<typeof TelemetryKeySchemaTable>[0]['value']>([{ key: 'level' }]);
      return <TelemetryKeySchemaTable value={v} onChange={setV} error={profileDraftIssues({ ...blankProfileDraft('x'), telemetrySchema: v }).telemetrySchema ? 'A key is not valid.' : undefined} />;
    }
    render(<Tele />);
    const type = screen.getByLabelText('Type level') as HTMLSelectElement;
    expect([...type.options].map((o) => o.textContent)).toEqual(['Not set', 'Number', 'Whole number', 'Yes / no', 'Text', 'JSON']);
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect(screen.getByLabelText('Type 2')).toHaveValue('number');
    expect(screen.getByLabelText('Key 2')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('A key is not valid.')).toBeNull();
    await user.click(screen.getByLabelText('Key 2'));
    await user.tab();
    expect(screen.getByLabelText('Key 2')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A key is not valid.')).toBeInTheDocument();
    cleanup();
    // after a Save press every row is marked; an error that is not about a key row shows at once
    render(<TelemetryKeySchemaTable value={[{ key: 'level' }, { key: '', type: 'number' }]} onChange={() => undefined} error="A key is not valid." showAll />);
    expect(screen.getByLabelText('Key 2')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A key is not valid.')).toBeInTheDocument();
    cleanup();
    render(<TelemetryKeySchemaTable value={[{ key: 'level', decimals: 11 }]} onChange={() => undefined} error="0.decimals: Too big: expected number to be <=10" />);
    expect(screen.getByText('0.decimals: Too big: expected number to be <=10')).toBeInTheDocument();
    cleanup();
    render(<TelemetryKeySchemaTable value={[{ key: 'flag', type: 'boolean' }, { key: 'x' }]} readOnly />);
    expect(screen.getByRole('cell', { name: 'Yes / no' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Not set' })).toBeInTheDocument();
  });

  it('UX-11: a key renamed in place is a rename; a removal that shifts rows is never guessed into one', () => {
    expect(telemetryKeyChanges([{ key: 'temp' }, { key: 'level' }], [{ key: 'temperature' }, { key: 'level' }], [0, 1])).toEqual({ removed: ['temp'], renames: { temp: 'temperature' } });
    expect(telemetryKeyChanges([{ key: 'a' }, { key: 'b' }, { key: 'c' }], [{ key: 'b' }, { key: 'd' }], [1, -1])).toEqual({ removed: ['a', 'c'], renames: {} });
    expect(telemetryKeyChanges([{ key: 'a' }], [{ key: 'a' }, { key: 'b' }], [0, -1])).toEqual({ removed: [], renames: {} });
    // without the rows' origins nothing is taken for a rename
    expect(telemetryKeyChanges([{ key: 'temp' }], [{ key: 'temperature' }])).toEqual({ removed: ['temp'], renames: {} });
  });

  it('UX-11: rows are followed through removals and additions, so temp removed and hum renamed is hum → humidity', () => {
    const base = [{ key: 'temp' }, { key: 'hum' }];
    let rows = base;
    let origins = [0, 1];
    const step = (next: typeof rows) => { origins = nextKeyOrigins(rows, next, origins); rows = next; };
    step(rows.filter((_, i) => i !== 0)); // the temp row removed
    step(rows.map((k) => (k.key === 'hum' ? { key: 'humidity' } : k))); // hum renamed in place, now on row 0
    step([...rows, { key: 'x' }]); // a row added
    expect(origins).toEqual([1, -1]);
    expect(telemetryKeyChanges(base, rows, origins)).toEqual({ removed: ['temp', 'hum'], renames: { hum: 'humidity' } });
    // a table replaced at once loses every origin
    expect(nextKeyOrigins(rows, [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }], origins)).toEqual([-1, -1, -1, -1]);
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
  it.each(['MQTT', 'HTTP', 'LORAWAN'] as ProfileTransport[])('creates nothing until a rule is chosen (%s), says so only after Create, and the transport never picks one', async (transport) => {
    const user = userEvent.setup();
    const adapter = profilesAdapter();
    render(<Wrap adapter={adapter}><NewDeviceProfileDrawer open onClose={() => undefined} /></Wrap>);
    await user.type(screen.getByLabelText(/^Name/), 'Boilers');
    await user.selectOptions(screen.getByLabelText('Transport'), transport);
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).every((r) => !r.checked)).toBe(true);
    // UX-61: no red before anything was pressed, and Create is a button that says why when pressed
    expect(screen.queryByText('Choose how this profile decides online.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Create profile' }));
    expect(screen.getByText('Choose how this profile decides online.')).toBeInTheDocument();
    expect(adapter.profiles!.create).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(adapter.profiles!.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: /Online status/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('This transport cannot use the chosen online rule');
    await user.click(screen.getByRole('radio', { name: /Last seen only/ }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalledWith('p1', { transportType: 'LORAWAN', onlineRule: 'LAST_SEEN_ONLY' }));
  });

  it('a built-in profile (a protocol module\'s): marked, its delete disabled with the reason, its transport locked; other fields stay editable', async () => {
    const user = userEvent.setup();
    const adapter = profilesAdapter({}, [profile({ name: 'Hikvision (ISAPI)', builtinKey: 'isapi', transportType: 'MQTT' })]);
    render(<Wrap adapter={adapter}><DeviceProfileEditorView profileId="p1" /></Wrap>);
    await screen.findByRole('heading', { name: /Hikvision/ });
    expect(screen.getByText('Built-in profile')).toBeInTheDocument();
    const del = screen.getByRole('button', { name: 'Delete profile' });
    expect(del).toBeDisabled();
    expect(del.closest('span')).toHaveAttribute('title', expect.stringMatching(/comes with its protocol and cannot be deleted/));
    await user.click(screen.getByRole('tab', { name: /Transport & auth/ }));
    expect(screen.getByLabelText('Transport')).toBeDisabled();
    expect(screen.getByText(/A built-in profile keeps its transport/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /General/ }));
    expect(screen.getByRole('textbox', { name: /Name/ })).not.toBeDisabled();
  });

  it('UX-11: after a save that renamed a key in use, offers to update the rules to the new name, or keeps them and says what still reads it', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const keyUsage = vi.fn(async () => [{ moduleId: 'iot_alarm', label: 'alarm rules', count: 2, keys: ['temp'], canRename: true }]);
    const renameKeys = vi.fn(async () => [{ moduleId: 'iot_alarm', label: 'alarm rules', count: 2, keys: ['temp'], canRename: true }]);
    const store = [profile({ telemetrySchema: [{ key: 'temp' }, { key: 'level' }] })];
    const adapter = profilesAdapter({ keyUsage, renameKeys }, store);
    const { unmount } = render(<IotAdapterProvider adapter={adapter} capabilities={ALL} notify={notify}><DeviceProfileEditorView profileId="p1" tab="telemetry" /></IotAdapterProvider>);
    const key = await screen.findByLabelText('Key 1');
    await user.clear(key);
    await user.type(key, 'temperature');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Removed keys are still in use' });
    expect(keyUsage).toHaveBeenCalledWith('p1', ['temp']);
    expect(dialog).toHaveTextContent('2 alarm rules read temp.');
    expect(dialog).toHaveTextContent('temp → temperature');
    await user.click(within(dialog).getByRole('button', { name: 'Update them to the new names' }));
    await waitFor(() => expect(renameKeys).toHaveBeenCalledWith('p1', { temp: 'temperature' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'success', message: 'Updated to the new key names.' }));
    unmount();

    // removed without a new name: nothing to rewrite, a notice names what still reads it
    notify.mockClear();
    render(<IotAdapterProvider adapter={profilesAdapter({ keyUsage, renameKeys }, [profile({ telemetrySchema: [{ key: 'temp' }, { key: 'level' }] })])} capabilities={ALL} notify={notify}><DeviceProfileEditorView profileId="p1" tab="telemetry" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'Remove temp' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'info', message: 'Still reading removed keys: 2 alarm rules read temp. They never match again until they are edited.' }));
    expect(renameKeys).toHaveBeenCalledTimes(1);
  });

  it('UX-85: an untouched new key row says nothing until Save is pressed, then the row is marked and nothing is sent', async () => {
    const user = userEvent.setup();
    const adapter = profilesAdapter({}, [profile({ telemetrySchema: [{ key: 'level' }] })]);
    render(<Wrap adapter={adapter}><DeviceProfileEditorView profileId="p1" tab="telemetry" /></Wrap>);
    await screen.findByLabelText('Key 1');
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect(screen.queryByText('Fix the marked fields before saving.')).toBeNull();
    expect(screen.getByLabelText('Key 2')).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByLabelText('Key 2')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Fix the marked fields before saving.')).toBeInTheDocument();
    expect(adapter.profiles!.update).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Key 2'), 'flow');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalledWith('p1', { telemetrySchema: [{ key: 'level' }, { key: 'flow', type: 'number' }] }));
  });

  it('UX-11: the rename reaches a mounted Alarm rules tab; a removal the host cannot be asked about gets a warning', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const heard = vi.fn();
    window.addEventListener(PROFILE_KEYS_RENAMED_EVENT, heard);
    const keyUsage = vi.fn(async () => [{ moduleId: 'iot_alarm', label: 'alarm rules', count: 1, keys: ['temp'], canRename: true }]);
    const renameKeys = vi.fn(async () => []);
    const { unmount } = render(<IotAdapterProvider adapter={profilesAdapter({ keyUsage, renameKeys }, [profile({ telemetrySchema: [{ key: 'hum' }, { key: 'temp' }] })])} capabilities={ALL} notify={notify}><DeviceProfileEditorView profileId="p1" tab="telemetry" /></IotAdapterProvider>);
    // hum removed, then temp (now row 1) renamed: the rename is temp → temperature, never hum → temperature
    await user.click(await screen.findByRole('button', { name: 'Remove hum' }));
    await user.clear(screen.getByLabelText('Key 1'));
    await user.type(screen.getByLabelText('Key 1'), 'temperature');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Removed keys are still in use' });
    expect(dialog).toHaveTextContent('temp → temperature');
    await user.click(within(dialog).getByRole('button', { name: 'Update them to the new names' }));
    await waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({ profileId: 'p1', renames: { temp: 'temperature' } });
    window.removeEventListener(PROFILE_KEYS_RENAMED_EVENT, heard);
    unmount();

    // the host cannot be asked (it failed, or more keys were removed than one question takes): the warning says so
    notify.mockClear();
    const failing = vi.fn(async () => { throw new IotApiError('validation', 'Validation error'); });
    render(<IotAdapterProvider adapter={profilesAdapter({ keyUsage: failing, renameKeys }, [profile({ telemetrySchema: [{ key: 'hum' }, { key: 'temp' }] })])} capabilities={ALL} notify={notify}><DeviceProfileEditorView profileId="p1" tab="telemetry" /></IotAdapterProvider>);
    await user.click(await screen.findByRole('button', { name: 'Remove hum' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'info', message: expect.stringContaining('the 1 removed keys could not be checked') }));
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

  it('a built-in profile is marked and cannot be deleted from the list (the reason on the button)', async () => {
    const adapter = profilesAdapter({}, [profile({ isDefault: true }), profile({ profileId: 'p3', name: 'Hikvision (ISAPI)', builtinKey: 'isapi' })]);
    render(<IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></IotAdapterProvider>);
    const row = (await screen.findByText('Hikvision (ISAPI)')).closest('tr')!;
    expect(within(row).getByText('Built-in')).toBeInTheDocument();
    const del = within(row).getByRole('button', { name: /Delete Hikvision/ });
    expect(del).toBeDisabled();
    expect(within(del).getByText(/comes with its protocol and cannot be deleted/)).toBeInTheDocument();
  });

  it('keeps a filter applied from page 2', async () => {
    const user = userEvent.setup();
    const adapter = profilesAdapter();
    const list = vi.spyOn(adapter.profiles!, 'list').mockImplementation(async (q) => ({ items: [profile({ isDefault: true, transportType: q.transportType ?? 'MQTT' })], total: 45 }));
    const onQueryChange = vi.fn();
    render(<IotAdapterProvider adapter={adapter} capabilities={ALL}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} onQueryChange={onQueryChange} /></IotAdapterProvider>);
    await screen.findByText('Pumps');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()));
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const panel = screen.getByRole('form', { name: 'Filters' });
    await user.selectOptions(within(panel).getByLabelText('Transport'), 'HTTP');
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ transportType: 'HTTP', page: 1 }), expect.anything()));
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ transportType: 'HTTP', page: 1 }));
    expect(screen.getByRole('button', { name: /Remove filter Transport/ })).toBeInTheDocument();
  });

  it('offers no create, default or delete without canManageProfiles', async () => {
    render(<Wrap adapter={profilesAdapter()} caps={{}}><DeviceProfileListView hrefs={{ profile: (id) => `#${id}` }} /></Wrap>);
    await screen.findByText('Meters');
    expect(screen.queryByRole('button', { name: /New profile/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make default' })).toBeNull();
  });
});
