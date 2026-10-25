import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotCapabilities } from '../api/adapter';
import { alarmRuleIssues, describeCondition, newInactivityRule, newThresholdRule, type AlarmRuleDefinition } from '../types/alarm-rule';
import { AlarmRuleSetEditor } from './AlarmRuleSetEditor';
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

function setup(rules: AlarmRuleDefinition[], caps: Partial<IotCapabilities> = { canManageAlarmRules: true }) {
  const replace = vi.fn(async (_p: string, next: AlarmRuleDefinition[]) => next.map((definition) => ({ definition })));
  const adapter: IotAdapter = { alarmRules: { list: async () => rules.map((definition, i) => ({ ruleId: `r${i}`, definition })), replace } };
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
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Unsaved rule changes')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('button', { name: 'Device offline rule' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove battery' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Save rules' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('p1', [newInactivityRule()]));
  });

  it('is read-only without canManageAlarmRules', async () => {
    setup([THRESHOLD], {});
    await screen.findByText('temperature > 95');
    expect(screen.getByText('You can view the rules but not change them.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Threshold rule' })).toBeNull();
  });
});
