import { describe, it, expect } from 'vitest';
import type { SceneSettings } from '../views/scada-scene-logic';
import {
  addElement, apply, canRedo, canUndo, createHistory, HISTORY_LIMIT, moveElements, redo, renameElement, snapMove, snapPoint, undo,
} from '../views/scene-edit-logic';
import { smallScene } from './scene-edit-fixture';

const x = (s: SceneSettings, i = 1) => (s.elements as Array<{ x: number }>)[i].x;

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const h = createHistory(smallScene());
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
  it('undoes and redoes an edit to the very same settings', () => {
    const start = smallScene();
    const { history, result } = apply(createHistory(start), (s) => addElement(s, 'home.router', { x: 1, y: 1 }));
    expect(history.present).toBe(result.settings);
    const back = undo(history);
    expect(back.present).toBe(start);
    expect(canRedo(back)).toBe(true);
    expect(redo(back).present).toBe(result.settings);
  });
  it('leaves the history alone for a refused or empty edit', () => {
    const h = createHistory(smallScene());
    expect(apply(h, (s) => renameElement(s, 'pump1', 'tank1')).history).toBe(h);
    expect(apply(h, (s) => moveElements(s, ['pump1'], 0, 0)).history).toBe(h);
    expect(apply(h, (s) => renameElement(s, 'pump1', 'tank1')).result.refused).toBeTruthy();
  });
  it('drops the redo steps on a new edit', () => {
    let h = createHistory(smallScene());
    h = apply(h, (s) => moveElements(s, ['pump1'], 10, 0)).history;
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = apply(h, (s) => moveElements(s, ['pump1'], 0, 10)).history;
    expect(canRedo(h)).toBe(false);
  });
  it('coalesces a continuous drag into one entry', () => {
    let h = createHistory(smallScene());
    for (let i = 0; i < 20; i += 1) h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0), 'drag:pump1').history;
    expect(h.past).toHaveLength(1);
    expect(x(h.present)).toBe(320);
    expect(x(undo(h).present)).toBe(300);
    expect(canUndo(undo(h))).toBe(false);
  });
  it('starts a new entry for another group, for an edit without a group, and after an undo', () => {
    let h = createHistory(smallScene());
    h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0), 'drag:a').history;
    h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0), 'drag:b').history;
    h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0)).history;
    h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0), 'drag:b').history;
    expect(h.past).toHaveLength(4);
    h = undo(h);
    h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0), 'drag:b').history;
    expect(h.past).toHaveLength(4);
    expect(x(h.present)).toBe(304);
  });
  it('keeps at most 100 steps and drops the oldest', () => {
    let h = createHistory(smallScene());
    for (let i = 0; i < 130; i += 1) h = apply(h, (s) => moveElements(s, ['pump1'], 1, 0)).history;
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    let back = h;
    while (canUndo(back)) back = undo(back);
    expect(x(back.present)).toBe(330);
  });
  it('does not change the history it was given', () => {
    const h = createHistory(smallScene());
    const next = apply(h, (s) => moveElements(s, ['pump1'], 5, 0)).history;
    expect(h.past).toHaveLength(0);
    expect(next).not.toBe(h);
  });
});

describe('snapPoint', () => {
  const others = [{ x: 270, y: 170, w: 60, h: 60 }]; // centre (300, 200), edges 270 and 330, 170 and 230
  it('snaps to the grid, 10 by default', () => {
    expect(snapPoint({ x: 103, y: 96 })).toEqual({ x: 100, y: 100, guides: [] });
    expect(snapPoint({ x: 106, y: 94 }, { grid: 20 })).toMatchObject({ x: 100, y: 100 });
  });
  it('leaves the point alone with the grid off', () => {
    expect(snapPoint({ x: 103.456, y: 96 }, { grid: false })).toMatchObject({ x: 103.46, y: 96 });
    expect(snapPoint({ x: 103, y: 96 }, { grid: 0 })).toMatchObject({ x: 103, y: 96 });
  });
  it('snaps a centre to a neighbour\'s centre and returns the guide', () => {
    const r = snapPoint({ x: 302, y: 400 }, { others, grid: false });
    expect(r.x).toBe(300);
    expect(r.y).toBe(400);
    expect(r.guides).toEqual([{ axis: 'x', at: 300, kind: 'center', from: 170, to: 400 }]);
  });
  it('snaps edges of the dragged box to edges of a neighbour', () => {
    const r = snapPoint({ x: 400, y: 202 }, { others, grid: false, size: { w: 40, h: 60 } });
    expect(r.y).toBe(200);
    expect(r.guides.find((g) => g.axis === 'y' && g.at === 200)).toMatchObject({ kind: 'center' });
    const e = snapPoint({ x: 354, y: 500 }, { others, grid: false, size: { w: 40, h: 40 } });
    expect(e.x).toBe(350);
    expect(e.guides.find((g) => g.axis === 'x')).toMatchObject({ at: 330, kind: 'edge' });
  });
  it('prefers a guide to the grid within the threshold, and the grid beyond it', () => {
    expect(snapPoint({ x: 303, y: 400 }, { others }).x).toBe(300);
    expect(snapPoint({ x: 304, y: 400 }, { others, grid: 7 }).x).toBe(300);
    const far = snapPoint({ x: 318, y: 400 }, { others, threshold: 5 });
    expect(far.x).toBe(320);
    expect(far.guides).toEqual([]);
  });
  it('turns the guides off', () => {
    expect(snapPoint({ x: 303, y: 203 }, { others, guides: false, grid: false })).toEqual({ x: 303, y: 203, guides: [] });
  });
  it('shows guides to every neighbour that lines up and merges them into one line', () => {
    const three = [...others, { x: 270, y: 370, w: 60, h: 60 }];
    const r = snapPoint({ x: 301, y: 300 }, { others: three, grid: false });
    expect(r.guides).toEqual([{ axis: 'x', at: 300, kind: 'center', from: 170, to: 430 }]);
  });
  it('snaps a move of a box by its centre', () => {
    const r = snapMove({ x: 100, y: 400, w: 60, h: 60 }, { x: 168, y: 3 }, { others, grid: false });
    expect(r.dx).toBe(170); // centre x 130 + 168 = 298 -> 300
    expect(r.dy).toBe(3);
    expect(snapMove({ x: 100, y: 400, w: 60, h: 60 }, { x: 13, y: 3 }, {})).toMatchObject({ dx: 10, dy: 0 });
  });
});
