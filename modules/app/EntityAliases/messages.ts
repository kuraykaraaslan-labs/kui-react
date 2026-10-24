// The texts the EntityAliases kit draws on its own, so a host can show them in its language. Pure: no React, no
// .tsx import (next-boilerplate's server copy may read `entityFilterText` and these). A function takes the values a
// text interpolates. Every component takes `messages?: EntityAliasesMessagesInput` and merges it over the defaults.

import type { AliasFilterType, RelationDirection } from './types';

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
}

export type EntityAliasesMessagesInput = Partial<Omit<EntityAliasesMessages, 'filterTypes' | 'directionOptions'>> & {
  filterTypes?: Partial<Record<AliasFilterType, string>>;
  directionOptions?: Partial<Record<RelationDirection, string>>;
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
};

/** The defaults with a host's overrides on top (the two nested maps merge key by key). */
export function mergeAliasMessages(input?: EntityAliasesMessagesInput): EntityAliasesMessages {
  if (!input) return DEFAULT_ALIAS_MESSAGES;
  const out: Record<string, unknown> = { ...DEFAULT_ALIAS_MESSAGES };
  for (const [k, v] of Object.entries(input)) if (v !== undefined) out[k] = v;
  out.filterTypes = { ...DEFAULT_ALIAS_MESSAGES.filterTypes, ...definedOnly(input.filterTypes) };
  out.directionOptions = { ...DEFAULT_ALIAS_MESSAGES.directionOptions, ...definedOnly(input.directionOptions) };
  return out as unknown as EntityAliasesMessages;
}

function definedOnly<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
