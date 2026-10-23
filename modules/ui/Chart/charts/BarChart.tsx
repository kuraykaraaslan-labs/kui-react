'use client';
// modules/ui/Chart/charts/BarChart.tsx
//
// Token-aware bar chart: grouped or stacked series (one stack, or several by `Series.stack`),
// vertical (default) or horizontal bars, bar width / gap / end radius, value labels (outside,
// inside or centred, with their own text style), a right value axis for series with
// `yAxis: 'right'` (vertical bars), custom category ticks and markers (a histogram's bin edges and
// mean), plus the shared cartesian surface (legend position / values / toggling, fixed value
// bounds, axis titles, thresholds, tooltip mode and total, axis text style, entrance animation).
// With `onRangeSelect` and `categoryTimes` (the instant of each category) a pointer drag along the
// category axis selects whole bars for the host as a time range, a double click or Escape asks for
// a reset, and the keyboard builds a selection (arrows, Shift + arrows, Enter).

import { useId, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer } from '../primitives/ResponsiveContainer';
import { XAxis, YAxis } from '../primitives/Axis';
import { Grid } from '../primitives/Grid';
import { ChartTooltip } from '../primitives/Tooltip';
import { ChartFrame } from '../primitives/ChartFrame';
import { Thresholds } from '../primitives/Thresholds';
import { AxisTitles } from '../primitives/AxisTitles';
import { animationDuration, chartTheme } from '../theme';
import type { BaseChartProps, CategoryMarker, PlotRect, TooltipDatum } from '../types';
import {
  niceTicks, yScale, bandCenter, xCategories, resolveDomain, thinLabels, defaultNumber, labelWidth,
  alignedDomain, stackKeys, groupedStackTops, topsExtent, dashArray,
} from './_helpers';
import { chartLegend, plotPadding, useSeriesVisibility, valueText } from './_cartesian';
import { useEntrance, valueLabelProps } from './_marks';
import { bandIndex, bandRange, keyRange, MIN_BRUSH_PX, type KeySelection } from './_time';

export type BarChartProps = BaseChartProps & {
  /** Corner radius in pixels at the end of each bar (the baseline end stays square). Default = 4. */
  radius?: number;
  /** Stack the series in one bar per category (see `Series.stack` for several stacks). */
  stacked?: boolean;
  /** 'vertical' (columns, default) or 'horizontal' (bars growing to the right). */
  orientation?: 'vertical' | 'horizontal';
  /** Print each bar's value. Default = false. */
  showValues?: boolean;
  /** Where value labels sit: past the bar's end (default), inside its end, or centred. */
  valueLabelPosition?: 'outside' | 'inside' | 'center';
  /** Share of each category slot the bars take (0.05–1). Default = 0.75. */
  barWidth?: number;
  /** Pixels between the bars of one category. Default = 2. */
  barGap?: number;
  /** Ticks at fractional category positions instead of one per category (vertical bars). */
  categoryTicks?: Array<{ at: number; label: string }>;
  /** Category tick text. */
  xTickFormat?: (label: string, index: number) => string;
  /** Reference lines across the category axis (vertical bars). */
  markers?: CategoryMarker[];
};

/** A bar with only its far end rounded: `dir` is where the bar grows (up, down, right, left). */
function barPath(x: number, y: number, w: number, h: number, r: number, dir: 'up' | 'down' | 'right' | 'left'): string {
  const rr = Math.max(0, Math.min(r, (dir === 'up' || dir === 'down' ? w : h) / 2, dir === 'up' || dir === 'down' ? h : w));
  if (rr <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  if (dir === 'up') return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
  if (dir === 'down') return `M${x} ${y}V${y + h - rr}Q${x} ${y + h} ${x + rr} ${y + h}H${x + w - rr}Q${x + w} ${y + h} ${x + w} ${y + h - rr}V${y}Z`;
  if (dir === 'right') return `M${x} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h - rr}Q${x + w} ${y + h} ${x + w - rr} ${y + h}H${x}Z`;
  return `M${x + w} ${y}H${x + rr}Q${x} ${y} ${x} ${y + rr}V${y + h - rr}Q${x} ${y + h} ${x + rr} ${y + h}H${x + w}Z`;
}

export function BarChart({
  series,
  height = 240,
  showLegend = true,
  showGrid = true,
  showTooltip = true,
  radius = 4,
  stacked = false,
  orientation = 'vertical',
  showValues = false,
  valueLabelPosition = 'outside',
  barWidth = 0.75,
  barGap = 2,
  categoryTicks,
  xTickFormat,
  markers,
  yFormat,
  ariaLabel,
  className,
  legendPosition = 'bottom',
  legendValues,
  legendStyle,
  legendToggle,
  yMin,
  yMax,
  yLabel,
  xLabel,
  thresholds,
  tooltipMode,
  gridColor,
  tickStyle,
  fill,
  yTickCount = 4,
  showXAxis = true,
  showYAxis = true,
  gridStyle,
  y2Min,
  y2Max,
  y2Label,
  y2Format,
  tooltipHeader = true,
  tooltipValueFormat,
  tooltipTotal = false,
  tooltipTotalLabel = 'Total',
  animate = true,
  valueLabelStyle,
  onRangeSelect,
  categoryTimes,
}: BarChartProps) {
  const [hover, setHover] = useState<{ index: number; along: number; pos: number } | null>(null);
  // A range selection for the host: the pointer band in px along the category axis, and the keyed one in indices.
  const [brush, setBrush] = useState<{ from: number; to: number } | null>(null);
  const [keySel, setKeySel] = useState<KeySelection | null>(null);
  const captured = useRef(false);
  const vis = useSeriesVisibility(series);
  const visible = vis.visible;
  const horizontal = orientation === 'horizontal';
  const tipMode = showTooltip ? (tooltipMode ?? 'axis') : 'none';
  const fmt = yFormat ?? defaultNumber;
  const fmt2 = y2Format ?? fmt;
  const clipId = `bar-clip-${useId().replace(/:/g, '')}`;
  const enter = useEntrance(horizontal ? 'reveal-x' : 'reveal-y', animate);

  const categories = useMemo(() => xCategories(vis.colored), [vis.colored]);
  const selecting = !!onRangeSelect && !!categoryTimes && categories.length > 0 && categoryTimes.length === categories.length;
  // Horizontal bars have one value axis: a right-axis series is drawn on it like the others.
  const axisSeries = useMemo(() => (horizontal ? visible.map((s) => ({ ...s, yAxis: undefined })) : visible), [horizontal, visible]);
  const keys = useMemo(() => stackKeys(axisSeries, stacked), [axisSeries, stacked]);
  const isStacked = keys.some((k) => k !== null);
  const stack = useMemo(() => groupedStackTops(axisSeries, keys), [axisSeries, keys]);
  const slotOf = useMemo(() => {
    const order: string[] = [];
    return keys.map((k, si) => {
      const id = k ?? `\u0000solo:${axisSeries[si].id}`;
      let at = order.indexOf(id);
      if (at < 0) { order.push(id); at = order.length - 1; }
      return at;
    }).map((at, _, all) => ({ at, count: Math.max(...all) + 1 }));
  }, [keys, axisSeries]);
  const slots = slotOf[0]?.count ?? 1;

  const onRight = axisSeries.map((s) => s.yAxis === 'right');
  const hasRight = onRight.some(Boolean);
  const hasLeft = onRight.some((r) => !r) || !hasRight;
  const extentOf = (right: boolean) => topsExtent(stack.tops.filter((_, i) => onRight[i] === right));
  const thrL = thresholds?.filter((t) => t.yAxis !== 'right' || horizontal);
  const thrR = horizontal ? [] : thresholds?.filter((t) => t.yAxis === 'right');
  const L = hasLeft
    ? resolveDomain(extentOf(false), { min: yMin, max: yMax, thresholds: thrL, count: yTickCount })
    : resolveDomain(extentOf(true), { min: y2Min, max: y2Max, thresholds: thrR, count: yTickCount });
  const valueTicks = niceTicks(L.min, L.max, yTickCount);
  let R: { min: number; max: number; ticks: number[] } | null = null;
  if (hasRight && hasLeft) {
    const e = extentOf(true);
    for (const t of thrR ?? []) { if (t.value < e.min) e.min = t.value; if (t.value > e.max) e.max = t.value; }
    R = alignedDomain(e, valueTicks.length - 1, { min: y2Min, max: y2Max });
  } else if (hasRight) {
    R = { min: L.min, max: L.max, ticks: valueTicks };
  }
  const animMs = animationDuration();

  const legend = chartLegend({
    show: showLegend, series: vis.colored, hidden: vis.hidden, toggle: vis.toggle, position: legendPosition,
    values: legendValues, style: legendStyle, toggleable: legendToggle, yFormat,
  });

  return (
    <ChartFrame legend={legend} position={legendPosition} className={className} fill={fill}>
      <ResponsiveContainer height={height} fill={fill}>
        {({ width, height }) => {
          const valueLabels = hasLeft ? valueTicks.map(fmt) : [];
          const y2Labels = R ? R.ticks.map(fmt2) : undefined;
          const catLabels = categories.map((c, i) => (xTickFormat ? xTickFormat(c, i) : c));
          // The left axis carries values (vertical) or category names (horizontal).
          const pad = horizontal
            ? {
              ...plotPadding({ yTickLabels: catLabels, xLabel, yLabel, tickStyle, showXAxis: showYAxis, showYAxis: showXAxis }),
              right: 12 + (showValues && valueLabelPosition === 'outside' ? labelWidth(valueTicks.map(fmt)) : 0),
            }
            : {
              ...plotPadding({ yTickLabels: valueLabels, y2TickLabels: y2Labels, xLabel, yLabel, y2Label: R ? y2Label : undefined, tickStyle, showXAxis, showYAxis, minLeft: hasLeft ? 28 : 8 }),
            };
          if (!horizontal && showValues && valueLabelPosition === 'outside') pad.top = Math.max(pad.top, 18);
          if (horizontal) pad.left = Math.min(pad.left, Math.max(40, width * 0.4));
          const rect: PlotRect = {
            x: pad.left,
            y: pad.top,
            width: Math.max(0, width - pad.left - pad.right),
            height: Math.max(0, height - pad.top - pad.bottom),
          };
          // Value → pixel along the value axis; category index → centre along the category axis.
          const lin = (lo: number, hi: number) => (horizontal
            ? (v: number) => (hi === lo ? rect.x : rect.x + ((v - lo) / (hi - lo)) * rect.width)
            : (v: number) => yScale(v, lo, hi, rect));
          const vPxL = lin(L.min, L.max);
          const vPxR = R ? lin(R.min, R.max) : vPxL;
          const scaleOf = (si: number) => (onRight[si] && hasLeft ? vPxR : vPxL);
          const catRect: PlotRect = horizontal ? { x: rect.y, y: rect.x, width: rect.height, height: rect.width } : rect;
          const step = categories.length ? catRect.width / categories.length : 0;
          const cPx = (i: number) => bandCenter(i, categories.length, catRect);
          const valuePixels = valueTicks.map(vPxL);
          const valueAxis = hasLeft ? valueTicks.map((_, i) => ({ position: valuePixels[i], label: valueLabels[i] })) : [];
          const y2Axis = R ? R.ticks.map((v, i) => ({ position: vPxR(v), label: y2Labels![i] })) : [];
          const catAxis = catLabels.map((label, i) => ({ position: cPx(i), label }));
          const catAxisX = thinLabels(
            categoryTicks ? categoryTicks.map((t) => ({ position: catRect.x + t.at * step, label: t.label })) : catAxis,
            rect.width,
            typeof tickStyle?.fontSize === 'number' ? tickStyle.fontSize : 11,
          );

          const groupWidth = step * Math.min(1, Math.max(0.05, barWidth));
          const gap = slots > 1 ? Math.min(barGap, groupWidth / slots / 2) : 0;
          const thick = Math.max(1, (groupWidth - gap * (slots - 1)) / slots);

          const bars = axisSeries.map((s, si) => s.data.map((p, i) => {
            if (p.y === null || p.y === undefined || i >= categories.length) return null;
            const vPx = scaleOf(si);
            const zero = vPx(Math.min(onRight[si] && R ? R.max : L.max, Math.max(onRight[si] && R ? R.min : L.min, 0)));
            const inStack = keys[si] !== null;
            const start = cPx(i) - groupWidth / 2 + slotOf[si].at * (thick + gap);
            const topV = inStack ? (stack.tops[si]?.[i] ?? 0) : p.y;
            const a = inStack ? vPx(topV - Math.max(0, p.y)) : zero;
            const b = vPx(topV);
            const lo = Math.min(a, b);
            const len = Math.abs(b - a);
            // The far end is rounded only on the top segment of a stack.
            const topOfStack = !inStack || !axisSeries.some((o, oi) => oi > si && keys[oi] === keys[si] && typeof o.data[i]?.y === 'number' && (o.data[i].y as number) > 0);
            const negative = p.y < 0;
            const dir = horizontal ? (negative ? 'left' : 'right') : (negative ? 'down' : 'up');
            const x = horizontal ? lo : start;
            const yy = horizontal ? start : lo;
            const w = horizontal ? len : thick;
            const h = horizontal ? thick : len;
            return {
              i, y: p.y, label: valueText(s, p.y, p, yFormat), from: a, end: b, mid: (a + b) / 2, negative,
              x, yy, w, h, centre: start + thick / 2, d: barPath(x, yy, w, h, topOfStack ? radius : 0, dir), len,
            };
          }));

          // Value labels: thinned to every k-th category when they would collide.
          const longest = showValues ? Math.max(0, ...bars.flatMap((row) => row.map((b) => (b ? b.label.length : 0)))) : 0;
          const labelEvery = !showValues || horizontal || isStacked ? 1 : Math.max(1, Math.ceil((longest * 6.6 + 6) / Math.max(1, slots > 1 ? thick + gap : step)));

          let tip: TooltipDatum[] = [];
          if (hover && tipMode !== 'none' && !brush) {
            tip = visible.map((s) => {
              const p = s.data[hover.index];
              const y = p?.y ?? null;
              return {
                seriesId: s.id, seriesName: s.name, color: s.color as string, x: p?.x ?? '', y,
                valueLabel: y === null ? undefined : (tooltipValueFormat ? tooltipValueFormat(y, s) : valueText(s, y, p, yFormat)),
              };
            });
            if (tipMode === 'point') {
              // Grouped: the bar under the pointer along the category axis; stacked: the segment under it.
              const k = visible.findIndex((_, si) => {
                const b = bars[si][hover.index];
                if (!b) return false;
                const alongOk = hover.along >= b.centre - thick / 2 - gap / 2 && hover.along <= b.centre + thick / 2 + gap / 2;
                const posOk = hover.pos >= Math.min(b.from, b.end) - 1 && hover.pos <= Math.max(b.from, b.end) + 1;
                return keys[si] !== null ? alongOk && posOk : alongOk;
              });
              tip = k >= 0 && k < tip.length && tip[k].y !== null ? [tip[k]] : [];
            }
          }
          const hoverC = hover === null ? null : cPx(hover.index);
          const total = tooltipTotal && isStacked && tip.length > 1 ? { label: tooltipTotalLabel, value: fmt(tip.reduce((a, d) => a + (d.y ?? 0), 0)) } : undefined;
          const header = hover ? (categories[hover.index] ?? '') : '';
          const onFill = valueLabelPosition !== 'outside' || isStacked;

          // Where a pointer is along the category axis (px from its start) and across it.
          const alongOf = (e: React.MouseEvent) => {
            const bounds = (e.currentTarget as SVGElement).getBoundingClientRect();
            return {
              along: horizontal ? e.clientY - bounds.top - rect.y : e.clientX - bounds.left - rect.x,
              across: horizontal ? e.clientX - bounds.left : e.clientY - bounds.top,
            };
          };
          // The selection for the host, as whole categories: the pointer band snapped, or the keyed one.
          const indexAt = (along: number) => bandIndex(along, step, categories.length);
          const sel = !selecting ? null
            : brush ? { i0: indexAt(brush.from), i1: indexAt(brush.to) }
              : keySel ? { i0: keySel.anchor, i1: keySel.focus } : null;
          const bandPx = sel ? { from: catRect.x + Math.min(sel.i0, sel.i1) * step, to: catRect.x + (Math.max(sel.i0, sel.i1) + 1) * step } : null;
          const report = (i0: number, i1: number) => {
            const range = bandRange(categoryTimes!, i0, i1);
            if (range) { onRangeSelect!(range); setHover(null); }
          };
          const endDrag = () => { captured.current = false; setBrush(null); };

          return (
            <>
              <svg
                width={width}
                height={height}
                role="img"
                aria-label={ariaLabel ?? 'Bar chart'}
                tabIndex={selecting ? 0 : undefined}
                className={selecting ? 'outline-none focus-visible:ring-2 focus-visible:ring-border-focus' : undefined}
                style={{
                  display: 'block', overflow: 'visible',
                  ...(selecting ? { touchAction: horizontal ? 'pan-x' : 'pan-y', cursor: 'crosshair', userSelect: 'none' } : {}),
                }}
                onPointerDown={(e) => {
                  if (!selecting || e.button !== 0) return;
                  const { along } = alongOf(e);
                  if (along < 0 || along > catRect.width) return;
                  // Keep the drag through a pointer that leaves the plot (not every DOM has capture: jsdom).
                  const el = e.currentTarget;
                  if (typeof el.setPointerCapture === 'function') {
                    try { el.setPointerCapture(e.pointerId); captured.current = true; } catch { captured.current = false; }
                  }
                  setKeySel(null);
                  setBrush({ from: along, to: along });
                }}
                onPointerMove={(e) => {
                  if (brush) setBrush({ from: brush.from, to: Math.min(catRect.width, Math.max(0, alongOf(e).along)) });
                }}
                onPointerUp={() => {
                  if (!brush) return;
                  endDrag();
                  // A click is not a brush: the band must be at least `MIN_BRUSH_PX` long.
                  if (Math.abs(brush.to - brush.from) >= MIN_BRUSH_PX) report(indexAt(brush.from), indexAt(brush.to));
                }}
                onPointerCancel={endDrag}
                onMouseMove={(e) => {
                  if (tipMode === 'none' || categories.length === 0) return;
                  const { along, across } = alongOf(e);
                  if (along < 0 || along > catRect.width) { setHover(null); return; }
                  setHover({ index: indexAt(along), along: catRect.x + along, pos: across });
                }}
                onMouseLeave={() => { setHover(null); if (!captured.current) setBrush(null); }}
                onDoubleClick={() => { if (selecting) { setKeySel(null); onRangeSelect!(null); } }}
                onKeyDown={(e) => {
                  if (!selecting) return;
                  if (e.key === 'Escape') {
                    if (!brush && !keySel) return;
                    e.preventDefault();
                    endDrag();
                    setKeySel(null);
                    onRangeSelect!(null);
                  } else if (e.key === 'Enter') {
                    if (keySel) { e.preventDefault(); report(keySel.anchor, keySel.focus); }
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    setKeySel(keyRange(keySel, e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey, 0, categories.length - 1, 1));
                  }
                }}
              >
                <defs>
                  <clipPath id={clipId}>
                    <rect x={rect.x - (showValues ? 24 : 1)} y={rect.y - (showValues ? 18 : 1)}
                      width={rect.width + (showValues ? (horizontal ? 84 : 48) : 2)} height={rect.height + (showValues ? 19 : 2)} />
                  </clipPath>
                </defs>
                {hoverC !== null && tip.length > 0 && !brush && (
                  <rect
                    aria-hidden="true"
                    x={horizontal ? rect.x : hoverC - step / 2}
                    y={horizontal ? hoverC - step / 2 : rect.y}
                    width={horizontal ? rect.width : step}
                    height={horizontal ? step : rect.height}
                    fill="var(--text-secondary)"
                    opacity={0.08}
                    rx={4}
                  />
                )}
                {bandPx && (
                  // The selection for the host: the chosen categories tinted, with an edge line at each end.
                  <g data-range-band="" aria-hidden="true" pointerEvents="none">
                    <rect
                      x={horizontal ? rect.x : bandPx.from}
                      y={horizontal ? bandPx.from : rect.y}
                      width={horizontal ? rect.width : bandPx.to - bandPx.from}
                      height={horizontal ? bandPx.to - bandPx.from : rect.height}
                      fill="var(--primary)" opacity={0.12}
                    />
                    {[bandPx.from, bandPx.to].map((at, k) => (horizontal
                      ? <line key={k} x1={rect.x} x2={rect.x + rect.width} y1={at} y2={at} stroke="var(--primary)" strokeWidth={1} />
                      : <line key={k} x1={at} x2={at} y1={rect.y} y2={rect.y + rect.height} stroke="var(--primary)" strokeWidth={1} />))}
                  </g>
                )}
                {showGrid && (horizontal
                  ? <Grid rect={rect} yTicks={[]} xTicks={valuePixels} color={gridColor} lineStyle={gridStyle} />
                  : <Grid rect={rect} yTicks={valuePixels} color={gridColor} lineStyle={gridStyle} />)}
                {horizontal ? (
                  <>
                    <YAxis ticks={catAxis} x={rect.x} yStart={rect.y} yEnd={rect.y + rect.height} textStyle={tickStyle} tickMarks={false} showLabels={showXAxis} />
                    <XAxis ticks={valueAxis} y={rect.y + rect.height} xStart={rect.x} xEnd={rect.x + rect.width} textStyle={tickStyle} hideLine tickMarks={false} showLabels={showYAxis} />
                  </>
                ) : (
                  <>
                    {hasLeft && <YAxis ticks={valueAxis} x={rect.x} yStart={rect.y} yEnd={rect.y + rect.height} textStyle={tickStyle} hideLine tickMarks={false} showLabels={showYAxis} />}
                    {R && <YAxis side="right" ticks={y2Axis} x={rect.x + rect.width} yStart={rect.y} yEnd={rect.y + rect.height} textStyle={tickStyle} hideLine tickMarks={false} showLabels={showYAxis} />}
                    <XAxis ticks={catAxisX} y={rect.y + rect.height} xStart={rect.x} xEnd={rect.x + rect.width} textStyle={tickStyle} tickMarks={false} showLabels={showXAxis} />
                  </>
                )}
                <AxisTitles rect={rect} height={height} width={width} xLabel={xLabel} yLabel={yLabel} y2Label={R ? y2Label : undefined} style={tickStyle} />
                <g ref={enter}>
                  <g clipPath={`url(#${clipId})`}>
                    {axisSeries.map((s, si) => (
                      <g key={s.id} data-series={s.id}>
                        {bars[si].map((b) => b && (
                          <path
                            key={`${s.id}-${b.i}`}
                            d={b.d}
                            data-bar=""
                            data-x={b.x}
                            data-y={b.yy}
                            data-w={b.w}
                            data-h={b.h}
                            fill={s.color}
                            opacity={hover === null || hover.index === b.i ? 1 : 0.55}
                            style={{ transition: animMs ? `opacity ${animMs}ms` : undefined }}
                          />
                        ))}
                        {showValues && bars[si].map((b) => {
                          if (!b || b.i % labelEvery !== 0) return null;
                          const inside = valueLabelPosition === 'inside';
                          const center = valueLabelPosition === 'center' || (isStacked && valueLabelPosition === 'outside');
                          if ((inside || center) && b.len < (horizontal ? b.label.length * 6.6 + 8 : 16)) return null;
                          const sign = b.negative ? -1 : 1;
                          let tx: number;
                          let ty: number;
                          let anchor: 'start' | 'middle' | 'end' = 'middle';
                          if (horizontal) {
                            ty = b.centre + 4;
                            if (center) tx = b.mid;
                            else if (inside) { tx = b.end - sign * 6; anchor = b.negative ? 'start' : 'end'; }
                            else { tx = b.end + sign * 5; anchor = b.negative ? 'end' : 'start'; }
                          } else {
                            tx = b.centre;
                            if (center) ty = b.mid + 4;
                            else if (inside) ty = b.end + (b.negative ? -6 : 14);
                            else ty = b.end + (b.negative ? 13 : -5);
                          }
                          return (
                            <text key={`v-${s.id}-${b.i}`} data-value-label="" x={tx} y={ty} textAnchor={anchor} {...valueLabelProps(valueLabelStyle, onFill)}>
                              {b.label}
                            </text>
                          );
                        })}
                      </g>
                    ))}
                    {hasLeft && <Thresholds lines={thrL} rect={rect} scale={vPxL} orientation={horizontal ? 'vertical' : 'horizontal'} />}
                    {R && hasLeft && <Thresholds lines={thrR} rect={rect} scale={vPxR} />}
                  </g>
                </g>
                {!horizontal && markers?.map((m, k) => {
                  const x = catRect.x + m.at * step;
                  if (!Number.isFinite(x) || x < rect.x - 0.5 || x > rect.x + rect.width + 0.5) return null;
                  const color = m.color ?? 'var(--text-primary)';
                  const w = m.width ?? 1.5;
                  const right = x < rect.x + rect.width - 70;
                  return (
                    <g key={k} data-marker={m.label ?? k} aria-hidden="true">
                      <line x1={x} x2={x} y1={rect.y + (m.label ? 4 : 0)} y2={rect.y + rect.height} stroke={color} strokeWidth={w}
                        strokeDasharray={dashArray(m.style ?? 'dashed', w)} strokeLinecap="round" />
                      {m.label && (
                        <text x={x + (right ? 5 : -5)} y={rect.y + 8 + k * 14} textAnchor={right ? 'start' : 'end'} {...valueLabelProps({ color, fontSize: chartTheme.fontSize.axis })}>
                          {m.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              {tip.length > 0 && hoverC !== null && (
                <ChartTooltip
                  label={tooltipHeader ? header : ''}
                  data={tip}
                  x={horizontal ? rect.x + rect.width / 2 : hoverC + step / 2}
                  y={horizontal ? hoverC : rect.y + rect.height / 2}
                  containerWidth={width}
                  visible
                  footer={total}
                />
              )}
            </>
          );
        }}
      </ResponsiveContainer>
    </ChartFrame>
  );
}
