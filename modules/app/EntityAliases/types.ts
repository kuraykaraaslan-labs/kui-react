// Entity aliases and key filters (next-boilerplate dashboard phase 36, the ThingsBoard model): the data contract shared
// with the server. The blocks between the markers are the contract and are kept verbatim with next-boilerplate
// (`modules/dashboard/server/entity-alias.types.ts`; the key filter block is phase 36.7's spec); change them only
// together with the server.
// Pure: no React, no imports.

// ---- contract (verbatim) ----
export type RelationDirection = 'from' | 'to'
export type AliasRoot = { entity: { type: string; id: string } } | { param: string }
export interface RelationFilter { relationType?: string; entityTypes?: string[]; negate?: boolean }
export type EntityAliasFilter =
  | { type: 'singleEntity'; entityType: string; id: string }
  | { type: 'entityList'; entityType: string; ids: string[] }
  | { type: 'entityName'; entityType: string; namePrefix: string }
  | { type: 'entityType'; entityType: string }
  | { type: 'stateEntity'; entityType: string; param: string }
  | { type: 'entitySubtype'; entityType: string; subtypes: string[]; namePrefix?: string }
  | { type: 'relationsQuery'; provider: string; root: AliasRoot; direction: RelationDirection; maxLevel: number; lastLevelOnly?: boolean; filters: RelationFilter[] }
  | { type: 'entitySearchQuery'; provider: string; root: AliasRoot; direction: RelationDirection; maxLevel: number; lastLevelOnly?: boolean; relationType?: string; entityType: string; subtypes?: string[] }
export type AliasFilterType = EntityAliasFilter['type']
export interface EntityAlias { key: string; name: string; resolveMultiple: boolean; filter: EntityAliasFilter }
export interface EntityRef { type: string; id: string; name: string; label?: string | null; subtype?: string | null }
export interface EntityTypeInfo { key: string; label: string; labelPlural: string; subtypeLabel?: string; hasSubtypes: boolean }
export interface RelationProviderInfo { key: string; label: string; relationTypes: Array<{ value: string; label: string }> }
export interface BoardParamInfo { key: string; label: string; entityType?: string }
export interface AliasPreview {
  total: number
  entities: EntityRef[]
  truncated?: boolean
  /**
   * The parameters (by label) the draft follows that have no value where the host previews it: it matches nothing until they have
   * one, which is no reason to refuse it (a page set by a link). The preview says so instead of "no entity matched".
   */
  waitingFor?: string[]
  /**
   * What a widget that shows one entity gets from the draft, by the host's own run-time rule: an entity (`first` = the first of
   * several by name), or how many it would have to choose from (the widget then asks to pick one).
   */
  single?: { name: string; first?: boolean } | { count: number }
}
/** Host-supplied data access; the kit never fetches by itself. */
export interface EntityAliasesAccess {
  entityTypes(): Promise<EntityTypeInfo[]>
  relationProviders(): Promise<RelationProviderInfo[]>
  subtypes(entityType: string, search: string): Promise<Array<{ value: string; label: string }>>
  searchEntities(entityType: string, search: string): Promise<EntityRef[]>
  entitiesByIds(entityType: string, ids: string[]): Promise<EntityRef[]>
  preview(alias: EntityAlias): Promise<AliasPreview>
  /** The key filter editor's key suggestions for one entity type (fields, attributes, latest telemetry). */
  entityKeys(entityType: string, search: string): Promise<EntityKeyInfo[]>
}
// ---- end of contract ----

// ---- key filter contract (verbatim, next-boilerplate phase 36.7) ----
export type KeyFilterKeyType = 'field' | 'attribute' | 'telemetry'
export type AttributeScope = 'client' | 'shared' | 'server' | 'any'
export type KeyFilterValueType = 'string' | 'number' | 'boolean' | 'datetime'
export type KeyFilterOp =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'notIn' | 'set' | 'unset' | 'true' | 'false'
  | 'startsWith' | 'endsWith' | 'contains' | 'notContains'
export type FilterValue = string | number | boolean | { $param: string }
export interface KeyFilterPredicate { op: KeyFilterOp; value?: FilterValue; to?: FilterValue; values?: string[]; ignoreCase?: boolean }
export interface KeyFilter {
  key: { type: KeyFilterKeyType; name: string; scope?: AttributeScope }
  valueType: KeyFilterValueType
  operation: 'and' | 'or'
  predicates: KeyFilterPredicate[]
}
export interface BoardFilter { key: string; name: string; operation?: 'and' | 'or'; keyFilters: KeyFilter[] }
export interface EntityKeyInfo { type: KeyFilterKeyType; name: string; label: string; valueType: KeyFilterValueType; scope?: AttributeScope }
// ---- end of key filter contract ----

// ---- entity parameter contract (verbatim, next-boilerplate phase 41: `modules/dashboard/server/board-params.ts`) ----
/**
 * What a viewer's pick may be narrowed to (`viewer.within`): entities of some subtypes (a device profile, an asset type),
 * optionally by a name prefix; entities whose name starts with a text; or a fixed list. Absent = any entity of the type.
 */
export type ViewerWithin =
  | { type: 'subtype'; subtypes: string[]; namePrefix?: string }
  | { type: 'name'; namePrefix: string }
  | { type: 'list'; ids: string[] }
/**
 * How an entity parameter's entity is chosen. `viewer`: the viewer picks one of the type (the filter bar), inside
 * `within` when it is narrowed; a pick outside it is refused. `page`: a link,
 * a host or an action sets it (`param`: it is the value of another parameter). `single` / `list`: fixed. `all`, `name`,
 * `subtype`: a set of the type. `related`: the entities related to another parameter's entity or to a fixed one; with
 * `filters` a relations query (it may mix types), without them a search query of the parameter's own type.
 */
export type EntityChoice =
  | { type: 'viewer'; within?: ViewerWithin }
  | { type: 'page'; param?: string }
  | { type: 'single'; id: string }
  | { type: 'list'; ids: string[] }
  | { type: 'all' }
  | { type: 'name'; namePrefix: string }
  | { type: 'subtype'; subtypes: string[]; namePrefix?: string }
  | {
      type: 'related'; provider: string; root: AliasRoot; direction: RelationDirection; maxLevel: number; lastLevelOnly?: boolean
      relationType?: string; subtypes?: string[]; filters?: RelationFilter[]
    }
export type EntityChoiceType = EntityChoice['type']
/** How the filter bar shows a parameter: `edit` (absent) a picker, `readOnly` the value shown, `hidden` nothing. */
export type ParamBarMode = 'edit' | 'readOnly' | 'hidden'
export interface EntityParam {
  kind: 'entity'
  key: string
  label: string
  description?: string
  placeholder?: string
  /** A contributed entity type. Absent only for a relations query (`related` with `filters`), which may mix types. */
  entityType?: string
  choose: EntityChoice
  /** One entity (absent) or every entity of the set. */
  multiple?: boolean
  /** The entity a single parameter starts with, by id (chosen by name in the editor). */
  default?: string
  /** With no value and no default, take the first entity of the set by name. */
  defaultFrom?: 'firstOption'
  viewer?: ParamBarMode
  required?: boolean
}
// ---- end of entity parameter contract ----

/**
 * Another parameter of the board, as an entity parameter's form reads it: what a page choice may follow and a relation may
 * start from. An `EntityParam` is one; a value parameter is `{ key, label, entityType? }`.
 */
export interface ParamPeer {
  key: string
  label: string
  kind?: 'value' | 'entity'
  entityType?: string
  multiple?: boolean
  choose?: EntityChoice
}

/** The filter types that walk a relation graph; offered only when the host has a relation provider. */
export type RelationFilterType = 'relationsQuery' | 'entitySearchQuery'

/** A widget's entity slot (`DataSourceQueryDef.entitySlots[param]`): which entity types it takes and whether a list. */
export interface AliasSlot { entityTypes: string[]; multiple: boolean }

/** One selectable alias in the toolbar entity select. */
export interface AliasEntitySelectItem { aliasKey: string; aliasName: string; current: EntityRef | null }
