// An in-memory EntityAliasesAccess for the kit's tests and the showcase demo: two entity types, one relation provider, a
// handful of entities and the keys the key filter editor suggests, all in memory. Not exported from the barrel.

import type {
  AliasPreview,
  EntityAlias,
  EntityAliasesAccess,
  EntityKeyInfo,
  EntityRef,
  EntityTypeInfo,
  RelationProviderInfo,
} from './types';

export const DEMO_ENTITY_TYPES: EntityTypeInfo[] = [
  { key: 'iot_device', label: 'Device', labelPlural: 'Devices', subtypeLabel: 'Device profiles', hasSubtypes: true },
  { key: 'iot_asset', label: 'Asset', labelPlural: 'Assets', subtypeLabel: 'Asset types', hasSubtypes: true },
];

export const DEMO_PROVIDERS: RelationProviderInfo[] = [
  { key: 'iot_asset', label: 'Asset relations', relationTypes: [{ value: 'Contains', label: 'Contains' }, { value: 'Manages', label: 'Manages' }] },
];

export const DEMO_ENTITIES: EntityRef[] = [
  { type: 'iot_device', id: 'd1', name: 'Pump 1', subtype: 'Pump' },
  { type: 'iot_device', id: 'd2', name: 'Pump 2', subtype: 'Pump' },
  { type: 'iot_device', id: 'd3', name: 'Tank A', subtype: 'Tank' },
  { type: 'iot_asset', id: 'a1', name: 'Building A', subtype: 'Building' },
  { type: 'iot_asset', id: 'a2', name: 'Site North', subtype: 'Site' },
];

/** The keys each demo entity type offers: entity fields, attributes in their scopes and latest telemetry. */
export const DEMO_KEYS: Record<string, EntityKeyInfo[]> = {
  iot_device: [
    { type: 'field', name: 'name', label: 'Name', valueType: 'string' },
    { type: 'field', name: 'label', label: 'Label', valueType: 'string' },
    { type: 'field', name: 'createdTime', label: 'Created time', valueType: 'datetime' },
    { type: 'attribute', name: 'active', label: 'Active', valueType: 'boolean', scope: 'server' },
    { type: 'attribute', name: 'lastActivityTime', label: 'Last activity', valueType: 'datetime', scope: 'server' },
    { type: 'attribute', name: 'firmwareVersion', label: 'Firmware version', valueType: 'string', scope: 'client' },
    { type: 'attribute', name: 'threshold', label: 'Threshold', valueType: 'number', scope: 'shared' },
    { type: 'telemetry', name: 'temperature', label: 'Temperature', valueType: 'number' },
    { type: 'telemetry', name: 'pressure', label: 'Pressure', valueType: 'number' },
    { type: 'telemetry', name: 'status', label: 'Status', valueType: 'string' },
  ],
  iot_asset: [
    { type: 'field', name: 'name', label: 'Name', valueType: 'string' },
    { type: 'field', name: 'createdTime', label: 'Created time', valueType: 'datetime' },
    { type: 'attribute', name: 'address', label: 'Address', valueType: 'string', scope: 'server' },
    { type: 'telemetry', name: 'occupancy', label: 'Occupancy', valueType: 'number' },
  ],
};

const SUBTYPES: Record<string, string[]> = { iot_device: ['Pump', 'Tank'], iot_asset: ['Building', 'Site'] };

export function demoAccess(over: Partial<EntityAliasesAccess> = {}): EntityAliasesAccess {
  const match = (type: string, search: string) =>
    DEMO_ENTITIES.filter((e) => e.type === type && e.name.toLowerCase().includes(search.trim().toLowerCase()));
  return {
    entityTypes: async () => DEMO_ENTITY_TYPES,
    relationProviders: async () => DEMO_PROVIDERS,
    subtypes: async (type, search) =>
      (SUBTYPES[type] ?? []).filter((s) => s.toLowerCase().includes(search.toLowerCase())).map((s) => ({ value: s, label: s })),
    searchEntities: async (type, search) => match(type, search),
    entitiesByIds: async (type, ids) => DEMO_ENTITIES.filter((e) => e.type === type && ids.includes(e.id)),
    preview: async (alias: EntityAlias): Promise<AliasPreview> => {
      const f = alias.filter;
      let entities: EntityRef[] = [];
      if (f.type === 'singleEntity') entities = DEMO_ENTITIES.filter((e) => e.id === f.id);
      else if (f.type === 'entityList') entities = DEMO_ENTITIES.filter((e) => f.ids.includes(e.id));
      else if (f.type === 'entityName') entities = DEMO_ENTITIES.filter((e) => e.type === f.entityType && e.name.startsWith(f.namePrefix));
      else if (f.type === 'entitySubtype') entities = DEMO_ENTITIES.filter((e) => e.type === f.entityType && f.subtypes.includes(e.subtype ?? ''));
      else if (f.type === 'relationsQuery') entities = DEMO_ENTITIES.filter((e) => e.type === 'iot_device');
      else entities = DEMO_ENTITIES.filter((e) => e.type === f.entityType);
      return { total: entities.length, entities: entities.slice(0, 20) };
    },
    entityKeys: async (type, search) => {
      const q = search.trim().toLowerCase();
      return (DEMO_KEYS[type] ?? []).filter((k) => k.name.toLowerCase().includes(q) || k.label.toLowerCase().includes(q));
    },
    ...over,
  };
}
