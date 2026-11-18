import { describe, expect, it } from 'vitest';
import { BUILTIN_KINDS } from '../templates/index';
import { PROGRESS } from '../templates/progress';
import { SCADA_SYMBOL } from '../templates/scada';

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

/**
 * The words a person reads on a card's settings never name a slot, the code's word for a value the Data tab picks (next-boilerplate phase 53, re-run 4:
 * the gauge's help in 53.2.10, then the progress card's target, the process symbol's capacity and label, and the bar chart's bar width): every label,
 * description, placeholder and option label of every builtin template, nested fields and groups included.
 */
describe('no template text says "slot"', () => {
  const READ = new Set(['label', 'description', 'placeholder', 'help', 'hint']);
  const texts = (v: unknown, at: string, out: Array<[string, string]>): Array<[string, string]> => {
    if (Array.isArray(v)) v.forEach((x, i) => texts(x, `${at}[${i}]`, out));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === 'string' && READ.has(k)) out.push([`${at}.${k}`, x]);
        else texts(x, `${at}.${k}`, out);
      }
    }
    return out;
  };
  it('in any builtin template', () => {
    for (const k of BUILTIN_KINDS) {
      for (const [at, text] of texts(k.template, k.type, [])) expect(text, at).not.toMatch(/\bslots?\b/i);
    }
  });
  it('the three helps name the Data tab\'s own words instead (Target, Capacity (scale maximum), Label)', () => {
    const progress = PROGRESS.fields as Record<string, { description?: string }>;
    const scada = SCADA_SYMBOL.fields as Record<string, { description?: string }>;
    expect(progress.target!.description).toBe('Used when no value is chosen for Target on the Data tab.');
    expect(scada.max!.description).toBe('Used when no value is chosen for Capacity (scale maximum) on the Data tab.');
    expect(scada.label!.description).toBe('A value chosen for Label on the Data tab wins.');
    const named = (type: string) => BUILTIN_KINDS.find((k) => k.type === type)!.slots.map((s) => s.label);
    expect(named('progress')).toContain('Target');
    expect(named('scada.symbol')).toEqual(expect.arrayContaining(['Capacity (scale maximum)', 'Label']));
  });
});
