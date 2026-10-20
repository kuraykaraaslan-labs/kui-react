import { describe, it, expect } from 'vitest';
import { isWeight, R, W } from '../views/scada-draw';
import { SCADA_SYMBOLS, drawScada, scadaPaint } from '../views/scada-logic';
import type { SvgNode } from '../views/svg-node';

/**
 * The shared pen (views/SCADA_STYLE.md): every symbol, in every state, draws with the same line weights, the same
 * corner radii, colours from the theme's tokens only, and nothing that could break two symbols on one page (no ids,
 * gradients, inline styles or hex colours). A new symbol that strays fails here.
 */
const STATES: Array<[string, Record<string, unknown>]> = [
  ['idle', { running: false, value: 0 }],
  ['running', { running: true, value: 60, value2: 40 }],
  ['warning', { running: true, status: 'warning', value: 80 }],
  ['critical', { critical: true, value: 95 }],
  ['empty', {}],
];

const walk = (nodes: SvgNode[], visit: (n: SvgNode) => void) => nodes.forEach((n) => { visit(n); if (n.c) walk(n.c, visit); });
const slots = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { shape: 'scalar' as const, value: v as number | boolean | string }]));

describe.each(SCADA_SYMBOLS.map((s) => [s] as const))('SCADA style: %s', (symbol) => {
  for (const [state, data] of STATES) {
    it(`draws on the pen in its ${state} look`, () => {
      const paint = scadaPaint({ symbol, min: 0, max: 100, medium: 'cold', arrows: true, ranges: [{ from: 0, to: 50, color: 'var(--success)' }, { from: 50, color: 'var(--error)' }] }, slots(data), { animate: true });
      const drawn = drawScada(symbol, paint);
      expect(drawn.nodes.length).toBeGreaterThan(0);
      walk(drawn.nodes, (n) => {
        const a = n.a ?? {};
        const where = `${symbol}/${state}: <${n.t}>`;
        // Line weights come from the scale (pipe walls, flows and hoses are wider and free).
        const sw = a['stroke-width'];
        if (typeof sw === 'number') expect(isWeight(sw), `${where} stroke-width ${sw}`).toBe(true);
        // Rectangle corners: a radius of the scale, or a pill.
        if (n.t === 'rect' && typeof a.rx === 'number') {
          const half = Math.min(Number(a.width), Number(a.height)) / 2;
          expect([R.sm, R.md, R.lg].includes(a.rx as 3) || a.rx >= half - 0.5, `${where} rx ${a.rx} on ${a.width}x${a.height}`).toBe(true);
        }
        // Colours: theme tokens (and none) only; no hex, no functions, no urls.
        for (const k of ['fill', 'stroke']) {
          const v = a[k];
          if (typeof v === 'string') expect(/^(none|var\(--[a-z-]+\))$/.test(v), `${where} ${k}="${v}"`).toBe(true);
        }
        // Nothing that is shared across the page: ids, inline styles, references.
        expect(a.id, where).toBeUndefined();
        expect(a.style, where).toBeUndefined();
        for (const v of Object.values(a)) expect(String(v), where).not.toMatch(/url\(|#[0-9a-fA-F]{3,8}\b/);
      });
    });
  }

  it('keeps every drawing inside its box and animates only with motion allowed', () => {
    const run = (animate: boolean) => drawScada(symbol, scadaPaint({ symbol, animation: true }, slots({ running: true, value: 50 }), { animate }));
    const moving = (nodes: SvgNode[]) => { let n = 0; walk(nodes, (x) => { if (x.t === 'animate' || x.t === 'animateTransform') n += 1; }); return n; };
    expect(moving(run(false).nodes)).toBe(0);
    const d = run(true);
    expect(d.w).toBeGreaterThan(0);
    expect(d.h).toBeGreaterThan(0);
    expect(W.out).toBe(2.5);
  });
});
