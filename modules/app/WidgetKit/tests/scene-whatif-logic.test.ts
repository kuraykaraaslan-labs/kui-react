import { describe, it, expect } from 'vitest';
import type { WhatIfState } from '../views/scene-editor-types';
import { emptyWhatIf, isEmptyWhatIf, overlayParams, overlayRows, overrideCount, readOverride, setOverride, setParamOverride } from '../views/scene-whatif-logic';

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
