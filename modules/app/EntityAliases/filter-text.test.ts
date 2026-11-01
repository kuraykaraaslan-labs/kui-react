import { describe, it, expect } from 'vitest';
import { entityFilterText, type FilterTextOptions } from './filter-text';
import type { EntityAliasFilter } from './types';

const options: FilterTextOptions = {
  entityTypes: [
    { key: 'iot_device', label: 'Device', labelPlural: 'Devices', subtypeLabel: 'Device profiles', hasSubtypes: true },
    { key: 'iot_asset', label: 'Asset', labelPlural: 'Assets', subtypeLabel: 'Asset types', hasSubtypes: true },
  ],
  params: [{ key: 'site', label: 'site', entityType: 'iot_asset' }],
  relationProviders: [{ key: 'iot_asset', label: 'Assets', relationTypes: [{ value: 'Contains', label: 'contains' }] }],
};

const text = (f: EntityAliasFilter | null, o: Partial<FilterTextOptions> = {}) => entityFilterText(f, { ...options, ...o });

describe('entityFilterText', () => {
  it('no filter', () => {
    expect(text(null)).toBe('No entity filter specified');
  });

  it('single entity, with and without a known name', () => {
    expect(text({ type: 'singleEntity', entityType: 'iot_device', id: 'd1' })).toBe('One device');
    expect(text({ type: 'singleEntity', entityType: 'iot_device', id: 'd1' }, { entityNames: { d1: 'Pump 1' } })).toBe("Device 'Pump 1'");
  });

  it('entity list', () => {
    expect(text({ type: 'entityList', entityType: 'iot_device', ids: ['a'] })).toBe('One device');
    expect(text({ type: 'entityList', entityType: 'iot_device', ids: ['a', 'b', 'c'] })).toBe('List of 3 devices');
  });

  it('entity name, entity type and the page entity', () => {
    expect(text({ type: 'entityName', entityType: 'iot_device', namePrefix: 'Pump' })).toBe("Devices whose name starts with 'Pump'");
    expect(text({ type: 'entityType', entityType: 'iot_asset' })).toBe('All assets');
    expect(text({ type: 'stateEntity', entityType: 'iot_asset', param: 'site' })).toBe("Asset from the page parameter 'site'");
  });

  it('names a subtype by its name, never its stored id (next-boilerplate e2e round 5, V1-B6)', () => {
    const id = '33b608b5-0000-4000-8000-000000000000';
    expect(text({ type: 'entitySubtype', entityType: 'iot_device', subtypes: [id] }, { subtypeNames: { [id]: 'Cold room controller' } })).toBe('Devices of device profiles Cold room controller');
    expect(text({ type: 'entitySearchQuery', entityType: 'iot_device', subtypes: [id], direction: 'from', root: { param: 'site' }, maxLevel: 1, provider: 'iot_asset' } as EntityAliasFilter, { subtypeNames: { [id]: 'Pump' } })).toContain('Devices of device profiles Pump');
  });

  it('entity subtype, with and without a name prefix', () => {
    expect(text({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump', 'Tank'], namePrefix: 'A' })).toBe(
      "Devices of device profiles Pump, Tank whose name starts with 'A'",
    );
    expect(text({ type: 'entitySubtype', entityType: 'iot_device', subtypes: ['Pump'] })).toBe('Devices of device profiles Pump');
  });

  it('relations query', () => {
    expect(
      text({ type: 'relationsQuery', provider: 'iot_asset', root: { param: 'site' }, direction: 'to', maxLevel: 3, filters: [] }),
    ).toBe("Entities related TO the page's site (up to 3 levels)");
    expect(
      text({
        type: 'relationsQuery',
        provider: 'iot_asset',
        root: { entity: { type: 'iot_asset', id: 'b1' } },
        direction: 'from',
        maxLevel: 2,
        lastLevelOnly: true,
        filters: [{ relationType: 'Contains', entityTypes: ['iot_device'] }, { entityTypes: ['iot_asset'], negate: true }],
      }),
    ).toBe('Devices (contains) or not Assets related FROM a fixed asset (level 2 only)');
    expect(
      text(
        { type: 'relationsQuery', provider: 'iot_asset', root: { entity: { type: 'iot_asset', id: 'b1' } }, direction: 'from', maxLevel: 1, filters: [] },
        { entityNames: { b1: 'Building A' } },
      ),
    ).toBe("Entities related FROM 'Building A'");
  });

  it('entity search query', () => {
    expect(
      text({
        type: 'entitySearchQuery',
        provider: 'iot_asset',
        root: { param: 'site' },
        direction: 'from',
        maxLevel: 1,
        relationType: 'Contains',
        entityType: 'iot_device',
        subtypes: ['Pump'],
      }),
    ).toBe("Devices of device profiles Pump related FROM the page's site by 'contains'");
    expect(
      text({ type: 'entitySearchQuery', provider: 'iot_asset', root: { param: 'site' }, direction: 'to', maxLevel: 4, entityType: 'iot_device' }),
    ).toBe("Devices related TO the page's site (up to 4 levels)");
  });

  it('takes overridden wording and falls back to the key for an unknown entity type', () => {
    expect(text({ type: 'entityType', entityType: 'iot_valve' }, { messages: { textType: (many) => `Every one of ${many}` } })).toBe('Every one of iot_valve');
  });
});
