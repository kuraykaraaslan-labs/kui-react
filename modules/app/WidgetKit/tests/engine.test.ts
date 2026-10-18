import { describe, it, expect } from 'vitest';
import {
  migrate, validate, prepareForSave, readSettings, prune, effective, templateDefaults, visibleGroups,
} from '../settings/engine';
import { CORE_CARD, CORE_FORMAT, boardCardLayer } from '../settings/core';
import { isColor, formatValue, rangeFor, fontStyle } from '../settings/style';
import { since } from '../settings/packs';
import { STAT_VALUE } from '../templates/stat-value';
import type { MigrationOp, SettingsTemplate } from '../settings/types';

const set = { type: STAT_VALUE, card: CORE_CARD, format: CORE_FORMAT };

describe('colours (D-21.1: free colour or a theme token)', () => {
  it.each(['#fff', '#ff000080', '#0f172a', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'hsl(210 40% 50%)', 'var(--primary)', 'transparent'])(
    'accepts %s', (c) => expect(isColor(c)).toBe(true));
  it.each(['red;background:url(x)', 'url(https://x)', 'expression(1)', 'var(--x);', '#12', '', 'var(--Primary)'])(
    'refuses %s', (c) => expect(isColor(c)).toBe(false));
});

describe('value format', () => {
  it('places the unit, honours decimals and compact notation', () => {
    expect(formatValue(21.456, { unit: '°C', decimals: 1 }, {}, 'en')).toBe('21.5 °C');
    expect(formatValue(1249, { unit: '₺', unitPosition: 'before' }, {}, 'en')).toBe('₺ 1,249');
    expect(formatValue(1250000, { notation: 'compact' }, {}, 'en')).toBe('1.3M');
    expect(formatValue(3, { decimals: 2 }, { decimals: 0 }, 'en')).toBe('3');
    expect(formatValue(null)).toBe('—');
  });
});

describe('colour ranges', () => {
  const ranges = [{ to: 10, color: 'var(--success)' }, { from: 10, to: 20, color: 'var(--warning)' }, { from: 20, color: '#ef4444' }];
  it('first match wins; edges decide boundaries', () => {
    expect(rangeFor(5, ranges)?.color).toBe('var(--success)');
    expect(rangeFor(10, ranges, 'from')?.color).toBe('var(--warning)');
    expect(rangeFor(10, ranges, 'to')?.color).toBe('var(--success)');
    expect(rangeFor('x', ranges)).toBeUndefined();
  });
});

describe('fonts', () => {
  it('maps a font value and its colour to a style, refusing a bad colour', () => {
    expect(fontStyle({ size: 18, weight: 600, style: 'italic' }, '#123456')).toEqual({ fontSize: '18px', fontWeight: 600, fontStyle: 'italic', color: '#123456' });
    expect(fontStyle(undefined, 'url(x)')).toEqual({});
  });
});

describe('validate', () => {
  it('drops unknown keys and bad values, checks repeater items deeply', () => {
    const r = validate(STAT_VALUE, {
      layout: 'inline', nope: 1, valueColor: 'javascript:alert(1)',
      ranges: [{ to: 5, color: '#00ff00' }, { from: 5, color: 'bad;' }],
    });
    expect(r.values.layout).toBe('inline');
    expect(r.values).not.toHaveProperty('nope');
    expect(r.values).not.toHaveProperty('valueColor');
    expect(r.values.ranges).toEqual([{ to: 5, color: '#00ff00' }, { from: 5 }]);
    expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['valueColor', 'ranges.1.color']));
  });
  it('lets a required item field with a default stay out (sparse); refuses one without a default', () => {
    const t: SettingsTemplate = {
      ...STAT_VALUE, fields: { list: { type: 'repeater', label: 'List', since: 1, fields: {
        mode: { type: 'select', label: 'Mode', required: true, value: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        name: { type: 'text', label: 'Name', required: true },
      } } },
    } as SettingsTemplate;
    const r = validate(t, { list: [{ name: 'x' }, {}] });
    expect(r.values.list).toEqual([{ name: 'x' }, {}]);
    expect(r.issues.map((i) => i.path)).toEqual(['list.1.name']);
  });
  it('refuses an option that is not offered', () => {
    expect(validate(STAT_VALUE, { layout: 'spiral' }).issues).toHaveLength(1);
  });
});

describe('prepareForSave', () => {
  it('stores sparse values per namespace and stamps every template', () => {
    const r = prepareForSave({ layout: 'stacked', label: 'Rooms', $card: { variant: 'raised', padding: 4 }, $format: { unit: '%' } }, set);
    expect(r.issues).toEqual([]);
    expect(r.settings).toEqual({ label: 'Rooms', $card: { padding: 4 }, $format: { unit: '%' }, $v: { 'builtin:stat.value': 1, 'core:card': 1, 'core:format': 1 } });
  });
  it('prunes against layered defaults (the widget type\'s card defaults)', () => {
    const r = prepareForSave({ $card: { padding: 0 } }, set, { defaults: { 'core:card': { padding: 0 } } });
    expect(r.settings.$card).toBeUndefined();
  });
  it('refuses data written by a newer template version (409), and a newer stored row', () => {
    expect(prepareForSave({ $v: { 'core:card': 9 } }, set).newer).toEqual([{ id: 'core:card', stored: 9, known: 1 }]);
    expect(prepareForSave({}, set, { previous: { $v: { 'builtin:stat.value': 2 } } }).newer).toHaveLength(1);
  });
  it('ignores a client stamp as truth: the server stamps', () => {
    const r = prepareForSave({ $v: { 'builtin:stat.value': 1, 'core:bogus': 3 } }, set);
    expect(r.settings.$v).toEqual({ 'builtin:stat.value': 1, 'core:card': 1, 'core:format': 1 });
  });
});

describe('migrations (D-21.6)', () => {
  const v2: SettingsTemplate = {
    id: 'builtin:demo', version: 3, namespace: '', label: 'Demo', groups: [],
    fields: since(1, { colour: { label: 'Colour', type: 'color' }, size: { label: 'Size', type: 'number', max: 10 } }),
    migrations: [
      { from: 1, to: 2, note: 'tint became colour', ops: [{ op: 'rename', from: 'tint', to: 'colour' }] },
      { from: 2, to: 3, note: 'size capped', ops: [{ op: 'clamp', key: 'size', max: 10 }, { op: 'drop', key: 'legacy' }] },
    ],
  };
  it('runs every step in order from the stored version, and is idempotent', () => {
    const a = migrate(v2, { tint: '#fff', size: 40, legacy: true }, 1);
    expect(a.values).toEqual({ colour: '#fff', size: 10 });
    expect(a.applied.map((s) => s.to)).toEqual([2, 3]);
    expect(migrate(v2, a.values, 3).values).toBe(a.values);
  });
  it('an absent stamp is v1 (D-21.3)', () => {
    const r = readSettings({ tint: 'red' } as Record<string, unknown>, { type: v2, card: CORE_CARD });
    expect(r.parts['builtin:demo']).toEqual({ colour: 'red' });
  });
  it('returns newer data untouched', () => {
    const r = migrate(v2, { x: 1 }, 7);
    expect(r.newer).toEqual({ stored: 7, known: 3 });
    expect(r.values).toEqual({ x: 1 });
  });
});

describe('filterList', () => {
  const tpl = (...ops: MigrationOp[]): SettingsTemplate => ({
    id: 'tenant:demo', version: 2, namespace: '', label: 'Demo', groups: [],
    fields: since(1, { tags: { label: 'Tags', type: 'multi-select' } }),
    migrations: [{ from: 1, to: 2, note: 'options changed', ops }],
  });
  const run = (values: Record<string, unknown>, ...ops: MigrationOp[]) => migrate(tpl(...ops), values, 1).values;

  it('remove drops the listed items and keeps the order of the rest', () => {
    expect(run({ tags: ['c', 'a', 'b', 'a'] }, { op: 'filterList', key: 'tags', remove: ['b'] })).toEqual({ tags: ['c', 'a', 'a'] });
  });
  it('keep keeps only the listed items, compared as strings', () => {
    expect(run({ tags: ['a', 'x', 2, 'b'] }, { op: 'filterList', key: 'tags', keep: ['a', '2'] })).toEqual({ tags: ['a', 2] });
  });
  it('a list that ends up empty removes the key', () => {
    expect(run({ tags: ['c'], other: 1 }, { op: 'filterList', key: 'tags', remove: ['c'] })).toEqual({ other: 1 });
  });
  it('leaves an already empty list, a non-array value and a missing key untouched', () => {
    const op: MigrationOp = { op: 'filterList', key: 'tags', remove: ['c'] };
    expect(run({ tags: [] }, op)).toEqual({ tags: [] });
    expect(run({ tags: 'c' }, op)).toEqual({ tags: 'c' });
    expect(run({ other: 1 }, op)).toEqual({ other: 1 });
  });
  it('works inside each on repeater items', () => {
    const out = run(
      { rows: [{ tags: ['a', 'c'] }, { tags: ['c'] }, 'loose'] },
      { op: 'each', key: 'rows', ops: [{ op: 'filterList', key: 'tags', remove: ['c'] }] },
    );
    expect(out).toEqual({ rows: [{ tags: ['a'] }, {}, 'loose'] });
  });
  it('is idempotent: migrating the output again changes nothing', () => {
    const op: MigrationOp = { op: 'filterList', key: 'tags', remove: ['b'], keep: ['a', 'b', 'c'] };
    const once = run({ tags: ['a', 'b', 'd', 'c'] }, op);
    expect(once).toEqual({ tags: ['a', 'c'] });
    expect(run(once, op)).toEqual(once);
  });
  it('an unknown op leaves the values unchanged and does not throw', () => {
    const unknown = { op: 'fromTheFuture', key: 'tags' } as unknown as MigrationOp;
    expect(run({ tags: ['a'] }, unknown, { op: 'drop', key: 'gone' })).toEqual({ tags: ['a'] });
  });
});

describe('defaults and groups', () => {
  it('layers defaults under stored values and prunes back', () => {
    const eff = effective(CORE_CARD, { padding: 0 }, { variant: 'flat' });
    expect(eff.variant).toBe('flat');
    expect(eff.padding).toBe(0);
    expect(prune(eff, templateDefaults(CORE_CARD))).toEqual({ padding: 0, variant: 'flat' });
  });
  it('board card defaults map to $card keys', () => {
    expect(boardCardLayer({ cardVariant: 'outline', cardBackgroundColor: '#000' })).toEqual({ variant: 'outline', backgroundColor: '#000', background: 'color' });
  });
  it('hides Data display for a widget without data', () => {
    const g = visibleGroups(CORE_CARD, { hasData: false, exportable: false, formatsNumbers: false });
    expect(g.has('dataDisplay')).toBe(false);
    expect(g.has('title')).toBe(true);
  });
});
