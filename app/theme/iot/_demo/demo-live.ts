import type { IotLive, IotLiveState, IotLiveSubscription } from '@/modules/domains/iot/api/live';

/*
 * The demo's live source (docs/concepts/iot-platform/phases/00 §0.5): an in-memory `IotLive`. The demo adapter publishes into
 * it after each change (an acknowledge, a new device, …) and a slow simulation flips a device online/offline and raises an
 * alarm now and then, so the views can be watched updating without a server. Topics match by kind and by `params`
 * (`deviceId: '*'` / `scope: 'tenant'` receive every event of their kind).
 */

type Entry = { sub: IotLiveSubscription };

export type DemoLive = IotLive & {
  publish(kind: string, key: { deviceId?: string | null }, payload: unknown): void;
  setState(state: IotLiveState): void;
};

export function createDemoLive(): DemoLive {
  const subs = new Set<Entry>();
  const listeners = new Set<(s: IotLiveState) => void>();
  let state: IotLiveState = 'live';

  function wants(e: Entry, kind: string, deviceId: string | null | undefined): boolean {
    if (e.sub.kind !== kind) return false;
    const p = e.sub.params;
    if (p.scope === 'tenant' || p.deviceId === '*') return true;
    return typeof p.deviceId === 'string' && p.deviceId === deviceId;
  }

  return {
    get state() { return state; },
    subscribe(sub) {
      const entry: Entry = { sub: sub as IotLiveSubscription };
      subs.add(entry);
      return () => { subs.delete(entry); };
    },
    onState(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(kind, key, payload) {
      if (state !== 'live') return;
      for (const e of [...subs]) if (wants(e, kind, key.deviceId)) e.sub.onLive(payload);
    },
    setState(next) {
      if (next === state) return;
      state = next;
      for (const l of listeners) l(next);
    },
  };
}
