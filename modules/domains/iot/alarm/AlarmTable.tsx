'use client';
import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, formatRelative } from '../format';
import { ALARM_SEVERITIES, type AlarmSeverity, type AlarmStatus } from '../types/alarm';
import type { IotMessagesInput } from '../messages';
import { ALARM_SEVERITY_META, compareSeverity } from './alarm-severity';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { AlarmStatusPill } from './AlarmStatusPill';

/**
 * AlarmTable — the body of a dashboard's alarm table (`iot.alarm-table`, phase 07 §7.1; NB `iot.alarm_table`): the rows a host
 * delivers (no fetching here), most severe first, status pills, relative times, and a row click (keyboard too) the host turns into
 * an action. With `activeOnly`, a row that becomes RESOLVED fades for `fadeOutMs` (default 5 s) and then leaves. An optional
 * `rowAction` (e.g. Acknowledge) renders a button per row.
 *
 * A full list on the DataTable's own toolbar, in the browser (the rows are the host's): search (title, type, device), the Filters
 * panel (the five OD-9 severities, starting from `severityFilter`, and the status), sortable columns, rows per page (`maxRows`
 * rows a page) and paging. `showSeverityChips={false}` keeps the severities to `severityFilter`, with no severity filter.
 */
export type AlarmTableRow = {
  id: string;
  alarmId?: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  type?: string;
  title: string;
  /** The device's (or asset's) name. */
  originator?: string | null;
  deviceId?: string | null;
  openedAt?: string | number | Date | null;
  acknowledgedAt?: string | number | Date | null;
  resolvedAt?: string | number | Date | null;
  occurrences?: number;
  flapping?: boolean;
  [extra: string]: unknown;
};

export type AlarmTableColumnId = 'severity' | 'status' | 'title' | 'originator' | 'openedAt' | 'occurrences';

export type AlarmTableRowAction = {
  label: string;
  onRun: (row: AlarmTableRow) => Promise<void> | void;
  disabled?: (row: AlarmTableRow) => boolean;
};

export type AlarmTableProps = {
  rows: readonly AlarmTableRow[];
  columns?: readonly AlarmTableColumnId[];
  /** The severities shown at first (all five by default). */
  severityFilter?: readonly AlarmSeverity[];
  /** Show the severity chips so the viewer can narrow the rows. */
  showSeverityChips?: boolean;
  maxRows?: number;
  /** Rows whose status leaves "not resolved" fade out (the board's "active" table). */
  activeOnly?: boolean;
  fadeOutMs?: number;
  onRowClick?: (row: AlarmTableRow) => void;
  rowAction?: AlarmTableRowAction;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

const DEFAULT_COLUMNS: readonly AlarmTableColumnId[] = ['severity', 'title', 'originator', 'status', 'openedAt'];

const time = (v: AlarmTableRow['openedAt']): number => (v ? new Date(v).getTime() : 0);

/** Most severe first, then newest first. */
export function sortAlarmRows(rows: readonly AlarmTableRow[]): AlarmTableRow[] {
  return [...rows].sort((a, b) => compareSeverity(a.severity, b.severity) || time(b.openedAt) - time(a.openedAt));
}

export function AlarmTable({
  rows, columns = DEFAULT_COLUMNS, severityFilter = ALARM_SEVERITIES, showSeverityChips = true, maxRows, activeOnly = true,
  fadeOutMs = 5_000, onRowClick, rowAction, loading = false, error, onRetry, emptyText, locale, now, messages, className,
}: AlarmTableProps) {
  const { m, locale: lang } = useIotText(messages, locale);
  const filterKey = severityFilter.join(',');

  // rows that became RESOLVED while visible: kept, fading, until their timer ends
  const [seenActive, setSeenActive] = useState<ReadonlySet<string>>(() => new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [running, setRunning] = useState<string | null>(null);
  const [seenRows, setSeenRows] = useState<readonly AlarmTableRow[] | null>(null);
  if (activeOnly && seenRows !== rows) {
    setSeenRows(rows);
    const active = new Set(seenActive);
    const nextLeaving = new Set(leaving);
    let changed = false;
    for (const r of rows) {
      if (r.status !== 'RESOLVED') { if (!active.has(r.id)) { active.add(r.id); changed = true; } continue; }
      if (active.has(r.id) && !nextLeaving.has(r.id) && !gone.has(r.id)) { nextLeaving.add(r.id); changed = true; }
    }
    if (changed) { setSeenActive(active); setLeaving(nextLeaving); }
  }

  // the rows fading now leave together once the fade is over (a row that starts fading meanwhile restarts it)
  useEffect(() => {
    if (!leaving.size) return;
    const timer = setTimeout(() => {
      setGone((g) => new Set([...g, ...leaving]));
      setLeaving(new Set());
    }, fadeOutMs);
    return () => clearTimeout(timer);
  }, [leaving, fadeOutMs]);

  const visible = useMemo(() => {
    const fixed = showSeverityChips ? undefined : new Set(severityFilter);
    return sortAlarmRows(rows).filter((r) => !fixed || fixed.has(r.severity))
      .filter((r) => !activeOnly || r.status !== 'RESOLVED' || leaving.has(r.id))
      .filter((r) => !gone.has(r.id) || r.status !== 'RESOLVED');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showSeverityChips, filterKey, activeOnly, leaving, gone]);

  const filterFields = useMemo((): DataTableFilterField<AlarmTableRow>[] => [
    ...(showSeverityChips
      ? [{
          id: 'severity', label: m.alarms.severity, type: 'checkboxes' as const,
          options: ALARM_SEVERITIES.map((s) => ({ value: s, label: m.severity[s] })),
        }]
      : []),
    {
      id: 'status', label: m.alarms.status, type: 'checkboxes' as const,
      options: (['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((s) => ({ value: s, label: m.status[s] })),
    },
  ], [m, showSeverityChips]);
  const pageSize = maxRows && maxRows > 0 ? maxRows : 10;

  async function run(row: AlarmTableRow) {
    if (!rowAction) return;
    setRunning(row.id);
    try { await rowAction.onRun(row); } finally { setRunning(null); }
  }

  const defs: Record<AlarmTableColumnId, Column<AlarmTableRow>> = {
    severity: { key: 'severity', header: m.alarms.severity, sortable: true, searchable: false, sortValue: (r) => ALARM_SEVERITY_META[r.severity].rank, render: (r) => <AlarmSeverityBadge severity={r.severity} size="sm" /> },
    status: { key: 'status', header: m.alarms.status, sortable: true, searchable: false, hideBelow: 'sm', render: (r) => <AlarmStatusPill status={r.status} size="sm" /> },
    title: {
      key: 'title',
      header: m.alarms.alarm,
      sortable: true,
      searchValue: (r) => `${r.title} ${r.type ?? ''}`,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.title}</span>
          {r.flapping && <span className="text-xs text-warning-fg">{m.alarm.flapping}</span>}
        </span>
      ),
    },
    originator: { key: 'originator', header: m.alarms.device, sortable: true, hideBelow: 'md', render: (r) => r.originator ?? '—' },
    openedAt: {
      key: 'openedAt',
      header: m.alarms.opened,
      hideBelow: 'sm',
      sortable: true,
      searchable: false,
      sortValue: (r) => time(r.openedAt),
      render: (r) => (
        <time className="text-xs text-text-secondary" dateTime={r.openedAt ? new Date(r.openedAt).toISOString() : undefined} title={formatDateTime(r.openedAt, { locale: lang })}>
          {formatRelative(r.openedAt, { locale: lang, now })}
        </time>
      ),
    },
    occurrences: {
      key: 'occurrences',
      header: '#',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      searchable: false,
      sortValue: (r) => r.occurrences ?? 1,
      render: (r) => <span className="tabular-nums text-xs">{fill(m.alarmTable.occurrences, { n: r.occurrences ?? 1 })}</span>,
    },
  };
  const cols = columns.map((id) => defs[id]).filter(Boolean);
  if (rowAction) {
    cols.push({
      key: '__action',
      header: <span className="sr-only">{rowAction.label}</span>,
      align: 'right',
      render: (r) => (
        <Button
          variant="outline"
          size="xs"
          loading={running === r.id}
          disabled={running !== null || r.status === 'RESOLVED' || !!rowAction.disabled?.(r)}
          onClick={() => void run(r)}
        >
          {rowAction.label}
        </Button>
      ),
    });
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <DataTable<AlarmTableRow>
        // the host changed the severities to start from: the filter starts again from them
        key={filterKey}
        mode="paginated"
        variant="plain"
        caption={m.alarmTable.caption}
        columns={cols}
        rows={visible}
        rowId={(r) => r.id}
        onRowClick={onRowClick ? (r) => onRowClick(r) : undefined}
        rowState={(r) => (leaving.has(r.id) ? 'leaving' : undefined)}
        rowClassName={(r) => cn('border-l-2', r.status === 'RESOLVED' ? 'border-l-transparent' : ALARM_SEVERITY_META[r.severity].rowBorderClass)}
        state={error ? 'error' : loading && !rows.length ? 'loading' : undefined}
        errorMessage={error || undefined}
        onRetry={onRetry}
        emptyMessage={emptyText ?? m.alarmTable.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        density="compact"
        searchPlaceholder={m.alarmTable.search}
        filterFields={filterFields}
        defaultFilterValues={showSeverityChips && severityFilter.length < ALARM_SEVERITIES.length ? { severity: [...severityFilter] } : undefined}
        pageSize={pageSize}
        pageSizeOptions={LIST_PAGE_SIZES.includes(pageSize) ? LIST_PAGE_SIZES : [...LIST_PAGE_SIZES, pageSize].sort((a, b) => a - b)}
        toolbarEnd={onRetry ? (
          <Button variant="ghost" size="xs" iconOnly aria-label={m.common.retry} onClick={onRetry}>
            <FontAwesomeIcon icon={faArrowsRotate} className="h-3 w-3" aria-hidden="true" />
          </Button>
        ) : undefined}
        keyboardNavigation
      />
    </div>
  );
}
