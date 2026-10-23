'use client';
// The one renderer behind LineChart, AreaChart and TimeSeriesChart.
//
// `mode="band"` places points by index on a category axis (stacking allowed); `mode="time"`
// places them by timestamp (phase 9 §9.1 / §9.2: uneven sampling, gaps, drag-to-zoom). Zoom is
// a drag-to-select brush local to this component's state: it never reaches the caller, so a
// board's time window is untouched. Double-click or the "Reset zoom" button leaves it. With
// `onRangeSelect` the same drag (a pointer: mouse, pen or touch) selects a range FOR the caller
// instead (a band axis of instants too, through `categoryTimes`), a double click or Escape asks
// for a reset, and the keyboard builds a selection (arrows, Shift + arrows, Enter); the local
// zoom then stays out of the way, as the host owns the window.
//
// Everything a widget setting can change is a prop: curve (smooth / linear / step), per-series
// stroke style, width, points and fill, hidden series (legend toggle), legend position and
// values, fixed y bounds, axis titles, thresholds, the tooltip mode and the axis text style.

import { useId, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer } from '../primitives/ResponsiveContainer';
import { XAxis, YAxis } from '../primitives/Axis';
import { Grid } from '../primitives/Grid';
import { ChartTooltip } from '../primitives/Tooltip';
import { Crosshair } from '../primitives/Crosshair';
import { ChartFrame } from '../primitives/ChartFrame';
import { Thresholds } from '../primitives/Thresholds';
import { AxisTitles } from '../primitives/AxisTitles';
import { animationDuration, chartTheme } from '../theme';
import type { BaseChartProps, CurveType, PlotRect, PointShape, TooltipDatum } from '../types';
import {
  niceTicks, yScale, bandCenter, xCategories, curvePath, continuePath, thinLabels,
  dashArray, resolveDomain, defaultNumber, alignedDomain, stackKeys, groupedStackTops, topsExtent, labelWidth,
} from './_helpers';
import {
  timeExtent, timePoints, visibleYExtent, xTime, invTime, timeTicks, formatTick, formatFull,
  brushDomain, brushRange, bandIndex, bandRange, keyRange, keyedTimeRange, nearestIndex, MIN_BRUSH_PX,
  type KeySelection, type TimeDomain, type TimePoint,
} from './_time';
import { chartLegend, plotPadding, useSeriesVisibility, valueText } from './_cartesian';
import { PointMark, useEntrance, valueLabelProps } from './_marks';

export type SeriesChartProps = BaseChartProps & {
  variant: 'line' | 'area';
  mode: 'band' | 'time';
  /** Smooth curves. Default = true. `curve` wins when set. */
  smooth?: boolean;
  /** How points are joined. Default = 'smooth' ('linear' for a stacked area without an explicit curve). */
  curve?: CurveType;
  /** Default stroke width (px) for series without their own. Default = 2. */
  strokeWidth?: number;
  /** Area fill alpha (0..1) for series without their own. Default = 0.2. */
  fillOpacity?: number;
  /** Band mode only: stack the series (see `Series.stack` for several stacks). */
  stacked?: boolean;
  /** Locale for time tick labels; default = the runtime's. */
  locale?: string;
  /** Point mark for series without their own. Default = 'circle'. */
  pointShape?: PointShape;
  /** Point radius (px) for series without their own. Default = stroke width + 1.5. */
  pointSize?: number;
  /** Print each point's value (thinned so labels never collide). Default = false. */
  showValues?: boolean;
  /** Value labels above (default) or below their point. */
  valueLabelPosition?: 'top' | 'bottom';
};

type Row = TimePoint;

export function SeriesChart({
  series, variant, mode, height = 240, showLegend = true, showGrid = true, showTooltip = true,
  smooth = true, curve: curveProp, strokeWidth = 2, fillOpacity = 0.2, stacked = false,
  zoom = true, resetZoomLabel = 'Reset zoom', yFormat, locale, timeZone, ariaLabel, className,
  legendPosition = 'bottom', legendValues, legendStyle, legendToggle, yMin, yMax, yLabel, xLabel,
  thresholds, tooltipMode, gridColor, tickStyle, fill, yTickCount = 4, showXAxis = true, showYAxis = true,
  gridStyle, y2Min, y2Max, y2Label, y2Format, tooltipHeader = true, tooltipValueFormat, tooltipTotal = false,
  tooltipTotalLabel = 'Total',
  animate = true, valueLabelStyle, pointShape, pointSize, showValues = false, valueLabelPosition = 'top',
  yIncludeZero = true, onRangeSelect, categoryTimes,
}: SeriesChartProps) {
  const isTime = mode === 'time';
  const tipMode = showTooltip ? (tooltipMode ?? 'axis') : 'none';

  const vis = useSeriesVisibility(series);
  const visible = vis.visible;
  const keys = useMemo(() => (isTime ? visible.map(() => null) : stackKeys(visible, stacked)), [isTime, visible, stacked]);
  const isStacked = keys.some((k) => k !== null);
  const curve: CurveType = curveProp ?? (smooth && !isStacked ? 'smooth' : 'linear');
  const [zoomDomain, setZoomDomain] = useState<TimeDomain | null>(null);
  const [hover, setHover] = useState<{ key: number; y: number } | null>(null);
  const [brush, setBrush] = useState<{ from: number; to: number } | null>(null);
  const [keySel, setKeySel] = useState<KeySelection | null>(null);
  // Whether the pointer of the running drag is captured (the drag then survives leaving the plot).
  const captured = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const uid = useId().replace(/:/g, '');
  const clipId = `sc-clip-${uid}`;
  const animMs = animationDuration();
  const enter = useEntrance('reveal-x', animate);
  const fmt = yFormat ?? defaultNumber;
  const fmt2 = y2Format ?? fmt;

  const categories = useMemo(() => xCategories(vis.colored), [vis.colored]);
  // A range for the host: on the time axis, or on a band axis whose every category has its instant.
  const selecting = !!onRangeSelect && (isTime || (!!categoryTimes && categories.length > 0 && categoryTimes.length === categories.length));
  // The local zoom steps aside when the host takes the range.
  const zoomable = isTime && zoom && !selecting;
  const dragOn = zoomable || selecting;
  const rows: Row[][] = useMemo(
    () => (isTime ? timePoints(visible) : visible.map((s) => s.data.map((p, i) => ({ t: i, y: p.y, label: p.label })))),
    [isTime, visible],
  );
  const full: TimeDomain = useMemo(() => (isTime ? timeExtent(visible) : [0, 1]), [isTime, visible]);
  const domain: TimeDomain = zoomDomain && zoomDomain[1] > full[0] && zoomDomain[0] < full[1] ? zoomDomain : full;
  const zoomed = isTime && domain !== full;
  const span = domain[1] - domain[0];
  const stack = useMemo(() => (isTime ? null : groupedStackTops(visible, keys)), [isTime, visible, keys]);

  // Two value axes: series on the right get their own domain, aligned to the left one's grid lines.
  const onRight = visible.map((s) => s.yAxis === 'right');
  const hasRight = onRight.some(Boolean);
  const hasLeft = onRight.some((r) => !r) || !hasRight;
  const extentOf = (right: boolean) => {
    const idx = visible.map((_, i) => i).filter((i) => onRight[i] === right);
    // A stack always starts at zero; otherwise the author decides.
    const zero = yIncludeZero || isStacked;
    if (isTime) return visibleYExtent(idx.map((i) => rows[i]), domain, zero);
    return topsExtent(idx.map((i) => stack!.tops[i]), zero);
  };
  const thrL = thresholds?.filter((t) => t.yAxis !== 'right');
  const thrR = thresholds?.filter((t) => t.yAxis === 'right');
  const L = hasLeft
    ? resolveDomain(extentOf(false), { min: yMin, max: yMax, thresholds: thrL, count: yTickCount })
    : resolveDomain(extentOf(true), { min: y2Min, max: y2Max, thresholds: thrR, count: yTickCount });
  const leftTicks = niceTicks(L.min, L.max, yTickCount);
  let R: { min: number; max: number; ticks: number[] } | null = null;
  if (hasRight && hasLeft) {
    const e = extentOf(true);
    for (const t of thrR ?? []) { if (t.value < e.min) e.min = t.value; if (t.value > e.max) e.max = t.value; }
    R = alignedDomain(e, leftTicks.length - 1, { min: y2Min, max: y2Max });
  } else if (hasRight) {
    R = { min: L.min, max: L.max, ticks: leftTicks };
  }

  const legend = chartLegend({
    show: showLegend, series: vis.colored, hidden: vis.hidden, toggle: vis.toggle, position: legendPosition,
    values: legendValues, style: legendStyle, toggleable: legendToggle, yFormat,
  });

  return (
    <ChartFrame legend={legend} position={legendPosition} className={className} fill={fill}>
      <ResponsiveContainer height={height} fill={fill}>
        {({ width, height }) => {
          const yTickLabels = hasLeft ? leftTicks.map(fmt) : [];
          const y2TickLabels = R ? R.ticks.map(fmt2) : undefined;
          const pad = plotPadding({ yTickLabels, y2TickLabels, xLabel, yLabel, y2Label: R ? y2Label : undefined, tickStyle, showXAxis, showYAxis, minLeft: hasLeft ? 28 : 8 });
          const rect: PlotRect = {
            x: pad.left, y: pad.top,
            width: Math.max(0, width - pad.left - pad.right),
            height: Math.max(0, height - pad.top - pad.bottom),
          };
          const yPxL = (v: number) => yScale(v, L.min, L.max, rect);
          const yPxR = R ? (v: number) => yScale(v, R!.min, R!.max, rect) : yPxL;
          const scaleOf = (si: number) => (onRight[si] && hasLeft ? yPxR : yPxL);
          const xPx = (k: number) => (isTime ? xTime(k, domain, rect) : bandCenter(k, categories.length, rect));
          const yPixels = leftTicks.map(yPxL);
          const yTicks = hasLeft ? leftTicks.map((_, i) => ({ position: yPixels[i], label: yTickLabels[i] })) : [];
          const y2Ticks = R ? R.ticks.map((v, i) => ({ position: yPxR(v), label: y2TickLabels![i] })) : [];
          const xTicks = isTime
            ? timeTicks(domain, Math.max(2, Math.floor(rect.width / 90)), timeZone)
              .map((t) => ({ position: xTime(t, domain, rect), label: formatTick(t, span, locale, timeZone) }))
            : thinLabels(categories.map((label, i) => ({ position: bandCenter(i, categories.length, rect), label })), rect.width);

          const plotY = (si: number, j: number, y: number) => scaleOf(si)(isStacked && stack ? (stack.tops[si]?.[j] ?? 0) : y);
          const projected = visible.map((s, si) => {
            const color = s.color as string;
            const w = s.strokeWidth ?? strokeWidth;
            const scale = scaleOf(si);
            const pts = rows[si].map((p, j) => (p.y === null || p.y === undefined ? null : { x: xPx(p.t), y: plotY(si, j, p.y), v: p.y, j }));
            const solid = pts.filter(Boolean) as Array<{ x: number; y: number; v: number; j: number }>;
            const opacity = variant === 'area' ? (s.fillOpacity ?? fillOpacity) : (s.fillOpacity ?? 0);
            const baselineY = scale(Math.min(onRight[si] && R ? R.max : L.max, Math.max(onRight[si] && R ? R.min : L.min, 0)));
            let areaPath = '';
            if (opacity > 0 && solid.length > 1) {
              const top = curvePath(solid, curve);
              const under = stack ? stack.below[si] : -1;
              if (isStacked && stack && under >= 0) {
                const lower = rows[si]
                  .map((p, j) => (p.y !== null && p.y !== undefined && stack.tops[under]?.[j] != null ? { x: xPx(p.t), y: scale(stack.tops[under][j] as number) } : null))
                  .filter(Boolean) as Array<{ x: number; y: number }>;
                areaPath = `${top} ${continuePath(lower.reverse(), curve, 'before')} Z`;
              } else {
                areaPath = `${top} L${solid[solid.length - 1].x} ${baselineY} L${solid[0].x} ${baselineY} Z`;
              }
            }
            return {
              s, si, color, w, pts, solid, opacity, areaPath,
              gradientId: s.fillGradient ? `sc-grad-${uid}-${si}` : null,
              path: curvePath(pts, curve),
              solo: solid.length === 1 ? solid[0] : null,
              shape: s.pointShape ?? pointShape ?? 'circle',
              r: s.pointSize ?? pointSize ?? w + 1.5,
            };
          });

          // Value labels: every k-th point so neighbouring labels never collide.
          const labelTexts = showValues ? projected.map((p) => p.solid.map((q) => valueText(p.s, q.v, rows[p.si][q.j], yFormat))) : [];
          const labelEvery = showValues ? projected.map((p, i) => {
            if (p.solid.length < 2) return 1;
            const room = Math.abs(p.solid[p.solid.length - 1].x - p.solid[0].x) / (p.solid.length - 1);
            return Math.max(1, Math.ceil((labelWidth(labelTexts[i]) + 8) / Math.max(1, room)));
          }) : [];

          // Hover: band = the hovered index; time = the nearest sampled instant across the visible series.
          let anchor: number | null = null;
          let header = '';
          let tip: Array<TooltipDatum & { py: number }> = [];
          if (hover && tipMode !== 'none' && !brush) {
            if (isTime) {
              const allTimes = [...new Set(rows.flatMap((pts) => pts.map((p) => p.t)))].sort((a, b) => a - b);
              const k = nearestIndex(allTimes, hover.key);
              anchor = k >= 0 ? allTimes[k] : null;
              if (anchor !== null) header = formatFull(anchor, span, locale, timeZone);
            } else if (hover.key >= 0 && hover.key < categories.length) {
              anchor = hover.key;
              header = categories[hover.key];
            }
            if (anchor !== null) {
              const at = anchor;
              tip = visible.flatMap((s, si) => {
                const j = isTime ? rows[si].findIndex((p) => p.t === at) : at;
                const p = rows[si][j];
                if (isTime && !p) return [];
                const y = p?.y ?? null;
                return [{
                  seriesId: s.id, seriesName: s.name, color: s.color as string, x: isTime ? at : header, y,
                  valueLabel: y === null ? undefined : (tooltipValueFormat ? tooltipValueFormat(y, s) : valueText(s, y, p, yFormat)),
                  py: y === null ? Number.NaN : plotY(si, j, y),
                }];
              });
              if (tipMode === 'point') {
                const near = tip.filter((d) => d.y !== null)
                  .sort((a, b) => Math.abs(a.py - hover.y) - Math.abs(b.py - hover.y))[0];
                tip = near ? [near] : [];
              }
            }
          }
          const hoverX = anchor === null ? null : xPx(anchor);
          const total = tooltipTotal && isStacked && tip.length > 1
            ? { label: tooltipTotalLabel, value: fmt(tip.reduce((a, d) => a + (d.y ?? 0), 0)) }
            : undefined;

          const local = (e: React.MouseEvent) => {
            const b = svgRef.current?.getBoundingClientRect();
            return b ? { px: e.clientX - b.left, py: e.clientY - b.top } : { px: 0, py: 0 };
          };
          const inPlot = (px: number) => px >= rect.x && px <= rect.x + rect.width;
          const clampPx = (px: number) => Math.min(rect.x + rect.width, Math.max(rect.x, px));
          const step = categories.length ? rect.width / categories.length : 0;

          // The selection for the host: a pointer band (px) snapped to whole categories on a band axis, or the keyed one.
          const bandOf = (i0: number, i1: number) => ({ from: rect.x + Math.min(i0, i1) * step, to: rect.x + (Math.max(i0, i1) + 1) * step });
          const pointerBand = brush && selecting && !isTime
            ? bandOf(bandIndex(brush.from - rect.x, step, categories.length), bandIndex(brush.to - rect.x, step, categories.length))
            : brush;
          const keyBand = keySel && selecting
            ? (isTime ? { from: xTime(keySel.anchor, domain, rect), to: xTime(keySel.focus, domain, rect) } : bandOf(keySel.anchor, keySel.focus))
            : null;
          const band = selecting ? (pointerBand ?? keyBand) : null;
          // A click is not a brush, on either axis: the band must be at least `MIN_BRUSH_PX` wide.
          const reportBrush = (px0: number, px1: number) => {
            if (Math.abs(px1 - px0) < MIN_BRUSH_PX) return;
            const range = isTime
              ? brushRange(px0, px1, domain, full, rect)
              : bandRange(categoryTimes!, bandIndex(px0 - rect.x, step, categories.length), bandIndex(px1 - rect.x, step, categories.length));
            if (range) { onRangeSelect!(range); setHover(null); }
          };
          const reportKeys = (sel: KeySelection) => {
            const range = isTime ? keyedTimeRange(sel) : bandRange(categoryTimes!, sel.anchor, sel.focus);
            if (range) onRangeSelect!(range);
          };
          const endDrag = () => { captured.current = false; setBrush(null); };

          return (
            <>
              <svg
                ref={svgRef}
                width={width}
                height={height}
                role="img"
                aria-label={ariaLabel ?? (variant === 'area' ? 'Area chart' : 'Line chart')}
                tabIndex={selecting ? 0 : undefined}
                className={selecting ? 'outline-none focus-visible:ring-2 focus-visible:ring-border-focus' : undefined}
                style={{
                  display: 'block', overflow: 'visible',
                  ...(isTime || selecting ? { touchAction: 'pan-y', cursor: dragOn ? 'crosshair' : undefined, userSelect: 'none' } : {}),
                }}
                onPointerDown={(e) => {
                  if (!dragOn || e.button !== 0) return;
                  const { px } = local(e);
                  if (!inPlot(px)) return;
                  // Keep the drag through a pointer that leaves the plot (not every DOM has capture: jsdom).
                  const el = e.currentTarget;
                  if (typeof el.setPointerCapture === 'function') {
                    try { el.setPointerCapture(e.pointerId); captured.current = true; } catch { captured.current = false; }
                  }
                  setKeySel(null);
                  setBrush({ from: px, to: px });
                }}
                onPointerMove={(e) => {
                  if (brush) setBrush({ from: brush.from, to: clampPx(local(e).px) });
                }}
                onPointerUp={() => {
                  if (!brush) return;
                  endDrag();
                  if (selecting) reportBrush(brush.from, brush.to);
                  else {
                    const next = brushDomain(brush.from, brush.to, domain, full, rect);
                    if (next) { setZoomDomain(next); setHover(null); }
                  }
                }}
                onPointerCancel={endDrag}
                onMouseMove={(e) => {
                  const { px, py } = local(e);
                  if (tipMode === 'none') return;
                  if (!inPlot(px)) { setHover(null); return; }
                  if (isTime) setHover({ key: invTime(px, domain, rect), y: py });
                  else if (categories.length) setHover({ key: bandIndex(px - rect.x, step, categories.length), y: py });
                }}
                onMouseLeave={() => { setHover(null); if (!captured.current) setBrush(null); }}
                onDoubleClick={() => {
                  if (selecting) { setKeySel(null); onRangeSelect!(null); } else if (zoomable) setZoomDomain(null);
                }}
                onKeyDown={(e) => {
                  if (!selecting) return;
                  if (e.key === 'Escape') {
                    if (!brush && !keySel) return;
                    e.preventDefault();
                    endDrag();
                    setKeySel(null);
                    onRangeSelect!(null);
                  } else if (e.key === 'Enter') {
                    if (keySel) { e.preventDefault(); reportKeys(keySel); }
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const dir = e.key === 'ArrowLeft' ? -1 : 1;
                    setKeySel(isTime
                      ? keyRange(keySel, dir, e.shiftKey, domain[0], domain[1], span / 20)
                      : keyRange(keySel, dir, e.shiftKey, 0, categories.length - 1, 1));
                  }
                }}
              >
                <defs>
                  <clipPath id={clipId}><rect x={rect.x - 4} y={rect.y - 4} width={rect.width + 8} height={rect.height + 8} /></clipPath>
                  {projected.map((p) => p.gradientId && (
                    <linearGradient key={p.gradientId} id={p.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={p.color} stopOpacity={Math.min(1, p.opacity * 1.6)} />
                      <stop offset="100%" stopColor={p.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                {showGrid && <Grid rect={rect} yTicks={yPixels} color={gridColor} lineStyle={gridStyle} />}
                {hasLeft && <YAxis ticks={yTicks} x={rect.x} yStart={rect.y} yEnd={rect.y + rect.height} textStyle={tickStyle} hideLine tickMarks={false} showLabels={showYAxis} />}
                {R && <YAxis side="right" ticks={y2Ticks} x={rect.x + rect.width} yStart={rect.y} yEnd={rect.y + rect.height} textStyle={tickStyle} hideLine tickMarks={false} showLabels={showYAxis} />}
                <XAxis ticks={xTicks} y={rect.y + rect.height} xStart={rect.x} xEnd={rect.x + rect.width} textStyle={tickStyle} tickMarks={false} showLabels={showXAxis} />
                <AxisTitles rect={rect} height={height} width={width} xLabel={xLabel} yLabel={yLabel} y2Label={R ? y2Label : undefined} style={tickStyle} />
                <Crosshair rect={rect} x={tipMode === 'none' || brush ? null : hoverX} />
                <g ref={enter}>
                  <g clipPath={`url(#${clipId})`}>
                    {projected.map((p) => (
                      <g key={p.s.id} data-series={p.s.id}>
                        {p.areaPath && (
                          <path d={p.areaPath} fill={p.gradientId ? `url(#${p.gradientId})` : p.color} opacity={p.gradientId ? undefined : p.opacity} data-area=""
                            data-fill={p.gradientId ? 'gradient' : 'opacity'}
                            style={{ transition: animMs ? `opacity ${animMs}ms` : undefined }} />
                        )}
                        <path d={p.path} fill="none" stroke={p.color} strokeWidth={p.w} data-line=""
                          strokeDasharray={dashArray(p.s.lineStyle, p.w)} strokeLinecap="round" strokeLinejoin="round" />
                        {p.s.showPoints
                          ? p.solid.map((q, i) => (
                            <PointMark key={i} shape={p.shape} x={q.x} y={q.y} r={p.r} fill={p.color} data-point=""
                              stroke="var(--surface-raised)" strokeWidth={1} />
                          ))
                          : p.solo && <PointMark shape={p.shape} x={p.solo.x} y={p.solo.y} r={Math.max(3, p.r)} fill={p.color} />}
                      </g>
                    ))}
                    {hasLeft && <Thresholds lines={thrL} rect={rect} scale={yPxL} />}
                    {R && <Thresholds lines={hasLeft ? thrR : thresholds} rect={rect} scale={hasLeft ? yPxR : yPxL} />}
                  </g>
                  {showValues && projected.map((p, pi) => (
                    <g key={`v-${p.s.id}`} data-value-labels={p.s.id}>
                      {p.solid.map((q, i) => ((i % labelEvery[pi] === 0 || i === p.solid.length - 1) && (i === p.solid.length - 1 || p.solid.length - 1 - i >= labelEvery[pi]) ? (
                        <text key={i} data-value-label="" x={q.x} y={valueLabelPosition === 'bottom' ? q.y + p.r + 13 : q.y - p.r - 5}
                          textAnchor={i === 0 && q.x - rect.x < 16 ? 'start' : i === p.solid.length - 1 && rect.x + rect.width - q.x < 16 ? 'end' : 'middle'}
                          {...valueLabelProps(valueLabelStyle)}>
                          {labelTexts[pi][i]}
                        </text>
                      ) : null))}
                    </g>
                  ))}
                </g>
                {hoverX !== null && tip.map((d) => (Number.isFinite(d.py) ? (
                  <circle key={d.seriesId} cx={hoverX} cy={d.py} r={4} fill="var(--surface-raised)" stroke={d.color} strokeWidth={2} />
                ) : null))}
                {!selecting && brush && Math.abs(brush.to - brush.from) > 0 && (
                  <rect x={Math.min(brush.from, brush.to)} y={rect.y} width={Math.abs(brush.to - brush.from)} height={rect.height}
                    fill={chartTheme.crosshair} opacity={0.2} pointerEvents="none" />
                )}
                {band && (
                  // The selection for the host: a tinted band with its two edges (a single edge is the keyboard cursor).
                  <g data-range-band="" aria-hidden="true" pointerEvents="none">
                    {Math.abs(band.to - band.from) > 0 && (
                      <rect x={Math.min(band.from, band.to)} y={rect.y} width={Math.abs(band.to - band.from)} height={rect.height} fill="var(--primary)" opacity={0.12} />
                    )}
                    <line x1={band.from} x2={band.from} y1={rect.y} y2={rect.y + rect.height} stroke="var(--primary)" strokeWidth={1} />
                    <line x1={band.to} x2={band.to} y1={rect.y} y2={rect.y + rect.height} stroke="var(--primary)" strokeWidth={1} />
                  </g>
                )}
              </svg>
              {hoverX !== null && tip.length > 0 && (
                <ChartTooltip label={tooltipHeader ? header : ''} data={tip} x={hoverX} y={rect.y + rect.height / 2} containerWidth={width} visible footer={total} />
              )}
            </>
          );
        }}
      </ResponsiveContainer>
      {zoomable && zoomed && (
        <button
          type="button"
          onClick={() => setZoomDomain(null)}
          className="mt-1 self-start rounded-sm text-xs text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {resetZoomLabel}
        </button>
      )}
    </ChartFrame>
  );
}
