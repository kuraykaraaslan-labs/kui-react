'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { cssColor, fontStyle } from '../settings/style';
import type { Sparse } from '../settings/types';
import { useNow } from '../useNow';
import { useKitMessages } from '../WidgetKitContext';
import { DEFAULT_WIDGET_KIT_MESSAGES, type StatViewMessages } from '../messages';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { IconTile, Meta, MetricHead, MetricLabel, Pill, tint } from './ui';

type Rule = { match?: string; gte?: number | null; lte?: number | null; label?: string; color?: string; background?: string; icon?: string; pulse?: boolean };

type S = {
  layout?: 'big' | 'badge' | 'dot' | 'tile' | 'icon';
  alignment?: 'start' | 'center';
  label?: string;
  labelFont?: FontValue;
  labelColor?: string;
  iconSize?: number;
  states?: unknown;
  fallbackLabel?: string;
  fallbackColor?: string;
  fallbackBackground?: string;
  fallbackIcon?: string;
  stateFont?: FontValue;
  showValue?: boolean;
  valueFont?: FontValue;
  valueColor?: string;
  showSince?: boolean;
  staleAsUnknown?: boolean;
  unknownLabel?: string;
};

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

function ruleMatches(rule: Rule, value: unknown): boolean {
  if (!isBlank(rule.match)) {
    const a = asNumber(rule.match);
    const b = asNumber(value);
    if (a !== null && b !== null) return a === b;
    return String(rule.match).toLowerCase() === String(value).toLowerCase();
  }
  if (isBlank(rule.gte) && isBlank(rule.lte)) return false;
  const n = asNumber(value);
  if (n === null) return false;
  if (typeof rule.gte === 'number' && n < rule.gte) return false;
  if (typeof rule.lte === 'number' && n > rule.lte) return false;
  return true;
}

export interface StateOutcome {
  label: string;
  color: string;
  background?: string;
  icon?: string;
  pulse?: boolean;
  matched: boolean;
  unknown: boolean;
}

/**
 * First matching rule wins, otherwise the fallback. A missing value (or, when asked, a stale one)
 * is "unknown" in a neutral colour, never the fallback's. Its label is the `unknownLabel` setting, unless
 * that is empty or still the template's English default: then `unknownText` (the host's word for it).
 */
export function evaluateState(value: unknown, settings: Sparse, stale = false, unknownText = 'Unknown'): StateOutcome {
  const s = settings as S;
  const neutral = 'var(--text-secondary)';
  if (isBlank(value) || (stale && s.staleAsUnknown !== false)) {
    return { label: s.unknownLabel && s.unknownLabel !== 'Unknown' ? s.unknownLabel : unknownText, color: neutral, matched: false, unknown: true };
  }
  const rules = (Array.isArray(s.states) ? (s.states as Rule[]) : []).filter((r) => r && typeof r === 'object');
  const hit = rules.find((r) => ruleMatches(r, value));
  if (hit) {
    return {
      label: hit.label || String(value),
      color: cssColor(hit.color) ?? neutral,
      background: cssColor(hit.background),
      icon: hit.icon || undefined,
      ...(hit.pulse ? { pulse: true } : {}),
      matched: true,
      unknown: false,
    };
  }
  return {
    label: s.fallbackLabel || String(value),
    color: cssColor(s.fallbackColor) ?? neutral,
    background: cssColor(s.fallbackBackground),
    icon: s.fallbackIcon || undefined,
    matched: false,
    unknown: false,
  };
}

/** "for 12 min", "for 3 h", "for 2 d"; `texts` words them. */
export function forText(
  ms: number,
  texts: Pick<StatViewMessages, 'justNow' | 'forMinutes' | 'forHours' | 'forDays'> = DEFAULT_WIDGET_KIT_MESSAGES.stat,
): string {
  if (!Number.isFinite(ms) || ms < 60_000) return texts.justNow;
  const min = Math.round(ms / 60_000);
  if (min < 60) return texts.forMinutes(min);
  const h = Math.round(min / 60);
  if (h < 48) return texts.forHours(h);
  return texts.forDays(Math.round(h / 24));
}

/**
 * `state`: the value mapped to a labelled, coloured state, in the single-value family's order
 * (label top-left, the state's icon top-right, the state where Stat's number sits, meta under it).
 * "Since" is the time this view first saw the state (seeded with the data's fetch time).
 */
export function StateView({ settings, data, stale }: WidgetViewProps) {
  const s = settings as S;
  const raw = data.value?.value;
  const m = useKitMessages().stat;
  const out = evaluateState(raw, settings, stale, m.unknown);
  const layout = s.layout ?? 'big';
  const center = (s.alignment ?? 'start') === 'center' || layout === 'icon';
  const iconSize = s.iconSize ?? 18;
  const bg = out.background ?? tint(out.color, 14);
  const pulse = !!out.pulse && !out.unknown;
  const now = useNow(30_000);
  const fetched = data.value?.fetchedAt ? Date.parse(data.value.fetchedAt) : NaN;
  const [seen, setSeen] = useState(() => ({ key: out.label, at: Number.isFinite(fetched) ? fetched : now }));
  if (seen.key !== out.label) setSeen({ key: out.label, at: now });

  const staleNote = stale ? <span className="sr-only"> {m.stale}</span> : null;
  const stateStyle = { ...fontStyle(s.stateFont), color: out.color };
  const metaParts: ReactNode[] = [];
  if (s.showSince && !out.unknown) metaParts.push(<span key="since" data-part="since">{forText(now - seen.at, m)}</span>);
  if (s.showValue && !isBlank(raw) && !out.unknown) {
    metaParts.push(<span key="value" className="tabular-nums" style={fontStyle(s.valueFont, s.valueColor)} data-part="value">{String(raw)}</span>);
  }
  const meta = metaParts.length ? (
    <Meta className={cn('flex items-center gap-1.5', center && 'justify-center')}>
      {metaParts.flatMap((p, i) => (i ? [<span key={`d${i}`} aria-hidden="true">·</span>, p] : [p]))}
    </Meta>
  ) : null;
  const label = s.label ? <MetricLabel font={s.labelFont} color={s.labelColor}>{s.label}</MetricLabel> : null;
  const tile = (size: number) => out.icon ? (
    <span className={cn('inline-flex', pulse && 'motion-safe:animate-pulse')} data-part="icon">
      <IconTile name={out.icon} size={size} color={out.color} background={out.background} />
    </span>
  ) : null;
  const pulseCls = pulse ? 'motion-safe:animate-pulse' : undefined;

  let main: ReactNode;
  let headIcon: ReactNode = null;
  if (layout === 'badge') {
    main = (
      <span className={cn('inline-flex', pulseCls)} data-part="badge" style={fontStyle(s.stateFont)}>
        <Pill label={<>{out.label}{staleNote}</>} color={out.color} background={out.background} icon={out.icon} size="lg" />
      </span>
    );
  } else if (layout === 'dot') {
    main = (
      <span className="inline-flex items-center gap-2.5 text-lg font-semibold leading-none text-text-primary" data-part="label" style={fontStyle(s.stateFont)}>
        <span className="relative inline-flex h-3 w-3 shrink-0" aria-hidden="true">
          {pulse && <span className="absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping" style={{ background: out.color }} />}
          <span className="relative h-3 w-3 rounded-full" style={{ background: out.color }} data-part="dot" />
        </span>
        {out.label}{staleNote}
      </span>
    );
  } else if (layout === 'icon') {
    const size = Math.round(iconSize * 2.6);
    main = (
      <>
        {tile(size) ?? <span className={cn('rounded-full', pulseCls)} style={{ width: size / 2, height: size / 2, background: out.color }} data-part="icon" aria-hidden="true" />}
        <span className="text-base font-semibold leading-tight" style={stateStyle} data-part="label">{out.label}{staleNote}</span>
      </>
    );
  } else {
    // big and tile: the state word in the metric's place, its icon top-right.
    headIcon = tile(Math.round(iconSize * 1.8));
    main = (
      <span className="block truncate font-semibold leading-none tracking-tight"
        style={{ fontSize: 'clamp(1.25rem, min(11cqi, 30cqb), 2.25rem)', ...stateStyle }} data-part="label">
        {out.label}{staleNote}
      </span>
    );
  }

  const surface = layout === 'tile' ? { background: bg } : undefined;
  return (
    <div
      className={cn('flex h-full min-h-0 flex-col gap-2', layout === 'tile' && 'rounded-lg p-2.5', layout === 'tile' && pulseCls)}
      style={surface}
      role="status"
      aria-live="polite"
      data-layout={layout}
    >
      {layout === 'tile' && !label && !center ? (
        // A tile without a label is one line: the state and its meta left, the icon right.
        <div className="mt-auto flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">{main}{meta}</div>
          {headIcon}
        </div>
      ) : center ? (
        <>
          {label && <div className="text-center">{label}</div>}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">{headIcon}{main}{meta}</div>
        </>
      ) : (
        <>
          <MetricHead label={label} icon={headIcon} />
          <div className="mt-auto flex min-w-0 flex-col items-start gap-1.5">{main}{meta}</div>
        </>
      )}
    </div>
  );
}

export const STATE_VIEW: WidgetKindView = {
  View: StateView,
  // A bound slot answering null is "unknown", a state of its own; only a missing answer is empty.
  isEmpty: (data) => !data.value || data.value.value === undefined,
  emptyShape: true,
};
