import { describe, it, expect } from 'vitest';
import {
  MAX_ALIASES,
  isValidAliasKey,
  slugKey,
  validateAlias,
  validateAliases,
  validateFilter,
} from './validate';
import type { BoardParamInfo, EntityAlias, EntityAliasFilter } from './types';

const params: BoardParamInfo[] = [{ key: 'site', label: 'Site', entityType: 'iot_asset' }];
const opts = { existingKeys: [] as string[], params };

function alias(filter: EntityAliasFilter, over: Partial<EntityAlias> = {}): EntityAlias {
  return { key: 'pumps', name: 'Pumps', resolveMultiple: true, filter, ...over };
}

const relations = (over: Partial<Extract<EntityAliasFilter, { type: 'relationsQuery' }>> = {}): EntityAliasFilter => ({
  type: 'relationsQuery',
  provider: 'iot_asset',
  root: { param: 'site' },
  direction: 'from',
  maxLevel: 1,
  filters: [],
  ...over,
});

describe('validateAlias: key and name', () => {
  it('accepts a valid alias', () => {
    expect(validateAlias(alias({ type: 'entityType', entityType: 'iot_device' }), opts)).toEqual({});
  });

  it('checks the key pattern, the reserved words and duplicates', () => {
    const f: EntityAliasFilter = { type: 'entityType', entityType: 'iot_device' };
    expect(validateAlias(alias(f, { key: '' }), opts).key).toBe('required');
    expect(validateAlias(alias(f, { key: 'Pumps' }), opts).key).toBe('pattern');
    expect(validateAlias(alias(f, { key: '1pumps' }), opts).key).toBe('pattern');
    expect(validateAlias(alias(f, { key: 'a'.repeat(41) }), opts).key).toBe('pattern');
    expect(validateAlias(alias(f, { key: 'a'.repeat(40) }), opts).key).toBeUndefined();
    expect(validateAlias(alias(f, { key: '__proto__' }), opts).key).toBe('reserved');
    expect(validateAlias(alias(f, { key: 'constructor' }), opts).key).toBe('reserved');
    expect(validateAlias(alias(f, { key: 'prototype' }), opts).key).toBe('reserved');
    expect(validateAlias(alias(f), { ...opts, existingKeys: ['pumps'] }).key).toBe('duplicate');
    expect(isValidAliasKey('pump_2')).toBe(true);
    expect(isValidAliasKey('constructor')).toBe(false);
  });

  it('checks the name: required, at most 80, unique case-insensitively', () => {
    const f: EntityAliasFilter = { type: 'entityType', entityType: 'iot_device' };
    expect(validateAlias(alias(f, { name: '   ' }), opts).name).toBe('required');
    expect(validateAlias(alias(f, { name: 'x'.repeat(81) }), opts).name).toBe('tooLong');
    expect(validateAlias(alias(f, { name: 'x'.repeat(80) }), opts).name).toBeUndefined();
    expect(validateAlias(alias(f), { ...opts, existingNames: [' PUMPS '] }).name).toBe('duplicate');
  });

  it('refuses a 33rd alias', () => {
    const f: EntityAliasFilter = { type: 'entityType', entityType: 'iot_device' };
    const full = Array.from({ length: MAX_ALIASES }, (_, i) => `a${i}`);
    expect(validateAlias(alias(f), { ...opts, existingKeys: full }).aliases).toBe('tooMany');
    expect(validateAlias(alias(f), { ...opts, existingKeys: full.slice(1) }).aliases).toBeUndefined();
  });

  it('a single entity never resolves to many', () => {
    const f: EntityAliasFilter = { type: 'singleEntity', entityType: 'iot_device', id: 'd1' };
    expect(validateAlias(alias(f, { resolveMultiple: true }), opts).resolveMultiple).toBe('singleOnly');
    expect(validateAlias(alias(f, { resolveMultiple: false }), opts)).toEqual({});
  });
});

describe('validateFilter: caps per type', () => {
  it('needs a type', () => {
    expect(validateFilter(null, params)['filter.type']).toBe('required');
    expect(validateFilter({ type: 'apiUsageState' } as unknown as EntityAliasFilter, params)['filter.type']).toBe('unknownType');
  });

  it('single entity needs a type and an id', () => {
    const e = validateFilter({ type: 'singleEntity', entityType: '', id: '' }, params);
    expect(e['filter.entityType']).toBe('required');
    expect(e['filter.id']).toBe('required');
  });

  it('entity list holds 1 to 100 ids', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `d${i}`);
    expect(validateFilter({ type: 'entityList', entityType: 'iot_device', ids: [] }, params)['filter.ids']).toBe('tooFew');
    expect(validateFilter({ type: 'entityList', entityType: 'iot_device', ids: ids(100) }, params)).toEqual({});
    expect(validateFilter({ type: 'entityList', entityType: 'iot_device', ids: ids(101) }, params)['filter.ids']).toBe('tooMany');
  });

  it('name prefix is 1 to 120 characters, optional for a subtype filter', () => {
    expect(validateFilter({ type: 'entityName', entityType: 'iot_device', namePrefix: ' ' }, params)['filter.namePrefix']).toBe('required');
    expect(validateFilter({ type: 'entityName', entityType: 'iot_device', namePrefix: 'x'.repeat(121) }, params)['filter.namePrefix']).toBe('tooLong');
    expect(validateFilter({ type: 'entityName', entityType: 'iot_device', namePrefix: 'x'.repeat(120) }, params)).toEqual({});
    expect(validateFilter({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] }, params)).toEqual({});
    expect(
      validateFilter({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'], namePrefix: 'x'.repeat(121) }, params)['filter.namePrefix'],
    ).toBe('tooLong');
  });

  it('subtype filter holds 1 to 50 subtypes', () => {
    const subs = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
    expect(validateFilter({ type: 'entitySubtype', entityType: 'iot_device', subtypes: [] }, params)['filter.subtypes']).toBe('tooFew');
    expect(validateFilter({ type: 'entitySubtype', entityType: 'iot_device', subtypes: subs(50) }, params)).toEqual({});
    expect(validateFilter({ type: 'entitySubtype', entityType: 'iot_device', subtypes: subs(51) }, params)['filter.subtypes']).toBe('tooMany');
  });

  it('state entity and a param root must name a board param', () => {
    expect(validateFilter({ type: 'stateEntity', entityType: 'iot_asset', param: '' }, params)['filter.param']).toBe('required');
    expect(validateFilter({ type: 'stateEntity', entityType: 'iot_asset', param: 'nope' }, params)['filter.param']).toBe('unknownParam');
    expect(validateFilter({ type: 'stateEntity', entityType: 'iot_asset', param: 'site' }, params)).toEqual({});
    expect(validateFilter(relations({ root: { param: 'nope' } }), params)['filter.root']).toBe('unknownParam');
    expect(validateFilter(relations({ root: { entity: { type: 'iot_asset', id: '' } } }), params)['filter.root']).toBe('required');
    expect(validateFilter(relations({ root: { entity: { type: 'iot_asset', id: 'a1' } } }), params)).toEqual({});
  });

  it('max level is an integer from 1 to 10, no unlimited', () => {
    for (const bad of [0, 11, 2.5, Number.NaN]) {
      expect(validateFilter(relations({ maxLevel: bad }), params)['filter.maxLevel']).toBe('range');
    }
    expect(validateFilter(relations({ maxLevel: 10 }), params)).toEqual({});
  });

  it('at most 8 relation filters, and a relation query needs a provider', () => {
    const f = Array.from({ length: 9 }, (_, i) => ({ relationType: `r${i}` }));
    expect(validateFilter(relations({ filters: f }), params)['filter.filters']).toBe('tooMany');
    expect(validateFilter(relations({ filters: f.slice(1) }), params)).toEqual({});
    expect(validateFilter(relations({ provider: '' }), params)['filter.provider']).toBe('required');
  });

  it('entity search query needs an entity type; subtypes are optional but capped', () => {
    const base = { type: 'entitySearchQuery' as const, provider: 'iot_asset', root: { param: 'site' }, direction: 'to' as const, maxLevel: 2 };
    expect(validateFilter({ ...base, entityType: '' }, params)['filter.entityType']).toBe('required');
    expect(validateFilter({ ...base, entityType: 'iot_device' }, params)).toEqual({});
    const subs = Array.from({ length: 51 }, (_, i) => `t${i}`);
    expect(validateFilter({ ...base, entityType: 'iot_device', subtypes: subs }, params)['filter.subtypes']).toBe('tooMany');
  });
});

describe('validateAliases', () => {
  it('reports duplicates against each other and the list cap', () => {
    const f: EntityAliasFilter = { type: 'entityType', entityType: 'iot_device' };
    const r = validateAliases([alias(f), alias(f, { name: 'pumps' })], { params });
    expect(r.valid).toBe(false);
    expect(r.byIndex[0].key).toBe('duplicate');
    expect(r.byIndex[1].name).toBe('duplicate');
    const many = Array.from({ length: MAX_ALIASES + 1 }, (_, i) => alias(f, { key: `a${i}`, name: `A ${i}` }));
    const big = validateAliases(many, { params });
    expect(big.aliases).toBe('tooMany');
    expect(big.byIndex.every((e) => e.aliases === undefined)).toBe(true);
    expect(validateAliases(many.slice(1), { params }).valid).toBe(true);
  });
});

describe('slugKey', () => {
  it('derives a camelCase key from a name', () => {
    expect(slugKey('Pump station #2')).toBe('pumpStation2');
    expect(slugKey('Şişli Binaları')).toBe('sisliBinalari');
    expect(slugKey('3rd floor')).toBe('alias3rdFloor');
    expect(slugKey('!!!')).toBe('alias');
    expect(slugKey('x'.repeat(60))).toHaveLength(40);
  });

  it('avoids taken and reserved keys', () => {
    expect(slugKey('Pumps', ['pumps'])).toBe('pumps2');
    expect(slugKey('Pumps', ['pumps', 'pumps2'])).toBe('pumps3');
    expect(slugKey('constructor')).toBe('constructor2');
    const long = 'x'.repeat(40);
    const k = slugKey(long, [long]);
    expect(k).toBe(`${'x'.repeat(39)}2`);
    expect(isValidAliasKey(k)).toBe(true);
  });
});
