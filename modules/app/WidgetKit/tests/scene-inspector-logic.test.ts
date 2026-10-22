import { describe, it, expect } from 'vitest';
import { SCADA_SCENE } from '../templates/scada-scene';
import type { SceneSettings } from '../views/scada-scene-logic';
import { sceneModel } from '../views/scada-scene-logic';
import {
  chain, colourProblem, elementOp, elementRow, fieldsOf, fieldVisible, inspectorTarget, linkOp, sceneOp, shapeOp, sharedValues, storedValue,
} from '../views/scene-inspector-logic';
import { setElementProps, type Rec } from '../views/scene-edit-logic';
import { deepFreeze, smallScene } from './scene-edit-fixture';

const els = (s: SceneSettings) => s.elements as Rec[];
const links = (s: SceneSettings) => s.links as Rec[];
const shapes = (s: SceneSettings) => s.shapes as Rec[];

describe('inspectorTarget', () => {
  const s = smallScene();
  it('is the scene when nothing (valid) is selected', () => {
    expect(inspectorTarget({}, s)).toEqual({ kind: 'scene' });
    expect(inspectorTarget({ elements: ['ghost'], links: [9], shapes: [9] }, s)).toEqual({ kind: 'scene' });
  });
  it('is one kind when the selection is one kind, dropping what is not there and duplicates', () => {
    expect(inspectorTarget({ elements: ['pump1', 'pump1', 'ghost'] }, s)).toEqual({ kind: 'elements', ids: ['pump1'] });
    expect(inspectorTarget({ links: [0, 1, 5] }, s)).toEqual({ kind: 'links', indices: [0, 1] });
    expect(inspectorTarget({ shapes: [2] }, s)).toEqual({ kind: 'shapes', indices: [2] });
  });
  it('is mixed for several kinds, with the counts', () => {
    expect(inspectorTarget({ elements: ['pump1', 'tank1'], links: [0], shapes: [] }, s)).toEqual({ kind: 'mixed', elements: 2, links: 1, shapes: 0 });
  });
});

describe('fieldsOf', () => {
  it('lists the template\'s own fields of each scope, nothing invented and nothing dropped', () => {
    const templ = (k: 'elements' | 'links' | 'shapes') => Object.keys(SCADA_SCENE.fields[k].fields ?? {});
    expect(fieldsOf('element').map((f) => f.key)).toEqual(templ('elements'));
    expect(fieldsOf('link').map((f) => f.key)).toEqual(templ('links'));
    expect(fieldsOf('shape').map((f) => f.key)).toEqual(templ('shapes').filter((k) => k !== 'kind'));
    const scene = fieldsOf('scene').map((f) => f.key);
    expect(scene).toEqual(expect.arrayContaining(['width', 'height', 'scale', 'anchor', 'background', 'fit', 'showLabels', 'calm', 'animation', 'idleColor', 'criticalColor']));
    for (const lists of ['elements', 'links', 'shapes', 'rules']) expect(scene).not.toContain(lists);
  });
  it('shows a field added to the template without a change here (in "more")', () => {
    const extended = { ...SCADA_SCENE, fields: { ...SCADA_SCENE.fields, elements: { ...SCADA_SCENE.fields.elements, fields: { ...SCADA_SCENE.fields.elements.fields, brandNew: { label: 'Brand new', type: 'text' as const } } } } };
    const f = fieldsOf('element', extended).find((x) => x.key === 'brandNew');
    expect(f).toMatchObject({ group: 'more', field: { label: 'Brand new' } });
  });
  it('puts every known field of every scope in a named group', () => {
    for (const scope of ['element', 'link', 'shape', 'scene'] as const) for (const f of fieldsOf(scope)) expect(f.group, `${scope}.${f.key}`).not.toBe('more');
  });
});

describe('fieldVisible', () => {
  it('shows the scale only for a symbol that has one, the number only for one that prints it, the length only for a run', () => {
    const tv = { symbol: 'home.tv' }; const router = { symbol: 'home.router' };
    expect(fieldVisible('element', 'min', [tv])).toBe(true);
    expect(fieldVisible('element', 'min', [router])).toBe(false);
    expect(fieldVisible('element', 'showValue', [tv])).toBe(true);
    expect(fieldVisible('element', 'valuePos', [router])).toBe(false);
    // No home symbol is a straight run.
    expect(fieldVisible('element', 'length', [tv])).toBe(false);
    expect(fieldVisible('element', 'length', [router])).toBe(false);
    expect(fieldVisible('element', 'min', [router, tv])).toBe(true);
    expect(fieldVisible('element', 'label', [router])).toBe(true);
  });
  it('shows the medium colour only for a colour of one\'s own, for symbols and connections', () => {
    expect(fieldVisible('element', 'mediumColor', [{ medium: 'hot' }])).toBe(false);
    expect(fieldVisible('element', 'mediumColor', [{ medium: 'custom' }])).toBe(true);
    expect(fieldVisible('link', 'mediumColor', [{}])).toBe(false);
    expect(fieldVisible('link', 'mediumColor', [{ medium: 'custom' }])).toBe(true);
  });
  it('shows a shape the fields its kind uses', () => {
    expect(fieldVisible('shape', 'size', [{ kind: 'text' }])).toBe(true);
    expect(fieldVisible('shape', 'w', [{ kind: 'text' }])).toBe(false);
    expect(fieldVisible('shape', 'w', [{ kind: 'zone' }])).toBe(true);
    expect(fieldVisible('shape', 'dashed', [{ kind: 'divider' }])).toBe(true);
    expect(fieldVisible('shape', 'size', [{ kind: 'zone' }])).toBe(false);
    expect(fieldVisible('shape', 'size', [{ kind: 'zone' }, { kind: 'text' }])).toBe(true);
  });
  it('shows everything when it knows nothing about the row (a symbol the library lacks)', () => {
    expect(fieldVisible('element', 'min', [{ symbol: 'nope' }])).toBe(true);
    expect(fieldVisible('element', 'length', [])).toBe(true);
  });
});

describe('sharedValues', () => {
  it('keeps what all rows agree on and names what differs', () => {
    const r = sharedValues([{ a: 1, b: 'x', c: true }, { a: 1, b: 'y' }], ['a', 'b', 'c', 'd']);
    expect(r.values).toEqual({ a: 1 });
    expect([...r.differs].sort()).toEqual(['b', 'c']);
  });
  it('counts an unset key as the field\'s default, so it is not a difference', () => {
    const r = sharedValues([{ turn: '0' }, {}], ['turn'], { turn: '0' });
    expect(r.differs.size).toBe(0);
    expect(r.values).toEqual({ turn: '0' });
    expect(sharedValues([{ turn: '90' }, {}], ['turn'], { turn: '0' }).differs.has('turn')).toBe(true);
    expect(sharedValues([{}, {}], ['turn'], { turn: '0' })).toEqual({ values: {}, differs: new Set() });
  });
  it('is empty for no rows', () => {
    expect(sharedValues([], ['a'])).toEqual({ values: {}, differs: new Set() });
  });
});

describe('storedValue', () => {
  const f = (o: object) => ({ label: 'x', ...o }) as never;
  it('removes an empty text, choice or colour and a number that may be empty; a number that may not goes to its default', () => {
    expect(storedValue(f({ type: 'text' }), '')).toBeUndefined();
    expect(storedValue(f({ type: 'color' }), '')).toBeUndefined();
    expect(storedValue(f({ type: 'select' }), '')).toBeUndefined();
    expect(storedValue(f({ type: 'number', nullable: true }), undefined)).toBeUndefined();
    expect(storedValue(f({ type: 'number', value: 0 }), undefined)).toBe(0);
    expect(storedValue(f({ type: 'number', value: 0 }), Number.NaN)).toBe(0);
    expect(storedValue(f({ type: 'number' }), undefined)).toBeUndefined();
  });
  it('keeps what is a value, zero and false included', () => {
    expect(storedValue(f({ type: 'number' }), 0)).toBe(0);
    expect(storedValue(f({ type: 'boolean' }), false)).toBe(false);
    expect(storedValue(f({ type: 'text' }), 'Pump')).toBe('Pump');
  });
  it('knows a bad colour', () => {
    expect(colourProblem('#ff')).toBe(true);
    expect(colourProblem('url(x)')).toBe(true);
    expect(colourProblem('#ff0000')).toBe(false);
    expect(colourProblem('var(--warning)')).toBe(false);
    expect(colourProblem('')).toBe(false);
    expect(colourProblem(undefined)).toBe(false);
  });
});

describe('edits', () => {
  it('writes symbol fields to every selected symbol through the edit model, and refuses what it refuses', () => {
    const r = elementOp(['pump1', 'tank1'], { label: 'X', medium: 'hot' })(smallScene());
    expect(els(r.settings).filter((e) => e.label === 'X').map((e) => e.id)).toEqual(['tank1', 'pump1']);
    expect(elementOp(['pump1'], { scale: 99 })(smallScene()).refused).toMatch(/scale/);
    expect(elementOp(['pump1'], { turn: '45' })(smallScene()).refused).toBeTruthy();
    const same = smallScene();
    expect(elementOp(['pump1'], { label: undefined })(same).settings).toBe(same);
  });
  it('moves a connection end with reconnectLink and writes the rest with setLinkProps, atomically', () => {
    const s = smallScene();
    const r = linkOp([1], { to: 'tank1.t', kind: 'hose', arrows: true })(s);
    expect(links(r.settings)[1]).toMatchObject({ from: 'pump1.r', to: 'tank1.t', kind: 'hose', arrows: true });
    const bad = linkOp([1], { to: 'ghost.t', kind: 'hose' })(s);
    expect(bad.refused).toBeTruthy();
    expect(bad.settings).toBe(s);
    expect(linkOp([1], { to: '' })(s).refused).toBeTruthy();
  });
  it('renames a connection id so the rules that named it follow', () => {
    const r = linkOp([1], { id: 'feed' })(smallScene());
    expect(links(r.settings)[1].id).toBe('feed');
    expect((r.settings as { rules: Rec[] }).rules.some((x) => x.target === 'feed')).toBe(true);
  });
  it('applies one change to several connections', () => {
    const r = linkOp([0, 1], { medium: 'cold' })(smallScene());
    expect(links(r.settings).map((l) => l.medium)).toEqual(['cold', 'cold']);
  });
  it('writes shape fields, and the size through resizeShape', () => {
    const s = smallScene();
    const r = shapeOp([1], { text: 'Zone B', tone: 'info', w: 10, h: 300 })(s);
    expect(shapes(r.settings)[1]).toMatchObject({ text: 'Zone B', tone: 'info', w: 20, h: 300 });
    expect(shapeOp([1], { tone: 'purple' })(s).refused).toBeTruthy();
    expect(shapeOp([0], { w: 50 })(s).refused).toMatch(/no size/);
    expect(shapeOp([2], { w: 600 })(s).settings).toBeTruthy();
    expect(shapes(shapeOp([2], { w: 600 })(s).settings)[2]).toMatchObject({ w: 600, h: 0 });
  });
  it('writes the canvas through setCanvas and the rest by the template\'s definition', () => {
    const s = smallScene();
    const model = sceneModel(s, {});
    const r = sceneOp({ width: 1400, scale: 0.8, background: 'dots', calm: true, idleColor: 'var(--info)', showLabels: false }, model)(s);
    expect(r.settings).toMatchObject({ width: 1400, scale: 0.8, background: 'dots', calm: true, idleColor: 'var(--info)', showLabels: false });
    expect(sceneOp({ width: 10 })(s).refused).toMatch(/200 to 4000/);
    expect(sceneOp({ background: 'stripes' })(s).refused).toMatch(/choose one/);
    expect(sceneOp({ calm: 'yes' })(s).refused).toMatch(/on or off/);
    expect(sceneOp({ idleColor: 'nope' })(s).refused).toMatch(/not a colour/);
    expect(sceneOp({ elements: [] })(s).refused).toMatch(/not a diagram setting/);
    expect(sceneOp({ rules: [] })(s).refused).toMatch(/not a diagram setting/);
    expect(sceneOp({ width: undefined })(s).refused).toMatch(/cannot be empty/);
    expect(sceneOp({ idleColor: undefined })(s).settings).toBe(s);
  });
  it('changes what x and y mean without moving anything on the picture', () => {
    const s = smallScene();
    const model = sceneModel(s, {});
    const r = sceneOp({ anchor: 'corner' }, model)(s);
    expect(r.settings.anchor).toBe('corner');
    const moved = sceneModel(r.settings, {}).hits.map((h) => [h.id, h.x, h.y]);
    expect(moved).toEqual(model.hits.map((h) => [h.id, h.x, h.y]));
  });
  it('chains edits atomically and does not touch its input', () => {
    const s = deepFreeze(smallScene());
    const ok = chain(s, [(c) => setElementProps(c, 'pump1', { label: 'A' }), (c) => setElementProps(c, 'tank1', { label: 'B' })]);
    expect(els(ok.settings).map((e) => e.label)).toEqual(['B', 'A', undefined]);
    const bad = chain(s, [(c) => setElementProps(c, 'pump1', { label: 'A' }), (c) => setElementProps(c, 'tank1', { scale: 99 })]);
    expect(bad.settings).toBe(s);
    expect(bad.refused).toBeTruthy();
    expect(chain(s, []).settings).toBe(s);
    expect(elementRow(s, 'pump1')).toMatchObject({ symbol: 'home.router' });
    expect(elementRow(s, 'ghost')).toBeUndefined();
  });
});
