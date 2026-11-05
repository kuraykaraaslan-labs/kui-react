'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { NO_CAPABILITIES, type IotAdapter, type IotCapabilities } from './adapter';
import { POLL_FALLBACK_MS, type IotLive, type IotLiveState } from './live';
import { mergeIotMessages, type IotMessages, type IotMessagesInput } from '../messages';

/*
 * IotAdapterProvider (docs/concepts/iot-platform/phases/00 §0.4): gives the IoT views their adapter, live source,
 * capabilities and a `notify` for results. Providers nest: an inner one adds its sub-APIs and capabilities to the outer
 * one's (a host whose device page and alarm tab come from different modules provides each part where it is rendered).
 */

export type IotNotice = { tone: 'success' | 'error' | 'info'; message: string };
export type IotNotify = (notice: IotNotice) => void;

type IotContextValue = {
  adapter: IotAdapter;
  live: IotLive | null;
  capabilities: IotCapabilities;
  capabilitiesReady: boolean;
  /** The adapter's capabilities could not be read: they are unknown (not denied); `retryCapabilities` asks again. */
  capabilitiesFailed: boolean;
  retryCapabilities: () => void;
  notify: IotNotify;
  messages: IotMessagesInput | undefined;
  locale: string | undefined;
  timeZone: string | undefined;
};

const IotContext = createContext<IotContextValue | null>(null);

const silent: IotNotify = () => undefined;

export type IotAdapterProviderProps = {
  adapter: IotAdapter;
  /** The live source; `null`/absent = no live data (views poll every 30 s). An inner provider inherits the outer one's. */
  live?: IotLive | null;
  /**
   * Known capabilities; otherwise `adapter.capabilities()` is asked once (fail closed until it answers). A failed answer leaves every
   * capability off and says so (`useIotCapabilities().failed`, with `retry`): unknown is not the same as denied.
   */
  capabilities?: Partial<IotCapabilities>;
  notify?: IotNotify;
  /** Translated texts (any subset); an inner provider's win over the outer one's. */
  messages?: IotMessagesInput;
  /** BCP 47 tag for dates and relative times. */
  locale?: string;
  /** IANA zone the times are shown in (the viewer's setting); absent: the browser's. Every time names its zone either way. */
  timeZone?: string;
  children: React.ReactNode;
};

export function IotAdapterProvider({ adapter, live, capabilities, notify, messages, locale, timeZone, children }: IotAdapterProviderProps) {
  const parent = useContext(IotContext);
  const [asked, setAsked] = useState<Partial<IotCapabilities> | null>(null);
  const [askFailed, setAskFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const needsAsk = capabilities === undefined && typeof adapter.capabilities === 'function';

  useEffect(() => {
    if (!needsAsk) return;
    const ctrl = new AbortController();
    adapter.capabilities!(ctrl.signal)
      .then((c) => { if (!ctrl.signal.aborted) { setAsked(c); setAskFailed(false); } })
      .catch(() => { if (!ctrl.signal.aborted) { setAsked({}); setAskFailed(true); } });
    return () => ctrl.abort();
  }, [adapter, needsAsk, attempt]);

  const parentRetry = parent?.retryCapabilities;
  const retryCapabilities = useCallback(() => {
    parentRetry?.();
    if (!needsAsk) return;
    setAsked(null);
    setAskFailed(false);
    setAttempt((n) => n + 1);
  }, [needsAsk, parentRetry]);

  const value = useMemo<IotContextValue>(() => {
    const own = capabilities ?? asked ?? {};
    return {
      adapter: { ...(parent?.adapter ?? {}), ...adapter },
      live: live === undefined ? (parent?.live ?? null) : live,
      capabilities: { ...NO_CAPABILITIES, ...(parent?.capabilities ?? {}), ...own },
      capabilitiesReady: (parent?.capabilitiesReady ?? true) && (!needsAsk || asked !== null),
      capabilitiesFailed: (parent?.capabilitiesFailed ?? false) || (needsAsk && askFailed),
      retryCapabilities,
      notify: notify ?? parent?.notify ?? silent,
      messages: messages ? mergeLayers(parent?.messages, messages) : parent?.messages,
      locale: locale ?? parent?.locale,
      timeZone: timeZone ?? parent?.timeZone,
    };
  }, [adapter, asked, askFailed, capabilities, live, locale, messages, needsAsk, notify, parent, retryCapabilities, timeZone]);

  return <IotContext.Provider value={value}>{children}</IotContext.Provider>;
}

function mergeLayers(a: IotMessagesInput | undefined, b: IotMessagesInput): IotMessagesInput {
  if (!a) return b;
  const out: Record<string, Record<string, string>> = {};
  for (const layer of [a, b]) {
    for (const [group, texts] of Object.entries(layer)) out[group] = { ...(out[group] ?? {}), ...(texts as Record<string, string>) };
  }
  return out as IotMessagesInput;
}

/**
 * The texts and locale for a component: the provider's (when there is one) under the component's own `messages` prop.
 * Works without a provider, so the leaf components (badges, tables) render anywhere.
 */
export function useIotText(own?: IotMessagesInput, ownLocale?: string): { m: IotMessages; locale: string | undefined; timeZone: string | undefined } {
  const ctx = useContext(IotContext);
  const fromCtx = ctx?.messages;
  const m = useMemo(() => mergeIotMessages(fromCtx, own), [fromCtx, own]);
  return { m, locale: ownLocale ?? ctx?.locale, timeZone: ctx?.timeZone };
}

function useIotContext(): IotContextValue {
  const ctx = useContext(IotContext);
  if (!ctx) throw new Error('An IoT view was rendered without an <IotAdapterProvider>: wrap it in one with the host adapter.');
  return ctx;
}

export function useIotAdapter(): IotAdapter {
  return useIotContext().adapter;
}

export function useIotLive(): IotLive | null {
  return useIotContext().live;
}

/**
 * The viewer's capabilities, `ready` once answered. `failed`: the answer could not be read, so every capability is off because it is
 * unknown, not denied; a view says so (with `retry`) instead of "you may not change this".
 */
export function useIotCapabilities(): IotCapabilities & { ready: boolean; failed: boolean; retry: () => void } {
  const ctx = useIotContext();
  return { ...ctx.capabilities, ready: ctx.capabilitiesReady, failed: ctx.capabilitiesFailed, retry: ctx.retryCapabilities };
}

export function useIotNotify(): IotNotify {
  return useIotContext().notify;
}

/** The live source's state, kept current (`idle` without a source). */
export function useIotLiveState(live: IotLive | null): IotLiveState | 'none' {
  const subscribe = useCallback((cb: () => void) => (live ? live.onState(cb) : () => undefined), [live]);
  const read = useCallback(() => (live ? live.state : 'none'), [live]);
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * Live with a polling fallback (NB 05 §5.4): `subscribe` runs while there is a live source; `poll` runs every
 * `intervalMs` (30 s) whenever the source is absent or not `live` (connecting, reconnecting, refused). The latest
 * callbacks are used without re-subscribing.
 */
export function useLiveOrPoll(opts: {
  subscribe?: (live: IotLive) => () => void;
  poll: () => void;
  enabled?: boolean;
  intervalMs?: number;
  /** Re-subscribe when this changes (the topic's params). */
  key?: string;
}): IotLiveState | 'none' {
  const live = useIotLive();
  const state = useIotLiveState(live);
  const pollRef = useRef(opts.poll);
  const subRef = useRef(opts.subscribe);
  useEffect(() => {
    pollRef.current = opts.poll;
    subRef.current = opts.subscribe;
  });
  const enabled = opts.enabled ?? true;
  const intervalMs = opts.intervalMs ?? POLL_FALLBACK_MS;
  const hasSubscribe = typeof opts.subscribe === 'function';

  useEffect(() => {
    if (!enabled || !live || !hasSubscribe) return;
    return subRef.current!(live);
  }, [enabled, live, hasSubscribe, opts.key]);

  const polling = enabled && (state !== 'live' || !hasSubscribe);
  const tick = useCallback(() => pollRef.current(), []);
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [polling, intervalMs, tick]);

  return state;
}
