import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { SceneSettings } from '../views/scada-scene-logic';
import { SceneWhatIf } from '../views/SceneWhatIf';
import type { Rec, Selection } from '../views/scene-edit-logic';
import type { EditorHost, WhatIfState } from '../views/scene-editor-types';
import { emptyWhatIf } from '../views/scene-whatif-logic';
import { Harness } from './scene-panel-harness';
import { smallScene } from './scene-edit-fixture';

const points = { shape: 'table' as const, rows: [{ id: 'pump1', running: false, status: 'none', value: 3 }, { id: 'tank1', value: 40 }, { id: 'valve1' }] };
const rules: Rec[] = [
  { target: 'pump1', key: 'running', op: 'true', state: 'running' },
  { target: 'tank1', key: 'value', op: 'gt', value: '80', state: 'critical' },
  { target: '*', source: 'param', key: 'mode', op: 'eq', value: 'night', dim: 'true' },
  { target: 'pump1', key: 'status', op: 'eq', value: 'critical', color: 'var(--error)' },
];

function Stateful({ onState, selection, host, params, initial = emptyWhatIf() }: { onState: (s: WhatIfState) => void; selection?: Selection; host?: EditorHost; params?: Record<string, unknown>; initial?: WhatIfState }) {
  const [value, setValue] = useState(initial);
  return (
    <Harness initial={{ ...smallScene(), rules } as SceneSettings} selection={selection} host={host} data={{ points }} params={params}>
      {(ctx) => <SceneWhatIf ctx={ctx} value={value} onChange={(v) => { setValue(v); onState(v); }} />}
    </Harness>
  );
}

function mount(o: { selection?: Selection; host?: EditorHost; params?: Record<string, unknown>; initial?: WhatIfState } = {}) {
  const states: WhatIfState[] = [];
  render(<Stateful onState={(s) => states.push(s)} {...o} />);
  return states;
}
const matchingIndices = () => [...document.querySelectorAll('[data-part="matching"] [data-rule]')].map((l) => Number(l.getAttribute('data-rule')));
const control = (label: string) => screen.getAllByLabelText(label).find((e) => e.tagName === 'INPUT' || e.tagName === 'SELECT') as HTMLInputElement;

describe('SceneWhatIf', () => {
  it('says nothing is stored, and shows no override to start with', () => {
    mount();
    expect(screen.getByText(/Nothing here is stored/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeDisabled();
  });

  it('works on the selected symbol, showing what the data says', () => {
    mount({ selection: { elements: ['pump1'] } });
    expect(screen.getByLabelText('Change')).toHaveValue('pump1');
    expect(control('Value')).toHaveValue(3);
    expect(screen.getByRole('checkbox', { name: 'Running' })).not.toBeChecked();
  });

  it('overrides value, second value and capacity from the number input and the slider', () => {
    const states = mount({ selection: { elements: ['tank1'] } });
    fireEvent.change(control('Value'), { target: { value: '90' } });
    expect(states.at(-1)).toEqual({ rows: { tank1: { value: 90 } }, params: {} });
    fireEvent.change(screen.getByRole('slider', { name: 'Second value (slider)' }), { target: { value: '25' } });
    fireEvent.change(control('Capacity'), { target: { value: '500' } });
    expect(states.at(-1)!.rows.tank1).toEqual({ value: 90, value2: 25, capacity: 500 });
    expect(screen.getByText('Data: 40')).toBeInTheDocument();
    expect(screen.getByText('3 values changed')).toBeInTheDocument();
  });

  it('puts one real value back, or all of them', () => {
    const states = mount({ selection: { elements: ['tank1'] } });
    fireEvent.change(control('Value'), { target: { value: '90' } });
    fireEvent.change(control('Capacity'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use the real Value' }));
    expect(states.at(-1)!.rows.tank1).toEqual({ capacity: 500 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(states.at(-1)).toEqual({ rows: {}, params: {} });
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeDisabled();
    expect(screen.queryAllByRole('button', { name: /Use the real/ })).toHaveLength(0);
  });

  it('toggles running and picks a status', () => {
    const states = mount({ selection: { elements: ['pump1'] } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Running' }));
    expect(states.at(-1)!.rows.pump1).toEqual({ running: true });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'critical' } });
    expect(states.at(-1)!.rows.pump1).toEqual({ running: true, status: 'critical' });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });
    expect(states.at(-1)!.rows.pump1).toEqual({ running: true });
    fireEvent.click(screen.getByRole('button', { name: 'Use the real Running' }));
    expect(states.at(-1)!.rows).toEqual({});
  });

  it('lists the rules that match with the overrides, and updates as they change', () => {
    mount({ selection: { elements: ['pump1'] } });
    expect(matchingIndices()).toEqual([]);
    expect(screen.getByText('No rule matches.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Running' }));
    expect(matchingIndices()).toEqual([0]);
    expect(screen.getByText('When running of this symbol is on, set the state to running')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'critical' } });
    expect(matchingIndices()).toEqual([0, 3]);
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'tank1' } });
    fireEvent.change(control('Value'), { target: { value: '99' } });
    expect(matchingIndices()).toEqual([0, 1, 3]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(matchingIndices()).toEqual([]);
  });

  it('changes every symbol at once for "all", and shows what varies', () => {
    const states = mount();
    expect(screen.getByLabelText('Change')).toHaveValue('*');
    fireEvent.change(control('Value'), { target: { value: '7' } });
    expect(Object.keys(states.at(-1)!.rows).sort()).toEqual(['pump1', 'tank1', 'valve1']);
    expect(Object.values(states.at(-1)!.rows).every((r) => r.value === 7)).toBe(true);
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'tank1' } });
    fireEvent.change(control('Value'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: '*' } });
    expect(control('Value')).toHaveValue(null);
    expect(control('Value')).toHaveAttribute('placeholder', 'varies');
  });

  it('overrides board parameters, as a select when the host lists values and a text box otherwise', () => {
    const states = mount({
      host: { params: [{ key: 'mode', label: 'Mode', values: ['day', 'night'] }, { key: 'site', label: 'Site' }] }, params: { mode: 'day', site: 'A' },
    });
    expect(matchingIndices()).toEqual([]);
    fireEvent.change(control('Mode'), { target: { value: 'night' } });
    expect(states.at(-1)!.params).toEqual({ mode: 'night' });
    expect(matchingIndices()).toEqual([2]);
    expect(screen.getByText('tank1, pump1, valve1 and line1')).toBeInTheDocument();
    fireEvent.change(control('Site'), { target: { value: 'B' } });
    expect(states.at(-1)!.params).toEqual({ mode: 'night', site: 'B' });
    fireEvent.click(screen.getByRole('button', { name: 'Use the real Mode' }));
    expect(states.at(-1)!.params).toEqual({ site: 'B' });
    fireEvent.change(control('Site'), { target: { value: '' } });
    expect(states.at(-1)!.params).toEqual({});
  });

  it('says so when the board has no parameters', () => {
    mount();
    expect(screen.getByText('The board has no parameters rules can read.')).toBeInTheDocument();
  });

  it('starts from an override already in the state, and names the symbol it is for', () => {
    mount({ selection: { elements: ['tank1'] }, initial: { rows: { tank1: { value: 55 } }, params: {} } });
    expect(control('Value')).toHaveValue(55);
    expect(within(screen.getByRole('group', { name: /tank1/ })).getByLabelText('Value')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeEnabled();
  });

  it('survives a symbol that was selected and then deleted, and a scene with no symbols', () => {
    render(<Harness initial={{ width: 400 } as SceneSettings} selection={{ elements: ['gone'] }}>{(ctx) => <SceneWhatIf ctx={ctx} value={emptyWhatIf()} onChange={() => {}} />}</Harness>);
    expect(screen.getByLabelText('Change')).toHaveValue('*');
    expect(control('Value')).toBeDisabled();
  });
});
