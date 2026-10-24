import { describe, it, expect } from 'vitest';
import {
  aliasCompatibility,
  defaultResolveMultiple,
  emptyFilter,
  filterEntityType,
  isFilterComplete,
  normalizeAlias,
} from './filters';
import type { EntityAlias, EntityAliasFilter } from './types';

const ctx = { providers: [{ key: 'iot_asset', label: 'Assets', relationTypes: [] }], params: [] };

function alias(filter: EntityAliasFilter, resolveMultiple = true): EntityAlias {
  return { key: 'a', name: 'A', resolveMultiple, filter };
}

describe('type change defaults (TB filterTypeChanged)', () => {
  it('resolve-multiple is off only for a single entity and the page entity', () => {
    expect(defaultResolveMultiple('singleEntity')).toBe(false);
    expect(defaultResolveMultiple('stateEntity')).toBe(false);
    expect(defaultResolveMultiple('entityList')).toBe(true);
    expect(defaultResolveMultiple('relationsQuery')).toBe(true);
  });

  it('keeps the entity type and picks the only provider', () => {
    const prev: EntityAliasFilter = { type: 'entityType', entityType: 'iot_device' };
    expect(emptyFilter('entityList', prev, ctx)).toEqual({ type: 'entityList', entityType: 'iot_device', ids: [] });
    expect(emptyFilter('relationsQuery', prev, ctx)).toEqual({
      type: 'relationsQuery',
      provider: 'iot_asset',
      root: { entity: { type: 'iot_device', id: '' } },
      direction: 'from',
      maxLevel: 1,
      filters: [],
    });
    expect(emptyFilter('singleEntity', null, ctx)).toEqual({ type: 'singleEntity', entityType: '', id: '' });
  });
});

describe('normalizeAlias', () => {
  it('forces a single entity to resolve to one', () => {
    const a = normalizeAlias(alias({ type: 'singleEntity', entityType: 'iot_device', id: 'd1' }, true));
    expect(a.resolveMultiple).toBe(false);
  });

  it('drops empty and duplicate relation filters and a last-level flag at level 1', () => {
    const a = normalizeAlias(
      alias({
        type: 'relationsQuery',
        provider: 'p',
        root: { param: 'site' },
        direction: 'to',
        maxLevel: 1,
        lastLevelOnly: true,
        filters: [{}, { relationType: 'Contains' }, { relationType: ' Contains ', negate: false }, { entityTypes: ['iot_device'], negate: true }],
      }),
    );
    expect(a.filter).toEqual({
      type: 'relationsQuery',
      provider: 'p',
      root: { param: 'site' },
      direction: 'to',
      maxLevel: 1,
      filters: [{ relationType: 'Contains' }, { entityTypes: ['iot_device'], negate: true }],
    });
  });

  it('trims the name and drops an empty optional prefix', () => {
    const a = normalizeAlias({ ...alias({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'], namePrefix: '  ' }), name: ' Pumps ' });
    expect(a.name).toBe('Pumps');
    expect(a.filter).toEqual({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] });
  });
});

describe('aliasCompatibility (a widget entity slot)', () => {
  const devices = alias({ type: 'entityType', entityType: 'iot_device' }, true);
  const oneDevice = alias({ type: 'singleEntity', entityType: 'iot_device', id: 'd1' }, false);
  const related = alias({ type: 'relationsQuery', provider: 'p', root: { param: 'site' }, direction: 'from', maxLevel: 1, filters: [] }, false);

  it('refuses a wrong entity type', () => {
    expect(aliasCompatibility(devices, { entityTypes: ['iot_asset'], multiple: true })).toEqual({
      ok: false,
      reason: 'entityType',
      entityType: 'iot_device',
    });
    expect(aliasCompatibility(devices, { entityTypes: [], multiple: true })).toEqual({ ok: true });
  });

  it('refuses a resolve-multiple alias in a single slot, takes a single alias in a multiple slot', () => {
    expect(aliasCompatibility(devices, { entityTypes: ['iot_device'], multiple: false })).toEqual({ ok: false, reason: 'multiple' });
    expect(aliasCompatibility(oneDevice, { entityTypes: ['iot_device'], multiple: false })).toEqual({ ok: true });
    expect(aliasCompatibility(oneDevice, { entityTypes: ['iot_device'], multiple: true })).toEqual({ ok: true });
  });

  it('allows a relations query whatever the slot type (its type is known only after resolving)', () => {
    expect(filterEntityType(related.filter)).toBeNull();
    expect(aliasCompatibility(related, { entityTypes: ['iot_asset'], multiple: false })).toEqual({ ok: true });
  });
});

describe('isFilterComplete', () => {
  it('is true only when the filter validates', () => {
    expect(isFilterComplete({ type: 'entityName', entityType: 'iot_device', namePrefix: '' }, [])).toBe(false);
    expect(isFilterComplete({ type: 'entityName', entityType: 'iot_device', namePrefix: 'A' }, [])).toBe(true);
  });
});
