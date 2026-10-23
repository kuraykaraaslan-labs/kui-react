'use client';
// modules/ui/Chart/charts/PieChart.tsx
//
// Single-series proportional pie. Each `SeriesPoint` becomes a slice.
// Multi-series pies are not meaningful — the first series wins.
// DonutChart re-uses the same arc math with `innerRadius > 0`.
// Options: slice labels (percent / value / name / name and percent) inside the slice or outside
// with a leader line, their text style; the start angle; an even gap between slices; the donut
// centre (total + caption, or off); legend position, layout (wrapping line or tidy grid) and a
// value or share after each name; legend toggling of slices; what the tooltip prints. With
// `onSliceClick` every slice is a button (click, Enter or Space) that reports the point it came from.

import { useMemo, useState, type CSSProperties } from 'react';
import { ResponsiveContainer } from '../primitives/ResponsiveContainer';
import { Legend } from '../primitives/Legend';
import { ChartTooltip } from '../primitives/Tooltip';
import { ChartFrame } from '../primitives/ChartFrame';
import { paletteColor, animationDuration } from '../theme';
import type { AxisTextStyle, BaseChartProps, LegendPosition, Series, TooltipDatum } from '../types';
import { defaultNumber } from './_helpers';
import { useEntrance, valueLabelProps } from './_marks';

export type PieChartProps = Omit<BaseChartProps, 'legendValues'> & {
  /** Inner radius ratio (0 = pie, 0.6 = donut). Default = 0. */
  innerRadius?: number;
  /** Text drawn on each slice. Default = 'none'. Slices under `minLabelShare` stay unlabelled. */
  labels?: 'none' | 'percent' | 'value' | 'name' | 'name-percent';
  /** Labels inside the slice (default) or outside it with a leader line. */
  labelPosition?: 'inside' | 'outside';
  /** Slice label text style. */
  labelStyle?: AxisTextStyle;
  /** Smallest share (0..1) that gets a label. Default = 0.04. */
  minLabelShare?: number;
  /** Value text (tooltip, labels, legend, centre). Default = rounded number. */
  valueFormat?: (value: number) => string;
  /** Donut only: show the total (or the hovered share) in the centre. Default = true. */
  showCenter?: boolean;
  /** Donut only: a caption under the centre total, e.g. "Total". */
  centerLabel?: string;
  /** Text after each legend name. Default = 'none'. */
  legendValue?: 'none' | 'value' | 'percent';
  legendPosition?: LegendPosition;
  legendStyle?: CSSProperties;
  /** 'grid' lines legend entries up in columns (top / bottom). Default = 'wrap'. */
  legendLayout?: 'wrap' | 'grid';
  /** Legend entries hide / show their slice. Default = false (on when `hiddenSlices` is set). */
  legendToggle?: boolean;
  /** Slice names hidden at first. */
  hiddenSlices?: string[];
  /** Where the first slice starts, in degrees clockwise from 12 o'clock. Default = 0. */
  startAngle?: number;
  /** Pixels between slices (an even gap, whatever the background). Default = 0. */
  sliceGap?: number;
  /** What the tooltip prints for a slice. Default = 'both' (value and share). */
  tooltipValue?: 'both' | 'value' | 'percent';
  /**
   * Slices answer a click, Enter and Space: each becomes a focusable button named by its label and value, the chart a
   * group instead of one picture, and the cursor a pointer. Absent = the slices are plain shapes, drawn exactly as before.
   */
  onSliceClick?: (slice: PieSlice) => void;
};

/** What a slice click reports: the index of the point in `series[0].data`, and what the slice showed. */
export type PieSlice = { index: number; name: string; value: number; color: string };

/** Convert a polar (cx, cy, r, angle°) to cartesian. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

const DEG = 180 / Math.PI;

/**
 * An annular wedge (r0 = 0: a pie slice) with an even `gap` px to its neighbours: both straight edges
 * are moved inward by gap / 2, so the gap is parallel-sided like a cut, not a tapering wedge.
 */
function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, gap = 0): string {
  // A full circle cannot be one arc: split it.
  if (a1 - a0 >= 359.999) {
    if (r0 <= 0) return `M${cx} ${cy - r1} A${r1} ${r1} 0 1 1 ${cx} ${cy + r1} A${r1} ${r1} 0 1 1 ${cx} ${cy - r1} Z`;
    return `${arcPath(cx, cy, r0, r1, a0, a0 + 180)} ${arcPath(cx, cy, r0, r1, a0 + 180, a1 - 0.001)}`;
  }
  const half = gap / 2;
  const sweep = a1 - a0;
  const d1 = half > 0 ? Math.asin(Math.min(1, half / r1)) * DEG : 0;
  if (sweep - 2 * d1 <= 0.2) return '';
  const o0 = a0 + d1;
  const o1 = a1 - d1;
  const large = o1 - o0 > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, o0);
  const [x1, y1] = polar(cx, cy, r1, o1);
  if (r0 <= 0) {
    // The apex sits on the bisector, gap / 2 from both edges.
    const halfRad = (sweep / 2) / DEG;
    const apexR = half > 0 && sweep < 180 ? half / Math.sin(halfRad) : 0;
    const [px, py] = apexR > 0 ? polar(cx, cy, Math.min(apexR, r1 * 0.5), (a0 + a1) / 2) : [cx, cy];
    return `M${px} ${py} L${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} Z`;
  }
  const d0 = half > 0 ? Math.asin(Math.min(1, half / r0)) * DEG : 0;
  const i0 = a0 + d0;
  const i1 = a1 - d0;
  const [x2, y2] = polar(cx, cy, r0, Math.max(i0, i1));
  const [x3, y3] = polar(cx, cy, r0, Math.min(i0, i1));
  const largeIn = Math.abs(i1 - i0) > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${largeIn} 0 ${x3} ${y3} Z`;
}

export function PieChart({
  series,
  height = 240,
  showLegend = true,
  showTooltip = true,
  innerRadius = 0,
  labels = 'none',
  labelPosition = 'inside',
  labelStyle,
  minLabelShare = 0.04,
  valueFormat,
  showCenter = true,
  centerLabel,
  legendValue = 'none',
  legendPosition = 'bottom',
  legendStyle,
  legendLayout = 'wrap',
  legendToggle,
  hiddenSlices,
  tooltipMode,
  tooltipValue = 'both',
  startAngle = 0,
  sliceGap = 0,
  fill,
  animate = true,
  ariaLabel,
  className,
  onSliceClick,
}: PieChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(hiddenSlices ?? []));
  const animMs = animationDuration();
  const enter = useEntrance('grow', animate);
  const fmt = valueFormat ?? defaultNumber;
  const tipOn = showTooltip && tooltipMode !== 'none';
  const clickable = !!onSliceClick;

  // Use the first series; flatten its points into wedges. `index` is the point's place in the data (a click reports it).
  const all = useMemo(() => {
    const first = series[0];
    const out: Array<{ id: string; name: string; value: number; color: string; index: number }> = [];
    if (!first) return out;
    first.data.forEach((p, index) => {
      if (p.y === null || p.y === undefined || p.y < 0) return;
      const i = out.length;
      out.push({ id: `${first.id}-${i}`, name: String(p.label ?? p.x), value: p.y, color: paletteColor(i, p.color), index });
    });
    return out;
  }, [series]);
  const slices = all.filter((s) => !hidden.has(s.name));
  const total = slices.reduce((acc, s) => acc + s.value, 0) || 1;
  const allTotal = all.reduce((acc, s) => acc + s.value, 0) || 1;
  const pctText = (v: number, t: number) => `${Math.round((v / t) * 100)}%`;

  // Synthetic per-slice series for the legend (one entry per slice).
  const legendSeries: Series[] = all.map((s) => ({ id: s.id, name: s.name, data: [], color: s.color }));
  const toggleable = legendToggle ?? (hiddenSlices?.length ?? 0) > 0;
  const legend = showLegend && legendSeries.length ? (
    <Legend
      series={legendSeries}
      position={legendPosition}
      style={legendStyle}
      layout={legendLayout}
      hiddenIds={new Set(all.filter((s) => hidden.has(s.name)).map((s) => s.id))}
      onToggle={toggleable ? (id) => {
        const name = all.find((s) => s.id === id)?.name;
        if (name === undefined) return;
        setHidden((prev) => {
          const next = new Set(prev);
          if (next.has(name)) next.delete(name); else next.add(name);
          return next;
        });
      } : undefined}
      values={legendValue === 'none' ? undefined : Object.fromEntries(all.map((s) => [
        s.id, legendValue === 'percent' ? pctText(s.value, hidden.has(s.name) ? allTotal : total) : fmt(s.value),
      ]))}
    />
  ) : null;

  const labelOf = (w: { name: string; value: number }) => (labels === 'percent' ? pctText(w.value, total)
    : labels === 'value' ? fmt(w.value)
      : labels === 'name' ? w.name
        : `${w.name} ${pctText(w.value, total)}`);

  return (
    <ChartFrame legend={legend} position={legendPosition} className={className} fill={fill}>
      <ResponsiveContainer height={height} fill={fill}>
        {({ width, height }) => {
          const outside = labels !== 'none' && labelPosition === 'outside';
          const longest = outside ? Math.max(0, ...slices.map((s) => labelOf(s).length)) : 0;
          const textRoom = outside ? longest * 6.4 + 22 : 0;
          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.max(0, outside ? Math.min(width / 2 - textRoom, height / 2 - 18) : Math.min(width, height) / 2 - 4);
          const r0 = innerRadius > 0 ? radius * innerRadius : 0;

          let cursor = 0;
          const wedges = slices.map((s) => {
            const a0 = startAngle + (cursor / total) * 360;
            cursor += s.value;
            const a1 = startAngle + (cursor / total) * 360;
            return { ...s, a0, a1, d: arcPath(cx, cy, r0, radius, a0, a1, slices.length > 1 ? sliceGap : 0) };
          });
          const hv = hover !== null ? wedges[hover] : undefined;

          const tipText = (v: number) => (tooltipValue === 'value' ? fmt(v) : tooltipValue === 'percent' ? pctText(v, total) : `${fmt(v)} (${pctText(v, total)})`);
          const tooltipData: TooltipDatum[] = hv
            ? [{ seriesId: hv.id, seriesName: hv.name, color: hv.color, x: hv.name, y: hv.value, valueLabel: tipText(hv.value) }]
            : [];
          const labelR = r0 > 0 ? (r0 + radius) / 2 : radius * 0.64;
          const centreSize = Math.round(Math.max(14, Math.min(30, r0 * 0.42)));
          const report = (w: { index: number; name: string; value: number; color: string }) =>
            onSliceClick?.({ index: w.index, name: w.name, value: w.value, color: w.color });

          return (
            <>
              <svg
                width={width}
                height={height}
                // One picture, unless the slices are buttons: a picture's children are not reachable.
                role={clickable ? 'group' : 'img'}
                aria-label={ariaLabel ?? 'Pie chart'}
                style={{ display: 'block', overflow: 'visible' }}
              >
                <g ref={enter}>
                  {wedges.map((w, i) => (
                    <path
                      key={w.id}
                      d={w.d}
                      fill={w.color}
                      opacity={hover === null || hover === i ? 1 : 0.5}
                      onMouseEnter={() => tipOn && setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      style={{ transition: animMs ? `opacity ${animMs}ms` : undefined }}
                      {...(clickable ? {
                        role: 'button',
                        tabIndex: 0,
                        'aria-label': `${w.name}, ${fmt(w.value)}`,
                        'data-slice': w.index,
                        className: 'cursor-pointer outline-none focus-visible:stroke-border-focus',
                        strokeWidth: 2,
                        onClick: () => report(w),
                        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); report(w); } },
                        onFocus: () => tipOn && setHover(i),
                        onBlur: () => setHover((h) => (h === i ? null : h)),
                      } : {})}
                    />
                  ))}
                  {labels !== 'none' && wedges.map((w) => {
                    if ((w.a1 - w.a0) / 360 < minLabelShare) return null;
                    const mid = (w.a0 + w.a1) / 2;
                    const text = labelOf(w);
                    if (outside) {
                      const [ax, ay] = polar(cx, cy, radius + 2, mid);
                      const [bx, by] = polar(cx, cy, radius + 12, mid);
                      const right = bx >= cx;
                      const ex = bx + (right ? 8 : -8);
                      return (
                        <g key={`l-${w.id}`} data-slice-label-group="">
                          <polyline points={`${ax},${ay} ${bx},${by} ${ex},${by}`} fill="none" stroke={w.color} strokeWidth={1} opacity={0.8} />
                          <text data-slice-label="" x={ex + (right ? 4 : -4)} y={by} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle"
                            {...valueLabelProps({ color: 'var(--text-primary)', ...labelStyle })}>
                            {text}
                          </text>
                        </g>
                      );
                    }
                    const [lx, ly] = polar(cx, cy, labelR, mid);
                    return (
                      <text key={`l-${w.id}`} data-slice-label="" x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        {...valueLabelProps({ fontWeight: 600, ...labelStyle }, true)}>
                        {text}
                      </text>
                    );
                  })}
                </g>
                {r0 > 0 && showCenter && (
                  <>
                    <text
                      x={cx}
                      y={centerLabel && !hv ? cy - centreSize * 0.32 : cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--text-primary)"
                      fontSize={centreSize}
                      fontWeight={600}
                      style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}
                      data-center=""
                    >
                      {hv ? pctText(hv.value, total) : valueFormat ? fmt(total) : Math.round(total)}
                    </text>
                    {centerLabel && !hv && (
                      <text x={cx} y={cy + centreSize * 0.62} textAnchor="middle" dominantBaseline="middle" fill="var(--text-secondary)" fontSize={11}>
                        {centerLabel}
                      </text>
                    )}
                  </>
                )}
              </svg>
              {tipOn && hv && (
                <ChartTooltip
                  label=""
                  data={tooltipData}
                  x={polar(cx, cy, radius * 0.7, (hv.a0 + hv.a1) / 2)[0]}
                  y={polar(cx, cy, radius * 0.7, (hv.a0 + hv.a1) / 2)[1]}
                  containerWidth={width}
                  visible
                />
              )}
            </>
          );
        }}
      </ResponsiveContainer>
    </ChartFrame>
  );
}
