'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { cssColor, fontStyle } from '../settings/style';
import { useNow } from '../useNow';
import { useKitMessages } from '../WidgetKitContext';
import type { WidgetKindView, WidgetViewProps } from '../kind';
import { captionOf } from './caption';
import { IconTile, Meta, MetricHead, MetricLabel, Pill, tint } from './ui';
import { forText, stateModel, type StateSettings as S } from './state-logic';

export * from './state-logic';

/**
 * `state`: the value mapped to a labelled, coloured state, in the single-value family's order
 * (label top-left, the state's icon top-right, the state where Stat's number sits, meta under it).
 * "Since" is the time this view first saw the state (seeded with the data's fetch time).
 */
export function StateView({ settings, data, stale, title, titleShown, locale }: WidgetViewProps) {
  const s = settings as S;
  const m = useKitMessages().stat;
  const { out, layout, center, iconSize, bg, pulse, fetched, showSince, showValue, valueText } = stateModel(s, data, !!stale, m.unknown, { on: m.on, off: m.off }, locale);
  const now = useNow(30_000);
  const [seen, setSeen] = useState(() => ({ key: out.label, at: Number.isFinite(fetched) ? fetched : now }));
  if (seen.key !== out.label) setSeen({ key: out.label, at: now });

  const staleNote = stale ? <span className="sr-only"> {m.stale}</span> : null;
  const stateStyle = { ...fontStyle(s.stateFont), color: out.color };
  const metaParts: ReactNode[] = [];
  if (showSince) metaParts.push(<span key="since" data-part="since">{forText(now - seen.at, m)}</span>);
  if (showValue) {
    metaParts.push(<span key="value" className="tabular-nums" style={fontStyle(s.valueFont, s.valueColor)} data-part="value">{valueText}</span>);
  }
  const meta = metaParts.length ? (
    <Meta className={cn('flex items-center gap-1.5', center && 'justify-center')}>
      {metaParts.flatMap((p, i) => (i ? [<span key={`d${i}`} aria-hidden="true">·</span>, p] : [p]))}
    </Meta>
  ) : null;
  const caption = captionOf(s.label, { title, titleShown });
  const label = caption ? <MetricLabel font={s.labelFont} color={s.labelColor}>{caption}</MetricLabel> : null;
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
  } else if (layout === 'lamp') {
    const size = Math.min(200, Math.max(16, s.lampSize ?? 56));
    const lit = !out.unknown && out.lit !== false;
    const dim = cssColor(s.lampDim) ?? 'var(--border)';
    main = (
      <>
        <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} data-part="lamp" data-lit={lit ? 'true' : 'false'} aria-hidden="true">
          {lit && pulse && <span className="absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping" style={{ background: out.color }} />}
          <span className="relative h-full w-full rounded-full"
            style={{ background: lit ? out.color : dim, boxShadow: lit ? `0 0 ${Math.round(size / 3)}px ${Math.round(size / 12)}px ${tint(out.color, 45)}` : 'inset 0 0 0 1px var(--border)' }} />
        </span>
        {s.lampLabel !== false
          ? <span className="text-base font-semibold leading-tight" style={stateStyle} data-part="label">{out.label}{staleNote}</span>
          : <span className="sr-only" data-part="label">{out.label}{staleNote}</span>}
      </>
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
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center-safe gap-2 text-center">{headIcon}{main}{meta}</div>
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
  fit: true,
  // A bound slot answering null is "unknown", a state of its own; only a missing answer is empty.
  isEmpty: (data) => !data.value || data.value.value === undefined,
  emptyShape: true,
};
