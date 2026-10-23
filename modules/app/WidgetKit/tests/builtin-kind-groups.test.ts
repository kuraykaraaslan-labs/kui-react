import { describe, expect, it } from 'vitest';
import { BUILTIN_KINDS } from '../templates/index';

/** A kind's optional `group` is how a host switches a product group on and off; the SCADA kinds and the 3D viewer carry one. */
describe('builtin kind groups', () => {
  it('every group is a lower-case id', () => {
    for (const k of BUILTIN_KINDS) if (k.group !== undefined) expect(k.group, k.type).toMatch(/^[a-z][a-z0-9_]*$/);
  });
  it('the process symbol and the process diagram are the scada group, the 3D model the viewer group, and nothing else is grouped', () => {
    const grouped = BUILTIN_KINDS.filter((k) => k.group !== undefined).map((k) => [k.type, k.group]);
    expect(grouped.sort()).toEqual([['scada.scene', 'scada'], ['scada.symbol', 'scada'], ['viewer.model', 'viewer']]);
  });
  it('every kind declares its slots once, by key', () => {
    for (const k of BUILTIN_KINDS) expect(new Set(k.slots.map((s) => s.key)).size, k.type).toBe(k.slots.length);
  });
});
