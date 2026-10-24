'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DeviceProfileListView } from '@/modules/domains/iot/profile/DeviceProfileListView';
import type { ProfileListQuery } from '@/modules/domains/iot/api/adapter';
import { ONLINE_RULES, PROFILE_TRANSPORTS, type OnlineRule, type ProfileTransport } from '@/modules/domains/iot/types/profile';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

/** /theme/iot/profiles — a thin page over `DeviceProfileListView` (phase 01 §1.4); the filters live in the URL. */
export default function DeviceProfilesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const transport = sp.get('transport') as ProfileTransport | null;
  const online = sp.get('online') as OnlineRule | null;
  const initial: Partial<ProfileListQuery> = {
    page: Number(sp.get('page')) || 1,
    search: sp.get('q') ?? undefined,
    transportType: transport && PROFILE_TRANSPORTS.includes(transport) ? transport : undefined,
    onlineRule: online && ONLINE_RULES.includes(online) ? online : undefined,
  };
  function sync(q: ProfileListQuery) {
    const p = new URLSearchParams();
    if (q.page > 1) p.set('page', String(q.page));
    if (q.search) p.set('q', q.search);
    if (q.transportType) p.set('transport', q.transportType);
    if (q.onlineRule) p.set('online', q.onlineRule);
    router.replace(`${demoHrefs.profiles}${p.size ? `?${p}` : ''}`, { scroll: false });
  }
  return (
    <>
      <DocumentTitle text="Device profiles — IoT Theme" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <DeviceProfileListView hrefs={demoHrefs} initialQuery={initial} onQueryChange={sync} onCreated={(p) => router.push(demoHrefs.profile(p.profileId))} />
      </div>
    </>
  );
}
