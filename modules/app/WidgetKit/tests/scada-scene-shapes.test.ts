import { describe, it, expect } from 'vitest';
import { sceneModel } from '../views/scada-scene-logic';
import { svgToString } from '../views/svg-node';

const base = {
  width: 600, height: 300, scale: 0.6, fit: 'canvas' as const,
  elements: [{ id: 'a', symbol: 'home.plug.smart', x: 100, y: 100 }, { id: 'b', symbol: 'home.router', x: 300, y: 100 }],
  links: [{ from: 'a.r', to: 'b.l', kind: 'sld' }],
};
const markup = (s: Record<string, unknown>, rows: Array<Record<string, unknown>> = []) =>
  sceneModel({ ...base, ...s }, { points: { shape: 'table', rows } }).nodes.map(svgToString).join('');

describe('scene titles, zones and dividers', () => {
  it('draws a zone under the symbols and its name over them', () => {
    const m = sceneModel({ ...base, shapes: [{ kind: 'zone', x: 20, y: 20, w: 400, h: 200, text: 'Switchgear' }] }, {});
    const html = m.nodes.map(svgToString).join('');
    expect(html).toContain('Switchgear');
    expect(html.indexOf('stroke-dasharray="6 5"')).toBeLessThan(html.indexOf('<path'));
    expect(m.problems).toBe(0);
  });
  it('a title and a divider are drawn, an unknown kind counts as a problem', () => {
    const m = sceneModel({ ...base, shapes: [{ kind: 'text', x: 50, y: 30, text: 'Plant 1', size: 'l' }, { kind: 'divider', x: 10, y: 250, w: 500 }, { kind: 'nope' }] }, {});
    expect(m.nodes.map(svgToString).join('')).toContain('Plant 1');
    expect(m.problems).toBe(1);
  });
  it('shapes widen the content box', () => {
    const plain = sceneModel({ ...base, fit: 'content' }, {});
    const wide = sceneModel({ ...base, fit: 'content', shapes: [{ kind: 'zone', x: -200, y: 0, w: 900, h: 300 }] }, {});
    expect(wide.width).toBeGreaterThan(plain.width);
  });
  it('a title with no words and a shape past the cap are ignored without breaking the scene', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ kind: 'text', x: i, y: 10, text: `t${i}` }));
    expect(() => sceneModel({ ...base, shapes: [{ kind: 'text', x: 1, y: 1 }, ...many] }, {})).not.toThrow();
  });
});

describe('single-line connections and the calm look', () => {
  it('an energised single line takes the state colour, an idle one plain ink', () => {
    expect(markup({}, [{ id: 'a', running: true }])).toContain('stroke="var(--success)"');
    expect(markup({}, [])).not.toContain('stroke="var(--success)"');
  });
  it('calm: a running part is not green', () => {
    expect(markup({ calm: true }, [{ id: 'a', running: true }])).not.toContain('var(--success)');
    expect(markup({ calm: true }, [{ id: 'a', status: 'critical' }])).toContain('var(--error)');
  });
});
