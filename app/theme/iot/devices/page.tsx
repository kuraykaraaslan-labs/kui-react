'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DeviceListView } from '@/modules/domains/iot/device/DeviceListView';
import type { DeviceListQuery, DeviceOnlineFilter } from '@/modules/domains/iot/api/adapter';
import type { DeviceRegistryStatus } from '@/modules/domains/iot/types/device';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

const ONLINE: DeviceOnlineFilter[] = ['online', 'offline', 'last_seen'];
const STATUS: DeviceRegistryStatus[] = ['ACTIVE', 'QUARANTINED', 'DISABLED'];

/** /theme/iot/devices — a thin page over `DeviceListView` (phase 01 §1.1); the filters and the quick view's device live in the URL. */
export default function DevicesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const online = sp.get('online') as DeviceOnlineFilter | null;
  const status = sp.get('status') as DeviceRegistryStatus | null;
  const gw = sp.get('gateway');
  const initial: Partial<DeviceListQuery> = {
    page: Number(sp.get('page')) || 1,
    search: sp.get('q') ?? undefined,
    profileId: sp.get('profile') ?? undefined,
    online: online && ONLINE.includes(online) ? online : undefined,
    status: status && STATUS.includes(status) ? status : undefined,
    gateway: gw === 'true' ? true : gw === 'false' ? false : undefined,
    device: sp.get('device') ?? undefined,
  };
  function sync(q: DeviceListQuery, how: 'push' | 'replace' = 'replace') {
    const p = new URLSearchParams();
    if (q.page > 1) p.set('page', String(q.page));
    if (q.search) p.set('q', q.search);
    if (q.profileId) p.set('profile', q.profileId);
    if (q.online) p.set('online', q.online);
    if (q.status) p.set('status', q.status);
    if (q.gateway !== undefined) p.set('gateway', String(q.gateway));
    if (q.device) p.set('device', q.device);
    const href = `/theme/iot/devices${p.size ? `?${p}` : ''}`;
    // opening the quick view is a history step (Back closes it); filters, paging and moving between devices are not
    if (how === 'push') router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }
  return (
    <>
      <DocumentTitle text="Devices — IoT Theme" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <DeviceListView hrefs={demoHrefs} initialQuery={initial} onQueryChange={sync} />
      </div>
    </>
  );
}
