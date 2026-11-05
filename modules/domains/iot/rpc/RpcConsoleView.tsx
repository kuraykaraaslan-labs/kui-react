'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { errorMessage, RPC_SORT_KEYS, type RpcCatalog, type RpcListQuery } from '../api/adapter';
import { toIotSort } from '../api/list-table';
import type { DataTableQuery } from '@/modules/ui/Table/types';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText, useLiveOrPoll, type IotNotice } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import { fill } from '../format';
import type { IotMessages } from '../messages';
import {
  isRefusedRpcMethod, RPC_STATUSES, rpcPresetOf, rpcStatusRank, type RpcPreset, type RpcRequest, type RpcSendInput, type RpcStatus, type RpcTier,
} from '../types/rpc';
import { rpcErrorText, RpcRequestDetail } from './RpcRequestDetail';
import { RpcRequestList } from './RpcRequestList';
import { RpcSendPanel } from './RpcSendPanel';

/**
 * RpcConsoleView — a device's command console (phase 04; NB `iot_rpc` 03), read through the adapter: the send panel over the
 * profile's catalog (what the viewer may send, the typed confirmation of high-impact commands, never a factory reset) and the
 * request history, which follows the device's `rpc` live topic (a sent request moves QUEUED → SENT → DELIVERED → SUCCESSFUL without a
 * reload; 30 s polling without a live source). A row opens the detail drawer (answer, progress, send again, cancel). Without
 * `deviceId` it is the fleet log (every device's requests, no send panel) when the host offers one. The history is a full list:
 * its table's search, sort, filters, rows per page and paging go to the host (`RpcListQuery` page mode), one page at a time.
 *
 * NB 41-ui-fixes/23: a send's toast follows the host's answer (sent, queued for an offline device, not sent with the reason); a send
 * that got no answer says it may have been sent and re-reads the history (1.3, 1.4); a failed catalog read says so with a retry (1.15);
 * "Send again" and "Cancel" are offered only to a viewer who may send that command's tier, and "Send again" replays the request's own
 * settings without its masked values (1.1, 1.7, N1); the snapshot sent on every (re)subscribe is merged and a row never moves back to an
 * earlier status (1.12, 1.13); the open request is re-read on every poll and a late answer never shows another one (1.14); the history
 * says whether it is live or polling (1.21).
 */
export type RpcConsoleViewProps = {
  deviceId?: string;
  /** The device's connection (warns about a non-persistent command to an offline device). */
  deviceOnline?: boolean | null;
  /** The device's name: the confirmation of a high-impact command names it. */
  deviceName?: string | null;
  pageSize?: number;
  now?: number;
  className?: string;
};

/** `r` over `cur`, never moving it back to an earlier status; what `r` does not carry is kept (a live event has no params or answer). */
function merged(cur: RpcRequest, r: RpcRequest): RpcRequest {
  if (rpcStatusRank(r.status) < rpcStatusRank(cur.status)) return cur;
  const next = { ...cur } as Record<string, unknown>;
  for (const [k, v] of Object.entries(r)) if (v !== undefined) next[k] = v;
  return next as RpcRequest;
}

/** The toast of a send, by the request the host answered (1.3): a known reason is a sentence of its own (C9), the host's words are not. */
function sentNotice(r: RpcRequest, m: IotMessages): IotNotice {
  if (r.status === 'FAILED') {
    const known = r.errorReason ? (m.rpcError as Record<string, string>)[r.errorReason] : undefined;
    return { tone: 'error', message: known ?? fill(m.rpc.sentFailed, { reason: rpcErrorText(r, m) ?? m.rpc.FAILED }) };
  }
  if (r.status === 'EXPIRED' || r.status === 'TIMEOUT' || r.status === 'CANCELLED') {
    return { tone: 'info', message: fill(m.rpc.sentEnded, { status: m.rpc[r.status] ?? r.status }) };
  }
  if (r.status === 'QUEUED' && r.persistent) return { tone: 'info', message: m.rpc.sentQueued };
  return { tone: 'success', message: m.rpc.sent };
}

export function RpcConsoleView({ deviceId, deviceOnline, deviceName, pageSize = 25, now, className }: RpcConsoleViewProps) {
  const api = useIotAdapter().rpc;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [catalog, setCatalog] = useState<RpcCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [items, setItems] = useState<RpcRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<DataTableQuery | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RpcRequest | null>(null);
  const [preset, setPreset] = useState<RpcPreset | null>(null);
  // the request whose full read (params, answer) arrived: "Send again" waits for it (C12)
  const [fullFor, setFullFor] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);
  useEffect(() => { openRef.current = openId; }, [openId]);

  /** The table's query as the adapter's: a 1-based page, the method search, one sort, the status and source lists. */
  const listQuery = useCallback((q: DataTableQuery | null): RpcListQuery => {
    const size = q?.pageSize ?? pageSize;
    const list = (v: unknown) => (Array.isArray(v) && v.length ? v.map(String) : undefined);
    const statuses = list(q?.filterValues.status)?.filter((s): s is RpcStatus => (RPC_STATUSES as readonly string[]).includes(s));
    return {
      deviceId, page: q?.page ?? 1, pageSize: size, limit: size,
      search: q?.search.trim() || undefined, sort: q ? toIotSort(q.sort, RPC_SORT_KEYS) : undefined,
      statuses: statuses?.length ? statuses : undefined, sources: list(q?.filterValues.source),
    };
  }, [deviceId, pageSize]);

  // The table reports its first query on mount; nothing is read before it.
  const first = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api || !query) return Promise.resolve();
    return api.list(listQuery(query), signal).then(
      (page) => {
        if (signal?.aborted) return;
        // a read that left before a live event answers after it: the row keeps the later status (1.13)
        setItems((cur) => page.items.map((p) => {
          const c = cur.find((x) => x.rpcId === p.rpcId);
          return c && rpcStatusRank(c.status) > rpcStatusRank(p.status) ? merged(p, c) : p;
        }));
        setTotal(page.total ?? page.items.length);
        setError(null);
        setLoaded(true);
      },
      (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.rpc.loadError)); setLoaded(true); } },
    );
  }, [api, listQuery, query, m.rpc.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    first(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [first]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (api && deviceId) {
      api.methods(deviceId, ctrl.signal).then(
        (c) => { if (!ctrl.signal.aborted) { setCatalog(c); setCatalogError(null); } },
        (e) => { if (!ctrl.signal.aborted) setCatalogError(errorMessage(e, m.rpc.catalogError)); },
      );
    }
    return () => ctrl.abort();
  }, [api, deviceId, catalogAttempt, m.rpc.catalogError]);

  const upsert = useCallback((r: RpcRequest, highlight = false) => {
    setItems((cur) => {
      const i = cur.findIndex((c) => c.rpcId === r.rpcId);
      if (i < 0) {
        // a new request belongs on the first page of the default order only; elsewhere the next read places it
        const onTop = !query || (query.page === 1 && !query.sort.length && !query.search.trim() && !Object.keys(query.filterValues).length);
        if (!onTop) return cur;
        const at = new Date(r.createdAt).getTime();
        const before = cur.findIndex((c) => new Date(c.createdAt).getTime() < at);
        const next = before < 0 ? [...cur, r] : [...cur.slice(0, before), r, ...cur.slice(before)];
        return next.slice(0, query?.pageSize ?? pageSize);
      }
      const next = [...cur];
      next[i] = merged(cur[i], r);
      return next;
    });
    if (highlight) {
      setFresh((f) => new Set([...f, r.rpcId]));
      setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(r.rpcId); return n; }), 4_000);
    }
  }, [query, pageSize]);

  /** The open request read again; a late answer for a request no longer open is dropped (1.14). */
  const refreshOpen = useCallback((rpcId?: string) => {
    const id = rpcId ?? openRef.current;
    if (!api || !id) return;
    api.get(id).then((full) => {
      if (openRef.current !== full.rpcId) return;
      setDetail((cur) => (cur ? merged(cur, full) : full));
      setFullFor(full.rpcId);
    }).catch(() => undefined);
  }, [api]);

  const liveState = useLiveOrPoll({
    key: deviceId ?? '*',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.rpc(deviceId ?? '*'),
      onLive: (payload) => {
        const ev = api.parseLive?.(payload);
        if (!ev) return;
        upsert(ev.request);
        if (openRef.current === ev.request.rpcId) refreshOpen(ev.request.rpcId);
      },
      // every (re)subscribe sends the requests as they stand: what changed while the connection was down (1.12)
      onSnapshot: (payload) => {
        const rows = api.parseSnapshot?.(payload);
        if (!rows) return;
        for (const r of rows) upsert(r);
        if (openRef.current && rows.some((r) => r.rpcId === openRef.current)) refreshOpen();
      },
    }) : undefined,
    poll: () => { first().catch(() => undefined); refreshOpen(); },
  });

  async function send(input: RpcSendInput) {
    if (!api || !deviceId) return;
    try {
      const r = await api.send(deviceId, input);
      upsert(r, true);
      notify(sentNotice(r, m));
    } catch (e) {
      // the panel says what went wrong; a send that got no answer may have been sent, so the history is read again at once (1.4)
      first().catch(() => undefined);
      throw e;
    }
  }

  function open(r: RpcRequest) {
    setFullFor(null);
    setOpenId(r.rpcId);
    openRef.current = r.rpcId;
    setDetail(r);
    refreshOpen(r.rpcId);
  }

  async function cancel(rpcId: string) {
    if (!api) return;
    try {
      const r = await api.cancel(rpcId);
      upsert(r);
      if (openRef.current === r.rpcId) setDetail((cur) => (cur ? merged(cur, r) : r));
      notify(r.errorReason === 'cancelled_after_sent' ? { tone: 'info', message: m.rpc.cancelledAfterSent } : { tone: 'success', message: m.rpc.cancelled });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.rpc.cancelError) });
      // it may have moved on meanwhile (delivered, answered): show where it is now
      refreshOpen(rpcId);
    }
  }

  if (!api) return null;
  const canSendAny = !!catalog && (catalog.canSendRaw || catalog.commands.some((c) => c.sendable !== false));

  /** The viewer may send `method` now (its catalog entry's tier, or raw outside the catalog). */
  const methodSendable = (method: string): boolean => {
    if (!catalog || !catalog.supported || isRefusedRpcMethod(method)) return false;
    const c = catalog.commands.find((x) => x.method === method);
    return c ? c.sendable !== false : catalog.canSendRaw;
  };
  /** The viewer holds the send permission of `tier` (the one a cancel asks for): some command of that tier is sendable, or raw RPC. */
  const tierSendable = (tier: RpcTier | undefined, method: string): boolean => {
    if (!catalog) return false;
    if (!tier) return methodSendable(method);
    if (tier === 'raw') return catalog.canSendRaw;
    return catalog.commands.some((c) => c.tier === tier && c.sendable !== false);
  };
  const canCancel = (r: RpcRequest) => (deviceId ? tierSendable(r.tier, r.method) : caps.canSendRpc);
  const canRerun = (r: RpcRequest) => !!deviceId && methodSendable(r.method);
  const live = liveState === 'live';

  return (
    <div className={cn('space-y-4', className)}>
      {deviceId && catalogError && !catalog && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-raised p-4 text-sm text-error">
          <span>{catalogError}</span>
          <Button variant="outline" size="sm" onClick={() => { setCatalogError(null); setCatalogAttempt((n) => n + 1); }}>{m.common.retry}</Button>
        </div>
      )}
      {deviceId && catalog && (canSendAny || !catalog.supported) && (
        <RpcSendPanel
          commands={catalog.commands}
          canSendRaw={catalog.canSendRaw}
          supported={catalog.supported}
          unsupportedReason={catalog.reason}
          deviceOnline={deviceOnline}
          deviceName={deviceName}
          isSecretParam={catalog.isSecretParam}
          preset={preset}
          onSend={send}
        />
      )}
      <section aria-label={m.rpc.history} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{m.rpc.history}</h2>
          {liveState !== 'none' && (
            <Badge variant={live ? 'success' : 'neutral'} size="sm" dot data-live={live ? 'live' : 'polling'}>{live ? m.common.live : m.common.polling}</Badge>
          )}
        </div>
        <RpcRequestList
          requests={items}
          showDevice={!deviceId}
          fresh={fresh}
          onOpen={open}
          loading={!loaded}
          error={error}
          onRetry={() => { first().catch(() => undefined); }}
          total={total}
          onQueryChange={(q) => setQuery((prev) => (prev && JSON.stringify(prev) === JSON.stringify(q) ? prev : q))}
          defaultQuery={{ pageSize }}
          now={now}
        />
      </section>
      <RpcRequestDetail
        open={openId !== null}
        request={detail}
        onClose={() => { setOpenId(null); openRef.current = null; setDetail(null); }}
        onCancel={detail && canCancel(detail) ? cancel : undefined}
        rerunReady={!!detail && fullFor === detail.rpcId}
        onRerun={detail && canRerun(detail) ? (r) => {
          setPreset(rpcPresetOf(r, catalog?.commands.find((c) => c.method === r.method), catalog?.isSecretParam));
          setOpenId(null);
          openRef.current = null;
          setDetail(null);
        } : undefined}
      />
    </div>
  );
}
