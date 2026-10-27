'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faCheck, faCheckDouble, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery, DataTableRowId } from '@/modules/ui/Table/types';
import { Modal } from '@/modules/ui/Modal';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Textarea } from '@/modules/ui/Textarea';
import { ALARM_SORT_KEYS, errorMessage, type AlarmListQuery, type AlarmStatusFilter } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, choiceOf, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative } from '../format';
import { ALARM_SEVERITIES, type Alarm, type AlarmCounts } from '../types/alarm';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { AlarmStatusPill } from './AlarmStatusPill';
import { acknowledgeAllOpen } from './acknowledgeAll';

/**
 * AlarmListView — the alarm list (phase 03 §3.2), read through the adapter, on the DataTable's own toolbar: search, the status
 * choice, the Filters panel (the five OD-9 severity levels), sortable columns, rows per page and server paging; status count
 * chips (clickable), selection with bulk acknowledge / clear sharing one note (per-id results: "47 done, 3 skipped"),
 * "Acknowledge all" for every OPEN alarm of the list's scope (same note), and live arrivals: on the first page of the newest-first
 * order a new matching alarm appears at the top, highlighted; elsewhere (another page, a search, another order) a "N new alarms"
 * pill brings the viewer back. Without a live source it re-reads every 30 s. A
 * resolved or all-status list always asks for a bounded range (last 7 days, OD-31). With `deviceId` it is a device's
 * Alarms tab.
 */
export type AlarmListViewProps = {
  hrefs: { alarm: (alarmId: string) => string; device?: (deviceId: string) => string };
  /** Initial filters (e.g. from the URL). */
  initialQuery?: Partial<Omit<AlarmListQuery, 'deviceId'>>;
  /** Called with every filter or page change (to keep them in the URL). */
  onQueryChange?: (query: AlarmListQuery) => void;
  deviceId?: string;
  pageSize?: number;
  /** Hide the page title (inside a tab). */
  embedded?: boolean;
  now?: number;
  className?: string;
};

const WEEK_MS = 7 * 86_400_000;
const STATUS_FILTERS: readonly AlarmStatusFilter[] = ['active', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'any'];
const NEW_HIGHLIGHT_MS = 4_000;

function bounded(q: AlarmListQuery): AlarmListQuery {
  if ((q.status === 'any' || q.status === 'RESOLVED') && !q.from) return { ...q, from: new Date(Date.now() - WEEK_MS).toISOString() };
  return q;
}

function matches(a: Alarm, q: AlarmListQuery): boolean {
  const status = q.status ?? 'active';
  if (status === 'active' && a.status === 'RESOLVED') return false;
  if (status !== 'active' && status !== 'any' && a.status !== status) return false;
  if (q.severity?.length && !q.severity.includes(a.severity)) return false;
  if (q.deviceId && a.deviceId !== q.deviceId) return false;
  return true;
}

export function AlarmListView({
  hrefs, initialQuery, onQueryChange, deviceId, pageSize = 20, embedded = false, now, className,
}: AlarmListViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale } = useIotText();

  const [query, setQuery] = useState<AlarmListQuery>(() => ({
    status: 'active', severity: [], search: '', ...initialQuery, page: initialQuery?.page ?? 1, pageSize: initialQuery?.pageSize ?? pageSize, deviceId,
  }));
  const [items, setItems] = useState<Alarm[]>([]);
  const [total, setTotal] = useState(0);
  // the query the shown rows answer; while it differs from the current one the table shows "loading"
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<AlarmCounts | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [pendingNew, setPendingNew] = useState(0);
  /** `acknowledgeAll` = every OPEN alarm of the list's scope, not only the selected rows. */
  const [bulk, setBulk] = useState<'acknowledge' | 'acknowledgeAll' | 'clear' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; }, [query]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const apply = useCallback((q: AlarmListQuery, page: { items: Alarm[]; total: number } | null, e?: unknown) => {
    if (page) {
      setItems(page.items);
      itemsRef.current = page.items;
      setTotal(page.total);
      setError(null);
    } else {
      setError(errorMessage(e, m.alarms.loadError));
    }
    setLoadedKey(JSON.stringify(q));
  }, [m.alarms.loadError]);

  /** Reads `q` and shows it (also the poll, the retry and the catch-up); an aborted read changes nothing. */
  const load = useCallback((q: AlarmListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list(bounded(q), signal).then(
      (page) => { if (!signal?.aborted) apply(q, page); },
      (e) => { if (!signal?.aborted) apply(q, null, e); },
    );
  }, [api, apply]);

  const loadCounts = useCallback((): Promise<void> => (api
    ? api.counts(deviceId ? { deviceId } : undefined).then(setCounts, () => undefined) // the chips stay as they were
    : Promise.resolve()), [api, deviceId]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(query, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, query]);
  useEffect(() => { loadCounts().catch(() => undefined); }, [loadCounts]);

  function change(patch: Partial<AlarmListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    // at once, not in the effect: the table reports page 1 for a new filter before that effect runs, and must see this query
    queryRef.current = next;
    setQuery(next);
    setSelected(new Set());
    setPendingNew(0);
    onQueryChange?.(next);
  }
  /** The table's page, rows per page, sort or search changed (it reports its query on mount too: nothing then). */
  function tableQuery(t: DataTableQuery) {
    const cur = queryRef.current;
    const sort = toIotSort(t.sort, ALARM_SORT_KEYS);
    if (t.page === cur.page && t.pageSize === cur.pageSize && t.search === (cur.search ?? '') && sameSort(sort, cur.sort)) return;
    change({ page: t.page, pageSize: t.pageSize, search: t.search, sort });
  }
  /** The status choice or the Filters panel was applied (back to page 1). */
  function filtersChanged(v: DataTableFilterValues) {
    change({
      status: choiceOf(v.status, STATUS_FILTERS) ?? 'active',
      severity: Array.isArray(v.severity) ? ALARM_SEVERITIES.filter((s) => (v.severity as unknown[]).includes(s)) : [],
    });
  }

  // live: new and changed alarms of the scope
  const countsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleCounts = useCallback(() => {
    if (countsTimer.current) return;
    countsTimer.current = setTimeout(() => { countsTimer.current = null; void loadCounts(); }, 1_000);
  }, [loadCounts]);
  useEffect(() => () => { if (countsTimer.current) clearTimeout(countsTimer.current); }, []);

  const onLive = useCallback((payload: unknown) => {
    const ev = api?.parseLive?.(payload);
    if (!ev) return;
    scheduleCounts();
    const q = queryRef.current;
    const { alarm } = ev;
    const cur = itemsRef.current;
    const i = cur.findIndex((a) => a.alarmId === alarm.alarmId);
    if (i >= 0) {
      const next = [...cur];
      next[i] = alarm;
      itemsRef.current = next;
      setItems(next);
      return;
    }
    if (ev.transition !== 'created' || !matches(alarm, q)) return;
    const newestFirst = !q.sort || (q.sort.key === 'opened' && q.sort.dir === 'desc');
    if (q.page !== 1 || (q.search ?? '').trim() || !newestFirst) {
      setPendingNew((n) => n + 1);
      return;
    }
    const next = [alarm, ...cur].slice(0, q.pageSize);
    itemsRef.current = next;
    setItems(next);
    setTotal((t) => t + 1);
    setFresh((f) => new Set([...f, alarm.alarmId]));
    setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(alarm.alarmId); return n; }), NEW_HIGHLIGHT_MS);
  }, [api, scheduleCounts]);

  const snapshots = useRef(0);
  const state = useLiveOrPoll({
    key: deviceId ?? 'tenant',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.alarms(deviceId ? { deviceId } : 'tenant'),
      onLive,
      // the first snapshot only repeats the list just read; a later one follows a reconnect: catch up
      onSnapshot: () => { snapshots.current += 1; if (snapshots.current > 1) { void load(queryRef.current); void loadCounts(); } },
    }) : undefined,
    poll: () => { void load(queryRef.current); void loadCounts(); },
  });

  async function runBulk() {
    if (!api || !bulk) return;
    if (bulk === 'acknowledgeAll') {
      setBusy(true);
      try {
        const n = await acknowledgeAllOpen(api, deviceId ? { deviceId } : undefined, note || undefined);
        notify({ tone: 'success', message: fill(m.alarms.acknowledgeAllDone, { n }) });
        setSelected(new Set());
        setBulk(null);
        setNote('');
      } catch (e) {
        notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
      } finally {
        setBusy(false);
        await Promise.all([load(queryRef.current), loadCounts()]);
      }
      return;
    }
    const ids = [...selected];
    const action = bulk;
    setBusy(true);
    // optimistic: the rows change at once; the ids the server skipped roll back
    const before = items;
    setItems((cur) => cur.map((a) => (selected.has(a.alarmId)
      ? { ...a, status: action === 'acknowledge' ? (a.status === 'OPEN' ? 'ACKNOWLEDGED' : a.status) : 'RESOLVED' }
      : a)));
    try {
      const results = action === 'acknowledge' ? await api.acknowledge(ids, note || undefined) : await api.clear(ids, note || undefined);
      const done = results.filter((r) => r.ok).length;
      notify({ tone: done === ids.length ? 'success' : 'info', message: fill(m.alarms.bulkDone, { done, skipped: ids.length - done }) });
      setSelected(new Set());
      setBulk(null);
      setNote('');
      await Promise.all([load(queryRef.current), loadCounts()]);
    } catch (e) {
      setItems(before);
      notify({ tone: 'error', message: fill(m.alarm.failed, { message: errorMessage(e, m.alarms.loadError) }) });
    } finally {
      setBusy(false);
    }
  }

  const selectable = caps.canAcknowledge || caps.canClear;
  const filterFields = useMemo((): DataTableFilterField<Alarm>[] => [
    {
      id: 'status', label: m.alarms.status, type: 'select', required: true, placement: 'toolbar', defaultValue: 'active',
      options: [
        { value: 'active', label: m.alarms.active },
        { value: 'OPEN', label: m.status.OPEN },
        { value: 'ACKNOWLEDGED', label: m.status.ACKNOWLEDGED },
        { value: 'RESOLVED', label: m.status.RESOLVED },
        { value: 'any', label: m.alarms.anyStatus },
      ],
    },
    { id: 'severity', label: m.alarms.severity, type: 'checkboxes', options: ALARM_SEVERITIES.map((s) => ({ value: s, label: m.severity[s] })) },
  ], [m]);
  const filterValues = useMemo((): DataTableFilterValues => ({
    status: query.status ?? 'active',
    ...(query.severity?.length ? { severity: query.severity } : {}),
  }), [query.status, query.severity]);

  const columns: Column<Alarm>[] = [
    { key: 'severity', header: m.alarms.severity, sortable: true, render: (a) => <AlarmSeverityBadge severity={a.severity} size="sm" /> },
    {
      key: 'title',
      header: m.alarms.alarm,
      sortable: true,
      render: (a) => (
        <a href={hrefs.alarm(a.alarmId)} className="block min-w-0 rounded font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <span className="block truncate">{a.title}</span>
          {a.flapping && <span className="text-xs font-normal text-warning-fg">{m.alarm.flapping}</span>}
        </a>
      ),
    },
    ...(deviceId ? [] : [{
      key: 'device',
      header: m.alarms.device,
      hideBelow: 'md' as const,
      sortable: true,
      render: (a: Alarm) => (a.deviceId && hrefs.device
        ? <a href={hrefs.device(a.deviceId)} className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{a.deviceName ?? a.deviceId}</a>
        : (a.deviceName ?? '—')),
    }]),
    { key: 'status', header: m.alarms.status, hideBelow: 'sm', sortable: true, render: (a) => <AlarmStatusPill status={a.status} size="sm" /> },
    {
      key: 'opened',
      header: m.alarms.opened,
      hideBelow: 'sm',
      sortable: true,
      render: (a) => <time className="text-xs text-text-secondary" title={formatDateTime(a.openedAt, { locale })}>{formatRelative(a.openedAt, { locale, now })}</time>,
    },
  ];

  if (!api) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {!embedded && <PageHeader title={m.alarms.title} subtitle={m.alarms.subtitle} />}

      <div className="flex flex-wrap items-center gap-2">
        {counts && (
          <>
            <ChipButton active={query.status === 'OPEN'} onClick={() => change({ status: query.status === 'OPEN' ? 'active' : 'OPEN' })}>
              {fill(m.alarms.openCount, { n: counts.open })}
            </ChipButton>
            <ChipButton active={query.status === 'ACKNOWLEDGED'} onClick={() => change({ status: query.status === 'ACKNOWLEDGED' ? 'active' : 'ACKNOWLEDGED' })}>
              {fill(m.alarms.acknowledgedCount, { n: counts.acknowledged })}
            </ChipButton>
          </>
        )}
        {caps.canAcknowledge && counts && counts.open > 0 && (
          <Button variant="outline" size="xs" onClick={() => setBulk('acknowledgeAll')} iconLeft={<FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3" aria-hidden="true" />}>
            {fill(m.alarms.acknowledgeAll, { n: counts.open })}
          </Button>
        )}
        <span className="ml-auto text-xs text-text-secondary" aria-live="polite">{state === 'live' ? m.common.live : m.common.polling}</span>
      </div>

      {pendingNew > 0 && (
        <div className="flex justify-center">
          <Button variant="primary" size="sm" onClick={() => change({ page: 1, search: '' })} iconLeft={<FontAwesomeIcon icon={faArrowUp} className="h-3 w-3" aria-hidden="true" />}>
            {fill(m.alarms.newPill, { n: pendingNew })}
          </Button>
        </div>
      )}

      <DataTable<Alarm>
        mode="manual"
        caption={m.alarms.title}
        columns={columns}
        rows={items}
        total={total}
        query={{ page: query.page, pageSize: query.pageSize, sort: toTableSort(query.sort), search: query.search ?? '' }}
        onQueryChange={tableQuery}
        multiSort={false}
        searchPlaceholder={m.alarms.search}
        filterFields={filterFields}
        filterValues={filterValues}
        onFilterValuesChange={filtersChanged}
        pageSizeOptions={LIST_PAGE_SIZES}
        rowId={(a) => a.alarmId}
        rowState={(a) => (fresh.has(a.alarmId) ? 'new' : undefined)}
        selectable={selectable}
        selectedRowIds={selectable ? [...selected] : undefined}
        onSelectionChange={selectable ? (ids: DataTableRowId[]) => setSelected(new Set(ids.map(String))) : undefined}
        isRowSelectable={(a) => (a.status === 'RESOLVED' ? m.status.RESOLVED : true)}
        rowSelectLabel={(a) => fill(m.common.selectRow, { name: a.title })}
        bulkActions={() => (
          <>
            {caps.canAcknowledge && (
              <Button variant="outline" size="sm" onClick={() => setBulk('acknowledge')} iconLeft={<FontAwesomeIcon icon={faCheck} className="h-3 w-3" aria-hidden="true" />}>
                {fill(m.alarms.bulkAcknowledge, { n: selected.size })}
              </Button>
            )}
            {caps.canClear && (
              <Button variant="primary" size="sm" onClick={() => setBulk('clear')} iconLeft={<FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />}>
                {fill(m.alarms.bulkClear, { n: selected.size })}
              </Button>
            )}
          </>
        )}
        loading={loadedKey !== JSON.stringify(query)}
        error={error || undefined}
        onRetry={() => void load(queryRef.current)}
        emptyMessage={m.alarms.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        keyboardNavigation
      />

      <Modal
        open={bulk !== null}
        onClose={() => setBulk(null)}
        title={m.alarm.noteTitle}
        closeLabel={m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBulk(null)}>{m.common.cancel}</Button>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void runBulk()}>
              {bulk === 'clear'
                ? fill(m.alarms.bulkClear, { n: selected.size })
                : bulk === 'acknowledgeAll'
                  ? fill(m.alarms.acknowledgeAll, { n: counts?.open ?? 0 })
                  : fill(m.alarms.bulkAcknowledge, { n: selected.size })}
            </Button>
          </div>
        )}
      >
        <Textarea id="alarm-bulk-note" label={m.alarm.noteLabel} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        active ? 'border-primary bg-primary-subtle text-primary' : 'border-border text-text-secondary hover:bg-surface-overlay',
      )}
    >
      {children}
    </button>
  );
}
