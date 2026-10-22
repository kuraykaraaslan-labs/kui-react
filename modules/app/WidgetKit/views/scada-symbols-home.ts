// The process symbols of the "home" family: consumer electronics of a house, drawn as devices (neutral housings, a
// sunken screen, the state colour only on the LED, the lit screen or the part that works) on the shared pen of
// `scada-draw.ts` (see SCADA_STYLE.md). Data ports are thin 2.5 stubs that join `line` and `wire` connections; power
// ports are short cable jackets that join the `cable` kind. Every port sits on a centre line of the 100-unit box.
// Each entry is a `SymbolDef`; `scada-logic.ts` merges this object into the registry.
//
// What the readings mean (`status`: warning / critical colours the lit part; a device with no `value` has none):
//   key                     running                        value                    value2
//   home.tv                 on: screen lit                 -                        -
//   home.router             online: LEDs lit, arcs pulse   -                        -
//   home.camera.security    recording: dot blinks          -                        -
//   home.plug.smart         switched on: ring lit          load in W (scaled)       -

import { arcPath, el, r2, type SvgNode } from './svg-node';
import { accent, BASE, INK, METAL, METAL_OUT, MUTED, R, SURFACE, type Drawn, type Paint } from './scada-draw';
import type { SymbolDef } from './scada-logic';

const SUNKEN = 'var(--surface-sunken)';
const lit = (p: Paint): boolean => p.running || p.state !== 'idle';
const moving = (p: Paint): boolean => p.running && p.animate;

/** A data port: a thin stub from the box edge to the housing. */
const data = (x1: number, y1: number, x2: number, y2: number): SvgNode =>
  el('line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'butt' });

/** A power port: a short cable jacket from the box edge to the housing (the `cable` connection joins it). */
const power = (x1: number, y1: number, x2: number, y2: number): SvgNode =>
  el('line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'butt', 'stroke-opacity': 0.92 });

/** A housing: fill, a silhouette outline. */
const box = (x: number, y: number, w: number, h: number, rx: number = R.md, fill: string = SURFACE): SvgNode =>
  el('rect', { x, y, width: w, height: h, rx, fill, stroke: METAL_OUT, 'stroke-width': 2.5 });

/** A floor (or shelf) bar under a standing device. */
const foot = (x: number, w: number, y = 90): SvgNode => el('rect', { x, y, width: w, height: 6, rx: R.sm, fill: METAL_OUT });

/** A sunken lens: a window, a display, a slot. */
const sunk = (x: number, y: number, w: number, h: number, rx: number = R.sm): SvgNode =>
  el('rect', { x, y, width: w, height: h, rx, fill: SUNKEN, stroke: METAL_OUT, 'stroke-width': 1.5 });

/** A small metal part (a leg, a neck, a foot, a button). */
const part = (x: number, y: number, w: number, h: number, rx: number = R.sm): SvgNode =>
  el('rect', { x, y, width: w, height: h, rx, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.5 });

/** A status LED: lit in the state's colour, dim otherwise. */
const led = (cx: number, cy: number, on: boolean, p: Paint, r = 2.2): SvgNode =>
  el('circle', { cx, cy, r, fill: on ? accent(p) : MUTED, 'fill-opacity': on ? 1 : 0.3 });

/** A short hairline of vent or grille. */
const slit = (x1: number, y1: number, x2: number, y2: number): SvgNode =>
  el('line', { x1, y1, x2, y2, stroke: METAL_OUT, 'stroke-width': 1.5, 'stroke-linecap': 'round' });

/** The glass of a screen: sunken and dark; lit, it takes a tint of the state colour (off, it shows a glare). */
function screen(x: number, y: number, w: number, h: number, p: Paint, on: boolean): SvgNode[] {
  return [
    sunk(x, y, w, h),
    on
      ? el('rect', { x, y, width: w, height: h, rx: R.sm, fill: accent(p), 'fill-opacity': 0.2 })
      : el('polygon', { points: `${r2(x + 2)},${r2(y + h - 2)} ${r2(x + w * 0.42)},${r2(y + 2)} ${r2(x + w * 0.6)},${r2(y + 2)} ${r2(x + w * 0.2)},${r2(y + h - 2)}`, fill: BASE, 'fill-opacity': 0.3 }),
  ];
}

/** A picture on a lit screen: a sun over two hills. */
function landscape(x: number, y: number, w: number, h: number, a: string): SvgNode[] {
  return [
    el('circle', { cx: r2(x + w * 0.72), cy: r2(y + h * 0.3), r: r2(h * 0.13), fill: a, 'fill-opacity': 0.85 }),
    el('path', { d: `M${x + 3} ${r2(y + h - 3)} L${r2(x + w * 0.32)} ${r2(y + h * 0.5)} L${r2(x + w * 0.52)} ${r2(y + h * 0.72)} L${r2(x + w * 0.72)} ${r2(y + h * 0.5)} L${r2(x + w - 3)} ${r2(y + h - 3)} Z`, fill: a, 'fill-opacity': 0.6, 'stroke-linejoin': 'round' }),
  ];
}

/** Arcs that fan out of a point, pulsing one after the other while the device works. */
function waves(cx: number, cy: number, radii: number[], from: number, to: number, p: Paint, on: boolean): SvgNode[] {
  const a = accent(p);
  return radii.map((r, i) =>
    el('path', { d: arcPath(cx, cy, r, from, to), fill: 'none', stroke: on ? a : MUTED, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-opacity': on ? 1 - i * 0.22 : 0.3 },
      moving(p) ? [el('animate', { attributeName: 'stroke-opacity', values: '0.15;1;0.15', dur: '1.5s', begin: `${r2(i * 0.3)}s`, repeatCount: 'indefinite' })] : undefined));
}

/** A flat-panel TV on two legs: lit, it shows a picture. Data in on the left, power under the bar. */
function tv(p: Paint): Drawn {
  const on = lit(p);
  const a = accent(p);
  return {
    w: 100, h: 100,
    nodes: [
      data(0, 50, 6, 50),
      power(50, 96, 50, 100),
      foot(10, 80),
      part(18, 66, 7, 24), part(75, 66, 7, 24),
      box(6, 14, 88, 52),
      ...screen(11, 19, 78, 38, p, on),
      ...(on ? landscape(11, 19, 78, 38, a) : []),
      led(83, 61.5, on, p, 1.8),
    ],
  };
}

/** A Wi-Fi router: two upright antennas, a row of LEDs and signal arcs pulsing between them. Data both sides, power below. */
function router(p: Paint): Drawn {
  const on = lit(p);
  return {
    w: 100, h: 100,
    nodes: [
      data(0, 50, 10, 50),
      data(90, 50, 100, 50),
      power(50, 76, 50, 100),
      ...waves(50, 36, [8, 15, 22], -138, -42, p, on),
      el('rect', { x: 20, y: 16, width: 6, height: 30, rx: R.sm, fill: SURFACE, stroke: METAL_OUT, 'stroke-width': 2.5 }),
      el('rect', { x: 74, y: 16, width: 6, height: 30, rx: R.sm, fill: SURFACE, stroke: METAL_OUT, 'stroke-width': 2.5 }),
      box(10, 44, 80, 32, R.md),
      ...[0, 1, 2, 3, 4].map((i) => led(24 + i * 9, 55, on && !(p.state === 'critical' && i > 1), p, 2.2)),
      ...[0, 1, 2, 3].map((i) => el('rect', { x: 20 + i * 11, y: 65, width: 8, height: 6, rx: 1.5, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1 })),
      sunk(70, 50, 12, 9),
      ...[0, 1, 2].map((i) => slit(73 + i * 3, 52, 73 + i * 3, 57)),
    ],
  };
}

/** A bullet security camera on a wall bracket, its sun shield over the body and a recording dot that blinks. Data (PoE) left. */
function cameraSecurity(p: Paint): Drawn {
  const a = accent(p);
  const on = lit(p);
  return {
    w: 100, h: 100,
    nodes: [
      data(0, 50, 6, 50),
      box(6, 28, 8, 44, R.sm),
      part(14, 47, 14, 6),
      el('g', { transform: 'rotate(8 28 50)' }, [
        el('rect', { x: 30, y: 31, width: 56, height: 7, rx: R.sm, fill: METAL, stroke: METAL_OUT, 'stroke-width': 1.5 }),
        box(32, 38, 52, 24, R.md),
        part(84, 41, 8, 18),
        el('rect', { x: 90.5, y: 43, width: 3, height: 14, rx: 1, fill: on ? a : MUTED, 'fill-opacity': on ? 0.9 : 0.3 }),
        ...[0, 1].map((i) => el('circle', { cx: 78, cy: 45 + i * 10, r: 1.8, fill: on ? a : MUTED, 'fill-opacity': on ? 0.7 : 0.25 })),
        el('circle', { cx: 42, cy: 50, r: 3.4, fill: on ? a : MUTED, 'fill-opacity': on ? 1 : 0.3 },
          moving(p) ? [el('animate', { attributeName: 'fill-opacity', values: '1;0.25;1', dur: '1.4s', repeatCount: 'indefinite' })] : undefined),
        slit(52, 46, 70, 46), slit(52, 54, 70, 54),
      ]),
      el('circle', { cx: 28, cy: 50, r: 5.4, fill: METAL, stroke: METAL_OUT, 'stroke-width': 2.5 }),
    ],
  };
}

/** A smart plug: a square adaptor with a round socket, an indicator button and a ring that lights while it is switched on. */
function plugSmart(p: Paint): Drawn {
  const a = accent(p);
  const on = lit(p);
  return {
    w: 100, h: 100,
    nodes: [
      power(0, 50, 24, 50),
      power(76, 50, 100, 50),
      box(24, 16, 52, 66, R.md),
      el('circle', { cx: 50, cy: 42, r: 15, fill: SUNKEN, stroke: on ? a : METAL_OUT, 'stroke-width': 2.5, ...(on ? {} : { 'stroke-opacity': 0.55 }) }),
      ...[43, 57].map((x) => el('circle', { cx: x, cy: 42, r: 2.6, fill: METAL_OUT })),
      el('rect', { x: 48.4, y: 30, width: 3.2, height: 3, fill: METAL_OUT }),
      el('rect', { x: 48.4, y: 51, width: 3.2, height: 3, fill: METAL_OUT }),
      el('circle', { cx: 50, cy: 68, r: 6, fill: SUNKEN, stroke: METAL_OUT, 'stroke-width': 1.5 }),
      el('circle', { cx: 50, cy: 68, r: 2.8, fill: on ? a : MUTED, 'fill-opacity': on ? 1 : 0.35 }),
    ],
  };
}

export const HOME_DEFS = {
  'home.tv': { family: 'home', label: 'Television', draw: tv, scaled: true, valueUnder: true },
  'home.router': { family: 'home', label: 'Wi-Fi router', draw: router },
  'home.camera.security': { family: 'home', label: 'Security camera', draw: cameraSecurity },
  'home.plug.smart': { family: 'home', label: 'Smart plug', draw: plugSmart, scaled: true, valueUnder: true },
} as const satisfies Record<string, SymbolDef>;
