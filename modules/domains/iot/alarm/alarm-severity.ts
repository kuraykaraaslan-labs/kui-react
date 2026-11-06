import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCircleExclamation,
  faCircleInfo,
  faExclamation,
  faFire,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { ALARM_SEVERITIES, type AlarmSeverity, type AlarmStatus } from '../types/alarm';

/*
 * The one mapping table of the alarm severities (docs/concepts/iot-platform/phases/03-alarms.md, D2 and OD-9): badge tone,
 * icon, default label and sort order. Nothing else hard-codes a severity; change a tone here and every badge, chip, filter
 * and table follows.
 *
 * Tones (OD-9 proposal, adjusted for contrast): CRITICAL solid error; MAJOR subtle error with an error ring; MINOR subtle
 * warning with a warning ring; WARNING subtle warning; INFO subtle info. A solid amber badge has no text token that reads
 * in both themes (white on the light amber is about 2:1), so MINOR is told apart by its ring and icon instead. Each level has its own
 * icon, so the five are distinguishable without colour.
 */

export type AlarmSeverityMeta = {
  /** Default English label (a host passes translated labels through `labels`). */
  label: string;
  icon: IconDefinition;
  /** Classes of the badge (token utilities only). */
  badgeClass: string;
  /** Classes of a small dot or bar (chips). */
  accentClass: string;
  /**
   * Classes of a count badge with digits on it (the bell): text that reads in both themes. White on the solid amber or cyan is about
   * 2:1, so MINOR, WARNING and INFO put their dark (light theme) or pale (dark theme) `-fg` text on the subtle fill with a solid edge
   * (NB 41-ui-fixes/24 1.15).
   */
  countClass: string;
  /** Left border of a table row (literal classes, so the stylesheet keeps them). */
  rowBorderClass: string;
  /** 0 = most severe. */
  rank: number;
};

export const ALARM_SEVERITY_META: Record<AlarmSeverity, AlarmSeverityMeta> = {
  CRITICAL: { label: 'Critical', icon: faFire,                badgeClass: 'bg-error text-text-inverse',                                   accentClass: 'bg-error',   countClass: 'bg-error text-text-inverse',                        rowBorderClass: 'border-l-error',   rank: 0 },
  MAJOR:    { label: 'Major',    icon: faCircleExclamation,   badgeClass: 'bg-error-subtle text-error-fg ring-1 ring-inset ring-error',   accentClass: 'bg-error',   countClass: 'bg-error text-text-inverse',                        rowBorderClass: 'border-l-error',   rank: 1 },
  MINOR:    { label: 'Minor',    icon: faTriangleExclamation, badgeClass: 'bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning', accentClass: 'bg-warning', countClass: 'border border-warning bg-warning-subtle text-warning-fg', rowBorderClass: 'border-l-warning', rank: 2 },
  WARNING:  { label: 'Warning',  icon: faExclamation,         badgeClass: 'bg-warning-subtle text-warning-fg',                            accentClass: 'bg-warning', countClass: 'border border-warning bg-warning-subtle text-warning-fg', rowBorderClass: 'border-l-warning', rank: 3 },
  INFO:     { label: 'Info',     icon: faCircleInfo,          badgeClass: 'bg-info-subtle text-info-fg',                                  accentClass: 'bg-info',    countClass: 'border border-info bg-info-subtle text-info-fg',          rowBorderClass: 'border-l-info',    rank: 4 },
};

/**
 * The count badge's classes when no severity is known for the alarms it counts (the counts carry no `openBySeverity` and none of the
 * listed alarms is OPEN): neutral, never a severity's colour it cannot vouch for (NB 41-ui-fixes/24 1.15).
 */
export const NEUTRAL_COUNT_CLASS = 'border border-border bg-surface-sunken text-text-primary';

/** The count badge's classes for the worst severity, neutral when it is not known. */
export function countClassOf(worst: AlarmSeverity | null): string {
  return worst ? ALARM_SEVERITY_META[worst].countClass : NEUTRAL_COUNT_CLASS;
}

/** The five levels, most severe first (the filter chips' and the sort's order). */
export const SEVERITY_ORDER: readonly AlarmSeverity[] = ALARM_SEVERITIES;

export function isAlarmSeverity(v: unknown): v is AlarmSeverity {
  return typeof v === 'string' && (ALARM_SEVERITIES as readonly string[]).includes(v);
}

/** Sort comparator: most severe first. */
export function compareSeverity(a: AlarmSeverity, b: AlarmSeverity): number {
  return ALARM_SEVERITY_META[a].rank - ALARM_SEVERITY_META[b].rank;
}

/** The most severe of a list (the map widget's "worst open alarm"), or null for none. */
export function worstSeverity(list: readonly AlarmSeverity[]): AlarmSeverity | null {
  let worst: AlarmSeverity | null = null;
  for (const s of list) if (worst === null || compareSeverity(s, worst) < 0) worst = s;
  return worst;
}

export type AlarmStatusMeta = { label: string; badgeClass: string };

export const ALARM_STATUS_META: Record<AlarmStatus, AlarmStatusMeta> = {
  OPEN:         { label: 'Open',         badgeClass: 'bg-error-subtle text-error-fg' },
  ACKNOWLEDGED: { label: 'Acknowledged', badgeClass: 'bg-warning-subtle text-warning-fg' },
  RESOLVED:     { label: 'Resolved',     badgeClass: 'bg-success-subtle text-success-fg' },
};
