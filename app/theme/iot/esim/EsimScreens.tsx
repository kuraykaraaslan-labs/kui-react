'use client';
import { useEffect, useState } from 'react';
import { EsimDeviceAction } from '@/modules/domains/iot/esim/EsimDeviceAction';
import { EsimPanel } from '@/modules/domains/iot/esim/EsimPanel';
import { createDemoEsimAdapter, type DemoEsimAdapter } from '@/modules/domains/iot/esim/demo-esim';

/** One demo router that finishes an operation every 3 s while the page is open. */
function useDemoEsim(o: Parameters<typeof createDemoEsimAdapter>[0]): DemoEsimAdapter {
  const [a] = useState(() => createDemoEsimAdapter(o));
  useEffect(() => {
    const id = setInterval(() => a.step(), 3000);
    return () => clearInterval(id);
  }, [a]);
  return a;
}

/** /theme/iot/esim — the device page's eSIM button (drawn only for a router with an eSIM chip) and the panel on a page. */
export function EsimScreen() {
  const router = useDemoEsim({ deviceId: 'r-1', uplink: 'lte', profiles: [
    { iccid: '8990011234567890123', operator: 'Turkcell', nickname: 'Main line', state: 'enabled', class: 'operational' },
    { iccid: '8990029876543210987', operator: 'Vodafone', state: 'disabled', class: 'operational' },
    { iccid: '8990045555555555555', operator: 'NoSignal Mobile', nickname: 'Switches back (demo)', state: 'disabled', class: 'test' },
  ] });
  const office = useDemoEsim({ deviceId: 'r-2', uplink: 'ethernet' });
  const plain = useDemoEsim({ deviceId: 'r-3', supported: false });
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Device page header: eSIM button</h2>
        <p className="text-sm text-text-secondary">A router on a mobile connection, and one without an eSIM chip (no button at all).</p>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm text-text-primary">Field router</span>
          <EsimDeviceAction adapter={router} deviceId="r-1" can={{ manage: true }} />
          <span className="ml-6 text-sm text-text-primary">Sensor gateway</span>
          <EsimDeviceAction adapter={plain} deviceId="r-3" can={{ manage: true }} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">The panel on a page (router on Ethernet)</h2>
        <EsimPanel adapter={office} deviceId="r-2" can={{ manage: true }} pollMs={2000} />
      </section>
    </div>
  );
}
