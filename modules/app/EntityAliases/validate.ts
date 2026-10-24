// The alias caps (next-boilerplate dashboard phase 36, E36-1 and E36-8), mirrored for the editor so it can say what is
// wrong before the server refuses it with a 422. Pure: no React. The server's zod schemas stay the authority.

import type { AliasErrorCode, AliasErrorField } from './messages';
import type { AliasFilterType, AliasRoot, BoardParamInfo, EntityAlias, EntityAliasFilter } from './types';

export const MAX_ALIASES = 32;
export const ALIAS_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
export const ALIAS_KEY_MAX = 40;
export const RESERVED_ALIAS_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];
export const ALIAS_NAME_MAX = 80;
export const ENTITY_LIST_MAX = 100;
export const NAME_PREFIX_MAX = 120;
export const SUBTYPES_MAX = 50;
export const MAX_RELATION_LEVEL = 10;
export const MAX_RELATION_FILTERS = 8;

export const ALIAS_FILTER_TYPES: readonly AliasFilterType[] = [
  'singleEntity',
  'entityList',
  'entityName',
  'entityType',
  'stateEntity',
  'entitySubtype',
  'relationsQuery',
  'entitySearchQuery',
];

/** Field → error code. Empty when the alias is valid. */
export type AliasErrors = Partial<Record<AliasErrorField, AliasErrorCode>>;

export interface ValidateAliasOptions {
  /** Keys of the board's OTHER aliases (leave the one being validated out). */
  existingKeys: readonly string[];
  /** Names of the board's other aliases; when given, the name must differ from each (case-insensitive). */
  existingNames?: readonly string[];
  /** The board's params: `stateEntity.param` and a param root must name one of them. */
  params: readonly BoardParamInfo[];
}

export function isValidAliasKey(key: string): boolean {
  return ALIAS_KEY_PATTERN.test(key) && !RESERVED_ALIAS_KEYS.includes(key);
}

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === '';

function checkRoot(root: AliasRoot | undefined, params: readonly BoardParamInfo[]): AliasErrorCode | undefined {
  if (!root || typeof root !== 'object') return 'required';
  if ('param' in root) {
    if (blank(root.param)) return 'required';
    return params.some((p) => p.key === root.param) ? undefined : 'unknownParam';
  }
  if (!root.entity || blank(root.entity.type) || blank(root.entity.id)) return 'required';
  return undefined;
}

function checkMaxLevel(maxLevel: unknown): AliasErrorCode | undefined {
  return typeof maxLevel === 'number' && Number.isInteger(maxLevel) && maxLevel >= 1 && maxLevel <= MAX_RELATION_LEVEL
    ? undefined
    : 'range';
}

/** The filter's own errors, keyed `filter.*`. */
export function validateFilter(filter: EntityAliasFilter | null | undefined, params: readonly BoardParamInfo[]): AliasErrors {
  const errors: AliasErrors = {};
  if (!filter || typeof filter !== 'object' || !filter.type) {
    errors['filter.type'] = 'required';
    return errors;
  }
  if (!ALIAS_FILTER_TYPES.includes(filter.type)) {
    errors['filter.type'] = 'unknownType';
    return errors;
  }
  if (filter.type !== 'relationsQuery' && blank(filter.entityType)) errors['filter.entityType'] = 'required';

  switch (filter.type) {
    case 'singleEntity':
      if (blank(filter.id)) errors['filter.id'] = 'required';
      break;
    case 'entityList': {
      const n = Array.isArray(filter.ids) ? filter.ids.length : 0;
      if (n < 1) errors['filter.ids'] = 'tooFew';
      else if (n > ENTITY_LIST_MAX) errors['filter.ids'] = 'tooMany';
      break;
    }
    case 'entityName':
      if (blank(filter.namePrefix)) errors['filter.namePrefix'] = 'required';
      else if (filter.namePrefix.trim().length > NAME_PREFIX_MAX) errors['filter.namePrefix'] = 'tooLong';
      break;
    case 'entityType':
      break;
    case 'stateEntity':
      if (blank(filter.param)) errors['filter.param'] = 'required';
      else if (!params.some((p) => p.key === filter.param)) errors['filter.param'] = 'unknownParam';
      break;
    case 'entitySubtype': {
      const n = Array.isArray(filter.subtypes) ? filter.subtypes.length : 0;
      if (n < 1) errors['filter.subtypes'] = 'tooFew';
      else if (n > SUBTYPES_MAX) errors['filter.subtypes'] = 'tooMany';
      if (typeof filter.namePrefix === 'string' && filter.namePrefix.trim().length > NAME_PREFIX_MAX) {
        errors['filter.namePrefix'] = 'tooLong';
      }
      break;
    }
    case 'relationsQuery':
    case 'entitySearchQuery': {
      if (blank(filter.provider)) errors['filter.provider'] = 'required';
      const root = checkRoot(filter.root, params);
      if (root) errors['filter.root'] = root;
      const level = checkMaxLevel(filter.maxLevel);
      if (level) errors['filter.maxLevel'] = level;
      if (filter.type === 'relationsQuery') {
        if (Array.isArray(filter.filters) && filter.filters.length > MAX_RELATION_FILTERS) errors['filter.filters'] = 'tooMany';
      } else if (Array.isArray(filter.subtypes) && filter.subtypes.length > SUBTYPES_MAX) {
        errors['filter.subtypes'] = 'tooMany';
      }
      break;
    }
  }
  return errors;
}

/** Every error of one alias, keyed by field (`key`, `name`, `aliases`, `resolveMultiple`, `filter.*`). */
export function validateAlias(alias: EntityAlias, { existingKeys, existingNames, params }: ValidateAliasOptions): AliasErrors {
  const errors: AliasErrors = {};

  const key = typeof alias.key === 'string' ? alias.key : '';
  if (!key) errors.key = 'required';
  else if (RESERVED_ALIAS_KEYS.includes(key)) errors.key = 'reserved';
  else if (!ALIAS_KEY_PATTERN.test(key)) errors.key = 'pattern';
  else if (existingKeys.includes(key)) errors.key = 'duplicate';

  if (existingKeys.length >= MAX_ALIASES) errors.aliases = 'tooMany';

  const name = typeof alias.name === 'string' ? alias.name.trim() : '';
  if (!name) errors.name = 'required';
  else if (name.length > ALIAS_NAME_MAX) errors.name = 'tooLong';
  else if (existingNames?.some((n) => n.trim().toLowerCase() === name.toLowerCase())) errors.name = 'duplicate';

  if (alias.filter?.type === 'singleEntity' && alias.resolveMultiple) errors.resolveMultiple = 'singleOnly';

  return { ...errors, ...validateFilter(alias.filter, params) };
}

export interface AliasListErrors {
  /** `tooMany` when the list is longer than `MAX_ALIASES`. */
  aliases?: AliasErrorCode;
  /** One entry per alias, in order (an alias's own errors, its key and name checked against every other alias). */
  byIndex: AliasErrors[];
  valid: boolean;
}

/** The whole list, as the aliases dialog saves it. */
export function validateAliases(aliases: readonly EntityAlias[], { params }: { params: readonly BoardParamInfo[] }): AliasListErrors {
  const byIndex = aliases.map((alias, i) => {
    const others = aliases.filter((_, j) => j !== i);
    const errors = validateAlias(alias, {
      existingKeys: others.map((a) => a.key),
      existingNames: others.map((a) => a.name),
      params,
    });
    delete errors.aliases;
    return errors;
  });
  const tooMany = aliases.length > MAX_ALIASES;
  return {
    ...(tooMany ? { aliases: 'tooMany' as const } : {}),
    byIndex,
    valid: !tooMany && byIndex.every((e) => Object.keys(e).length === 0),
  };
}

/**
 * A key derived from a name: camelCase ASCII, starting with a lower-case letter, at most 40 characters, not reserved
 * and not one of `existingKeys` (a number is appended: `pump`, `pump2`, `pump3` …). "Pump station #2" → `pumpStation2`.
 */
export function slugKey(name: string, existingKeys: readonly string[] = []): string {
  const ascii = name
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  const words = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let base = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  if (!base) base = 'alias';
  else if (!/^[a-z]/.test(base)) base = `alias${base.charAt(0).toUpperCase()}${base.slice(1)}`;
  base = base.slice(0, ALIAS_KEY_MAX);

  const taken = new Set(existingKeys);
  if (isValidAliasKey(base) && !taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = String(n);
    const candidate = base.slice(0, ALIAS_KEY_MAX - suffix.length) + suffix;
    if (isValidAliasKey(candidate) && !taken.has(candidate)) return candidate;
  }
}
