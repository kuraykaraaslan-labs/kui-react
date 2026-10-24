// Entity aliases (next-boilerplate dashboard phase 36, the ThingsBoard model): the data contract shared with the
// server. The block between the two markers is the contract and is kept verbatim with next-boilerplate
// (`modules/dashboard/server/entity-alias.types.ts`); change it only together with the server.
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
export interface AliasPreview { total: number; entities: EntityRef[]; truncated?: boolean }
/** Host-supplied data access; the kit never fetches by itself. */
export interface EntityAliasesAccess {
  entityTypes(): Promise<EntityTypeInfo[]>
  relationProviders(): Promise<RelationProviderInfo[]>
  subtypes(entityType: string, search: string): Promise<Array<{ value: string; label: string }>>
  searchEntities(entityType: string, search: string): Promise<EntityRef[]>
  entitiesByIds(entityType: string, ids: string[]): Promise<EntityRef[]>
  preview(alias: EntityAlias): Promise<AliasPreview>
}
// ---- end of contract ----

/** The filter types that walk a relation graph; offered only when the host has a relation provider. */
export type RelationFilterType = 'relationsQuery' | 'entitySearchQuery'

/** A widget's entity slot (`DataSourceQueryDef.entitySlots[param]`): which entity types it takes and whether a list. */
export interface AliasSlot { entityTypes: string[]; multiple: boolean }

/** One selectable alias in the toolbar entity select. */
export interface AliasEntitySelectItem { aliasKey: string; aliasName: string; current: EntityRef | null }
