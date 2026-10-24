/*
 * The IoT live contract (docs/concepts/iot-platform/phases/00 §0.3). It says nothing about the wire: NB maps it onto its
 * Socket.IO `/iot` namespace (`IotLiveClient`), the demo onto an in-memory source. Events are not replayed; after a
 * reconnect each subscription gets a new snapshot, which is how a view catches up.
 *
 * Phase 9.11's generic `LiveSource` is not built yet; this narrow interface is what the IoT views need and maps onto it
 * when it lands.
 */

export type IotLiveState = 'idle' | 'connecting' | 'live' | 'polling' | 'closed';

export interface IotLiveSubscription<L = unknown, S = unknown> {
  kind: string;
  params: Record<string, unknown>;
  onLive(payload: L): void;
  onSnapshot?(payload: S): void;
  onError?(code: string): void;
}

export interface IotLive {
  readonly state: IotLiveState;
  /** Subscribe; returns the unsubscribe. */
  subscribe<L = unknown, S = unknown>(sub: IotLiveSubscription<L, S>): () => void;
  onState(listener: (state: IotLiveState) => void): () => void;
}

/** Topic helpers: `{ kind, params }` for `subscribe`. */
export const iotTopics = {
  /** One device's connection state, or every device of the tenant (`'*'`). */
  deviceState: (deviceId: string) => ({ kind: 'deviceState', params: { deviceId } as Record<string, unknown> }),
  /** The tenant's alarms, or one device's. */
  alarms: (scope: 'tenant' | { deviceId: string }) => ({
    kind: 'alarms',
    params: (scope === 'tenant' ? { scope: 'tenant' } : { deviceId: scope.deviceId }) as Record<string, unknown>,
  }),
  /** One device's RPC requests (with `rpcId`: one request), or every request of the tenant (`'*'`). */
  rpc: (deviceId: string, rpcId?: string) => ({
    kind: 'rpc',
    params: { deviceId, ...(rpcId ? { rpcId } : {}) } as Record<string, unknown>,
  }),
  telemetry: (deviceId: string, keys?: readonly string[]) => ({
    kind: 'telemetry',
    params: { deviceId, ...(keys?.length ? { keys: [...keys] } : {}) } as Record<string, unknown>,
  }),
};

/** How often a view re-reads over HTTP while no live source delivers (00 §0.3, NB 05 §5.4). */
export const POLL_FALLBACK_MS = 30_000;
