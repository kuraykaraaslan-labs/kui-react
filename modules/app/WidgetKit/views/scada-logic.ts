// The pure logic of the process symbol widget (no React): which symbol, in which state, filled how far, and the drawing
// itself as an SVG node tree (`svg-node.ts`). The widget never evaluates a threshold: the source says `warning` or
// `critical` and the symbol only shows it. The drawings are in `scada-symbols-home.ts` (family: home) on the shared rules
// of `scada-draw.ts`. `ScadaSymbolView.tsx` draws the nodes; kui-ejs vendors this file.

import type { SlotData } from '../kind';
import { cssColor } from '../settings/style';
import { rangesToBands } from './gauge-logic';
import { harmonize, type Drawn, type Paint, type ScadaState } from './scada-draw';
import { HOME_DEFS } from './scada-symbols-home';
import { applyStates, readStates } from './scada-states';
import { orient, r2, type Orientation, type SvgNode } from './svg-node';

export type { ScadaState } from './scada-draw';

export type ScadaFamily = 'home';

export interface SymbolDef {
  family: ScadaFamily;
  /** The symbol's name (English; the picker and the screen-reader text). */
  label: string;
  draw: (p: Paint) => Drawn;
  /** The symbol has a scale: a minimum and a maximum apply to its reading. */
  scaled?: boolean;
  /** The reading is also printed under the drawing (the others draw it inside, or have none). */
  valueUnder?: boolean;
  /** A straight run: its length in cells applies. */
  runs?: boolean;
  /** Draws two readings (`value2`) with row names. */
  rows?: boolean;
}

export const SCADA_SYMBOL_DEFS = {
  ...HOME_DEFS,
} as const satisfies Record<string, SymbolDef>;

export type ScadaSymbol = keyof typeof SCADA_SYMBOL_DEFS;
export const SCADA_SYMBOLS = Object.keys(SCADA_SYMBOL_DEFS) as ScadaSymbol[];
export type ScadaStatus = 'none' | 'warning' | 'critical';
export type ScadaMedium = 'none' | 'cold' | 'hot' | 'water' | 'custom';

export const isScadaSymbol = (v: unknown): v is ScadaSymbol => typeof v === 'string' && Object.hasOwn(SCADA_SYMBOL_DEFS, v);

/** The symbols that need a minimum and maximum, a run length, two readings. */
export const SCALED_SYMBOLS = SCADA_SYMBOLS.filter((k) => (SCADA_SYMBOL_DEFS[k] as SymbolDef).scaled);
export const RUN_SYMBOLS = SCADA_SYMBOLS.filter((k) => (SCADA_SYMBOL_DEFS[k] as SymbolDef).runs);
export const VALUE_SYMBOLS = SCADA_SYMBOLS.filter((k) => (SCADA_SYMBOL_DEFS[k] as SymbolDef).valueUnder);

export type ScadaSettings = {
  symbol?: ScadaSymbol | string;
  orientation?: Orientation | number | string;
  mirror?: boolean;
  length?: 1 | 2 | 3 | number | string;
  maxSize?: number | null;
  min?: number;
  max?: number;
  ticks?: boolean;
  fillColor?: string;
  idleColor?: string;
  runningColor?: string;
  warningColor?: string;
  criticalColor?: string;
  medium?: ScadaMedium | string;
  mediumColor?: string;
  showValue?: boolean;
  showLabel?: boolean;
  label?: string;
  rowLabel1?: string;
  rowLabel2?: string;
  ranges?: unknown;
  animation?: boolean;
  arrows?: boolean;
};

/** What the model needs of the platform: reduced motion and the number words (unit included) of the host. */
export interface ScadaModelOptions {
  animate?: boolean;
  format?: (n: number) => string;
}

const bool = (v: unknown): boolean | null => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null) return false;
  if (v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'running', 'open', 'active', 'closed-circuit'].includes(t)) return true;
    if (['false', '0', 'off', 'no', 'stopped', 'closed', 'inactive', ''].includes(t)) return false;
  }
  return null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * The alarm status a source reports. `status` takes the words none / ok / normal, warning / warn, critical / alarm /
 * error / fault, or the numbers 0, 1, 2; a boolean `true` is critical. Alternatively a pair of booleans, `warning`
 * and `critical`; the worse one wins. Nothing bound = none.
 */
export function scadaStatus(status: unknown, warning?: unknown, critical?: unknown): ScadaStatus {
  if (bool(critical) === true) return 'critical';
  const word = typeof status === 'string' ? status.trim().toLowerCase() : status;
  if (typeof word === 'string' && ['critical', 'alarm', 'error', 'fault', 'danger'].includes(word)) return 'critical';
  if (status === true || status === 2 || word === '2') return 'critical';
  if (bool(warning) === true) return 'warning';
  if ((typeof word === 'string' && ['warning', 'warn'].includes(word)) || status === 1 || word === '1') return 'warning';
  return 'none';
}

/** Critical beats warning beats running beats idle. */
export const scadaState = (status: ScadaStatus, running: boolean | null): ScadaState =>
  status === 'critical' ? 'critical' : status === 'warning' ? 'warning' : running ? 'running' : 'idle';

const orientation = (v: unknown): Orientation => {
  const n = Number(v);
  return n === 90 || n === 180 || n === 270 ? n : 0;
};

const MEDIUM_COLOR: Record<string, string | null> = { none: null, cold: 'var(--info)', hot: 'var(--error)', water: 'var(--primary)' };

/** The colour a settings object gives what flows through a connection, or null. */
export function mediumColor(s: ScadaSettings): string | null {
  const m = typeof s.medium === 'string' ? s.medium : 'none';
  return m === 'custom' ? cssColor(s.mediumColor) ?? null : MEDIUM_COLOR[m] ?? null;
}

/** The paint a symbol is drawn with, from its settings and its bound readings. */
export function scadaPaint(s: ScadaSettings, data: Record<string, SlotData | undefined>, o: ScadaModelOptions = {}): Paint {
  const value = num(data.value?.value);
  const min = num(s.min) ?? 0;
  const rawMax = num(data.capacity?.value) ?? num(s.max) ?? 100;
  const max = rawMax > min ? rawMax : min + 1;
  const running = bool(data.running?.value);
  const state = scadaState(scadaStatus(data.status?.value, data.warning?.value, data.critical?.value), running);
  const idle = cssColor(s.idleColor) ?? 'var(--text-secondary)';
  const palette: Record<ScadaState, string> = {
    idle,
    running: cssColor(s.runningColor) ?? 'var(--success)',
    warning: cssColor(s.warningColor) ?? 'var(--warning)',
    critical: cssColor(s.criticalColor) ?? 'var(--error)',
  };
  const color = palette[state];
  return {
    state, color, idle, running: running === true, animate: o.animate !== false && s.animation !== false,
    level: value === null ? null : Math.min(1, Math.max(0, (value - min) / (max - min))),
    // The liquid keeps its own colour until the source reports a warning or an alarm.
    fill: state === 'warning' || state === 'critical' ? color : cssColor(s.fillColor) ?? 'var(--info)',
    bands: rangesToBands(s.ranges),
    min, max, value, value2: num(data.value2?.value), ticks: s.ticks !== false,
    medium: mediumColor(s),
    fmt: o.format ?? ((n) => String(r2(n))),
    rows: [s.rowLabel1?.trim() || 'T1', s.rowLabel2?.trim() || 'T2'],
    length: Math.min(3, Math.max(1, Math.round(Number(s.length) || 1))),
    arrows: s.arrows === true,
    states: readStates((key) => data[key]?.value),
  };
}

/** Draws a symbol by id (turned and flipped as asked): the nodes and their box. */
export function drawScada(symbol: ScadaSymbol, paint: Paint, turn: Orientation = 0, mirror = false): { nodes: SvgNode[]; w: number; h: number } {
  const def = SCADA_SYMBOL_DEFS[symbol] as SymbolDef;
  const drawn = def.draw(paint);
  // Speed and direction act on the drawing before it is turned; the badges are added after, so they never turn or mirror.
  const placed = orient(harmonize(drawn.nodes), drawn.w, drawn.h, turn, mirror);
  // The states layer comes last: badges sit in the corners of the final box and never turn or mirror with the symbol.
  return { nodes: applyStates(placed.nodes, placed.w, placed.h, paint), w: placed.w, h: placed.h };
}

/** Everything the symbol widget draws, decided once. `animate` is false for a viewer who asks for reduced motion. */
export function scadaModel(s: ScadaSettings, data: Record<string, SlotData | undefined>, opts: ScadaModelOptions = {}) {
  const symbol: ScadaSymbol = isScadaSymbol(s.symbol) ? s.symbol : 'home.router';
  const def = SCADA_SYMBOL_DEFS[symbol] as SymbolDef;
  const paint = scadaPaint(s, data, opts);
  const placed = drawScada(symbol, paint, orientation(s.orientation), s.mirror === true);
  const running = bool(data.running?.value);
  const status = scadaStatus(data.status?.value, data.warning?.value, data.critical?.value);
  const labelCell = data.label?.value;
  const label = labelCell !== undefined && labelCell !== null && String(labelCell) !== '' ? String(labelCell) : s.label || '';
  return {
    symbol, family: def.family, name: def.label, state: paint.state, status, running, value: paint.value, value2: paint.value2,
    level: paint.level, min: paint.min, max: paint.max,
    /** Only these symbols print the bound number under the drawing. */
    hasValue: !!def.valueUnder,
    showValue: s.showValue !== false,
    showLabel: s.showLabel !== false && label !== '',
    label,
    unknown: paint.value === null && paint.value2 === null && running === null && status === 'none',
    maxSize: typeof s.maxSize === 'number' && s.maxSize > 0 ? s.maxSize : null,
    viewBox: `0 0 ${placed.w} ${placed.h}`,
    width: placed.w,
    height: placed.h,
    nodes: placed.nodes,
    states: paint.states,
  };
}

export type ScadaModel = ReturnType<typeof scadaModel>;
