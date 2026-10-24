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
  notify: IotNotify;
  messages: IotMessagesInput | undefined;
  locale: string | undefined;
};

const IotContext = createContext<IotContextValue | null>(null);

const silent: IotNotify = () => undefined;

export type IotAdapterProviderProps = {
  adapter: IotAdapter;
  /** The live source; `null`/absent = no live data (views poll every 30 s). An inner provider inherits the outer one's. */
  live?: IotLive | null;
  /** Known capabilities; otherwise `adapter.capabilities()` is asked once (fail closed until it answers). */
  capabilities?: Partial<IotCapabilities>;
  notify?: IotNotify;
  /** Translated texts (any subset); an inner provider's win over the outer one's. */
  messages?: IotMessagesInput;
  /** BCP 47 tag for dates and relative times. */
  locale?: string;
  children: React.ReactNode;
};

export function IotAdapterProvider({ adapter, live, capabilities, notify, messages, locale, children }: IotAdapterProviderProps) {
  const parent = useContext(IotContext);
  const [asked, setAsked] = useState<Partial<IotCapabilities> | null>(null);
  const needsAsk = capabilities === undefined && typeof adapter.capabilities === 'function';

  useEffect(() => {
    if (!needsAsk) return;
    const ctrl = new AbortController();
    adapter.capabilities!(ctrl.signal)
      .then((c) => { if (!ctrl.signal.aborted) setAsked(c); })
      .catch(() => { if (!ctrl.signal.aborted) setAsked({}); });
    return () => ctrl.abort();
  }, [adapter, needsAsk]);

  const value = useMemo<IotContextValue>(() => {
    const own = capabilities ?? asked ?? {};
    return {
      adapter: { ...(parent?.adapter ?? {}), ...adapter },
      live: live === undefined ? (parent?.live ?? null) : live,
      capabilities: { ...NO_CAPABILITIES, ...(parent?.capabilities ?? {}), ...own },
      capabilitiesReady: (parent?.capabilitiesReady ?? true) && (!needsAsk || asked !== null),
      notify: notify ?? parent?.notify ?? silent,
      messages: messages ? mergeLayers(parent?.messages, messages) : parent?.messages,
      locale: locale ?? parent?.locale,
    };
  }, [adapter, asked, capabilities, live, locale, messages, needsAsk, notify, parent]);

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
export function useIotText(own?: IotMessagesInput, ownLocale?: string): { m: IotMessages; locale: string | undefined } {
  const ctx = useContext(IotContext);
  const fromCtx = ctx?.messages;
  const m = useMemo(() => mergeIotMessages(fromCtx, own), [fromCtx, own]);
  return { m, locale: ownLocale ?? ctx?.locale };
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

export function useIotCapabilities(): IotCapabilities & { ready: boolean } {
  const ctx = useIotContext();
  return { ...ctx.capabilities, ready: ctx.capabilitiesReady };
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
