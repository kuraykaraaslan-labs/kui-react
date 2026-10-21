// The rules' own checks for the problems list (pure, no React): a rule that names nothing, reads a parameter the board
// does not have, can never match, repeats another one, is overridden by the next one or can never run. They plug into
// `problems()` through its `extra` hook; ids are `rule:<index>` (the index in the stored list, counted from 0).

import type { SlotData } from '../kind';
import type { EditorHost } from './scene-editor-types';
import type { Problem, ProblemCheck } from './scene-edit-problems';
import { isRec, targetNames } from './scene-edit-core';
import { rulesOf } from './scene-rules-edit';
import type { SceneSettings } from './scada-scene-logic';

type Rec = Record<string, unknown>;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const yes = (v: unknown): string => (v === true || v === 'true' ? 'true' : v === false || v === 'false' ? 'false' : '');

/** The columns a rule can read: what the host declares, else the table's declared columns, else the keys its rows have. */
function knownColumns(host: Pick<EditorHost, 'columns'>, points: SlotData | undefined): Set<string> | null {
  if (host.columns?.length) return new Set(host.columns.map((c) => c.key));
  if (points?.columns?.length) return new Set(points.columns.map((c) => c.key));
  const rows = points?.rows ?? [];
  if (!rows.length) return null;
  return new Set(rows.flatMap((r) => Object.keys(r)));
}

/** What makes two rules apply together: the target and every part of the condition. */
const conditionOf = (r: Rec): string => JSON.stringify([
  text(r.source) || 'column', text(r.key), text(r.of), text(r.op), text(r.value), text(r.to),
  text(r.op2) ? [text(r.join) || 'all', text(r.source2) || 'column', text(r.key2), text(r.of2), text(r.op2), text(r.value2), text(r.to2)] : null,
]);

const EFFECTS: Array<[string, (r: Rec) => string]> = [
  ['state', (r) => text(r.state)], ['colour', (r) => text(r.color)], ['liquid colour', (r) => text(r.fillColor)], ['passive look', (r) => yes(r.dim)],
  ['blink', (r) => yes(r.blink)], ['hidden state', (r) => yes(r.hidden)], ['name', (r) => text(r.label)], ['medium', (r) => text(r.medium)],
  ['motion', (r) => yes(r.animate)],
];

/** The checks of a scene's rules, given what the host knows about the board (its parameters and the table's columns). */
export function ruleProblems(host: Pick<EditorHost, 'params' | 'columns'> = {}): ProblemCheck {
  return (s: SceneSettings, data: Record<string, SlotData | undefined>): Problem[] => {
    const out: Problem[] = [];
    const names = targetNames(s);
    const params = host.params ? new Set(host.params.map((p) => p.key)) : null;
    const columns = knownColumns(host, data.points);
    const list = rulesOf(s);
    const add = (severity: Problem['severity'], code: string, i: number, message: string) => out.push({ severity, code, id: `rule:${i}`, message });
    const live: Array<{ i: number; r: Rec }> = [];

    list.forEach((raw, i) => {
      if (!isRec(raw)) return;
      const r = raw;
      const n = i + 1;
      const target = text(r.target);
      if (!target) add('error', 'rule-target-missing', i, `Rule ${n} has no target`);
      else if (target !== '*' && !names.has(target)) add('error', 'rule-target-missing', i, `Rule ${n} targets ${target}, which is not in the diagram`);
      for (const key of ['of', 'of2'] as const) {
        const id = text(r[key]);
        if (id && !names.has(id)) add('error', 'rule-of-missing', i, `Rule ${n} reads the row of ${id}, which is not in the diagram`);
      }
      if (r.enabled === false) return;
      live.push({ i, r });

      for (const c of [{ op: r.op, source: r.source, key: r.key }, { op: r.op2, source: r.source2, key: r.key2 }]) {
        const op = text(c.op); const key = text(c.key);
        if (!op || !key) continue;
        if (c.source === 'param') {
          if (params && !params.has(key)) add('warning', 'rule-param-unknown', i, `Rule ${n} reads the parameter ${key}, which the board does not have`);
        } else if (columns && op !== 'unset' && !columns.has(key)) {
          add('warning', 'rule-column-missing', i, `Rule ${n} reads the column ${key}, which the table does not have, so that condition can never hold`);
        }
      }
    });

    // Rules that apply together (same target, same condition): a repeat, or a later one that overrides an earlier effect.
    const seen = new Map<string, number>();
    for (const { i, r } of live) {
      const key = `${text(r.target)}|${conditionOf(r)}`;
      const first = seen.get(key);
      if (first === undefined) { seen.set(key, i); continue; }
      const earlier = list[first] as Rec;
      const same = EFFECTS.every(([, read]) => read(earlier) === read(r)) && !!r.stop === !!earlier.stop;
      if (same) { add('warning', 'rule-duplicate', i, `Rule ${i + 1} repeats the target, condition and effects of rule ${first + 1}`); continue; }
      for (const [name, read] of EFFECTS) {
        const a = read(earlier); const b = read(r);
        if (a && b && a !== b) add('warning', 'rule-contradiction', i, `Rule ${i + 1} overrides the ${name} that rule ${first + 1} sets whenever both apply, so rule ${first + 1} never shows it`);
      }
    }

    // An unconditional rule that stops: nothing after it for the same target ever runs.
    for (const { i, r } of live) {
      if (r.stop !== true || text(r.op)) continue;
      const target = text(r.target);
      if (!target) continue;
      for (const later of live) {
        if (later.i <= i) continue;
        const t = text(later.r.target);
        if (target === '*' ? true : t === target) {
          add('warning', 'rule-unreachable', later.i, `Rule ${later.i + 1} never applies: rule ${i + 1} always stops ${target === '*' ? 'every target' : target} first`);
        }
      }
    }
    return out;
  };
}

/** What a problem is about in the editor's terms: the id to select, and for a rule problem the rule's index. */
export function problemTarget(p: Pick<Problem, 'id'>, s: SceneSettings): { select: string; rule?: number } {
  const hit = /^rule:(\d+)$/.exec(p.id);
  if (!hit) return { select: p.id };
  const rule = Number(hit[1]);
  const r = rulesOf(s)[rule];
  const target = isRec(r) ? text(r.target) : '';
  if (target && Array.isArray(s.elements) && (s.elements as unknown[]).some((e) => isRec(e) && e.id === target)) return { select: target, rule };
  if (target && Array.isArray(s.links)) {
    const at = (s.links as unknown[]).findIndex((l) => isRec(l) && l.id === target);
    if (at >= 0) return { select: `link:${at}`, rule };
  }
  return { select: 'scene', rule };
}
