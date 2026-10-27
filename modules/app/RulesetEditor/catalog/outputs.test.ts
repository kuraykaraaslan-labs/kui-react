import { describe, expect, it } from 'vitest';
import {
  OUTPUT_NAME_MAX, outputNameProblems, outputParamsOf, outputPortMap, outputPrefix, outputRows, outputsExample, paramsOfRows, splitPinNames,
} from './outputs';
import type { ParamSpec } from './types';

const SCHEMA: Record<string, ParamSpec> = {
  code: { type: 'code' },
  outputs: { type: 'number', int: true, min: 1, max: 4, default: 1, pins: 'labels', pin_notes: 'notes' },
  labels: { type: 'string', max_len: 128, default: '' },
  notes: { type: 'list' },
};
const KEYS = { count: 'outputs', names: 'labels', notes: 'notes' };
const to = (n: number, name?: string) => (name ? `output ${n} (${name})` : `output ${n}`);

describe('outputParamsOf', () => {
  it('finds the count param with pins, and the notes param only when the schema has it', () => {
    expect(outputParamsOf(SCHEMA)).toEqual(KEYS);
    const { notes: _n, ...noNotes } = SCHEMA;
    expect(outputParamsOf(noNotes)).toEqual({ count: 'outputs', names: 'labels' });
    expect(outputParamsOf({ n: { type: 'number', pins: 'missing' } })).toBeNull();
    expect(outputParamsOf({ n: { type: 'number' } })).toBeNull();
  });
});

describe('rows and params', () => {
  it('splits a names list by position', () => {
    expect(splitPinNames('alarm, , normal')).toEqual(['alarm', '', 'normal']);
    expect(splitPinNames('')).toEqual([]);
    expect(splitPinNames(undefined)).toEqual([]);
  });
  it('makes one row per output from the count, the names and the notes, within min and max', () => {
    expect(outputRows({ outputs: 3, labels: 'alarm, normal', notes: ['too hot'] }, SCHEMA, KEYS)).toEqual([
      { name: 'alarm', note: 'too hot', from: 0 }, { name: 'normal', note: '', from: 1 }, { name: '', note: '', from: 2 },
    ]);
    expect(outputRows({}, SCHEMA, KEYS)).toHaveLength(1);
    expect(outputRows({ outputs: 9 }, SCHEMA, KEYS)).toHaveLength(4);
    expect(outputRows({ outputs: 0 }, SCHEMA, KEYS)).toHaveLength(1);
  });
  it('stores the rows as the count and the comma list (an empty name in the middle kept, at the end dropped)', () => {
    const rows = [{ name: 'alarm', note: '', from: 0 }, { name: '', note: 'spare', from: null }, { name: 'normal', note: '', from: 1 }, { name: '', note: '', from: null }];
    expect(paramsOfRows(rows, KEYS)).toEqual({ outputs: 4, labels: 'alarm, , normal', notes: ['', 'spare'] });
    expect(paramsOfRows([{ name: '', note: '', from: 0 }], KEYS)).toEqual({ outputs: 1, labels: undefined, notes: undefined });
    expect(paramsOfRows([{ name: 'a', note: 'x', from: 0 }], { count: 'outputs', names: 'labels' })).toEqual({ outputs: 1, labels: 'a' });
  });
  it('round-trips: the rows of stored params give the same params back', () => {
    const stored = { outputs: 3, labels: 'alarm, , normal' };
    expect(paramsOfRows(outputRows(stored, SCHEMA, KEYS), KEYS)).toEqual({ ...stored, notes: undefined });
  });
});

describe('outputNameProblems', () => {
  it('lets an empty name pass and finds names that are not usable in code, too long, taken by a port or used twice', () => {
    const rows = ['alarm', '', 'bad name', '2nd', 'a'.repeat(OUTPUT_NAME_MAX + 1), 'o3', 'Error', 'Alarm', 'ok_1-b'].map((name) => ({ name }));
    expect(outputNameProblems(rows)).toEqual(['duplicate', undefined, 'chars', 'chars', 'long', 'reserved', 'reserved', 'duplicate', undefined]);
  });
  it('checks the port ids of the block\'s own prefix', () => {
    expect(outputNameProblems([{ name: 'out1' }, { name: 'o1' }], 'out')).toEqual(['reserved', undefined]);
    expect(outputPrefix({ count: 'n', prefix: 'out' })).toBe('out');
    expect(outputPrefix({ count: 'n' })).toBe('o');
    expect(outputPrefix(['a'])).toBe('o');
  });
});

describe('outputPortMap', () => {
  it('maps the outputs that moved or went, and leaves the ones that kept their place out', () => {
    // three outputs: the third moved to the top, the first removed, one added at the end
    expect(outputPortMap([{ from: 2 }, { from: 1 }, { from: null }], 3)).toEqual({ o0: null, o2: 'o0' });
    expect(outputPortMap([{ from: 0 }, { from: 1 }], 2)).toEqual({});
    expect(outputPortMap([{ from: 1 }, { from: 0 }], 2, 'out')).toEqual({ out0: 'out1', out1: 'out0' });
  });
});

describe('outputsExample', () => {
  it('returns a name per named output and one array for several outputs', () => {
    expect(outputsExample([{ name: 'alarm' }, { name: 'normal' }], to, 'one message per output')).toBe([
      'return "alarm"; // → output 1',
      'return "normal"; // → output 2',
      '',
      '// one message per output',
      'return [alarm, normal]; // → output 1 (alarm), output 2 (normal)',
    ].join('\n'));
  });
  it('uses msg for a single unnamed output and placeholders for names that are not identifiers', () => {
    expect(outputsExample([{ name: '' }], to, 'each')).toBe('return msg; // → output 1');
    expect(outputsExample([{ name: 'high-temp' }, { name: '' }], to, 'each')).toBe([
      'return "high-temp"; // → output 1', '', '// each', 'return [msg1, msg2]; // → output 1 (high-temp), output 2',
    ].join('\n'));
  });
});
