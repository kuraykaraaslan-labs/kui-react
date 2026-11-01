// Pure data shaping for the chart views (no React): repeatable slot merging, series for the
// band and time axes, per-series settings, pie slices, scatter groups, histogram bins, heatmap
// cells and CSV rows. Behaviour matches next-boilerplate's renderers it replaces
// (series-chart, series-config, general-logic, widget-logic).

import type { PointShape, Series } from '@/modules/ui/Chart';
import { niceStep } from '@/modules/ui/Chart/charts/_helpers';
import { clockText, dayMonthText } from '@/modules/ui/Chart/charts/_time';
import type { SlotData } from '../kind';
import { metaLabel } from '../settings/source-meta';
import { cssColor, formatValue, type ValueFormat, type ValueFormatOverride } from '../settings/style';

type Row = Record<string, unknown>;
type Data = Record<string, SlotData | undefined>;

/**
 * A number formatter as plain data, so a model stays JSON and a sibling can rebuild the function:
 * `plain` = `formatValue(v, base, override)`; `tick` = a value axis tick (a whole value prints without decimals,
 * unless the notation is compact); `compact` = a legend / scale end (compact, no forced decimals on whole numbers);
 * `round` = the rounded integer as plain text (`String(Math.round(v))`, a count); `round2` = rounded to two decimals as
 * plain text (`String(Math.round(v * 100) / 100)`). `base` is ignored by the last two.
 */
export interface NumberFormatSpec {
  base: ValueFormat;
  override?: ValueFormatOverride;
  mode?: 'plain' | 'tick' | 'compact' | 'round' | 'round2';
}

/** The function a `NumberFormatSpec` describes. */
export function numberFormatter(spec: NumberFormatSpec, locale?: string): (v: number) => string {
  const { base, override = {}, mode = 'plain' } = spec;
  if (mode === 'round') return (v) => String(Math.round(v));
  if (mode === 'round2') return (v) => String(Math.round(v * 100) / 100);
  if (mode === 'tick') return (v) => formatValue(v, base, Number.isInteger(v) && base.notation !== 'compact' ? { ...override, decimals: 0 } : override, locale);
  if (mode === 'compact') return (v) => formatValue(v, { ...base, notation: 'compact', decimals: Number.isInteger(v) ? undefined : base.decimals }, {}, locale);
  return (v) => formatValue(v, base, override, locale);
}

/** A chart series as data: the per-series formatter is a `NumberFormatSpec` instead of a function. */
export type SeriesSpec = Omit<Series, 'format'> & { format?: NumberFormatSpec };

/** Series data → the series the ui Chart draws (formatter specs become functions). */
export function withFormatters(series: SeriesSpec[], locale?: string): Series[] {
  return series.map((s) => ({ ...s, format: s.format ? numberFormatter(s.format, locale) : undefined }) as Series);
}

/** A result value as a finite number, or null. */
export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const SUFFIX = /^([^#]+)#([2-8])$/;

/** Every key of `data` that belongs to slot `base`, in source order (`series`, `series#2`, …). */
export function slotKeysOf(base: string, keys: Iterable<string>): string[] {
  const n = (k: string) => {
    const m = SUFFIX.exec(k);
    return m && m[1] === base ? Number(m[2]) : k === base ? 1 : 0;
  };
  return [...keys].filter((k) => n(k) > 0).sort((a, b) => n(a) - n(b));
}

/**
 * One result out of every source bound to a repeatable slot. A source that answered nothing is
 * skipped; a name repeated by a later source becomes `<name> (<n>)` so legend toggling and
 * per-series settings stay unambiguous.
 */
export function mergeSeriesSlots(data: Data | undefined, base = 'series'): SlotData | undefined {
  if (!data) return undefined;
  const keys = slotKeysOf(base, Object.keys(data)).filter((k) => data[k]);
  if (keys.length <= 1) return keys.length === 1 ? data[keys[0]] : undefined;
  const seen = new Map<string, number>();
  const merged: NonNullable<SlotData['series']> = [];
  for (const key of keys) {
    for (const s of data[key]?.series ?? []) {
      const count = (seen.get(s.name) ?? 0) + 1;
      seen.set(s.name, count);
      merged.push(count === 1 ? s : { ...s, name: `${s.name} (${count})` });
    }
  }
  return { ...data[keys[0]], shape: 'series', series: merged };
}

const DAY_MS = 24 * 3_600_000;

/**
 * Short category labels for timestamps: `HH:mm` within two days, `d MMM` for daily data (`d MMM HH:mm`
 * when points are closer than a day), `MMM yy` past four months. Non-dates pass through.
 */
export function formatAxisLabels(labels: string[], locale?: string, timeZone?: string): string[] {
  const times = labels.map((l) => Date.parse(l));
  if (times.length === 0 || times.some((t) => Number.isNaN(t))) return labels;
  const spanMs = Math.max(...times) - Math.min(...times);
  const sorted = [...times].sort((a, b) => a - b);
  const minGap = sorted.slice(1).reduce((m, t, i) => Math.min(m, t - sorted[i]), Infinity);
  if (spanMs <= 2 * DAY_MS) return times.map((t) => clockText(t, locale, timeZone));
  if (spanMs <= 120 * DAY_MS) {
    return times.map((t) => (minGap < DAY_MS ? `${dayMonthText(t, locale, timeZone)} ${clockText(t, locale, timeZone)}` : dayMonthText(t, locale, timeZone)));
  }
  return times.map((t) => new Date(t).toLocaleDateString(locale, { year: '2-digit', month: 'short', ...(timeZone ? { timeZone } : {}) }));
}

/**
 * The name a series is shown under: the label its source gives it, in the viewer's language, else its key. The id stays the key, which the `series`
 * rules match. Before, every legend read the raw key (`savak_seviyesi`, `charger.value`; next-boilerplate e2e run 1, V3-B7).
 */
function seriesName(s: NonNullable<SlotData['series']>[number], locale?: string): string {
  return metaLabel(s.meta?.label, locale)?.trim() || s.name;
}

/** Band-axis series: every series aligned onto the union of timestamps (no shifted second series). */
export function toBandSeries(result: SlotData | undefined, locale?: string): Series[] | null {
  const series = result?.series;
  if (!series || series.length === 0) return null;
  const stamps = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort();
  if (stamps.length === 0) return null;
  const labels = formatAxisLabels(stamps, locale, result?.window?.explicitTimezone);
  return series.map((s) => {
    const byT = new Map(s.points.map((p) => [p.t, p.v]));
    return { id: s.name, name: seriesName(s, locale), data: stamps.map((t, i) => ({ x: labels[i], y: byT.get(t) ?? null })) };
  });
}

/**
 * The instant (epoch ms) of each category of `toBandSeries`, in the same order, for a range selection on a band axis of
 * timestamps (a bar chart, a stacked area). Null when any stamp is not a date: the categories are then words.
 */
export function bandStampTimes(result: SlotData | undefined): number[] | null {
  const series = result?.series;
  if (!series || series.length === 0) return null;
  const stamps = [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort();
  if (stamps.length === 0) return null;
  const times = stamps.map((t) => Date.parse(t));
  return times.some((t) => Number.isNaN(t)) ? null : times;
}

/** Time-axis series (x = epoch ms). Null when any timestamp is not a date (the band axis then applies). */
export function toTimeSeries(result: SlotData | undefined, locale?: string): Series[] | null {
  const series = result?.series;
  if (!series || series.length === 0) return null;
  const out: Series[] = [];
  let any = false;
  for (const s of series) {
    const data: Series['data'] = [];
    for (const p of s.points) {
      const t = Date.parse(p.t);
      if (Number.isNaN(t)) return null;
      data.push({ x: t, y: p.v });
      any = true;
    }
    out.push({ id: s.name, name: seriesName(s, locale), data });
  }
  return any ? out : null;
}

/** One `series` repeater item as stored. */
export interface SeriesRule {
  key?: string;
  label?: string;
  color?: string;
  unit?: string;
  decimals?: number | null;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  width?: number | null;
  showPoints?: '' | 'on' | 'off';
  pointShape?: '' | PointShape;
  pointSize?: number | null;
  fill?: '' | 'none' | 'opacity' | 'gradient';
  fillOpacity?: number | null;
  axis?: 'left' | 'right';
  stack?: string;
  startHidden?: boolean;
}

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

/** The rule for a series: an exact name beats `*`; later items beat earlier ones of the same kind. */
export function ruleFor(name: string, rules: unknown): SeriesRule | undefined {
  if (!Array.isArray(rules)) return undefined;
  let exact: SeriesRule | undefined;
  let any: SeriesRule | undefined;
  for (const r of rules as SeriesRule[]) {
    if (!r || typeof r !== 'object') continue;
    const key = r.key || '*';
    if (key === name) exact = { ...exact, ...defined(r) };
    else if (key === '*') any = { ...any, ...defined(r) };
  }
  return exact || any ? { ...any, ...exact } : undefined;
}

export interface SeriesStyleOptions {
  format: ValueFormat;
  locale?: string;
  /** Chart-level stroke width / points (series rules override). */
  lineWidth?: number;
  showPoints?: boolean;
  /** Colour for series without their own (else the palette). */
  defaultColor?: string;
  /** Chart-level point mark and radius (series rules override). */
  pointShape?: PointShape;
  pointSize?: number;
  /** Chart-level fill style: fade to clear (gradient) or flat. */
  fillGradient?: boolean;
}

/** Apply the `series` repeater (label, colour, format, stroke) to chart series. Ids stay the source names. */
export function applySeriesRules(series: Series[], rules: unknown, o: SeriesStyleOptions): Series[] {
  return withFormatters(styleSeries(series, rules, o), o.locale);
}

/** `applySeriesRules` as data: the same series with each formatter described by a `NumberFormatSpec`. */
export function styleSeries(series: Series[], rules: unknown, o: SeriesStyleOptions): SeriesSpec[] {
  return series.map((s): SeriesSpec => {
    const r = ruleFor(s.id, rules) ?? {};
    const override = defined({ unit: r.unit, decimals: typeof r.decimals === 'number' ? r.decimals : undefined });
    const color = cssColor(r.color) ?? cssColor(o.defaultColor);
    const width = typeof r.width === 'number' ? r.width : o.lineWidth;
    const points = r.showPoints === 'on' ? true : r.showPoints === 'off' ? false : o.showPoints;
    const shape = r.pointShape || o.pointShape;
    const size = typeof r.pointSize === 'number' ? r.pointSize : o.pointSize;
    // Fill: 'none' clears it; 'opacity' / 'gradient' pick the style (a line gets 0.25 unless an opacity is set).
    const fillOpacity = r.fill === 'none' ? 0
      : typeof r.fillOpacity === 'number' ? r.fillOpacity
        : r.fill === 'opacity' || r.fill === 'gradient' ? (o.fillGradient === undefined ? 0.25 : undefined) : undefined;
    const gradient = r.fill === 'gradient' ? true : r.fill === 'opacity' ? false : o.fillGradient;
    return {
      ...s,
      name: r.label ? r.label.replaceAll('${name}', s.name) : s.name,
      ...(color ? { color } : {}),
      ...(r.lineStyle ? { lineStyle: r.lineStyle } : {}),
      ...(width !== undefined ? { strokeWidth: width } : {}),
      ...(points !== undefined ? { showPoints: points } : {}),
      ...(shape ? { pointShape: shape } : {}),
      ...(size !== undefined ? { pointSize: size } : {}),
      ...(fillOpacity !== undefined ? { fillOpacity } : {}),
      ...(gradient ? { fillGradient: true } : {}),
      ...(r.axis === 'right' ? { yAxis: 'right' as const } : {}),
      ...(r.stack ? { stack: r.stack } : {}),
      ...(r.startHidden ? { hidden: true } : {}),
      format: { base: o.format, ...(Object.keys(override).length ? { override } : {}) },
    };
  });
}

/**
 * A value axis's formatter (`side` picks the series drawn on it): the series' unit/decimals override
 * when every series on that axis agrees; when they disagree, plain numbers (no unit is better than a
 * wrong one). Tick decimals follow the widget's unless set.
 */
export function axisFormat(series: Array<Pick<Series, 'id' | 'yAxis'>>, rules: unknown, format: ValueFormat, locale?: string, side?: 'left' | 'right'): (v: number) => string {
  return numberFormatter(axisFormatSpec(series, rules, format, side), locale);
}

/** `axisFormat` as data (a `tick` spec). */
export function axisFormatSpec(series: Array<Pick<Series, 'id' | 'yAxis'>>, rules: unknown, format: ValueFormat, side?: 'left' | 'right'): NumberFormatSpec {
  const overrides = new Set<string>();
  let sample: { unit?: string; decimals?: number } | undefined;
  for (const s of series) {
    if (side && (s.yAxis === 'right') !== (side === 'right')) continue;
    const r = ruleFor(s.id, rules);
    const o = defined({ unit: r?.unit, decimals: typeof r?.decimals === 'number' ? r.decimals : undefined });
    overrides.add(JSON.stringify([o.unit ?? null, o.decimals ?? null]));
    sample = o;
  }
  const one = overrides.size === 1 && sample ? sample : overrides.size > 1 ? { unit: '' } : {};
  // Ticks sit on round steps: a whole tick prints whole (20 °C, not 20.0 °C).
  return { base: format, override: one, mode: 'tick' };
}

// ── chart.pie ──────────────────────────────────────────────────────────────

export interface PieOptions {
  label: string;
  value: string;
  max?: number;
  sort?: 'desc' | 'asc' | 'none';
  otherLabel?: string;
  colors?: unknown;
}

/**
 * Table rows → one series whose points are the slices, with the row behind each slice (`rows[i]` is where slice `i`
 * came from). Negative, zero and non-numeric values are not slices. Past `max`, the smallest fold into one "Other"
 * (always last), whose row is the aggregate `{ <label column>: <other label>, <value column>: <sum> }`. `sort` orders
 * the rest.
 */
export function rowsToPieSlices(rows: Row[] | undefined, o: PieOptions): { series: Series[]; rows: Row[] } | null {
  const slices: Array<{ x: string; y: number; at: number; row: Row }> = [];
  for (const row of rows ?? []) {
    const v = asNumber(row[o.value]);
    const l = row[o.label];
    if (v === null || v <= 0 || l === null || l === undefined || l === '') continue;
    slices.push({ x: String(l), y: v, at: slices.length, row });
  }
  if (slices.length === 0) return null;
  const limit = Math.max(2, Math.trunc(o.max ?? 8) || 8);
  let kept = slices;
  let other: number | null = null;
  if (slices.length > limit) {
    const bySize = [...slices].sort((a, b) => b.y - a.y);
    kept = bySize.slice(0, limit - 1);
    other = bySize.slice(limit - 1).reduce((acc, s) => acc + s.y, 0);
  }
  const sort = o.sort ?? 'desc';
  kept = [...kept].sort((a, b) => (sort === 'desc' ? b.y - a.y : sort === 'asc' ? a.y - b.y : a.at - b.at));
  const pinned = new Map<string, string>();
  if (Array.isArray(o.colors)) {
    for (const c of o.colors as Array<{ key?: string; color?: string }>) {
      const color = cssColor(c?.color);
      if (c?.key && color) pinned.set(c.key, color);
    }
  }
  const data = kept.map((s) => ({ x: s.x, y: s.y, ...(pinned.has(s.x) ? { color: pinned.get(s.x) } : {}) }));
  const sourceRows = kept.map((s) => s.row);
  if (other !== null) {
    const name = o.otherLabel || 'Other';
    data.push({ x: name, y: other, ...(pinned.has(name) ? { color: pinned.get(name) } : {}) });
    sourceRows.push({ [o.label]: name, [o.value]: other });
  }
  return { series: [{ id: 'pie', name: 'pie', data }], rows: sourceRows };
}

/** The slices alone (see `rowsToPieSlices`). */
export function rowsToPieSeries(rows: Row[] | undefined, o: PieOptions): Series[] | null {
  return rowsToPieSlices(rows, o)?.series ?? null;
}

/**
 * Table rows → one series with one bar per row (chart.bar in category mode): the latest value per entity.
 * A row without a label or a finite value is skipped; zero and negative values stay (a bar may be empty or
 * go below the axis). `sort` orders by value; the list is cut to `max` AFTER ordering, so "largest first, 10"
 * keeps the ten largest.
 */
export function rowsToCategorySeries(
  rows: Row[] | undefined,
  o: { label?: string; value?: string; sort?: 'none' | 'desc' | 'asc'; max?: number; name?: string },
): Series[] | null {
  if (!o.label || !o.value) return null;
  const bars: Array<{ x: string; y: number; at: number }> = [];
  for (const row of rows ?? []) {
    const y = asNumber(row[o.value]);
    const l = row[o.label];
    if (y === null || l === null || l === undefined || l === '') continue;
    bars.push({ x: String(l), y, at: bars.length });
  }
  if (bars.length === 0) return null;
  if (o.sort === 'desc') bars.sort((a, b) => b.y - a.y || a.at - b.at);
  else if (o.sort === 'asc') bars.sort((a, b) => a.y - b.y || a.at - b.at);
  const limit = Math.max(1, Math.min(100, Math.trunc(o.max ?? 30) || 30));
  const name = o.name || o.value;
  return [{ id: name, name, data: bars.slice(0, limit).map((b) => ({ x: b.x, y: b.y })) }];
}

// ── chart.scatter ──────────────────────────────────────────────────────────

/** Table rows → scatter series (one per distinct group, ≤ 8). A row without a finite x AND y is skipped. Capped. */
export function rowsToScatterSeries(
  rows: Row[] | undefined,
  /** `unnamed` names the series of rows without a group (default "Series"; its id stays `Series`). */
  cols: { x: string; y: string; group?: string; unnamed?: string },
  maxPoints = 5000,
  maxGroups = 8,
): Series[] | null {
  const groups = new Map<string, Series>();
  let count = 0;
  for (const row of rows ?? []) {
    if (count >= maxPoints) break;
    const x = asNumber(row[cols.x]);
    const y = asNumber(row[cols.y]);
    if (x === null || y === null) continue;
    const raw = cols.group ? row[cols.group] : undefined;
    const none = raw === null || raw === undefined || raw === '';
    const g = none ? 'Series' : String(raw);
    let s = groups.get(g);
    if (!s) {
      if (groups.size >= maxGroups) continue;
      s = { id: g, name: none ? cols.unnamed || g : g, data: [] };
      groups.set(g, s);
    }
    s.data.push({ x, y });
    count += 1;
  }
  return count === 0 ? null : [...groups.values()];
}

// ── chart.histogram ────────────────────────────────────────────────────────

export interface HistogramBin { from: number; to: number; count: number }

/** Sturges' rule, clamped to 3..50. */
export function autoBinCount(n: number): number {
  return Math.min(50, Math.max(3, Math.ceil(Math.log2(Math.max(1, n)) + 1)));
}

/**
 * Equal-width bins over [min, max]; the last bin is closed on the right. All-equal values give one bin.
 * `nice` puts the edges on round numbers (100, 140, 180 rather than 102.0, 138.4): the bin width is a
 * round step near (max − min) / bins and an unpinned end moves out to the step, so the count may differ by one.
 */
export function histogramBins(values: unknown[], bins?: number | null, rangeMin?: number | null, rangeMax?: number | null, nice = false): HistogramBin[] {
  const nums = values.map(asNumber).filter((v): v is number => v !== null);
  if (nums.length === 0) return [];
  let lo = rangeMin ?? Math.min(...nums);
  let hi = rangeMax ?? Math.max(...nums);
  if (!(hi > lo)) return [{ from: lo, to: hi, count: nums.filter((v) => v === lo).length }];
  let k = Math.min(50, Math.max(1, Math.trunc(bins ?? autoBinCount(nums.length)) || autoBinCount(nums.length)));
  if (nice) {
    const step = niceStep(hi - lo, k);
    if (rangeMin === null || rangeMin === undefined) lo = Math.floor(lo / step + 1e-9) * step;
    if (rangeMax === null || rangeMax === undefined) hi = Math.ceil(hi / step - 1e-9) * step;
    if (!(hi > lo)) hi = lo + step;
    k = Math.min(50, Math.max(1, Math.round((hi - lo) / step)));
  }
  const width = (hi - lo) / k;
  const out: HistogramBin[] = Array.from({ length: k }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  for (const v of nums) {
    if (v < lo || v > hi) continue;
    out[Math.min(k - 1, Math.floor((v - lo) / width))].count += 1;
  }
  return out;
}

/** Mean and median of the numeric values (null when there are none). */
export function valueStats(values: unknown[]): { mean: number; median: number } | null {
  const nums = values.map(asNumber).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = nums.length >> 1;
  return {
    mean: nums.reduce((a, b) => a + b, 0) / nums.length,
    median: nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2,
  };
}

// ── heatmap ───────────────────────────────────────────────────────────────

/** Table rows → heatmap cells. A row missing x or y is skipped; a non-numeric value is an empty cell, never 0. */
export function rowsToHeatCells(
  rows: Row[] | undefined,
  cols: { x: string; y: string; value: string },
  max = 20_000,
): Array<{ x: string | number; y: string | number; value: number | null }> {
  const out: Array<{ x: string | number; y: string | number; value: number | null }> = [];
  for (const row of rows ?? []) {
    if (out.length >= max) break;
    const x = row[cols.x];
    const y = row[cols.y];
    if (x === null || x === undefined || x === '' || y === null || y === undefined || y === '') continue;
    out.push({ x: x as string | number, y: y as string | number, value: asNumber(row[cols.value]) });
  }
  return out;
}

// ── CSV ───────────────────────────────────────────────────────────────────

const cell = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Series → `time, series, value` rows (raw values; the host guards formula injection). */
export function seriesCsv(result: SlotData | undefined): string[][] {
  const out: string[][] = [['time', 'series', 'value']];
  for (const s of result?.series ?? []) for (const p of s.points) out.push([p.t, s.name, cell(p.v)]);
  return out;
}

/** A table slot → its declared columns (header = column keys), else the keys of the first row. */
export function tableCsv(slot: SlotData | undefined): string[][] {
  const rows = slot?.rows ?? [];
  const keys = slot?.columns?.length ? slot.columns.map((c) => c.key) : Object.keys(rows[0] ?? {});
  if (!keys.length) return [];
  return [keys, ...rows.map((r) => keys.map((k) => cell(r[k])))];
}
