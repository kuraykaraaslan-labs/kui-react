import { describe, it, expect } from 'vitest';
import {
  barModesFor,
  defaultFits,
  emptyChoice,
  fitChoice,
  normalizeEntityParam,
  paramKeyFromLabel,
  previewAlias,
  takesDefault,
  takesFirst,
  validateEntityParam,
  withChoice,
  withChoicePatch,
  withEntityType,
} from './entity-params';
import { DEMO_PROVIDERS } from './demo-access';
import { mergeAliasMessages } from './messages';
import type { EntityParam, ParamPeer } from './types';

const base = (over: Partial<EntityParam> = {}): EntityParam => ({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'viewer' }, ...over });
const SITE: EntityParam = { kind: 'entity', key: 'site', label: 'Site', entityType: 'iot_asset', choose: { type: 'viewer' } };
const LIMIT: ParamPeer = { key: 'limit', label: 'Limit' };
const ctx = { providers: DEMO_PROVIDERS, params: [SITE, LIMIT] };

describe('the choice rules', () => {
  it('offers no filter-bar mode for a page choice and no picker for one fixed entity', () => {
    expect(barModesFor(base())).toEqual(['edit', 'readOnly', 'hidden']);
    expect(barModesFor(base({ choose: { type: 'page' } }))).toEqual([]);
    expect(barModesFor(base({ choose: { type: 'single', id: 'd1' } }))).toEqual(['readOnly', 'hidden']);
  });

  it('takes the first and a default only for one entity of a set, a default only with a known type', () => {
    expect(takesFirst(base())).toBe(true);
    expect(takesFirst(base({ multiple: true }))).toBe(false);
    expect(takesFirst(base({ choose: { type: 'single', id: 'd1' } }))).toBe(false);
    expect(takesFirst(base({ choose: { type: 'page', param: 'site' } }))).toBe(false);
    expect(takesFirst(base({ choose: { type: 'page' } }))).toBe(true);
    expect(takesDefault(base({ entityType: undefined }))).toBe(false);
    // a relation's set is a walk only the server knows: no default the form could not check
    expect(takesDefault(base({ choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1 } }))).toBe(false);
    expect(takesDefault(base({ choose: { type: 'name', namePrefix: 'Pump' } }))).toBe(true);
  });

  it('a page choice that follows another parameter always takes the first of its set, its only way to a value', () => {
    const follows = base({ choose: { type: 'page', param: 'site' } });
    expect(fitChoice(follows)).toEqual({ ...follows, defaultFrom: 'firstOption' });
    // a label edit of a phase 36 state entity alias read as a parameter keeps it
    const stored = base({ label: 'Current device', choose: { type: 'page', param: 'device' }, defaultFrom: 'firstOption' });
    expect(normalizeEntityParam(stored).defaultFrom).toBe('firstOption');
    expect(fitChoice({ ...follows, multiple: true }).defaultFrom).toBeUndefined();
    expect(fitChoice({ ...follows, default: 'd1' }).default).toBeUndefined();
  });

  it('a default is offered only inside the set: listed, its name prefix, its subtypes', () => {
    const pump = { type: 'iot_device', id: 'd1', name: 'Pump 1', subtype: 'Pump' };
    const tank = { type: 'iot_device', id: 'd3', name: 'Tank A', subtype: 'Tank' };
    expect(defaultFits(base({ choose: { type: 'name', namePrefix: 'pump' } }), pump)).toBe(true);
    expect(defaultFits(base({ choose: { type: 'name', namePrefix: 'Pump' } }), tank)).toBe(false);
    expect(defaultFits(base({ choose: { type: 'subtype', subtypes: ['Pump'] } }), tank)).toBe(false);
    expect(defaultFits(base({ choose: { type: 'subtype', subtypes: ['Tank'], namePrefix: 'Tank' } }), tank)).toBe(true);
    expect(defaultFits(base({ choose: { type: 'list', ids: ['d1'] } }), tank)).toBe(false);
    expect(defaultFits(base(), tank)).toBe(true);
  });

  it('a change of the set drops the default picked in the old one; a still listed one stays', () => {
    const named = base({ choose: { type: 'name', namePrefix: 'Pump' }, default: 'd1' });
    expect(withChoicePatch(named, { namePrefix: 'Tank' }).default).toBeUndefined();
    expect(withChoice(named, 'all', ctx).default).toBeUndefined();
    const listed = base({ choose: { type: 'list', ids: ['d1', 'd2'] }, default: 'd1' });
    expect(withChoicePatch(listed, { ids: ['d1'] }).default).toBe('d1');
    expect(withChoicePatch(listed, { ids: ['d2'] }).default).toBeUndefined();
  });

  it('a default the form does not offer (a relation\'s, stored through the API) is kept while the set is not changed', () => {
    const mixed = base({
      entityType: undefined, default: 'd1',
      choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1, filters: [{ relationType: 'Contains' }] },
    });
    expect(normalizeEntityParam({ ...mixed, label: 'Renamed' }).default).toBe('d1');
  });

  it('a relation starts from the first parameter that can be a root, with the only relation source', () => {
    expect(emptyChoice('related', null, ctx)).toEqual({ type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1 });
    expect(emptyChoice('related', null, { providers: [], params: [LIMIT], entityType: 'iot_device' }))
      .toEqual({ type: 'related', provider: '', root: { entity: { type: 'iot_device', id: '' } }, direction: 'from', maxLevel: 1 });
  });

  it('changing the choice fits what depends on it: one fixed entity is one and hidden, a page choice has no mode or default', () => {
    const many = base({ multiple: true });
    expect(withChoice(many, 'single', ctx)).toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'single', id: '' }, viewer: 'hidden' });
    const picked = base({ default: 'd1', defaultFrom: 'firstOption', viewer: 'readOnly' });
    expect(withChoice(picked, 'page', ctx)).toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'page' }, defaultFrom: 'firstOption' });
    expect(fitChoice({ ...picked, multiple: true })).toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'viewer' }, multiple: true, viewer: 'readOnly' });
  });

  it('another entity type drops the entities chosen of the old one', () => {
    const p = base({ choose: { type: 'list', ids: ['d1', 'd2'] }, default: 'd1' });
    expect(withEntityType(p, 'iot_asset')).toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_asset', choose: { type: 'list', ids: [] } });
  });

  it('makes the key from the label, free of the keys taken', () => {
    expect(paramKeyFromLabel('Pump station')).toBe('pumpStation');
    expect(paramKeyFromLabel('Pump', ['pump'])).toBe('pump2');
    expect(paramKeyFromLabel('1st line')).toBe('param1stLine');
    // never a key the server refuses as reserved
    expect(paramKeyFromLabel('Value of')).toBe('valueOf2');
    expect(paramKeyFromLabel('To string')).toBe('toString2');
  });
});

describe('normalizeEntityParam', () => {
  it('leaves out every optional that says nothing and cleans the choice, a name prefix kept as typed', () => {
    expect(normalizeEntityParam(base({ label: ' Pump ', viewer: 'edit', multiple: false, description: ' ', choose: { type: 'name', namePrefix: 'Pump ' } })))
      .toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'name', namePrefix: 'Pump ' } });
    expect(normalizeEntityParam(base({ choose: { type: 'subtype', subtypes: ['Pump'], namePrefix: '  ' } })).choose).toEqual({ type: 'subtype', subtypes: ['Pump'] });
    const related = base({
      choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'to', maxLevel: 1, lastLevelOnly: true, relationType: ' ', subtypes: [] },
    });
    expect(normalizeEntityParam(related).choose).toEqual({ type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'to', maxLevel: 1 });
  });

  it('a relations query keeps its filters (even none) and has no entity type', () => {
    const mixed = base({ choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 2, filters: [{}, { relationType: 'Contains' }] } });
    expect(normalizeEntityParam(mixed)).toEqual({
      kind: 'entity', key: 'pump', label: 'Pump',
      choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 2, filters: [{ relationType: 'Contains' }] },
    });
  });
});

describe('previewAlias', () => {
  it('is the alias the server resolves, for a set of the type that reads no other parameter', () => {
    expect(previewAlias(base({ choose: { type: 'name', namePrefix: 'Pump' } })))
      .toEqual({ key: 'draft', name: 'Pump', resolveMultiple: false, filter: { type: 'entityName', entityType: 'iot_device', namePrefix: 'Pump' } });
    const fixedRoot = base({ multiple: true, choose: { type: 'related', provider: 'iot_asset', root: { entity: { type: 'iot_asset', id: 'a1' } }, direction: 'from', maxLevel: 1 } });
    expect(previewAlias(fixedRoot)?.filter).toEqual({ type: 'entitySearchQuery', provider: 'iot_asset', root: { entity: { type: 'iot_asset', id: 'a1' } }, direction: 'from', maxLevel: 1, entityType: 'iot_device' });
    expect(previewAlias(fixedRoot)?.resolveMultiple).toBe(true);
    expect(previewAlias(base({ choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1 } }))).toBeNull();
    expect(previewAlias(base())).toBeNull();
  });
});

describe('validateEntityParam', () => {
  const list = (p: EntityParam): ParamPeer[] => [p, SITE, LIMIT];

  it('a complete parameter has no errors', () => {
    expect(validateEntityParam(base(), list(base()))).toEqual({});
  });

  it('says what each choice is missing', () => {
    expect(validateEntityParam(base({ entityType: '' }), [])).toEqual({ entityType: 'required' });
    expect(validateEntityParam(base({ choose: { type: 'single', id: '' } }), [])).toEqual({ 'choose.id': 'required' });
    expect(validateEntityParam(base({ choose: { type: 'list', ids: [] } }), [])).toEqual({ 'choose.ids': 'tooFew' });
    expect(validateEntityParam(base({ choose: { type: 'list', ids: ['d1'] }, default: 'd2' }), [])).toEqual({ default: 'notListed' });
    expect(validateEntityParam(base({ choose: { type: 'name', namePrefix: ' ' } }), [])).toEqual({ 'choose.namePrefix': 'required' });
    expect(validateEntityParam(base({ choose: { type: 'subtype', subtypes: [] } }), [])).toEqual({ 'choose.subtypes': 'tooFew' });
    expect(validateEntityParam(base({ choose: { type: 'single', id: 'd1' }, multiple: true }), [])).toEqual({ multiple: 'singleOnly' });
  });

  it('checks what it follows against the whole list: itself, unknown, not one entity, a cycle', () => {
    expect(validateEntityParam(base({ choose: { type: 'page', param: 'pump' } }), list(base()))).toEqual({ 'choose.param': 'self' });
    expect(validateEntityParam(base({ choose: { type: 'page', param: 'gone' } }), list(base()))).toEqual({ 'choose.param': 'unknownParam' });
    const many: EntityParam = { ...SITE, multiple: true };
    expect(validateEntityParam(base({ choose: { type: 'page', param: 'site' } }), [many])).toEqual({ 'choose.param': 'notOneEntity' });
    const rootOnValue = base({ choose: { type: 'related', provider: 'iot_asset', root: { param: 'limit' }, direction: 'from', maxLevel: 1 } });
    expect(validateEntityParam(rootOnValue, list(rootOnValue))).toEqual({ 'choose.root': 'notOneEntity' });
    const a = base({ choose: { type: 'page', param: 'other' } });
    const b: EntityParam = { kind: 'entity', key: 'other', label: 'Other', entityType: 'iot_device', choose: { type: 'page', param: 'pump' } };
    expect(validateEntityParam(a, [a, b])).toEqual({ 'choose.param': 'cycle' });
  });

  it('a relation needs a source, a root and a level from 1 to 10', () => {
    const r = base({ choose: { type: 'related', provider: '', root: { entity: { type: 'iot_asset', id: '' } }, direction: 'from', maxLevel: 11 } });
    expect(validateEntityParam(r, [])).toEqual({ 'choose.provider': 'required', 'choose.root': 'required', 'choose.maxLevel': 'range' });
    const mixed = base({ entityType: undefined, choose: { type: 'related', provider: 'iot_asset', root: { param: 'site' }, direction: 'from', maxLevel: 1, filters: [] } });
    expect(validateEntityParam(mixed, list(mixed))).toEqual({});
  });

  it('every code has a plain English text', () => {
    const m = mergeAliasMessages();
    expect(m.paramError('choose.param', 'cycle')).toBe('The parameters it follows lead back to it.');
    expect(m.paramError('choose.type', 'required')).toBe('How it is chosen is required.');
  });
});
