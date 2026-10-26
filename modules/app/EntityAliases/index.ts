// Entity aliases kit (next-boilerplate dashboard phases 36.4 and 36.7, the ThingsBoard model): the board's alias list,
// one alias's dialog, the entity filter form, the readable filter text, the toolbar entity select, a widget's alias
// picker, the board's key filters (filters dialog, filter dialog, key filter editor, filter text, validator), and the
// fields of an entity parameter (phase 41: how its entity is chosen, its caps and clean-up).
// Host-agnostic: every read goes through the host's `EntityAliasesAccess`. See README.md.

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
export { BoardFiltersDialog, filterRemovalBlockers } from './BoardFiltersDialog';
export type { BoardFiltersDialogProps } from './BoardFiltersDialog';
export { BoardFilterDialog } from './BoardFilterDialog';
export type { BoardFilterDialogProps } from './BoardFilterDialog';
export { KeyFilterEditor, keyFitsSelection, keyNameOptions } from './KeyFilterEditor';
export type { KeyFilterEditorProps } from './KeyFilterEditor';
export { boardFilterText, keyFilterText, defaultFormatDateTime } from './board-filter-text';
export type { BoardFilterTextOptions } from './board-filter-text';
export {
  ALL_KEY_FILTER_OPS,
  ATTRIBUTE_SCOPES,
  KEY_FILTER_KEY_TYPES,
  KEY_FILTER_OPERATIONS,
  KEY_FILTER_OPS,
  KEY_FILTER_VALUE_TYPES,
  emptyKeyFilter,
  emptyPredicate,
  filterParamKeys,
  isOpValidFor,
  isParamValue,
  normalizeBoardFilter,
  normalizeKeyFilter,
  normalizePredicate,
  predicateShape,
  takesIgnoreCase,
  withValueType,
} from './key-filters';
export type { PredicateShape } from './key-filters';
export {
  MAX_BOARD_FILTERS,
  MAX_KEY_FILTERS,
  MAX_PREDICATES,
  MAX_FILTER_VALUES,
  FILTER_STRING_MAX,
  BOARD_FILTER_NAME_MAX,
  checkFilterValue,
  keyFilterErrorsAt,
  validateBoardFilter,
  validateBoardFilters,
  validateKeyFilter,
} from './validate-filters';
export type { BoardFilterErrors, BoardFilterListErrors, KeyFilterErrors, ValidateBoardFilterOptions } from './validate-filters';
export { EntityParamFields } from './EntityParamFields';
export type { EntityParamFieldsProps } from './EntityParamFields';
export {
  ENTITY_CHOICE_TYPES,
  PARAM_BAR_MODES,
  barModesFor,
  choiceTakesMany,
  emptyChoice,
  fitChoice,
  isMixedRelated,
  normalizeEntityParam,
  paramKeyFromLabel,
  paramSource,
  peerFits,
  takesDefault,
  takesFirst,
  validateEntityParam,
  withChoice,
  withEntityType,
} from './entity-params';
export type { EmptyChoiceContext, EntityParamErrors } from './entity-params';
export { DEFAULT_ALIAS_MESSAGES, mergeAliasMessages } from './messages';
export type {
  AliasErrorCode,
  AliasErrorField,
  BoardFilterErrorField,
  EntityParamErrorCode,
  EntityParamErrorField,
  EntityAliasesMessages,
  EntityAliasesMessagesInput,
  FilterErrorCode,
  KeyFilterErrorField,
  PredicateErrorPart,
  PredicateTextParts,
} from './messages';
export { loadAliasCatalog, useAliasCatalog } from './useAliasData';
export type { AliasCatalog } from './useAliasData';
export type {
  AliasEntitySelectItem,
  AliasFilterType,
  AliasPreview,
  AliasRoot,
  AliasSlot,
  AttributeScope,
  BoardFilter,
  BoardParamInfo,
  EntityAlias,
  EntityAliasFilter,
  EntityAliasesAccess,
  EntityChoice,
  EntityChoiceType,
  EntityKeyInfo,
  EntityParam,
  EntityRef,
  EntityTypeInfo,
  FilterValue,
  KeyFilter,
  KeyFilterKeyType,
  KeyFilterOp,
  KeyFilterPredicate,
  KeyFilterValueType,
  ParamBarMode,
  ParamPeer,
  RelationDirection,
  RelationFilter,
  RelationFilterType,
  RelationProviderInfo,
} from './types';
