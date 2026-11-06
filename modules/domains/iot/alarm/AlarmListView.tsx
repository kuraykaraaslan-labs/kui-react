'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faCheck, faCheckDouble, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableFilterValues, DataTableQuery, DataTableRowId } from '@/modules/ui/Table/types';
import { Modal } from '@/modules/ui/Modal';
import { PageHeader } from '@/modules/ui/PageHeader';
import { Textarea } from '@/modules/ui/Textarea';
import { ALARM_SORT_KEYS, errorMessage, type AlarmListQuery, type AlarmStatusFilter } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { LIST_PAGE_SIZES, choiceOf, sameSort, toIotSort, toTableSort } from '../api/list-table';
import { iotTopics } from '../api/live';
import { fill, formatDateTime, formatRelative, plural } from '../format';
import { ALARM_SEVERITIES, type Alarm, type AlarmCounts } from '../types/alarm';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { AlarmStatusPill } from './AlarmStatusPill';
import { acknowledgeAllOpen, type AcknowledgeAllScope } from './acknowledgeAll';
import { acknowledgeAllNotice, actionFailedText } from './alarm-results';

/**
 * AlarmListView — the alarm list (phase 03 §3.2), read through the adapter, on the DataTable's own toolbar: search, the status
 * choice, the Filters panel (the five OD-9 severity levels), sortable columns, rows per page and server paging; status count
 * chips (clickable), selection with bulk acknowledge / clear sharing one note (per-id results: "47 done, 3 skipped"),
 * "Acknowledge all" for every OPEN alarm of the list's scope (same note), and live arrivals: on the first page of the newest-first
 * order a new matching alarm appears at the top, highlighted; elsewhere (another page, a search, another order) a "N new alarms"
 * pill brings the viewer back. Without a live source it re-reads every 30 s. A
 * resolved or all-status list always asks for a bounded range (last 7 days, OD-31). With `deviceId` it is a device's
 * Alarms tab.
 *
 * Only the newest read is shown, and a page past the end moves to the last page; the host's `initialQuery` is followed by value when
 * it changes (Back, a menu click). While live, a row whose alarm leaves the filter drops out (the total with it), the list re-reads
 * about every minute (counts that moved without an event, rows changed elsewhere), and the selection keeps only shown rows.
 * "Acknowledge all" acts on what the list shows: the OPEN alarms of its scope and filters that were open when it started, counted
 * by the host for those filters; it is offered on the not-resolved and the OPEN lists, and its confirmation names the scope and says
 * their reminders stop; a failure says how many were done. Clear says a rule will not open a cleared alarm again while its condition
 * holds. `onOpen` opens an alarm or device in the host's router (NB 41-ui-fixes/24 1.2, 1.3, 1.9, 1.10, 1.12, 1.17, 1.18).
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
  /** Opens a link (an alarm, a device) in the host's router on a plain click; without it the links are plain links. */
  onOpen?: (href: string) => void;
  now?: number;
  className?: string;
};

/** The longest search the host takes (NB `ListAlarmsDTO.search`); a longer one is cut, never refused. */
export const ALARM_SEARCH_MAX = 128;
/** While live: the slow re-read beside the events. */
export const ALARM_LIVE_REREAD_MS = 60_000;
const WEEK_MS = 7 * 86_400_000;
const STATUS_FILTERS: readonly AlarmStatusFilter[] = ['active', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'any'];
const NEW_HIGHLIGHT_MS = 4_000;

function bounded(q: AlarmListQuery): AlarmListQuery {
  if ((q.status === 'any' || q.status === 'RESOLVED') && !q.from) return { ...q, from: new Date(Date.now() - WEEK_MS).toISOString() };
  return q;
}

/** A list query as a value (the fields one by one; the scope's device is not part of it). */
function queryKey(q: AlarmListQuery): string {
  return JSON.stringify([q.page, q.pageSize, q.status ?? 'active', [...(q.severity ?? [])].sort(), q.search || null, q.sort?.key ?? null, q.sort?.dir ?? null]);
}
const sameQuery = (a: AlarmListQuery, b: AlarmListQuery) => queryKey(a) === queryKey(b);
/** The filters "Acknowledge all" acts on, as a value. */
const scopeKey = (q: AlarmListQuery) => JSON.stringify([[...(q.severity ?? [])].sort(), q.search || null]);

/** What the host's query names, as a value (an absent or undefined field is not named). */
function hostKey(q: Partial<AlarmListQuery> | undefined): string {
  return JSON.stringify(Object.entries(q ?? {}).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** The list's query moved to the host's: page and filters as the host has them, rows per page and sort only when it names them. */
function followHost(cur: AlarmListQuery, host: Partial<AlarmListQuery> | undefined): AlarmListQuery {
  const h = host ?? {};
  const next: AlarmListQuery = { ...cur, page: h.page ?? 1, status: h.status ?? 'active', severity: h.severity ?? [], search: h.search ?? '' };
  if (h.pageSize !== undefined) next.pageSize = h.pageSize;
  if (h.sort !== undefined) next.sort = h.sort;
  return next;
}

/** A plain left click (no modifier): the host's router opens the link; any other click keeps the link's own behaviour. */
function plainClick(e: React.MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function matches(a: Alarm, q: AlarmListQuery): boolean {
  const status = q.status ?? 'active';
  if (status === 'active' && a.status === 'RESOLVED') return false;
  if (status !== 'active' && status !== 'any' && a.status !== status) return false;
  if (q.severity?.length && !q.severity.includes(a.severity)) return false;
  if (q.deviceId && a.deviceId !== q.deviceId) return false;
  return true;
}

export function AlarmListView({
  hrefs, initialQuery, onQueryChange, deviceId, pageSize = 20, embedded = false, onOpen, now, className,
}: AlarmListViewProps) {
  const adapter = useIotAdapter();
  const api = adapter.alarms;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText();

  const [query, setQuery] = useState<AlarmListQuery>(() => ({
    status: 'active', severity: [], search: '', ...initialQuery, page: initialQuery?.page ?? 1, pageSize: initialQuery?.pageSize ?? pageSize, deviceId,
  }));
  /** The OPEN alarms of the list's scope and filters, as the host counts them ("Acknowledge all (n)"); null until read. */
  const [openInScope, setOpenInScope] = useState<number | null>(null);
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
  // a layout effect: the table reports its page for a query the host moved before the passive effects run, and must compare with it
  useLayoutEffect(() => { queryRef.current = query; }, [query]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // the host's query moved under the mounted list (its URL changed): follow it by value (1.17)
  const initialKey = hostKey(initialQuery);
  const [seenInitial, setSeenInitial] = useState(initialKey);
  if (initialKey !== seenInitial) {
    setSeenInitial(initialKey);
    const next = followHost(query, initialQuery);
    if (!sameQuery(next, query)) {
      setQuery(next);
      setSelected(new Set());
      setPendingNew(0);
    }
  }
  // only the newest read is shown: a late answer of an older one is dropped (1.9)
  const seqRef = useRef(0);
  const clampRef = useRef<(q: AlarmListQuery, total: number) => void>(() => undefined);

  const apply = useCallback((q: AlarmListQuery, page: { items: Alarm[]; total: number } | null, e?: unknown) => {
    if (page) {
      setItems(page.items);
      itemsRef.current = page.items;
      setTotal(page.total);
      setError(null);
      // the selection keeps only rows still shown (a selected alarm that left the page is not acted on unseen, 1.10)
      setSelected((cur) => {
        const shown = new Set(page.items.filter((a) => a.status !== 'RESOLVED').map((a) => a.alarmId));
        const kept = [...cur].filter((id) => shown.has(id));
        return kept.length === cur.size ? cur : new Set(kept);
      });
    } else {
      setError(errorMessage(e, m.alarms.loadError));
    }
    setLoadedKey(JSON.stringify(q));
  }, [m.alarms.loadError]);

  /** Reads `q` and shows it (also the poll, the retry and the catch-up); an aborted read, or one a newer read overtook, changes nothing. */
  const load = useCallback((q: AlarmListQuery, signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    const seq = ++seqRef.current;
    return api.list(bounded(q), signal).then(
      (page) => {
        if (signal?.aborted || seq !== seqRef.current) return;
        // a page past the end (its last alarms cleared, a stale URL): the last page instead of an empty list
        if (!page.items.length && page.total > 0 && q.page > 1) {
          clampRef.current(q, page.total);
          return;
        }
        apply(q, page);
      },
      (e) => { if (!signal?.aborted && seq === seqRef.current) apply(q, null, e); },
    );
  }, [api, apply]);

  /** The chips' counts and the OPEN alarms of the scope and filters (the "Acknowledge all" count); a failed read keeps what is shown. */
  const loadCounts = useCallback((): Promise<void> => {
    if (!api) return Promise.resolve();
    const q = queryRef.current;
    const scoped = api.list({
      page: 1, pageSize: 1, status: 'OPEN', deviceId,
      ...(q.severity?.length ? { severity: q.severity } : {}), ...(q.search ? { search: q.search } : {}),
    }).then((p) => { if (scopeKey(q) === scopeKey(queryRef.current)) setOpenInScope(p.total); }, () => undefined);
    return Promise.all([api.counts(deviceId ? { deviceId } : undefined).then(setCounts, () => undefined), scoped]).then(() => undefined);
  }, [api, deviceId]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(query, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, query]);
  // the scope's OPEN count follows the filters
  const filterKey = scopeKey(query);
  const [countedKey, setCountedKey] = useState(filterKey);
  if (countedKey !== filterKey) {
    // another scope: its count is not known yet (no button with the old one)
    setCountedKey(filterKey);
    setOpenInScope(null);
  }
  useEffect(() => { loadCounts().catch(() => undefined); }, [loadCounts, filterKey]);

  function change(patch: Partial<AlarmListQuery>) {
    const next = { ...queryRef.current, ...patch, page: patch.page ?? 1 };
    if (next.search && next.search.length > ALARM_SEARCH_MAX) next.search = next.search.slice(0, ALARM_SEARCH_MAX);
    // at once, not in the effect: the table reports page 1 for a new filter before that effect runs, and must see this query
    queryRef.current = next;
    setQuery(next);
    setSelected(new Set());
    setPendingNew(0);
    onQueryChange?.(next);
  }
  useEffect(() => {
    clampRef.current = (q, all) => {
      if (!sameQuery(q, queryRef.current)) return;
      change({ page: Math.max(1, Math.ceil(all / q.pageSize)) });
    };
  });
  /** The table's page, rows per page, sort or search changed (it reports its query on mount too: nothing then). */
  function tableQuery(t: DataTableQuery) {
    const cur = queryRef.current;
    const sort = toIotSort(t.sort, ALARM_SORT_KEYS);
    const search = (t.search ?? '').slice(0, ALARM_SEARCH_MAX);
    if (t.page === cur.page && t.pageSize === cur.pageSize && search === (cur.search ?? '') && sameSort(sort, cur.sort)) return;
    change({ page: t.page, pageSize: t.pageSize, search, sort });
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
      // a row whose alarm left the filter drops out, the total with it (1.10); the slow re-read fills the page again
      const next = matches(alarm, q) ? cur.map((a, j) => (j === i ? { ...a, ...alarm } : a)) : cur.filter((_, j) => j !== i);
      if (next.length < cur.length) {
        setTotal((n) => Math.max(0, n - 1));
        setSelected((s) => { if (!s.has(alarm.alarmId)) return s; const n = new Set(s); n.delete(alarm.alarmId); return n; });
      }
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
  // live: the events keep the rows current, and a slow re-read catches what no event says (a re-trigger's count, a page that thinned)
  useEffect(() => {
    if (state !== 'live') return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void load(queryRef.current);
      void loadCounts();
    }, ALARM_LIVE_REREAD_MS);
    return () => clearInterval(id);
  }, [state, load, loadCounts]);

  async function runBulk() {
    if (!api || !bulk) return;
    if (bulk === 'acknowledgeAll') {
      setBusy(true);
      try {
        const r = await acknowledgeAllOpen(api, scopeOf(queryRef.current), note || undefined);
        notify(acknowledgeAllNotice(m, r, locale));
        if (r.error === undefined) {
          setSelected(new Set());
          setBulk(null);
          setNote('');
        }
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
      notify({ tone: 'error', message: actionFailedText(m, e, action, true) });
    } finally {
      setBusy(false);
    }
  }

  /** "Acknowledge all" acts on the list's scope and filters. */
  const scopeOf = (q: AlarmListQuery): AcknowledgeAllScope => ({ deviceId, severity: q.severity, search: q.search });
  const filtered = !!(query.severity?.length || query.search);
  const status = query.status ?? 'active';
  // offered where the list shows OPEN alarms: the not-resolved and the OPEN lists
  const canAckAll = caps.canAcknowledge && (status === 'active' || status === 'OPEN') && (openInScope ?? 0) > 0;
  const ackAllHint = filtered ? m.alarms.acknowledgeAllHint_filtered : deviceId ? m.alarms.acknowledgeAllHint_device : m.alarms.acknowledgeAllHint_all;
  const open = (href: string) => (onOpen ? (e: React.MouseEvent) => { if (plainClick(e)) { e.preventDefault(); onOpen(href); } } : undefined);

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
      hideable: false,
      render: (a) => (
        <a href={hrefs.alarm(a.alarmId)} onClick={open(hrefs.alarm(a.alarmId))} className="block min-w-0 rounded font-medium text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
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
        ? <a href={hrefs.device(a.deviceId)} onClick={open(hrefs.device(a.deviceId))} className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{a.deviceName ?? a.deviceId}</a>
        : (a.deviceName ?? '—')),
    }]),
    { key: 'status', header: m.alarms.status, hideBelow: 'sm', sortable: true, render: (a) => <AlarmStatusPill status={a.status} size="sm" /> },
    {
      key: 'opened',
      header: m.alarms.opened,
      hideBelow: 'sm',
      sortable: true,
      render: (a) => <time className="text-xs text-text-secondary" title={formatDateTime(a.openedAt, { locale, timeZone })}>{formatRelative(a.openedAt, { locale, now })}</time>,
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
        {canAckAll && (
          <Button variant="outline" size="xs" onClick={() => setBulk('acknowledgeAll')} iconLeft={<FontAwesomeIcon icon={faCheckDouble} className="h-3 w-3" aria-hidden="true" />}>
            {fill(m.alarms.acknowledgeAll, { n: openInScope ?? 0 })}
          </Button>
        )}
        <span className="ml-auto text-xs text-text-secondary" aria-live="polite">{state === 'live' ? m.common.live : m.common.polling}</span>
      </div>

      {pendingNew > 0 && (
        <div className="flex justify-center">
          <Button variant="primary" size="sm" onClick={() => change({ page: 1, search: '' })} iconLeft={<FontAwesomeIcon icon={faArrowUp} className="h-3 w-3" aria-hidden="true" />}>
            {plural(pendingNew, { one: m.alarms.newPill_one, other: m.alarms.newPill }, locale)}
          </Button>
        </div>
      )}

      {caps.ready && caps.failed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center gap-2">
            {m.common.capabilitiesError}
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}

      <DataTable<Alarm>
        mode="manual"
        caption={m.alarms.title}
        columns={columns}
        // The viewer's own columns, saved in this browser (the alarm stays); a device's tab has no Device column.
        columnChooser
        tableId={deviceId ? 'iot.device.alarms' : 'iot.alarms'}
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
        title={bulk === 'acknowledgeAll' ? plural(openInScope ?? 0, { one: m.alarms.acknowledgeAllTitle_one, other: m.alarms.acknowledgeAllTitle }, locale) : m.alarm.noteTitle}
        closeLabel={m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBulk(null)}>{m.common.cancel}</Button>
            <Button variant="primary" size="sm" loading={busy} onClick={() => void runBulk()}>
              {bulk === 'clear'
                ? fill(m.alarms.bulkClear, { n: selected.size })
                : bulk === 'acknowledgeAll'
                  ? fill(m.alarms.acknowledgeAll, { n: openInScope ?? 0 })
                  : fill(m.alarms.bulkAcknowledge, { n: selected.size })}
            </Button>
          </div>
        )}
      >
        {bulk === 'acknowledgeAll' && <p className="mb-3 text-sm text-text-secondary">{ackAllHint}</p>}
        {bulk === 'clear' && <p className="mb-3 text-sm text-text-secondary">{m.alarms.bulkClearHint}</p>}
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
