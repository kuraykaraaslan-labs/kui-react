// Board entity parameters (next-boilerplate dashboard phase 41, "parameters, one concept"): an entity parameter is a
// board parameter whose value is an entity (a device, an asset …), with an entity type and HOW the entity is chosen
// (`EntityChoice`). It replaces the entity alias as a separate list: everything an alias could do, an entity parameter
// does. This file holds the choice rules the form follows (what each choice offers, the defaults when it changes), the
// save clean-up and the caps, mirrored from the server so the form can say what is wrong in place. Pure: no React.

import { NAME_PREFIX_MAX, ENTITY_LIST_MAX, SUBTYPES_MAX, MAX_RELATION_LEVEL, MAX_RELATION_FILTERS, slugKey } from './validate';
import type { EntityParamErrorCode, EntityParamErrorField } from './messages';
import type { EntityChoice, EntityChoiceType, EntityParam, ParamBarMode, ParamPeer, RelationFilter, RelationProviderInfo } from './types';

/** The choices in the order the form offers them. */
export const ENTITY_CHOICE_TYPES: readonly EntityChoiceType[] = ['viewer', 'page', 'single', 'list', 'all', 'name', 'subtype', 'related'];
export const PARAM_BAR_MODES: readonly ParamBarMode[] = ['edit', 'readOnly', 'hidden'];

type Related = Extract<EntityChoice, { type: 'related' }>;

/** A relations query (filters, it may mix entity types) rather than a search query of the parameter's own type. */
export const isMixedRelated = (c: EntityChoice): c is Related & { filters: RelationFilter[] } => c.type === 'related' && Array.isArray(c.filters);

/** The parameter another one reads: a page value (`choose.param`) or a relation root (`choose.root.param`). */
export function paramSource(choose: EntityChoice | undefined): { key: string; root: boolean } | null {
  if (!choose) return null;
  if (choose.type === 'page' && choose.param) return { key: choose.param, root: false };
  if (choose.type === 'related' && 'param' in choose.root) return { key: choose.root.param, root: true };
  return null;
}

/** May the parameter hold many entities? A fixed single entity is one. */
export const choiceTakesMany = (c: EntityChoice): boolean => c.type !== 'single';

/** The filter-bar modes the parameter offers: none for a page choice (it is never shown), no picker for one fixed entity. */
export function barModesFor(p: Pick<EntityParam, 'choose'>): ParamBarMode[] {
  if (p.choose.type === 'page') return [];
  if (p.choose.type === 'single') return ['readOnly', 'hidden'];
  return [...PARAM_BAR_MODES];
}

/** Does "with no value, take the first" apply? One entity chosen from a set (not one that follows another parameter). */
export const takesFirst = (p: Pick<EntityParam, 'choose' | 'multiple'>): boolean =>
  !p.multiple && p.choose.type !== 'single' && !(p.choose.type === 'page' && !!p.choose.param);

/** Does a default entity apply? As `takesFirst`, and the entity type is known (the default is searched by name in it). */
export const takesDefault = (p: Pick<EntityParam, 'choose' | 'multiple' | 'entityType'>): boolean => takesFirst(p) && !!p.entityType;

/** Can the parameter be what another one follows (one entity) or a relation's root (one entity of a known type)? */
export function peerFits(peer: ParamPeer, as: 'page' | 'root'): boolean {
  if (peer.kind === 'entity') return !peer.multiple && (as === 'page' || !!peer.entityType);
  return as === 'page' || !!peer.entityType;
}

export interface EmptyChoiceContext {
  providers: readonly RelationProviderInfo[];
  /** The board's other parameters: a relation starts from the first that can be a root. */
  params: readonly ParamPeer[];
  entityType?: string;
}

/** A fresh choice of `type`, keeping the relation details of the previous one where it was a relation too. */
export function emptyChoice(type: EntityChoiceType, prev: EntityChoice | null | undefined, { providers, params, entityType }: EmptyChoiceContext): EntityChoice {
  switch (type) {
    case 'viewer': return { type };
    case 'page': return { type };
    case 'single': return { type, id: '' };
    case 'list': return { type, ids: [] };
    case 'all': return { type };
    case 'name': return { type, namePrefix: '' };
    case 'subtype': return { type, subtypes: [] };
    case 'related': {
      if (prev?.type === 'related') return prev;
      const root = params.find((p) => peerFits(p, 'root'));
      return {
        type,
        provider: providers.length === 1 ? providers[0].key : '',
        root: root ? { param: root.key } : { entity: { type: entityType ?? '', id: '' } },
        direction: 'from',
        maxLevel: 1,
      };
    }
  }
}

/**
 * The parameter with its choice changed to `type`, and what depends on the choice made to fit: one fixed entity is one
 * and has no picker in the filter bar (hidden, as an alias of one entity was); a page choice is never shown; a default and
 * "take the first" go where they do not apply.
 */
export function withChoice(p: EntityParam, type: EntityChoiceType, ctx: Omit<EmptyChoiceContext, 'entityType'>): EntityParam {
  const choose = emptyChoice(type, p.choose, { ...ctx, entityType: p.entityType });
  return fitChoice({ ...p, choose });
}

/** What depends on the choice, made to fit it (`withChoice`, and a change of one or many). */
export function fitChoice(p: EntityParam): EntityParam {
  const next: EntityParam = { ...p };
  if (!choiceTakesMany(next.choose)) delete next.multiple;
  const modes = barModesFor(next);
  if (modes.length === 0) delete next.viewer;
  else if (!modes.includes(next.viewer ?? 'edit')) next.viewer = modes[modes.length - 1];
  if (!takesFirst(next)) delete next.defaultFrom;
  if (!takesDefault(next)) delete next.default;
  return next;
}

/** The parameter with another entity type: the entities chosen of the old one go (they are not of the new one). */
export function withEntityType(p: EntityParam, entityType: string): EntityParam {
  const c = p.choose;
  const choose: EntityChoice =
    c.type === 'single' ? { ...c, id: '' }
      : c.type === 'list' ? { ...c, ids: [] }
      : c.type === 'subtype' ? { ...c, subtypes: [] }
      : c.type === 'related' && !isMixedRelated(c) ? withoutKeys(c, ['subtypes'])
      : c;
  const next: EntityParam = { ...p, entityType, choose };
  delete next.default;
  return fitChoice(next);
}

function withoutKeys<T extends object>(o: T, keys: readonly string[]): T {
  const out = { ...o } as Record<string, unknown>;
  for (const k of keys) delete out[k];
  return out as T;
}

/** A key made from the label (D41-6): camelCase ASCII, not one of `taken` (`Pump station` → `pumpStation`). */
export const paramKeyFromLabel = (label: string, taken: readonly string[] = []): string => slugKey(label, taken, 'param');

function cleanRelationFilters(filters: readonly RelationFilter[]): RelationFilter[] {
  const out: RelationFilter[] = [];
  const seen = new Set<string>();
  for (const f of filters) {
    const relationType = f.relationType?.trim() || undefined;
    const entityTypes = f.entityTypes?.length ? [...new Set(f.entityTypes)] : undefined;
    if (!relationType && !entityTypes) continue;
    const negate = f.negate ? true : undefined;
    const id = JSON.stringify([relationType ?? '', entityTypes ?? [], !!negate]);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...(relationType ? { relationType } : {}), ...(entityTypes ? { entityTypes } : {}), ...(negate ? { negate } : {}) });
  }
  return out;
}

function normalizeChoice(c: EntityChoice): EntityChoice {
  switch (c.type) {
    case 'page': return c.param ? { type: 'page', param: c.param } : { type: 'page' };
    case 'list': return { type: 'list', ids: [...new Set(c.ids)] };
    case 'name': return { type: 'name', namePrefix: c.namePrefix.trim() };
    case 'subtype': {
      const prefix = c.namePrefix?.trim();
      return { type: 'subtype', subtypes: [...new Set(c.subtypes)], ...(prefix ? { namePrefix: prefix } : {}) };
    }
    case 'related': {
      const base = {
        type: 'related' as const, provider: c.provider, root: c.root, direction: c.direction, maxLevel: c.maxLevel,
        ...(c.lastLevelOnly && c.maxLevel > 1 ? { lastLevelOnly: true } : {}),
      };
      if (isMixedRelated(c)) return { ...base, filters: cleanRelationFilters(c.filters) };
      const relationType = c.relationType?.trim();
      return { ...base, ...(relationType ? { relationType } : {}), ...(c.subtypes?.length ? { subtypes: [...new Set(c.subtypes)] } : {}) };
    }
    default: return c;
  }
}

/**
 * The parameter as it is saved: the label trimmed, the choice cleaned (TB's alias clean-up), and every optional that says
 * nothing left out (`edit` is the default mode, one is the default count, a page choice has no mode).
 */
export function normalizeEntityParam(p: EntityParam): EntityParam {
  const fitted = fitChoice({ ...p, choose: normalizeChoice(p.choose) });
  const out: EntityParam = { kind: 'entity', key: fitted.key, label: fitted.label.trim(), choose: fitted.choose };
  if (fitted.description?.trim()) out.description = fitted.description.trim();
  if (fitted.placeholder?.trim()) out.placeholder = fitted.placeholder.trim();
  if (fitted.entityType && !isMixedRelated(fitted.choose)) out.entityType = fitted.entityType;
  if (fitted.multiple) out.multiple = true;
  if (fitted.default) out.default = fitted.default;
  if (fitted.defaultFrom === 'firstOption') out.defaultFrom = 'firstOption';
  if (fitted.viewer && fitted.viewer !== 'edit') out.viewer = fitted.viewer;
  if (fitted.required) out.required = true;
  return out;
}

/** Field → error code. Empty when the parameter is valid. */
export type EntityParamErrors = Partial<Record<EntityParamErrorField, EntityParamErrorCode>>;

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === '';

/**
 * What a parameter reads of the others, against the whole list (the server's `entityParamRefIssues`): the parameter it
 * follows exists and is not itself; a relation root is one entity of a known type; a page choice follows one entity; and
 * following, by roots or page choices, never comes back.
 */
function sourceError(p: EntityParam, params: readonly ParamPeer[]): EntityParamErrorCode | undefined {
  const src = paramSource(p.choose);
  if (!src) return undefined;
  if (src.key === p.key) return 'self';
  const byKey = new Map(params.map((d) => [d.key, d]));
  const target = byKey.get(src.key);
  if (!target) return 'unknownParam';
  if (!peerFits(target, src.root ? 'root' : 'page')) return 'notOneEntity';
  const chain = new Set([p.key]);
  for (let at: ParamPeer | undefined = target; at && at.kind === 'entity';) {
    if (chain.has(at.key)) return 'cycle';
    chain.add(at.key);
    const next = paramSource(at.choose);
    at = next ? byKey.get(next.key) : undefined;
  }
  return undefined;
}

/**
 * Every error of one entity parameter, keyed by field. `params` is the board's whole list (this one may be in it): a page
 * choice and a relation root are checked against it.
 */
export function validateEntityParam(p: EntityParam, params: readonly ParamPeer[]): EntityParamErrors {
  const errors: EntityParamErrors = {};
  const c = p.choose;
  if (!c || !ENTITY_CHOICE_TYPES.includes(c.type)) {
    errors['choose.type'] = 'required';
    return errors;
  }
  if (blank(p.entityType) && !isMixedRelated(c)) errors.entityType = 'required';
  switch (c.type) {
    case 'single':
      if (blank(c.id)) errors['choose.id'] = 'required';
      if (p.multiple) errors.multiple = 'singleOnly';
      break;
    case 'list':
      if (c.ids.length < 1) errors['choose.ids'] = 'tooFew';
      else if (c.ids.length > ENTITY_LIST_MAX) errors['choose.ids'] = 'tooMany';
      if (p.default && !c.ids.includes(p.default)) errors.default = 'notListed';
      break;
    case 'name':
      if (blank(c.namePrefix)) errors['choose.namePrefix'] = 'required';
      else if (c.namePrefix.trim().length > NAME_PREFIX_MAX) errors['choose.namePrefix'] = 'tooLong';
      break;
    case 'subtype':
      if (c.subtypes.length < 1) errors['choose.subtypes'] = 'tooFew';
      else if (c.subtypes.length > SUBTYPES_MAX) errors['choose.subtypes'] = 'tooMany';
      if (c.namePrefix && c.namePrefix.trim().length > NAME_PREFIX_MAX) errors['choose.namePrefix'] = 'tooLong';
      break;
    case 'page': {
      const src = sourceError(p, params);
      if (src) errors['choose.param'] = src;
      break;
    }
    case 'related': {
      if (blank(c.provider)) errors['choose.provider'] = 'required';
      if ('param' in c.root) {
        if (blank(c.root.param)) errors['choose.root'] = 'required';
        else {
          const src = sourceError(p, params);
          if (src) errors['choose.root'] = src;
        }
      } else if (blank(c.root.entity?.type) || blank(c.root.entity?.id)) {
        errors['choose.root'] = 'required';
      }
      if (!(Number.isInteger(c.maxLevel) && c.maxLevel >= 1 && c.maxLevel <= MAX_RELATION_LEVEL)) errors['choose.maxLevel'] = 'range';
      if (isMixedRelated(c) && c.filters.length > MAX_RELATION_FILTERS) errors['choose.filters'] = 'tooMany';
      if (!isMixedRelated(c) && (c.subtypes?.length ?? 0) > SUBTYPES_MAX) errors['choose.subtypes'] = 'tooMany';
      break;
    }
    default:
      break;
  }
  return errors;
}
