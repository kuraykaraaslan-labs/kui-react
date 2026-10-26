import { describe, it, expect } from 'vitest';
import {
  barModesFor,
  emptyChoice,
  fitChoice,
  normalizeEntityParam,
  paramKeyFromLabel,
  takesDefault,
  takesFirst,
  validateEntityParam,
  withChoice,
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
    expect(withChoice(picked, 'page', ctx)).toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'page' }, default: 'd1', defaultFrom: 'firstOption' });
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
  });
});

describe('normalizeEntityParam', () => {
  it('leaves out every optional that says nothing and cleans the choice', () => {
    expect(normalizeEntityParam(base({ label: ' Pump ', viewer: 'edit', multiple: false, description: ' ', choose: { type: 'name', namePrefix: ' Pu ' } })))
      .toEqual({ kind: 'entity', key: 'pump', label: 'Pump', entityType: 'iot_device', choose: { type: 'name', namePrefix: 'Pu' } });
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
