// The pure part of the settings → chart props mapping (no React): the legend, axis, tooltip, value label, threshold and
// animation settings read the same keys in every chart, so they map to props in one place. Every chart starts from the
// kit's look (DESIGN.md: 11px secondary axis text, dashed --border grid, baseline only, 12px legend with 8px dots below
// the plot) and a setting only overrides a part. Colours from settings pass `cssColor()`; an invalid one falls back to
// the token. `chart-props.tsx` re-exports this file; kui-ejs and KUInative vendor it.

import type { CSSProperties } from 'react';
import type { FontValue } from '../../SchemaForm/types';
import type { AxisTextStyle, LegendPosition, LegendValue, LineStyle, ThresholdLine, TooltipMode } from '@/modules/ui/Chart';
import { cssColor, fontStyle, type ValueFormat } from '../settings/style';
import { numberFormatter, type NumberFormatSpec } from './chart-data';
import { CHART_AXIS_STYLE, CHART_GRID_COLOR } from './ui-logic';

type S = Record<string, unknown>;

export const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
export const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/** Legend props from the legend pack. `auto` = bottom when there are 2 or more entries. */
export function legendProps(s: S, entries: number): {
  showLegend: boolean; legendPosition: LegendPosition; legendValues?: LegendValue[]; legendStyle?: CSSProperties; legendToggle: boolean;
} {
  const mode = typeof s.legend === 'string' ? s.legend : 'auto';
  const show = mode === 'none' ? false : mode === 'auto' ? entries >= 2 : true;
  const position: LegendPosition = mode === 'top' || mode === 'left' || mode === 'right' ? mode : 'bottom';
  const style = fontStyle(s.legendFont as FontValue | undefined, s.legendColor);
  return {
    showLegend: show,
    legendPosition: position,
    legendValues: Array.isArray(s.legendValues) && s.legendValues.length ? (s.legendValues as LegendValue[]) : undefined,
    legendStyle: Object.keys(style).length ? style : undefined,
    legendToggle: true,
  };
}

/** A font + colour setting pair as SVG text style, or undefined when both are unset. */
export function textStyleOf(font: unknown, color: unknown): AxisTextStyle | undefined {
  const st = fontStyle(font as FontValue | undefined, color);
  if (!Object.keys(st).length) return undefined;
  return {
    color: st.color,
    fontSize: typeof st.fontSize === 'string' && st.fontSize.endsWith('px') ? Number.parseFloat(st.fontSize) : st.fontSize,
    fontWeight: st.fontWeight as number | undefined,
    fontFamily: st.fontFamily,
    fontStyle: st.fontStyle,
  };
}

/** Axis text: the kit's default (CHART_AXIS_STYLE) under the `tickFont` + `tickColor` settings. */
export function tickStyleOf(s: S): AxisTextStyle {
  return { fontSize: CHART_AXIS_STYLE.fontSize as number, color: CHART_AXIS_STYLE.fill as string, ...textStyleOf(s.tickFont, s.tickColor) };
}

const lineStyleOf = (v: unknown): LineStyle | undefined => (v === 'solid' || v === 'dashed' || v === 'dotted' ? v : undefined);

/** Axis props from the axis settings (both value axes, grid, tick text, axis visibility). */
export function axisProps(s: S) {
  return {
    showGrid: s.showGrid !== false,
    gridColor: cssColor(s.gridColor) ?? CHART_GRID_COLOR,
    gridStyle: lineStyleOf(s.gridStyle) ?? 'dashed',
    yMin: num(s.yMin),
    yMax: num(s.yMax),
    yLabel: str(s.yLabel),
    xLabel: str(s.xLabel),
    y2Min: num(s.y2Min),
    y2Max: num(s.y2Max),
    y2Label: str(s.y2Label),
    yTickCount: num(s.yTickCount),
    showXAxis: s.showXAxis !== false,
    showYAxis: s.showYAxis !== false,
    tickStyle: tickStyleOf(s),
  };
}

/** Threshold lines from the thresholds repeater. */
export function thresholdLines(raw: unknown): ThresholdLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ThresholdLine[] = [];
  for (const t of raw as S[]) {
    const value = num(t?.value);
    if (value === undefined) continue;
    out.push({
      value,
      label: str(t.label),
      color: cssColor(t.color),
      style: lineStyleOf(t.style) ?? 'dashed',
      width: num(t.width),
      ...(t.axis === 'right' ? { yAxis: 'right' as const } : {}),
    });
  }
  return out.length ? out : undefined;
}

export function tooltipModeOf(s: S): TooltipMode {
  if (s.showTooltip === false) return 'none';
  return s.tooltip === 'point' || s.tooltip === 'none' ? s.tooltip : 'axis';
}

/** Tooltip props: mode, the time / category heading, a stack total. */
export function tooltipProps(s: S) {
  return {
    tooltipMode: tooltipModeOf(s),
    showTooltip: tooltipModeOf(s) !== 'none',
    tooltipHeader: s.tooltipTime !== false,
    tooltipTotal: s.tooltipTotal === true,
  };
}

/** Value label text style from `valueLabelFont` + `valueLabelColor`. */
export const valueLabelStyleOf = (s: S): AxisTextStyle | undefined => textStyleOf(s.valueLabelFont, s.valueLabelColor);

/** Entrance animation: on unless switched off. */
export const animateOf = (s: S): boolean => s.animate !== false;

/** The widget's number text, as data (`numberFormatter(spec, locale)` is the function). */
export const formatSpec = (format: ValueFormat): NumberFormatSpec => ({ base: format });

/** A legend / scale end in the widget format, compact (12.4K) and without forced decimals on whole numbers, as data. */
export const compactSpec = (format: ValueFormat): NumberFormatSpec => ({ base: format, mode: 'compact' });

/** The widget's number text. */
export const formatter = (format: ValueFormat, locale?: string) => numberFormatter(formatSpec(format), locale);

/** A legend / scale end in the widget format, compact (12.4K) and without forced decimals on whole numbers. */
export const compactFormatter = (format: ValueFormat, locale?: string) => numberFormatter(compactSpec(format), locale);
