// Pure helpers around a filter: the defaults when the type changes (ThingsBoard's `filterTypeChanged`), the clean-up
// before a save (TB's alias dialog drops empty and duplicate relation filters), the entity type an alias gives, and
// whether an alias fits a widget's entity slot. No React.

import { validateFilter } from './validate';
import type {
  AliasFilterType,
  AliasRoot,
  AliasSlot,
  BoardParamInfo,
  EntityAlias,
  EntityAliasFilter,
  RelationFilter,
  RelationFilterType,
  RelationProviderInfo,
} from './types';

export function isRelationFilterType(type: AliasFilterType): type is RelationFilterType {
  return type === 'relationsQuery' || type === 'entitySearchQuery';
}

/** TB: picking a type turns "resolve as multiple" on, except for one entity and the page's entity. */
export function defaultResolveMultiple(type: AliasFilterType): boolean {
  return !(type === 'singleEntity' || type === 'stateEntity');
}

/** The entity type a filter gives, or null when it cannot be known without resolving (a relations query). */
export function filterEntityType(filter: EntityAliasFilter | null | undefined): string | null {
  if (!filter || filter.type === 'relationsQuery') return null;
  return filter.entityType || null;
}

function previousEntityType(prev: EntityAliasFilter | null | undefined): string {
  if (!prev) return '';
  if (prev.type === 'relationsQuery') return '';
  return prev.entityType ?? '';
}

export interface EmptyFilterContext {
  providers: readonly RelationProviderInfo[];
  params: readonly BoardParamInfo[];
}

/** A fresh filter of `type`, keeping the entity type (and the relation root) of the previous one where it fits. */
export function emptyFilter(
  type: AliasFilterType,
  prev: EntityAliasFilter | null | undefined,
  { providers }: EmptyFilterContext,
): EntityAliasFilter {
  const entityType = previousEntityType(prev);
  const prevRelation = prev && (prev.type === 'relationsQuery' || prev.type === 'entitySearchQuery') ? prev : null;
  const root: AliasRoot = prevRelation?.root ?? { entity: { type: entityType, id: '' } };
  const provider = providers.length === 1 ? providers[0].key : prevRelation?.provider ?? '';
  switch (type) {
    case 'singleEntity': return { type, entityType, id: '' };
    case 'entityList': return { type, entityType, ids: [] };
    case 'entityName': return { type, entityType, namePrefix: '' };
    case 'entityType': return { type, entityType };
    case 'stateEntity': return { type, entityType, param: '' };
    case 'entitySubtype': return { type, entityType, subtypes: [] };
    case 'relationsQuery': return { type, provider, root, direction: 'from', maxLevel: 1, filters: [] };
    case 'entitySearchQuery': return { type, provider, root, direction: 'from', maxLevel: 1, entityType, subtypes: [] };
  }
}

function cleanRelationFilters(filters: readonly RelationFilter[]): RelationFilter[] {
  const out: RelationFilter[] = [];
  const seen = new Set<string>();
  for (const f of filters) {
    const relationType = f.relationType?.trim() || undefined;
    const entityTypes = f.entityTypes?.length ? [...new Set(f.entityTypes)] : undefined;
    if (!relationType && !entityTypes) continue; // TB: an empty filter matches everything; drop it.
    const negate = f.negate ? true : undefined;
    const id = JSON.stringify([relationType ?? '', entityTypes ?? [], !!negate]);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...(relationType ? { relationType } : {}), ...(entityTypes ? { entityTypes } : {}), ...(negate ? { negate } : {}) });
  }
  return out;
}

/** The filter as it is saved: trimmed, empty optionals dropped, relation filters de-duplicated. */
export function normalizeFilter(filter: EntityAliasFilter): EntityAliasFilter {
  switch (filter.type) {
    case 'entityName':
      return { ...filter, namePrefix: filter.namePrefix.trim() };
    case 'entityList':
      return { ...filter, ids: [...new Set(filter.ids)] };
    case 'entitySubtype': {
      const { namePrefix, ...rest } = filter;
      const prefix = namePrefix?.trim();
      return { ...rest, subtypes: [...new Set(filter.subtypes)], ...(prefix ? { namePrefix: prefix } : {}) };
    }
    case 'relationsQuery': {
      const { lastLevelOnly, ...rest } = filter;
      return { ...rest, filters: cleanRelationFilters(filter.filters ?? []), ...(lastLevelOnly && filter.maxLevel > 1 ? { lastLevelOnly: true } : {}) };
    }
    case 'entitySearchQuery': {
      const { lastLevelOnly, relationType, subtypes, ...rest } = filter;
      const rel = relationType?.trim();
      return {
        ...rest,
        ...(lastLevelOnly && filter.maxLevel > 1 ? { lastLevelOnly: true } : {}),
        ...(rel ? { relationType: rel } : {}),
        ...(subtypes?.length ? { subtypes: [...new Set(subtypes)] } : {}),
      };
    }
    default:
      return filter;
  }
}

/** The alias as it is saved: trimmed name, a single entity never resolves to many, the filter normalised. */
export function normalizeAlias(alias: EntityAlias): EntityAlias {
  return {
    key: alias.key,
    name: alias.name.trim(),
    resolveMultiple: alias.filter.type === 'singleEntity' ? false : alias.resolveMultiple,
    filter: normalizeFilter(alias.filter),
  };
}

/** True when the filter has every field it needs (so it is worth previewing). */
export function isFilterComplete(filter: EntityAliasFilter | null | undefined, params: readonly BoardParamInfo[]): boolean {
  return Object.keys(validateFilter(filter, params)).length === 0;
}

export type AliasCompatibility = { ok: true } | { ok: false; reason: 'entityType'; entityType: string } | { ok: false; reason: 'multiple' };

/**
 * Whether an alias fits a widget's entity slot (E36-4): the entity type it gives must be one the slot takes (an alias
 * whose type is only known after resolving, a relations query, is allowed), and a slot that takes one entity refuses an
 * alias that resolves to many. A multiple slot takes a single-resolve alias (a list of one).
 */
export function aliasCompatibility(alias: EntityAlias, slot: AliasSlot): AliasCompatibility {
  const type = filterEntityType(alias.filter);
  if (type && slot.entityTypes.length > 0 && !slot.entityTypes.includes(type)) {
    return { ok: false, reason: 'entityType', entityType: type };
  }
  if (!slot.multiple && alias.resolveMultiple && alias.filter.type !== 'singleEntity') return { ok: false, reason: 'multiple' };
  return { ok: true };
}
