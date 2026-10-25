import type { IotTelemetryApi, TelemetryLatest, TelemetryPoint, TelemetryValue } from '@/modules/domains/iot/api/adapter';

/*
 * The demo's telemetry (the device page's Telemetry tab): every device sends the same few keys, each a smooth wave around its own level
 * with a phase taken from the device id, so the latest values, the series and the live points of one device agree without storing
 * anything. Pure apart from the clock.
 */
type Key = { key: string; level: number; swing: number; periodMin: number; digits: number };
const NUMERIC: Key[] = [
  { key: 'temperature', level: 22, swing: 3.5, periodMin: 90, digits: 1 },
  { key: 'humidity', level: 48, swing: 9, periodMin: 140, digits: 0 },
  { key: 'battery', level: 86, swing: 4, periodMin: 600, digits: 0 },
  { key: 'rssi', level: -67, swing: 6, periodMin: 25, digits: 0 },
  { key: 'pressure', level: 1013, swing: 4, periodMin: 300, digits: 1 },
];
const POINTS = 96;

function phaseOf(deviceId: string): number {
  let h = 0;
  for (const c of deviceId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
}

export function demoValue(deviceId: string, k: Key, ts: number): number {
  const p = phaseOf(deviceId) * 2 * Math.PI;
  const t = ts / 60_000 / k.periodMin * 2 * Math.PI;
  const v = k.level + k.swing * Math.sin(t + p) + (k.swing / 5) * Math.sin(3.3 * t + 2 * p);
  const f = 10 ** k.digits;
  return Math.round(v * f) / f;
}

/** A device's latest values at `now` (the waves' current points, a flag and two words). */
export function demoLatest(deviceId: string, now = Date.now()): TelemetryLatest[] {
  const ts = now - 2_000 - Math.round(phaseOf(deviceId) * 20_000);
  const out: TelemetryLatest[] = NUMERIC.map((k) => ({ key: k.key, ts, value: demoValue(deviceId, k, ts) }));
  const extra: Array<[string, TelemetryValue]> = [
    ['door_open', Math.sin(ts / 600_000 + phaseOf(deviceId) * 6) > 0.6],
    ['firmware', '2.4.1'],
    ['mode', phaseOf(deviceId) > 0.5 ? 'eco' : 'normal'],
    ['location', { lat: 41.01 + phaseOf(deviceId) / 10, lng: 28.97 }],
  ];
  for (const [key, value] of extra) out.push({ key, ts, value });
  return out;
}

export function createDemoTelemetry(wait: () => Promise<void>): IotTelemetryApi {
  return {
    async latest(deviceId) {
      await wait();
      return demoLatest(deviceId);
    },
    async series(deviceId, q) {
      await wait();
      const out: Record<string, TelemetryPoint[]> = {};
      const step = Math.max(60_000, Math.round((q.to - q.from) / POINTS));
      for (const key of q.keys) {
        const k = NUMERIC.find((x) => x.key === key);
        if (!k) { out[key] = []; continue; }
        const points: TelemetryPoint[] = [];
        for (let ts = Math.ceil(q.from / step) * step; ts < q.to; ts += step) points.push({ ts, value: demoValue(deviceId, k, ts) });
        out[key] = points;
      }
      return out;
    },
  };
}

/** One live point of the device: a numeric key's current value. */
export function demoLivePoint(deviceId: string, i: number, now = Date.now()): { deviceId: string; key: string; ts: number; value: number } {
  const k = NUMERIC[i % NUMERIC.length]!;
  return { deviceId, key: k.key, ts: now, value: demoValue(deviceId, k, now) };
}
