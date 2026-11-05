'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type DeviceLogPage, type IotDevicesApi } from '../api/adapter';
import type { DeviceConnectionEvent, DeviceLogEntry, DeviceLogFilter, DeviceLogSource } from '../types/device';

/** A connection event of the older `connections()` call as a log entry (hosts without `log`). */
export function connectionToLogEntry(e: DeviceConnectionEvent): DeviceLogEntry {
  return { id: e.id, at: e.at, source: 'connection', kind: e.kind, reason: e.reason, detail: e.detail, transport: e.transport, remoteIp: e.remoteIp };
}

export type DeviceLogState = {
  entries: DeviceLogEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  /** The sources this host can show (`audit` only with `log`). */
  sources: readonly DeviceLogSource[];
  /** False when the host could not read the audited changes for the newest page (its answer said so). */
  auditAvailable: boolean;
  /** Another page can be asked for (there are more, and the next page stays within the host's `maxDepth`). */
  hasMore: boolean;
  /** More entries exist than the host reads (its `maxDepth`): the newest `maxDepth` are all that can be shown. */
  capped: number | null;
  more: () => void;
  reload: () => void;
  /** Reads the newest page again and puts what is new on top, keeping the pages already shown (a connection change, a save). */
  refresh: () => void;
};

type Loaded = { key: string; entries: DeviceLogEntry[]; total: number; error: string | null; page: number; auditAvailable: boolean; maxDepth: number | null };

const CONNECTION_ONLY: readonly DeviceLogSource[] = ['connection'];
const BOTH: readonly DeviceLogSource[] = ['connection', 'audit'];

/**
 * One device's log, page by page, through `devices.log` (or `devices.connections` when the host has no `log`). The first page is
 * read again when the device or the filter changes, and until it arrives nothing of the previous device shows; "load more" appends
 * the next page and drops an entry it already shows (a new entry between two reads shifts the pages by one). Only the newest read's
 * answer is kept: a reload of the previous device that lands after the next device's first page is dropped, so it can neither show
 * the old device's lines nor leave the log loading (NB 41-ui-fixes/21 1.13). `refresh` reads the newest page again and adds what is new
 * on top (the device page calls it on a connection change). A host's `maxDepth` bounds paging: past it "Load more" is not offered and
 * `capped` says how many are shown; its `auditAvailable: false` is kept so the view says the changes could not be read (NB 41-ui-fixes/22
 * 4.1, 4.2, 6.2).
 */
export function useDeviceLog(api: IotDevicesApi | undefined, deviceId: string, opts: { pageSize: number; filter?: DeviceLogFilter; errorText: string }): DeviceLogState {
  const { pageSize, filter = 'all', errorText } = opts;
  const key = `${deviceId}|${filter}|${pageSize}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef<Loaded | null>(null);
  useEffect(() => { current.current = loaded; }, [loaded]);
  // every read takes a number; an answer that is not the newest read's is dropped
  const seq = useRef(0);

  const fetchPage = useCallback(async (pageNo: number, signal?: AbortSignal): Promise<DeviceLogPage> => {
    if (!api) return { items: [], total: 0 };
    if (api.log) return api.log(deviceId, { page: pageNo, pageSize, ...(filter === 'all' ? {} : { source: filter }) }, signal);
    if (filter === 'audit') return { items: [], total: 0 };
    const r = await api.connections(deviceId, { page: pageNo, pageSize }, signal);
    return { items: r.items.map(connectionToLogEntry), total: r.total };
  }, [api, deviceId, pageSize, filter]);

  const read = useCallback((pageNo: number, signal?: AbortSignal, merge = false): Promise<void> => {
    const mine = ++seq.current;
    return fetchPage(pageNo, signal).then(
      (res) => {
        if (signal?.aborted || mine !== seq.current) return;
        setBusy(false);
        const info = { auditAvailable: res.auditAvailable !== false, maxDepth: typeof res.maxDepth === 'number' && res.maxDepth > 0 ? res.maxDepth : null };
        setLoaded((cur) => {
          if (!cur || cur.key !== key || (pageNo === 1 && !merge)) return { key, entries: res.items, total: res.total, error: null, page: 1, ...info };
          const seen = new Set(cur.entries.map((e) => e.id));
          const fresh = res.items.filter((e) => !seen.has(e.id));
          // a refresh puts the new entries on top; a next page goes under
          return merge
            ? { ...cur, entries: [...fresh, ...cur.entries], total: res.total, error: null, ...info }
            : { key, entries: [...cur.entries, ...fresh], total: res.total, error: null, page: pageNo, ...info };
        });
      },
      (e) => {
        if (signal?.aborted || mine !== seq.current) return;
        const msg = errorMessage(e, errorText);
        setBusy(false);
        setLoaded((cur) => (cur && cur.key === key ? { ...cur, error: msg } : { key, entries: [], total: 0, error: msg, page: 1, auditAvailable: true, maxDepth: null }));
      },
    );
  }, [fetchPage, key, errorText]);

  useEffect(() => {
    const ctrl = new AbortController();
    read(1, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [read]);

  const more = useCallback(() => {
    const cur = current.current;
    setBusy(true);
    void read(cur && cur.key === key ? cur.page + 1 : 1);
  }, [read, key]);
  const reload = useCallback(() => { setBusy(true); void read(1); }, [read]);
  const refresh = useCallback(() => {
    const cur = current.current;
    // nothing shown yet (or another device's): a first read, else the newest page merged on top
    void read(1, undefined, !!cur && cur.key === key && cur.entries.length > 0);
  }, [read, key]);

  const mine = loaded && loaded.key === key ? loaded : null;
  const entries = mine?.entries ?? [];
  const total = mine?.total ?? 0;
  const page = mine?.page ?? 1;
  const deeper = !mine?.maxDepth || (page + 1) * pageSize <= mine.maxDepth;
  const hasMore = entries.length < total && deeper;
  return {
    entries,
    total,
    loading: !mine || busy,
    error: mine?.error ?? null,
    sources: api?.log ? BOTH : CONNECTION_ONLY,
    auditAvailable: mine?.auditAvailable ?? true,
    hasMore,
    capped: entries.length < total && !deeper ? entries.length : null,
    more,
    reload,
    refresh,
  };
}
