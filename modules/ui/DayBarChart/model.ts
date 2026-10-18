// modules/ui/DayBarChart/model.ts
//
// Pure helpers of the day-bar (uptime) chart: classifying a day by availability and summarising a range.

export type DayStatus = 'operational' | 'degraded' | 'outage' | 'nodata';

export type DayIncidentSeverity = 'minor' | 'major' | 'critical' | 'maintenance';

export type DayIncident = {
  id: string;
  title: string;
  severity?: DayIncidentSeverity;
  /** Where the incident opens. */
  href?: string;
};

export type DayBar = {
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Availability in percent (0..100); `null` = no data for the day. */
  availability: number | null;
  incidents?: DayIncident[];
};

export type DayThresholds = {
  /** At or above this the day is operational. Default = 99.9. */
  operational: number;
  /** At or above this (and below `operational`) the day is degraded; below it is an outage. Default = 99. */
  degraded: number;
};

export const DEFAULT_DAY_THRESHOLDS: DayThresholds = { operational: 99.9, degraded: 99 };

export function dayStatus(availability: number | null | undefined, t: DayThresholds = DEFAULT_DAY_THRESHOLDS): DayStatus {
  if (availability === null || availability === undefined || !Number.isFinite(availability)) return 'nodata';
  if (availability >= t.operational) return 'operational';
  if (availability >= t.degraded) return 'degraded';
  return 'outage';
}

/** Mean availability over the days that have data, in percent; `null` when none has. */
export function meanAvailability(days: readonly DayBar[]): number | null {
  let sum = 0;
  let n = 0;
  for (const d of days) {
    if (d.availability === null || !Number.isFinite(d.availability)) continue;
    sum += d.availability;
    n++;
  }
  return n ? sum / n : null;
}

/** Counts per status. */
export function statusCounts(days: readonly DayBar[], t: DayThresholds = DEFAULT_DAY_THRESHOLDS): Record<DayStatus, number> {
  const out: Record<DayStatus, number> = { operational: 0, degraded: 0, outage: 0, nodata: 0 };
  for (const d of days) out[dayStatus(d.availability, t)]++;
  return out;
}

/** A `YYYY-MM-DD` day as epoch ms at UTC midnight (NaN when malformed). */
export function dayToUtcMs(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
}

/** Build `count` consecutive days ending at `endDate` (inclusive), filling gaps in `data` with no-data days. */
export function fillDays(data: readonly DayBar[], endDate: string, count = 90): DayBar[] {
  const end = dayToUtcMs(endDate);
  if (Number.isNaN(end)) return [...data];
  const byDate = new Map(data.map((d) => [d.date, d]));
  const out: DayBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? { date, availability: null });
  }
  return out;
}
