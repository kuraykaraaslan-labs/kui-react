import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import type { SceneSettings } from '../views/scada-scene-logic';
import { ScenePalette } from '../views/ScenePalette';
import { SceneInspector } from '../views/SceneInspector';
import { SceneProblems } from '../views/SceneProblems';
import { SceneWhatIf } from '../views/SceneWhatIf';
import type { Rec, Selection } from '../views/scene-edit-logic';
import { emptyWhatIf } from '../views/scene-whatif-logic';
import { DEFAULT_PANEL_MESSAGES, mergeMessages } from '../views/scene-editor-messages-panels';
import { Harness } from './scene-panel-harness';
import { smallScene } from './scene-edit-fixture';
import { fireEvent } from '@testing-library/react';

const rules: Rec[] = [
  { target: 'pump1', key: 'value', op: 'between', value: '1', to: '5', op2: 'eq', key2: 'mode', source2: 'param', value2: 'x', join: 'any', state: 'warning', label: 'High' },
  { target: '*', op: '', stop: true },
];
const scene = { ...smallScene(), rules } as SceneSettings;
const host = { params: [{ key: 'mode', label: 'Mode', values: ['day', 'night'] }, { key: 'site' }], columns: [{ key: 'value', label: 'Value' }], renderActions: (id: string) => <button type="button">Edit actions of {id}</button> };

/** The name a screen reader says for a control: aria-label, aria-labelledby, a label for it or around it, its own text, its title. */
function nameOf(el: HTMLElement): string {
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  const own = el.getAttribute('aria-label');
  if (own) return own.trim();
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length) return [...labels].map((l) => l.textContent ?? '').join(' ').trim();
  const wrap = el.closest('label');
  if (wrap) return (wrap.textContent ?? '').trim();
  return (el.textContent ?? el.getAttribute('title') ?? '').trim() || (el.getAttribute('title') ?? '').trim();
}

/** Every control a person can reach has a name a screen reader can say, and every image-only thing is hidden from them. */
function unnamed(root: HTMLElement): string[] {
  const out: string[] = [];
  root.querySelectorAll<HTMLElement>('input, select, textarea, button, [role="option"], [role="radio"], [role="tab"], [role="slider"]').forEach((el) => {
    if ((el as HTMLInputElement).type === 'hidden') return;
    if (!nameOf(el)) out.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}[${el.className.slice(0, 30)}]`);
  });
  return out;
}

const mount = (selection: Selection, tab: 'properties' | 'rules' = 'properties') =>
  render(
    <Harness initial={scene} selection={selection} host={host} data={{ points: { shape: 'table', rows: [{ id: 'pump1', value: 3 }] } }}>
      {(ctx) => <SceneInspector ctx={ctx} tab={tab} />}
    </Harness>,
  );

describe('the panels are usable without a pointer or a screen', () => {
  it('gives every control of the palette a name, and the tiles a listbox with options', () => {
    const { container } = render(<ScenePalette onAdd={() => {}} recent={['valve']} />);
    expect(unnamed(container)).toEqual([]);
    expect(container.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(240);
    expect(container.querySelectorAll('svg:not([aria-hidden="true"])')).toHaveLength(0);
  });
  it('gives every control of the inspector a name, for each kind of selection', () => {
    for (const sel of [{}, { elements: ['pump1'] }, { elements: ['pump1', 'tank1'] }, { links: [1] }, { links: [0, 1] }, { shapes: [1] }, { shapes: [0] }] as Selection[]) {
      const { container, unmount } = mount(sel);
      expect(unnamed(container), JSON.stringify(sel)).toEqual([]);
      unmount();
    }
  });
  it('gives every control of the rules editor a name, with every card open', () => {
    const { container } = mount({ elements: ['pump1'] }, 'rules');
    container.querySelectorAll<HTMLElement>('[aria-expanded="false"]').forEach((b) => fireEvent.click(b));
    expect(container.querySelectorAll('[data-rule] [id$="-state"]').length).toBeGreaterThan(0);
    expect(unnamed(container)).toEqual([]);
  });
  it('names the problem buttons and the what-if controls', () => {
    const a = render(
      <Harness initial={scene} host={host}>{(ctx) => <SceneProblems ctx={ctx} onSelect={() => {}} />}</Harness>,
    );
    expect(unnamed(a.container)).toEqual([]);
    a.unmount();
    const b = render(
      <Harness initial={scene} host={host} selection={{ elements: ['pump1'] }}>{(ctx) => <SceneWhatIf ctx={ctx} value={{ rows: { pump1: { value: 3 } }, params: { mode: 'day' } }} onChange={() => {}} />}</Harness>,
    );
    expect(unnamed(b.container)).toEqual([]);
  });
  it('wires every error message to its field, and the invalid field is marked', () => {
    const { container } = mount({ elements: ['pump1'] });
    const id = container.querySelector<HTMLInputElement>('input[id$="-id"]')!;
    fireEvent.change(id, { target: { value: 'tank1' } });
    fireEvent.keyDown(id, { key: 'Enter' });
    const alert = container.querySelector('[role="alert"]')!;
    expect(id).toHaveAttribute('aria-invalid', 'true');
    expect(id.getAttribute('aria-describedby')).toContain(alert.id);
  });
  it('uses no colour of its own: theme classes and tokens only, in the markup and in the sources', () => {
    const { container } = mount({ elements: ['pump1'] });
    expect(container.innerHTML).not.toMatch(/style="[^"]*(#[0-9a-fA-F]{3,8}|rgb\(|hsl\()/);
    for (const file of ['ScenePalette.tsx', 'SceneInspector.tsx', 'SceneRulesEditor.tsx', 'SceneProblems.tsx', 'SceneWhatIf.tsx', 'scene-panel-ui.tsx']) {
      const source = readFileSync(join(__dirname, '..', 'views', file), 'utf8');
      expect(source, file).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}['"`]/);
      expect(source, file).not.toMatch(/\b(?:rgb|hsl)a?\(/);
    }
  });
});

describe('panel messages', () => {
  it('merges any part over the English ones without changing the defaults, and keeps functions', () => {
    const merged = mergeMessages(DEFAULT_PANEL_MESSAGES, { palette: { search: 'Ara', families: { sld: 'Tek hat' } }, rules: { words: { ops: { gt: 'üstünde {value}' } } } });
    expect(merged.palette.search).toBe('Ara');
    expect(merged.palette.families.sld).toBe('Tek hat');
    expect(merged.palette.families.hvac).toBe('HVAC');
    expect(merged.rules.words.ops.gt).toBe('üstünde {value}');
    expect(merged.rules.words.ops.lt).toBe('is below {value}');
    expect(merged.palette.count(2)).toBe('2 symbols');
    expect(DEFAULT_PANEL_MESSAGES.palette.search).toBe('Search symbols');
    expect(DEFAULT_PANEL_MESSAGES.rules.words.ops.gt).toBe('is above {value}');
    expect(mergeMessages(DEFAULT_PANEL_MESSAGES, undefined)).toBe(DEFAULT_PANEL_MESSAGES);
    expect(mergeMessages(DEFAULT_PANEL_MESSAGES, { palette: { search: undefined } }).palette.search).toBe('Search symbols');
  });
  it('has an English text for every family, sector, state, operator and severity the panels can show', () => {
    const m = DEFAULT_PANEL_MESSAGES;
    for (const group of [m.palette.families, m.palette.sectors, m.rules.states, m.rules.opLabels, m.rules.words.ops, m.rules.words.states, m.problems.groups, m.whatIf.statuses]) {
      for (const [k, v] of Object.entries(group)) expect(typeof v === 'string' && v.length > 0, k).toBe(true);
    }
    expect(Object.keys(m.palette.families)).toHaveLength(33);
    expect(Object.keys(m.palette.sectors)).toHaveLength(24);
  });
});
