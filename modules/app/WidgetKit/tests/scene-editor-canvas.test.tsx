import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { contentBox } from '../views/scene-editor-state';
import { smallScene } from './scene-edit-fixture';
import {
  boxes, click, down, drag, dragEvent, element, elements, fireEvent, key, links, mockLayout, mount, move, screen, selected, shapes, up, viewBox, at,
} from './scene-editor-harness';
import { linkLegs } from '../views/scene-edit-geometry';
import { sceneModel, type SceneSettings } from '../views/scada-scene-logic';

beforeEach(() => { mockLayout(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const B = boxes();
const model = sceneModel(smallScene(), {});
const legs = linkLegs(smallScene(), model);
const mid = (pts: Array<{ x: number; y: number }>) => ({ x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 });
const top = (id: string) => ({ x: B[id].cx, y: B[id].y });

describe('tools and selection on the canvas', () => {
  it('starts with the select tool, switches tools from the toolbar and from the keys, and goes back with Escape', () => {
    const { canvas } = mount();
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('scene-tool-connect'));
    expect(screen.getByTestId('scene-tool-connect')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('scene-tool-select')).not.toHaveAttribute('aria-pressed');
    key(canvas, 'h');
    expect(screen.getByTestId('scene-tool-pan')).toHaveAttribute('aria-pressed', 'true');
    key(canvas, 'Escape');
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-pressed', 'true');
  });

  it('selects a symbol with a click, adds with shift, takes it out with shift again, clears on empty ground', () => {
    const { svg, container } = Object.assign(mount(), { container: document.body });
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(selected(container)).toEqual(['pump1']);
    click(svg, { x: B.valve1.cx, y: B.valve1.cy }, { shiftKey: true });
    expect(selected(container)).toEqual(['pump1', 'valve1']);
    click(svg, { x: B.pump1.cx, y: B.pump1.cy }, { shiftKey: true });
    expect(selected(container)).toEqual(['valve1']);
    click(svg, { x: 900, y: 500 });
    expect(selected(container)).toEqual([]);
  });

  it('collapses a group selection to the clicked symbol when it is clicked without dragging', () => {
    const { svg } = mount();
    const c = document.body;
    drag(svg, { x: 20, y: 120 }, { x: (B.pump1.x + B.pump1.w + B.valve1.x) / 2, y: 320 });
    expect(selected(c)).toEqual(['tank1', 'pump1']);
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(selected(c)).toEqual(['pump1']);
  });

  it('selects what a rubber-band rectangle touches, and adds to the selection with shift', () => {
    const { svg } = mount();
    const c = document.body;
    const gap = (B.pump1.x + B.pump1.w + B.valve1.x) / 2;
    down(svg, { x: 20, y: 120 });
    move(svg, { x: 60, y: 160 });
    expect(c.querySelector('[data-preview="marquee"]')).not.toBeNull();
    move(svg, { x: gap, y: 320 });
    up(svg, { x: gap, y: 320 });
    expect(selected(c)).toEqual(['tank1', 'pump1']);
    expect(c.querySelector('[data-preview="marquee"]')).toBeNull();
    // A second rectangle with shift keeps the first selection and adds the valve.
    drag(svg, { x: gap + 10, y: 120 }, { x: 640, y: 330 }, [], { shiftKey: true });
    expect(selected(c)).toEqual(['tank1', 'pump1', 'valve1']);
  });

  it('does not take a tiny drag on empty ground for a marquee', () => {
    const { svg } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    click(svg, { x: 900, y: 500 });
    expect(selected(document.body)).toEqual([]);
  });
});

describe('moving symbols', () => {
  it('drags with snapping to the grid, one undo step for the whole drag', async () => {
    const { svg, canvas, applied } = mount();
    fireEvent.click(screen.getByTestId('toggle-guides'));
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    drag(svg, start, { x: start.x + 47, y: start.y + 33 }, [{ x: start.x + 5, y: start.y + 3 }, { x: start.x + 20, y: start.y + 11 }, { x: start.x + 33, y: start.y + 22 }]);
    // Five pointer moves, one undo step: a single undo puts the opened scene back and Apply has nothing to apply.
    key(canvas, 'z', { ctrlKey: true });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    expect(screen.getByTestId('undo')).toBeDisabled();
    expect(screen.getByTestId('redo')).not.toBeDisabled();
    key(canvas, 'y', { ctrlKey: true });
    const s = await applied();
    const pump = element(s, 'pump1') as { x: number; y: number };
    expect(pump.x % 10).toBe(0);
    expect(pump.y % 10).toBe(0);
    expect(pump.x).toBeGreaterThan(300);
    expect(pump.y).toBeGreaterThan(200);
    // The other symbols did not move.
    expect(element(s, 'tank1')).toMatchObject({ x: 100, y: 200 });
  });

  it('does not snap while Alt is held', async () => {
    const { svg, applied } = mount();
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    drag(svg, start, { x: start.x + 13.37, y: start.y + 7.11 }, [], { altKey: true });
    const pump = element(await applied(), 'pump1') as { x: number; y: number };
    expect(pump.x % 10).not.toBe(0);
  });

  it('shows alignment guides while a symbol lines up with its neighbours, and snaps onto them', async () => {
    const { svg, applied } = mount();
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    down(svg, start);
    move(svg, { x: start.x + 6, y: start.y + 2 });
    move(svg, { x: start.x + 12, y: start.y + 2.5 });
    // A couple of units off the row of its neighbours: it snaps onto a line of theirs and the guide is drawn.
    expect(document.body.querySelector('[data-guide]')).not.toBeNull();
    up(svg, { x: start.x + 12, y: start.y + 2.5 });
    expect(document.body.querySelector('[data-guide]')).toBeNull();
    expect(Math.abs((element(await applied(), 'pump1') as { y: number }).y - 200)).toBeLessThan(2);
  });

  it('moves a whole selection together', async () => {
    const { svg, applied } = mount();
    const gap = (B.pump1.x + B.pump1.w + B.valve1.x) / 2;
    drag(svg, { x: 20, y: 120 }, { x: gap, y: 320 });
    const a = { x: B.tank1.cx, y: B.tank1.cy };
    drag(svg, a, { x: a.x, y: a.y + 52 });
    const s = await applied();
    const tank = element(s, 'tank1') as { y: number }; const pump = element(s, 'pump1') as { y: number };
    expect(tank.y).toBe(pump.y);
    expect(tank.y).toBeGreaterThan(200);
    expect(element(s, 'valve1')).toMatchObject({ y: 200 });
  });

  it('takes a drag back with Escape', () => {
    const { svg, canvas } = mount();
    const start = { x: B.pump1.cx, y: B.pump1.cy };
    down(svg, start);
    move(svg, { x: start.x + 60, y: start.y + 60 });
    expect(screen.getByTestId('editor-apply')).not.toBeDisabled();
    key(canvas, 'Escape');
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    up(svg, { x: start.x + 60, y: start.y + 60 });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('does not drag a locked symbol (it is treated as background), and does not select it', () => {
    const { svg } = mount();
    fireEvent.click(screen.getByTestId('menu-layers'));
    fireEvent.click(screen.getByRole('button', { name: /^Lock pump1/ }));
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(selected(document.body)).toEqual([]);
  });

  it('nudges the focused symbol with the arrows (1 unit, Shift = 10) as one undo step per burst', async () => {
    // The clock is fixed so the three presses are one burst however slow the machine is.
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    const { canvas, applied } = mount();
    const g = canvas.querySelector('[data-element="valve1"]') as Element;
    fireEvent.focus(g);
    key(g, 'ArrowRight');
    key(g, 'ArrowRight');
    key(g, 'ArrowDown', { shiftKey: true });
    // Three key presses in one burst are one undo step.
    key(canvas, 'z', { ctrlKey: true });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
    key(canvas, 'y', { ctrlKey: true });
    spy.mockRestore();
    expect(element(await applied(), 'valve1')).toMatchObject({ x: 502, y: 210 });
  });
});

describe('nudge bursts', () => {
  it('presses less than the window apart are one undo step, however the clock falls; a pause starts a new step', () => {
    let now = 1_000_000_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const { canvas } = mount();
      const g = canvas.querySelector('[data-element="valve1"]') as Element;
      fireEvent.focus(g);
      key(g, 'ArrowRight'); now += 790; key(g, 'ArrowRight'); now += 790; key(g, 'ArrowRight');
      key(canvas, 'z', { ctrlKey: true });
      expect(screen.getByTestId('editor-apply')).toBeDisabled();
      key(canvas, 'y', { ctrlKey: true });
      now += 5000; key(g, 'ArrowRight'); now += 5000; key(g, 'ArrowRight');
      key(canvas, 'z', { ctrlKey: true });
      expect(screen.getByTestId('editor-apply')).toBeEnabled();
    } finally { spy.mockRestore(); }
  });
});

describe('connections', () => {
  it('draws a connection with the connect tool: press on one symbol, release on another', async () => {
    const { svg, canvas, applied } = mount();
    key(canvas, 'c');
    down(svg, top('pump1'));
    move(svg, { x: top('pump1').x + 30, y: top('pump1').y - 40 });
    expect(document.body.querySelector('[data-preview="link"]')).not.toBeNull();
    move(svg, top('valve1'));
    up(svg, top('valve1'));
    expect(document.body.querySelector('[data-preview="link"]')).toBeNull();
    expect(screen.getByTestId('scene-live').textContent).toContain('Connected pump1 to valve1');
    const l = links(await applied());
    expect(l).toHaveLength(3);
    expect(l[2]).toMatchObject({ from: 'pump1.t', to: 'valve1.t', kind: 'pipe' });
  });

  it('joins two symbols by two clicks (next-boilerplate e2e round 4, M-R4-04): click one, a dashed line follows the pointer, click the other; the tool says how; Escape or empty ground cancels', async () => {
    const { svg, canvas, applied, said } = mount();
    key(canvas, 'c');
    expect(said()).toMatch(/Connect tool: click a symbol, then the symbol to join it to/);
    click(svg, top('tank1'));
    expect(said()).toMatch(/Now click the symbol to join tank1 to/);
    move(svg, { x: 400, y: 100 });
    expect(document.body.querySelector('[data-preview="link"]')).not.toBeNull();
    click(svg, top('valve1'));
    expect(screen.getByTestId('scene-live').textContent).toContain('Connected tank1 to valve1');
    expect(document.body.querySelector('[data-preview="link"]')).toBeNull();
    const l = links(await applied());
    expect(l).toHaveLength(3);
    expect(l[2]).toMatchObject({ from: 'tank1.t', kind: 'pipe' });
    expect(String(l[2].to)).toMatch(/^valve1\./);
    // a first click then empty ground: nothing drawn, said; a first click then Escape: the tool goes back to select and forgets the port
    click(svg, top('pump1'));
    click(svg, { x: 900, y: 500 });
    expect(said()).toMatch(/Nothing to join there/);
    expect(links(await applied())).toHaveLength(3);
    key(canvas, 'c');
    click(svg, top('pump1'));
    key(canvas, 'Escape');
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-pressed', 'true');
    expect(document.body.querySelector('[data-preview="link"]')).toBeNull();
  });

  it('uses the kind chosen in the toolbar picker', async () => {
    const { svg, canvas, applied } = mount();
    fireEvent.change(screen.getByTestId('link-kind'), { target: { value: 'hose' } });
    key(canvas, 'c');
    drag(svg, top('tank1'), top('valve1'));
    expect(links(await applied())[2]).toMatchObject({ from: 'tank1.t', to: 'valve1.t', kind: 'hose' });
  });

  it('ends on the facing side when the drop lands on the body of a symbol', async () => {
    const { svg, canvas, applied } = mount();
    key(canvas, 'c');
    drag(svg, { x: B.tank1.cx, y: B.tank1.cy }, { x: B.valve1.x + 2, y: B.valve1.cy });
    const l = links(await applied());
    expect(l).toHaveLength(3);
    expect(String(l[2].from)).toMatch(/^tank1\./);
    expect(l[2].to).toBe('valve1.l');
  });

  it('creates nothing when the press is released on empty ground, or on the same symbol', async () => {
    const { svg, canvas } = mount();
    key(canvas, 'c');
    drag(svg, top('pump1'), { x: 900, y: 500 });
    drag(svg, top('pump1'), { x: B.pump1.cx, y: B.pump1.cy });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('refuses a join that already exists and says so', async () => {
    const { svg, canvas, said } = mount();
    key(canvas, 'c');
    const rightOf = (id: string) => ({ x: B[id].x + B[id].w, y: B[id].cy });
    const leftOf = (id: string) => ({ x: B[id].x, y: B[id].cy });
    drag(svg, rightOf('tank1'), leftOf('pump1'));
    expect(said()).toMatch(/already joined/);
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('joins the two selected symbols from the keyboard (K) by the sides that face each other', async () => {
    const { svg, canvas, applied } = mount();
    click(svg, { x: B.tank1.cx, y: B.tank1.cy });
    click(svg, { x: B.valve1.cx, y: B.valve1.cy }, { shiftKey: true });
    key(canvas, 'k');
    const l = links(await applied());
    expect(l[2]).toMatchObject({ from: 'tank1.r', to: 'valve1.l' });
  });

  it('drags the end of a selected connection to another port (reconnect)', async () => {
    const { svg, applied } = mount();
    const first = legs[0];
    click(svg, mid(first.points));
    expect(document.body.querySelector('[data-selected-link="0"]')).not.toBeNull();
    const end = first.points[first.points.length - 1];
    expect(document.body.querySelector('[data-handle="end-to"]')).not.toBeNull();
    drag(svg, end, top('valve1'), [{ x: end.x + 30, y: end.y - 30 }]);
    const l = links(await applied());
    expect(l[0].to).toBe('valve1.t');
    expect(l[0].from).toBe('tank1.r');
    expect(l).toHaveLength(2);
  });

  it('drags the middle-leg handle of a selected connection', async () => {
    const { svg, applied } = mount();
    const second = legs[1];
    click(svg, { x: (second.points[0].x + second.points[1].x) / 2 + 2, y: second.points[0].y });
    const handle = second.handle as { x: number; y: number };
    drag(svg, handle, { x: handle.x + 24, y: handle.y }, [{ x: handle.x + 10, y: handle.y }]);
    const l = links(await applied());
    expect(typeof l[1].mid).toBe('number');
    expect(l[1].mid).not.toBe(handle.x);
    expect((l[1].mid as number) % 10).toBe(0);
  });

  it('shows ports on the symbol under the pointer and on every symbol with the connect tool', () => {
    const { svg, canvas } = mount();
    expect(document.body.querySelectorAll('[data-port]')).toHaveLength(0);
    move(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect([...document.body.querySelectorAll('[data-port]')].map((p) => p.getAttribute('data-port'))).toEqual(['pump1.l', 'pump1.r', 'pump1.t', 'pump1.b']);
    key(canvas, 'c');
    expect(document.body.querySelectorAll('[data-port]')).toHaveLength(12);
  });

  it('starts a connection from a port in the select tool, when the pointer is over the symbol', async () => {
    const { svg, applied } = mount();
    move(svg, { x: B.pump1.cx, y: B.pump1.cy });
    move(svg, top('pump1'));
    down(svg, top('pump1'));
    move(svg, top('valve1'));
    up(svg, top('valve1'));
    expect(links(await applied())[2]).toMatchObject({ from: 'pump1.t', to: 'valve1.t' });
  });
});

describe('titles, zones, dividers and their handles', () => {
  it('draws a zone by dragging with the zone tool, then returns to the select tool', async () => {
    const { svg, canvas, applied } = mount();
    key(canvas, 'z');
    down(svg, { x: 700, y: 100 });
    move(svg, { x: 780, y: 160 });
    expect(document.body.querySelector('[data-preview="draw"]')).not.toBeNull();
    move(svg, { x: 900, y: 250 });
    up(svg, { x: 900, y: 250 });
    const s = shapes(await applied());
    expect(s).toHaveLength(4);
    expect(s[3]).toMatchObject({ kind: 'zone', x: 700, y: 100, w: 200, h: 150 });
    expect(screen.getByTestId('scene-tool-select')).toHaveAttribute('aria-pressed', 'true');
    expect(selected(document.body)).toEqual([]);
    expect(document.body.querySelector('[data-selected-shape="3"]')).not.toBeNull();
  });

  it('draws a divider (horizontal when dragged sideways, vertical when dragged down)', async () => {
    const { svg, canvas, applied } = mount();
    key(canvas, 'd');
    drag(svg, { x: 650, y: 450 }, { x: 850, y: 455 });
    key(canvas, 'd');
    drag(svg, { x: 900, y: 300 }, { x: 905, y: 420 });
    const s = shapes(await applied());
    expect(s[3]).toMatchObject({ kind: 'divider', x: 650, y: 450, w: 200, h: 0 });
    expect(s[4]).toMatchObject({ kind: 'divider', x: 900, y: 300, w: 0, h: 120 });
  });

  it('puts a title where you click with the title tool and lets you type its words in place', async () => {
    const { svg, canvas, applied } = mount();
    key(canvas, 't');
    click(svg, { x: 800, y: 500 });
    const box = screen.getByLabelText('New name') as HTMLInputElement;
    expect(box.value).toBe('Title');
    fireEvent.change(box, { target: { value: 'Pump house' } });
    key(box, 'Enter');
    expect(screen.queryByLabelText('New name')).toBeNull();
    expect(shapes(await applied())[3]).toMatchObject({ kind: 'text', text: 'Pump house', x: 800, y: 500 });
  });

  it('resizes a zone with its corner handle (on the grid)', async () => {
    const { svg, applied } = mount();
    click(svg, { x: 40, y: 200 });
    expect(document.body.querySelector('[data-selected-shape="1"]')).not.toBeNull();
    expect(document.body.querySelectorAll('[data-handle]')).toHaveLength(3);
    drag(svg, { x: 600, y: 320 }, { x: 641, y: 362 }, [{ x: 620, y: 340 }]);
    expect(shapes(await applied())[1]).toMatchObject({ kind: 'zone', x: 40, y: 80, w: 600, h: 280 });
  });

  it('resizes a divider by its end handle', async () => {
    const { svg, applied } = mount();
    click(svg, { x: 200, y: 400 });
    expect(document.body.querySelector('[data-selected-shape="2"]')).not.toBeNull();
    drag(svg, { x: 440, y: 400 }, { x: 523, y: 404 });
    expect(shapes(await applied())[2]).toMatchObject({ kind: 'divider', w: 480, h: 0 });
  });

  it('grows a selected zone from the keyboard with Alt and the arrows', async () => {
    const { svg, canvas, applied } = mount();
    click(svg, { x: 40, y: 200 });
    key(canvas, 'ArrowRight', { altKey: true });
    key(canvas, 'ArrowDown', { altKey: true, shiftKey: true });
    expect(shapes(await applied())[1]).toMatchObject({ w: 570, h: 290 });
  });
});

describe('the own-size handle', () => {
  it('shows the handle on a single selected symbol and scales it by dragging the corner', async () => {
    const { svg, applied } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(document.body.querySelector('[data-handle="ownsize"]')).not.toBeNull();
    const corner = { x: B.pump1.x + B.pump1.w, y: B.pump1.y + B.pump1.h };
    const far = { x: B.pump1.cx + (corner.x - B.pump1.cx) * 2, y: B.pump1.cy + (corner.y - B.pump1.cy) * 2 };
    drag(svg, corner, far, [{ x: corner.x + 5, y: corner.y + 5 }]);
    expect((element(await applied(), 'pump1') as { scale: number }).scale).toBeCloseTo(2, 1);
  });

  it('shows no handle for a multi-selection', () => {
    const { svg } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    click(svg, { x: B.valve1.cx, y: B.valve1.cy }, { shiftKey: true });
    expect(document.body.querySelector('[data-handle="ownsize"]')).toBeNull();
  });

  it('scales the selection from the keyboard with [ and ]', async () => {
    const { svg, canvas, applied } = mount();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    key(canvas, ']');
    key(canvas, ']');
    expect((element(await applied(), 'pump1') as { scale: number }).scale).toBeCloseTo(1.21, 2);
  });
});

describe('zoom and pan of the editor viewport', () => {
  it('shows the whole canvas with a margin by default, and fits again on 0', () => {
    const { svg, canvas } = mount();
    const vb = viewBox(svg);
    expect(vb.x).toBeLessThan(0);
    expect(vb.x + vb.w).toBeGreaterThan(1000);
    expect(vb.y + vb.h).toBeGreaterThan(600);
    key(canvas, '+');
    expect(viewBox(svg).w).toBeLessThan(vb.w);
    // 0 (Fit to view) frames the symbols, not the whole canvas (e2e round 2: three small symbols stayed tiny at 100 %)
    key(canvas, '0');
    const fitted = viewBox(svg);
    expect(fitted.w).toBeLessThan(vb.w);
    const content = contentBox(smallScene(), sceneModel(smallScene(), {}))!;
    expect(fitted.x).toBeLessThanOrEqual(content.x + 1e-6);
    expect(fitted.x + fitted.w).toBeGreaterThanOrEqual(content.x + content.w - 1e-6);
    expect(fitted.y).toBeLessThanOrEqual(content.y + 1e-6);
    expect(fitted.y + fitted.h).toBeGreaterThanOrEqual(content.y + content.h - 1e-6);
  });

  it('zooms with the keys, the buttons and the wheel (about the pointer)', () => {
    const { svg, canvas } = mount();
    const w0 = viewBox(svg).w;
    key(canvas, '+');
    const w1 = viewBox(svg).w;
    expect(w1).toBeCloseTo(w0 / 1.25, 6);
    fireEvent.click(screen.getByTestId('zoom-out'));
    expect(viewBox(svg).w).toBeCloseTo(w0, 6);
    fireEvent.click(screen.getByTestId('zoom-in'));
    expect(screen.getByTestId('zoom-level')).toHaveTextContent('125%');
    // Wheel: the scene point under the pointer stays under it.
    const p = { x: 300, y: 150 };
    const before = at(svg, p);
    fireEvent.wheel(canvas, { deltaY: -200, ...before });
    const vb = viewBox(svg);
    expect(vb.w).toBeLessThan(w1);
    const local = { x: ((p.x - vb.x) / vb.w) * 800, y: ((p.y - vb.y) / vb.h) * 500 };
    expect(local.x).toBeCloseTo(before.clientX, 3);
    expect(local.y).toBeCloseTo(before.clientY, 3);
    key(canvas, '-');
    fireEvent.click(screen.getByTestId('zoom-fit'));
    // the fit zooms in on the symbols: more than 100 % for a small diagram on a big canvas
    const pct = Number(screen.getByTestId('zoom-level').textContent?.replace(/[^0-9]/g, ''));
    expect(pct).toBeGreaterThan(100);
  });

  it('pans with the middle button and with the pan tool', () => {
    const { svg, canvas } = mount();
    key(canvas, '+');
    const x0 = viewBox(svg).x;
    fireEvent.pointerDown(svg, { pointerId: 1, button: 1, clientX: 400, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 300, clientY: 250 });
    fireEvent.pointerUp(svg, { pointerId: 1, button: 1, clientX: 300, clientY: 250 });
    expect(viewBox(svg).x).toBeGreaterThan(x0);
    const x1 = viewBox(svg).x;
    key(canvas, 'h');
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 300, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 340, clientY: 250 });
    fireEvent.pointerUp(svg, { pointerId: 1, button: 0, clientX: 340, clientY: 250 });
    expect(viewBox(svg).x).toBeLessThan(x1);
    // Panning selected nothing and changed nothing.
    expect(selected(document.body)).toEqual([]);
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('pans while Space is held over the canvas', () => {
    const { svg, canvas } = mount();
    key(canvas, '+');
    const x0 = viewBox(svg).x;
    key(canvas, ' ');
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 400, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 360, clientY: 250 });
    fireEvent.pointerUp(svg, { pointerId: 1, button: 0, clientX: 360, clientY: 250 });
    expect(viewBox(svg).x).toBeGreaterThan(x0);
    fireEvent.keyUp(canvas, { key: ' ' });
  });

  it('zooms and pans with a two-finger pinch', () => {
    const { svg } = mount();
    const w0 = viewBox(svg).w;
    fireEvent.pointerDown(svg, { pointerId: 1, button: 0, clientX: 380, clientY: 250 });
    fireEvent.pointerDown(svg, { pointerId: 2, button: 0, clientX: 420, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 340, clientY: 250 });
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: 460, clientY: 250 });
    expect(viewBox(svg).w).toBeLessThan(w0);
    fireEvent.pointerUp(svg, { pointerId: 2, button: 0 });
    fireEvent.pointerUp(svg, { pointerId: 1, button: 0 });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });
});

describe('dropping a symbol from the palette', () => {
  it('adds the symbol at the snapped drop point and selects it', async () => {
    const { svg, canvas, applied } = mount();
    const over = dragEvent('dragOver', canvas, svg, { x: 733, y: 417 }, 'home.router');
    expect(over.defaultPrevented).toBe(true);
    dragEvent('drop', canvas, svg, { x: 733, y: 417 }, 'home.router');
    // said by the symbol's name, never its catalogue code (e2e round 4, M-R4-14)
    expect(screen.getByTestId('scene-live').textContent).toContain('Added Wi-Fi router at 730, 420');
    const s = await applied();
    expect(elements(s)).toHaveLength(4);
    expect(elements(s)[3]).toMatchObject({ id: 'router1', symbol: 'home.router', x: 730, y: 420 });
    expect(document.body.querySelector('[data-selected="router1"]')).not.toBeNull();
  });

  it('ignores a drop of something that is not a library symbol', () => {
    const { svg, canvas } = mount();
    dragEvent('drop', canvas, svg, { x: 700, y: 400 }, 'not.a.symbol');
    fireEvent.drop(canvas, { dataTransfer: { types: ['text/plain'], getData: () => 'x', dropEffect: 'none' } });
    expect(screen.getByTestId('editor-apply')).toBeDisabled();
  });

  it('does not snap a drop when the grid is off', async () => {
    const { svg, canvas, applied } = mount();
    fireEvent.click(screen.getByTestId('toggle-grid'));
    dragEvent('drop', canvas, svg, { x: 733.3, y: 417.7 }, 'home.plug.smart');
    const v = elements(await applied())[3] as { x: number; y: number };
    expect(v.x).toBeCloseTo(733.3, 1);
    expect(v.y).toBeCloseTo(417.7, 1);
  });
});

describe('symbols a rule hides, and the action dot', () => {
  it('draws a symbol hidden by a rule as a faint dashed ghost that can still be selected', () => {
    const s = { ...smallScene(), rules: [{ target: 'pump1', hidden: true }] };
    const { svg } = mount({}, s);
    expect(document.body.querySelector('[data-ghost="pump1"]')).not.toBeNull();
    expect(document.body.querySelector('[data-ghost="tank1"]')).toBeNull();
    click(svg, { x: B.pump1.cx, y: B.pump1.cy });
    expect(selected(document.body)).toEqual(['pump1']);
  });

  it('marks the symbols the host says have actions with a dot', () => {
    mount({ host: { actionIds: new Set(['pump1', 'valve1']) } });
    expect([...document.body.querySelectorAll('[data-action-dot]')].map((e) => e.getAttribute('data-action-dot'))).toEqual(['pump1', 'valve1']);
  });
});

describe('a connection that ends on a thing from data', () => {
  // The things are a locked layer the editing paths never see, but a link the author drew to one is still theirs.
  const withThing = () => ({ ...smallScene(), links: [...links(smallScene()), { from: 'valve1.r', to: 'cow7.l', kind: 'pipe' }] }) as SceneSettings;
  const data = { things: { shape: 'table' as const, rows: [{ id: 'cow7', symbol: 'home.plug.smart', x: 800, y: 200 }] } };

  it('is selected with a click on its leg and deleted with Delete', async () => {
    const s = withThing();
    const full = sceneModel({ ...s, rules: undefined }, data);
    const leg = linkLegs(s, { hits: full.hits.filter((h) => h.from !== 'things') }, full.hits.filter((h) => h.from === 'things')).find((l) => l.index === 2);
    expect(leg).toBeDefined();
    const { svg, canvas, applied } = mount({ data }, s);
    expect(document.body.querySelector('[data-link="2"]')).not.toBeNull();
    click(svg, mid(leg!.points));
    expect(document.body.querySelector('[data-selected-link="2"]')).not.toBeNull();
    key(canvas, 'Delete');
    const l = links(await applied());
    expect(l).toHaveLength(2);
    expect(l.some((x) => x.to === 'cow7.l')).toBe(false);
  });
});
