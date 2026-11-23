'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleExclamation, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import type { VitalRating } from '../types';

/**
 * The status palette of the Web Vitals ratings: the marks (bar parts, icons) wear the status colour, the words wear
 * the status text tones. Every rating also has its own icon shape, so none is read from colour alone.
 */
export const VITAL_RATING_STYLE: Record<VitalRating, { icon: typeof faCircleCheck; mark: string; text: string; pill: string }> = {
  good: { icon: faCircleCheck, mark: 'var(--success)', text: 'text-success', pill: 'bg-success-subtle text-success-fg' },
  'needs-improvement': { icon: faCircleExclamation, mark: 'var(--warning)', text: 'text-warning', pill: 'bg-warning-subtle text-warning-fg' },
  poor: { icon: faTriangleExclamation, mark: 'var(--error)', text: 'text-error', pill: 'bg-error-subtle text-error-fg' },
};

export const VITAL_RATINGS: readonly VitalRating[] = ['good', 'needs-improvement', 'poor'];

export type VitalRatingLabels = Record<VitalRating, string>;

/** A rating's icon in its status colour (decorative; the label goes beside it or in `label`). */
export function VitalRatingIcon({ rating, label, className }: { rating: VitalRating; label?: string; className?: string }) {
  const s = VITAL_RATING_STYLE[rating];
  return (
    <FontAwesomeIcon
      icon={s.icon}
      className={cn('h-3.5 w-3.5 shrink-0', s.text, className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      title={label}
      role={label ? 'img' : undefined}
    />
  );
}

/** InsightsVitalRating — a rating as a pill: status icon + words. */
export function InsightsVitalRating({ rating, label, className }: { rating: VitalRating; label: string; className?: string }) {
  const s = VITAL_RATING_STYLE[rating];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', s.pill, className)}>
      <FontAwesomeIcon icon={s.icon} className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export type VitalShares = { good: number; needsImprovement: number; poor: number };

const SHARE_KEY: Record<VitalRating, keyof VitalShares> = { good: 'good', 'needs-improvement': 'needsImprovement', poor: 'poor' };

/**
 * VitalsDistributionBar — the share of page loads per rating as one thin segmented bar (status colours, a 2 px
 * surface gap between parts, a part at zero draws nothing), with each share printed under it beside its rating icon.
 * The bar's accessible name and each part's tooltip give every rating with its share.
 */
export function VitalsDistributionBar({
  shares, labels, formatShare, className,
}: { shares: VitalShares; labels: VitalRatingLabels; formatShare: (fraction: number) => string; className?: string }) {
  const total = VITAL_RATINGS.reduce((s, r) => s + Math.max(0, shares[SHARE_KEY[r]] || 0), 0);
  const parts = VITAL_RATINGS.map((r) => ({ rating: r, value: total > 0 ? Math.max(0, shares[SHARE_KEY[r]] || 0) / total : 0 }));
  const name = parts.map((p) => `${labels[p.rating]} ${formatShare(p.value)}`).join(', ');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div role="img" aria-label={name} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span
            key={p.rating}
            title={`${labels[p.rating]}: ${formatShare(p.value)}`}
            className="h-full min-w-[2px]"
            style={{ flexGrow: p.value, flexBasis: 0, background: VITAL_RATING_STYLE[p.rating].mark }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-text-secondary" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.rating} className="inline-flex items-center gap-1" title={labels[p.rating]}>
            <VitalRatingIcon rating={p.rating} className="h-3 w-3" />
            {formatShare(p.value)}
          </li>
        ))}
      </ul>
    </div>
  );
}

type InsightsVitalTileProps = {
  /** The metric's abbreviation ("LCP"). */
  abbr: string;
  /** Its full name ("Largest Contentful Paint"). */
  name: string;
  /** The formatted 75th percentile; absent = not enough data. */
  value?: string;
  rating?: VitalRating | null;
  /** The share of page loads per rating. */
  shares?: VitalShares;
  labels: VitalRatingLabels;
  formatShare: (fraction: number) => string;
  /** Under the value: what it is ("75th percentile"). */
  caption?: string;
  /** Marks one of the three Core Web Vitals ("Core Web Vital"). */
  coreLabel?: string;
  /** Said instead of the value when there is none. */
  notEnoughData?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

/**
 * InsightsVitalTile — one Web Vital of real users: its 75th percentile, the rating (status icon + words) and the
 * distribution of page loads across good, needs improvement and poor.
 */
export function InsightsVitalTile({
  abbr, name, value, rating, shares, labels, formatShare, caption, coreLabel, notEnoughData = 'Not enough data', className, ...rest
}: InsightsVitalTileProps) {
  const has = value !== undefined && value !== '';
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface-raised px-4 py-3', className)} {...rest}>
      <div className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <abbr title={name} className="font-semibold text-text-primary no-underline">{abbr}</abbr>
          {coreLabel && <span className="rounded bg-surface-sunken px-1.5 py-px text-[0.6875rem] text-text-secondary">{coreLabel}</span>}
        </span>
        <span className="truncate text-xs text-text-secondary">{name}</span>
      </div>
      {has ? (
        <>
          <div className="flex flex-col items-start gap-1.5">
            <span className="flex flex-col">
              <span className="text-2xl font-bold tabular-nums text-text-primary">{value}</span>
              {caption && <span className="text-xs text-text-secondary">{caption}</span>}
            </span>
            {rating && <InsightsVitalRating rating={rating} label={labels[rating]} />}
          </div>
          {shares && <VitalsDistributionBar shares={shares} labels={labels} formatShare={formatShare} />}
        </>
      ) : (
        <span className="py-2 text-sm text-text-secondary">{notEnoughData}</span>
      )}
    </div>
  );
}
