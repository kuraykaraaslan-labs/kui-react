'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faMinus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';

type Delta = { change: number; good: boolean | null } | null;

type InsightsKpiTileProps = {
  label: string;
  /** The formatted value. */
  value: string;
  /** From `insightsDelta`; null = nothing to compare with. */
  delta?: Delta;
  /** The formatted change (e.g. "+12.5%"). */
  deltaText?: string;
  /** Under the change: "vs previous period", or why there is none. */
  caption?: string;
  /** For a metric where a smaller number is better (average position): said beside the change. */
  hint?: string;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>;

/**
 * InsightsKpiTile — one headline number with its change against the previous period. The change carries an arrow
 * (direction) and a colour (good or bad, which `lowerIsBetter` metrics flip), so neither is read from colour alone.
 */
export function InsightsKpiTile({ label, value, delta, deltaText, caption, hint, className, ...rest }: InsightsKpiTileProps) {
  const tone = !delta || delta.good === null ? 'text-text-secondary' : delta.good ? 'text-success-fg' : 'text-error-fg';
  const icon = !delta || delta.change === 0 ? faMinus : delta.change > 0 ? faArrowUp : faArrowDown;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface-raised px-4 py-3', className)} {...rest}>
      <span className="truncate text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-2xl font-bold tabular-nums text-text-primary">{value}</span>
      {delta && deltaText ? (
        <span className={cn('flex flex-wrap items-center gap-1 text-xs font-medium tabular-nums', tone)}>
          <FontAwesomeIcon icon={icon} className="h-3 w-3" aria-hidden="true" />
          <span>{deltaText}</span>
          {caption && <span className="font-normal text-text-secondary">{caption}</span>}
          {hint && <span className="font-normal text-text-secondary">({hint})</span>}
        </span>
      ) : (
        caption && <span className="text-xs text-text-secondary">{caption}</span>
      )}
    </div>
  );
}
