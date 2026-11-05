'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type IotDevicesApi } from '../api/adapter';
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
  more: () => void;
  reload: () => void;
};

type Loaded = { key: string; entries: DeviceLogEntry[]; total: number; error: string | null; page: number };

const CONNECTION_ONLY: readonly DeviceLogSource[] = ['connection'];
const BOTH: readonly DeviceLogSource[] = ['connection', 'audit'];

/**
 * One device's log, page by page, through `devices.log` (or `devices.connections` when the host has no `log`). The first page is
 * read again when the device or the filter changes, and until it arrives nothing of the previous device shows; "load more" appends
 * the next page and drops an entry it already shows (a new entry between two reads shifts the pages by one). Only the newest read's
 * answer is kept: a reload of the previous device that lands after the next device's first page is dropped, so it can neither show
 * the old device's lines nor leave the log loading (NB 41-ui-fixes/21 1.13).
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

  const fetchPage = useCallback(async (pageNo: number, signal?: AbortSignal): Promise<{ items: DeviceLogEntry[]; total: number }> => {
    if (!api) return { items: [], total: 0 };
    if (api.log) return api.log(deviceId, { page: pageNo, pageSize, ...(filter === 'all' ? {} : { source: filter }) }, signal);
    if (filter === 'audit') return { items: [], total: 0 };
    const r = await api.connections(deviceId, { page: pageNo, pageSize }, signal);
    return { items: r.items.map(connectionToLogEntry), total: r.total };
  }, [api, deviceId, pageSize, filter]);

  const read = useCallback((pageNo: number, signal?: AbortSignal): Promise<void> => {
    const mine = ++seq.current;
    return fetchPage(pageNo, signal).then(
      (res) => {
        if (signal?.aborted || mine !== seq.current) return;
        setBusy(false);
        setLoaded((cur) => {
          if (pageNo === 1 || !cur || cur.key !== key) return { key, entries: res.items, total: res.total, error: null, page: 1 };
          const seen = new Set(cur.entries.map((e) => e.id));
          return { key, entries: [...cur.entries, ...res.items.filter((e) => !seen.has(e.id))], total: res.total, error: null, page: pageNo };
        });
      },
      (e) => {
        if (signal?.aborted || mine !== seq.current) return;
        const msg = errorMessage(e, errorText);
        setBusy(false);
        setLoaded((cur) => (cur && cur.key === key ? { ...cur, error: msg } : { key, entries: [], total: 0, error: msg, page: 1 }));
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

  const mine = loaded && loaded.key === key ? loaded : null;
  return {
    entries: mine?.entries ?? [],
    total: mine?.total ?? 0,
    loading: !mine || busy,
    error: mine?.error ?? null,
    sources: api?.log ? BOTH : CONNECTION_ONLY,
    more,
    reload,
  };
}
