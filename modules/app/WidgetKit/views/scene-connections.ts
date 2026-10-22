// The flexible connections of the process scene (pure, no React): a strip line, a ribbed hose and a jacketed cable along
// any path. `scada-scene-logic.ts` routes a link between two ports and draws it with one of these (pipes and signal
// wires come from `scada-draw.ts`); see SCADA_STYLE.md for the shared rules.

import { el, r2, type SvgNode } from './svg-node';
import { accent, BASE, INK, METAL, METAL_OUT, type Paint } from './scada-draw';

/** The strip: a dark line, with bright marks that travel along it while the line runs. */
export function strip(d: string, p: Paint): SvgNode[] {
  const moving = p.running && p.animate;
  return [
    el('path', { d, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
    ...(p.running ? [el('path', {
      d, fill: 'none', stroke: accent(p), 'stroke-width': 3, 'stroke-dasharray': '3 15', 'stroke-linecap': 'butt', 'stroke-linejoin': 'round',
    }, moving ? [el('animate', { attributeName: 'stroke-dashoffset', from: 18, to: 0, dur: '0.8s', repeatCount: 'indefinite' })] : undefined)] : []),
  ];
}

/** A ribbed hose along `d`: a dark sleeve, light ribs across it and a ferrule at each end. */
export function hosePath(d: string, p: Paint, ferrules: Array<[number, number, boolean]>): SvgNode[] {
  const color = p.state === 'warning' || p.state === 'critical' ? p.color : p.medium ?? 'var(--text-secondary)';
  const moving = p.running && p.animate;
  return [
    el('path', { d, fill: 'none', stroke: METAL_OUT, 'stroke-width': 23, 'stroke-linejoin': 'round' }),
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': 20, 'stroke-linejoin': 'round', 'stroke-opacity': 0.9 }),
    el('path', { d, fill: 'none', stroke: BASE, 'stroke-width': 20, 'stroke-linejoin': 'round', 'stroke-opacity': 0.34, 'stroke-dasharray': '2.4 5.6' },
      moving ? [el('animate', { attributeName: 'stroke-dashoffset', from: 16, to: 0, dur: '1.2s', repeatCount: 'indefinite' })] : undefined),
    ...ferrules.map(([x, y, v]) => (v
      ? el('rect', { x: r2(x - 15), y: r2(y - 5), width: 30, height: 10, rx: 2.5, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.6 })
      : el('rect', { x: r2(x - 5), y: r2(y - 15), width: 10, height: 30, rx: 2.5, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.6 }))),
  ];
}

/** A cable: a jacket with a glossy line down it and a terminal lug at each free end. */
export function cablePath(d: string, p: Paint, lugs: Array<[number, number, boolean]>, offsets: number[] = [0]): SvgNode[] {
  const live = p.state === 'warning' || p.state === 'critical' ? p.color : p.running ? p.color : null;
  const moving = p.running && p.animate;
  const jackets = ['var(--text-primary)', 'var(--primary)', 'var(--text-secondary)'];
  return [
    ...offsets.flatMap((dy, i) => {
      const path = dy === 0 ? d : d.replace(/(?<=[ML]\s?)(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g, (_m, x: string, y: string) => `${x} ${r2(Number(y) + dy)}`);
      return [
        el('path', { d: path, fill: 'none', stroke: jackets[i % jackets.length], 'stroke-width': offsets.length > 1 ? 4.4 : 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': 0.92 }),
        el('path', { d: path, fill: 'none', stroke: BASE, 'stroke-width': 1.3, 'stroke-opacity': 0.4, 'stroke-linejoin': 'round' }),
        ...(live ? [el('path', { d: path, fill: 'none', stroke: live, 'stroke-width': 2.4, 'stroke-dasharray': '3 13', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
          moving ? [el('animate', { attributeName: 'stroke-dashoffset', from: 16, to: 0, dur: '0.7s', repeatCount: 'indefinite' })] : undefined)] : []),
      ];
    }),
    ...lugs.map(([x, y, v]) => (v
      ? el('rect', { x: r2(x - 6), y: r2(y - 4), width: 12, height: 8, rx: 2, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.5 })
      : el('rect', { x: r2(x - 4), y: r2(y - 6), width: 8, height: 12, rx: 2, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.5 }))),
  ];
}
