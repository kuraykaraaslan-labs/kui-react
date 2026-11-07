import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { SceneSettings } from '../views/scada-scene-logic';
import { SceneRulesEditor } from '../views/SceneRulesEditor';
import type { Rec } from '../views/scene-edit-logic';
import { validateRules } from '../views/scene-rules-logic';
import { Harness, newProbe } from './scene-panel-harness';
import { smallScene } from './scene-edit-fixture';

const rulesOf = (p: ReturnType<typeof newProbe>) => ((p.current!.ctx.settings as { rules?: Rec[] }).rules ?? []);
const points = { shape: 'table' as const, rows: [{ id: 'pump1', running: true, status: 'warning', value: 30 }, { id: 'tank1', value: 5 }, { id: 'valve1', running: false }] };

function scene(rules: Rec[]): SceneSettings {
  return { ...smallScene(), rules } as SceneSettings;
}
function mount(rules: Rec[], o: { selection?: { elements?: string[]; links?: number[] }; host?: object; params?: Record<string, unknown>; data?: object } = {}) {
  const probe = newProbe();
  const view = render(
    <Harness initial={scene(rules)} selection={o.selection} probe={probe} data={(o.data ?? { points }) as never} params={o.params} host={o.host}>
      {(ctx) => <SceneRulesEditor ctx={ctx} />}
    </Harness>,
  );
  return { probe, ...view };
}

const RULES: Rec[] = [
  { target: 'pump1', key: 'value', op: 'gt', value: '24', state: 'warning', label: 'High' },
  { target: '*', key: 'status', op: 'eq', value: 'critical', state: 'critical' },
  { target: 'valve1', key: 'running', op: 'true', color: 'var(--info)' },
  { target: 'pump1', key: 'running', op: 'false', state: 'idle' },
];

describe('SceneRulesEditor: the list', () => {
  it('shows each rule as a sentence, grouped: the selection first, then *, then the others by target', () => {
    mount(RULES, { selection: { elements: ['pump1'] } });
    const groups = [...document.querySelectorAll('[data-group]')].map((g) => g.getAttribute('data-group'));
    expect(groups).toEqual(['own', 'star', 'others', 't-valve1']);
    // by name, never by id (next-boilerplate e2e round 5, V1-B2); a value by the name a person knows it by
    expect(screen.getByRole('heading', { name: 'Rules for Wi-Fi router' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smart plug' })).toBeInTheDocument();
    expect(screen.getByText("When Reading of this symbol is above 24, set the state to warning and show 'High'")).toBeInTheDocument();
    expect(screen.getByText('When Status of this symbol is critical, set the state to critical')).toBeInTheDocument();
    const own = document.querySelector('[data-group="own"]')!;
    expect([...own.querySelectorAll('[data-rule]')].map((r) => r.getAttribute('data-rule'))).toEqual(['0', '3']);
  });
  it('lists everything under the others, without a selection, and says when there are no rules', () => {
    mount(RULES);
    expect(document.querySelector('[data-group="own"]')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('4 rules');
  });
  it('has an empty state', () => {
    mount([]);
    expect(screen.getByText(/No rules yet/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 rules');
  });
  it('marks each rule live: matching now, not matching, matching some, off, no target', () => {
    mount([
      { target: 'pump1', key: 'value', op: 'gt', value: '24' },
      { target: 'pump1', key: 'value', op: 'gt', value: '99' },
      { target: '*', key: 'running', op: 'true' },
      { target: 'valve1', key: 'running', op: 'true', enabled: false },
      { target: 'ghost', key: 'running', op: 'true' },
    ]);
    const mark = (i: number) => document.querySelector(`[data-rule="${i}"]`)!.textContent;
    expect(mark(0)).toContain('Matching now');
    expect(mark(1)).toContain('Not matching');
    expect(mark(2)).toContain('Matching 1 of 4');
    expect(mark(3)).toContain('Off');
    expect(mark(4)).toContain('No target');
  });
  it('reads board parameters for the live mark', () => {
    mount([{ target: 'pump1', source: 'param', key: 'mode', op: 'eq', value: 'night' }], { params: { mode: 'night' } });
    expect(document.querySelector('[data-rule="0"]')!.textContent).toContain('Matching now');
  });
});

describe('SceneRulesEditor: editing', () => {
  it('adds a rule for the selected symbol and opens it', () => {
    const { probe } = mount([], { selection: { elements: ['pump1'] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(rulesOf(probe)).toEqual([expect.objectContaining({ target: 'pump1', enabled: true })]);
    expect(screen.getByLabelText('Applies to')).toHaveValue('pump1');
  });
  it('adds a rule with no target when nothing is selected, and shows the validation message', () => {
    const { probe } = mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(rulesOf(probe)[0].target).toBe('');
    expect(screen.getByText('Choose the symbol this rule changes.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Applies to'), { target: { value: '*' } });
    expect(rulesOf(probe)[0].target).toBe('*');
    expect(screen.queryByText('Choose the symbol this rule changes.')).toBeNull();
  });
  it('builds a condition: column, row, operator, value, and a second condition joined with any', () => {
    const { probe } = mount([{ target: 'pump1', enabled: true }]);
    fireEvent.click(screen.getByRole('button', { name: /^When|Always/ }));
    fireEvent.change(screen.getByLabelText('Which value'), { target: { value: 'value' } });
    fireEvent.change(screen.getByLabelText('Is'), { target: { value: 'between' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Up to'), { target: { value: '20' } });
    expect(rulesOf(probe)[0]).toMatchObject({ key: 'value', op: 'between', value: '10', to: '20' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a second condition' }));
    expect(rulesOf(probe)[0]).toMatchObject({ op2: 'eq', join: 'all' });
    const second = document.querySelector('[data-condition="2"]') as HTMLElement;
    fireEvent.change(within(second).getByLabelText('Read'), { target: { value: 'param' } });
    fireEvent.change(within(second).getByLabelText('Parameter'), { target: { value: 'mode' } });
    fireEvent.change(within(second).getByLabelText('Value'), { target: { value: 'night' } });
    fireEvent.change(screen.getByLabelText('Join with'), { target: { value: 'any' } });
    expect(rulesOf(probe)[0]).toMatchObject({ source2: 'param', key2: 'mode', value2: 'night', join: 'any' });
    expect(screen.getByRole('button', { name: /When Reading of this symbol is between 10 and 20 or parameter mode is night/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the second condition' }));
    expect('op2' in rulesOf(probe)[0]).toBe(false);
    expect(rulesOf(probe)[0]).toMatchObject({ key2: '' });
    expect(document.querySelector('[data-condition="2"]')).toBeNull();
  });
  it('offers the host\'s columns and parameters, with free text under "Another value", and reads another symbol\'s row', () => {
    const { probe } = mount([{ target: 'pump1', key: '', op: 'gt', value: '1' }], {
      host: { columns: [{ key: 'temp', label: 'Temperature' }], params: [{ key: 'mode', label: 'Mode', values: ['day', 'night'] }] },
    });
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    const which = screen.getByLabelText('Which value') as HTMLSelectElement;
    expect([...which.options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual(['Temperature', 'Another value (advanced)…']);
    fireEvent.change(which, { target: { value: 'temp' } });
    expect(rulesOf(probe)[0].key).toBe('temp');
    fireEvent.change(which, { target: { value: '\u0000other' } });
    const typed = screen.getByLabelText('Name of the value in the data');
    expect([...document.querySelector('datalist')!.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['temp']);
    fireEvent.change(typed, { target: { value: 'vibration' } });
    expect(rulesOf(probe)[0].key).toBe('vibration');
    // a name the choices do not hold stays in the typed box
    expect((screen.getByLabelText('Which value') as HTMLSelectElement).value).toBe('\u0000other');
    fireEvent.change(screen.getByLabelText('Of symbol'), { target: { value: 'tank1' } });
    expect(rulesOf(probe)[0].of).toBe('tank1');
    fireEvent.change(screen.getByLabelText('Read'), { target: { value: 'param' } });
    expect([...document.querySelector('datalist')!.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['mode']);
    fireEvent.change(screen.getByLabelText('Parameter'), { target: { value: 'mode' } });
    expect([...document.querySelectorAll('datalist')[1].querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual(['day', 'night']);
    expect(screen.queryByLabelText('Of symbol')).toBeNull();
  });
  it('sets the effects: state, colours, yes/no looks, motion, medium, stop, and inserts a token into the name', () => {
    const { probe } = mount([{ target: 'pump1', key: 'value', op: 'gt', value: '1' }]);
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'critical' } });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Colour: theme colours' })).getByRole('radio', { name: 'Primary' }));
    fireEvent.change(screen.getByLabelText('Passive look'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Blink'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Hide'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('Motion'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('Medium'), { target: { value: 'hot' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Stop here/ }));
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'High: ' } });
    name.setSelectionRange(6, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Insert {value}' }));
    expect(rulesOf(probe)[0]).toMatchObject({ state: 'critical', color: 'var(--primary)', dim: 'true', blink: 'true', hidden: 'false', animate: 'false', medium: 'hot', stop: true, label: 'High: {value}' });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: '' } });
    expect('state' in rulesOf(probe)[0]).toBe(false);
  });
  it('offers the condition\'s reading as a token beside {value} (next-boilerplate D584), in the host\'s word for it', () => {
    const { probe } = mount([{ target: 'pump1', key: 'value', op: 'gt', value: '1' }]);
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Hold ' } });
    name.setSelectionRange(5, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Insert {condition}' }));
    expect(rulesOf(probe)[0]).toMatchObject({ label: 'Hold {condition}' });
  });
  it('sets the state effects: mode, data quality, speed, direction, acknowledgement, opening, command badges', () => {
    const { probe } = mount([{ target: 'pump1', key: 'value', op: 'gt', value: '1' }]);
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'maintenance' } });
    fireEvent.change(screen.getByLabelText('Data quality'), { target: { value: 'stale' } });
    fireEvent.change(screen.getByLabelText('Speed (% of nominal)'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Alarm acknowledged'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('Opening (%)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Command pending'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Command failed'), { target: { value: 'false' } });
    expect(rulesOf(probe)[0]).toMatchObject({ mode: 'maintenance', quality: 'stale', speed: 50, reverse: 'true', ack: 'false', position: 40, pending: 'true', failed: 'false' });
    expect(validateRules(rulesOf(probe), { elementIds: ['pump1', 'tank1', 'valve1'] })).toEqual([]);
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Speed (% of nominal)'), { target: { value: '' } });
    expect('mode' in rulesOf(probe)[0]).toBe(false);
  });
  it('turns a rule off and on', () => {
    const { probe } = mount(RULES);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'On: rule 1' })[0]);
    expect(rulesOf(probe)[0].enabled).toBe(false);
    expect(screen.getByRole('button', { name: /\(off\)$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'On: rule 1' }));
    expect(rulesOf(probe)[0].enabled).toBe(true);
  });
  it('moves a rule within the list it is shown in, duplicates and deletes, each one undo step', () => {
    const { probe } = mount(RULES, { selection: { elements: ['pump1'] } });
    expect(screen.getByRole('button', { name: 'Move up: rule 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move down: rule 1' }));
    expect(rulesOf(probe).map((r) => r.target)).toEqual(['*', 'valve1', 'pump1', 'pump1']);
    expect(rulesOf(probe)[3].key).toBe('value');
    expect(probe.current!.history.past).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate: rule 4' }));
    expect(rulesOf(probe)).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Delete: rule 5' }));
    expect(rulesOf(probe)).toHaveLength(4);
    act(() => probe.current!.undo());
    expect(rulesOf(probe)).toHaveLength(5);
    act(() => probe.current!.undo());
    act(() => probe.current!.undo());
    expect(rulesOf(probe).map((r) => r.target)).toEqual(['pump1', '*', 'valve1', 'pump1']);
  });
  it('disables up at the top and down at the bottom of a group', () => {
    mount(RULES, { selection: { elements: ['pump1'] } });
    expect(screen.getByRole('button', { name: 'Move down: rule 4' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move up: rule 2' })).toBeDisabled();
  });
  it('shows the validation messages of the template\'s own rules under the field', () => {
    const { probe } = mount([{ target: 'pump1', key: '', op: 'gt', value: 'abc', of: 'ghost' }]);
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    expect(screen.getByText('Choose which value the rule reads.')).toBeInTheDocument();
    expect(screen.getByText('This comparison needs a number.')).toBeInTheDocument();
    expect(screen.getAllByText('This symbol is not in the drawing any more.').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-rule="0"]')!.textContent).toMatch(/3 problems/);
    expect(validateRules(rulesOf(probe), { elementIds: ['pump1'] }).length).toBe(3);
  });
  it('keeps a target that is no longer in the diagram visible and selectable', () => {
    mount([{ target: 'ghost', state: 'idle' }]);
    fireEvent.click(screen.getByRole('button', { name: /Always/ }));
    expect(screen.getByRole('option', { name: 'ghost (not in the diagram)' })).toBeInTheDocument();
  });
  it('shows a refusal from the edit model', () => {
    const rules = Array.from({ length: 200 }, () => ({ target: '*', state: 'idle' }));
    mount(rules);
    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at most 200 rules/);
  });
  it('ignores a stray entry in the list', () => {
    mount([null as never, { target: 'pump1', state: 'idle' }]);
    expect(document.querySelectorAll('[data-rule]')).toHaveLength(1);
  });
  it('takes the host\'s words, for the sentence and the controls', () => {
    const probe = newProbe();
    render(
      <Harness initial={scene([{ target: 'pump1', key: 'value', op: 'gt', value: '1', state: 'idle' }])} probe={probe} data={{ points }}>
        {(ctx) => <SceneRulesEditor ctx={ctx} messages={{ add: 'Kural ekle', words: { when: 'Eger', ops: { gt: 'buyuk {value}' } } }} />}
      </Harness>,
    );
    expect(screen.getByRole('button', { name: 'Kural ekle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Eger Reading of this symbol buyuk 1/ })).toBeInTheDocument();
  });
});

describe('SceneRulesEditor: names, values and words a person reads (next-boilerplate e2e round 5, E14, V1-B2, B4, B5)', () => {
  it('"Which value" offers the values of the symbol the condition reads, by name, from the host; any other name is typed under Another value', () => {
    const valuesOf = (e: { id: string; symbol: string }) => (e.symbol === 'home.router' ? [{ key: 'running', label: 'Running' }, { key: 'position', label: 'Opening' }] : e.id === 'tank1' ? [{ key: 'value', label: 'Level' }] : undefined);
    const { probe } = mount([{ target: 'pump1', key: '', op: 'true' }], { host: { symbolValues: valuesOf } });
    fireEvent.click(screen.getByRole('button', { name: /When/ }));
    const which = screen.getByLabelText('Which value') as HTMLSelectElement;
    expect([...which.options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual(['Running', 'Opening', 'Another value (advanced)…']);
    fireEvent.change(which, { target: { value: 'position' } });
    expect(rulesOf(probe)[0].key).toBe('position');
    expect(screen.getByRole('button', { name: /When Opening of this symbol is on/ })).toBeInTheDocument();
    // another symbol's row: its own values
    fireEvent.change(screen.getByLabelText('Of symbol'), { target: { value: 'tank1' } });
    expect([...(screen.getByLabelText('Which value') as HTMLSelectElement).options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual(['Level', 'Another value (advanced)…']);
    expect(screen.getByRole('button', { name: /of Feed is on/ })).toBeInTheDocument();
  });
  it('names two symbols of one name apart by their id, and only them', () => {
    const probe = newProbe();
    const twins = { ...smallScene(), elements: [...smallScene().elements as Rec[], { id: 'pump2', symbol: 'home.router', x: 700, y: 200 }], rules: [{ target: 'tank1', state: 'idle' }] } as SceneSettings;
    render(<Harness initial={twins} probe={probe} data={{ points } as never}>{(ctx) => <SceneRulesEditor ctx={ctx} />}</Harness>);
    fireEvent.click(screen.getByRole('button', { name: /Always/ }));
    const options = [...(screen.getByLabelText('Applies to') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toEqual(expect.arrayContaining(['Feed', 'Wi-Fi router (pump1)', 'Wi-Fi router (pump2)', 'Smart plug']));
  });
  it('words the problems, the badge, the name\'s placeholder and the colours in the host\'s language', () => {
    mount([{ target: 'pump1', key: '', op: 'gt', value: 'abc', color: 'var(--error)' }]);
    cleanupAndMountTurkish();
    expect(screen.getByText('Hangi değer okunacak, seçin.')).toBeInTheDocument();
    expect(document.querySelector('[data-rule="0"]')!.textContent).toMatch(/2 sorun/);
    expect(screen.getByRole('button', { name: /rengini kırmızı yap/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Ad')).toHaveAttribute('placeholder', 'Yüksek: {value}');
  });
});

function cleanupAndMountTurkish() {
  document.body.innerHTML = '';
  const probe = newProbe();
  render(
    <Harness initial={scene([{ target: 'pump1', key: '', op: 'gt', value: 'abc', color: 'var(--error)' }])} probe={probe} data={{ points } as never}>
      {(ctx) => (
        <SceneRulesEditor
          ctx={ctx}
          messages={{
            label: 'Ad', labelPlaceholder: 'Yüksek: {value}', problemCount: (n: number) => `${n} sorun`,
            issues: { 'column-missing': () => 'Hangi değer okunacak, seçin.', 'value-number': () => 'Bu karşılaştırma bir sayı ister.' },
            words: { color: 'rengini {color} yap', colours: { red: 'kırmızı' } },
          }}
        />
      )}
    </Harness>,
  );
  fireEvent.click(screen.getByRole('button', { name: /rengini/ }));
}
