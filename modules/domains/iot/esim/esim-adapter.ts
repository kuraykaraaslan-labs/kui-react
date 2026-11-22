import type { EsimDeviceView, EsimOperation, EsimStartInput, EsimWatchHandlers } from './types';

/**
 * What the eSIM views read and write through. The host implements it over its API (next-boilerplate: `/api/iot/devices/[deviceId]/esim…`
 * of `iot_esim`); the kui-react demo implements it in memory (`demo-esim.ts`). Every method rejects with an `EsimApiError` carrying the
 * server's `reason`, which the views put into plain words.
 */
export interface EsimAdapter {
  device(deviceId: string, signal?: AbortSignal): Promise<EsimDeviceView>;
  /** Newest first. */
  operations(deviceId: string, q: { limit?: number }, signal?: AbortSignal): Promise<EsimOperation[]>;
  /** Starts one operation; it settles on later reads. */
  start(deviceId: string, input: EsimStartInput): Promise<EsimOperation>;
  /**
   * Optional: the device's operations as they change (NB: the `esim` topic of the `/iot` live namespace). While `onLive(true)` the panel
   * stops polling and reads again on each event; without it, or while not live, it polls as before. Returns the unsubscribe.
   */
  watch?(deviceId: string, handlers: EsimWatchHandlers): () => void;
}

/** A refused request: the HTTP status and the server's `details.reason`. */
export class EsimApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly details: Record<string, unknown>;
  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EsimApiError';
    this.status = status;
    this.details = details;
    this.reason = typeof details.reason === 'string' ? details.reason : undefined;
  }
}

export function isEsimApiError(e: unknown): e is EsimApiError {
  return e instanceof EsimApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'EsimApiError');
}
