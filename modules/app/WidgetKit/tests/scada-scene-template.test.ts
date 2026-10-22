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
  it('refuses a connection end that is not a port, and one that names no symbol', () => {
    const e = [{ id: 'a', symbol: 'home.router' }];
    expect(paths({ elements: e, links: [{ from: 'nonsense', to: 'a.l' }] })).toContain('links.0.from');
    expect(paths({ elements: e, links: [{ from: 'a.r', to: 'ghost.l' }] })).toContain('links.0.to');
  });
  it('passes connection ids to the rule check, so a rule may target one', () => {
    const e = [{ id: 'a', symbol: 'home.router' }, { id: 'b', symbol: 'home.tv' }];
    const links = [{ from: 'a.r', to: 'b.l', id: 'feed' }];
    expect(check({ elements: e, links, rules: [{ target: 'feed', op: 'set', key: 'running' }] })).toEqual([]);
    expect(paths({ elements: e, links, rules: [{ target: 'ghost', op: 'set', key: 'running' }] }).some((p) => p.startsWith('rules.'))).toBe(true);
  });
  it('tolerates missing lists and rows that are not objects', () => {
    expect(check({})).toEqual([]);
    expect(check({ elements: [null, 3, 'x'], links: [null] })).toEqual([]);
  });
});
