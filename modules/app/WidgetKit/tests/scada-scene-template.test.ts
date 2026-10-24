import { describe, expect, it } from 'vitest';
import { SCADA_SCENE } from '../templates/scada-scene';

/** The template's own checks (what the settings editor shows next to a field, and what a save refuses). */
const check = (v: Record<string, unknown>) => SCADA_SCENE.rules!.flatMap((r) => r(v as never));
const paths = (v: Record<string, unknown>) => check(v).map((i) => i.path);

describe('scada.scene validation rules', () => {
  it('accepts a sound diagram', () => {
    expect(check({ elements: [{ id: 'a', symbol: 'home.router' }, { id: 'b', symbol: 'home.tv' }], links: [{ from: 'a.r', to: 'b.l' }] })).toEqual([]);
  });
  it('refuses a bad or repeated id, and an unknown symbol', () => {
    expect(paths({ elements: [{ id: '1bad', symbol: 'home.router' }] })).toContain('elements.0.id');
    expect(paths({ elements: [{ id: 'a', symbol: 'home.router' }, { id: 'a', symbol: 'home.router' }] })).toContain('elements.1.id');
    expect(paths({ elements: [{ id: 'a', symbol: 'no.such' }] })).toContain('elements.0.symbol');
  });
  it('refuses a connection end that is not a port; an end that names no symbol may name a thing from data (phase 35)', () => {
    const e = [{ id: 'a', symbol: 'home.router' }];
    expect(paths({ elements: e, links: [{ from: 'nonsense', to: 'a.l' }] })).toContain('links.0.from');
    expect(paths({ elements: e, links: [{ from: 'a.r', to: 'cow7.l' }] })).toEqual([]);
  });
  it('passes connection ids to the rule check, so a rule may target one; a thing\'s id and things:* are targets too', () => {
    const e = [{ id: 'a', symbol: 'home.router' }, { id: 'b', symbol: 'home.tv' }];
    const links = [{ from: 'a.r', to: 'b.l', id: 'feed' }];
    expect(check({ elements: e, links, rules: [{ target: 'feed', op: 'set', key: 'running' }] })).toEqual([]);
    expect(check({ elements: e, links, rules: [{ target: 'cow7', op: 'set', key: 'running' }, { target: 'things:*', dim: 'true' }] })).toEqual([]);
    expect(paths({ elements: e, links, rules: [{ op: 'set', key: 'running' }] })).toEqual(['rules.0.target']);
  });
  it('accepts the where-and-how-big effects of a rule and refuses a turn that is not a quarter', () => {
    const e = [{ id: 'a', symbol: 'home.router' }];
    expect(check({ elements: e, rules: [{ target: 'a', dx: 20, dy: -10, scale: 1.5, turn: '90', symbol: 'home.tv' }] })).toEqual([]);
    expect(paths({ elements: e, rules: [{ target: 'a', turn: '45' }] })).toEqual(['rules.0.turn']);
  });
  it('offers the things table as a second, optional slot and its settings in a Things group', async () => {
    const { SCADA_SCENE_KIND } = await import('../templates/scada-scene');
    expect(SCADA_SCENE_KIND.slots.map((x) => [x.key, x.shape, x.required])).toEqual([['points', 'table', false], ['things', 'table', false]]);
    const things = Object.entries(SCADA_SCENE.fields).filter(([, f]) => f.group === 'things').map(([k]) => k);
    expect(things).toEqual([
      'thingsIdColumn', 'thingsSymbol', 'thingsSymbolColumn', 'thingsXColumn', 'thingsYColumn', 'thingsTurnColumn', 'thingsLabelColumn',
      'thingsUnits', 'thingsScale', 'thingsOriginX', 'thingsOriginY',
    ]);
    expect(SCADA_SCENE.fields.thingsScale.value).toBe(50);
    expect(SCADA_SCENE.fields.thingsIdColumn.since).toBe(5);
  });
  it('tolerates missing lists and rows that are not objects', () => {
    expect(check({})).toEqual([]);
    expect(check({ elements: [null, 3, 'x'], links: [null] })).toEqual([]);
  });
});
