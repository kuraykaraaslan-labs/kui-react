'use client';
// modules/ui/Chart/charts/BurnChart.tsx
//
// BurnChart — an SLO burn view built on the Chart family's primitives (axes, grid, thresholds, tooltip, the time
// helpers of ./_time.ts) so it shares their theme, dark mode and RTL behaviour instead of duplicating them:
//   • the error budget remaining (percent) as a line, with a projection that runs to zero at the recent pace;
//   • the burn rate with the alerting tiers as labelled thresholds (default: the SRE workbook's 14.4 / 6 / 3 / 1);
//   • annotations (a deploy, an incident) as markers across both panels.
// Colour is never the only signal: tiers and annotations carry text labels, the projection is dashed, and a text
// summary under the chart states the latest budget, the active tier and the projected exhaustion.

import { useId, useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { chartTheme } from '../theme';
import { XAxis, YAxis, type AxisTick } from '../primitives/Axis';
import { Grid } from '../primitives/Grid';
import { Thresholds } from '../primitives/Thresholds';
import { ChartTooltip } from '../primitives/Tooltip';
import { ResponsiveContainer } from '../primitives/ResponsiveContainer';
import { isRtlElement } from '../../_shared/dom';
import { fillMessage } from '../../_shared/format';
import type { PlotRect, ThresholdLine, TooltipDatum } from '../types';
import { labelWidth, linePath, niceTicks, yScale } from './_helpers';
import { formatFull, formatTick, timeTicks, toTime, xTime } from './_time';
import {
  DEFAULT_BURN_TIERS, activeTier, budgetState, nearestPointIndex, normalizePoints, projectBudget, sortTiers, valueNear,
  type BurnPoint, type BurnTier, type BurnTone,
} from './_burn';

export type { BurnPoint, BurnTier, BurnTone } from './_burn';
export { DEFAULT_BURN_TIERS, projectBudget, activeTier, budgetState } from './_burn';

export type BurnAnnotation = {
  id: string;
  /** Epoch ms or an ISO string. */
  t: number | string;
  label: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
};

export type BurnChartMessages = {
  label: string;
  budget: string;
  burnRate: string;
  projection: string;
  tiers: string;
  annotations: string;
  /** `{date}` */
  exhaustedAt: string;
  spent: string;
  onTrack: string;
  noData: string;
  /** `{value}`, `{state}` */
  summaryBudget: string;
  /** `{value}` */
  summaryBurn: string;
  /** `{tier}` */
  summaryTier: string;
  summaryNoTier: string;
  /** `{count}` */
  summaryAnnotations: string;
  windowEnd: string;
  budgetState: { healthy: string; low: string; spent: string };
};

export const DEFAULT_BURN_CHART_MESSAGES: BurnChartMessages = {
  label: 'SLO burn chart',
  budget: 'Error budget remaining',
  burnRate: 'Burn rate',
  projection: 'Projected at the recent pace',
  tiers: 'Burn-rate tiers',
  annotations: 'Annotations',
  exhaustedAt: 'Budget runs out {date}',
  spent: 'Budget is spent',
  onTrack: 'Budget lasts the whole window at this pace',
  noData: 'No data',
  summaryBudget: 'Error budget remaining: {value} ({state}).',
  summaryBurn: 'Burn rate: {value}.',
  summaryTier: 'At or above the {tier} threshold.',
  summaryNoTier: 'Below every threshold.',
  summaryAnnotations: '{count} annotations.',
  windowEnd: 'Window end',
  budgetState: { healthy: 'healthy', low: 'low', spent: 'spent' },
};

export type BurnChartProps = {
  /** Error budget remaining over time, in percent of the whole budget (100 = untouched, 0 = spent). */
  budget?: BurnPoint[];
  /** Burn rate over time, in multiples of the sustainable rate (1 = the budget lasts exactly the window). */
  burnRate?: BurnPoint[];
  /** Thresholds drawn on the burn-rate panel. Default = the SRE workbook's four tiers. `[]` draws none. */
  tiers?: BurnTier[];
  /** Project when the budget runs out. `true` (default) uses the last quarter of the data; an object sets the lookback in ms. `false` hides it. */
  projection?: boolean | { lookbackMs?: number };
  annotations?: BurnAnnotation[];
  /** The SLO window's end: the time axis reaches it, a "window end" marker is drawn and the projection is cut there. */
  windowEnd?: number | string;
  /** Height of the budget panel in px (the burn-rate panel is a little shorter). Default = 200. */
  height?: number;
  locale?: string;
  /** IANA zone of the axis and tooltip. Default = the browser's. */
  timeZone?: string;
  /** Decimals of the percent and rate texts. Default = 1. */
  digits?: number;
  messages?: Partial<BurnChartMessages>;
  /** Accessible name of the chart (else `messages.label`). */
  ariaLabel?: string;
  className?: string;
};

const TONE_COLOR: Record<BurnTone | 'success', string> = {
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  success: 'var(--success)',
};

const PAD = { top: 14, right: 16, bottom: 28, left: 10 };
const GAP = 30;

export function BurnChart({
  budget,
  burnRate,
  tiers = DEFAULT_BURN_TIERS,
  projection = true,
  annotations = [],
  windowEnd,
  height = 200,
  locale,
  timeZone,
  digits = 1,
  messages,
  ariaLabel,
  className,
}: BurnChartProps) {
  const msg = useMemo(() => ({ ...DEFAULT_BURN_CHART_MESSAGES, ...messages, budgetState: { ...DEFAULT_BURN_CHART_MESSAGES.budgetState, ...messages?.budgetState } }), [messages]);
  const uid = useId();
  const budgetPts = useMemo(() => normalizePoints(budget), [budget]);
  const burnPts = useMemo(() => normalizePoints(burnRate), [burnRate]);
  const sortedTiers = useMemo(() => sortTiers(tiers), [tiers]);
  const endMs = windowEnd === undefined ? null : toTime(windowEnd);
  const proj = useMemo(
    () => (projection === false || budgetPts.length < 2 ? null : projectBudget(budgetPts, { lookbackMs: typeof projection === 'object' ? projection.lookbackMs : undefined, until: endMs ?? undefined })),
    [projection, budgetPts, endMs],
  );
  const notes = useMemo(() => annotations.map((a) => ({ ...a, ms: toTime(a.t) })).filter((a): a is typeof a & { ms: number } => a.ms !== null), [annotations]);

  // Shared time domain: all data, the projection's end, the window end, the annotations.
  const domain = useMemo<[number, number] | null>(() => {
    const ts = [...budgetPts, ...burnPts].map((p) => p.t);
    if (proj) ts.push(...proj.line.map((p) => p.t));
    if (endMs !== null) ts.push(endMs);
    ts.push(...notes.map((n) => n.ms));
    if (!ts.length) return null;
    const lo = Math.min(...ts);
    const hi = Math.max(...ts);
    return lo === hi ? [lo - 3_600_000, hi + 3_600_000] : [lo, hi];
  }, [budgetPts, burnPts, proj, endMs, notes]);

  const [cursor, setCursor] = useState<number | null>(null); // a time in ms
  const base = budgetPts.length ? budgetPts : burnPts;

  const latestBudget = budgetPts.length ? budgetPts[budgetPts.length - 1].v : null;
  const latestRate = burnPts.length ? burnPts[burnPts.length - 1].v : null;
  const tier = latestRate !== null ? activeTier(latestRate, sortedTiers) : null;
  const pct = (v: number) => `${Number(v.toFixed(digits))}%`;
  const rateText = (v: number) => `${Number(v.toFixed(digits))}×`;
  const dateAt = (ms: number) => (domain ? formatFull(ms, domain[1] - domain[0], locale, timeZone) : String(ms));

  const summary = [
    latestBudget !== null ? fillMessage(msg.summaryBudget, { value: pct(latestBudget), state: msg.budgetState[budgetState(latestBudget)] }) : null,
    proj ? (proj.spent ? `${msg.spent}.` : proj.exhaustedAt !== null ? `${fillMessage(msg.exhaustedAt, { date: dateAt(proj.exhaustedAt) })}.` : `${msg.onTrack}.`) : null,
    latestRate !== null ? fillMessage(msg.summaryBurn, { value: rateText(latestRate) }) : null,
    latestRate !== null ? (tier ? fillMessage(msg.summaryTier, { tier: `${tier.label} ${rateText(tier.rate)}${tier.window ? ` (${tier.window})` : ''}` }) : (sortedTiers.length ? msg.summaryNoTier : null)) : null,
    notes.length ? fillMessage(msg.summaryAnnotations, { count: notes.length }) : null,
  ].filter(Boolean).join(' ');

  if (!domain || !base.length) {
    return <div className={cn('rounded-md border border-border bg-surface-base p-4 text-sm text-text-secondary', className)}>{msg.noData}</div>;
  }

  const hasBudget = budgetPts.length > 0;
  const hasBurn = burnPts.length > 0;
  const burnH = hasBudget ? Math.round(height * 0.8) : height;
  const totalH = (hasBudget ? height : 0) + (hasBurn ? burnH : 0) + (hasBudget && hasBurn ? GAP : 0) + PAD.top + PAD.bottom;

  // Keyboard: step the cursor along the base series.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = cursor === null ? -1 : nearestPointIndex(base, cursor);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const rtl = isRtlElement(e.currentTarget);
      const forward = (e.key === 'ArrowRight') !== rtl;
      next = Math.min(base.length - 1, Math.max(0, (idx < 0 ? (forward ? -1 : base.length) : idx) + (forward ? 1 : -1)));
    } else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = base.length - 1;
    else if (e.key === 'Escape') { setCursor(null); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    setCursor(base[next].t);
  };

  const cursorIdx = cursor === null ? -1 : nearestPointIndex(base, cursor);
  const cursorT = cursorIdx >= 0 ? base[cursorIdx].t : null;
  const maxGap = base.length > 1 ? (base[base.length - 1].t - base[0].t) / (base.length - 1) * 1.5 : Infinity;

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        tabIndex={0}
        aria-label={ariaLabel ?? msg.label}
        aria-describedby={`${uid}-summary`}
        onKeyDown={onKeyDown}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <ResponsiveContainer height={totalH}>
          {({ width }) => {
            const plotLeft = PAD.left + 8 + Math.max(
              hasBudget ? labelWidth(['100%', '-100%'], chartTheme.fontSize.axis) : 0,
              hasBurn ? labelWidth([`${Math.max(...burnPts.map((p) => p.v), ...sortedTiers.map((t) => t.rate)).toFixed(0)}×`], chartTheme.fontSize.axis) : 0,
            );
            const x0 = plotLeft;
            const w = Math.max(10, width - plotLeft - PAD.right);
            const budgetRect: PlotRect = { x: x0, y: PAD.top, width: w, height };
            const burnRect: PlotRect = { x: x0, y: PAD.top + (hasBudget ? height + GAP : 0), width: w, height: burnH };
            const lastRect = hasBurn ? burnRect : budgetRect;
            const span = domain[1] - domain[0];
            const tx = (t: number) => xTime(t, domain, budgetRect);
            const xTicks: AxisTick[] = timeTicks(domain, Math.max(2, Math.floor(w / 110)), timeZone).map((t) => ({ position: tx(t), label: formatTick(t, span, locale, timeZone) }));

            const bVals = [...budgetPts.map((p) => p.v), ...(proj?.line.map((p) => p.v) ?? []), 0, 100];
            const bMin = Math.min(...bVals);
            const bMax = Math.max(...bVals);
            const bTicks = niceTicks(bMin, bMax, 4);
            const bLo = Math.min(bMin, bTicks[0]);
            const bHi = Math.max(bMax, bTicks[bTicks.length - 1]);
            const by = (v: number) => yScale(v, bLo, bHi, budgetRect);

            const rMax = Math.max(1, ...burnPts.map((p) => p.v), ...(sortedTiers.length ? [sortedTiers[sortedTiers.length - 1].rate * 1.1] : []));
            const rTicks = niceTicks(0, rMax, 4);
            const rHi = Math.max(rMax, rTicks[rTicks.length - 1]);
            const ry = (v: number) => yScale(v, 0, rHi, burnRect);

            const tierLines: ThresholdLine[] = sortedTiers.map((t) => ({
              value: t.rate,
              label: `${t.label} ${Number(t.rate.toFixed(1))}×${t.window ? ` · ${t.window}` : ''}`,
              color: TONE_COLOR[t.tone ?? 'warning'],
              style: 'dashed',
              width: 1.25,
            }));

            const budgetLine = linePath(budgetPts.map((p) => ({ x: tx(p.t), y: by(p.v) })));
            const burnLine = linePath(burnPts.map((p) => ({ x: tx(p.t), y: ry(p.v) })));
            const projLine = proj && proj.line.length > 1 ? linePath(proj.line.map((p) => ({ x: tx(p.t), y: by(p.v) }))) : null;

            const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - r.left;
              if (px < x0 || px > x0 + w) { setCursor(null); return; }
              const t = domain[0] + ((px - x0) / w) * span;
              const i = nearestPointIndex(base, t);
              setCursor(i >= 0 ? base[i].t : null);
            };

            // Tooltip content for the cursor time.
            const tipRows: TooltipDatum[] = [];
            if (cursorT !== null) {
              const bv = valueNear(budgetPts, cursorT, maxGap);
              const rv = valueNear(burnPts, cursorT, maxGap);
              if (bv !== null) tipRows.push({ seriesId: 'budget', seriesName: msg.budget, color: 'var(--primary)', x: cursorT, y: bv, valueLabel: pct(bv) });
              if (rv !== null) tipRows.push({ seriesId: 'burn', seriesName: msg.burnRate, color: 'var(--info)', x: cursorT, y: rv, valueLabel: rateText(rv) });
            }
            const tipY = cursorT !== null ? (hasBudget ? by(valueNear(budgetPts, cursorT, maxGap) ?? bLo) : ry(valueNear(burnPts, cursorT, maxGap) ?? 0)) : 0;

            return (
              <div className="relative">
                <svg width={width} height={totalH} role="img" aria-label={ariaLabel ?? msg.label} onPointerMove={onMove} onPointerLeave={() => setCursor(null)} className="block touch-pan-y">
                  {hasBudget && (
                    <g data-panel="budget">
                      <Grid rect={budgetRect} yTicks={bTicks.map(by)} xTicks={xTicks.map((t) => t.position)} />
                      <YAxis ticks={bTicks.map((v) => ({ position: by(v), label: `${v}%` }))} x={budgetRect.x} yStart={budgetRect.y} yEnd={budgetRect.y + budgetRect.height} />
                      <Thresholds rect={budgetRect} scale={by} lines={[{ value: 0, label: msg.spent, color: 'var(--error)', style: 'solid', width: 1.5 }]} />
                      <path d={`${budgetLine} L${tx(budgetPts[budgetPts.length - 1].t)},${by(0)} L${tx(budgetPts[0].t)},${by(0)} Z`} fill="var(--primary)" fillOpacity={0.1} stroke="none" />
                      <path data-series="budget" d={budgetLine} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
                      {projLine && <path data-series="projection" d={projLine} fill="none" stroke="var(--warning)" strokeWidth={2} strokeDasharray="6 4" />}
                      {proj && proj.exhaustedAt !== null && !proj.spent && (
                        <g data-part="exhaustion" transform={`translate(${tx(proj.exhaustedAt)} ${by(0)})`}>
                          <circle r={5} fill="var(--surface-base)" stroke="var(--warning)" strokeWidth={2} />
                          <text y={-10} textAnchor={tx(proj.exhaustedAt) > x0 + w - 90 ? 'end' : 'middle'} fontSize={chartTheme.fontSize.axis} fontWeight={600} fill="var(--warning-fg, var(--warning))" paintOrder="stroke" stroke="var(--surface-base)" strokeWidth={3}>
                            {fillMessage(msg.exhaustedAt, { date: dateAt(proj.exhaustedAt) })}
                          </text>
                        </g>
                      )}
                    </g>
                  )}
                  {hasBurn && (
                    <g data-panel="burn">
                      <Grid rect={burnRect} yTicks={rTicks.map(ry)} xTicks={xTicks.map((t) => t.position)} />
                      <YAxis ticks={rTicks.map((v) => ({ position: ry(v), label: `${v}×` }))} x={burnRect.x} yStart={burnRect.y} yEnd={burnRect.y + burnRect.height} />
                      {sortedTiers.map((t, i) => {
                        const next = sortedTiers[i + 1];
                        const top = ry(next ? next.rate : rHi);
                        const bottom = ry(t.rate);
                        return top < bottom ? <rect key={t.id} data-part="tier-band" x={burnRect.x} y={top} width={burnRect.width} height={bottom - top} fill={TONE_COLOR[t.tone ?? 'warning']} fillOpacity={0.07} /> : null;
                      })}
                      <Thresholds rect={burnRect} scale={ry} lines={tierLines} />
                      <path data-series="burn" d={burnLine} fill="none" stroke="var(--info)" strokeWidth={2} strokeLinejoin="round" />
                    </g>
                  )}
                  <XAxis ticks={xTicks} y={lastRect.y + lastRect.height} xStart={lastRect.x} xEnd={lastRect.x + lastRect.width} />
                  {endMs !== null && (
                    <g data-part="window-end">
                      <line x1={tx(endMs)} x2={tx(endMs)} y1={PAD.top} y2={lastRect.y + lastRect.height} stroke="var(--border-strong)" strokeWidth={1.5} />
                      <text x={tx(endMs) - 4} y={PAD.top + 10} textAnchor="end" fontSize={chartTheme.fontSize.axis} fill="var(--text-secondary)">{msg.windowEnd}</text>
                    </g>
                  )}
                  {notes.map((n) => {
                    const x = tx(n.ms);
                    const color = TONE_COLOR[n.tone ?? 'info'];
                    return (
                      <g key={n.id} data-annotation={n.id} tabIndex={0} role="img" aria-label={`${n.label}, ${dateAt(n.ms)}`} className="outline-none [&:focus-visible>path]:stroke-[var(--border-focus)] [&:focus-visible>path]:stroke-[2.5]">
                        <title>{`${n.label} · ${dateAt(n.ms)}`}</title>
                        <line x1={x} x2={x} y1={PAD.top} y2={lastRect.y + lastRect.height} stroke={color} strokeWidth={1} strokeDasharray="2 3" />
                        <path d={`M${x - 6},${PAD.top - 12} L${x + 6},${PAD.top - 12} L${x},${PAD.top - 2} Z`} fill={color} stroke="var(--surface-base)" strokeWidth={1} />
                      </g>
                    );
                  })}
                  {cursorT !== null && (
                    <g aria-hidden="true" data-part="cursor">
                      <line x1={tx(cursorT)} x2={tx(cursorT)} y1={PAD.top} y2={lastRect.y + lastRect.height} stroke={chartTheme.crosshair} strokeWidth={1} />
                    </g>
                  )}
                </svg>
                {cursorT !== null && tipRows.length > 0 && (
                  <ChartTooltip label={dateAt(cursorT)} data={tipRows} x={tx(cursorT)} y={tipY} containerWidth={width} visible />
                )}
              </div>
            );
          }}
        </ResponsiveContainer>
      </div>

      <figcaption className="flex flex-col gap-1.5">
        <p id={`${uid}-summary`} data-part="summary" className="text-sm text-text-secondary">{summary}</p>
        <ul aria-label={msg.tiers} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
          {hasBudget && <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-primary" />} text={msg.budget} />}
          {proj && <LegendItem swatch={<span className="inline-block h-0 w-5 border-t-2 border-dashed border-warning" />} text={msg.projection} />}
          {hasBurn && <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-info" />} text={msg.burnRate} />}
          {hasBurn && sortedTiers.slice().reverse().map((t) => (
            <LegendItem key={t.id} swatch={<span className="inline-block h-0 w-5 border-t border-dashed" style={{ borderColor: TONE_COLOR[t.tone ?? 'warning'] }} />} text={`${t.label} ${Number(t.rate.toFixed(1))}×${t.window ? ` (${t.window})` : ''}`} />
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function LegendItem({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <li className="flex items-center gap-1.5"><span aria-hidden="true">{swatch}</span>{text}</li>;
}

