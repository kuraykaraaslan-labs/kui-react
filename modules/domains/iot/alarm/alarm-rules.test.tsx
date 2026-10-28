import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type IotAdapter, type IotCapabilities } from '../api/adapter';
import {
  alarmRuleIssues, describeCondition, isAlarmRuleKey, newInactivityRule, newThresholdRule, renameAlarmRuleKeys, undeclaredRuleKeys, type AlarmRuleDefinition, type ThresholdAlarmRule,
} from '../types/alarm-rule';
import { blankProfileDraft, type DeviceProfile } from '../types/profile';
import { announceProfileKeyRenames } from '../profile/profile-key-events';
import { AlarmRuleSetEditor, changedRuleCount } from './AlarmRuleSetEditor';
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
    expect(screen.getByText('1 rules changed and not saved yet: nothing applies until you save.')).toBeInTheDocument();
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
    await waitFor(() => expect(replace).toHaveBeenCalledWith('p1', [newInactivityRule()]));
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
    const { replace } = setup([THRESHOLD, COMPOUND]);
    await screen.findByText('temperature > 95');
    await user.click(screen.getByRole('button', { name: 'Edit battery' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getAllByLabelText('Enabled')[1]);
    announceProfileKeyRenames({ profileId: 'other', renames: { temperature: 'nope' } });
    announceProfileKeyRenames({ profileId: 'p1', renames: { temperature: 'temp_c' } });
    expect(await screen.findByText('temp_c > 95')).toBeInTheDocument();
    expect(screen.getByText('1 rules changed and not saved yet: nothing applies until you save.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const sent = replace.mock.calls[0][1] as AlarmRuleDefinition[];
    expect(sent.map((r) => JSON.stringify(r)).join()).not.toContain('"temperature"');
    expect(sent[1].enabled).toBe(false);
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
});
