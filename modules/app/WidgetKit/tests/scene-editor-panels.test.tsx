// The editor shell against the contract of its four panels. The panels are replaced by small probes here, so these tests
// keep holding when the real panels land: they check what the shell hands over and what it does with what comes back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { smallScene } from './scene-edit-fixture';
import { at, boxes, element, elements, fireEvent, key, mockLayout, mount, screen, selected, viewBox } from './scene-editor-harness';
import { moveElements } from '../views/scene-edit-logic';
import { sceneModel } from '../views/scada-scene-logic';
import type { EditorCtx, WhatIfState } from '../views/scene-editor-types';

const seen: { ctx?: EditorCtx; whatIf?: WhatIfState } = {};

vi.mock('../views/ScenePalette', () => ({
  ScenePalette: (p: { onAdd: (s: string) => void; onDragStart?: (s: string, e: React.PointerEvent) => void; recent?: string[] }) => (
    <div data-testid="palette-probe">
      <button type="button" onClick={() => p.onAdd('pump.volute')}>add pump</button>
      <button type="button" onClick={() => p.onAdd('valve.ball')}>add valve</button>
      <button type="button" data-testid="palette-drag" onPointerDown={(e) => p.onDragStart?.('valve.ball', e)}>drag valve</button>
      <output data-testid="recent">{(p.recent ?? []).join(',')}</output>
    </div>
  ),
}));

vi.mock('../views/SceneInspector', () => ({
  SceneInspector: ({ ctx }: { ctx: EditorCtx }) => {
    seen.ctx = ctx;
    return (
      <div data-testid="inspector-probe">
        <output data-testid="probe-selection">{JSON.stringify(ctx.selection)}</output>
        <output data-testid="probe-hits">{ctx.model.hits.map((h) => h.id).join(',')}</output>
        <output data-testid="probe-data">{JSON.stringify(ctx.data)}</output>
        <output data-testid="probe-params">{JSON.stringify(ctx.params)}</output>
        <output data-testid="probe-pump">{JSON.stringify((ctx.settings.elements as Array<{ id: string; x: number }>).find((e) => e.id === 'pump1')?.x)}</output>
        <button type="button" onClick={() => ctx.apply((s) => moveElements(s, ['pump1'], 10, 0), 'probe')}>nudge pump</button>
        <button type="button" onClick={() => ctx.apply((s) => moveElements(s, ['tank1'], 10, 0))}>nudge tank</button>
        <button type="button" onClick={() => ctx.setSelection({ elements: ['tank1'] })}>select tank</button>
      </div>
    );
  },
}));

vi.mock('../views/SceneProblems', () => ({
  SceneProblems: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect('valve1')}>go valve</button>
      <button type="button" onClick={() => onSelect('link:1')}>go link</button>
      <button type="button" onClick={() => onSelect('shape:2')}>go shape</button>
      <button type="button" onClick={() => onSelect('scene')}>go scene</button>
      <button type="button" onClick={() => onSelect('nobody')}>go nobody</button>
    </div>
  ),
}));

vi.mock('../views/SceneWhatIf', () => ({
  SceneWhatIf: ({ ctx, value, onChange }: { ctx: EditorCtx; value: WhatIfState; onChange: (n: WhatIfState) => void }) => {
    seen.ctx = ctx; seen.whatIf = value;
    return (
      <div>
        <button type="button" onClick={() => onChange({ rows: { pump1: { running: true } }, params: { mode: 'x' } })}>override</button>
        <button type="button" onClick={() => onChange({ rows: {}, params: {} })}>clear</button>
        <output data-testid="whatif-data">{JSON.stringify(ctx.data)}</output>
        <output data-testid="whatif-params">{JSON.stringify(ctx.params)}</output>
        <output data-testid="whatif-hits">{ctx.model.hits.map((h) => h.id).join(',')}</output>
      </div>
    );
  },
}));

beforeEach(() => { mockLayout(); try { window.localStorage.clear(); } catch { /* none */ } seen.ctx = undefined; seen.whatIf = undefined; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const B = boxes();
const text = (id: string) => screen.getByTestId(id).textContent;

describe('what the shell hands the inspector', () => {
  it('gives it the draft, the model, the real data, the host params, the selection and the host', () => {
    const data = { points: { shape: 'table' as const, rows: [{ id: 'pump1', running: false }] } };
    const host = { actionIds: new Set(['pump1']) };
    mount({ data, params: { site: 'north' }, host, locale: 'en' });
    const ctx = seen.ctx as EditorCtx;
    expect(ctx.settings.elements).toHaveLength(3);
    expect(ctx.model.hits.map((h) => h.id)).toEqual(['tank1', 'pump1', 'valve1']);
    expect(ctx.data).toBe(data);
    expect(ctx.params).toEqual({ site: 'north' });
    expect(ctx.host).toBe(host);
    expect(ctx.locale).toBe('en');
    expect(ctx.selection).toEqual({ elements: [], shapes: [], links: [] });
  });

  it('runs the inspector\'s edits on the draft: the canvas and the next render see them', async () => {
    const m = mount();
    fireEvent.click(screen.getByText('nudge tank'));
    expect(m.said()).toBe('');
    expect(screen.getByTestId('editor-apply')).not.toBeDisabled();
    expect(element(await m.applied(), 'tank1')).toMatchObject({ x: 110 });
  });

  it('joins edits that share a group key into one undo step', () => {
    const m = mount();
    fireEvent.click(screen.getByText('nudge pump'));
    fireEvent.click(screen.getByText('nudge pump'));
    fireEvent.click(screen.getByText('nudge pump'));
    expect(text('probe-pump')).toBe('330');
    key(m.canvas, 'z', { ctrlKey: true });
    expect(text('probe-pump')).toBe('300');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('keeps edits without a group as separate steps', () => {
    const m = mount();
    fireEvent.click(screen.getByText('nudge tank'));
    fireEvent.click(screen.getByText('nudge tank'));
    key(m.canvas, 'z', { ctrlKey: true });
    expect(screen.getByTestId('editor-apply')).not.toBeDisabled();
    key(m.canvas, 'z', { ctrlKey: true });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('lets the inspector change the selection, and shows the canvas selection to the inspector', () => {
    const m = mount();
    fireEvent.click(screen.getByText('select tank'));
    expect(selected(document.body)).toEqual(['tank1']);
    expect(JSON.parse(text('probe-selection') as string)).toEqual({ elements: ['tank1'] });
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    fireEvent.pointerDown(m.svg, { pointerId: 1, button: 0, ...at(m.svg, start) });
    fireEvent.pointerUp(m.svg, { pointerId: 1, button: 0, ...at(m.svg, start) });
    expect(JSON.parse(text('probe-selection') as string)).toEqual({ elements: ['pump1'], shapes: [], links: [] });
  });

  it('drops a selection that an edit or an undo made stale', () => {
    const m = mount();
    fireEvent.click(screen.getByText('select tank'));
    key(m.canvas, 'Delete');
    expect(JSON.parse(text('probe-selection') as string).elements).toEqual([]);
  });
});

describe('the palette', () => {
  it('adds at the centre of the view on the grid, selects the symbol, and does not stack two on one spot', async () => {
    const m = mount();
    fireEvent.click(screen.getByText('add pump'));
    fireEvent.click(screen.getByText('add pump'));
    const s = await m.applied();
    const [a, b] = [elements(s)[3], elements(s)[4]] as Array<{ id: string; x: number; y: number }>;
    expect([a.id, b.id]).toEqual(['pump2', 'pump3']);
    // The view is centred on the canvas (500, 300), on the grid; the second goes aside.
    expect(a.x % 10).toBe(0);
    expect(Math.abs(a.x - 500)).toBeLessThan(15);
    expect(Math.abs(a.y - 300)).toBeLessThan(15);
    expect(b.x - a.x).toBe(20);
    expect(b.y - a.y).toBe(20);
    expect(selected(document.body)).toEqual(['pump3']);
  });

  it('adds at the centre of what is shown after a zoom and a pan', async () => {
    const m = mount();
    key(m.canvas, '+'); key(m.canvas, '+');
    const vb = viewBox(m.svg);
    fireEvent.click(screen.getByText('add valve'));
    const v = elements(await m.applied())[3] as { x: number; y: number };
    expect(Math.abs(v.x - (vb.x + vb.w / 2))).toBeLessThan(12);
    expect(Math.abs(v.y - (vb.y + vb.h / 2))).toBeLessThan(12);
  });

  it('puts the symbols used most recently first, and remembers them', () => {
    mount();
    fireEvent.click(screen.getByText('add pump'));
    fireEvent.click(screen.getByText('add valve'));
    fireEvent.click(screen.getByText('add pump'));
    expect(text('recent')).toBe('pump.volute,valve.ball');
    expect(JSON.parse(window.localStorage.getItem('kui.scada.editor.recent') as string)).toEqual(['pump.volute', 'valve.ball']);
    cleanup();
    mount();
    expect(text('recent')).toBe('pump.volute,valve.ball');
  });

  it('uses the storage key the host gives', () => {
    mount({ storageKey: 'my.editor' });
    fireEvent.click(screen.getByText('add pump'));
    expect(window.localStorage.getItem('my.editor.recent')).not.toBeNull();
    expect(window.localStorage.getItem('kui.scada.editor.recent')).toBeNull();
  });

  it('adds a symbol dragged with a pointer (touch) when it is released over the canvas', async () => {
    const m = mount();
    fireEvent.pointerDown(screen.getByTestId('palette-drag'), { pointerId: 5, button: 0 });
    const p = at(m.svg, { x: 733, y: 417 });
    fireEvent.pointerUp(window, { pointerId: 5, ...p });
    const v = elements(await m.applied())[3] as { id: string; x: number; y: number; symbol: string };
    expect(v).toMatchObject({ symbol: 'valve.ball', x: 730, y: 420 });
  });

  it('adds nothing when the pointer drag ends outside the canvas', () => {
    mount();
    fireEvent.pointerDown(screen.getByTestId('palette-drag'), { pointerId: 5, button: 0 });
    fireEvent.pointerUp(window, { pointerId: 5, clientX: 2000, clientY: 2000 });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });
});

describe('what-if values reach the model and never the settings', () => {
  const ruled = () => ({
    ...smallScene(),
    rules: [
      { target: 'pump1', op: 'true', key: 'running', hidden: true },
      { target: 'tank1', source: 'param', key: 'mode', op: 'eq', value: 'x', hidden: true },
    ],
  });
  const data = { points: { shape: 'table' as const, rows: [{ id: 'pump1', running: false }] } };

  const open = () => fireEvent.click(screen.getByRole('tab', { name: 'What-if' }));

  it('lays the what-if rows over data.points and the what-if params over the board parameters before the model is built', () => {
    mount({ data, params: { mode: 'auto' } }, ruled());
    expect(document.querySelector('[data-ghost]')).toBeNull();
    expect(text('probe-hits')).toBe('tank1,pump1,valve1');
    open();
    fireEvent.click(screen.getByText('override'));
    // Both rules now match: a row value and a parameter, and both symbols are hidden by rules (drawn as ghosts).
    expect(document.querySelector('[data-ghost="pump1"]')).not.toBeNull();
    expect(document.querySelector('[data-ghost="tank1"]')).not.toBeNull();
    expect(text('whatif-hits')).toBe('valve1');
    fireEvent.click(screen.getByText('clear'));
    expect(document.querySelector('[data-ghost]')).toBeNull();
    expect(text('whatif-hits')).toBe('tank1,pump1,valve1');
  });

  it('hands the panels the REAL data and the host params, not the overridden ones', () => {
    mount({ data, params: { mode: 'auto' } }, ruled());
    open();
    fireEvent.click(screen.getByText('override'));
    expect(JSON.parse(text('whatif-data') as string)).toEqual(data);
    expect(JSON.parse(text('whatif-params') as string)).toEqual({ mode: 'auto' });
    expect(seen.whatIf).toEqual({ rows: { pump1: { running: true } }, params: { mode: 'x' } });
  });

  it('keeps the what-if state when the tab is left and entered again', () => {
    mount({ data }, ruled());
    open();
    fireEvent.click(screen.getByText('override'));
    fireEvent.click(screen.getByRole('tab', { name: 'Properties' }));
    expect(document.querySelector('[data-ghost="pump1"]')).not.toBeNull();
    open();
    expect(seen.whatIf?.rows).toEqual({ pump1: { running: true } });
  });

  it('is not an edit: Apply stays off, undo has nothing, and the applied settings carry no trace of it', async () => {
    const m = mount({ data }, ruled());
    open();
    fireEvent.click(screen.getByText('override'));
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    expect(screen.getByTestId('undo')).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Properties' }));
    fireEvent.click(screen.getByText('nudge tank'));
    const s = await m.applied();
    expect(JSON.stringify(s)).not.toContain('running":true');
    expect(JSON.stringify(s)).not.toContain('"mode":"x"');
    expect(s.rules).toEqual(ruled().rules);
  });

  it('draws the scene with the animation off while editing', () => {
    const rows = { points: { shape: 'table' as const, rows: [{ id: 'pump1', running: true }] } };
    // The same scene does animate when it is asked to (so the check below is not vacuous).
    expect(JSON.stringify(sceneModel(smallScene(), rows, { animate: true }).nodes)).toContain('animateTransform');
    mount({ data: rows });
    const drawn = document.querySelector('[data-layer="scene"]') as Element;
    expect(drawn.querySelector('path, rect, circle')).not.toBeNull();
    expect(drawn.querySelector('animate, animateTransform')).toBeNull();
  });
});

describe('the problems panel', () => {
  const go = (name: string) => { fireEvent.click(screen.getByRole('tab', { name: /Problems/ })); fireEvent.click(screen.getByText(name)); };

  it('selects the symbol, connection or shape a problem names, and brings a symbol into view', () => {
    const m = mount();
    key(m.canvas, '+'); key(m.canvas, '+'); key(m.canvas, '+');
    go('go valve');
    expect(selected(document.body)).toEqual(['valve1']);
    const vb = viewBox(m.svg);
    expect(B.valve1.cx).toBeGreaterThan(vb.x);
    expect(B.valve1.cx).toBeLessThan(vb.x + vb.w);
    fireEvent.click(screen.getByText('go link'));
    expect(document.body.querySelector('[data-selected-link="1"]')).not.toBeNull();
    fireEvent.click(screen.getByText('go shape'));
    expect(document.body.querySelector('[data-selected-shape="2"]')).not.toBeNull();
  });

  it('shows the scene (an empty selection) for a problem about the scene as a whole, and ignores an id that is not there', () => {
    mount();
    go('go valve');
    fireEvent.click(screen.getByText('go nobody'));
    expect(selected(document.body)).toEqual(['valve1']);
    fireEvent.click(screen.getByText('go scene'));
    expect(selected(document.body)).toEqual([]);
  });
});
