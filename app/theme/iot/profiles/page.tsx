'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { DeviceProfileListView } from '@/modules/domains/iot/profile/DeviceProfileListView';
import { PROFILE_SORT_KEYS, type ProfileListQuery } from '@/modules/domains/iot/api/adapter';
import { pageSizeFromParam, sortFromParam, sortToParam } from '@/modules/domains/iot/api/list-table';
import { ONLINE_RULES, type OnlineRule, type ProfileTransport } from '@/modules/domains/iot/types/profile';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

/** /theme/iot/profiles — a thin page over `DeviceProfileListView` (phase 01 §1.4); the filters, the sort and the rows per page live in the URL. */
export default function DeviceProfilesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const transport = sp.get('transport') as ProfileTransport | null;
  const online = sp.get('online') as OnlineRule | null;
  const initial: Partial<ProfileListQuery> = {
    page: Number(sp.get('page')) || 1,
    pageSize: pageSizeFromParam(sp.get('size')),
    sort: sortFromParam(sp.get('sort'), PROFILE_SORT_KEYS),
    search: sp.get('q') ?? undefined,
    // a built-in or a polled protocol id (the host lists them)
    transportType: transport && /^(?:[A-Z][A-Z0-9_]{0,31}|[a-z][a-z0-9_]{0,31})$/.test(transport) ? transport : undefined,
    onlineRule: online && ONLINE_RULES.includes(online) ? online : undefined,
  };
  function sync(q: ProfileListQuery) {
    const p = new URLSearchParams();
    if (q.page > 1) p.set('page', String(q.page));
    if (q.pageSize !== 20) p.set('size', String(q.pageSize));
    if (q.sort) p.set('sort', sortToParam(q.sort)!);
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
