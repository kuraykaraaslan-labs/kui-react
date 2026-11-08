import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ConfirmHost, cancelAllConfirms } from '@/modules/ui/ConfirmDialog';
import {
  SnmpMappingEditor, SnmpMappingRefused, SnmpMappingView, SnmpTestPollPanel, SnmpTestPollRetry, expectedKeys, isNumericOid, mappedPreview, parseOidList,
  rowFromVarbind, snmpMappingIssues, suggestKey, tableKeyPreview,
} from '.';
import type { SnmpMapping, SnmpTestPollResult } from '.';
import { failureText, mergeSnmpMessages } from './messages';

afterEach(() => { cancelAllConfirms(); cleanup(); });

const UPS: SnmpMapping = {
  timeoutMs: 2000, retries: 1, maxRepetitions: 10,
  mapping: [
    { oid: '1.3.6.1.2.1.1.1.0', key: 'sys.descr', kind: 'attribute', type: 'auto' },
    { oid: '1.3.6.1.2.1.33.1.2.4.0', key: 'battery.charge', kind: 'telemetry', type: 'gauge', unit: '%' },
    { oid: '1.3.6.1.2.1.33.1.3.3.1.3.1', key: 'input.voltage', type: 'gauge', scale: 0.1, unit: 'V' },
  ],
  tables: [{ name: 'ifTable', indexBy: '1.3.6.1.2.1.31.1.1.1.1', maxRows: 48, columns: [{ oid: '1.3.6.1.2.1.31.1.1.1.6', key: 'if.in_bps', rate: true, scale: 8 }] }],
  traps: [],
};

describe('SNMP mapping helpers (kui-react iot 11.3)', () => {
  it('takes numeric OIDs only and judges the block as NB does', () => {
    expect(isNumericOid('.1.3.6.1.2.1.1.3.0')).toBe(true);
    expect(isNumericOid('sysUpTime.0')).toBe(false);
    expect(isNumericOid('1.40.1')).toBe(false);
    const issues = snmpMappingIssues({ mapping: [{ oid: 'x', key: '1bad' }, { oid: '1.3.6.1', key: 'a', type: 'string', rate: true }, { oid: '1.3.6.1', key: 'a', type: 'enum' }] });
    expect(issues).toEqual(expect.arrayContaining([
      { path: 'mapping.0.oid', message: 'invalid_oid' }, { path: 'mapping.0.key', message: 'invalid_key' },
      { path: 'mapping.1.rate', message: 'rate_needs_counter' }, { path: 'mapping.2.enumMap', message: 'enum_map_required' },
      { path: 'mapping.2.key', message: 'duplicate_key' }, { path: 'mapping.2.oid', message: 'duplicate_oid' },
    ]));
    expect(snmpMappingIssues(UPS)).toEqual([]);
  });
  it('counts the keys a block can produce and previews table keys', () => {
    expect(expectedKeys(UPS)).toEqual({ telemetry: 2 + 48, attributes: 1 });
    expect(tableKeyPreview(UPS.tables![0])).toEqual(['if.in_bps.eth0']);
    expect(tableKeyPreview({ columns: [{ oid: '1.3.6.1.2.1.2.2.1.10', key: 'if.in' }] })).toEqual(['if.in.1']);
    const big: SnmpMapping = { tables: [{ maxRows: 48, columns: Array.from({ length: 5 }, (_, i) => ({ oid: `1.3.6.1.2.1.2.2.1.${i + 10}`, key: `c${i}` })) }] };
    expect(snmpMappingIssues(big)).toContainEqual({ path: 'tables', message: 'too_many_keys' });
  });
  it('suggests rows from a test poll and previews the scaled value', () => {
    expect(suggestKey('1.3.6.1.2.1.1.3.0')).toBe('uptime');
    expect(suggestKey('1.3.6.1.4.1.9.1', new Set(['oid_1_3_6_1_4_1_9_1']))).toBe('oid_1_3_6_1_4_1_9_1_2');
    expect(rowFromVarbind({ oid: '1.3.6.1.2.1.2.2.1.10.1', type: 'counter32', value: 5 }, new Set())).toMatchObject({ type: 'counter32', rate: true, kind: 'telemetry' });
    expect(rowFromVarbind({ oid: '1.3.6.1.2.1.1.5.0', type: 'octets', value: 'ups1' }, new Set())).toMatchObject({ key: 'sys.name', kind: 'attribute', type: 'string' });
    expect(mappedPreview(UPS.mapping![2], { oid: '1.3.6.1.2.1.33.1.3.3.1.3.1', type: 'integer', value: 2353 })).toEqual({ key: 'input.voltage', value: 235.3 });
    expect(mappedPreview({ oid: '1', key: 'up', type: 'timeticks' }, { oid: '1', type: 'timeticks', value: 12345 })).toEqual({ key: 'up', value: 123.45 });
    expect(mappedPreview({ oid: '1', key: 'r', rate: true }, { oid: '1', type: 'counter32', value: 1 })).toEqual({ key: 'r', value: null, rate: true });
    expect(parseOidList('1.3.6.1.2.1.1.1.0, sysName.0\n.1.3.6.1.2.1.1.1.0')).toEqual({ oids: ['1.3.6.1.2.1.1.1.0'], bad: ['sysName.0'], capped: false });
    expect(parseOidList(Array.from({ length: 70 }, (_, i) => `1.3.6.${i}`).join('\n')).capped).toBe(true);
  });
});

describe('SnmpMappingEditor', () => {
  it('lists values, tables and traps on DataTables and warns above the key limit', () => {
    const { rerender } = render(<SnmpMappingEditor value={UPS} onChange={() => undefined} template="snmp-ups-rfc1628 v1" />);
    expect(screen.getByText('battery.charge')).toBeTruthy();
    expect(screen.getByText('ifTable')).toBeTruthy();
    expect(screen.getByText(/snmp-ups-rfc1628 v1/)).toBeTruthy();
    expect(screen.getByTestId('snmp-key-count').textContent).toMatch(/up to 50 telemetry keys and 1 attributes/);
    rerender(<SnmpMappingEditor value={{ ...UPS, tables: [{ ...UPS.tables![0], maxRows: 256 }] }} onChange={() => undefined} />);
    expect(screen.getByTestId('snmp-key-count').textContent).toMatch(/258 telemetry keys .* above the limit of 200/);
  });
  it('adds a value through its drawer, refusing a bad OID until it is fixed', () => {
    const onChange = vi.fn();
    render(<SnmpMappingEditor value={UPS} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add value'));
    const dialog = screen.getByRole('dialog', { name: 'Add a value' });
    fireEvent.change(within(dialog).getByLabelText(/^OID/), { target: { value: 'upsBatteryStatus.0' } });
    fireEvent.change(within(dialog).getByLabelText(/^Key/), { target: { value: 'battery.status' } });
    expect(within(dialog).getByText('Not a numeric OID.')).toBeTruthy();
    expect((within(dialog).getByText('Done').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^OID/), { target: { value: '.1.3.6.1.2.1.33.1.2.1.0' } });
    fireEvent.click(within(dialog).getByText('Done'));
    expect(onChange.mock.calls[0][0].mapping[3]).toMatchObject({ oid: '1.3.6.1.2.1.33.1.2.1.0', key: 'battery.status' });
  });
  it('shows the server\'s refusal on the row it names', () => {
    render(<SnmpMappingEditor value={UPS} onChange={() => undefined} serverIssues={[{ path: 'mapping.1.key', message: 'duplicate_key' }]} />);
    fireEvent.click(screen.getByText('battery.charge'));
    expect(within(screen.getByRole('dialog')).getByText('Another row uses this key.')).toBeTruthy();
  });
  it('removes a row only after the ConfirmDialog says yes', async () => {
    const onChange = vi.fn();
    render(<><ConfirmHost /><SnmpMappingEditor value={UPS} onChange={onChange} /></>);
    fireEvent.click(screen.getByText('battery.charge'));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Value battery.charge/ })).getByText('Remove'));
    const confirm = await screen.findByRole('dialog', { name: 'Remove the value battery.charge?' });
    await act(async () => { fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' })); });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].mapping.map((r: { key: string }) => r.key)).toEqual(['sys.descr', 'input.voltage']);
  });
  it('edits a table\'s columns in the same drawer (no drawer over a drawer)', () => {
    const onChange = vi.fn();
    render(<SnmpMappingEditor value={UPS} onChange={onChange} />);
    fireEvent.click(screen.getByText('ifTable'));
    expect(screen.getByText(/Keys look like if.in_bps.eth0/)).toBeTruthy();
    fireEvent.click(screen.getByText('Add column'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const dialog = screen.getByRole('dialog', { name: 'Add a column' });
    fireEvent.change(within(dialog).getByLabelText(/^Column OID/), { target: { value: '1.3.6.1.2.1.31.1.1.1.10' } });
    fireEvent.change(within(dialog).getByLabelText(/^Key/), { target: { value: 'if.out_bps' } });
    fireEvent.click(within(dialog).getByText('Done'));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Table ifTable/ })).getByText('Done'));
    expect(onChange.mock.calls[0][0].tables[0].columns.map((c: { key: string }) => c.key)).toEqual(['if.in_bps', 'if.out_bps']);
  });
  it('is read-only without onChange', () => {
    render(<SnmpMappingEditor value={UPS} readOnly />);
    expect(screen.queryByText('Add value')).toBeNull();
    expect(screen.getByText(/You can view this mapping/)).toBeTruthy();
  });
});

const ANSWER: SnmpTestPollResult = {
  ok: true, failure: null, durationMs: 42,
  varbinds: [
    { oid: '1.3.6.1.2.1.33.1.3.3.1.3.1', type: 'integer', value: 2353 },
    { oid: '1.3.6.1.2.1.1.5.0', type: 'octets', value: 'ups1' },
    { oid: '1.3.6.1.2.1.1.9.0', type: 'noSuchObject', value: null, error: 'noSuchObject' },
  ],
};

describe('SnmpTestPollPanel (kui-react iot 11.4)', () => {
  it('polls the system group by default and shows type, raw value, mapped key with the scaled value and per-OID errors', async () => {
    const onPoll = vi.fn().mockResolvedValue(ANSWER);
    const onAdd = vi.fn();
    render(<SnmpTestPollPanel devices={[{ deviceId: 'd1', name: 'UPS 1', endpointName: 'ups', version: 'v3' }]} onPoll={onPoll} mapping={UPS} onAdd={onAdd} />);
    expect(screen.getByTestId('snmp-no-mib').textContent).toMatch(/No MIB file is needed/);
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    expect(onPoll).toHaveBeenCalledWith('d1', ['1.3.6.1.2.1.1.1.0', '1.3.6.1.2.1.1.2.0', '1.3.6.1.2.1.1.3.0', '1.3.6.1.2.1.1.5.0']);
    expect(await screen.findByText('input.voltage')).toBeTruthy();
    expect(screen.getByText('235.3')).toBeTruthy();
    expect(screen.getByText('No such object')).toBeTruthy();
    expect(screen.getByTestId('snmp-duration').textContent).toMatch(/42 ms/);
  });
  it('refuses typed names, and shows the retry time of a rate limit', async () => {
    const onPoll = vi.fn().mockRejectedValue(new SnmpTestPollRetry(7));
    render(<SnmpTestPollPanel devices={[{ deviceId: 'd1', name: 'UPS 1' }]} onPoll={onPoll} />);
    fireEvent.change(screen.getByLabelText(/^OIDs/), { target: { value: 'sysName.0' } });
    expect(screen.getByText(/Not numeric OIDs: sysName.0/)).toBeTruthy();
    expect((screen.getByText('Run test poll').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^OIDs/), { target: { value: '1.3.6.1.2.1.1.5.0' } });
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    expect(await screen.findByText(/Try again in 7 s/)).toBeTruthy();
  });
  it('says there is no device to poll, and words a failed poll', async () => {
    const { unmount } = render(<SnmpTestPollPanel devices={[]} />);
    expect(screen.getByText(/No device of this profile is connected/)).toBeTruthy();
    unmount();
    render(<SnmpTestPollPanel devices={[{ deviceId: 'd1', name: 'UPS 1' }]} onPoll={async () => ({ ok: false, failure: 'auth_failed', durationMs: 2000, varbinds: [] })} />);
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    expect(await screen.findByText(/Authentication failed \(check user and keys\)/)).toBeTruthy();
  });
});

describe('SnmpTestPollPanel device choice (NB 41-ui-fixes/28 G1.28)', () => {
  it('takes the first ready device once the list arrives, clears the answer on another device and locks the choice while polling', async () => {
    let finish: (r: typeof ANSWER) => void = () => undefined;
    const onPoll = vi.fn(() => new Promise<typeof ANSWER>((res) => { finish = res; }));
    const devices = [{ deviceId: 'd0', name: 'Off', blocked: 'endpoint_disabled' }, { deviceId: 'd1', name: 'UPS 1' }, { deviceId: 'd2', name: 'UPS 2' }];
    const { rerender } = render(<SnmpTestPollPanel devices={[]} loading onPoll={onPoll} />);
    rerender(<SnmpTestPollPanel devices={devices} onPoll={onPoll} />);
    const combo = document.getElementById('snmp-test-device') as HTMLSelectElement;
    expect(combo.value).toBe('d1');
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    expect(onPoll).toHaveBeenCalledWith('d1', expect.any(Array));
    expect(combo.disabled).toBe(true);
    await act(async () => { finish(ANSWER); });
    expect(await screen.findByTestId('snmp-duration')).toBeTruthy();
    expect(combo.disabled).toBe(false);
    fireEvent.change(combo, { target: { value: 'd2' } });
    expect(screen.queryByTestId('snmp-duration')).toBeNull();
  });
  it('words the server\'s codes, and the old names of two of them', () => {
    const m = mergeSnmpMessages();
    expect(failureText(m, 'decrypt_failed')).toMatch(/could not decrypt/);
    expect(failureText(m, 'decryption_error')).toBe(failureText(m, 'decrypt_failed'));
    expect(failureText(m, 'port_not_allowed')).toBe(failureText(m, 'port_denied'));
    expect(failureText(m, 'priv_not_configured')).toMatch(/no encryption/);
    expect(failureText(m, 'zzz')).toBe('Failed (zzz).');
  });
});

describe('SnmpMappingView', () => {
  it('reports unsaved changes to the host and guards closing the page (NB 41-ui-fixes/28 G1.8)', async () => {
    const onDirtyChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SnmpMappingView value={UPS} onSave={onSave} devices={[{ deviceId: 'd1', name: 'UPS 1' }]} onPoll={async () => ANSWER} onDirtyChange={onDirtyChange} />);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByText('Test poll'));
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    const row = (await screen.findByText('ups1')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /actions|Add to mapping/i }));
    fireEvent.click(await screen.findByText('Add to mapping'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    fireEvent.click(screen.getByText('Discard'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('adds a test-poll row to the draft and saves it; a refusal marks the named row', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new SnmpMappingRefused([{ path: 'mapping.3.key', message: 'duplicate_key' }])).mockResolvedValue(undefined);
    render(<SnmpMappingView value={UPS} onSave={onSave} devices={[{ deviceId: 'd1', name: 'UPS 1' }]} onPoll={async () => ANSWER} />);
    fireEvent.click(screen.getByText('Test poll'));
    await act(async () => { fireEvent.click(screen.getByText('Run test poll')); });
    const row = (await screen.findByText('ups1')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /actions|Add to mapping/i }));
    fireEvent.click(await screen.findByText('Add to mapping'));
    expect(screen.getByText(/Added sys.name to the mapping/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Close/ }));
    await act(async () => { fireEvent.click(screen.getByText('Save')); });
    expect(onSave.mock.calls[0][0].mapping[3]).toMatchObject({ oid: '1.3.6.1.2.1.1.5.0', key: 'sys.name', kind: 'attribute' });
    expect(await screen.findByText(/The server refused the mapping/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Save')); });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
  it('is read-only without onSave', () => {
    render(<SnmpMappingView value={UPS} />);
    expect(screen.queryByText('Add value')).toBeNull();
  });
});
