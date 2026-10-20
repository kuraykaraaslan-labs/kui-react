import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { builtinKind } from '../../templates';
import { resolvePlacement } from '../../settings/resolve';
import { primaryMeta } from '../../settings/source-meta';
import { DEFAULT_WIDGET_KIT_MESSAGES as M } from '../../messages';
import type { Sparse } from '../../settings/types';
import { seriesChartModel } from '../../views/series-chart-logic';
import { pieChartModel } from '../../views/pie-chart-logic';
import { scatterChartModel } from '../../views/scatter-chart-logic';
import { histogramChartModel } from '../../views/histogram-chart-logic';
import { heatmapModel } from '../../views/heatmap-logic';
import { mapModel } from '../../views/map-logic';
import { controlHostOf, type ControlHost } from '../../views/control-common';
import { controlButtonModel } from '../../views/control-button-logic';
import { controlSwitchModel } from '../../views/control-switch-logic';
import { controlSliderModel } from '../../views/control-slider-logic';
import { controlSetpointModel } from '../../views/control-setpoint-logic';
import { controlFormModel } from '../../views/control-form-logic';
import { videoModel } from '../../views/content-model';
import { MODEL_CASES, MODEL_LOCALE, MODEL_NOW, type ModelCase } from './model-cases';

/**
 * The model-level reference of the kinds that cannot be compared as static HTML (charts, map, controls, video):
 * `model-golden.json` holds, for each case in `model-cases.ts`, the effective settings and format the model was
 * given (`input`) and what it decided (`model`). kui-ejs and KUInative vendor both files, build the same input from
 * the case with their own settings resolver and run their copy of the pure model (or map the golden to their markup),
 * and must get the same JSON. A change to a model that changes its output fails here until the golden file is
 * regenerated, which is the signal that the siblings follow:
 *
 *   UPDATE_PARITY_GOLDEN=1 npx vitest run modules/app/WidgetKit/tests/parity
 *
 * What is not in the JSON, and why: a formatter is its `NumberFormatSpec` (`{ base, override?, mode? }`, rebuilt with
 * `numberFormatter`), not a function; the series-chart tooltip value format is `{ fallback, bySeries }` specs; the
 * heatmap band colouring is the data `bands` + `bandEdges` (`heatColorFor`); a map's `resolveUrl`, a control's
 * `onControl` and the layer toggles are host facts (`host`) or viewer state, never model output.
 */
const FILE = resolve(import.meta.dirname, 'model-golden.json');
const UPDATE = process.env.UPDATE_PARITY_GOLDEN === '1';

const SERIES_PRESET = { 'chart.line': 'line', 'chart.bar': 'bar', 'chart.area': 'area' } as const;

type Resolved = { settings: Sparse; format: Sparse };

/** The effective settings and format of a case, resolved the way `PlacementCard` does. */
export function resolveCase(c: ModelCase): Resolved {
  const kind = builtinKind(c.kind)!;
  const data = c.data ?? {};
  const stored = { ...(c.settings ?? {}), ...(c.format ? { $format: c.format } : {}) };
  const r = resolvePlacement({ template: kind.template, slotCount: kind.slots.length, settings: stored, sourceMeta: primaryMeta(kind.slots, data) });
  return { settings: r.settings, format: r.format as Sparse };
}

/** What the model of a case's kind decides. */
export function modelOf(c: ModelCase, r: Resolved = resolveCase(c)): unknown {
  const s = r.settings;
  const format = r.format;
  const data = c.data ?? {};
  const locale = c.locale ?? MODEL_LOCALE;
  const h = c.host ?? {};
  const prefix = h.resolveUrlPrefix;
  const resolveUrl = prefix === undefined ? undefined : (u: string) => (u.startsWith('/') ? `${prefix}${u}` : u);
  const control: ControlHost = controlHostOf({
    onControl: h.connected ? (async () => undefined) : undefined,
    stale: h.stale, controlDisabledReason: h.disabledReason, confirm: h.confirm, title: h.title, pressed: h.pressed,
  }, M.controls);
  const preset = SERIES_PRESET[c.kind as keyof typeof SERIES_PRESET];
  if (preset) return seriesChartModel(preset, s, format, data, locale, M.charts);
  switch (c.kind) {
    case 'chart.pie': return pieChartModel(s, format, data, M.charts, h.box);
    case 'chart.scatter': return scatterChartModel(s, data, M.charts);
    case 'chart.histogram': return histogramChartModel(s, format, data, locale, M.charts);
    case 'heatmap': return heatmapModel(s, format, data, locale, M.charts);
    case 'map':
      return mapModel(s, data, locale, {
        messages: { map: M.map, common: M.common }, resolveUrl, tiles: h.tiles as never, layerLabels: h.layerLabels,
        hasMarkerClick: h.hasMarkerClick, hasNavigate: h.hasNavigate, imagery: h.imagery as never, movable: h.movable,
      });
    case 'control.button': return controlButtonModel(s, control);
    case 'control.switch': return controlSwitchModel(s, data.value?.value, control);
    case 'control.slider': return controlSliderModel(s, data.value?.value, format, control);
    case 'control.setpoint': return controlSetpointModel(s, data.value?.value, format, locale, control);
    case 'control.form': return controlFormModel(s, data, locale, control);
    case 'content.video': return videoModel(s, data, resolveUrl, h.title, locale, M.content);
    default: throw new Error(`no model for ${c.kind}`);
  }
}

/** The path of the first thing JSON would lose or distort (a function, a Map, NaN / Infinity), or null. */
function notPlain(v: unknown, path = '$'): string | null {
  if (typeof v === 'function') return `${path} is a function`;
  if (typeof v === 'number' && !Number.isFinite(v)) return `${path} is ${v}`;
  if (v instanceof Map || v instanceof Set) return `${path} is a ${v.constructor.name}`;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) { const p = notPlain(v[i], `${path}[${i}]`); if (p) return p; }
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { const p = notPlain(x, `${path}.${k}`); if (p) return p; }
  }
  return null;
}

const compute = () => MODEL_CASES.map((c) => {
  const input = resolveCase(c);
  const model = modelOf(c, input);
  return { ...c, input, model };
});

describe('widget model goldens', () => {
  it('has unique case ids, builtin kinds and 5 to 8 cases per kind family', () => {
    expect(new Set(MODEL_CASES.map((c) => c.id)).size).toBe(MODEL_CASES.length);
    for (const c of MODEL_CASES) expect(builtinKind(c.kind), c.id).toBeDefined();
    const family = (k: string) => (k.startsWith('chart.') || k === 'heatmap' ? 'charts' : k.startsWith('control.') ? 'controls' : k);
    const count = new Map<string, number>();
    for (const c of MODEL_CASES) count.set(family(c.kind), (count.get(family(c.kind)) ?? 0) + 1);
    for (const [f, n] of count) expect(n, f).toBeGreaterThanOrEqual(5);
  });

  it('computes plain JSON for every case (no function, Map or NaN in a model)', () => {
    for (const c of compute()) {
      expect(notPlain(c.model), c.id).toBeNull();
      expect(JSON.stringify(c.model), c.id).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('matches model-golden.json (UPDATE_PARITY_GOLDEN=1 rewrites it)', () => {
    const drawn = compute();
    if (UPDATE || !existsSync(FILE)) {
      writeFileSync(FILE, `${JSON.stringify({ now: MODEL_NOW, locale: MODEL_LOCALE, cases: drawn }, null, 1)}\n`);
      return;
    }
    const golden = JSON.parse(readFileSync(FILE, 'utf8')) as { cases: Array<{ id: string }> };
    expect(golden.cases.map((c) => c.id)).toEqual(drawn.map((d) => d.id));
    for (const d of drawn) expect(JSON.parse(JSON.stringify(d)), d.id).toEqual(golden.cases.find((c) => c.id === d.id));
    expect(golden.cases).toEqual(JSON.parse(JSON.stringify(drawn)));
  });
});
