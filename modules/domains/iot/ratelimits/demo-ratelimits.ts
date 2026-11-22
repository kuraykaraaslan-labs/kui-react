import type { DeviceRateLimitsView, RateLimitsAdapter } from './types';

/** A device on the protocol defaults with one profile change, one family enforced by the operator, a Growth-tier plan. Demo data only. */
export const DEMO_RATE_LIMITS: DeviceRateLimitsView = {
  device: [
    { family: 'telemetry_msgs', windows: [{ count: 2, seconds: 1 }, { count: 60, seconds: 60 }], source: 'profile', mode: 'enforced' },
    { family: 'telemetry_points', windows: [{ count: 100, seconds: 1 }, { count: 3000, seconds: 60 }], source: 'default', mode: 'enforced' },
    { family: 'attr_msgs', windows: [{ count: 10, seconds: 1 }, { count: 300, seconds: 60 }], source: 'default', mode: 'enforced' },
    { family: 'rpc_msgs', windows: [{ count: 5, seconds: 1 }, { count: 60, seconds: 60 }], source: 'default', mode: 'enforced' },
    { family: 'attr_requests', windows: [{ count: 5, seconds: 1 }, { count: 60, seconds: 60 }], source: 'default', mode: 'observed' },
    { family: 'csr', windows: [{ count: 1, seconds: 3600 }], source: 'default', mode: 'observed' },
    { family: 'connects', windows: [{ count: 6, seconds: 60 }], source: 'default', mode: 'enforced' },
  ],
  tenant: [
    { key: 'msgsPerSecond', value: 15 }, { key: 'telemetryMsgsPerSecond', value: 15 }, { key: 'pointsPerMinute', value: 9000 },
    { key: 'connectedDevices', value: null }, { key: 'connectsPerMinute', value: null },
  ],
  gateway: { enforcement: 'on', enforce: ['connects'], nodes: 2 },
};

export function createDemoRateLimitsAdapter(view: DeviceRateLimitsView = DEMO_RATE_LIMITS, delayMs = 150): RateLimitsAdapter {
  return {
    limits: (_deviceId, signal) => new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve(view), delayMs);
      signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); });
    }),
  };
}
