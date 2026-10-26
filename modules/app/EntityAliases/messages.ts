// The texts the EntityAliases kit draws on its own, so a host can show them in its language. Pure: no React, no
// .tsx import (next-boilerplate's server copy may read `entityFilterText` and these). A function takes the values a
// text interpolates. Every component takes `messages?: EntityAliasesMessagesInput` and merges it over the defaults.

import type {
  AliasFilterType,
  AttributeScope,
  EntityChoiceType,
  KeyFilter,
  KeyFilterKeyType,
  KeyFilterOp,
  KeyFilterValueType,
  ParamBarMode,
  RelationDirection,
} from './types';

/** What `validateAlias` reports, keyed by field. */
export type AliasErrorCode =
  | 'required'
  | 'pattern'
  | 'reserved'
  | 'tooLong'
  | 'duplicate'
  | 'tooMany'
  | 'tooFew'
  | 'range'
  | 'unknownParam'
  | 'singleOnly'
  | 'unknownType';

/** The fields `validateAlias` keys its errors by (`filter.filters.<n>` for one relation filter is not used: the caps are per list). */
export type AliasErrorField =
  | 'key'
  | 'name'
  | 'aliases'
  | 'resolveMultiple'
  | 'filter.type'
  | 'filter.entityType'
  | 'filter.id'
  | 'filter.ids'
  | 'filter.namePrefix'
  | 'filter.subtypes'
  | 'filter.param'
  | 'filter.provider'
  | 'filter.root'
  | 'filter.maxLevel'
  | 'filter.filters';

/** What `validateEntityParam` reports, keyed by field (phase 41). */
export type EntityParamErrorCode =
  | 'required'
  | 'tooLong'
  | 'tooFew'
  | 'tooMany'
  | 'range'
  | 'unknownParam'
  | 'self'
  | 'notOneEntity'
  | 'cycle'
  | 'singleOnly'
  | 'notListed';

/** The fields `validateEntityParam` keys its errors by. */
export type EntityParamErrorField =
  | 'entityType'
  | 'choose.type'
  | 'choose.id'
  | 'choose.ids'
  | 'choose.namePrefix'
  | 'choose.subtypes'
  | 'choose.param'
  | 'choose.provider'
  | 'choose.root'
  | 'choose.maxLevel'
  | 'choose.filters'
  | 'multiple'
  | 'default';

/** What `validateBoardFilter` reports, keyed by field. */
export type FilterErrorCode =
  | 'required'
  | 'pattern'
  | 'reserved'
  | 'tooLong'
  | 'duplicate'
  | 'tooMany'
  | 'tooFew'
  | 'unknownParam'
  | 'unknownType'
  | 'invalidOp'
  | 'invalidValue';

/** The parts of one predicate an error can sit on. */
export type PredicateErrorPart = 'op' | 'value' | 'to' | 'values';

/** The fields `validateKeyFilter` keys its errors by (`predicates.<n>.<part>` for one predicate). */
export type KeyFilterErrorField =
  | 'key.type'
  | 'key.name'
  | 'key.scope'
  | 'valueType'
  | 'operation'
  | 'predicates'
  | `predicates.${number}.${PredicateErrorPart}`;

/** The fields `validateBoardFilter` keys its errors by (`keyFilters.<n>.<field>` for one key filter). */
export type BoardFilterErrorField =
  | 'key'
  | 'name'
  | 'filters'
  | 'operation'
  | 'keyFilters'
  | `keyFilters.${number}.${KeyFilterErrorField}`;

/** What `boardFilterText` hands `textPredicate`: the parts already formatted (values quoted, parameters named). */
export interface PredicateTextParts {
  /** The key as text (`textKey`). */
  key: string;
  op: KeyFilterOp;
  /** `textOps[op]`. */
  opText: string;
  value?: string;
  to?: string;
  values?: string[];
  ignoreCase: boolean;
}

export interface EntityAliasesMessages {
  // ---- aliases dialog (the list) ----
  aliasesTitle: string;
  addAlias: string;
  editAlias: string;
  save: string;
  add: string;
  cancel: string;
  close: string;
  columnName: string;
  columnFilter: string;
  columnResolveMultiple: string;
  editLabel: (name: string) => string;
  removeLabel: (name: string) => string;
  resolveMultipleLabel: (name: string) => string;
  emptyTitle: string;
  emptyDescription: string;
  removeBlockedTitle: string;
  /** Followed by the list of widget titles. */
  removeBlocked: (name: string) => string;
  tooManyAliases: (max: number) => string;
  invalidAliases: string;
  noFilterText: string;

  // ---- alias dialog (one alias) ----
  name: string;
  key: string;
  keyHint: string;
  resolveMultiple: string;
  resolveMultipleHint: string;
  resolveMultipleSingleEntity: string;
  previewTitle: string;
  previewLoading: string;
  previewIncomplete: string;
  previewTotal: (total: number, truncated: boolean) => string;
  previewMore: (count: number) => string;
  noEntityMatched: string;
  previewFailed: string;

  // ---- entity filter form ----
  filterType: string;
  filterTypePlaceholder: string;
  filterTypes: Record<AliasFilterType, string>;
  entityType: string;
  entityTypePlaceholder: string;
  entity: string;
  entityPlaceholder: string;
  entities: string;
  entitiesPlaceholder: string;
  noEntitiesFound: string;
  namePrefix: string;
  namePrefixHint: string;
  namePrefixOptionalHint: string;
  /** The chips' label when the entity type has no `subtypeLabel`. */
  subtypes: string;
  subtypesPlaceholder: string;
  subtypesOptionalHint: string;
  param: string;
  paramPlaceholder: string;
  paramHint: string;
  noParams: string;
  rootTitle: string;
  rootFromPage: string;
  provider: string;
  providerPlaceholder: string;
  queryOptions: string;
  direction: string;
  directionOptions: Record<RelationDirection, string>;
  maxLevel: string;
  maxLevelHint: (max: number) => string;
  lastLevelOnly: string;
  relationFilters: string;
  relationFilter: string;
  addRelationFilter: string;
  removeRelationFilter: (n: number) => string;
  relationType: string;
  anyRelationType: string;
  relationEntityTypes: string;
  anyEntityType: string;
  negate: string;
  negateHint: string;
  noRelationFilters: string;

  // ---- filter text (entityFilterText) ----
  textSingle: (one: string, name?: string) => string;
  textList: (count: number, one: string, many: string) => string;
  textName: (many: string, prefix: string) => string;
  textType: (many: string) => string;
  textState: (one: string, param: string) => string;
  textSubtype: (many: string, subtypeLabel: string | undefined, subtypes: string[], prefix?: string) => string;
  /** `what` is the entities part ("Devices", "Devices (Contains) or not Assets"); `levels` is '' for one level. */
  textRelations: (what: string, direction: RelationDirection, root: string, relationType: string | undefined, levels: string) => string;
  textRelationFilter: (types: string | null, relationType: string | null, negate: boolean) => string;
  textAnyEntities: string;
  textSubtypesOf: (many: string, subtypeLabel: string | undefined, subtypes: string[]) => string;
  textLevels: (maxLevel: number, lastLevelOnly: boolean) => string;
  textRootParam: (label: string) => string;
  textRootEntity: (one: string, name?: string) => string;

  // ---- alias picker (a widget's data tab) ----
  pickerLabel: string;
  pickerPlaceholder: string;
  none: string;
  newAlias: string;
  incompatibleType: (aliasType: string, slotTypes: string) => string;
  incompatibleMultiple: string;

  // ---- toolbar entity select ----
  selectEntities: string;

  // ---- validation ----
  error: (field: AliasErrorField, code: AliasErrorCode) => string;

  // ---- filters dialog (the board's key filters, phase 36.7) ----
  filtersTitle: string;
  addFilter: string;
  editFilter: string;
  columnFilterName: string;
  columnFilterText: string;
  editFilterLabel: (name: string) => string;
  removeFilterLabel: (name: string) => string;
  filtersEmptyTitle: string;
  filtersEmptyDescription: string;
  removeFilterBlockedTitle: string;
  /** Followed by the list of widget titles. */
  removeFilterBlocked: (name: string) => string;
  tooManyFilters: (max: number) => string;
  invalidFilters: string;

  // ---- filter dialog (one filter) ----
  filterName: string;
  filterKeyHint: string;
  keyFilters: string;
  /** The hint under "Key filters", for the filter's operation. */
  keyFiltersHint: (operation: KeyFilter['operation']) => string;
  keyFiltersOperation: string;
  keyFilterTitle: (n: number) => string;
  addKeyFilter: string;
  removeKeyFilter: (n: number) => string;
  noKeyFilters: string;
  filterPreview: string;

  // ---- key filter editor ----
  keyType: string;
  keyTypes: Record<KeyFilterKeyType, string>;
  keyName: string;
  keyNamePlaceholder: string;
  keyNameHint: string;
  /** The description of the typed-in name offered first in the key suggestions. */
  typedKeyName: string;
  noKeysFound: string;
  attributeScope: string;
  attributeScopes: Record<AttributeScope, string>;
  valueType: string;
  valueTypes: Record<KeyFilterValueType, string>;
  operation: string;
  operations: Record<KeyFilter['operation'], string>;
  predicates: string;
  addPredicate: string;
  removePredicate: (n: number) => string;
  noPredicates: string;
  predicateOp: string;
  keyFilterOps: Record<KeyFilterOp, string>;
  predicateValue: string;
  predicateTo: string;
  predicateValues: string;
  predicateValuesPlaceholder: string;
  ignoreCase: string;
  booleanTrue: string;
  booleanFalse: string;
  booleanPlaceholder: string;
  useParam: string;
  useLiteral: string;
  paramValue: string;

  // ---- filter text (boardFilterText) ----
  noKeyFilterText: string;
  textKey: (name: string, type: KeyFilterKeyType, scope?: AttributeScope) => string;
  textOps: Record<KeyFilterOp, string>;
  /** One predicate as text, from parts already formatted. */
  textPredicate: (parts: PredicateTextParts) => string;
  textJoin: Record<KeyFilter['operation'], string>;
  textParamValue: (label: string) => string;
  textTrue: string;
  textFalse: string;
  /** A value or key name that is not filled in yet. */
  textMissing: string;

  // ---- alias picker: the filter next to the alias ----
  pickerFilterLabel: string;

  // ---- filter validation ----
  filterError: (field: BoardFilterErrorField | KeyFilterErrorField, code: FilterErrorCode) => string;

  // ---- entity parameter form (phase 41: a board parameter of the entity kind) ----
  chooseHow: string;
  choiceTypes: Record<EntityChoiceType, string>;
  /** One line under the choice, saying what it does. */
  choiceHints: Record<EntityChoiceType, string>;
  followParam: string;
  followLink: string;
  fixedEntity: string;
  relatedTo: string;
  relatedToEntity: string;
  relationDetails: string;
  matchRelationFilters: string;
  mixedTypesHint: string;
  howMany: string;
  howManyOptions: { one: string; many: string };
  barMode: string;
  barModes: Record<ParamBarMode, string>;
  takeFirst: string;
  takeFirstHint: string;
  defaultEntity: string;
  defaultEntityHint: string;

  // ---- entity parameter validation ----
  paramError: (field: EntityParamErrorField, code: EntityParamErrorCode) => string;

  /** The kui primitives' own texts inside the kit (ComboBox, Select, MultiSelect), so a host translates them with the rest. */
  comboBox: { placeholder: string; noResults: string; clear: string; loading: string; loadingMore: string };
  select: { noResults: string; search: string; placeholder: string; required: string };
  /** `remove` takes `{label}`, the option's label. */
  multiSelect: { noResults: string; search: string; remove: string; loadingMore: string };
}

/** The message maps a host may override key by key. */
const NESTED_KEYS = [
  'filterTypes',
  'directionOptions',
  'keyTypes',
  'attributeScopes',
  'valueTypes',
  'operations',
  'keyFilterOps',
  'textOps',
  'textJoin',
  'choiceTypes',
  'choiceHints',
  'howManyOptions',
  'barModes',
  'comboBox',
  'select',
  'multiSelect',
] as const;
type NestedKey = (typeof NESTED_KEYS)[number];

export type EntityAliasesMessagesInput = Partial<Omit<EntityAliasesMessages, NestedKey>> & {
  [K in NestedKey]?: Partial<EntityAliasesMessages[K]>;
};

const lower = (s: string) => s.toLowerCase();
const quoteList = (items: string[]) => items.join(', ');

const FIELD_NAMES: Record<AliasErrorField, string> = {
  key: 'Key',
  name: 'Alias name',
  aliases: 'Aliases',
  resolveMultiple: 'Resolve as multiple entities',
  'filter.type': 'Filter type',
  'filter.entityType': 'Entity type',
  'filter.id': 'Entity',
  'filter.ids': 'Entities',
  'filter.namePrefix': 'Name starts with',
  'filter.subtypes': 'Types',
  'filter.param': 'Board parameter',
  'filter.provider': 'Relation source',
  'filter.root': 'Root entity',
  'filter.maxLevel': 'Max relation level',
  'filter.filters': 'Relation filters',
};

/** The English text of a validation error; a host overrides `error` to translate. Caps match `validate.ts`. */
function defaultError(field: AliasErrorField, code: AliasErrorCode): string {
  switch (`${field}:${code}`) {
    case 'key:pattern': return 'A key starts with a lower-case letter and has at most 40 letters, digits or underscores.';
    case 'key:reserved': return 'This key is reserved.';
    case 'key:duplicate': return 'Another alias already has this key.';
    case 'name:tooLong': return 'At most 80 characters.';
    case 'name:duplicate': return 'Another alias on this board already has this name.';
    case 'aliases:tooMany': return 'A board holds at most 32 aliases.';
    case 'resolveMultiple:singleOnly': return 'A single entity always resolves to one.';
    case 'filter.type:unknownType': return 'Unknown filter type.';
    case 'filter.ids:tooFew': return 'Select at least one entity.';
    case 'filter.ids:tooMany': return 'At most 100 entities.';
    case 'filter.namePrefix:tooLong': return 'At most 120 characters.';
    case 'filter.subtypes:tooFew': return 'Select at least one type.';
    case 'filter.subtypes:tooMany': return 'At most 50 types.';
    case 'filter.param:unknownParam':
    case 'filter.root:unknownParam': return 'This board has no such parameter.';
    case 'filter.maxLevel:range': return 'A whole number from 1 to 10.';
    case 'filter.filters:tooMany': return 'At most 8 relation filters.';
  }
  if (code === 'required') return `${FIELD_NAMES[field]} is required.`;
  return `${FIELD_NAMES[field]} is not valid.`;
}

const PARAM_FIELD_NAMES: Record<EntityParamErrorField, string> = {
  entityType: 'Entity type',
  'choose.type': 'How it is chosen',
  'choose.id': 'Entity',
  'choose.ids': 'Entities',
  'choose.namePrefix': 'Name starts with',
  'choose.subtypes': 'Types',
  'choose.param': 'Taken from',
  'choose.provider': 'Relation source',
  'choose.root': 'Related to',
  'choose.maxLevel': 'Max relation level',
  'choose.filters': 'Relation filters',
  multiple: 'One or many',
  default: 'Default entity',
};

/** The English text of an entity parameter error; a host overrides `paramError` to translate. Caps match `entity-params.ts`. */
function defaultParamError(field: EntityParamErrorField, code: EntityParamErrorCode): string {
  switch (`${field}:${code}`) {
    case 'entityType:required': return 'Pick an entity type.';
    case 'choose.id:required': return 'Search for the entity by name and pick it.';
    case 'choose.ids:tooFew': return 'Pick at least one entity.';
    case 'choose.ids:tooMany': return 'At most 100 entities.';
    case 'choose.namePrefix:required': return 'Type how the names start.';
    case 'choose.namePrefix:tooLong': return 'At most 120 characters.';
    case 'choose.subtypes:tooFew': return 'Pick at least one type.';
    case 'choose.subtypes:tooMany': return 'At most 50 types.';
    case 'choose.param:unknownParam':
    case 'choose.root:unknownParam': return 'This board has no such parameter.';
    case 'choose.param:self':
    case 'choose.root:self': return 'A parameter cannot take its entity from itself.';
    case 'choose.param:notOneEntity': return 'It can follow a parameter of one entity only.';
    case 'choose.root:notOneEntity': return 'A relation starts from one entity of a known type: pick a parameter of one entity.';
    case 'choose.param:cycle':
    case 'choose.root:cycle': return 'The parameters it follows lead back to it.';
    case 'choose.provider:required': return 'Pick where the relations come from.';
    case 'choose.root:required': return 'Pick what it is related to.';
    case 'choose.maxLevel:range': return 'A whole number from 1 to 10.';
    case 'choose.filters:tooMany': return 'At most 8 relation filters.';
    case 'multiple:singleOnly': return 'One fixed entity is always one.';
    case 'default:notListed': return 'The default must be one of the listed entities.';
  }
  if (code === 'required') return `${PARAM_FIELD_NAMES[field]} is required.`;
  return `${PARAM_FIELD_NAMES[field]} is not valid.`;
}

const FILTER_FIELD_NAMES: Record<string, string> = {
  key: 'Key',
  name: 'Filter name',
  filters: 'Filters',
  keyFilters: 'Key filters',
  'key.type': 'Key type',
  'key.name': 'Key name',
  'key.scope': 'Attribute scope',
  valueType: 'Value type',
  operation: 'Operation',
  predicates: 'Conditions',
  op: 'Operation',
  value: 'Value',
  to: 'To',
  values: 'Values',
};

/** The English text of a filter validation error; a host overrides `filterError` to translate. Caps match `validate-filters.ts`. */
function defaultFilterError(field: BoardFilterErrorField | KeyFilterErrorField, code: FilterErrorCode): string {
  // `keyFilters.0.predicates.1.value` → `value`: the text depends on the last part only.
  const part = field.replace(/^keyFilters\.\d+\./, '').replace(/^predicates\.\d+\./, '');
  switch (`${part}:${code}`) {
    case 'key:pattern': return 'A key starts with a lower-case letter and has at most 40 letters, digits or underscores.';
    case 'key:reserved': return 'This key is reserved.';
    case 'key:duplicate': return 'Another filter already has this key.';
    case 'name:tooLong': return 'At most 80 characters.';
    case 'name:duplicate': return 'Another filter on this board already has this name.';
    case 'filters:tooMany': return 'A board holds at most 16 filters.';
    case 'keyFilters:tooFew': return 'Add at least one key filter.';
    case 'keyFilters:tooMany': return 'At most 8 key filters.';
    case 'key.name:tooLong': return 'At most 200 characters.';
    case 'predicates:tooFew': return 'Add at least one condition.';
    case 'predicates:tooMany': return 'At most 4 conditions.';
    case 'op:invalidOp': return 'This operation does not apply to this value type.';
    case 'value:required':
    case 'to:required': return 'A value is required.';
    case 'value:tooLong':
    case 'to:tooLong': return 'At most 200 characters.';
    case 'value:invalidValue':
    case 'to:invalidValue': return 'Not a valid value for this value type.';
    case 'value:unknownParam':
    case 'to:unknownParam': return 'This board has no such parameter.';
    case 'values:tooFew': return 'Add at least one value.';
    case 'values:tooMany': return 'At most 50 values.';
    case 'values:tooLong': return 'Each value has at most 200 characters.';
    case 'values:invalidValue': return 'Every value must be a number.';
  }
  const name = FILTER_FIELD_NAMES[part] ?? part;
  if (code === 'required') return `${name} is required.`;
  if (code === 'unknownType') return `${name} is not one of the known values.`;
  return `${name} is not valid.`;
}

const SCOPE_TEXT: Record<AttributeScope, string> = {
  any: 'attribute',
  client: 'client attribute',
  shared: 'shared attribute',
  server: 'server attribute',
};

export const DEFAULT_ALIAS_MESSAGES: EntityAliasesMessages = {
  aliasesTitle: 'Entity aliases',
  addAlias: 'Add alias',
  editAlias: 'Edit alias',
  save: 'Save',
  add: 'Add',
  cancel: 'Cancel',
  close: 'Close',
  columnName: 'Alias name',
  columnFilter: 'Entity filter',
  columnResolveMultiple: 'Resolve as multiple entities',
  editLabel: (name) => `Edit alias ${name}`,
  removeLabel: (name) => `Remove alias ${name}`,
  resolveMultipleLabel: (name) => `Resolve ${name} as multiple entities`,
  emptyTitle: 'No aliases yet',
  emptyDescription: 'An alias is a named entity filter that every widget on every page of this board can use.',
  removeBlockedTitle: 'Unable to delete entity alias',
  removeBlocked: (name) => `Alias '${name}' can't be deleted as it is used by the following widgets:`,
  tooManyAliases: (max) => `A board holds at most ${max} aliases.`,
  invalidAliases: 'Some aliases are not valid. Edit the ones marked below before saving.',
  noFilterText: 'No entity filter specified',

  name: 'Alias name',
  key: 'Key',
  keyHint: 'Widgets refer to the alias by this key. It is derived from the name and does not change once the alias is added.',
  resolveMultiple: 'Resolve as multiple entities',
  resolveMultipleHint:
    'On: widgets show data from every matching entity at once. Off: widgets show one entity, and viewers can switch it from the toolbar.',
  resolveMultipleSingleEntity: 'A single entity always resolves to one.',
  previewTitle: 'Preview',
  previewLoading: 'Checking the filter…',
  previewIncomplete: 'Complete the filter to see which entities it matches.',
  previewTotal: (total, truncated) => `${total}${truncated ? '+' : ''} ${total === 1 ? 'entity' : 'entities'} matched`,
  previewMore: (count) => `and ${count} more`,
  noEntityMatched: 'No entities matching the filter were found.',
  previewFailed: 'The filter could not be checked. You can still save it.',

  filterType: 'Filter type',
  filterTypePlaceholder: 'Select a filter type',
  filterTypes: {
    singleEntity: 'Single entity',
    entityList: 'Entity list',
    entityName: 'Entity name',
    entityType: 'Entity type',
    stateEntity: 'Entity from the page',
    entitySubtype: 'Entity subtype',
    relationsQuery: 'Relations query',
    entitySearchQuery: 'Entity search query',
  },
  entityType: 'Entity type',
  entityTypePlaceholder: 'Select an entity type',
  entity: 'Entity',
  entityPlaceholder: 'Search entities…',
  entities: 'Entities',
  entitiesPlaceholder: 'Select entities',
  noEntitiesFound: 'No entities found.',
  namePrefix: 'Name starts with',
  namePrefixHint: 'Entities whose name starts with this text.',
  namePrefixOptionalHint: 'Optional: only entities whose name starts with this text.',
  subtypes: 'Types',
  subtypesPlaceholder: 'Select types',
  subtypesOptionalHint: 'Optional: none selected means every type.',
  param: 'Board parameter',
  paramPlaceholder: 'Select a parameter',
  paramHint: 'The entity is read from this parameter of the page; its default is the default entity.',
  noParams: 'This board has no parameters yet. Add one in the board settings first.',
  rootTitle: 'Root entity',
  rootFromPage: "Use the page's entity",
  provider: 'Relation source',
  providerPlaceholder: 'Select a relation source',
  queryOptions: 'Query options',
  direction: 'Direction',
  directionOptions: { from: 'From the root', to: 'To the root' },
  maxLevel: 'Max relation level',
  maxLevelHint: (max) => `1 to ${max}.`,
  lastLevelOnly: 'Fetch last level only',
  relationFilters: 'Relation filters',
  relationFilter: 'Relation filter',
  addRelationFilter: 'Add relation filter',
  removeRelationFilter: (n) => `Remove relation filter ${n}`,
  relationType: 'Relation type',
  anyRelationType: 'Any type',
  relationEntityTypes: 'Entity types',
  anyEntityType: 'Any entity type',
  negate: 'NOT',
  negateHint: 'Exclude what this filter matches',
  noRelationFilters: 'No relation filters: every related entity matches.',

  textSingle: (one, name) => (name ? `${one} '${name}'` : `One ${lower(one)}`),
  textList: (count, one, many) => (count === 1 ? `One ${lower(one)}` : `List of ${count} ${lower(many)}`),
  textName: (many, prefix) => `${many} whose name starts with '${prefix}'`,
  textType: (many) => `All ${lower(many)}`,
  textState: (one, param) => `${one} from the page parameter '${param}'`,
  textSubtype: (many, subtypeLabel, subtypes, prefix) =>
    `${many} of ${subtypeLabel ? lower(subtypeLabel) : 'types'} ${quoteList(subtypes)}` +
    (prefix ? ` whose name starts with '${prefix}'` : ''),
  textRelations: (what, direction, root, relationType, levels) =>
    `${what} related ${direction === 'from' ? 'FROM' : 'TO'} ${root}` +
    (relationType ? ` by '${relationType}'` : '') +
    (levels ? ` (${levels})` : ''),
  textRelationFilter: (types, relationType, negate) =>
    `${negate ? 'not ' : ''}${types ?? 'entities'}${relationType ? ` (${relationType})` : ''}`,
  textAnyEntities: 'Entities',
  textSubtypesOf: (many, subtypeLabel, subtypes) =>
    subtypes.length ? `${many} of ${subtypeLabel ? lower(subtypeLabel) : 'types'} ${quoteList(subtypes)}` : many,
  textLevels: (maxLevel, lastLevelOnly) =>
    maxLevel <= 1 ? '' : lastLevelOnly ? `level ${maxLevel} only` : `up to ${maxLevel} levels`,
  textRootParam: (label) => `the page's ${label}`,
  textRootEntity: (one, name) => (name ? `'${name}'` : `a fixed ${lower(one)}`),

  pickerLabel: 'Entity alias',
  pickerPlaceholder: 'Select an alias',
  none: 'None',
  newAlias: 'New alias',
  incompatibleType: (aliasType, slotTypes) => `Gives ${aliasType}; this slot takes ${slotTypes}`,
  incompatibleMultiple: 'Resolves to many entities; this slot takes one',

  selectEntities: 'Select entities',

  error: defaultError,

  filtersTitle: 'Filters',
  addFilter: 'Add filter',
  editFilter: 'Edit filter',
  columnFilterName: 'Filter name',
  columnFilterText: 'Filter',
  editFilterLabel: (name) => `Edit filter ${name}`,
  removeFilterLabel: (name) => `Remove filter ${name}`,
  filtersEmptyTitle: 'No filters yet',
  filtersEmptyDescription:
    "A filter keeps the entities of an alias whose fields, attributes or latest telemetry match. A widget picks it next to the alias.",
  removeFilterBlockedTitle: 'Unable to delete filter',
  removeFilterBlocked: (name) => `Filter '${name}' can't be deleted as it is used by the following widgets:`,
  tooManyFilters: (max) => `A board holds at most ${max} filters.`,
  invalidFilters: 'Some filters are not valid. Edit the ones marked below before saving.',

  filterName: 'Filter name',
  filterKeyHint: 'Widgets refer to the filter by this key. It is derived from the name and does not change once the filter is added.',
  keyFilters: 'Key filters',
  keyFiltersHint: (operation) =>
    operation === 'or'
      ? 'An entity passes the filter when any key filter matches.'
      : 'An entity passes the filter when every key filter matches.',
  keyFiltersOperation: 'Key filters are joined by',
  keyFilterTitle: (n) => `Key filter ${n}`,
  addKeyFilter: 'Add key filter',
  removeKeyFilter: (n) => `Remove key filter ${n}`,
  noKeyFilters: 'No key filters configured.',
  filterPreview: 'Filter preview',

  keyType: 'Key type',
  keyTypes: { field: 'Entity field', attribute: 'Attribute', telemetry: 'Latest telemetry' },
  keyName: 'Key name',
  keyNamePlaceholder: 'Search or type a key…',
  keyNameHint: 'The name of the entity field, attribute or telemetry key.',
  typedKeyName: 'Use this name',
  noKeysFound: 'No keys found.',
  attributeScope: 'Attribute scope',
  attributeScopes: { any: 'Any scope', client: 'Client', shared: 'Shared', server: 'Server' },
  valueType: 'Value type',
  valueTypes: { string: 'Text', number: 'Number', boolean: 'Boolean', datetime: 'Date and time' },
  operation: 'Conditions are joined by',
  operations: { and: 'And: all of them match', or: 'Or: any of them matches' },
  predicates: 'Conditions',
  addPredicate: 'Add condition',
  removePredicate: (n) => `Remove condition ${n}`,
  noPredicates: 'No conditions configured.',
  predicateOp: 'Operation',
  keyFilterOps: {
    eq: 'Equal',
    ne: 'Not equal',
    gt: 'Greater than',
    gte: 'Greater or equal',
    lt: 'Less than',
    lte: 'Less or equal',
    between: 'Between',
    in: 'In',
    notIn: 'Not in',
    set: 'Is set',
    unset: 'Is not set',
    true: 'Is true',
    false: 'Is false',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    contains: 'Contains',
    notContains: 'Does not contain',
  },
  predicateValue: 'Value',
  predicateTo: 'To',
  predicateValues: 'Values',
  predicateValuesPlaceholder: 'Type a value and press Enter',
  ignoreCase: 'Ignore case',
  booleanTrue: 'True',
  booleanFalse: 'False',
  booleanPlaceholder: 'Select a value',
  useParam: 'Use a dashboard parameter',
  useLiteral: 'Use a fixed value',
  paramValue: 'Dashboard parameter',

  noKeyFilterText: 'No filter specified',
  textKey: (name, type, scope) =>
    type === 'telemetry' ? `${name} (latest)` : type === 'attribute' ? `${name} (${SCOPE_TEXT[scope ?? 'any']})` : name,
  textOps: {
    eq: '=',
    ne: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    between: 'between',
    in: 'in',
    notIn: 'not in',
    set: 'is set',
    unset: 'is not set',
    true: 'is true',
    false: 'is false',
    startsWith: 'starts with',
    endsWith: 'ends with',
    contains: 'contains',
    notContains: 'does not contain',
  },
  textPredicate: ({ key, opText, op, value, to, values, ignoreCase }) => {
    let text: string;
    if (op === 'between') text = `${key} ${opText} ${value} and ${to}`;
    else if (op === 'in' || op === 'notIn') text = `${key} ${opText} (${(values ?? []).join(', ')})`;
    else if (value === undefined) text = `${key} ${opText}`;
    else text = `${key} ${opText} ${value}`;
    return ignoreCase ? `${text} (ignore case)` : text;
  },
  textJoin: { and: 'and', or: 'or' },
  textParamValue: (label) => `the dashboard's ${label}`,
  textTrue: 'true',
  textFalse: 'false',
  textMissing: '?',

  pickerFilterLabel: 'Filter',

  filterError: defaultFilterError,

  chooseHow: 'How is it chosen',
  choiceTypes: {
    viewer: 'The viewer picks',
    page: 'The page or a link sets it',
    single: 'Fixed: one entity',
    list: 'Fixed: a list',
    all: 'All of the type',
    name: 'By name',
    subtype: 'By subtype or profile',
    related: 'Related to another parameter or entity',
  },
  choiceHints: {
    viewer: 'Viewers pick in the filter bar by typing a name.',
    page: 'Not in the filter bar: a link, a page or a button sets it, or it follows another parameter.',
    single: 'Always this entity.',
    list: 'Always these entities.',
    all: 'Every entity of the type the viewer may see.',
    name: 'The entities whose name starts with a text.',
    subtype: 'The entities of some subtypes (device profiles, asset types).',
    related: "The entities related to another parameter's entity or to a fixed one.",
  },
  followParam: 'Taken from',
  followLink: 'A link, a page or a button',
  fixedEntity: 'Entity',
  relatedTo: 'Related to',
  relatedToEntity: 'A fixed entity',
  relationDetails: 'Relation details',
  matchRelationFilters: 'Match relation filters instead (may mix entity types)',
  mixedTypesHint: 'The relation filters decide which entity types it holds.',
  howMany: 'One or many',
  howManyOptions: { one: 'One entity', many: 'Many entities' },
  barMode: 'In the filter bar',
  barModes: { edit: 'Shown, viewers can change it', readOnly: 'Shown, not changeable', hidden: 'Hidden' },
  takeFirst: 'With no value, take the first',
  takeFirstHint: 'The first entity by name, until a viewer or a link picks one.',
  defaultEntity: 'Default entity',
  defaultEntityHint: 'Search by name. Leave it empty for none.',
  paramError: defaultParamError,

  // Literal copies of the primitives' English defaults (this file imports no .tsx): DEFAULT_COMBOBOX_MESSAGES,
  // DEFAULT_SELECT_MESSAGES, DEFAULT_MULTI_SELECT_MESSAGES.
  comboBox: { placeholder: 'Search or select...', noResults: 'No results found.', clear: 'Clear selection', loading: 'Loading…', loadingMore: 'Loading more…' },
  select: { noResults: 'No results found.', search: 'Search…', placeholder: 'Select…', required: '(required)' },
  multiSelect: { noResults: 'No results found.', search: 'Search…', remove: 'Remove {label}', loadingMore: 'Loading more…' },
};

/** The defaults with a host's overrides on top (the nested maps, `filterTypes`, `keyFilterOps` …, merge key by key). */
export function mergeAliasMessages(input?: EntityAliasesMessagesInput): EntityAliasesMessages {
  if (!input) return DEFAULT_ALIAS_MESSAGES;
  const out: Record<string, unknown> = { ...DEFAULT_ALIAS_MESSAGES };
  for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v;
  for (const k of NESTED_KEYS) out[k] = { ...DEFAULT_ALIAS_MESSAGES[k], ...definedOnly(input[k] as object | undefined) };
  return out as unknown as EntityAliasesMessages;
}

function definedOnly<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
