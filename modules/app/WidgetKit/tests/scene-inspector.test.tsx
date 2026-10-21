import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SceneSettings } from '../views/scada-scene-logic';
import { SceneInspector } from '../views/SceneInspector';
import type { Rec, Selection } from '../views/scene-edit-logic';
import type { EditorHost } from '../views/scene-editor-types';
import { WidgetKitProvider } from '../WidgetKitContext';
import { Harness, newProbe } from './scene-panel-harness';
import { smallScene } from './scene-edit-fixture';

/** The input, select or text area a field's label names (a group heading can carry the same words). */
const ctl = (label: string): HTMLElement => screen.getAllByLabelText(label).find((e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName))!;

const els = (p: ReturnType<typeof newProbe>) => p.current!.ctx.settings.elements as Rec[];
const links = (p: ReturnType<typeof newProbe>) => p.current!.ctx.settings.links as Rec[];
const shapes = (p: ReturnType<typeof newProbe>) => p.current!.ctx.settings.shapes as Rec[];
const el = (p: ReturnType<typeof newProbe>, id: string) => els(p).find((e) => e.id === id)!;

function mount(o: { selection?: Selection; host?: EditorHost; scene?: SceneSettings; wrap?: (n: ReactNode) => ReactNode } = {}) {
  const probe = newProbe();
  const ui = (
    <Harness initial={o.scene ?? smallScene()} selection={o.selection} host={o.host} probe={probe}>
      {(ctx) => <SceneInspector ctx={ctx} />}
    </Harness>
  );
  const view = render(o.wrap ? <>{o.wrap(ui)}</> : ui);
  return { probe, ...view };
}

describe('SceneInspector: tabs', () => {
  it('has Properties and Rules, and Actions only when the host brings an actions editor', () => {
    const a = mount();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Properties', 'Rules']);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    a.unmount();
    mount({ host: { renderActions: (id) => <div data-testid="actions">Actions of {id}</div> }, selection: { elements: ['pump1'] } });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Properties', 'Rules', 'Actions']);
  });
  it('moves between the tabs with the arrow keys, one tab stop, and shows the rules', () => {
    mount({ selection: { elements: ['pump1'] } });
    const [props, rules] = screen.getAllByRole('tab');
    expect(props).toHaveAttribute('aria-selected', 'true');
    expect(props.tabIndex).toBe(0);
    expect(rules.tabIndex).toBe(-1);
    props.focus();
    fireEvent.keyDown(props, { key: 'ArrowRight' });
    expect(rules).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(rules);
    expect(document.querySelector('[data-panel="rules"]')).toBeInTheDocument();
    fireEvent.keyDown(rules, { key: 'ArrowRight' });
    expect(props).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(props, { key: 'End' });
    expect(rules).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(rules, { key: 'Home' });
    expect(props).toHaveAttribute('aria-selected', 'true');
  });
  it('renders the host\'s actions for the selected symbol, or says to select one', () => {
    const host = { renderActions: (id: string) => <div data-testid="actions">Actions of {id}</div> };
    const a = mount({ host, selection: { elements: ['pump1'] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }));
    expect(screen.getByTestId('actions')).toHaveTextContent('Actions of pump1');
    a.unmount();
    mount({ host, selection: { elements: ['pump1', 'tank1'] } });
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }));
    expect(screen.queryByTestId('actions')).toBeNull();
    expect(screen.getByText('Select a symbol to see its actions.')).toBeInTheDocument();
  });
  it('can be driven by the shell, and falls back to Properties when Actions is not there', () => {
    const picked: string[] = [];
    const probe = newProbe();
    render(
      <Harness initial={smallScene()} probe={probe}>
        {(ctx) => <SceneInspector ctx={ctx} tab="rules" onTabChange={(t) => picked.push(t)} />}
      </Harness>,
    );
    expect(document.querySelector('[data-panel="rules"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Properties' }));
    expect(picked).toEqual(['properties']);
    render(<Harness initial={smallScene()}>{(ctx) => <SceneInspector ctx={ctx} tab="actions" />}</Harness>);
    expect(screen.getAllByRole('tab', { selected: true }).map((t) => t.textContent)).toContain('Properties');
  });
});

describe('SceneInspector: the diagram', () => {
  it('shows the scene\'s fields when nothing is selected, in groups', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Diagram' })).toBeInTheDocument();
    for (const g of ['Canvas', 'Look', 'Colours', 'Data']) expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    expect(ctl('Canvas width')).toHaveValue(1000);
    expect(ctl('Canvas height')).toHaveValue(600);
    expect(ctl('Symbol size')).toHaveValue(0.6);
  });
  it('writes the canvas and the look, one undo step per edit', () => {
    const { probe } = mount();
    fireEvent.change(ctl('Canvas width'), { target: { value: '1400' } });
    expect(probe.current!.ctx.settings.width).toBe(1400);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Background' })).getByRole('radio', { name: 'Dots' }));
    expect(probe.current!.ctx.settings.background).toBe('dots');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'View' })).getByRole('radio', { name: 'The whole canvas' }));
    expect(probe.current!.ctx.settings.fit).toBe('canvas');
    expect(probe.current!.history.past.length).toBe(3);
    act(() => probe.current!.undo());
    expect(probe.current!.ctx.settings.fit).toBeUndefined();
  });
  it('refuses a width the canvas cannot have, shows why, and keeps the scene', () => {
    const { probe } = mount();
    fireEvent.change(ctl('Canvas width'), { target: { value: '50' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/200 to 4000/);
    expect(probe.current!.ctx.settings.width).toBe(1000);
    fireEvent.change(ctl('Canvas width'), { target: { value: '800' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(probe.current!.ctx.settings.width).toBe(800);
  });
  it('changes what x and y mean without moving the symbols', () => {
    const { probe } = mount();
    const before = probe.current!.ctx.model.hits.map((h) => [h.id, h.x, h.y]);
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /x and y are a symbol's/ })).getByRole('radio', { name: 'Top-left corner' }));
    expect(probe.current!.ctx.settings.anchor).toBe('corner');
    expect(probe.current!.ctx.model.hits.map((h) => [h.id, h.x, h.y])).toEqual(before);
  });
  it('writes the scene colours and refuses a text that is not a colour', () => {
    const { probe } = mount();
    const group = screen.getByRole('heading', { name: 'Colours' }).closest('section')!;
    fireEvent.click(within(within(group).getByRole('radiogroup', { name: 'Idle: theme colours' })).getByRole('radio', { name: 'Info' }));
    expect(probe.current!.ctx.settings.idleColor).toBe('var(--info)');
    const box = within(group).getAllByRole('textbox')[0];
    fireEvent.change(box, { target: { value: '#12' } });
    expect(screen.getByRole('alert')).toHaveTextContent('This is not a colour.');
    expect(probe.current!.ctx.settings.idleColor).toBe('var(--info)');
    fireEvent.change(box, { target: { value: '#123456' } });
    expect(probe.current!.ctx.settings.idleColor).toBe('#123456');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Clear Idle' }));
    expect('idleColor' in probe.current!.ctx.settings).toBe(false);
  });
});

describe('SceneInspector: a symbol', () => {
  it('shows its name and id and the template\'s fields in groups', () => {
    mount({ selection: { elements: ['pump1'] } });
    expect(screen.getByRole('heading', { name: 'Mud pump (pump1)' })).toBeInTheDocument();
    for (const g of ['Symbol', 'Position and size', 'Name and number', 'Medium', 'Colours']) expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    expect(ctl('Id')).toHaveValue('pump1');
    expect(ctl('Symbol')).toHaveValue('pump.volute');
    expect(ctl('x')).toHaveValue(300);
    for (const label of ['Name', 'Name position', 'Own size', 'Unit', 'Decimals']) expect(ctl(label)).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: /theme colours/ }).map((g) => g.getAttribute('aria-label'))).toEqual(
      expect.arrayContaining(['Liquid colour: theme colours', 'Idle colour: theme colours', 'Running colour: theme colours', 'Warning colour: theme colours', 'Critical colour: theme colours']));
  });
  it('shows the scale, the number and the length only where the symbol has them', () => {
    const a = mount({ selection: { elements: ['pump1'] } });
    for (const label of ['Minimum', 'Maximum', 'Show the number', 'Number position', 'Length (cells)']) expect(screen.queryAllByLabelText(label)).toHaveLength(0);
    a.unmount();
    mount({ selection: { elements: ['tank1'] } });
    for (const label of ['Minimum', 'Maximum', 'Number position']) expect(ctl(label)).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Length (cells)')).toHaveLength(0);
  });
  it('shows the medium colour for a colour of its own only', () => {
    mount({ selection: { elements: ['pump1'] } });
    expect(screen.queryAllByLabelText('Medium colour')).toHaveLength(0);
    fireEvent.change(ctl('Medium'), { target: { value: 'custom' } });
    expect(ctl('Medium colour')).toBeInTheDocument();
  });
  it('writes the name as one undo step however many letters are typed, and removes it when emptied', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    const box = ctl('Name');
    for (const v of ['M', 'Ma', 'Mai', 'Main']) fireEvent.change(box, { target: { value: v } });
    expect(el(probe, 'pump1').label).toBe('Main');
    expect(probe.current!.history.past).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Main (pump1)' })).toBeInTheDocument();
    fireEvent.change(box, { target: { value: '' } });
    expect('label' in el(probe, 'pump1')).toBe(false);
    // Typing and emptying the same field is one session: one undo step takes the whole of it back.
    expect(probe.current!.history.past).toHaveLength(1);
    act(() => probe.current!.undo());
    expect('label' in el(probe, 'pump1')).toBe(false);
  });
  it('writes turn, flip, own size, positions, medium and the five colours through the edit model', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    fireEvent.change(ctl('Turn'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Enabled/i }) as HTMLElement);
    expect(el(probe, 'pump1').turn).toBe('90');
    fireEvent.change(ctl('Own size'), { target: { value: '1.5' } });
    expect(el(probe, 'pump1').scale).toBe(1.5);
    fireEvent.change(ctl('Own size'), { target: { value: '' } });
    expect('scale' in el(probe, 'pump1')).toBe(false);
    fireEvent.change(ctl('Name position'), { target: { value: 't' } });
    expect(el(probe, 'pump1').labelPos).toBe('t');
    fireEvent.change(ctl('x'), { target: { value: '340' } });
    expect(el(probe, 'pump1').x).toBe(340);
    fireEvent.change(ctl('Unit'), { target: { value: 'bar' } });
    fireEvent.change(ctl('Decimals'), { target: { value: '2' } });
    expect(el(probe, 'pump1')).toMatchObject({ unit: 'bar', decimals: 2 });
    for (const [group, name] of [['Idle colour', 'Info'], ['Running colour', 'Success'], ['Warning colour', 'Warning'], ['Critical colour', 'Error'], ['Liquid colour', 'Primary']] as const) {
      fireEvent.click(within(screen.getByRole('radiogroup', { name: `${group}: theme colours` })).getByRole('radio', { name }));
    }
    expect(el(probe, 'pump1')).toMatchObject({ idleColor: 'var(--info)', runningColor: 'var(--success)', warningColor: 'var(--warning)', criticalColor: 'var(--error)', fillColor: 'var(--primary)' });
  });
  it('refuses an own size outside the range, shows why, and keeps the symbol', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    fireEvent.change(ctl('Own size'), { target: { value: '9' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/scale must be a number from 0.2 to 4/);
    expect(el(probe, 'pump1').scale).toBeUndefined();
  });
  it('changes the symbol of the selection', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    fireEvent.change(ctl('Symbol'), { target: { value: 'valve.ball' } });
    expect(el(probe, 'pump1').symbol).toBe('valve.ball');
  });
});

describe('SceneInspector: renaming a symbol', () => {
  it('renames on Enter, follows the selection, and takes the connections and rules with it', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'pumpA' } });
    expect(el(probe, 'pump1')).toBeDefined();
    expect(probe.current!.history.past).toHaveLength(0);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(els(probe).map((e) => e.id)).toEqual(['tank1', 'pumpA', 'valve1']);
    expect(links(probe).map((l) => [l.from, l.to])).toEqual([['tank1.r', 'pumpA.l'], ['pumpA.r', 'valve1.l:0.5']]);
    expect((probe.current!.ctx.settings as { rules: Rec[] }).rules.some((r) => r.target === 'pumpA')).toBe(true);
    expect(probe.current!.ctx.selection).toEqual({ elements: ['pumpA'] });
    expect(ctl('Id')).toHaveValue('pumpA');
    expect(screen.getByRole('status')).toHaveTextContent('Renamed to pumpA');
    expect(probe.current!.history.past).toHaveLength(1);
  });
  it('renames when the field is left', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'p2' } });
    fireEvent.blur(box);
    expect(els(probe).map((e) => e.id)).toContain('p2');
  });
  it('refuses an id another symbol has, and one the table cannot use, with the reason and the typed text kept', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'tank1' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('Another symbol already has this id');
    expect(box).toHaveValue('tank1');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(els(probe).map((e) => e.id)).toEqual(['tank1', 'pump1', 'valve1']);
    fireEvent.change(box, { target: { value: '1bad id' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(/starts with a letter/);
    fireEvent.change(box, { target: { value: 'ok2' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('goes back to the id on Escape and does nothing for an unchanged id', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    const box = ctl('Id');
    fireEvent.change(box, { target: { value: 'zzz' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(box).toHaveValue('pump1');
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(probe.current!.history.past).toHaveLength(0);
  });
});

describe('SceneInspector: several symbols', () => {
  it('shows only what they share, marks what differs, and writes a change to every one', () => {
    const { probe } = mount({ selection: { elements: ['pump1', 'valve1'] } });
    expect(screen.getByRole('heading', { name: '2 symbols' })).toBeInTheDocument();
    expect(screen.getByText(/Showing the fields they share/)).toBeInTheDocument();
    expect(screen.queryAllByLabelText('Id')).toHaveLength(0);
    expect(screen.queryAllByLabelText('x')).toHaveLength(0);
    const field = (l: string) => ctl(l).closest('[data-field]') as HTMLElement;
    expect(within(field('Symbol')).getByText('differs')).toBeInTheDocument();
    expect(within(field('Turn')).queryByText('differs')).toBeNull();
    fireEvent.change(ctl('Name'), { target: { value: 'Same' } });
    expect(els(probe).filter((e) => e.label === 'Same').map((e) => e.id)).toEqual(['pump1', 'valve1']);
    expect(el(probe, 'tank1').label).toBe('Feed');
    expect(within(field('Name')).queryByText('differs')).toBeNull();
  });
  it('writes a colour to all of them as one undo step', () => {
    const { probe } = mount({ selection: { elements: ['pump1', 'tank1', 'valve1'] } });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Running colour: theme colours' })).getByRole('radio', { name: 'Success' }));
    expect(els(probe).every((e) => e.runningColor === 'var(--success)')).toBe(true);
    expect(probe.current!.history.past).toHaveLength(1);
  });
});

describe('SceneInspector: a connection', () => {
  it('shows from, to, kind, medium, id, arrows and the middle leg', () => {
    mount({ selection: { links: [1] } });
    expect(screen.getByRole('heading', { name: 'Connection 2' })).toBeInTheDocument();
    expect(ctl('From')).toHaveValue('pump1.r');
    expect(ctl('To')).toHaveValue('valve1.l:0.5');
    expect(ctl('State from row')).toHaveValue('line1');
    for (const label of ['Kind', 'Medium', 'Middle leg at', 'Flow arrow']) expect(ctl(label)).toBeInTheDocument();
  });
  it('writes kind, medium, arrows and the middle leg, and clears the leg', () => {
    const { probe } = mount({ selection: { links: [0] } });
    fireEvent.change(ctl('Kind'), { target: { value: 'hose' } });
    fireEvent.change(ctl('Medium'), { target: { value: 'hot' } });
    fireEvent.change(ctl('Middle leg at'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Enabled/i }));
    expect(links(probe)[0]).toMatchObject({ kind: 'hose', medium: 'hot', mid: 200, arrows: true });
    fireEvent.change(ctl('Middle leg at'), { target: { value: '' } });
    expect('mid' in links(probe)[0]).toBe(false);
  });
  it('moves an end on commit, and refuses a symbol that is not there', () => {
    const { probe } = mount({ selection: { links: [0] } });
    const to = ctl('To');
    fireEvent.change(to, { target: { value: 'ghost.t' } });
    fireEvent.keyDown(to, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('No symbol has this id');
    expect(links(probe)[0].to).toBe('pump1.l');
    fireEvent.change(to, { target: { value: 'valve1.t' } });
    fireEvent.keyDown(to, { key: 'Enter' });
    expect(links(probe)[0].to).toBe('valve1.t');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('renames the connection\'s row id and the rules follow', () => {
    const { probe } = mount({ selection: { links: [1] } });
    const id = ctl('State from row');
    fireEvent.change(id, { target: { value: 'feed' } });
    fireEvent.keyDown(id, { key: 'Enter' });
    expect(links(probe)[1].id).toBe('feed');
    expect((probe.current!.ctx.settings as { rules: Rec[] }).rules.some((r) => r.target === 'feed')).toBe(true);
  });
  it('shows the shared fields of several connections and writes to each', () => {
    const { probe } = mount({ selection: { links: [0, 1] } });
    expect(screen.getByRole('heading', { name: '2 connections' })).toBeInTheDocument();
    expect(screen.queryAllByLabelText('From')).toHaveLength(0);
    fireEvent.change(ctl('Medium'), { target: { value: 'cold' } });
    expect(links(probe).map((l) => l.medium)).toEqual(['cold', 'cold']);
  });
});

describe('SceneInspector: titles, zones and dividers', () => {
  it('gives each kind the fields it uses', () => {
    const a = mount({ selection: { shapes: [0] } });
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(ctl('Words')).toHaveValue('Plant');
    expect(screen.queryAllByLabelText('Width')).toHaveLength(0);
    expect(ctl('Text size')).toBeInTheDocument();
    a.unmount();
    mount({ selection: { shapes: [1] } });
    expect(screen.getByRole('heading', { name: 'Zone' })).toBeInTheDocument();
    expect(ctl('Width')).toHaveValue(560);
    expect(screen.queryAllByLabelText('Text size')).toHaveLength(0);
    expect(ctl('Tone')).toBeInTheDocument();
  });
  it('writes the words, the tone and the size (a zone keeps at least 20)', () => {
    const { probe } = mount({ selection: { shapes: [1] } });
    fireEvent.change(ctl('Words'), { target: { value: 'Zone B' } });
    fireEvent.change(ctl('Tone'), { target: { value: 'warning' } });
    fireEvent.change(ctl('Width'), { target: { value: '5' } });
    expect(shapes(probe)[1]).toMatchObject({ text: 'Zone B', tone: 'warning', w: 20 });
  });
  it('writes a divider\'s length', () => {
    const { probe } = mount({ selection: { shapes: [2] } });
    expect(screen.getByRole('heading', { name: 'Divider' })).toBeInTheDocument();
    fireEvent.change(ctl('Width'), { target: { value: '700' } });
    expect(shapes(probe)[2]).toMatchObject({ w: 700, h: 0 });
  });
});

describe('SceneInspector: mixed selections and the host\'s words', () => {
  it('asks to select one kind when symbols and connections are selected together', () => {
    mount({ selection: { elements: ['pump1'], links: [0] } });
    expect(screen.getByText('You selected 1 symbols, 1 connections and 0 shapes. Select one kind to edit its fields.')).toBeInTheDocument();
  });
  it('shows the template\'s texts in the host\'s language through templateText, and its own messages over the English ones', () => {
    const probe = newProbe();
    render(
      <WidgetKitProvider value={{ templateText: (ref) => (ref.templateId === 'builtin:scada.scene' && ref.path === 'elements.label' && ref.prop === 'label' ? 'Ad' : undefined) }}>
        <Harness initial={smallScene()} selection={{ elements: ['pump1'] }} probe={probe}>
          {(ctx) => <SceneInspector ctx={ctx} messages={{ tabs: { rules: 'Kurallar' }, groups: { label: 'Ad ve sayi' } }} />}
        </Harness>
      </WidgetKitProvider>,
    );
    expect(ctl('Ad')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kurallar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ad ve sayi' })).toBeInTheDocument();
  });
  it('falls back to the diagram when the selected symbol is gone', () => {
    const { probe } = mount({ selection: { elements: ['pump1'] } });
    act(() => probe.current!.ctx.setSelection({ elements: ['ghost'] }));
    expect(screen.getByRole('heading', { name: 'Diagram' })).toBeInTheDocument();
  });
});
