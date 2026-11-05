import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  blankProfileDraft, cfgKeyIssues, draftOf, profileDraftIssues, telemetryKeyIssues, touchesAdmission, type DeviceProfile,
} from '../types/profile';
import { CfgSchemaTable, parseCfgEnum } from './CfgSchemaTable';
import { TelemetryKeySchemaTable, clean } from './TelemetryKeySchemaTable';
import { DeviceProfileEditorView } from './DeviceProfileEditorView';

/* NB 41-ui-fixes/20: the profile editor keeps what is stored, checks what the host checks and never overwrites or drops silently. */

const T0 = new Date('2026-10-24T12:00:00Z');
const profile = (over: Partial<DeviceProfile> = {}): DeviceProfile => ({
  ...blankProfileDraft(), profileId: 'p1', name: 'Pumps', description: null, isDefault: false, onlineRule: 'LIVE_SOCKET', createdAt: T0, updatedAt: T0, version: 4, ...over,
});
const ALL: Partial<IotCapabilities> = { canManageProfiles: true };

function adapterOf(store: DeviceProfile[], devices = 0, over: Partial<NonNullable<IotAdapter['profiles']>> = {}): IotAdapter {
  return {
    profiles: {
      options: async () => store.map((p) => ({ id: p.profileId, name: p.name })),
      get: vi.fn(async (id: string) => structuredClone(store.find((p) => p.profileId === id)!)),
      update: vi.fn(async (id: string, patch) => ({ ...store.find((p) => p.profileId === id)!, ...patch, version: 5 } as DeviceProfile)),
      remove: vi.fn(async () => undefined),
      setDefault: vi.fn(async (id: string) => ({ ...store.find((p) => p.profileId === id)!, isDefault: true, version: 5 })),
      usage: async (ids) => Object.fromEntries(ids.map((id) => [id, { devices, references: devices ? [{ moduleId: 'iot_device', count: devices, label: 'devices' }] : [] }])),
      ...over,
    },
  };
}

/** `caps` null: the provider asks the adapter. */
function renderEditor(adapter: IotAdapter, caps: Partial<IotCapabilities> | null = ALL, props: Partial<React.ComponentProps<typeof DeviceProfileEditorView>> = {}) {
  return render(<IotAdapterProvider adapter={adapter} capabilities={caps ?? undefined} locale="en-GB"><DeviceProfileEditorView profileId="p1" {...props} /></IotAdapterProvider>);
}

afterEach(() => cleanup());

describe('stored data is kept (1.1, 1.6)', () => {
  it('an edited telemetry row keeps its quantity and any field the table does not know', () => {
    const row = { key: 't', type: 'number' as const, unit: '', quantity: { id: 'temperature', version: '2' }, scale: 0.1 } as never;
    expect(clean({ ...(row as object), label: 'Temp' } as never)).toEqual({ key: 't', type: 'number', label: 'Temp', quantity: { id: 'temperature', version: '2' }, scale: 0.1 });
  });

  it('typing into a telemetry row keeps the stored quantity', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TelemetryKeySchemaTable value={[{ key: 'temp', quantity: { id: 'temperature', version: '1' } }]} onChange={onChange} />);
    await user.type(screen.getByLabelText('Unit temp'), 'C');
    expect(onChange).toHaveBeenLastCalledWith([{ key: 'temp', unit: 'C', quantity: { id: 'temperature', version: '1' } }]);
  });

  it('a value list that does not parse is kept as typed and refused, never dropped', () => {
    expect(parseCfgEnum('1, x', 'integer')).toEqual([1, 'x']);
    expect(parseCfgEnum('1.5', 'integer')).toEqual(['1.5']);
    expect(parseCfgEnum('true, maybe', 'boolean')).toEqual([true, 'maybe']);
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'boolean', enum: ['maybe'] }, 'cfgSchema.0.')).toEqual({ 'cfgSchema.0.enum': 'invalid_enum' });
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'boolean', enum: [true] }, 'cfgSchema.0.')).toEqual({});
  });

  it('the typed value text is dropped when the host replaces the table (Discard, Save)', async () => {
    const user = userEvent.setup();
    const first = [{ key: 'cfg.mode', type: 'integer' as const, enum: [1, 2] }];
    function Host({ value }: { value: typeof first }) {
      return <CfgSchemaTable value={value} onChange={() => undefined} />;
    }
    const { rerender } = render(<Host value={first} />);
    const input = screen.getByLabelText('Allowed values cfg.mode');
    await user.clear(input);
    await user.type(input, '1, 2,');
    expect(input).toHaveValue('1, 2,');
    rerender(<Host value={[{ key: 'cfg.mode', type: 'integer', enum: [7] }]} />);
    expect(screen.getByLabelText('Allowed values cfg.mode')).toHaveValue('7');
  });
});

describe('the client checks what the host checks (1.10)', () => {
  it('telemetry and cfg rows are checked by their full path', () => {
    expect(telemetryKeyIssues({ key: 't', decimals: 1.5 }, 'telemetrySchema.3.')).toEqual({ 'telemetrySchema.3.decimals': 'whole_number' });
    expect(telemetryKeyIssues({ key: 't', decimals: 11 }, 'x.')).toEqual({ 'x.decimals': 'out_of_range' });
    expect(telemetryKeyIssues({ key: 't', min: 5, max: 1 }, 'x.')).toEqual({ 'x.min': 'min_exceeds_max' });
    expect(telemetryKeyIssues({ key: 't', unit: 'u'.repeat(33) }, 'x.')).toEqual({ 'x.unit': 'too_long' });
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'integer', min: 1.5 }, 'x.')).toEqual({ 'x.min': 'whole_number' });
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'string', minLength: 9, maxLength: 3 }, 'x.')).toEqual({ 'x.minLength': 'min_exceeds_max' });
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'string', maxLength: 5000 }, 'x.')).toEqual({ 'x.maxLength': 'out_of_range' });
    expect(cfgKeyIssues({ key: 'cfg.a', type: 'string', enum: Array.from({ length: 101 }, (_, i) => String(i)) }, 'x.')).toEqual({ 'x.enum': 'too_many_values' });
    const d = { ...blankProfileDraft('x'), onlineRule: 'LIVE_SOCKET' as const, telemetrySchema: Array.from({ length: 501 }, (_, i) => ({ key: `k${i}` })) };
    expect(profileDraftIssues(d).telemetrySchema).toBe('too_many_keys');
  });

  it('a bad cell blocks Save, is marked on its tab and listed under the table', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile({ telemetrySchema: [{ key: 'temp' }] })]);
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Telemetry keys/ }));
    await user.type(screen.getByLabelText('Decimals temp'), '11');
    expect(screen.getByLabelText('Decimals temp')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/temp · Decimals: Out of the allowed range/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Telemetry keys.*\(has errors\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(adapter.profiles!.update).not.toHaveBeenCalled();
  });

  it('a host error on a cell (full path) lands on that cell and its tab, and clears once the field is edited (N3)', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile({ telemetrySchema: [{ key: 'temp' }] })], 0, {
      update: vi.fn(async () => { throw new IotApiError('validation', '', { fieldErrors: { 'telemetrySchema.0.unit': 'Not accepted by the host.' } }); }),
    });
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Telemetry keys/ }));
    await user.type(screen.getByLabelText('Unit temp'), 'C');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/temp · Unit: Not accepted by the host/)).toBeInTheDocument();
    expect(screen.getByLabelText('Unit temp')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('tab', { name: /Telemetry keys.*\(has errors\)/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Unit temp'), 'x');
    expect(screen.queryByText(/Not accepted by the host/)).toBeNull();
  });
});

describe('saving (1.3, 1.7, 1.9)', () => {
  it('admission fields of a profile devices use: asks first, naming the profile and the count; Cancel sends nothing', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile()], 1);
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Transport & auth/ }));
    await user.selectOptions(screen.getByLabelText('Transport'), 'MQTT');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Change how the devices of Pumps connect?')).toBeInTheDocument();
    expect(within(dialog).getByText(/In use by 1 device\. Live sessions that no longer qualify/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(adapter.profiles!.update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(await screen.findByRole('button', { name: 'Save and apply' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalledWith('p1', { transportType: 'MQTT' }, { expectedVersion: 4 }));
  });

  it('a count that could not be read is no reason to skip the question (NB 41-ui-fixes/20 C3)', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile()], 0, { usage: async () => { throw new Error('down'); } });
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Transport & auth/ }));
    await user.selectOptions(screen.getByLabelText('Transport'), 'MQTT');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Devices may use this profile: their count could not be read/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save and apply' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalled());
  });

  it('a host error named under its table and its cell is said once, on the cell (NB 41-ui-fixes/20 C2)', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile({ telemetrySchema: [{ key: 'temp' }] })], 0, {
      update: vi.fn(async () => { throw new IotApiError('validation', '', { fieldErrors: { telemetrySchema: 'Too big', 'telemetrySchema.0.unit': 'Too big' } }); }),
    });
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Telemetry keys/ }));
    await user.type(screen.getByLabelText('Unit temp'), 'C');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('temp · Unit: Too big')).toBeInTheDocument();
    expect(screen.queryByText('Too big')).toBeNull();
  });

  it('a change outside admission, or a profile no device uses, saves without asking', async () => {
    expect(touchesAdmission({ name: 'x', telemetrySchema: [] })).toBe(false);
    expect(touchesAdmission({ rateLimits: { connects: '1:60' } })).toBe(true);
    const user = userEvent.setup();
    const adapter = adapterOf([profile()], 0);
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Transport & auth/ }));
    await user.selectOptions(screen.getByLabelText('Transport'), 'MQTT');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a stale save offers to reload, and the reload puts the stored profile back', async () => {
    const user = userEvent.setup();
    const store = [profile()];
    const adapter = adapterOf(store, 0, { update: vi.fn(async () => { throw new IotApiError('stale', 'changed'); }) });
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.clear(screen.getByRole('textbox', { name: /Name/ }));
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Someone else saved this profile after you opened it/)).toBeInTheDocument();
    store[0] = profile({ name: 'Theirs', version: 9 });
    await user.click(screen.getByRole('button', { name: 'Reload profile' }));
    await screen.findByRole('heading', { name: /Theirs/ });
    expect(screen.queryByText(/Someone else saved/)).toBeNull();
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Theirs');
  });

  it('unsaved changes guard the page and are reported to the host', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderEditor(adapterOf([profile()]), ALL, { onDirtyChange });
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'x');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('Make default keeps the version the next edit starts from', async () => {
    const user = userEvent.setup();
    const adapter = adapterOf([profile()]);
    renderEditor(adapter);
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('button', { name: 'Make default' }));
    await screen.findByText('Default profile');
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adapter.profiles!.update).toHaveBeenCalledWith('p1', { name: 'Pumpsx' }, { expectedVersion: 5 }));
  });
});

describe('what the page says (1.4, 1.12, 1.13, 1.15, 1.16, 1.17, N1)', () => {
  it('settings the host does not enforce say so', async () => {
    const user = userEvent.setup();
    renderEditor(adapterOf([profile()]), ALL, { notEnforced: { strictKeys: true, cfgDriftPolicy: true } });
    await screen.findByRole('heading', { name: /Pumps/ });
    await user.click(screen.getByRole('tab', { name: /Telemetry keys/ }));
    expect(screen.getByText(/Off: unknown keys are stored and flagged\. Stored, but not enforced yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Configuration keys/ }));
    expect(screen.getByText('Stored, but not enforced yet: nothing applies this setting today.')).toBeInTheDocument();
  });

  it('capabilities that could not be read are unknown, with a retry, not "you can only view"', async () => {
    const user = userEvent.setup();
    let fail = true;
    const adapter = { ...adapterOf([profile()]), capabilities: vi.fn(async () => { if (fail) throw new Error('down'); return { canManageProfiles: true }; }) };
    renderEditor(adapter, null);
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(await screen.findByText(/What you may change here could not be read/)).toBeInTheDocument();
    expect(screen.queryByText('You can view this profile but not change it.')).toBeNull();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Name/ })).not.toBeDisabled());
    expect(screen.queryByText(/could not be read/)).toBeNull();
  });

  it('the read-only notice waits for the capabilities answer', async () => {
    let answer: (c: Partial<IotCapabilities>) => void = () => undefined;
    const adapter = { ...adapterOf([profile()]), capabilities: () => new Promise<Partial<IotCapabilities>>((res) => { answer = res; }) };
    renderEditor(adapter, null);
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(screen.queryByText('You can view this profile but not change it.')).toBeNull();
    answer({});
    expect(await screen.findByText('You can view this profile but not change it.')).toBeInTheDocument();
  });

  it('a platform template: tagged, never deleted, the reason readable; without the template capability read-only', async () => {
    renderEditor(adapterOf([profile({ platformTemplate: { key: 'roltek-m1', version: 3 } })]), { canManageProfiles: true, canManageTemplates: true });
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(screen.getByText('Platform template roltek-m1 v3')).toBeInTheDocument();
    const del = screen.getByRole('button', { name: 'Delete profile' });
    expect(del).toBeDisabled();
    expect(del).toHaveAccessibleDescription(/A platform template cannot be deleted/);
    cleanup();
    renderEditor(adapterOf([profile({ platformTemplate: { key: 'roltek-m1', version: 3 } })]), { canManageProfiles: true });
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(screen.getByText(/only members who manage platform templates can change it/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete profile' })).toBeNull();
  });

  it('a template copy shows its template', async () => {
    renderEditor(adapterOf([profile({ template: { key: 'roltek-m1', version: 2 } })]));
    expect(await screen.findByText('Template roltek-m1 v2')).toBeInTheDocument();
  });

  it('the device count reads in the plural rule of the locale, and times name their zone', async () => {
    renderEditor(adapterOf([profile()], 1));
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(await screen.findByText('1 device')).toBeInTheDocument();
    expect(screen.getAllByText(/2026.*(UTC|GMT)/).length).toBeGreaterThan(0);
  });

  it('the open tab follows the host (its URL)', async () => {
    const { rerender } = renderEditor(adapterOf([profile()]), ALL, { tab: 'limits' });
    await screen.findByRole('heading', { name: /Pumps/ });
    expect(screen.getByRole('tab', { name: /Limits/ })).toHaveAttribute('aria-selected', 'true');
    rerender(<IotAdapterProvider adapter={adapterOf([profile()])} capabilities={ALL} locale="en-GB"><DeviceProfileEditorView profileId="p1" tab="online" /></IotAdapterProvider>);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Online status/ })).toHaveAttribute('aria-selected', 'true'));
  });

  it('the draft of a stored profile leaves out its version and template marks', () => {
    const d = draftOf(profile({ platformTemplate: { key: 'k', version: 1 }, version: 3 }));
    expect('version' in d || 'platformTemplate' in d).toBe(false);
  });

  it('a delete of the default reads its reason to assistive tech', async () => {
    renderEditor(adapterOf([profile({ isDefault: true })]));
    await screen.findByRole('heading', { name: /Pumps/ });
    fireEvent.focus(screen.getByRole('button', { name: 'Delete profile' }));
    expect(screen.getByRole('button', { name: 'Delete profile' })).toHaveAccessibleDescription(/make another profile the default first/);
  });
});
