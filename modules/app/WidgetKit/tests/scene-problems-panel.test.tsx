import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SceneSettings } from '../views/scada-scene-logic';
import { SceneProblems } from '../views/SceneProblems';
import type { Rec } from '../views/scene-edit-logic';
import { problemTarget } from '../views/scene-problems-rules';
import type { EditorHost } from '../views/scene-editor-types';
import { Harness } from './scene-panel-harness';
import { smallScene } from './scene-edit-fixture';

function mount(s: SceneSettings, o: { host?: EditorHost; data?: object; onSelect?: (id: string) => void; onOpenRule?: (i: number) => void; messages?: object } = {}) {
  const onSelect = o.onSelect ?? vi.fn();
  render(
    <Harness initial={s} host={o.host} data={(o.data ?? {}) as never}>
      {(ctx) => <SceneProblems ctx={ctx} onSelect={onSelect} onOpenRule={o.onOpenRule} messages={o.messages} />}
    </Harness>,
  );
  return onSelect;
}

describe('SceneProblems', () => {
  it('says so when nothing is wrong', () => {
    mount({ ...smallScene(), rules: [] } as SceneSettings);
    expect(screen.getByRole('status')).toHaveTextContent(/No problems found/);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('groups by severity, errors first, with a summary, and each item is a labelled button', () => {
    const s = {
      ...smallScene(),
      elements: [...(smallScene().elements as Rec[]), { id: 'far', symbol: 'tank.open', x: 5000, y: 10 }, { id: 'bad', symbol: 'nope', x: 1, y: 1 }],
      links: [...(smallScene().links as Rec[]), { from: 'ghost.r', to: 'tank1.l' }],
      rules: [{ target: 'ghost', state: 'idle' }, { target: 'pump1', state: 'idle', source: 'param', key: 'mode', op: 'set' }],
    } as SceneSettings;
    mount(s, { host: { params: [{ key: 'site' }] } });
    const sections = [...document.querySelectorAll('[data-severity]')].map((x) => x.getAttribute('data-severity'));
    expect(sections).toEqual(['error', 'warning']);
    expect(screen.getByRole('heading', { name: /Errors/ })).toBeInTheDocument();
    expect(screen.getByText(/\d+ errors?, \d+ warnings?/)).toBeInTheDocument();
    const errors = within(document.querySelector('[data-severity="error"]') as HTMLElement).getAllByRole('button');
    expect(errors.map((b) => b.getAttribute('data-code'))).toEqual(expect.arrayContaining(['unknown-symbol', 'dangling-link', 'rule-target-missing']));
    expect(screen.getByRole('button', { name: /Select far: far is outside the canvas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rule 2 reads the parameter mode/ })).toBeInTheDocument();
  });

  it('selects what a problem is about: a symbol, a connection, a shape, the scene', () => {
    const s = {
      ...smallScene(),
      elements: [...(smallScene().elements as Rec[]), { id: 'far', symbol: 'tank.open', x: 5000, y: 10 }],
      links: [...(smallScene().links as Rec[]), { from: 'ghost.r', to: 'tank1.l' }],
      shapes: [...(smallScene().shapes as Rec[]), { kind: 'text', x: 10, y: 10, text: '' }],
      rules: [],
    } as SceneSettings;
    const onSelect = vi.fn();
    mount(s, { onSelect });
    fireEvent.click(screen.getByRole('button', { name: /far is outside/ }));
    fireEvent.click(screen.getByRole('button', { name: /Connection 3 ends on a symbol/ }));
    fireEvent.click(screen.getByRole('button', { name: /A title has no words/ }));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['far', 'link:2', 'shape:3']);
  });

  it('opens a rule problem: onOpenRule first, then the rule\'s target (or the scene when it names nothing)', () => {
    const s = { ...smallScene(), rules: [{ target: 'pump1', key: 'a', op: 'set', of: 'ghost' }, { target: 'ghost', state: 'idle' }, { target: 'line1', key: 'a', op: 'set', of: 'ghost2' }] } as SceneSettings;
    const calls: string[] = [];
    mount(s, { onSelect: (id) => calls.push(`select:${id}`), onOpenRule: (i) => calls.push(`rule:${i}`) });
    fireEvent.click(screen.getByRole('button', { name: /Rule 1 reads the row of ghost/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rule 2 targets ghost/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rule 3 reads the row of ghost2/ }));
    expect(calls).toEqual(['rule:0', 'select:pump1', 'rule:1', 'select:scene', 'rule:2', 'select:link:1']);
  });

  it('uses the columns the host declares for the never-matching check', () => {
    mount({ ...smallScene(), rules: [{ target: 'pump1', key: 'temp', op: 'gt', value: '1', state: 'warning' }] } as SceneSettings, { host: { columns: [{ key: 'value' }] } });
    expect(screen.getByRole('button', { name: /can never hold/ })).toBeInTheDocument();
  });

  it('flags a symbol with no row in the bound table', () => {
    mount({ ...smallScene(), rules: [] } as SceneSettings, { data: { points: { shape: 'table', rows: [{ id: 'pump1' }] } } });
    expect(screen.getByRole('button', { name: /tank1 has no row in the bound table/ })).toBeInTheDocument();
  });

  it('takes the host\'s texts: the headings and a text for a problem', () => {
    mount({ ...smallScene(), rules: [{ target: 'ghost' }] } as SceneSettings, {
      messages: { groups: { error: 'Hatalar' }, text: (p: { code: string }) => (p.code === 'rule-target-missing' ? 'Kural bos' : undefined) },
    });
    expect(screen.getByRole('heading', { name: /Hatalar/ })).toBeInTheDocument();
    expect(screen.getByText('Kural bos')).toBeInTheDocument();
  });
});

describe('problemTarget', () => {
  const s = smallScene();
  it('passes ordinary ids through and resolves rule ids', () => {
    expect(problemTarget({ id: 'pump1' }, s)).toEqual({ select: 'pump1' });
    expect(problemTarget({ id: 'link:1' }, s)).toEqual({ select: 'link:1' });
    expect(problemTarget({ id: 'rule:0' }, s)).toEqual({ select: 'pump1', rule: 0 });
    expect(problemTarget({ id: 'rule:3' }, s)).toEqual({ select: 'link:1', rule: 3 });
    expect(problemTarget({ id: 'rule:1' }, s)).toEqual({ select: 'scene', rule: 1 });
    expect(problemTarget({ id: 'rule:99' }, s)).toEqual({ select: 'scene', rule: 99 });
  });
});
