import { describe, it, expect } from 'vitest';
import type { WhatIfState } from '../views/scene-editor-types';
import {
  addSampleThing, emptyWhatIf, isEmptyWhatIf, MAX_SAMPLE_THINGS, overlayParams, overlayRows, overrideCount, readOverride, removeSampleThing,
  sampleThings, setOverride, setParamOverride, setSampleThing, thingColumns,
} from '../views/scene-whatif-logic';

describe('what-if overrides', () => {
  it('starts empty', () => {
    expect(isEmptyWhatIf(emptyWhatIf())).toBe(true);
    expect(overrideCount(emptyWhatIf())).toBe(0);
  });
  it('overrides a column of one or many rows and counts the cells and the parameters', () => {
    let s = setOverride(emptyWhatIf(), ['pump1'], 'value', 12);
    s = setOverride(s, ['pump1', 'tank1'], 'running', true);
    s = setParamOverride(s, 'mode', 'night');
    expect(s).toEqual({ rows: { pump1: { value: 12, running: true }, tank1: { running: true } }, params: { mode: 'night' } });
    expect(overrideCount(s)).toBe(4);
    expect(isEmptyWhatIf(s)).toBe(false);
  });
  it('puts the real value back, and drops a row with nothing left', () => {
    let s = setOverride(emptyWhatIf(), ['a'], 'value', 1);
    s = setOverride(s, ['a'], 'value', undefined);
    expect(s).toEqual({ rows: {}, params: {} });
    s = setParamOverride(setParamOverride(emptyWhatIf(), 'm', 'x'), 'm', undefined);
    expect(s.params).toEqual({});
    expect(setParamOverride(setParamOverride(emptyWhatIf(), 'm', 'x'), 'm', '').params).toEqual({});
  });
  it('never changes its input and keeps a value that is zero or false', () => {
    const base = Object.freeze({ rows: Object.freeze({}), params: Object.freeze({}) }) as unknown as WhatIfState;
    const s = setOverride(base, ['a'], 'value', 0);
    expect(s.rows.a).toEqual({ value: 0 });
    expect(setOverride(s, ['a'], 'running', false).rows.a).toEqual({ value: 0, running: false });
    expect(Object.keys(base.rows)).toEqual([]);
  });
  it('refuses names that would reach a prototype member, or nothing', () => {
    const s = emptyWhatIf();
    expect(setOverride(s, ['__proto__'], 'value', 1)).toEqual(s);
    expect(setOverride(s, ['a'], 'constructor', 1)).toBe(s);
    expect(setOverride(s, ['a'], '', 1)).toBe(s);
    expect(setParamOverride(s, '__proto__', 1)).toBe(s);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('reads what several rows share', () => {
    const s = setOverride(setOverride(emptyWhatIf(), ['a', 'b'], 'value', 5), ['c'], 'value', 6);
    expect(readOverride(s, ['a', 'b'], 'value')).toEqual({ kind: 'same', value: 5 });
    expect(readOverride(s, ['a', 'c'], 'value')).toEqual({ kind: 'mixed' });
    expect(readOverride(s, ['a', 'z'], 'value')).toEqual({ kind: 'mixed' });
    expect(readOverride(s, ['z'], 'value')).toEqual({ kind: 'none' });
    expect(readOverride(s, [], 'value')).toEqual({ kind: 'none' });
    expect(readOverride(setOverride(emptyWhatIf(), ['a'], 'running', false), ['a'], 'running')).toEqual({ kind: 'same', value: false });
  });
  it('lays the overrides over rows and parameters without changing the real ones', () => {
    const real = new Map([['a', { id: 'a', value: 1, label: 'A' }]]);
    const s = setOverride(emptyWhatIf(), ['a', 'b'], 'value', 9);
    const rows = overlayRows(real, s);
    expect(rows.get('a')).toEqual({ id: 'a', value: 9, label: 'A' });
    expect(rows.get('b')).toEqual({ value: 9 });
    expect(real.get('a')).toEqual({ id: 'a', value: 1, label: 'A' });
    expect(overlayParams({ mode: 'day', site: 'x' }, setParamOverride(emptyWhatIf(), 'mode', 'night'))).toEqual({ mode: 'night', site: 'x' });
  });
});

describe('sample things (never stored)', () => {
  const s = { thingsIdColumn: 'tag', thingsXColumn: 'px', thingsYColumn: 'py' };
  it('adds a sample row in the scene\'s own columns with the first free id, and counts it', () => {
    let w = addSampleThing(emptyWhatIf(), s, { x: 300, y: 120 }, 'home.tv', ['sample1', 'pump1']);
    expect(sampleThings(w)).toEqual([{ tag: 'sample2', px: 300, py: 120, symbol: 'home.tv' }]);
    w = addSampleThing(w, s, { x: 1, y: 2 }, 'home.tv', ['sample1']);
    expect(sampleThings(w).map((r) => r.tag)).toEqual(['sample2', 'sample3']);
    expect(overrideCount(w)).toBe(2);
    expect(isEmptyWhatIf(w)).toBe(false);
  });
  it('writes metres back when the scene reads metres, and leaves the symbol out when every thing has one fixed symbol', () => {
    const metres = { thingsUnits: 'metres' as const, thingsScale: 50, thingsOriginX: 100, thingsOriginY: 40, thingsSymbol: 'home.router' };
    expect(sampleThings(addSampleThing(emptyWhatIf(), metres, { x: 200, y: 190 }, 'home.tv'))).toEqual([{ id: 'sample1', x: 2, y: 3 }]);
  });
  it(`stops at ${MAX_SAMPLE_THINGS}`, () => {
    let w = emptyWhatIf();
    for (let i = 0; i < MAX_SAMPLE_THINGS + 3; i += 1) w = addSampleThing(w, {}, { x: i, y: 0 }, 'home.tv');
    expect(sampleThings(w)).toHaveLength(MAX_SAMPLE_THINGS);
  });
  it('sets and clears a column of one sample, never its id, and removes a sample', () => {
    let w = addSampleThing(addSampleThing(emptyWhatIf(), {}, { x: 0, y: 0 }, 'home.tv'), {}, { x: 5, y: 5 }, 'home.tv');
    w = setSampleThing(w, {}, 'sample2', 'status', 'warning');
    expect(sampleThings(w)[1]).toMatchObject({ id: 'sample2', status: 'warning' });
    expect(sampleThings(w)[0]).not.toHaveProperty('status');
    expect(setSampleThing(w, {}, 'sample2', 'id', 'other')).toBe(w);
    expect(setSampleThing(w, {}, 'sample2', '__proto__', 1)).toBe(w);
    expect(setSampleThing(w, {}, 'nobody', 'status', 'warning')).toBe(w);
    w = setSampleThing(w, {}, 'sample2', 'status', undefined);
    expect(sampleThings(w)[1]).not.toHaveProperty('status');
    w = removeSampleThing(w, {}, 'sample1');
    expect(sampleThings(w).map((r) => r.id)).toEqual(['sample2']);
    w = removeSampleThing(w, {}, 'sample2');
    expect(w).toEqual(emptyWhatIf());
    expect(removeSampleThing(w, {}, 'sample2')).toBe(w);
  });
  it('never changes its input', () => {
    const w = Object.freeze(emptyWhatIf()) as WhatIfState;
    expect(() => addSampleThing(w, {}, { x: 0, y: 0 }, 'home.tv')).not.toThrow();
    expect(w.things).toBeUndefined();
  });
  it('reads the columns from the settings with the template\'s defaults', () => {
    expect(thingColumns({})).toEqual({ id: 'id', symbol: 'symbol', x: 'x', y: 'y' });
    expect(thingColumns({ thingsIdColumn: 'tag', thingsSymbolColumn: 'kind' })).toMatchObject({ id: 'tag', symbol: 'kind' });
  });
});
