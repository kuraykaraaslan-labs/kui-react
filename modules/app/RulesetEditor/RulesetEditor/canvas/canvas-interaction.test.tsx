import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesetEditor, type RulesetEditorRef, type RulesetGraph } from '../index';
import { MINI_KEY, MINI_MANY, miniMapping, miniToWorld, miniViewport, miniVisible, type MiniBox } from '../hooks/useMiniMap';
import { revealView } from '../geometry';
import type { RuleEdge, RuleNode } from '../../types';

beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } });
afterEach(() => cleanup());

const node = (nodeId: string, type: string, label: string, x: number, y: number): RuleNode => ({ nodeId, type, label, x, y });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

const NODES = [
  node('n1', 'TRIGGER', 'Source', 0, 0),
  node('n2', 'FILTER', 'Gate', 300, 0),
  node('n3', 'ACTION', 'Sink', 600, 0),
];
const EDGES = [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'true', 'n3')];

function setup(props: Partial<React.ComponentProps<typeof RulesetEditor>> = {}) {
  const ref = createRef<RulesetEditorRef>();
  const onChange = vi.fn<(g: RulesetGraph) => void>();
  const utils = render(<RulesetEditor ref={ref} initialNodes={NODES} initialEdges={EDGES} onChange={onChange} chainName="Chain" {...props} />);
  const canvas = screen.getByLabelText('Rule chain canvas');
  const last = () => onChange.mock.calls.at(-1)?.[0];
  const pos = (id: string) => { const n = last()?.nodes.find((x) => x.nodeId === id); return n ? { x: n.x, y: n.y } : undefined; };
  return { ref, onChange, canvas, last, pos, ...utils };
}

const nodeEl = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\(`) });
const world = () => screen.getByTestId('ruleset-world');

type Ptr = PointerEventInit & { pointerType?: string };
const down = (el: Element, p: Ptr) => fireEvent.pointerDown(el, { button: 0, pointerId: 1, ...p });
const move = (el: Element, p: Ptr) => fireEvent.pointerMove(el, { pointerId: 1, ...p });
const up = (el: Element, p: Ptr = {}) => fireEvent.pointerUp(el, { button: 0, pointerId: 1, ...p });

const SCATTERED = [
  node('n1', 'TRIGGER', 'Source', 40, 400),
  node('n2', 'FILTER', 'Gate', 90, 20),
  node('n3', 'ACTION', 'Sink', 700, 250),
];

describe('auto layout', () => {
  it('arranges with the button in ONE undo step', async () => {
    const user = userEvent.setup();
    const { last, pos } = setup({ initialNodes: SCATTERED });
    await user.click(screen.getByRole('button', { name: 'Arrange the blocks' }));
    // top left of the old boxes kept: x 40, y 20; layers left to right
    expect(pos('n1')).toEqual({ x: 40, y: 20 });
    expect(pos('n2')!.x).toBeGreaterThan(pos('n1')!.x);
    expect(pos('n3')!.x).toBeGreaterThan(pos('n2')!.x);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(last()?.nodes.map((n) => [n.x, n.y])).toEqual([[40, 400], [90, 20], [700, 250]]);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(pos('n3')!.x).toBeGreaterThan(pos('n2')!.x);
  });

  it('moves the group frame with its members', async () => {
    const user = userEvent.setup();
    const { container } = setup({
      initialNodes: SCATTERED, initialEdges: EDGES,
      initialGroups: [{ groupId: 'g1', name: 'Pair', color: 0, nodeIds: ['n2', 'n3'] }],
    });
    const frame = container.querySelector<HTMLElement>('[data-group-id="g1"]')!;
    const before = frame.style.left + frame.style.top;
    await user.click(screen.getByRole('button', { name: 'Arrange the blocks' }));
    expect(container.querySelector<HTMLElement>('[data-group-id="g1"]')!.style.left + container.querySelector<HTMLElement>('[data-group-id="g1"]')!.style.top).not.toBe(before);
  });

  it('says nothing moved when the blocks are already arranged', () => {
    const { ref, onChange } = setup({ initialNodes: SCATTERED });
    let first = false, second = true;
    act(() => { first = ref.current!.arrange(); });
    const calls = onChange.mock.calls.length;
    act(() => { second = ref.current!.arrange(); });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it('is in the background menu, and not when read only', () => {
    const { canvas } = setup({ initialNodes: SCATTERED });
    fireEvent.contextMenu(canvas, { clientX: 500, clientY: 500 });
    const item = screen.getByRole('menuitem', { name: 'Arrange the blocks' });
    expect(item).toBeEnabled();
    fireEvent.click(item);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    cleanup();
    setup({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Arrange the blocks' })).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByLabelText('Rule chain canvas'), { clientX: 500, clientY: 500 });
    expect(screen.queryByRole('menuitem', { name: 'Arrange the blocks' })).not.toBeInTheDocument();
  });

  it('is off for an empty canvas', () => {
    setup({ initialNodes: [], initialEdges: [] });
    expect(screen.getByRole('button', { name: 'Arrange the blocks' })).toBeDisabled();
  });
});

describe('box select', () => {
  it('selects the blocks a Shift drag touches, with no undo step', () => {
    const { canvas } = setup();
    down(canvas, { clientX: 300, clientY: 300, shiftKey: true });
    move(canvas, { clientX: 50, clientY: 5, shiftKey: true });
    expect(screen.getByTestId('ruleset-box')).toBeInTheDocument();
    up(canvas, { clientX: 50, clientY: 5 });
    expect(screen.queryByTestId('ruleset-box')).not.toBeInTheDocument();
    expect(nodeEl('Source')).toHaveAttribute('aria-pressed', 'true');
    expect(nodeEl('Gate')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('adds to the selection with Ctrl, and replaces it with Shift only when not adding', () => {
    const { canvas, ref } = setup();
    act(() => ref.current!.select(['n3']));
    down(canvas, { clientX: 400, clientY: 300, ctrlKey: true });
    move(canvas, { clientX: 250, clientY: 5, ctrlKey: true });
    up(canvas, { clientX: 250, clientY: 5 });
    expect(ref.current!.getSelection()).toEqual(['n3', 'n2']);
  });

  it('a plain drag on the empty canvas still pans and selects nothing', () => {
    const { canvas, ref } = setup();
    act(() => ref.current!.select(['n1']));
    down(canvas, { clientX: 300, clientY: 300 });
    move(canvas, { clientX: 340, clientY: 330 });
    expect(world().style.transform).toContain('translate(40px, 30px)');
    expect(screen.queryByTestId('ruleset-box')).not.toBeInTheDocument();
    up(canvas, { clientX: 340, clientY: 330 });
    expect(ref.current!.getSelection()).toEqual(['n1']);
  });

  it('a click without a drag with Shift does not draw a frame or change the selection', () => {
    const { canvas, ref } = setup();
    act(() => ref.current!.select(['n1']));
    down(canvas, { clientX: 300, clientY: 300, shiftKey: true });
    up(canvas, { clientX: 301, clientY: 300 });
    expect(ref.current!.getSelection()).toEqual(['n1']);
  });

  it('frame mode: a plain drag draws the frame, and a touch selection switches the mode off', async () => {
    const user = userEvent.setup();
    const { canvas, ref } = setup();
    const button = screen.getByRole('button', { name: 'Select blocks with a frame' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    down(canvas, { clientX: 300, clientY: 300, pointerType: 'touch' });
    move(canvas, { clientX: 50, clientY: 5, pointerType: 'touch' });
    expect(screen.getByTestId('ruleset-box')).toBeInTheDocument();
    up(canvas, { clientX: 50, clientY: 5, pointerType: 'touch' });
    expect(ref.current!.getSelection()).toEqual(['n1']);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('frame mode stays on after a mouse selection', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    const button = screen.getByRole('button', { name: 'Select blocks with a frame' });
    await user.click(button);
    down(canvas, { clientX: 300, clientY: 300, pointerType: 'mouse' });
    move(canvas, { clientX: 50, clientY: 5, pointerType: 'mouse' });
    up(canvas, { clientX: 50, clientY: 5, pointerType: 'mouse' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('a cancelled gesture selects nothing', () => {
    const { canvas, ref } = setup();
    down(canvas, { clientX: 300, clientY: 300, shiftKey: true });
    move(canvas, { clientX: 50, clientY: 5, shiftKey: true });
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    expect(screen.queryByTestId('ruleset-box')).not.toBeInTheDocument();
    expect(ref.current!.getSelection()).toEqual([]);
  });
});

describe('grid snap and guide lines', () => {
  it('snaps a dragged block to the 12 px grid', () => {
    const { pos } = setup();
    const el = nodeEl('Gate');
    down(el, { clientX: 400, clientY: 300 });
    // 37 right, 300 down: no other block to line up with vertically
    move(el, { clientX: 437, clientY: 600 });
    up(el, { clientX: 437, clientY: 600 });
    expect(pos('n2')).toEqual({ x: 336, y: 300 });
  });

  it('jumps onto the top of another block, draws the guide, and removes it on release', () => {
    const { pos } = setup();
    const el = nodeEl('Gate');
    down(el, { clientX: 400, clientY: 300 });
    move(el, { clientX: 437, clientY: 304 });
    expect(screen.getAllByTestId('ruleset-guide').length).toBeGreaterThan(0);
    up(el, { clientX: 437, clientY: 304 });
    expect(screen.queryAllByTestId('ruleset-guide')).toHaveLength(0);
    expect(pos('n2')!.y).toBe(0);
  });

  it('moves freely with Alt: no grid, no guide', () => {
    const { pos } = setup();
    const el = nodeEl('Gate');
    down(el, { clientX: 400, clientY: 300 });
    move(el, { clientX: 437, clientY: 304, altKey: true });
    expect(screen.queryAllByTestId('ruleset-guide')).toHaveLength(0);
    up(el, { clientX: 437, clientY: 304 });
    expect(pos('n2')).toEqual({ x: 337, y: 4 });
  });

  it('a click without a drag moves nothing and makes no history step', () => {
    setup();
    const el = nodeEl('Gate');
    down(el, { clientX: 400, clientY: 300 });
    up(el, { clientX: 400, clientY: 300 });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('mini map', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => node(`m${i}`, 'ACTION', `Block ${i}`, (i % 8) * 200, Math.floor(i / 8) * 120));

  it('is hidden for a small flow in view, and the button turns it on and off, remembered', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByTestId('ruleset-minimap')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Mini map' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(screen.getByTestId('ruleset-minimap')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem(MINI_KEY)).toBe('on');
    await user.click(button);
    expect(screen.queryByTestId('ruleset-minimap')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(MINI_KEY)).toBe('off');
  });

  it('starts from the saved choice', () => {
    window.localStorage.setItem(MINI_KEY, 'on');
    setup();
    expect(screen.getByTestId('ruleset-minimap')).toBeInTheDocument();
  });

  it('shows by itself above 30 blocks, unless it was switched off', () => {
    setup({ initialNodes: many(MINI_MANY + 1), initialEdges: [] });
    expect(screen.getByTestId('ruleset-minimap')).toBeInTheDocument();
    cleanup();
    window.localStorage.setItem(MINI_KEY, 'off');
    setup({ initialNodes: many(MINI_MANY + 1), initialEdges: [] });
    expect(screen.queryByTestId('ruleset-minimap')).not.toBeInTheDocument();
  });

  it('has a box per block, a viewport frame, and shows an error in the error colour', () => {
    window.localStorage.setItem(MINI_KEY, 'on');
    setup({ initialNodes: [...NODES, node('bad', 'no.such.block', 'Broken', 0, 300)] });
    const map = screen.getByTestId('ruleset-minimap');
    expect(map.querySelectorAll('[data-mini-node]')).toHaveLength(4);
    expect(map.querySelector('[data-mini-node="bad"]')).toHaveAttribute('data-error', 'true');
    expect(map.querySelector('[data-mini-node="bad"]')).toHaveAttribute('fill', 'var(--error)');
    expect(map.querySelector('[data-mini-node="n1"]')).not.toHaveAttribute('data-error');
    expect(screen.getByTestId('ruleset-minimap-view')).toBeInTheDocument();
    expect(map).toHaveClass('max-md:hidden');
  });

  it('moves the view when you click it', () => {
    window.localStorage.setItem(MINI_KEY, 'on');
    setup();
    const before = world().style.transform;
    const map = screen.getByTestId('ruleset-minimap');
    down(map, { clientX: 150, clientY: 100 });
    expect(world().style.transform).not.toBe(before);
    const clicked = world().style.transform;
    move(map, { clientX: 20, clientY: 20 });
    expect(world().style.transform).not.toBe(clicked);
    up(map);
    const after = world().style.transform;
    move(map, { clientX: 100, clientY: 100 });
    expect(world().style.transform).toBe(after);
  });
});

describe('extension API', () => {
  it('select, getSelection and onSelectionChange', () => {
    const onSelectionChange = vi.fn();
    const { ref } = setup({ onSelectionChange });
    act(() => ref.current!.select(['n1', 'n3', 'ghost']));
    expect(ref.current!.getSelection()).toEqual(['n1', 'n3']);
    expect(nodeEl('Sink')).toHaveAttribute('aria-pressed', 'true');
    expect(onSelectionChange).toHaveBeenLastCalledWith(['n1', 'n3']);
    const calls = onSelectionChange.mock.calls.length;
    act(() => ref.current!.select(['n1', 'n3']));
    expect(onSelectionChange.mock.calls.length).toBe(calls);
    act(() => ref.current!.select([]));
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('replaceGraph swaps the whole graph as one undo step', async () => {
    const user = userEvent.setup();
    const { ref, last } = setup();
    const next: RulesetGraph = { nodes: [node('z1', 'TRIGGER', 'Fresh', 10, 10)], edges: [], groups: [] };
    act(() => ref.current!.replaceGraph(next, { key: 'merge' }));
    expect(last()?.nodes.map((n) => n.nodeId)).toEqual(['z1']);
    expect(nodeEl('Fresh')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(last()?.nodes.map((n) => n.nodeId)).toEqual(['n1', 'n2', 'n3']);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('adds entries to the menu of a block', () => {
    const run = vi.fn();
    const nodeMenuItems = vi.fn(() => [{ kind: 'item' as const, label: 'Show live data', onSelect: run }]);
    setup({ nodeMenuItems });
    fireEvent.contextMenu(nodeEl('Gate'));
    expect(nodeMenuItems).toHaveBeenCalledWith({ nodeIds: ['n2'], readOnly: false });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show live data' }));
    expect(run).toHaveBeenCalled();
  });

  it('offers the extra entries when read only too', () => {
    setup({ readOnly: true, nodeMenuItems: () => [{ kind: 'item', label: 'Show live data', onSelect: () => undefined }] });
    fireEvent.contextMenu(nodeEl('Gate'));
    expect(screen.getByRole('menuitem', { name: 'Show live data' })).toBeInTheDocument();
  });

  it('shows toolbarExtra in the zoom bar and bannerSlot above the canvas', () => {
    setup({ toolbarExtra: <button type="button">Extra tool</button>, bannerSlot: <div role="status">Draft kept</div> });
    const bar = screen.getByRole('button', { name: 'Zoom out' }).parentElement!;
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Extra tool' }));
    const banner = screen.getByRole('status');
    const canvas = screen.getByLabelText('Rule chain canvas');
    expect(banner.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(canvas.contains(banner)).toBe(false);
  });

  it('reveal does not throw on an unmeasured canvas or an unknown id', () => {
    const { ref } = setup();
    expect(() => act(() => { ref.current!.reveal('n3'); ref.current!.reveal(['ghost']); })).not.toThrow();
  });
});

describe('mini map and view helpers', () => {
  const boxes: MiniBox[] = [{ x: 0, y: 0, w: 160, h: 100 }, { x: 1000, y: 500, w: 160, h: 100 }];

  it('shows by the rule: choice, then count, then blocks out of view', () => {
    const view = { x: 0, y: 0, k: 1 };
    expect(miniVisible(null, [], view, { w: 800, h: 600 })).toBe(false);
    expect(miniVisible(true, [], view, { w: 800, h: 600 })).toBe(false);
    expect(miniVisible(null, boxes.slice(0, 1), view, { w: 800, h: 600 })).toBe(false);
    expect(miniVisible(null, boxes, view, { w: 800, h: 600 })).toBe(true);
    expect(miniVisible(false, boxes, view, { w: 800, h: 600 })).toBe(false);
    expect(miniVisible(true, boxes.slice(0, 1), view, { w: 800, h: 600 })).toBe(true);
    expect(miniVisible(null, boxes, view, { w: 0, h: 0 })).toBe(false);
    expect(miniVisible(null, Array.from({ length: 31 }, () => boxes[0]), view, { w: 800, h: 600 })).toBe(true);
    expect(miniVisible(null, Array.from({ length: 30 }, () => boxes[0]), view, { w: 800, h: 600 })).toBe(false);
  });

  it('counts a block that is cut by the edge as out of view', () => {
    expect(miniVisible(null, [{ x: 700, y: 0, w: 160, h: 100 }], { x: 0, y: 0, k: 1 }, { w: 800, h: 600 })).toBe(true);
    expect(miniVisible(null, [{ x: 100, y: 100, w: 160, h: 100 }], { x: -50, y: 0, k: 1 }, { w: 800, h: 600 })).toBe(false);
  });

  it('maps the world into 180 x 120 and back', () => {
    const m = miniMapping(boxes)!;
    expect(m.x0).toBe(-40);
    const w = miniToWorld(m, m.ox + (0 - m.x0) * m.s, m.oy + (0 - m.y0) * m.s);
    expect(w.x).toBeCloseTo(0);
    expect(w.y).toBeCloseTo(0);
    expect(m.ox + (1160 + 40 - m.x0) * m.s).toBeLessThanOrEqual(180.001);
    expect(m.oy + (600 + 40 - m.y0) * m.s).toBeLessThanOrEqual(120.001);
    expect(miniMapping([])).toBeNull();
  });

  it('draws the visible part as a frame', () => {
    const m = miniMapping(boxes)!;
    const vp = miniViewport(m, { x: 0, y: 0, k: 1 }, { w: 400, h: 300 });
    expect(vp.w).toBeCloseTo(400 * m.s);
    expect(vp.h).toBeCloseTo(300 * m.s);
    expect(vp.x).toBeCloseTo(m.ox + 40 * m.s);
  });

  it('reveals: nothing when in view, else centred, and zoomed out only when too big', () => {
    const size = { w: 800, h: 600 };
    expect(revealView([{ x: 100, y: 100, w: 160, h: 100 }], { x: 0, y: 0, k: 1 }, size)).toBeNull();
    const far = revealView([{ x: 2000, y: 1000, w: 160, h: 100 }], { x: 0, y: 0, k: 1 }, size)!;
    expect(far.k).toBe(1);
    expect(far.x + 2080 * far.k).toBeCloseTo(400);
    expect(far.y + 1050 * far.k).toBeCloseTo(300);
    const wide = revealView([{ x: 0, y: 0, w: 4000, h: 100 }], { x: 0, y: 0, k: 1 }, size)!;
    expect(wide.k).toBeLessThan(1);
    expect(wide.k).toBeGreaterThanOrEqual(0.4);
    expect(revealView([], { x: 0, y: 0, k: 1 }, size)).toBeNull();
    expect(revealView([{ x: 5000, y: 0, w: 10, h: 10 }], { x: 0, y: 0, k: 1 }, { w: 0, h: 0 })).toBeNull();
  });
});
