'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/modules/ui/Button';
import { FirmwareDetailView } from '@/modules/domains/iot/ota/FirmwareDetailView';
import { FirmwareListView } from '@/modules/domains/iot/ota/FirmwareListView';
import { OtaDevicePanel } from '@/modules/domains/iot/ota/OtaDevicePanel';
import { OtaProfilePanel } from '@/modules/domains/iot/ota/OtaProfilePanel';
import { createDemoOtaAdapter, type DemoOtaAdapter } from '@/modules/domains/iot/ota/demo-ota';
import type { OtaAbilities } from '@/modules/domains/iot/ota/types';

const BASE = '/theme/iot/firmware';
const packageHref = (id: string) => `${BASE}/package?id=${encodeURIComponent(id)}`;
const CAN: OtaAbilities = { managePackages: true, assign: true, manageKeys: true };

let shared: DemoOtaAdapter | null = null;
/** One demo fleet for the firmware pages; it moves one step every 2 s while a page is open. */
function useDemoOta(): DemoOtaAdapter {
  const [a] = useState(() => (shared ??= createDemoOtaAdapter()));
  useEffect(() => {
    const id = setInterval(() => a.step(), 2000);
    return () => clearInterval(id);
  }, [a]);
  return a;
}

/** /theme/iot/firmware — the packages (upload, signing keys), and the device and profile Firmware tabs below. */
export function FirmwareScreen() {
  const router = useRouter();
  const adapter = useDemoOta();
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6">
      <FirmwareListView adapter={adapter} can={CAN} packageHref={packageHref} onOpenPackage={(id) => router.push(packageHref(id))} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-text-primary">Device page: Firmware tab (router that asks first)</h2>
          <Button size="sm" variant="outline" onClick={() => adapter.approve('d-4')}>Approve on the router (demo)</Button>
        </div>
        <OtaDevicePanel adapter={adapter} deviceId="d-4" deviceName="Office router" can={CAN} packageHref={packageHref} pollMs={2000} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Device page: Firmware tab (LTE device, updates over LTE off)</h2>
        <OtaDevicePanel adapter={adapter} deviceId="d-3" deviceName="Valve station (LTE)" can={CAN} packageHref={packageHref} pollMs={2000} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Profile page: Firmware tab</h2>
        <OtaProfilePanel adapter={adapter} profileId="p-esp" profileName="DC620 controllers" can={CAN} packageHref={packageHref} />
      </section>
    </div>
  );
}

/** /theme/iot/firmware/package?id= — one package with its assignments and devices. */
export function FirmwarePackageScreen() {
  return <Suspense><PackageInner /></Suspense>;
}
function PackageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const adapter = useDemoOta();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <FirmwareDetailView adapter={adapter} packageId={sp.get('id') ?? 'pkg-2'} can={CAN} backHref={BASE} onDeleted={() => router.push(BASE)} />
    </div>
  );
}
