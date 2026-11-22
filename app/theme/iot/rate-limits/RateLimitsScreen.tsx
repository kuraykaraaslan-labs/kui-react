'use client';
import { useState } from 'react';
import { DeviceRateLimitsAction, DeviceRateLimitsPanel } from '@/modules/domains/iot/ratelimits/DeviceRateLimitsAction';
import { createDemoRateLimitsAdapter, DEMO_RATE_LIMITS } from '@/modules/domains/iot/ratelimits/demo-ratelimits';

/** /theme/iot/rate-limits — the device page's "Rate limits" button and drawer, and the panel with rate limiting off on the gateway. */
export function RateLimitsScreen() {
  const [adapter] = useState(() => createDemoRateLimitsAdapter());
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Device page header: Rate limits button</h2>
        <p className="text-sm text-text-secondary">Read-only: what the gateway applies to this device and to the whole workspace.</p>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm text-text-primary">Boiler 1</span>
          <DeviceRateLimitsAction adapter={adapter} deviceId="boiler-1" />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">The panel when rate limiting is off on the gateway</h2>
        <DeviceRateLimitsPanel view={{ ...DEMO_RATE_LIMITS, device: DEMO_RATE_LIMITS.device.map((r) => ({ ...r, mode: 'off' as const })), gateway: { enforcement: 'off', enforce: [], nodes: 1 } }} />
      </section>
    </div>
  );
}
