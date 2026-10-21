import { describe, it, expect } from 'vitest';
import { compare, evaluateRules, expandLabel, MAX_SCENE_RULES, validateRules, type SceneRule } from '../views/scene-rules-logic';
import { sceneModel, type SceneSettings } from '../views/scada-scene-logic';
import { svgToString } from '../views/svg-node';
import { SCADA_SCENE } from '../templates/scada-scene';
import { migrate, validate } from '../settings/engine';
import { SECTOR_SCENES } from '../sample/scada-sector-all';

type Row = Record<string, unknown>;
const rowsOf = (rows: Row[]) => new Map(rows.map((r) => [String(r.id), r]));
const ctxOf = (rows: Row[], params: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ rows: rowsOf(rows), params, ...extra });
const fxOf = (rules: SceneRule[], rows: Row[], params: Record<string, unknown> = {}) => evaluateRules(rules, ctxOf(rows, params));

describe('rule operators', () => {
  const cases: Array<[string, unknown, unknown, unknown, boolean]> = [
    ['eq', 5, '5', undefined, true], ['eq', '5.0', 5, undefined, true], ['eq', 'Running', 'running', undefined, true], ['eq', 'a', 'b', undefined, false],
    ['eq', true, 'true', undefined, true], ['eq', true, 'off', undefined, false], ['eq', false, 'no', undefined, true], ['eq', true, 'maybe', undefined, false],
    ['ne', 5, '6', undefined, true], ['ne', 'On', 'on', undefined, false], ['ne', true, 'false', undefined, true],
    ['gt', 5, '4', undefined, true], ['gt', 5, '5', undefined, false], ['gt', '7', 5, undefined, true], ['gt', 'abc', '1', undefined, false], ['gt', 5, 'x', undefined, false],
    ['gte', 5, '5', undefined, true], ['gte', 4.9, 5, undefined, false],
    ['lt', 3, '4', undefined, true], ['lt', 4, '4', undefined, false], ['lte', 4, '4', undefined, true], ['lte', 4.1, '4', undefined, false],
    ['between', 5, '1', '10', true], ['between', 1, '1', '10', true], ['between', 10, '1', '10', true], ['between', 11, '1', '10', false],
    ['between', 5, '10', '1', true], ['between', 5, '1', '', false], ['between', 'x', '1', '10', false],
    ['in', 'b', 'a, b ,c', undefined, true], ['in', 'B', 'a,b', undefined, true], ['in', 2, '1,2,3', undefined, true], ['in', 'z', 'a,b', undefined, false], ['in', 'a', '', undefined, false],
    ['set', 0, undefined, undefined, true], ['set', false, undefined, undefined, true], ['set', '', undefined, undefined, false], ['set', null, undefined, undefined, false], ['set', undefined, undefined, undefined, false],
    ['unset', undefined, undefined, undefined, true], ['unset', null, undefined, undefined, true], ['unset', '', undefined, undefined, true], ['unset', 0, undefined, undefined, false],
    ['true', true, undefined, undefined, true], ['true', 'on', undefined, undefined, true], ['true', 1, undefined, undefined, true], ['true', 'stopped', undefined, undefined, false], ['true', 0, undefined, undefined, false],
    ['false', false, undefined, undefined, true], ['false', 'off', undefined, undefined, true], ['false', 'running', undefined, undefined, false], ['false', true, undefined, undefined, false],
    ['nope', 1, 1, undefined, false],
  ];
  it.each(cases)('%s of %j against %j %j is %s', (op, actual, value, to, expected) => {
    expect(compare(op, actual, value, to)).toBe(expected);
  });
  it('a missing value never matches, except "not set"', () => {
    for (const op of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'set', 'true', 'false']) expect(compare(op, undefined, '1', '2'), op).toBe(false);
    expect(compare('unset', undefined, undefined)).toBe(true);
  });
});

describe('evaluateRules', () => {
  const rows = [{ id: 'p', value: 90, status: 'ok', running: true }, { id: 'q', value: 10 }, { id: 'r' }];

  it('applies a rule to the target\'s own row by default', () => {
    const fx = fxOf([{ target: 'p', key: 'value', op: 'gt', value: '80', state: 'warning' }], rows);
    expect(fx.get('p')).toEqual({ state: 'warning' });
    expect(fx.has('q')).toBe(false);
  });
  it('reads another row through `of`, and a board parameter through source param', () => {
    expect(fxOf([{ target: 'q', of: 'p', key: 'value', op: 'gt', value: '80', dim: 'true' }], rows).get('q')).toEqual({ dim: true });
    expect(fxOf([{ target: 'q', source: 'param', key: 'mode', op: 'eq', value: 'off', state: 'off' }], rows, { mode: 'OFF' }).get('q')).toEqual({ state: 'off' });
    expect(fxOf([{ target: 'q', source: 'param', key: 'mode', op: 'eq', value: 'off', state: 'off' }], rows, { mode: 'auto' }).has('q')).toBe(false);
    // a parameter of the same name as a column is not confused with it, and a missing one never matches
    expect(fxOf([{ target: 'p', source: 'param', key: 'value', op: 'gt', value: '1', dim: 'true' }], rows, {}).has('p')).toBe(false);
  });
  it('a column that is not in the row, or a row that does not exist, does not match', () => {
    expect(fxOf([{ target: 'r', key: 'value', op: 'gt', value: '0', dim: 'true' }], rows).has('r')).toBe(false);
    expect(fxOf([{ target: 'r', of: 'nobody', key: 'value', op: 'set', dim: 'true' }], rows).has('r')).toBe(false);
    expect(fxOf([{ target: 'r', key: 'value', op: 'unset', dim: 'true' }], rows).get('r')).toEqual({ dim: true });
  });
  it('does not read inherited object properties', () => {
    expect(fxOf([{ target: 'p', key: 'constructor', op: 'set', dim: 'true' }], rows).has('p')).toBe(false);
    expect(fxOf([{ target: 'p', source: 'param', key: 'toString', op: 'set', dim: 'true' }], rows).has('p')).toBe(false);
  });
  it('joins two conditions with all (default) or any', () => {
    const base = { target: 'p', key: 'value', op: 'gt', value: '80', key2: 'status', op2: 'eq', value2: 'bad', state: 'critical' } as const;
    expect(fxOf([{ ...base }], rows).has('p')).toBe(false);
    expect(fxOf([{ ...base, join: 'all' }], rows).has('p')).toBe(false);
    expect(fxOf([{ ...base, join: 'any' }], rows).get('p')).toEqual({ state: 'critical' });
    expect(fxOf([{ ...base, value2: 'ok' }], rows).get('p')).toEqual({ state: 'critical' });
    // the second condition can read a parameter and another row
    expect(fxOf([{ target: 'q', key: 'value', op: 'lt', value: '20', source2: 'param', key2: 'mode', op2: 'eq', value2: 'night', hidden: 'true' }], rows, { mode: 'night' }).get('q')).toEqual({ hidden: true });
    expect(fxOf([{ target: 'q', key: 'value', op: 'lt', value: '20', of2: 'p', key2: 'running', op2: 'true', hidden: 'true' }], rows).get('q')).toEqual({ hidden: true });
  });
  it('a rule with no operator always applies; a second operator alone is the rule\'s only condition when the first is empty', () => {
    expect(fxOf([{ target: 'q', dim: 'true' }], rows).get('q')).toEqual({ dim: true });
  });
  it('runs top to bottom: a later rule overrides the same effect, other effects stay', () => {
    const fx = fxOf([
      { target: 'p', state: 'warning', color: '#111111', blink: 'true' },
      { target: 'p', state: 'critical', blink: 'false' },
    ], rows);
    expect(fx.get('p')).toEqual({ state: 'critical', color: '#111111', blink: false });
  });
  it('stop ends the evaluation for that target only when the rule matched', () => {
    const rules: SceneRule[] = [
      { target: '*', key: 'value', op: 'gt', value: '50', state: 'warning', stop: true },
      { target: '*', color: '#222222' },
    ];
    const fx = fxOf(rules, rows);
    expect(fx.get('p')).toEqual({ state: 'warning' });
    expect(fx.get('q')).toEqual({ color: '#222222' });
    expect(fx.get('r')).toEqual({ color: '#222222' });
  });
  it('a disabled rule does nothing, and neither does one for an unknown target', () => {
    expect(fxOf([{ target: 'p', enabled: false, dim: 'true' }], rows).size).toBe(0);
    expect(fxOf([{ target: 'ghost', dim: 'true' }, { dim: 'true' }, { target: '', dim: 'true' }], rows).size).toBe(0);
    // a disabled stop does not stop
    expect(fxOf([{ target: 'p', enabled: false, stop: true }, { target: 'p', dim: 'true' }], rows).get('p')).toEqual({ dim: true });
  });
  it('`*` reaches the given targets (symbols and connections), or the rows when none are given', () => {
    const withTargets = evaluateRules([{ target: '*', dim: 'true' }], ctxOf(rows, {}, { targets: ['p', 'pipe1'] }));
    expect([...withTargets.keys()].sort()).toEqual(['p', 'pipe1']);
    expect([...fxOf([{ target: '*', dim: 'true' }], rows).keys()].sort()).toEqual(['p', 'q', 'r']);
  });
  it('takes booleans as booleans or words, ignores what is not an effect', () => {
    const fx = fxOf([{ target: 'p', dim: true, blink: 'yes', hidden: 'maybe', animate: 'false', state: 'exploding', color: 'url(#x)', fillColor: 'javascript:1', medium: '' }], rows);
    expect(fx.get('p')).toEqual({ dim: true, blink: true, animate: false });
  });
  it('keeps the colour effects that are colours', () => {
    expect(fxOf([{ target: 'p', color: 'var(--warning)', fillColor: '#abc' }], rows).get('p')).toEqual({ color: 'var(--warning)', fillColor: '#abc' });
  });
  it('medium: a named one, or none', () => {
    expect(fxOf([{ target: 'p', medium: 'hot' }], rows).get('p')).toEqual({ medium: 'hot' });
    expect(fxOf([{ target: 'p', medium: 'none' }], rows).get('p')).toEqual({ medium: 'none' });
  });
  it('looks at no more than the rule cap', () => {
    const many: SceneRule[] = Array.from({ length: MAX_SCENE_RULES + 5 }, (_, i) => ({ target: 'p', label: `rule ${i}` }));
    expect(fxOf(many, rows).get('p')?.label).toBe(`rule ${MAX_SCENE_RULES - 1}`);
  });
  it('ignores a rules value that is not a list', () => {
    expect(evaluateRules(undefined, ctxOf(rows)).size).toBe(0);
    expect(evaluateRules({ target: 'p' }, ctxOf(rows)).size).toBe(0);
  });
});

describe('label tokens', () => {
  const ctx = ctxOf([{ id: 'p', value: 12.345, value2: 'n/a', label: 'Pump A' }], { site: 'North' });
  it('fills value, value2, label, id and param tokens', () => {
    expect(expandLabel('{id}: {value} / {value2} / {label} / {param:site}', 'p', ctx)).toBe('p: 12.35 / n/a / Pump A / North');
  });
  it('uses the host\'s number words for numbers', () => {
    expect(expandLabel('{value}', 'p', { ...ctx, format: (id, n) => `${id}=${n.toFixed(1)} bar` })).toBe('p=12.3 bar');
  });
  it('a missing value or parameter shows a dash; an unknown token stays as written', () => {
    expect(expandLabel('{value}|{param:none}|{nope}', 'x', ctx)).toBe('—|—|{nope}');
  });
  it('drops control characters and caps the length', () => {
    expect(expandLabel('a\nb\u0007c', 'p', ctx)).toBe('a b c');
    expect(expandLabel('x'.repeat(500), 'p', ctx)).toHaveLength(80);
    const long = expandLabel('{param:big}', 'p', ctxOf([], { big: 'y'.repeat(500) }));
    expect(long).toHaveLength(80);
  });
  it('markup in a label is only text', () => {
    const fx = evaluateRules([{ target: 'p', label: '<b>{label}</b>' }], ctx);
    expect(fx.get('p')?.label).toBe('<b>Pump A</b>');
  });
  it('the label effect carries the winning rule, filled in for each target', () => {
    const fx = evaluateRules([{ target: '*', label: 'first {id}' }, { target: 'p', label: 'second {id}' }], ctxOf([{ id: 'p' }, { id: 'q' }]));
    expect(fx.get('p')?.label).toBe('second p');
    expect(fx.get('q')?.label).toBe('first q');
  });
});

describe('validateRules', () => {
  const ids = { elementIds: ['p', 'q'], linkIds: ['pipe1'] };
  const msgs = (rules: unknown) => validateRules(rules, ids).map((i) => `${i.path}`);
  it('accepts a good list', () => {
    expect(validateRules([
      { target: 'p', key: 'value', op: 'between', value: '1', to: '5', state: 'warning' },
      { target: 'pipe1', op: 'in', key: 'status', value: 'a,b', join: 'any', op2: 'set', key2: 'x', of2: 'q' },
      { target: '*', dim: 'true' },
    ], ids)).toEqual([]);
  });
  it('names an unknown or missing target, and an unknown of / of2', () => {
    expect(msgs([{ target: 'ghost' }, { dim: 'true' }, { target: 'p', of: 'ghost', key: 'v', op: 'set' }, { target: 'p', op: 'set', key: 'v', op2: 'set', key2: 'v', of2: 'ghost' }]))
      .toEqual(['rules.0.target', 'rules.1.target', 'rules.2.of', 'rules.3.of2']);
  });
  it('checks operators and the values that go with them', () => {
    expect(msgs([{ target: 'p', op: 'bigger', key: 'v' }])).toEqual(['rules.0.op']);
    expect(msgs([{ target: 'p', op: 'gt', key: 'v', value: 'abc' }])).toEqual(['rules.0.value']);
    expect(msgs([{ target: 'p', op: 'gt', key: 'v' }])).toEqual(['rules.0.value']);
    expect(msgs([{ target: 'p', op: 'eq', key: 'v' }])).toEqual(['rules.0.value']);
    expect(msgs([{ target: 'p', op: 'between', key: 'v', value: '1' }])).toEqual(['rules.0.to']);
    expect(msgs([{ target: 'p', op: 'in', key: 'v', value: ' , ' }])).toEqual(['rules.0.value']);
    expect(msgs([{ target: 'p', op: 'set' }])).toEqual(['rules.0.key']);
    expect(msgs([{ target: 'p', source: 'param', op: 'set' }])).toEqual(['rules.0.key']);
    expect(msgs([{ target: 'p', source: 'psychic', op: 'set', key: 'v' }])).toEqual(['rules.0.source']);
  });
  it('checks the second condition and the join', () => {
    expect(msgs([{ target: 'p', op: 'set', key: 'v', op2: 'lt', key2: 'w' }])).toEqual(['rules.0.value2']);
    expect(msgs([{ target: 'p', op: 'set', key: 'v', op2: 'set', key2: 'w', join: 'xor' }])).toEqual(['rules.0.join']);
    expect(msgs([{ target: 'p', op2: 'set', key2: 'w' }])).toEqual(['rules.0.op']);
    // an unused second condition is not checked
    expect(msgs([{ target: 'p', op: 'set', key: 'v', value2: 'junk', join: 'xor' }])).toEqual([]);
  });
  it('checks the state and the label length, and caps the list', () => {
    expect(msgs([{ target: 'p', state: 'dead' }])).toEqual(['rules.0.state']);
    expect(msgs([{ target: 'p', label: 'x'.repeat(81) }])).toEqual(['rules.0.label']);
    expect(msgs(Array.from({ length: MAX_SCENE_RULES + 1 }, () => ({ target: 'p' })))).toEqual(['rules']);
  });
});

describe('the template', () => {
  const base = { elements: [{ id: 'p', symbol: 'pump.volute' }, { id: 'q', symbol: 'tank.vertical' }], links: [{ from: 'p.r', to: 'q.l', id: 'pipe1' }] };
  const issues = (extra: Record<string, unknown>) => validate(SCADA_SCENE, { ...base, ...extra }).issues.map((i) => i.path);

  it('is version 4 and the steps from 2 and 3 only note what is new', () => {
    expect(SCADA_SCENE.version).toBe(4);
    const stored = { ...base, calm: true };
    const res = migrate(SCADA_SCENE, stored, 2);
    expect(res.values).toEqual(stored);
    expect(res.applied.map((a) => [a.from, a.to])).toEqual([[2, 3], [3, 4]]);
    expect(res.applied[0].note).toBe('Rules and per-symbol colours, unit and decimals (all new).');
    expect(migrate(SCADA_SCENE, stored, 3).values).toEqual(stored);
    expect(migrate(SCADA_SCENE, stored, 1).applied.map((a) => a.to)).toEqual([2, 3, 4]);
  });
  it('accepts a rule row with the state effects and refuses a bad one', () => {
    expect(issues({ rules: [{ target: 'pipe1', mode: 'manual', quality: 'stale', speed: 50, reverse: 'true', ack: 'false', position: 40, pending: 'true', failed: 'false' }] })).toEqual([]);
    expect(issues({ rules: [{ target: 'pipe1', mode: 'nope', speed: 'fast' }] })).toEqual(['rules.0.mode', 'rules.0.speed']);
  });
  it('accepts a good rule and a rule row of every field', () => {
    expect(issues({ rules: [{ target: 'pipe1', key: 'value', op: 'gt', value: '3', state: 'warning', stop: true, enabled: true, dim: 'false', animate: 'false', medium: 'hot', label: '{value}' }] })).toEqual([]);
  });
  it('reports a rule on a symbol that does not exist, and a value that does not fit', () => {
    expect(issues({ rules: [{ target: 'ghost' }, { target: 'p', op: 'gt', key: 'v', value: 'x' }] })).toEqual(['rules.0.target', 'rules.1.value']);
  });
  it('reports a bad colour and a bad choice in a rule row', () => {
    const paths = issues({ rules: [{ target: 'p', color: 'not-a-colour', state: 'dead' }] });
    expect(paths).toContain('rules.0.color');
    expect(paths).toContain('rules.0.state');
  });
  it('takes the per-symbol colours, unit and decimals, and refuses a bad one', () => {
    const ok = [{ id: 'p', symbol: 'pump.volute', fillColor: '#123456', idleColor: 'var(--info)', runningColor: '#0f0', warningColor: '#ff0', criticalColor: '#f00', unit: 'bar', decimals: 2 }];
    expect(validate(SCADA_SCENE, { elements: ok }).issues).toEqual([]);
    expect(validate(SCADA_SCENE, { elements: [{ id: 'p', symbol: 'pump.volute', decimals: 9, warningColor: 'nope' }] }).issues.map((i) => i.path).sort())
      .toEqual(['elements.0.decimals', 'elements.0.warningColor']);
  });
  it('the sample scenes with rules pass the template\'s own validation', () => {
    const withRules = SECTOR_SCENES.filter((s) => Array.isArray(s.settings.rules));
    expect(withRules.length).toBeGreaterThanOrEqual(3);
    for (const s of withRules) expect(validate(SCADA_SCENE, s.settings).issues, s.title).toEqual([]);
  });
});

// ── In the model ─────────────────────────────────────────────────────────────

const scene = (over: Partial<SceneSettings> = {}): SceneSettings => ({
  fit: 'canvas', width: 800, height: 400, scale: 0.6,
  elements: [
    { id: 'pump', symbol: 'pump.volute', x: 100, y: 100, label: 'Pump' },
    { id: 'tank', symbol: 'tank.vertical', x: 400, y: 100, label: 'Tank', max: 100 },
    { id: 'lt', symbol: 'isa.level', x: 600, y: 100 },
  ],
  links: [{ from: 'pump.r', to: 'tank.l', kind: 'pipe', id: 'feed' }, { from: 'tank.r', to: 'lt.l', kind: 'wire' }],
  ...over,
});
const ROWS: Row[] = [{ id: 'pump', running: true }, { id: 'tank', value: 55 }, { id: 'lt', value: 55.678 }, { id: 'feed', running: true }];
const draw = (s: SceneSettings, rows: Row[] = ROWS, o: Parameters<typeof sceneModel>[2] = {}) => sceneModel(s, { points: { shape: 'table', rows } }, o);
const markup = (s: SceneSettings, rows: Row[] = ROWS, o: Parameters<typeof sceneModel>[2] = {}) => draw(s, rows, o).nodes.map(svgToString).join('');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const plain = markup(scene());

describe('rules in the scene model', () => {
  it('a scene without rules draws exactly as before', () => {
    expect(markup(scene({ rules: [] }))).toBe(plain);
    expect(markup(scene({ rules: 'nonsense' }))).toBe(plain);
    expect(markup(scene({ rules: [{ target: 'pump', key: 'value', op: 'gt', value: '1', state: 'critical' }] }))).toBe(plain); // no value: no match
  });
  it('state forces what the symbol reads: critical and warning take their colours', () => {
    const m = markup(scene({ warningColor: '#aa5500', criticalColor: '#cc0011', rules: [{ target: 'pump', state: 'critical' }] }));
    expect(m).toContain('#cc0011');
    const w = markup(scene({ warningColor: '#aa5500', criticalColor: '#cc0011', rules: [{ target: 'pump', state: 'warning' }] }));
    expect(w).toContain('#aa5500');
    expect(w).not.toContain('#cc0011');
  });
  it('state running and idle override the table; the rows are not touched', () => {
    const run = markup(scene({ runningColor: '#00aa33', rules: [{ target: 'pump', state: 'running' }] }), [{ id: 'pump', running: false }]);
    expect(run).toContain('#00aa33');
    const idle = markup(scene({ runningColor: '#00aa33', rules: [{ target: 'pump', state: 'idle' }] }), [{ id: 'pump', running: true, status: 'critical' }]);
    expect(idle).not.toContain('#00aa33');
    expect(idle).not.toContain('var(--error)');
  });
  it('off is passive: dimmed, not running, and nothing flows', () => {
    const base = scene({ elements: [{ id: 'pump', symbol: 'pump.volute', x: 100, y: 100, medium: 'hot' }] });
    const on = markup(base, [{ id: 'pump', running: true }]);
    const off = markup({ ...base, rules: [{ target: 'pump', state: 'off' }] }, [{ id: 'pump', running: true }]);
    expect(count(off, 'opacity="0.4"')).toBe(count(on, 'opacity="0.4"') + 1);
    expect(off).not.toContain('<animate');
    expect(off).not.toContain('var(--error)'); // the hot medium colour is gone
    expect(on).toContain('var(--error)');
  });
  it('off with an explicit "not passive" keeps the full look', () => {
    const m = markup(scene({ rules: [{ target: 'pump', state: 'off' }, { target: 'pump', dim: 'false' }] }));
    expect(count(m, 'opacity="0.4"')).toBe(count(plain, 'opacity="0.4"'));
  });
  it('colour also colours an idle symbol, and the symbol stays still', () => {
    const idle = [{ id: 'pump', running: false }];
    const s = scene({ elements: [{ id: 'pump', symbol: 'isa.level', x: 100, y: 100 }], links: [], rules: [{ target: 'pump', color: '#ff00aa' }] });
    expect(markup(s, idle)).toContain('#ff00aa');
    expect(markup(s, idle)).not.toContain('<animate');
  });
  it('colour replaces the state colour; fillColor the liquid', () => {
    const c = markup(scene({ rules: [{ target: 'pump', color: '#ff00aa' }] }));
    expect(c).toContain('#ff00aa');
    expect(plain).not.toContain('#ff00aa');
    const f = markup(scene({ rules: [{ target: 'tank', fillColor: '#00ccee' }] }));
    expect(f).toContain('#00ccee');
    // in an alarm the accent also paints the liquid
    const a = markup(scene({ rules: [{ target: 'tank', state: 'warning', color: '#ff00aa' }] }));
    expect(a).toContain('#ff00aa');
  });
  it('dim wraps the symbol, and only the symbol, in a group with reduced opacity (a theme-safe attribute)', () => {
    const m = markup(scene({ rules: [{ target: 'tank', dim: 'true' }] }));
    expect(count(m, 'opacity="0.4"')).toBe(count(plain, 'opacity="0.4"') + 1);
  });
  it('blink animates opacity only, and only where motion is allowed', () => {
    const s = scene({ rules: [{ target: 'tank', blink: 'true' }] });
    const blink = (m: string) => count(m, 'attributeName="opacity"');
    expect(blink(markup(s))).toBe(blink(plain) + 1);
    expect(blink(markup(s, ROWS, { animate: false }))).toBe(0);
    expect(blink(markup({ ...s, animation: false }))).toBe(0);
    expect(blink(markup({ ...s, rules: [{ target: 'tank', blink: 'true' }, { target: 'tank', animate: 'false' }] }))).toBe(0);
  });
  it('animate false stops the motion of a running symbol', () => {
    const base = scene({ elements: [{ id: 'pump', symbol: 'pump.volute', x: 100, y: 100 }], links: [] });
    const moving = markup(base);
    const still = markup({ ...base, rules: [{ target: 'pump', animate: 'false' }] });
    expect(moving).toContain('<animate');
    expect(still).not.toContain('<animate');
  });
  it('hidden omits the symbol, its name and its hit area; connections still draw', () => {
    const s = scene({ rules: [{ target: 'tank', hidden: 'true' }] });
    const m = draw(s);
    const html = m.nodes.map(svgToString).join('');
    expect(html).not.toContain('>Tank<');
    expect(plain).toContain('>Tank<');
    expect(m.hits.map((h) => h.id)).toEqual(['pump', 'lt']);
    expect(draw(scene()).hits.map((h) => h.id)).toEqual(['pump', 'tank', 'lt']);
    // both connections that touch the tank are still drawn: the paths of the plain scene are all there
    expect(count(html, '<path')).toBeGreaterThan(0);
    const wire = (x: string) => x.match(/d="M[^"]*"/g) ?? [];
    for (const d of wire(plain).filter((p) => p.includes('L'))) expect(html).toContain(d);
    expect(m.problems).toBe(0);
    // the view does not jump when a symbol hides
    expect(m.viewBox).toBe(draw(scene()).viewBox);
  });
  it('a connection with its own hidden rule is not drawn', () => {
    const s = scene({ rules: [{ target: 'feed', hidden: 'true' }] });
    const html = markup(s);
    expect(count(html, '<path')).toBeLessThan(count(plain, '<path'));
    expect(markup(scene({ rules: [{ target: 'pump', hidden: 'true' }] }))).toContain('<path'); // a "from" symbol's hidden rule does not hide the connection
  });
  it('label replaces the shown name, with tokens', () => {
    const m = draw(scene({ rules: [{ target: 'tank', label: 'Level {value}' }, { target: 'lt', label: '{id} · {param:site}' }] }), ROWS, { params: { site: 'North' } });
    const html = m.nodes.map(svgToString).join('');
    expect(html).toContain('>Level 55<');
    expect(html).not.toContain('>Tank<');
    expect(html).toContain('>lt · North<');
    expect(m.hits.find((h) => h.id === 'tank')?.name).toBe('Level 55');
  });
  it('a label shows even on a symbol with no name of its own', () => {
    const s = scene({ elements: [{ id: 'pump', symbol: 'pump.volute', x: 100, y: 100 }], links: [], rules: [{ target: 'pump', label: 'Duty pump' }] });
    expect(markup(s)).toContain('>Duty pump<');
  });
  it('label text is escaped in markup', () => {
    expect(markup(scene({ rules: [{ target: 'tank', label: '<script>&' }] }))).toContain('&lt;script&gt;&amp;');
  });
  it('medium changes what flows', () => {
    const base = scene({ elements: [{ id: 'pump', symbol: 'pump.volute', x: 100, y: 100 }], links: [] });
    expect(markup(base)).not.toContain('var(--error)');
    expect(markup({ ...base, rules: [{ target: 'pump', medium: 'hot' }] })).toContain('var(--error)');
  });
  it('rules read board parameters', () => {
    const s = scene({ rules: [{ target: 'tank', source: 'param', key: 'mode', op: 'eq', value: 'off', dim: 'true' }] });
    expect(markup(s, ROWS, { params: { mode: 'off' } })).not.toBe(plain);
    expect(markup(s, ROWS, { params: { mode: 'auto' } })).toBe(plain);
    expect(markup(s)).toBe(plain);
  });
  it('a rule reads another symbol\'s row', () => {
    const s = scene({ rules: [{ target: 'pump', of: 'tank', key: 'value', op: 'gte', value: '50', state: 'critical' }] });
    expect(markup(s)).toContain('var(--error)');
    expect(markup(s, [{ id: 'pump', running: true }, { id: 'tank', value: 10 }])).not.toContain('var(--error)');
  });
  it('rules decide in order: the last one that matches wins, stop keeps the rest out', () => {
    const rules: SceneRule[] = [{ target: 'pump', state: 'critical' }, { target: 'pump', state: 'warning' }];
    expect(markup(scene({ warningColor: '#aa5500', criticalColor: '#cc0011', rules }))).toContain('#aa5500');
    expect(markup(scene({ warningColor: '#aa5500', criticalColor: '#cc0011', rules: [{ ...rules[0], stop: true }, rules[1]] }))).toContain('#cc0011');
  });
  it('`*` reaches every symbol', () => {
    const m = markup(scene({ rules: [{ target: '*', dim: 'true' }] }));
    expect(count(m, 'opacity="0.4"')).toBeGreaterThanOrEqual(count(plain, 'opacity="0.4"') + 3);
  });
  it('a connection without its own id follows its "from" symbol\'s state but not its hidden rule', () => {
    const s = scene({ rules: [{ target: 'tank', state: 'critical', hidden: 'true' }] });
    const html = markup(s);
    // tank is the "from" of the wire to the level transmitter: it draws, in the critical colour
    expect(html).toContain('var(--error)');
    expect(draw(s).problems).toBe(0);
  });
  it('a connection with its own id answers to that id', () => {
    const m = markup(scene({ criticalColor: '#cc0011', rules: [{ target: 'feed', state: 'critical' }] }));
    expect(m).toContain('#cc0011');
    expect(markup(scene({ criticalColor: '#cc0011', rules: [{ target: 'pump', state: 'critical' }] }))).toContain('#cc0011');
  });
});

describe('per-symbol colours, unit and decimals', () => {
  it('a symbol\'s own colours beat the scene\'s', () => {
    const s = scene({ runningColor: '#00aa33', elements: [{ id: 'pump', symbol: 'pump.volute', x: 100, y: 100, runningColor: '#3300aa' }], links: [] });
    const m = markup(s, [{ id: 'pump', running: true }]);
    expect(m).toContain('#3300aa');
    expect(m).not.toContain('#00aa33');
  });
  it('idle, warning and critical colours of one symbol', () => {
    const e = { id: 'pump', symbol: 'isa.level', x: 100, y: 100, idleColor: '#111199', warningColor: '#aa5500', criticalColor: '#cc0011' };
    const s = scene({ elements: [e], links: [] });
    expect(markup(s, [{ id: 'pump', running: false }])).toContain('#111199');
    expect(markup(s, [{ id: 'pump', running: true }])).not.toContain('#111199');
    expect(markup(s, [{ id: 'pump', status: 'warning' }])).toContain('#aa5500');
    expect(markup(s, [{ id: 'pump', status: 'critical' }])).toContain('#cc0011');
  });
  it('an empty colour is the scene\'s default', () => {
    const e = { id: 'pump', symbol: 'pump.volute', x: 100, y: 100, runningColor: '' };
    expect(markup(scene({ runningColor: '#00aa33', elements: [e], links: [] }), [{ id: 'pump', running: true }])).toContain('#00aa33');
  });
  it('fillColor colours the liquid', () => {
    const s = scene({ elements: [{ id: 'tank', symbol: 'tank.vertical', x: 100, y: 100, fillColor: '#00ccee', max: 100 }], links: [] });
    expect(markup(s, [{ id: 'tank', value: 40 }])).toContain('#00ccee');
  });
  it('unit and decimals of a symbol go to the formatter, the others keep the host\'s', () => {
    const calls: Array<[number, unknown]> = [];
    const format = (n: number, own?: { unit?: string; decimals?: number }) => { calls.push([n, own]); return `${n}|${own?.unit ?? ''}|${own?.decimals ?? ''}`; };
    const s = scene({ elements: [{ id: 'lt', symbol: 'isa.level', x: 100, y: 100, unit: ' m', decimals: 2 }, { id: 'lt2', symbol: 'isa.level', x: 300, y: 100 }], links: [] });
    const html = markup(s, [{ id: 'lt', value: 1.5 }, { id: 'lt2', value: 2.5 }], { format });
    expect(html).toContain('1.5|m|2');
    expect(html).toContain('2.5||');
    expect(calls.some(([n, own]) => n === 2.5 && own === undefined)).toBe(true);
  });
  it('the built-in formatter writes decimals and the unit', () => {
    const s = scene({ elements: [{ id: 'lt', symbol: 'isa.level', x: 100, y: 100, unit: 'bar', decimals: 1 }], links: [] });
    expect(markup(s, [{ id: 'lt', value: 4.26 }])).toContain('>4.3 bar<');
  });
  it('a bad unit or decimals is ignored, a large one is capped', () => {
    const s = (decimals: unknown) => scene({ elements: [{ id: 'lt', symbol: 'isa.level', x: 100, y: 100, decimals: decimals as number }], links: [] });
    expect(markup(s('x'), [{ id: 'lt', value: 4.26 }])).toContain('>4.26<');
    expect(markup(s(99), [{ id: 'lt', value: 1 }])).toContain('>1.000000<');
  });
  it('a label token uses the symbol\'s own unit and decimals', () => {
    const s = scene({ elements: [{ id: 'lt', symbol: 'isa.level', x: 100, y: 100, unit: 'bar', decimals: 1 }], links: [], rules: [{ target: 'lt', label: 'P {value}' }] });
    expect(markup(s, [{ id: 'lt', value: 4.26 }])).toContain('>P 4.3 bar<');
  });
});

describe('the sample boards show the rules', () => {
  const sample = (title: string) => SECTOR_SCENES.find((s) => s.title === title)!;
  const html = (title: string, params?: Record<string, unknown>) => {
    const s = sample(title);
    return markup(s.settings as SceneSettings, s.rows, { params });
  };
  it('HVAC: the boiler carries its number; the chiller goes passive when the mode parameter is off', () => {
    const on = html('Building HVAC');
    expect(on).toContain('>Heating boiler 68<');
    expect(on).not.toContain('>Chiller (off)<');
    const off = html('Building HVAC', { mode: 'off' });
    expect(off).toContain('>Chiller (off)<');
    expect(count(off, 'opacity="0.4"')).toBeGreaterThan(count(on, 'opacity="0.4"'));
  });
  it('power: the drive that warns blinks and says so', () => {
    const m = html('Plant substation');
    expect(m).toContain('>Drive: check<');
    expect(count(m, 'attributeName="opacity"')).toBe(1);
  });
  it('wastewater: the basins above 70 turn amber and say so', () => {
    const m = html('Wastewater treatment');
    expect(m).toContain('>Basin 1 · high 72<');
    expect(m).not.toContain('>Basin 2 · high');
  });
});
