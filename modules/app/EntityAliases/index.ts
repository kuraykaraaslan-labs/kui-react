// Entity aliases kit (next-boilerplate dashboard phase 36.4, the ThingsBoard model): the board's alias list, one
// alias's dialog, the entity filter form, the readable filter text, the toolbar entity select and a widget's alias
// picker. Host-agnostic: every read goes through the host's `EntityAliasesAccess`. See README.md.

export { EntityAliasesDialog, aliasRemovalBlockers } from './EntityAliasesDialog';
export type { EntityAliasesDialogProps } from './EntityAliasesDialog';
export { EntityAliasDialog, PREVIEW_KEY, PREVIEW_NAME } from './EntityAliasDialog';
export type { EntityAliasDialogProps } from './EntityAliasDialog';
export { EntityFilterForm } from './EntityFilterForm';
export type { EntityFilterFormProps } from './EntityFilterForm';
export { AliasEntitySelect } from './AliasEntitySelect';
export type { AliasEntitySelectProps } from './AliasEntitySelect';
export { EntityAliasPicker, aliasPickerOptions } from './EntityAliasPicker';
export type { EntityAliasPickerProps } from './EntityAliasPicker';
export { AliasPreviewPanel, useAliasPreview, PREVIEW_DEBOUNCE_MS } from './AliasPreview';
export type { PreviewStatus } from './AliasPreview';
export { entityFilterText } from './filter-text';
export type { FilterTextOptions } from './filter-text';
export {
  aliasCompatibility,
  defaultResolveMultiple,
  emptyFilter,
  filterEntityType,
  isFilterComplete,
  isRelationFilterType,
  normalizeAlias,
  normalizeFilter,
} from './filters';
export type { AliasCompatibility, EmptyFilterContext } from './filters';
export {
  MAX_ALIASES,
  ALIAS_KEY_PATTERN,
  ALIAS_KEY_MAX,
  RESERVED_ALIAS_KEYS,
  ALIAS_NAME_MAX,
  ENTITY_LIST_MAX,
  NAME_PREFIX_MAX,
  SUBTYPES_MAX,
  MAX_RELATION_LEVEL,
  MAX_RELATION_FILTERS,
  ALIAS_FILTER_TYPES,
  isValidAliasKey,
  slugKey,
  validateAlias,
  validateAliases,
  validateFilter,
} from './validate';
export type { AliasErrors, AliasListErrors, ValidateAliasOptions } from './validate';
export { DEFAULT_ALIAS_MESSAGES, mergeAliasMessages } from './messages';
export type { AliasErrorCode, AliasErrorField, EntityAliasesMessages, EntityAliasesMessagesInput } from './messages';
export { loadAliasCatalog, useAliasCatalog } from './useAliasData';
export type { AliasCatalog } from './useAliasData';
export type {
  AliasEntitySelectItem,
  AliasFilterType,
  AliasPreview,
  AliasRoot,
  AliasSlot,
  BoardParamInfo,
  EntityAlias,
  EntityAliasFilter,
  EntityAliasesAccess,
  EntityRef,
  EntityTypeInfo,
  RelationDirection,
  RelationFilter,
  RelationFilterType,
  RelationProviderInfo,
} from './types';
