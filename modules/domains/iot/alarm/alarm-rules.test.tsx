import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  alarmRuleIssues, leafValueIssue, describeCondition, isAlarmRuleKey, newInactivityRule, newThresholdRule, renameAlarmRuleKeys, undeclaredRuleKeys, type AlarmRuleDefinition, type AlarmRuleRecord, type ThresholdAlarmRule,
} from '../types/alarm-rule';
import { blankProfileDraft, type DeviceProfile } from '../types/profile';
import { announceProfileKeyRenames } from '../profile/profile-key-events';
import { AlarmRuleSetEditor, adoptRenamed, changedRuleCount, pendingRuleChanges, refusedRule, ruleSaveResult } from './AlarmRuleSetEditor';
import { formatRuleValue, isFormable, parseRuleValue } from './AlarmRuleDrawer';

const THRESHOLD: AlarmRuleDefinition = {
  type: 'high_temperature', title: 'Hot', enabled: true,
  severities: [{ severity: 'CRITICAL', condition: { key: 'temperature', op: '>', value: 95 } }, { severity: 'MAJOR', condition: { key: 'temperature', op: '>', value: 80, topic: 'sensors/hall-2' } }],
  debounce: { mode: 'count', raise: 3, clear: 3 }, notify: { recipients: [{ kind: 'role', role: 'ADMIN' }] },
};
const COMPOUND: AlarmRuleDefinition = {
  type: 'battery', title: 'Battery', enabled: true,
  severities: [{ severity: 'WARNING', condition: { any: [{ key: 'battery', op: '<', value: 20 }, { key: 'limit', op: '>', value: { attribute: 'max' } }] } }],
};

function setup(rules: AlarmRuleDefinition[], caps: Partial<IotCapabilities> = { canManageAlarmRules: true }, keys?: string[], refuse?: IotApiError) {
  const replace = vi.fn(async (_p: string, next: AlarmRuleDefinition[]) => {
    if (refuse) throw refuse;
    return next.map((definition) => ({ definition }));
  });
  const profile = { ...blankProfileDraft('Pumps'), profileId: 'p1', isDefault: false, telemetrySchema: (keys ?? []).map((key) => ({ key })) } as DeviceProfile;
  const adapter: IotAdapter = {
    alarmRules: { list: async () => rules.map((definition, i) => ({ ruleId: `r${i}`, definition })), replace },
    ...(keys ? { profiles: { options: async () => [], get: async () => profile } } : {}),
  };
  render(<IotAdapterProvider adapter={adapter} capabilities={caps}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
  return { replace };
}

describe('alarm rule helpers', () => {
  it('describes, parses and checks rules like the host', () => {
    expect(describeCondition(COMPOUND.severities[0].condition)).toBe('(battery < 20 or limit > attribute:max)');
    expect(describeCondition({ key: 'a', op: '==', value: 'on', topic: null })).toBe('a == "on" on v1/');
    expect(parseRuleValue('80')).toBe(80);
    expect(parseRuleValue('true')).toBe(true);
    expect(parseRuleValue('attribute:limit')).toEqual({ attribute: 'limit' });
    expect(parseRuleValue('open')).toBe('open');
    expect(formatRuleValue({ attribute: 'limit' })).toBe('attribute:limit');
    expect(isFormable(THRESHOLD)).toBe(true);
    expect(isFormable(COMPOUND)).toBe(false);
    expect(alarmRuleIssues(newThresholdRule('high_value'), [newThresholdRule('high_value')])).toContain('type_duplicate');
    expect(alarmRuleIssues({ ...newThresholdRule('x y'), title: ' ' })).toEqual(expect.arrayContaining(['type_invalid', 'title_required']));
    expect(alarmRuleIssues({ ...newInactivityRule(), inactivity: { afterSec: 5, severity: 'INFO' } })).toEqual(['after_out_of_range']);
  });

  it('UX-10: refuses a value or a spaced word as a key, and reports keys the profile does not declare without blocking', () => {
    const rule = (key: string): AlarmRuleDefinition => ({ ...newThresholdRule('t'), severities: [{ severity: 'MAJOR', condition: { key, op: '>', value: 4.8 } }] });
    expect(['5.3', '-1', 'room temp', '.5'].map((k) => isAlarmRuleKey(k))).toEqual([false, false, false, false]);
    expect(['temperature', 'rom.value', 'k_1', 'sensors/hall-2:t'].map((k) => isAlarmRuleKey(k))).toEqual([true, true, true, true]);
    expect(alarmRuleIssues(rule('5.3'))).toEqual(['key_invalid']);
    expect(alarmRuleIssues(rule('rom.value'))).toEqual([]);
    expect(undeclaredRuleKeys(rule('rom.value'), ['room.value', 'door'])).toEqual(['rom.value']);
    expect(undeclaredRuleKeys(rule('door'), ['room.value', 'door'])).toEqual([]);
    expect(undeclaredRuleKeys(rule('anything'), [])).toEqual([]);
    expect(undeclaredRuleKeys(COMPOUND, ['battery'])).toEqual(['limit']);
    expect(changedRuleCount([THRESHOLD, COMPOUND], [{ ...THRESHOLD, title: 'x' }, newInactivityRule()])).toBe(3);
  });

  it('takes a bare number as a key only when the profile declares it (a register number like 40001)', () => {
    const rule = (key: string): AlarmRuleDefinition => ({ ...newThresholdRule('t'), severities: [{ severity: 'MAJOR', condition: { key, op: '>', value: 1 } }] });
    expect(isAlarmRuleKey('40001', ['40001', 'door'])).toBe(true);
    expect(isAlarmRuleKey('40002', ['40001'])).toBe(false);
    expect(alarmRuleIssues(rule('40001'), [], ['40001'])).toEqual([]);
    expect(alarmRuleIssues(rule('40001'))).toEqual(['key_invalid']);
  });

  it('renames the keys of a rule like the host does, everything else as it was', () => {
    expect(renameAlarmRuleKeys(THRESHOLD, { temperature: 'temp_c' })).toEqual({
      ...THRESHOLD,
      severities: [{ severity: 'CRITICAL', condition: { key: 'temp_c', op: '>', value: 95 } }, { severity: 'MAJOR', condition: { key: 'temp_c', op: '>', value: 80, topic: 'sensors/hall-2' } }],
    });
    expect((renameAlarmRuleKeys(COMPOUND, { limit: 'max_level' }) as ThresholdAlarmRule).severities[0].condition).toEqual({ any: [{ key: 'battery', op: '<', value: 20 }, { key: 'max_level', op: '>', value: { attribute: 'max' } }] });
    expect(renameAlarmRuleKeys(newInactivityRule(), { temperature: 'x' })).toEqual(newInactivityRule());
  });
});

describe('alarm rule checks the host makes on write (NB 41-ui-fixes/24 1.6, 1.13)', () => {
  const leaf = (op: '>' | '==', value: unknown) => ({ key: 't', op, value } as Parameters<typeof leafValueIssue>[0]);
  it('wants a number for an ordering operator, with its own hint for a decimal comma', () => {
    expect(leafValueIssue(leaf('>', 80))).toBeNull();
    expect(leafValueIssue(leaf('>', '80.5'))).toBeNull();
    expect(leafValueIssue(leaf('>', '-1e3'))).toBeNull();
    expect(leafValueIssue(leaf('>', { attribute: 'limit' }))).toBeNull();
    expect(leafValueIssue(leaf('>', '80,5'))).toBe('value_comma');
    expect(leafValueIssue(leaf('>', '80 °C'))).toBe('value_not_number');
    expect(leafValueIssue(leaf('>', '8O'))).toBe('value_not_number');
    expect(leafValueIssue(leaf('>', true))).toBe('value_not_number');
    expect(leafValueIssue(leaf('==', 'open'))).toBeNull();
    expect(leafValueIssue(leaf('==', 'x'.repeat(257)))).toBe('value_too_long');
  });
  it('checks the type pattern, debounce, hysteresis, lengths and the clear condition like the host', () => {
    expect(alarmRuleIssues(newThresholdRule('_lead'))).toContain('type_invalid');
    expect(alarmRuleIssues(newThresholdRule('adc.hall-2:high'))).toEqual([]);
    expect(alarmRuleIssues({ ...newThresholdRule(), debounce: { mode: 'count', raise: 0, clear: 1 } })).toEqual(['debounce_out_of_range']);
    expect(alarmRuleIssues({ ...newThresholdRule(), debounce: { mode: 'count', raise: 1.5, clear: 1 } })).toEqual(['debounce_out_of_range']);
    expect(alarmRuleIssues({ ...newThresholdRule(), hysteresis: -1 })).toEqual(['hysteresis_out_of_range']);
    expect(alarmRuleIssues({ ...newThresholdRule(), title: 'x'.repeat(301) })).toEqual(['title_too_long']);
    expect(alarmRuleIssues({ ...newThresholdRule(), clear: { key: 'k'.repeat(129), op: '<', value: 1 } })).toEqual(['key_too_long']);
    expect(alarmRuleIssues({ ...newThresholdRule(), clear: { key: 'temperature', op: '<', value: '7O' } })).toEqual(['value_not_number']);
  });
  it('names the rule of an NB-shaped refusal (rules.N.*) and lists what a save removes or switches off', () => {
    const e = new IotApiError('validation', 'Validation error', { fieldErrors: { rules: 'With > the value must be a number.', 'rules.1.severities.0.condition.value': 'With > the value must be a number.' } });
    expect(refusedRule(e, [THRESHOLD, COMPOUND])).toEqual({ type: 'battery', detail: 'With > the value must be a number.' });
    expect(refusedRule(new IotApiError('unavailable', ''), [THRESHOLD])).toBeNull();
    expect(pendingRuleChanges([THRESHOLD, COMPOUND], [{ ...THRESHOLD, enabled: false }])).toEqual({ removed: ['battery'], disabled: ['high_temperature'] });
  });
});

describe('AlarmRuleSetEditor', () => {
  it('shows each rule\'s comparisons and saves the whole set after an edit, keeping fields the form does not draw', async () => {
    const user = userEvent.setup();
    const { replace } = setup([THRESHOLD]);
    expect(await screen.findByText('temperature > 95')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Alarm rules' })).getByText('temperature > 95')).toBeInTheDocument();
    expect(screen.getByText('temperature > 80 on sensors/hall-2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit high_temperature' }));
    const value = screen.getAllByLabelText('Value')[1];
    await user.clear(value);
    await user.type(value, '85');
    await user.click(screen.getByRole('button', { name: 'Update the list' }));
    expect(screen.getByText('Unsaved rule changes')).toBeInTheDocument();
    expect(screen.getByText('1 rule changed and not saved yet: nothing applies until you save.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const sent = replace.mock.calls[0][1][0] as typeof THRESHOLD;
    expect(sent.severities[1].condition).toEqual({ key: 'temperature', op: '>', value: 85, topic: 'sensors/hall-2' });
    expect(sent.notify).toEqual(THRESHOLD.notify);
  });

  it('adds the device-offline rule once, removes a rule and opens a combined rule as JSON', async () => {
    const user = userEvent.setup();
    const { replace } = setup([COMPOUND]);
    await screen.findByText('(battery < 20 or limit > attribute:max)');
    await user.click(screen.getByRole('button', { name: 'Edit battery' }));
    expect(screen.getByText(/combined conditions/)).toBeInTheDocument();
    expect(screen.getByLabelText('JSON')).toHaveValue(JSON.stringify(COMPOUND, null, 2));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Device offline rule' }));
    await user.click(screen.getByRole('button', { name: 'Add to list' }));
    expect(screen.getByRole('button', { name: 'Device offline rule' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove battery' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('p1', [newInactivityRule()], { expectedSet: [{ ruleId: 'r0', version: undefined }] }));
  });

  it('UX-8/10: offers the profile\'s keys, refuses a number as the key, warns about an unknown key and marks it in the list', async () => {
    const user = userEvent.setup();
    const { replace } = setup([], { canManageAlarmRules: true }, ['room.value', 'door']);
    await screen.findByText(/No alarm rules/);
    await user.click(screen.getByRole('button', { name: 'Threshold rule' }));
    const dialog = screen.getByRole('dialog', { name: 'Alarm rule' });
    const key = within(dialog).getByLabelText('Key');
    await waitFor(() => expect(key).toHaveAttribute('list'));
    const list = document.getElementById(key.getAttribute('list')!)!;
    expect([...list.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['room.value', 'door']);
    // the topic filter sits under Advanced, closed while it is empty
    expect(within(dialog).getByText('Advanced').closest('details')).not.toHaveAttribute('open');
    await user.clear(key);
    await user.type(key, '5.3');
    expect(within(dialog).getAllByText('A key names a telemetry key: no spaces and not a number.').length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Add to list' }));
    expect(screen.getByRole('dialog', { name: 'Alarm rule' })).toBeInTheDocument();
    await user.clear(key);
    await user.type(key, 'rom.value');
    expect(within(dialog).getByText('rom.value is not a telemetry key of this profile.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Not a telemetry key of this profile: rom.value/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add to list' }));
    expect(screen.queryByRole('dialog', { name: 'Alarm rule' })).toBeNull();
    expect(screen.getByText('Unknown key')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect((replace.mock.calls[0][1][0] as { severities: Array<{ condition: { key: string } }> }).severities[0].condition.key).toBe('rom.value');
  });

  it('UX-48/82: says how long the condition must hold in words and asks before a reload loses unsaved rules', async () => {
    const user = userEvent.setup();
    setup([THRESHOLD]);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByRole('button', { name: 'Edit high_temperature' }));
    expect(screen.getByLabelText('Raise after this many readings in a row')).toHaveValue(3);
    await user.selectOptions(screen.getByLabelText('Count in'), 'duration');
    expect(screen.getByLabelText('Raise when true for (seconds)')).toBeInTheDocument();
    expect(screen.getByText(/door open for 120 s/)).toBeInTheDocument();
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Update the list' }));
    const unsaved = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unsaved);
    expect(unsaved.defaultPrevented).toBe(true);
  });

  it('takes renamed keys from the profile editor into its rules and unsaved edits, so a save keeps the new names', async () => {
    const user = userEvent.setup();
    const replace = vi.fn(async (_p: string, next: AlarmRuleDefinition[], _o?: unknown) => next.map((definition) => ({ definition })));
    let reads = 0;
    // the host rewrote its rules onto the new key: the re-read answers them, each with a new version
    const list = async () => {
      reads += 1;
      const renamed: Record<string, string> = reads > 1 ? { temperature: 'temp_c' } : {};
      return [THRESHOLD, COMPOUND].map((d, i) => ({ ruleId: `r${i}`, version: reads, definition: renameAlarmRuleKeys(d, renamed) }));
    };
    render(<IotAdapterProvider adapter={{ alarmRules: { list, replace } }} capabilities={{ canManageAlarmRules: true }}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByRole('button', { name: 'Edit battery' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getAllByLabelText('Enabled')[1]);
    announceProfileKeyRenames({ profileId: 'other', renames: { temperature: 'nope' } });
    announceProfileKeyRenames({ profileId: 'p1', renames: { temperature: 'temp_c' } });
    expect(await screen.findByText('temp_c > 95')).toBeInTheDocument();
    expect(screen.getByText('1 rule changed and not saved yet: nothing applies until you save.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const sent = replace.mock.calls[0][1] as AlarmRuleDefinition[];
    expect(sent.map((r) => JSON.stringify(r)).join()).not.toContain('"temperature"');
    expect(sent[1].enabled).toBe(false);
    // the versions of the rewritten rules, so the rename alone never makes the save stale
    expect(replace.mock.calls[0][2]).toEqual({ expectedSet: [{ ruleId: 'r0', version: 2 }, { ruleId: 'r1', version: 2 }] });
  });

  it('after a rename takes a new version only for a rule that is exactly the one read, renamed; anything else is stale (1.1)', () => {
    const before = [{ ruleId: 'r1', version: 1, definition: THRESHOLD }, { ruleId: 'r2', version: 1, definition: COMPOUND }];
    const renames = { temperature: 'temp_c' };
    const renamed = before.map((r) => ({ ...r, version: 2, definition: renameAlarmRuleKeys(r.definition, renames) }));
    expect(adoptRenamed(before, renamed, renames)).toEqual(renamed);
    // someone changed a rule, added one, removed one or swapped an id meanwhile
    expect(adoptRenamed(before, [renamed[0], { ...renamed[1], definition: { ...renamed[1].definition, title: 'Theirs' } }], renames)).toBeNull();
    expect(adoptRenamed(before, [...renamed, { ruleId: 'r3', version: 1, definition: newInactivityRule() }], renames)).toBeNull();
    expect(adoptRenamed(before, [renamed[0]], renames)).toBeNull();
    expect(adoptRenamed(before, [renamed[0], { ...renamed[1], ruleId: 'r9' }], renames)).toBeNull();
  });

  it('a rename that finds the rules moved meanwhile makes the set stale: the edits stay, the save waits for a reload (1.1)', async () => {
    const user = userEvent.setup();
    const replace = vi.fn(async () => []);
    let reads = 0;
    const list = async () => {
      reads += 1;
      const first = [{ ruleId: 'r1', version: 1, definition: THRESHOLD }];
      // the re-read after the rename: rewritten, and a rule someone else added
      return reads === 1 ? first : [{ ruleId: 'r1', version: 2, definition: renameAlarmRuleKeys(THRESHOLD, { temperature: 'temp_c' }) }, { ruleId: 'r2', version: 1, definition: COMPOUND }];
    };
    render(<IotAdapterProvider adapter={{ alarmRules: { list, replace } }} capabilities={{ canManageAlarmRules: true }}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByLabelText('Enabled'));
    announceProfileKeyRenames({ profileId: 'p1', renames: { temperature: 'temp_c' } });
    expect(await screen.findByText(/Someone changed these alarm rules after you opened them/)).toBeInTheDocument();
    expect(screen.getByLabelText('Enabled')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDisabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('N5: a link to another page asks first while rules are unsaved; Stay keeps them, Leave follows the link', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    setup([THRESHOLD]);
    // a link of the host app (its router takes the click)
    const link = Object.assign(document.createElement('a'), { href: '/elsewhere', textContent: 'Elsewhere' });
    link.addEventListener('click', (e) => { e.preventDefault(); go(); });
    document.body.appendChild(link);
    onTestFinished(() => link.remove());
    await screen.findByText('temperature > 95');
    // nothing unsaved: the link is not asked about
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    expect(go).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByLabelText('Enabled'));
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    const ask = await screen.findByRole('dialog', { name: 'Leave without saving the rules?' });
    expect(within(ask).getByText('The alarm rules have unsaved changes. They are dropped if you leave now.')).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(go).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Unsaved rule changes')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Leave without saving the rules?' })).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(go).toHaveBeenCalledTimes(2));
  });

  it('a save that left open alarms to the host\'s clean-up says how many; a plain list answer leaves nothing', async () => {
    expect(ruleSaveResult([])).toEqual({ rules: [], resolvePending: 0 });
    expect(ruleSaveResult({ rules: [], resolvePending: 3 })).toEqual({ rules: [], resolvePending: 3 });
    const user = userEvent.setup();
    const replace = vi.fn(async (_p: string, next: AlarmRuleDefinition[]) => ({ rules: next.map((definition) => ({ ruleId: 'r1', version: 2, definition })), resolvePending: 1_200 }));
    render(<IotAdapterProvider adapter={{ alarmRules: { list: async () => [{ ruleId: 'r1', version: 1, definition: THRESHOLD }], replace } }} capabilities={{ canManageAlarmRules: true }} locale="en"><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByLabelText('Enabled'));
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(await screen.findByText('1,200 alarms of the removed or switched-off rules are still open: the daily clean-up resolves them.')).toBeInTheDocument();
  });

  it('names the rule the host refused instead of its position', async () => {
    const user = userEvent.setup();
    setup([THRESHOLD, COMPOUND], { canManageAlarmRules: true }, undefined,
      new IotApiError('validation', 'Validation error', { fieldErrors: { rules: '1.severities.0.condition.any.0.key: "5.3" is not a telemetry key' } }));
    await screen.findByText('temperature > 95');
    await user.click(screen.getAllByLabelText('Enabled')[0]);
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(await screen.findByText('The rule battery was refused: severities.0.condition.any.0.key: "5.3" is not a telemetry key')).toBeInTheDocument();
  });

  it('is read-only without canManageAlarmRules', async () => {
    setup([THRESHOLD], {});
    await screen.findByText('temperature > 95');
    expect(screen.getByText('You can view the rules but not change them.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Threshold rule' })).toBeNull();
  });

  it('1.1: sends the rules it read; a stale refusal keeps the edits and offers a reload', async () => {
    const user = userEvent.setup();
    const replace = vi.fn(async () => { throw new IotApiError('stale', 'changed'); });
    let reads = 0;
    const adapter: IotAdapter = {
      alarmRules: {
        list: async () => { reads += 1; return reads === 1 ? [{ ruleId: 'r1', version: 4, definition: THRESHOLD }] : [{ ruleId: 'r1', version: 5, definition: { ...THRESHOLD, title: 'Theirs' } }]; },
        replace,
      },
    };
    render(<IotAdapterProvider adapter={adapter} capabilities={{ canManageAlarmRules: true }}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByLabelText('Enabled'));
    expect(screen.getByText(/Switched off when you save: high_temperature\. Their open alarms are resolved/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('p1', [expect.objectContaining({ enabled: false })], { expectedSet: [{ ruleId: 'r1', version: 4 }] }));
    expect(await screen.findByText(/Someone changed these alarm rules after you opened them/)).toBeInTheDocument();
    // the edit is still there until the viewer reloads
    expect(screen.getByLabelText('Enabled')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save rules' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reload rules' }));
    expect(await screen.findByText('Theirs')).toBeInTheDocument();
    expect(screen.queryByText('Unsaved rule changes')).toBeNull();
  });

  it('5: Discard after a stale refusal reloads the rules, so the stale state never hides behind the old ones', async () => {
    const user = userEvent.setup();
    const replace = vi.fn(async (_p: string, _r: AlarmRuleDefinition[], _o?: unknown): Promise<AlarmRuleRecord[]> => { throw new IotApiError('stale', 'changed'); });
    let reads = 0;
    const list = async () => { reads += 1; return reads === 1 ? [{ ruleId: 'r1', version: 4, definition: THRESHOLD }] : [{ ruleId: 'r1', version: 5, definition: { ...THRESHOLD, title: 'Theirs' } }]; };
    render(<IotAdapterProvider adapter={{ alarmRules: { list, replace } }} capabilities={{ canManageAlarmRules: true }}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByLabelText('Enabled'));
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await screen.findByText(/Someone changed these alarm rules after you opened them/);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('Theirs')).toBeInTheDocument();
    expect(reads).toBe(2);
    expect(screen.queryByText('Unsaved rule changes')).toBeNull();
    // the next edit saves against the version read now
    await user.click(screen.getByLabelText('Enabled'));
    replace.mockImplementationOnce(async () => []);
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith('p1', expect.any(Array), { expectedSet: [{ ruleId: 'r1', version: 5 }] }));
  });

  it('1.5, 1.6: a saved rule keeps its type and a threshold that is not a number is refused with a hint', async () => {
    const user = userEvent.setup();
    setup([THRESHOLD]);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByRole('button', { name: 'Edit high_temperature' }));
    const dialog = screen.getByRole('dialog', { name: 'Alarm rule' });
    expect(within(dialog).getByLabelText(/^Type/)).toBeDisabled();
    expect(within(dialog).getByText('A saved rule keeps its type: to use another type, add a new rule.')).toBeInTheDocument();
    const value = within(dialog).getAllByLabelText('Value')[0];
    await user.clear(value);
    await user.type(value, '80,5');
    expect(within(dialog).getAllByText('Write decimals with a point: 80.5, not 80,5.').length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Update the list' }));
    expect(screen.getByRole('dialog', { name: 'Alarm rule' })).toBeInTheDocument();
  });

  it('1.12, 1.13: capabilities not read say so with a retry; an unanswered save says the save failed', async () => {
    const user = userEvent.setup();
    const adapter: IotAdapter = {
      alarmRules: { list: async () => [{ ruleId: 'r1', version: 1, definition: THRESHOLD }], replace: vi.fn(async () => { throw new IotApiError('unknown', ''); }) },
      capabilities: vi.fn(async () => { throw new Error('down'); }),
    };
    const { unmount } = render(<IotAdapterProvider adapter={adapter}><AlarmRuleSetEditor profileId="p1" /></IotAdapterProvider>);
    expect(await screen.findByText(/could not be read, so nothing can be changed yet/)).toBeInTheDocument();
    expect(screen.queryByText('You can view the rules but not change them.')).toBeNull();
    unmount();
    setup([THRESHOLD], { canManageAlarmRules: true }, undefined, new IotApiError('unknown', ''));
    await screen.findByText('temperature > 95');
    await user.click(screen.getByLabelText('Enabled'));
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    expect(await screen.findByText('The alarm rules could not be saved.')).toBeInTheDocument();
  });
});
