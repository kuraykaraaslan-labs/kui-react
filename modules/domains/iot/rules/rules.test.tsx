import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RuleDefinition, RuleItem, RuleMode, RuleScope } from '../types/rules';
import { ModeSwitch } from './ModeSwitch';
import { PlaceCommands } from './PlaceCommands';
import { RuleEditor } from './RuleEditor';
import { RuleHistory } from './RuleHistory';
import { RuleList } from './RuleList';
import { RuleStatusChip } from './RuleStatusChip';
import { countdown, ruleState, when } from './rule-format';
import { READY_KEYS, readyLabel, readyRule } from './rule-ready';
import { draftProblems } from './rule-draft';
import { severityLabel } from './RuleRows';
import { IOT_MESSAGES } from '../messages';

/** The Rules card's components (docs/concepts/iot-rules 05): sentences by name, Manual / Auto, the list, the commands. */
const NOW = new Date('2026-11-02T12:00:00Z').getTime();
const scope: RuleScope = {
  place: { type: 'asset', id: 'a1', name: 'Station 3', hasLocation: true },
  devices: [
    { deviceId: 'd1', name: 'Room 1', profileId: 'p1', values: [{ key: 'temperature', label: 'Temperature', sample: 29.4 }] },
    { deviceId: 'd2', name: 'Fan 1', profileId: 'p2', values: [] },
  ],
  deviceTypes: [
    { profileId: 'p1', name: 'Climate sensor', deviceCount: 1, commands: [] },
    { profileId: 'p2', name: 'Fan', deviceCount: 1, commands: [
      { method: 'fan.set', label: 'Fan on', tier: 'basic', highImpact: false, cardCanSend: true, paramsSchema: { speed: { label: 'Speed', type: 'number', required: true } } },
      { method: 'sys.reboot', label: 'Reboot', tier: 'critical', highImpact: true, cardCanSend: false, paramsSchema: {} },
    ] },
  ],
  roles: ['OWNER', 'ADMIN', 'USER'],
};
const rule = (o: Partial<RuleItem> = {}): RuleItem => ({
  ruleId: 'r1', home: { type: 'asset', id: 'a1' }, name: 'Fan on when hot', enabled: true, status: 'ok', statusReason: null, updatedAt: NOW,
  definition: { v: 1, when: [], then: [], options: { overlap: 'ignore' } }, ...o,
});

describe('rule-format', () => {
  it('countdown reads mm:ss and h:mm:ss', () => {
    expect(countdown(200_000)).toBe('3:20');
    expect(countdown(3_723_000)).toBe('1:02:03');
    expect(countdown(-5)).toBe('0:00');
  });
  it('ruleState takes the first that applies: attention, off, Manual, a guard, a hold, else idle', () => {
    const base = { enabled: true, status: 'ok' as const };
    expect(ruleState({ ...base, status: 'needs_attention' }, NOW)).toBe('attention');
    expect(ruleState({ ...base, enabled: false }, NOW)).toBe('off');
    expect(ruleState({ ...base, stoppedByManual: true, pausedByGuard: true }, NOW)).toBe('manual');
    expect(ruleState({ ...base, pausedByGuard: true }, NOW)).toBe('paused');
    expect(ruleState({ ...base, waitingUntil: NOW + 5000 }, NOW)).toBe('waiting');
    expect(ruleState({ ...base, waitingUntil: NOW - 5000 }, NOW)).toBe('idle');
  });
  it('when says the time today and the day otherwise', () => {
    expect(when(NOW, NOW, 'en')).toMatch(/\d{2}:\d{2}/);
    expect(when(NOW - 2 * 86_400_000, NOW, 'en')).toMatch(/Oct|Nov/);
  });
});

describe('RuleStatusChip', () => {
  it('says what the rule is doing, with a countdown for a hold', () => {
    const { rerender } = render(<RuleStatusChip rule={{ enabled: true, status: 'ok', waitingUntil: NOW + 200_000 }} now={NOW} />);
    expect(screen.getByText('Waiting 3:20')).toBeInTheDocument();
    rerender(<RuleStatusChip rule={{ enabled: true, status: 'ok', stoppedByManual: true }} now={NOW} />);
    expect(screen.getByText('Stopped: Manual')).toBeInTheDocument();
    rerender(<RuleStatusChip rule={{ enabled: false, status: 'ok' }} now={NOW} />);
    expect(screen.getByText('Off')).toBeInTheDocument();
  });
});

describe('RuleList', () => {
  const handlers = () => ({ onToggle: vi.fn(), onRun: vi.fn(), onEdit: vi.fn(), onDuplicate: vi.fn(), onHistory: vi.fn(), onDelete: vi.fn(async () => undefined) });

  it('lists each rule with its status, last run and a reason when it needs attention', () => {
    render(<RuleList rules={[
      rule({ lastRun: { at: NOW - 60_000, text: 'sent Fan on to Fan 1 ✓', ok: true } }),
      rule({ ruleId: 'r2', name: 'Door open', status: 'needs_attention', statusReason: 'A device was deleted.', enabled: false }),
    ]} now={NOW} canManage canRun {...handlers()} />);
    expect(screen.getByText('Fan on when hot')).toBeInTheDocument();
    expect(screen.getByText(/sent Fan on to Fan 1/)).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('A device was deleted.')).toBeInTheDocument();
    expect(screen.getByText('Has not run yet')).toBeInTheDocument();
  });

  it('the switch asks the host; a viewer without manage cannot use it and has no edit or delete', async () => {
    const h = handlers();
    const user = userEvent.setup();
    const { rerender } = render(<RuleList rules={[rule()]} now={NOW} canManage canRun {...h} />);
    await user.click(screen.getByRole('switch', { name: 'Switch Fan on when hot on or off' }));
    expect(h.onToggle).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'r1' }), false);
    rerender(<RuleList rules={[rule()]} now={NOW} canManage={false} canRun {...h} />);
    expect(screen.getByRole('switch', { name: 'Switch Fan on when hot on or off' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'More for Fan on when hot' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Run now' })).toBeInTheDocument();
  });

  it('Run now is off for a rule that is switched off; delete goes through the one confirmation', async () => {
    const h = handlers();
    const user = userEvent.setup();
    render(<RuleList rules={[rule({ enabled: false })]} now={NOW} canManage canRun {...h} />);
    await user.click(screen.getByRole('button', { name: 'More for Fan on when hot' }));
    expect(screen.getByRole('menuitem', { name: 'Run now' })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete Fan on when hot?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete rule' }));
    await waitFor(() => expect(h.onDelete).toHaveBeenCalledWith(expect.objectContaining({ ruleId: 'r1' })));
  });

  it('a rule stopped by Manual is dimmed and says so; an empty place offers adding', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<RuleList rules={[rule({ stoppedByManual: true })]} now={NOW} canManage canRun {...handlers()} />);
    expect(screen.getByText('Stopped: Manual')).toBeInTheDocument();
    rerender(<RuleList rules={[]} now={NOW} canManage canRun onAdd={onAdd} {...handlers()} />);
    expect(screen.getByText('No rules here yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add rule/ }));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('ModeSwitch', () => {
  const auto: RuleMode = { mode: 'auto', effective: 'auto' };
  const manual: RuleMode = { mode: 'manual', effective: 'manual', setAt: NOW - 3_600_000, setByName: 'Ayşe K.', until: NOW + 3_600_000, reason: 'valve check' };

  it('going to Manual asks first, with an end and a reason, and hands both to the host', async () => {
    const onManual = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ModeSwitch placeName="Station 3" mode={auto} canSwitch now={NOW} onManual={onManual} onAuto={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Manual' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/its rules do nothing and no rule sends it a command/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Manual until'), '60');
    await user.type(within(dialog).getByLabelText('Why (optional)'), 'valve check');
    await user.click(within(dialog).getByRole('button', { name: 'Switch to Manual' }));
    await waitFor(() => expect(onManual).toHaveBeenCalledWith({ until: NOW + 3_600_000, reason: 'valve check' }));
  });

  it('Manual shows the banner (since, by whom, until, why); back to Auto lists what would run and applies now by default', async () => {
    const onAuto = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ModeSwitch placeName="Station 3" mode={manual} canSwitch now={NOW} onManual={vi.fn()} onAuto={onAuto} loadHolding={async () => ['Fan on: Room 1 is 30, above 28']} locale="en" />);
    expect(screen.getByText(/Manual since/)).toHaveTextContent(/by Ayşe K\./);
    expect(screen.getByText(/valve check/)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Fan on: Room 1 is 30, above 28')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Apply the rules now')).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Switch to Auto' }));
    await waitFor(() => expect(onAuto).toHaveBeenCalledWith({ applyNow: true }));
  });

  it('"apply now" can be turned off', async () => {
    const onAuto = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ModeSwitch placeName="Station 3" mode={manual} canSwitch now={NOW} onManual={vi.fn()} onAuto={onAuto} />);
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Apply the rules now'));
    await user.click(within(dialog).getByRole('button', { name: 'Switch to Auto' }));
    await waitFor(() => expect(onAuto).toHaveBeenCalledWith({ applyNow: false }));
  });

  it('a place under a Manual asset names it and cannot go to Auto itself (RL-E21)', () => {
    render(<ModeSwitch placeName="Pump 2" mode={{ mode: 'auto', effective: 'manual', setOn: { type: 'asset', id: 'a1', name: 'Station 3' } }} canSwitch now={NOW} onManual={vi.fn()} onAuto={vi.fn()} />);
    expect(screen.getByText(/Manual \(set on Station 3\)/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeDisabled();
  });

  it('without the right to switch it only shows the mode; a failed switch keeps the dialog open with the reason', async () => {
    const { rerender } = render(<ModeSwitch placeName="Station 3" mode={auto} canSwitch={false} now={NOW} onManual={vi.fn()} onAuto={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Manual' })).toBeDisabled();
    const onManual = vi.fn(async () => { throw new Error('Choose an end in the future.'); });
    const user = userEvent.setup();
    rerender(<ModeSwitch placeName="Station 3" mode={auto} canSwitch now={NOW} onManual={onManual} onAuto={vi.fn()} />);
    await user.click(screen.getByRole('radio', { name: 'Manual' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Switch to Manual' }));
    expect(await screen.findByText('Choose an end in the future.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('PlaceCommands', () => {
  it('lists only devices with a command the card may send, sends the picked one with its values, and says how it went', async () => {
    const onSend = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<PlaceCommands scope={scope} canSend onSend={onSend} />);
    const device = screen.getByLabelText('Device') as HTMLSelectElement;
    expect([...device.options].map((o) => o.text)).toEqual(['Pick a device', 'Fan 1']);
    await user.selectOptions(device, 'd2');
    const command = screen.getByLabelText('Command') as HTMLSelectElement;
    expect([...command.options].map((o) => o.text)).toEqual(['Choose a command', 'Fan on']);
    await user.selectOptions(command, 'fan.set');
    await user.type(await screen.findByLabelText(/Speed/), '3');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ deviceId: 'd2', method: 'fan.set', params: { speed: 3 } }));
    expect(await screen.findByText('Fan on sent to Fan 1')).toBeInTheDocument();
  });

  it('a refused send shows the reason; without any sendable command there is a sentence, not a form', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(async () => { throw new Error('Too many commands.'); });
    const { rerender } = render(<PlaceCommands scope={scope} canSend onSend={onSend} />);
    await user.selectOptions(screen.getByLabelText('Device'), 'd2');
    await user.selectOptions(screen.getByLabelText('Command'), 'fan.set');
    await user.type(await screen.findByLabelText(/Speed/), '1');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many commands.');
    rerender(<PlaceCommands scope={{ devices: scope.devices, deviceTypes: scope.deviceTypes.map((t) => ({ ...t, commands: t.commands.filter((c) => !c.cardCanSend) })) }} canSend onSend={onSend} />);
    expect(screen.getByText(/No device here has a command/)).toBeInTheDocument();
  });
});

describe('RuleEditor', () => {
  const finished: RuleDefinition = {
    v: 1, options: { overlap: 'ignore' },
    when: [{ id: 't1', kind: 'value', target: { device: 'd1' }, key: 'temperature', change: 'above', value: 28 }],
    then: [{ id: 'a1', kind: 'notify', recipients: [{ kind: 'role', role: 'ADMIN' }], text: 'Hot' }],
  };

  it('a new rule starts with one unfinished row each; Save lists what is unfinished and does not call the host', async () => {
    const onSave = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<RuleEditor scope={scope} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'When' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Only if' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Then' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Fix these before saving')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('builds a rule by picking names: device, value, how it changes, a number, a command; saving a rule that acts on devices asks for the author’s tick', async () => {
    const onSave = vi.fn(async (_input: unknown) => undefined);
    const user = userEvent.setup();
    render(<RuleEditor scope={scope} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText('Name'), 'Fan on when hot');
    await user.selectOptions(screen.getByLabelText('Device', { selector: '#trigger-t1-device' }), 'd:d1');
    await user.selectOptions(screen.getByLabelText('Value', { selector: '#trigger-t1-key' }), 'temperature');
    await user.type(screen.getByLabelText('Value', { selector: '#trigger-t1-value' }), '28');
    await user.selectOptions(screen.getByLabelText('Device', { selector: '#action-a1-device' }), 'd:d2');
    await user.selectOptions(screen.getByLabelText('Command', { selector: '#action-a1-command' }), 'fan.set');
    await user.type(await screen.findByLabelText(/Speed/), '2');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This rule acts on its own')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(dialog).getByLabelText('Yes, let this rule act on its own'));
    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0]![0] as { name: string; confirmed: boolean; definition: RuleDefinition };
    expect(saved).toMatchObject({ name: 'Fan on when hot', confirmed: true });
    expect(saved.definition.when[0]).toMatchObject({ kind: 'value', target: { device: 'd1' }, key: 'temperature', change: 'above', value: 28 });
    expect(saved.definition.then[0]).toMatchObject({ kind: 'command', target: { device: 'd2' }, command: 'fan.set', params: { speed: 2 } });
  });

  it('a rule that only waits saves at once; one that notifies people asks for the author’s tick like one that sends commands', async () => {
    const onSave = vi.fn(async () => undefined);
    const user = userEvent.setup();
    const quiet: RuleDefinition = { ...finished, then: [{ id: 'a1', kind: 'wait', sec: 5 }] };
    const { unmount } = render(<RuleEditor scope={scope} initial={{ name: 'Quiet', definition: quiet }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ name: 'Quiet', definition: quiet, confirmed: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    render(<RuleEditor scope={scope} initial={{ name: 'Tell me', definition: finished }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This rule acts on its own')).toBeInTheDocument();
  });


  it('shows the server’s problem under the row it names, and the first ones in the list', () => {
    render(<RuleEditor scope={scope} initial={{ name: 'Tell me', definition: finished }} problems={[{ path: ['when', 0, 'target'], code: 'device_out_of_scope', message: 'This device is not part of Station 3.' }]} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('This device is not part of Station 3.')).toBeInTheDocument();
  });

  it('more than one condition become a group with its own all / any / none choice; groups can be added', async () => {
    const user = userEvent.setup();
    render(<RuleEditor scope={scope} initial={{ name: 'x', definition: finished }} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add a condition' }));
    expect(screen.queryByLabelText('Group')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add a condition' }));
    expect(await screen.findByLabelText('Group')).toHaveValue('all');
    await user.selectOptions(screen.getByLabelText('Group'), 'any');
    expect(screen.getByLabelText('Group')).toHaveValue('any');
  });

  it('Test now hands the draft to the host and shows its answer in words', async () => {
    const onTest = vi.fn(async () => undefined);
    const user = userEvent.setup();
    const result = { triggers: [{ id: 't1', holds: true, why: 'Room 1 · temperature is 29.4, which matches' }], conditions: { ok: false, why: 'Room 1 · humidity is 54, not below 50' }, actions: ['Send “Fan on” to Fan 1'], mode: { effective: 'auto' as const, stops: false }, wouldRun: false, summary: 'Would not run: Room 1 · humidity is 54, not below 50.' };
    const { rerender } = render(<RuleEditor scope={scope} initial={{ name: 'Tell me', definition: finished }} onSave={vi.fn()} onTest={onTest} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Test now' }));
    await waitFor(() => expect(onTest).toHaveBeenCalledWith({ name: 'Tell me', definition: finished }));
    rerender(<RuleEditor scope={scope} initial={{ name: 'Tell me', definition: finished }} testResult={result} onSave={vi.fn()} onTest={onTest} onCancel={vi.fn()} />);
    const out = screen.getByRole('region', { name: 'Result' });
    expect(within(out).getByText('Would not run: Room 1 · humidity is 54, not below 50.')).toBeInTheDocument();
    expect(within(out).getByText(/Holds now: Room 1 · temperature is 29.4/)).toBeInTheDocument();
    expect(within(out).getByText('Send “Fan on” to Fan 1')).toBeInTheDocument();
  });

  it('"Also runs in Manual" is not offered to a rule that acts on devices', () => {
    render(<RuleEditor scope={scope} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Also runs in Manual')).toBeDisabled();
  });
});

describe('ready-made rules', () => {
  const m = IOT_MESSAGES.rules;

  it('every ready rule is a sound starting point: only the devices, values and commands are left to pick, never a number or a structure', () => {
    for (const key of READY_KEYS) {
      const r = readyRule(key, m);
      expect(r.name.length, key).toBeGreaterThan(0);
      const left = new Set(draftProblems(r.name, r.definition, m).map((p) => String(p.path.at(-1))));
      for (const p of left) expect(['target', 'key', 'command', 'value'], `${key}: ${p}`).toContain(p);
      expect(readyLabel(m, key).length, key).toBeGreaterThan(0);
    }
  });

  it('their ids are unique and the structure is the sentence it names', () => {
    const offline = readyRule('offline', m).definition;
    expect(offline.when[0]).toMatchObject({ kind: 'status', to: 'offline' });
    expect(offline.then.map((a) => a.kind)).toEqual(['wait', 'choose']);
    expect(readyRule('every', m).definition.onlyIf).toMatchObject({ kind: 'time', after: '08:00', before: '20:00' });
    expect(readyRule('onHigh', m).definition.when[0]).toMatchObject({ kind: 'value', change: 'above', forSec: 300 });
    expect(readyRule('afterOn', m).definition.then.map((a) => a.kind)).toEqual(['wait', 'command']);
    for (const key of READY_KEYS) {
      const ids: string[] = [];
      const def = readyRule(key, m).definition;
      def.when.forEach((t) => ids.push(t.id));
      const walk = (list: typeof def.then) => list.forEach((a) => { ids.push(a.id); if (a.kind === 'choose') a.branches.forEach((b) => walk(b.then)); });
      walk(def.then);
      expect(new Set(ids).size, key).toBe(ids.length);
    }
  });

  it('a new rule offers them; picking one fills the draft and the name, a typed name is kept, and an edited rule has no picker', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RuleEditor scope={scope} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText('Name'), 'My own name');
    await user.selectOptions(screen.getByLabelText('Start from a ready rule'), 'sunset');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('My own name');
    expect(screen.getByLabelText('What', { selector: '#trigger-t1-kind' })).toHaveValue('sun');
    unmount();
    render(<RuleEditor scope={scope} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Start from a ready rule'), 'onHigh');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Turn on when high');
  });

  it('is not offered when a rule is being edited', () => {
    render(<RuleEditor scope={scope} initial={{ name: 'x', definition: readyRule('sunset', m).definition }} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText('Start from a ready rule')).toBeNull();
  });
});

describe('calendar rows in the editor', () => {
  const base = (over: Partial<RuleDefinition>): RuleDefinition => ({
    v: 1, when: [{ id: 't1', kind: 'date', at: '09:00', daysOfMonth: [1] }], then: [{ id: 'a1', kind: 'wait', sec: 5 }], options: { overlap: 'ignore' }, ...over,
  });

  it('a date trigger picks days of the month and months; choosing a day of the month drops the weekdays', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RuleEditor scope={scope} initial={{ name: 'Monthly', definition: base({ when: [{ id: 't1', kind: 'date', at: '09:00', days: [1, 2] }] }) }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('What', { selector: '#trigger-t1-kind' })).toHaveValue('date');
    await user.click(document.querySelector('#trigger-t1-dom-15')!);
    await user.click(document.querySelector('#trigger-t1-months-6')!);
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const t = onSave.mock.calls[0]![0].definition.when[0];
    expect(t).toMatchObject({ kind: 'date', at: '09:00', daysOfMonth: [15], months: [6] });
    expect(t.days).toBeUndefined();
  });

  it('a date condition holds a window of two dates; a holiday condition says working day or holiday', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RuleEditor scope={scope} initial={{ name: 'Summer', definition: base({ onlyIf: { all: [{ kind: 'date', from: '06-01', to: '09-30' }, { kind: 'holiday', is: false }] } }) }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(document.querySelector('#cond-onlyIf-all-0-from-month')).toHaveValue('06');
    expect(document.querySelector('#cond-onlyIf-all-0-to-day')).toHaveValue('30');
    await user.selectOptions(document.querySelector('#cond-onlyIf-all-1-is')!, 'true');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0].definition.onlyIf).toEqual({ all: [{ kind: 'date', from: '06-01', to: '09-30' }, { kind: 'holiday', is: true }] });
  });
});

describe('RuleHistory', () => {
  it('lists the runs as given, each with its mark, its words and its time', () => {
    render(<RuleHistory now={NOW} runs={[{ at: NOW - 60_000, text: 'sent Fan on to Fan 1 ✓', ok: true }, { at: NOW - 3_600_000, text: 'Fan 1 did not answer', ok: false }]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Done')).toBeInTheDocument();
    expect(within(items[0]!).getByText('sent Fan on to Fan 1 ✓')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Failed')).toBeInTheDocument();
    expect(items[1]).toHaveAttribute('data-ok', 'false');
  });
  it('says so while loading and when there is nothing yet', () => {
    const { rerender } = render(<RuleHistory now={NOW} runs={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the history');
    rerender(<RuleHistory now={NOW} runs={[]} />);
    expect(screen.getByText('It has not run yet.')).toBeInTheDocument();
  });
});

describe('starting another rule', () => {
  it('the rule action offers Start it beside Switch on and off, and keeps the choice', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const def: RuleDefinition = { v: 1, when: [{ id: 't1', kind: 'manual' }], then: [{ id: 'a1', kind: 'rule', op: 'enable', rule: 'r2' }], options: { overlap: 'ignore' } };
    render(<RuleEditor scope={scope} initial={{ name: 'Chain', definition: def }} otherRules={[{ ruleId: 'r2', name: 'Night mode' }]} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.selectOptions(document.querySelector('#action-a1-op')!, 'run');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0].definition.then[0]).toMatchObject({ kind: 'rule', op: 'run', rule: 'r2' });
  });
});

describe('overlap: start over', () => {
  it('is offered with the others and saved as restart', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const def: RuleDefinition = { v: 1, when: [{ id: 't1', kind: 'manual' }], then: [{ id: 'a1', kind: 'wait', sec: 5 }], options: { overlap: 'ignore' } };
    render(<RuleEditor scope={scope} initial={{ name: 'Again', definition: def }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.selectOptions(document.querySelector('#rule-overlap')!, 'restart');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0].definition.options.overlap).toBe('restart');
  });
});

describe('formula condition', () => {
  it('a picked device and value are written into the formula as [Device].[key]', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const def: RuleDefinition = { v: 1, when: [{ id: 't1', kind: 'manual' }], onlyIf: { kind: 'expr', expr: '' }, then: [{ id: 'a1', kind: 'wait', sec: 5 }], options: { overlap: 'ignore' } };
    render(<RuleEditor scope={scope} initial={{ name: 'Formula', definition: def }} onSave={onSave} onTest={vi.fn()} onCancel={vi.fn()} />);
    await user.selectOptions(document.querySelector('#cond-onlyIf-0-ref-device')!, 'd:d1');
    await user.selectOptions(document.querySelector('#cond-onlyIf-0-ref-key')!, 'temperature');
    await user.click(screen.getByRole('button', { name: 'Add this value' }));
    const box = document.querySelector('#cond-onlyIf-all-0-expr') as HTMLInputElement;
    expect(box.value).toBe('[Room 1].[temperature]');
    await user.type(box, ' > 28');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0].definition.onlyIf).toEqual({ all: [{ kind: 'expr', expr: '[Room 1].[temperature] > 28' }] });
  });
});

describe('RuleEditor: next-boilerplate run 3', () => {
  const m = IOT_MESSAGES;
  const alarmy: RuleDefinition = {
    v: 1, options: { overlap: 'ignore' },
    when: [{ id: 't1', kind: 'alarm', target: { device: 'd1' }, event: 'raised', minSeverity: 'major' }],
    then: [{ id: 'a1', kind: 'alarm', op: 'raise', target: { device: 'd2' }, alarmType: 'Hot', severity: 'warning' }],
  };
  it('note 127: the severities read the kit\'s severity words, the English for a word not given', () => {
    render(<RuleEditor scope={scope} initial={{ name: 'Escalate', definition: alarmy }} messages={{ severity: { MAJOR: 'Büyük', WARNING: 'Uyarı' } }} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    const from = screen.getByLabelText(m.rules.alarmFrom, { selector: '#trigger-t1-severity' }) as HTMLSelectElement;
    expect([...from.options].map((o) => o.textContent)).toEqual([m.rules.alarmAnySeverity, 'Critical', 'Büyük', 'Minor', 'Uyarı', 'Info']);
    const level = screen.getByLabelText(m.rules.alarmSeverityLabel, { selector: '#action-a1-severity' }) as HTMLSelectElement;
    expect([...level.options].map((o) => o.textContent)).toEqual(['Critical', 'Büyük', 'Minor', 'Uyarı', 'Info']);
  });
  it('severityLabel: the kit\'s word, the English when none is given', () => {
    expect(severityLabel('major', { MAJOR: 'Büyük' })).toBe('Büyük');
    expect(severityLabel('warning', { MAJOR: 'Büyük' })).toBe('Warning');
    expect(severityLabel('critical')).toBe('Critical');
  });
  it('note 157: reports every state of the draft, the first as it opens, so a host that closes the editor itself can ask first', async () => {
    const onDraftChange = vi.fn();
    const user = userEvent.setup();
    render(<RuleEditor scope={scope} initial={{ name: 'Escalate', definition: alarmy }} onDraftChange={onDraftChange} onSave={vi.fn()} onTest={vi.fn()} onCancel={vi.fn()} />);
    expect(onDraftChange).toHaveBeenCalledWith({ name: 'Escalate', definition: alarmy });
    await user.type(screen.getByLabelText('Name'), '!');
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Escalate!' }));
  });
});
