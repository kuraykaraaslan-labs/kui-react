'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { errorMessage, type RpcCatalog } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText, useLiveOrPoll } from '../api/IotAdapterProvider';
import { iotTopics } from '../api/live';
import type { RpcRequest, RpcSendInput } from '../types/rpc';
import { RpcRequestDetail } from './RpcRequestDetail';
import { RpcRequestList } from './RpcRequestList';
import { RpcSendPanel } from './RpcSendPanel';

/**
 * RpcConsoleView — a device's command console (phase 04; NB `iot_rpc` 03), read through the adapter: the send panel over the
 * profile's catalog (what the viewer may send, the typed confirmation of high-impact commands, never a factory reset) and the
 * request history, which follows the device's `rpc` live topic (a sent request moves QUEUED → SENT → DELIVERED → SUCCESSFUL without a
 * reload; 30 s polling without a live source). A row opens the detail drawer (answer, progress, send again, cancel). Without
 * `deviceId` it is the fleet log (every device's requests, no send panel) when the host offers one.
 */
export type RpcConsoleViewProps = {
  deviceId?: string;
  /** The device's connection (warns about a non-persistent command to an offline device). */
  deviceOnline?: boolean | null;
  pageSize?: number;
  now?: number;
  className?: string;
};

export function RpcConsoleView({ deviceId, deviceOnline, pageSize = 25, now, className }: RpcConsoleViewProps) {
  const api = useIotAdapter().rpc;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [catalog, setCatalog] = useState<RpcCatalog | null>(null);
  const [items, setItems] = useState<RpcRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RpcRequest | null>(null);
  const [preset, setPreset] = useState<{ method: string; params?: Record<string, unknown> } | null>(null);
  const openRef = useRef<string | null>(null);
  useEffect(() => { openRef.current = openId; }, [openId]);

  const first = useCallback((signal?: AbortSignal): Promise<void> => {
    if (!api) return Promise.resolve();
    return api.list({ deviceId, limit: pageSize }, signal).then(
      (page) => { if (!signal?.aborted) { setItems(page.items); setCursor(page.nextCursor); setError(null); setLoaded(true); } },
      (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.rpc.loadError)); setLoaded(true); } },
    );
  }, [api, deviceId, pageSize, m.rpc.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    first(ctrl.signal).catch(() => undefined);
    if (api && deviceId) api.methods(deviceId, ctrl.signal).then((c) => { if (!ctrl.signal.aborted) setCatalog(c); }).catch(() => undefined);
    return () => ctrl.abort();
  }, [api, deviceId, first]);

  function more() {
    if (!api || !cursor) return;
    setLoadingMore(true);
    api.list({ deviceId, limit: pageSize, cursor }).then(
      (page) => { setItems((cur) => [...cur, ...page.items.filter((p) => !cur.some((c) => c.rpcId === p.rpcId))]); setCursor(page.nextCursor); },
      (e) => notify({ tone: 'error', message: errorMessage(e, m.rpc.loadError) }),
    ).finally(() => setLoadingMore(false));
  }

  const upsert = useCallback((r: RpcRequest, highlight = false) => {
    setItems((cur) => {
      const i = cur.findIndex((c) => c.rpcId === r.rpcId);
      if (i < 0) return [r, ...cur];
      const next = [...cur];
      next[i] = { ...cur[i], ...r, params: r.params ?? cur[i].params, response: r.response ?? cur[i].response };
      return next;
    });
    if (highlight) {
      setFresh((f) => new Set([...f, r.rpcId]));
      setTimeout(() => setFresh((f) => { const n = new Set(f); n.delete(r.rpcId); return n; }), 4_000);
    }
  }, []);

  useLiveOrPoll({
    key: deviceId ?? '*',
    subscribe: api ? (live) => live.subscribe({
      ...iotTopics.rpc(deviceId ?? '*'),
      onLive: (payload) => {
        const ev = api.parseLive?.(payload);
        if (!ev) return;
        upsert(ev.request);
        if (openRef.current === ev.request.rpcId) api.get(ev.request.rpcId).then(setDetail).catch(() => undefined);
      },
    }) : undefined,
    poll: () => { first().catch(() => undefined); },
  });

  async function send(input: RpcSendInput) {
    if (!api || !deviceId) return;
    try {
      const r = await api.send(deviceId, input);
      upsert(r, true);
      notify({ tone: 'success', message: m.rpc.sent });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.rpc.loadError) });
      throw e;
    }
  }

  function open(r: RpcRequest) {
    setOpenId(r.rpcId);
    setDetail(r);
    api?.get(r.rpcId).then((full) => { if (openRef.current === full.rpcId) setDetail(full); }).catch(() => undefined);
  }

  async function cancel(rpcId: string) {
    if (!api) return;
    try {
      const r = await api.cancel(rpcId);
      upsert(r);
      setDetail(r);
      notify({ tone: 'success', message: m.rpc.cancelled });
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.rpc.loadError) });
    }
  }

  if (!api) return null;
  const canSendAny = !!catalog && (catalog.canSendRaw || catalog.commands.some((c) => c.sendable !== false));

  return (
    <div className={cn('space-y-4', className)}>
      {deviceId && catalog && (canSendAny || !catalog.supported) && (
        <RpcSendPanel
          commands={catalog.commands}
          canSendRaw={catalog.canSendRaw}
          supported={catalog.supported}
          unsupportedReason={catalog.reason}
          deviceOnline={deviceOnline}
          preset={preset}
          onSend={(i) => send(i).catch(() => undefined)}
        />
      )}
      <section aria-label={m.rpc.history} className="space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">{m.rpc.history}</h2>
        <RpcRequestList
          requests={items}
          showDevice={!deviceId}
          fresh={fresh}
          onOpen={open}
          loading={!loaded || loadingMore}
          error={error}
          onRetry={() => { first().catch(() => undefined); }}
          hasMore={!!cursor}
          onLoadMore={more}
          now={now}
        />
      </section>
      <RpcRequestDetail
        open={openId !== null}
        request={detail}
        onClose={() => { setOpenId(null); setDetail(null); }}
        onCancel={cancel}
        onRerun={deviceId ? (r) => {
          setPreset({ method: r.method, params: r.params && typeof r.params === 'object' ? (r.params as Record<string, unknown>) : undefined });
          setOpenId(null);
          setDetail(null);
        } : undefined}
      />
    </div>
  );
}
