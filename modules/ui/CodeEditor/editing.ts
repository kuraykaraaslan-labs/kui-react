// modules/ui/CodeEditor/editing.ts
//
// The pure text operations of the CodeEditor (M2 and M3): indent, comment toggle, auto-indent on Enter, bracket and
// quote pairs, line / column maths, the word under a point, completion filtering and find. No DOM, no React: every
// operation takes the text and a selection and returns one edit, so the engine can apply it through the browser's own
// undo stack (`insertText`) or as a plain value change.

import type { Lang, Suggestion } from './types';

/** One change: replace `from`–`to` with `text`, then select `selStart`–`selEnd` (positions in the new text). */
export type TextEdit = { from: number; to: number; text: string; selStart: number; selEnd: number };

/** the text after an edit */
export function applyEdit(value: string, e: TextEdit): string {
  return value.slice(0, e.from) + e.text + value.slice(e.to);
}

/** the line comment of a language, or null when it has none the editor toggles */
export function commentTokenOf(language: Lang): string | null {
  switch (language) {
    case 'js': case 'ts': return '//';
    case 'python': case 'yaml': return '#';
    case 'sql': return '--';
    default: return null;
  }
}

/** start of the line holding `index`, and the end of the line holding `end` (whole lines) */
export function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  // a selection that ends at the very start of a line does not take that line
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', last);
  return { from: start === 0 ? 0 : from, to: nl === -1 ? value.length : nl };
}

/** Tab and Shift+Tab: a caret gets `unit`; a selection (or Shift+Tab) indents or outdents every line it touches. */
export function indentEdit(value: string, start: number, end: number, outdent: boolean, unit = '  '): TextEdit {
  if (start === end && !outdent) return { from: start, to: end, text: unit, selStart: start + unit.length, selEnd: start + unit.length };
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  let firstShift = 0;
  let total = 0;
  const out = lines.map((line, i) => {
    if (!outdent) { if (i === 0) firstShift = unit.length; total += unit.length; return unit + line; }
    const cut = line.startsWith(unit) ? unit.length : line.startsWith('\t') ? 1 : (/^ +/.exec(line)?.[0].length ?? 0);
    const n = Math.min(cut, unit.length);
    if (i === 0) firstShift = -n;
    total -= n;
    return line.slice(n);
  });
  const text = out.join('\n');
  const selStart = Math.max(from, start + firstShift);
  return { from, to, text, selStart, selEnd: start === end ? selStart : end + total };
}

/** Ctrl+/: comment the touched lines out with `token`, or back in when every non-empty one already is. */
export function commentEdit(value: string, start: number, end: number, token: string): TextEdit {
  const { from, to } = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const filled = lines.filter((l) => l.trim());
  const commented = filled.length > 0 && filled.every((l) => l.trimStart().startsWith(token));
  const indent = Math.min(...filled.map((l) => /^\s*/.exec(l)![0].length), Infinity);
  const out = lines.map((l) => {
    if (!l.trim()) return l;
    if (commented) {
      const at = l.indexOf(token);
      const len = token.length + (l[at + token.length] === ' ' ? 1 : 0);
      return l.slice(0, at) + l.slice(at + len);
    }
    const at = Number.isFinite(indent) ? indent : 0;
    return `${l.slice(0, at)}${token} ${l.slice(at)}`;
  });
  const text = out.join('\n');
  const delta = text.length - (to - from);
  return start === end
    ? { from, to, text, selStart: Math.max(from, start + (out[0].length - lines[0].length)), selEnd: Math.max(from, start + (out[0].length - lines[0].length)) }
    : { from, to, text, selStart: from, selEnd: to + delta };
}

const OPEN = '([{';
const CLOSE = ')]}';
const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

/** Enter: the new line keeps the indentation; after an opening bracket it goes one step in, and a closing bracket right after the caret moves to a line of its own. */
export function enterEdit(value: string, start: number, end: number, unit = '  '): TextEdit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const indent = /^[ \t]*/.exec(value.slice(lineStart, start))![0];
  const before = value[start - 1];
  const after = value[end];
  if (before && OPEN.includes(before)) {
    const inner = `\n${indent}${unit}`;
    if (after && CLOSE.indexOf(after) === OPEN.indexOf(before)) {
      const text = `${inner}\n${indent}`;
      return { from: start, to: end, text, selStart: start + inner.length, selEnd: start + inner.length };
    }
    return { from: start, to: end, text: inner, selStart: start + inner.length, selEnd: start + inner.length };
  }
  const text = `\n${indent}`;
  return { from: start, to: end, text, selStart: start + text.length, selEnd: start + text.length };
}

/**
 * A typed bracket or quote: a selection is wrapped, an opening character gets its closing one, a closing character
 * that is already next to the caret is stepped over. Null when the key should simply type (a quote inside a word).
 */
export function pairEdit(value: string, start: number, end: number, ch: string): TextEdit | null {
  const next = value[end];
  const isQuote = ch === '"' || ch === "'" || ch === '`';
  if (start === end && (CLOSE.includes(ch) || isQuote) && next === ch) return { from: start, to: start, text: '', selStart: start + 1, selEnd: start + 1 };
  const close = PAIRS[ch];
  if (!close) return null;
  if (start !== end) {
    const inner = value.slice(start, end);
    return { from: start, to: end, text: ch + inner + close, selStart: start + 1, selEnd: end + 1 };
  }
  if (isQuote) {
    const prev = value[start - 1];
    if (prev && /[\w$\\]/.test(prev)) return null;
    if (next && !/[\s)\]},;:]/.test(next)) return null;
  } else if (next && /[\w$]/.test(next)) return null;
  return { from: start, to: end, text: ch + close, selStart: start + 1, selEnd: start + 1 };
}

/** Backspace between an empty pair (`(|)`, `"|"`) removes both; null otherwise. */
export function backspaceEdit(value: string, start: number, end: number): TextEdit | null {
  if (start !== end || start === 0) return null;
  const prev = value[start - 1];
  if (PAIRS[prev] && value[start] === PAIRS[prev]) return { from: start - 1, to: start + 1, text: '', selStart: start - 1, selEnd: start - 1 };
  return null;
}

/** 1-based line and column of a position */
export function cursorAt(value: string, index: number): { line: number; column: number } {
  const upto = value.slice(0, Math.max(0, index));
  const line = upto.split('\n').length;
  return { line, column: index - (upto.lastIndexOf('\n') + 1) + 1 };
}

/** the position of a 1-based line and column, clamped to the text */
export function indexAt(value: string, line: number, column = 1): number {
  const lines = value.split('\n');
  const l = Math.min(Math.max(1, line), lines.length);
  let at = 0;
  for (let i = 0; i < l - 1; i++) at += lines[i].length + 1;
  return at + Math.min(Math.max(0, column - 1), lines[l - 1].length);
}

/** the dotted name that ends at `index` (`msg.pay` in `x = msg.pay|`): what a completion replaces */
export function prefixAt(value: string, index: number): { text: string; from: number } {
  const m = /[A-Za-z_$][\w$]*(?:\.[\w$]*)*$|$/.exec(value.slice(0, index));
  const text = m?.[0] ?? '';
  return { text, from: index - text.length };
}

/** the dotted name around `index`, for a hover (`msg.payload` with the point anywhere in it), or '' */
export function wordAt(value: string, index: number): string {
  const left = /[\w$.]*$/.exec(value.slice(0, index))![0];
  const right = /^[\w$.]*/.exec(value.slice(index))![0];
  return (left + right).replace(/^\.+|\.+$/g, '');
}

/** the suggestions that start with what was typed (case-insensitive), best first, at most `max` */
export function filterSuggestions(list: readonly Suggestion[], prefix: string, max = 50): Suggestion[] {
  const p = prefix.toLowerCase();
  const hits = list.filter((s) => s.label.toLowerCase().startsWith(p) && s.label !== prefix);
  // what continues the dotted part the user is in comes before what only shares its start
  return hits.sort((a, b) => Number(b.label.startsWith(prefix)) - Number(a.label.startsWith(prefix)) || a.label.length - b.label.length).slice(0, max);
}

/** the edit a picked suggestion makes: it replaces the typed prefix */
export function suggestionEdit(value: string, index: number, s: Suggestion): TextEdit {
  const { from } = prefixAt(value, index);
  const text = s.insertText ?? s.label;
  return { from, to: index, text, selStart: from + text.length, selEnd: from + text.length };
}

/** every match of `query` as start–end pairs (no regular expressions: the text is what is searched for) */
export function findMatches(value: string, query: string, caseSensitive = false): [number, number][] {
  if (!query) return [];
  const hay = caseSensitive ? value : value.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: [number, number][] = [];
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) out.push([at, at + needle.length]);
  return out;
}

/** the text with every match replaced */
export function replaceAllText(value: string, query: string, replacement: string, caseSensitive = false): { value: string; count: number } {
  const hits = findMatches(value, query, caseSensitive);
  let out = '';
  let last = 0;
  for (const [a, b] of hits) { out += value.slice(last, a) + replacement; last = b; }
  return { value: out + value.slice(last), count: hits.length };
}
