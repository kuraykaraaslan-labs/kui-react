import type { OutputsSpec, ParamSpec } from './types';
import type { ParamValues } from './params';

/**
 * The outputs of a block whose port count is a number param with `pins` (the script block: `outputs` and `labels`), as
 * rows: one per output, its name and an optional note. The stored params stay what they were (the count and the comma
 * list of names, and the notes when the block declares `pin_notes`), so the rows are only how the editor shows them.
 */
export type OutputRow = {
  name: string;
  note: string;
  /** the index of the output this row was before an edit (null: added); the editor moves its connections with it */
  from: number | null;
};

/** the params that make up a block's configurable outputs: the count param, the names param and the optional notes param */
export type OutputParams = { count: string; names: string; notes?: string };

/** the longest name of one output */
export const OUTPUT_NAME_MAX = 32;

/** What is wrong with the name of a row: `chars` (not usable in code), `long`, `duplicate`, `reserved` (a port id of its own). */
export type OutputNameProblem = 'chars' | 'long' | 'duplicate' | 'reserved';

/** The output params of a schema: the first number param with `pins` naming a param of the schema, or null. */
export function outputParamsOf(schema: Record<string, ParamSpec>): OutputParams | null {
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.type !== 'number' || !spec.pins || !schema[spec.pins]) continue;
    return { count: key, names: spec.pins, ...(spec.pin_notes && schema[spec.pin_notes] ? { notes: spec.pin_notes } : {}) };
  }
  return null;
}

/** A comma list split by position: an empty entry stays, so an unnamed output in the middle keeps the names after it in place. */
export function splitPinNames(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map((s) => s.trim());
}

function notesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : ''));
  return [];
}

/** The rows of the stored params: as many as the count says (at least `min`, at most `max`). */
export function outputRows(values: ParamValues, schema: Record<string, ParamSpec>, keys: OutputParams): OutputRow[] {
  const spec = schema[keys.count];
  const min = Math.max(1, spec?.min ?? 1);
  const max = spec?.max ?? 16;
  const raw = parseInt(String(values[keys.count] ?? spec?.default ?? min), 10);
  const n = Math.min(Math.max(Number.isFinite(raw) ? raw : min, min), max);
  const names = splitPinNames(values[keys.names]);
  const notes = keys.notes ? notesOf(values[keys.notes]) : [];
  return Array.from({ length: n }, (_, i) => ({ name: names[i] ?? '', note: notes[i] ?? '', from: i }));
}

/**
 * The params of the rows: the count, the names joined by ", " (empty names at the end dropped, an empty one in the middle
 * kept, so names stay at their port), and the notes when the block has them (empty at the end dropped; none: unset).
 */
export function paramsOfRows(rows: OutputRow[], keys: OutputParams): ParamValues {
  const names = rows.map((r) => r.name.trim());
  while (names.length && !names[names.length - 1]) names.pop();
  const out: ParamValues = { [keys.count]: rows.length, [keys.names]: names.length ? names.join(', ') : undefined };
  if (keys.notes) {
    const notes = rows.map((r) => r.note.trim());
    while (notes.length && !notes[notes.length - 1]) notes.pop();
    out[keys.notes] = notes.length ? notes : undefined;
  }
  return out;
}

/** The port id prefix of generated outputs (`o` by default). */
export function outputPrefix(outputs: OutputsSpec | undefined): string {
  return outputs && !Array.isArray(outputs) ? outputs.prefix ?? 'o' : 'o';
}

/** what the stored names list allows of one name (the contract's pattern without its comma, the separator) */
const STORED_NAME = /^[A-Za-z0-9_ -]+$/;

/**
 * The problem of each row's name (undefined: fine; an empty name is fine, the output is then used by its number). A name
 * is used in code as a string (`return "alarm"`) and kept in a comma list: letters, digits, `_` and `-`, starting with a
 * letter or `_`, at most `OUTPUT_NAME_MAX` long, unlike the others (case does not count), and not a port id the editor
 * gives itself (`o1`, `error`). `kept` are the names the block had before the edit: one of them that the stored list
 * allows (`Too hot`, `2nd`) is not held to the first two rules, so an old flow's outputs can be changed without renaming
 * an output its code returns.
 */
export function outputNameProblems(rows: Pick<OutputRow, 'name'>[], prefix = 'o', kept: readonly string[] = []): (OutputNameProblem | undefined)[] {
  const seen = new Map<string, number>();
  for (const r of rows) { const k = r.name.trim().toLowerCase(); if (k) seen.set(k, (seen.get(k) ?? 0) + 1); }
  const reserved = new RegExp(`^(${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d+|error)$`, 'i');
  const old = new Set(kept.map((k) => k.trim()).filter((k) => STORED_NAME.test(k)));
  return rows.map((r) => {
    const name = r.name.trim();
    if (!name) return undefined;
    if (!old.has(name)) {
      if (name.length > OUTPUT_NAME_MAX) return 'long';
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return 'chars';
    }
    if (reserved.test(name)) return 'reserved';
    if ((seen.get(name.toLowerCase()) ?? 0) > 1) return 'duplicate';
    return undefined;
  });
}

/**
 * Old port id to new port id (null: removed) for rows that moved or went: what the editor applies to the block's
 * connections, so a connection stays on its output when the output moves. Ports that keep their place are left out.
 */
export function outputPortMap(rows: Pick<OutputRow, 'from'>[], before: number, prefix = 'o'): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const to = new Map<number, number>();
  rows.forEach((r, j) => { if (r.from !== null) to.set(r.from, j); });
  for (let i = 0; i < before; i++) {
    const j = to.get(i);
    if (j === undefined) map[`${prefix}${i}`] = null;
    else if (j !== i) map[`${prefix}${i}`] = `${prefix}${j}`;
  }
  return map;
}

/**
 * Lines of a code example for the rows: `return "name"` per named output, then one array return with an entry per output.
 * `to(n)` words the comment ("output 1"); `each` the comment over the array.
 */
export function outputsExample(rows: Pick<OutputRow, 'name'>[], to: (n: number, name?: string) => string, each: string): string {
  const lines: string[] = [];
  rows.forEach((r, i) => { const name = r.name.trim(); if (name && STORED_NAME.test(name)) lines.push(`return "${name}"; // → ${to(i + 1)}`); });
  if (rows.length === 1 && !lines.length) lines.push(`return msg; // → ${to(1)}`);
  if (rows.length > 1) {
    const vars = rows.map((r, i) => { const name = r.name.trim(); return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `msg${i + 1}`; });
    if (lines.length) lines.push('');
    lines.push(`// ${each}`);
    lines.push(`return [${vars.join(', ')}]; // → ${rows.map((r, i) => to(i + 1, r.name.trim() || undefined)).join(', ')}`);
  }
  return lines.join('\n');
}
