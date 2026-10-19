'use client';
// Layout thumbnails: the drawing behind each `preview` id a WidgetKit template's options carry
// (`opt('arc', 'Half circle', 'gauge-arc')`). SchemaForm draws a select with `display: 'cards'` as
// picture cards and asks `renderOptionPreview(id)` for each option's drawing; the settings editor
// passes `renderWidgetPreview` (or the host's `renderPreview`, which wins for the ids it knows).
//
// Every drawing is a 48 x 32 inline SVG in `currentColor` only, at a few opacities, so it takes the
// card's text colour: secondary when idle, primary when picked, and the dark theme for free. The SVG
// is decorative (`aria-hidden`); the option's label next to it is the accessible name.

import type { ReactNode } from 'react';
import { builtinKind } from './templates';

const W = 48;
const H = 32;
const C = 'currentColor';

/** A text line. */
const t = (x: number, y: number, w: number, h = 2, o = 0.45) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={C} opacity={o} />;
/** The main number. */
const n = (x: number, y: number, w: number, h = 5) => <rect x={x} y={y} width={w} height={h} rx={1} fill={C} opacity={0.9} />;
/** A filled block. */
const b = (x: number, y: number, w: number, h: number, o = 0.2, rx = 1.5) => <rect x={x} y={y} width={w} height={h} rx={rx} fill={C} opacity={o} />;
/** An outlined block. */
const box = (x: number, y: number, w: number, h: number, o = 0.5, rx = 1.5) => (
  <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={rx} fill="none" stroke={C} strokeWidth={1} opacity={o} />
);
const dot = (cx: number, cy: number, r: number, o = 0.8) => <circle cx={cx} cy={cy} r={r} fill={C} opacity={o} />;
const ring = (cx: number, cy: number, r: number, o = 0.5, w = 1) => <circle cx={cx} cy={cy} r={r} fill="none" stroke={C} strokeWidth={w} opacity={o} />;
/** A contrasting mark on a solid fill (the card's own surface). */
const hole = (x: number, y: number, w: number, h = 2) => <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="var(--surface-raised)" />;
const line = (d: string, o = 0.85, w = 1.5) => <path d={d} fill="none" stroke={C} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={o} />;

/** A point on a circle; 180 is left, 270 is the top, 360 is right. */
const at = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
};
const arcD = (cx: number, cy: number, r: number, from: number, to: number) =>
  `M ${at(cx, cy, r, from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${at(cx, cy, r, to)}`;
/** A track arc and the share `f` of it drawn over it. */
const meter = (cx: number, cy: number, r: number, from: number, to: number, f: number, w = 3.5) => (
  <>
    {line(arcD(cx, cy, r, from, to), 0.2, w)}
    {line(arcD(cx, cy, r, from, from + (to - from) * f), 0.85, w)}
  </>
);
/** A full ring and the share `f` of it from the top. */
const donut = (cx: number, cy: number, r: number, f: number, w = 4) => (
  <>
    {ring(cx, cy, r, 0.2, w)}
    {line(arcD(cx, cy, r, -90, -90 + 359.9 * f), 0.85, w)}
  </>
);
/** A small trend line in the box (x, y, w, h). */
const spark = (x: number, y: number, w: number, h: number, area = false) => {
  const ys = [0.7, 0.45, 0.6, 0.2, 0.4, 0.05];
  const pts = ys.map((v, i) => `${(x + (w * i) / (ys.length - 1)).toFixed(1)} ${(y + h * v).toFixed(1)}`);
  return (
    <>
      {area && <path d={`M ${x} ${y + h} L ${pts.join(' L ')} L ${x + w} ${y + h} Z`} fill={C} opacity={0.15} />}
      {line(`M ${pts.join(' L ')}`)}
    </>
  );
};
/** A horizontal bar: track and a filled share `f`. */
const bar = (x: number, y: number, w: number, h: number, f: number) => (
  <>
    {b(x, y, w, h, 0.2, h / 2)}
    {b(x, y, w * f, h, 0.85, h / 2)}
  </>
);
/** A switch, on. */
const toggle = (x: number, y: number, w = 12, h = 6) => (
  <>
    {b(x, y, w, h, 0.85, h / 2)}
    <circle cx={x + w - h / 2} cy={y + h / 2} r={h / 2 - 1} fill="var(--surface-raised)" />
  </>
);
/** A slider track with its knob at share `f`. */
const slider = (x: number, y: number, w: number, f: number) => (
  <>
    {b(x, y - 1, w, 2, 0.25, 1)}
    {b(x, y - 1, w * f, 2, 0.85, 1)}
    {dot(x + w * f, y, 2.5, 1)}
  </>
);
const wedge = (cx: number, cy: number, r: number, from: number, to: number, o: number) => (
  <path d={`M ${cx} ${cy} L ${at(cx, cy, r, from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${at(cx, cy, r, to)} Z`} fill={C} opacity={o} />
);
const plus = (cx: number, cy: number) => line(`M ${cx - 2} ${cy} H ${cx + 2} M ${cx} ${cy - 2} V ${cy + 2}`, 0.85, 1);
const minus = (cx: number, cy: number) => line(`M ${cx - 2} ${cy} H ${cx + 2}`, 0.85, 1);

/** One row per `y`, drawn by `draw`, with a separator under each but the last. */
const rows = (ys: number[], draw: (y: number) => ReactNode, sep = true) => ys.map((y, i) => (
  <g key={y}>
    {draw(y)}
    {sep && i < ys.length - 1 && <rect x={5} y={y + 4.5} width={38} height={0.5} fill={C} opacity={0.2} />}
  </g>
));

/** The drawings, by preview id. `frame: false` drops the faint card outline (the card styles draw their own). */
const DRAWINGS: Record<string, { body: ReactNode; frame?: boolean }> = {
  // Single value
  'stat-stacked': { body: <>{dot(8, 8, 3, 0.4)}{t(5, 15, 16)}{n(5, 20, 22, 6)}</> },
  'stat-inline': { body: <>{dot(11, 16, 5, 0.35)}{t(20, 10, 16)}{n(20, 15, 20, 6)}</> },
  'stat-centered': { body: <>{dot(24, 8, 3, 0.4)}{n(14, 14, 20, 6)}{t(16, 23, 16)}</> },
  'stat-compact': { body: <>{dot(9, 16, 3, 0.4)}{t(15, 15, 14)}{n(32, 13.5, 11, 5)}</> },
  'spark-stacked': { body: <>{spark(5, 5, 38, 10)}{t(5, 19, 12)}{n(5, 23, 18, 5)}</> },
  'spark-value-top': { body: <>{n(5, 5, 18, 5)}{t(5, 12.5, 12)}{spark(5, 17, 38, 10)}</> },
  'spark-inline': { body: <>{t(5, 10, 12)}{n(5, 14, 14, 6)}{spark(23, 9, 20, 14)}</> },
  'spark-overlay': { body: <>{spark(3, 11, 42, 18, true)}{n(14, 9, 20, 6)}</> },
  'spark-chart-only': { body: spark(5, 6, 38, 20, true) },
  'attributes-list': { body: rows([7, 15, 23], (y) => <>{t(5, y, 12)}{t(29, y, 14, 2, 0.85)}</>) },
  'attributes-grid-2': {
    body: [[5, 6], [25, 6], [5, 18], [25, 18]].map(([x, y]) => <g key={`${x}-${y}`}>{t(x, y, 12)}{n(x, y + 4, 14, 3.5)}</g>),
  },
  'attributes-grid-3': {
    body: [5, 19, 33].flatMap((x) => [6, 18].map((y) => <g key={`${x}-${y}`}>{t(x, y, 9)}{n(x, y + 4, 10, 3.5)}</g>)),
  },
  'attributes-columns': {
    body: [5, 15, 25, 35].map((x) => <g key={x}>{t(x, 12, 7)}{n(x, 16, 8, 3.5)}</g>),
  },
  // Gauge and progress
  'gauge-arc': { body: <>{meter(24, 25, 15, 180, 360, 0.65, 4)}{n(19, 20, 10, 4)}</> },
  'gauge-donut': { body: <>{donut(24, 16, 11, 0.65)}{n(19.5, 14, 9, 4)}</> },
  'gauge-bar-h': { body: <>{t(5, 8, 14)}{n(32, 6.5, 11, 4)}{bar(5, 17, 38, 5, 0.6)}{t(5, 25, 4, 1.5, 0.3)}{t(39, 25, 4, 1.5, 0.3)}</> },
  'gauge-bar-v': { body: <>{b(17, 4, 8, 24, 0.2, 2)}{b(17, 12, 8, 16, 0.85, 2)}{n(30, 12, 11, 4)}{t(30, 19, 8)}</> },
  'gauge-level': {
    body: <>{box(20, 3, 8, 22, 0.6, 4)}{ring(24, 25.5, 4.5, 0.6)}{dot(24, 25.5, 3, 0.85)}{b(23, 11, 2, 13, 0.85, 1)}{t(31, 9, 8, 1.5, 0.3)}{t(31, 15, 8, 1.5, 0.3)}</>,
  },
  'progress-bar-labelled': { body: <>{t(5, 8, 14)}{n(31, 6.5, 12, 4)}{bar(5, 18, 38, 4, 0.7)}</> },
  'progress-bar': { body: <>{t(5, 9, 14)}{bar(5, 16, 27, 4, 0.7)}{n(35, 15.5, 8, 4)}</> },
  'progress-ring': { body: <>{donut(24, 16, 10, 0.7, 3.5)}{n(20, 14, 8, 4)}</> },
  'progress-semicircle': { body: <>{meter(24, 25, 14, 180, 360, 0.7, 3.5)}{n(19.5, 20, 9, 4)}</> },
  // State
  'state-big': { body: <>{t(14, 8, 20)}{n(10, 14, 28, 8)}</> },
  'state-badge': { body: <>{t(16, 7, 16)}{b(12, 14, 24, 9, 0.85, 4.5)}{hole(17, 17.5, 14)}</> },
  'state-dot': { body: <>{dot(12, 16, 3, 0.85)}{t(18, 15, 20, 2.5, 0.75)}</> },
  'state-tile': { body: <>{b(4, 4, 40, 24, 0.25, 2)}{t(10, 9, 14)}{n(10, 15, 28, 6)}</> },
  'state-icon': { body: <>{dot(24, 13, 7, 0.4)}{dot(24, 13, 3, 0.9)}{t(16, 24, 16)}</> },
  // Feed
  'feed-timeline': {
    body: <>{b(8.5, 6, 1, 20, 0.3, 0.5)}{[8, 16, 24].map((y, i) => <g key={y}>{dot(9, y, 2)}{t(14, y - 1, [26, 21, 24][i])}</g>)}</>,
  },
  'feed-list': { body: rows([7, 15, 23], (y) => <>{t(5, y, 24, 2, 0.75)}{t(35, y, 8, 2, 0.3)}</>) },
  'feed-compact': { body: [6, 11, 16, 21, 26].map((y) => <g key={y}>{t(5, y, 26, 1.5, 0.6)}{t(36, y, 7, 1.5, 0.3)}</g>) },
  'feed-cards': { body: [4, 17].map((y) => <g key={y}>{box(5, y, 38, 11)}{t(9, y + 3, 20, 2, 0.75)}{t(9, y + 7, 28, 1.5, 0.35)}</g>) },
  // Controls
  'button-button': { body: <>{b(9, 11, 30, 10, 0.85, 2)}{hole(16, 15, 16)}</> },
  'button-tile': { body: <>{box(14, 4, 20, 24, 0.6, 3)}{dot(24, 13, 3.5)}{t(18, 21, 12)}</> },
  'button-icon': { body: <>{dot(24, 16, 9, 0.85)}<circle cx={24} cy={16} r={3} fill="var(--surface-raised)" /></> },
  'button-fab': { body: <>{b(8, 11, 32, 10, 0.85, 5)}<circle cx={14.5} cy={16} r={2} fill="var(--surface-raised)" />{hole(19, 15, 16)}</> },
  'switch-right': { body: <>{t(5, 11, 16, 2, 0.75)}{t(5, 17, 10)}{toggle(31, 12)}</> },
  'switch-left': { body: <>{toggle(5, 12)}{t(21, 11, 18, 2, 0.75)}{t(21, 17, 10)}</> },
  'switch-centered': { body: <>{toggle(15, 7, 18, 9)}{t(16, 22, 16)}</> },
  'slider-default': { body: <>{t(5, 7, 14)}{n(33, 5.5, 10, 4)}{slider(5, 20, 38, 0.55)}</> },
  'slider-extended': { body: <>{n(16, 5, 16, 7)}{t(18, 14.5, 12)}{slider(5, 23, 38, 0.55)}</> },
  'slider-compact': { body: <>{t(5, 15, 8)}{slider(16, 16, 19, 0.55)}{n(38, 14, 6, 4)}</> },
  'setpoint-input': { body: <>{t(5, 6, 14)}{box(5, 13, 26, 10)}{t(8, 17, 10)}{b(33, 13, 10, 10, 0.85, 1.5)}</> },
  'setpoint-stepper': { body: <>{box(5, 11, 10, 10)}{minus(10, 16)}{n(19, 13.5, 10, 5)}{box(33, 11, 10, 10)}{plus(38, 16)}</> },
  'setpoint-dial': { body: <>{donut(24, 15, 10, 0.6, 3)}{n(20, 13, 8, 4)}{ring(9, 24, 3, 0.6)}{minus(9, 24)}{ring(39, 24, 3, 0.6)}{plus(39, 24)}</> },
  // Charts
  'line-smooth': { body: <>{b(5, 26, 38, 0.5, 0.3, 0)}{line('M 5 22 C 12 22, 13 9, 20 10 S 29 21, 34 15 S 40 6, 43 6')}</> },
  'line-linear': { body: <>{b(5, 26, 38, 0.5, 0.3, 0)}{line('M 5 22 L 14 11 L 22 17 L 32 8 L 43 13')}</> },
  'line-step': { body: <>{b(5, 26, 38, 0.5, 0.3, 0)}{line('M 5 22 H 13 V 12 H 22 V 18 H 31 V 8 H 43')}</> },
  'pie-pie': { body: <>{dot(24, 16, 12, 0.2)}{wedge(24, 16, 12, -90, 60, 0.85)}{wedge(24, 16, 12, 60, 160, 0.5)}</> },
  'pie-donut': { body: <>{ring(24, 16, 10, 0.2, 5)}{line(arcD(24, 16, 10, -90, 60), 0.85, 5)}{line(arcD(24, 16, 10, 64, 160), 0.5, 5)}</> },
  'pie-donut-total': {
    body: <>{ring(24, 16, 11, 0.2, 4)}{line(arcD(24, 16, 11, -90, 60), 0.85, 4)}{line(arcD(24, 16, 11, 64, 160), 0.5, 4)}{n(20, 13, 8, 3.5)}{t(21, 18, 6, 1.5)}</>,
  },
  // Content
  'links-list': { body: rows([7, 15, 23], (y) => <>{dot(7, y + 1, 1.5, 0.6)}{t(11, y, 22, 2, 0.75)}</>) },
  'links-grid': { body: [[5, 5], [25, 5], [5, 17], [25, 17]].map(([x, y]) => <g key={`${x}-${y}`}>{box(x, y, 18, 10)}{t(x + 3, y + 4, 10)}</g>) },
  'links-tiles': { body: [5, 18, 31].map((x) => <g key={x}>{box(x, 7, 12, 12)}{dot(x + 6, 13, 2, 0.6)}{t(x + 1, 22, 10, 1.5)}</g>) },
  'links-buttons': { body: <>{b(5, 7, 17, 7, 0.3, 3.5)}{b(25, 7, 18, 7, 0.3, 3.5)}{b(5, 18, 22, 7, 0.3, 3.5)}</> },
  'markdown-plain': { body: <>{n(5, 5, 20, 3.5)}{t(5, 13, 38)}{t(5, 18, 34)}{t(5, 23, 26)}</> },
  'markdown-callout': { body: <>{b(4, 4, 40, 24, 0.15, 2)}{b(4, 4, 2, 24, 0.85, 1)}{t(10, 9, 28, 2, 0.75)}{t(10, 15, 30)}{t(10, 20, 22)}</> },
  // Card styles
  'card-raised': {
    frame: false,
    body: <>{b(9, 8, 33, 21, 0.25, 3)}<rect x={6.5} y={4.5} width={33} height={21} rx={3} fill="var(--surface-raised)" stroke={C} strokeOpacity={0.3} />{t(11, 10, 14, 2, 0.75)}{n(11, 15, 18, 5)}</>,
  },
  'card-flat': { frame: false, body: <>{b(6, 5, 36, 22, 0.15, 3)}{t(11, 10, 14, 2, 0.75)}{n(11, 15, 18, 5)}</> },
  'card-outline': { frame: false, body: <>{box(6, 5, 36, 22, 0.7, 3)}{t(11, 10, 14, 2, 0.75)}{n(11, 15, 18, 5)}</> },
  'card-plain': {
    frame: false,
    body: <><rect x={6.5} y={5.5} width={35} height={21} rx={3} fill="none" stroke={C} strokeOpacity={0.25} strokeDasharray="2 2" />{t(11, 10, 14, 2, 0.75)}{n(11, 15, 18, 5)}</>,
  },
};

/** A map pin with its tip at (x, y). */
const pin = (x: number, y: number, o = 0.85) => (
  <>
    <path d={`M ${x} ${y} C ${x - 1} ${y - 3}, ${x - 3.5} ${y - 4.5}, ${x - 3.5} ${y - 7} A 3.5 3.5 0 1 1 ${x + 3.5} ${y - 7} C ${x + 3.5} ${y - 4.5}, ${x + 1} ${y - 3}, ${x} ${y} Z`} fill={C} opacity={o} />
    <circle cx={x} cy={y - 7} r={1.3} fill="var(--surface-raised)" />
  </>
);
const axis = () => <>{b(5, 26, 38, 0.5, 0.3, 0)}{b(5, 5, 0.5, 21, 0.3, 0)}</>;

/**
 * The thumbnail of a widget TYPE, for a catalog or picker, by type: the types whose layout options
 * carry no picture (bars, tables, maps, ...) are drawn here; the rest use their layout's drawing.
 */
const TYPE_DRAWINGS: Record<string, { body: ReactNode; frame?: boolean }> = {
  'chart.bar': { body: <>{axis()}{[[8, 12], [15, 7], [22, 15], [29, 10], [36, 4]].map(([x, h]) => <g key={x}>{b(x, 6 + h, 5, 20 - h, 0.8, 1)}</g>)}</> },
  'chart.area': { body: <>{b(5, 26, 38, 0.5, 0.3, 0)}{spark(5, 7, 38, 19, true)}</> },
  'chart.scatter': {
    body: <>{axis()}{[[10, 21], [14, 17], [18, 19], [21, 13], [26, 15], [29, 10], [33, 12], [37, 7], [40, 9]].map(([x, y]) => <g key={`${x}-${y}`}>{dot(x, y, 1.4, 0.75)}</g>)}</>,
  },
  'chart.histogram': {
    body: <>{b(5, 26, 38, 0.5, 0.3, 0)}{[3, 7, 13, 18, 14, 8, 4].map((h, i) => <g key={i}>{b(7 + i * 5, 26 - h, 4.6, h, 0.8, 0.5)}</g>)}</>,
  },
  heatmap: {
    body: [0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4, 5].map((c) => (
      <g key={`${r}-${c}`}>{b(5 + c * 6.5, 5 + r * 5.75, 5.5, 4.75, [0.15, 0.35, 0.6, 0.85][(r * 3 + c * 2 + (r * c) % 3) % 4], 0.75)}</g>
    ))),
  },
  'data.table': {
    body: <>{b(4, 4, 40, 5, 0.25, 1)}{t(7, 5.5, 10, 2, 0.75)}{t(21, 5.5, 8, 2, 0.75)}{t(34, 5.5, 7, 2, 0.75)}
      {rows([13, 19, 25], (y) => <>{t(7, y, 11)}{t(21, y, 9)}{t(34, y, 7, 2, 0.75)}</>)}</>,
  },
  map: {
    body: <>
      {b(3, 3, 42, 26, 0.12, 2)}
      <path d="M 3 20 C 10 17, 14 24, 22 21 S 34 12, 45 15" fill="none" stroke={C} strokeWidth={1} strokeDasharray="2 1.5" opacity={0.4} />
      {pin(15, 19)}{pin(31, 15, 0.6)}{pin(38, 25, 0.45)}
    </>,
  },
  'viewer.model': {
    body: <>
      <path d="M 24 5 L 34 10.5 L 24 16 L 14 10.5 Z" fill={C} opacity={0.35} />
      <path d="M 14 10.5 L 24 16 L 24 27 L 14 21.5 Z" fill={C} opacity={0.6} />
      <path d="M 34 10.5 L 24 16 L 24 27 L 34 21.5 Z" fill={C} opacity={0.85} />
    </>,
  },
  'content.image': {
    body: <>{b(5, 4, 38, 24, 0.12, 2)}{dot(34, 10, 3, 0.5)}<path d="M 5 28 L 17 13 L 26 23 L 31 18 L 43 28 Z" fill={C} opacity={0.6} /></>,
  },
  'content.video': {
    body: <>{b(4, 4, 40, 24, 0.85, 2)}<path d="M 21 10 L 29 15 L 21 20 Z" fill="var(--surface-raised)" />
      {b(8, 24, 32, 1.5, 0.35, 0.75)}{b(8, 24, 13, 1.5, 1, 0.75)}<circle cx={21} cy={24.75} r={1.6} fill="var(--surface-raised)" /></>,
  },
  'content.embed': {
    body: <>{box(4, 3, 40, 26)}{b(4, 3, 40, 5, 0.2, 1.5)}{dot(7.5, 5.5, 0.9, 0.6)}{dot(10.5, 5.5, 0.9, 0.6)}{dot(13.5, 5.5, 0.9, 0.6)}
      {t(8, 12, 22, 2, 0.75)}{t(8, 17, 30)}{t(8, 21, 26)}{t(8, 25, 18)}</>,
  },
};

/** The `preview` id of the layout option a type's settings pick (its first picture-card select). */
function layoutPreviewOf(type: string, settings?: Record<string, unknown> | null): string | null {
  const kind = builtinKind(type);
  if (!kind) return null;
  for (const [key, f] of Object.entries(kind.template.fields)) {
    if (f.type !== 'select' || f.display !== 'cards' || !f.options?.length) continue;
    const pics = f.options.filter((o) => typeof o !== 'string' && o.preview) as { value: string; preview?: string }[];
    if (pics.length === 0) continue;
    const picked = settings?.[key] ?? f.value;
    return (pics.find((o) => o.value === picked) ?? pics[0]).preview ?? null;
  }
  return null;
}

const svg = (id: string, d: { body: ReactNode; frame?: boolean }, className: string) => (
  <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" focusable="false" data-preview-id={id} className={className}>
    {d.frame !== false && <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={3} fill="none" stroke={C} strokeOpacity={0.25} />}
    {d.body}
  </svg>
);

const own = <T,>(rec: Record<string, T>, key: string): T | undefined =>
  (Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined);

/** Every widget type with a drawing of its own (the others borrow their layout's). */
export const WIDGET_TYPE_PREVIEW_TYPES: readonly string[] = Object.keys(TYPE_DRAWINGS);

/**
 * A static thumbnail of a builtin widget type, for a catalog or an "add widget" picker: the same
 * `currentColor` drawings as the layout cards, so nothing mounts, nothing queries and no text can
 * overflow. `settings` (a preset's defaults) picks the layout variant to draw. `null` for a type
 * WidgetKit does not know. `className` sizes it (default: as wide as a layout card).
 */
export function renderWidgetTypePreview(
  type: string,
  settings?: Record<string, unknown> | null,
  className = 'block h-auto w-full max-w-16',
): ReactNode {
  const mine = own(TYPE_DRAWINGS, type);
  if (mine) return svg(`type:${type}`, mine, className);
  const id = layoutPreviewOf(type, settings);
  const d = id ? own(DRAWINGS, id) : undefined;
  return id && d ? svg(id, d, className) : null;
}

/** Every preview id WidgetKit draws. */
export const WIDGET_PREVIEW_IDS: readonly string[] = Object.keys(DRAWINGS);

/**
 * The thumbnail of a WidgetKit layout variant, or `null` for an id it does not know (the card then
 * shows its label only). Pass it to SchemaForm's `renderOptionPreview`.
 */
export function renderWidgetPreview(id: string): ReactNode {
  const d = own(DRAWINGS, id);
  return d ? svg(id, d, 'block h-auto w-full max-w-16') : null;
}
