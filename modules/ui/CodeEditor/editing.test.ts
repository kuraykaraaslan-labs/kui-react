import { describe, expect, it } from 'vitest';
import {
  applyEdit, backspaceEdit, commentEdit, commentTokenOf, cursorAt, enterEdit, filterSuggestions, findMatches, indentEdit, indexAt, pairEdit,
  prefixAt, replaceAllText, suggestionEdit, wordAt,
} from './editing';

const run = (value: string, e: ReturnType<typeof indentEdit>) => ({ value: applyEdit(value, e), sel: [e.selStart, e.selEnd] });

describe('indent and outdent', () => {
  it('puts two spaces at a caret', () => {
    expect(run('ab', indentEdit('ab', 1, 1, false))).toEqual({ value: 'a  b', sel: [3, 3] });
  });
  it('indents and outdents every line of a selection', () => {
    const v = 'a\nb\nc';
    const e = indentEdit(v, 0, 3, false);
    expect(run(v, e)).toEqual({ value: '  a\n  b\nc', sel: [2, 7] });
    const back = indentEdit('  a\n  b\nc', 2, 7, true);
    expect(applyEdit('  a\n  b\nc', back)).toBe('a\nb\nc');
  });
  it('outdents the line of a caret with Shift+Tab', () => {
    expect(run('    x', indentEdit('    x', 4, 4, true))).toEqual({ value: '  x', sel: [2, 2] });
  });
});

describe('comment toggle', () => {
  it('knows the line comment of each language', () => {
    expect(commentTokenOf('js')).toBe('//');
    expect(commentTokenOf('python')).toBe('#');
    expect(commentTokenOf('sql')).toBe('--');
    expect(commentTokenOf('json')).toBeNull();
  });
  it('comments the touched lines out at their common indent, and back in', () => {
    const v = '  a\n    b\n\n  c';
    const out = applyEdit(v, commentEdit(v, 0, v.length, '//'));
    expect(out).toBe('  // a\n  //   b\n\n  // c');
    expect(applyEdit(out, commentEdit(out, 0, out.length, '//'))).toBe(v);
  });
  it('toggles the line of a caret', () => {
    expect(applyEdit('x = 1', commentEdit('x = 1', 2, 2, '//'))).toBe('// x = 1');
  });
});

describe('Enter, pairs and Backspace', () => {
  it('keeps the indentation and steps in after an opening bracket', () => {
    expect(run('  a', enterEdit('  a', 3, 3))).toEqual({ value: '  a\n  ', sel: [6, 6] });
    expect(run('if {}', enterEdit('if {}', 4, 4))).toEqual({ value: 'if {\n  \n}', sel: [7, 7] });
  });
  it('closes brackets and quotes, wraps a selection and steps over a closing one', () => {
    expect(applyEdit('f', pairEdit('f', 1, 1, '(')!)).toBe('f()');
    expect(applyEdit('ab', pairEdit('ab', 0, 2, '[')!)).toBe('[ab]');
    expect(pairEdit('()', 1, 1, ')')).toEqual({ from: 1, to: 1, text: '', selStart: 2, selEnd: 2 });
    expect(applyEdit('x = ', pairEdit('x = ', 4, 4, '"')!)).toBe('x = ""');
  });
  it('types a quote inside a word and a bracket before a word as it is', () => {
    expect(pairEdit("don", 3, 3, "'")).toBeNull();
    expect(pairEdit('ab', 0, 0, '(')).toBeNull();
    expect(pairEdit('a', 1, 1, 'x')).toBeNull();
  });
  it('removes an empty pair on Backspace', () => {
    expect(applyEdit('()', backspaceEdit('()', 1, 1)!)).toBe('');
    expect(backspaceEdit('(a)', 2, 2)).toBeNull();
  });
});

describe('positions, words and completion', () => {
  it('converts between positions and line / column', () => {
    const v = 'ab\ncde\nf';
    expect(cursorAt(v, 4)).toEqual({ line: 2, column: 2 });
    expect(indexAt(v, 2, 2)).toBe(4);
    expect(indexAt(v, 9, 9)).toBe(v.length);
  });
  it('finds the dotted name before the caret and around a point', () => {
    expect(prefixAt('x = msg.pay', 11)).toEqual({ text: 'msg.pay', from: 4 });
    expect(prefixAt('x = ', 4)).toEqual({ text: '', from: 4 });
    expect(wordAt('return msg.payload;', 9)).toBe('msg.payload');
  });
  it('filters suggestions by the typed start and replaces the prefix', () => {
    const list = [{ label: 'msg.payload' }, { label: 'msg.metadata' }, { label: 'node.send', insertText: 'node.send(msg)' }];
    expect(filterSuggestions(list, 'msg.').map((s) => s.label)).toEqual(['msg.payload', 'msg.metadata']);
    expect(filterSuggestions(list, 'MSG.P').map((s) => s.label)).toEqual(['msg.payload']);
    expect(applyEdit('no', suggestionEdit('no', 2, list[2]))).toBe('node.send(msg)');
  });
});

describe('find and replace', () => {
  it('finds plain text, with or without case', () => {
    expect(findMatches('aXa xa', 'xa')).toEqual([[1, 3], [4, 6]]);
    expect(findMatches('aXa xa', 'xa', true)).toEqual([[4, 6]]);
    expect(findMatches('a', '')).toEqual([]);
  });
  it('replaces every match', () => {
    expect(replaceAllText('a.b.c', '.', '/')).toEqual({ value: 'a/b/c', count: 2 });
  });
});
