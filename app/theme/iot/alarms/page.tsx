'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlarmListView } from '@/modules/domains/iot/alarm/AlarmListView';
import { ALARM_SORT_KEYS, type AlarmListQuery, type AlarmStatusFilter } from '@/modules/domains/iot/api/adapter';
import { pageSizeFromParam, sortFromParam, sortToParam } from '@/modules/domains/iot/api/list-table';
import { isAlarmSeverity } from '@/modules/domains/iot/alarm/alarm-severity';
import { DocumentTitle } from '@/libs/utils/DocumentTitle';
import { demoHrefs } from '../_demo/demo-hrefs';

const STATUSES: AlarmStatusFilter[] = ['active', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'any'];

/** /theme/iot/alarms — a thin page over `AlarmListView` (phase 03 §3.2); the filters, the sort and the rows per page live in the URL. */
export default function AlarmsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get('status') as AlarmStatusFilter | null;
  const initial: Partial<AlarmListQuery> = {
    page: Number(sp.get('page')) || 1,
    pageSize: pageSizeFromParam(sp.get('size')),
    sort: sortFromParam(sp.get('sort'), ALARM_SORT_KEYS),
    status: status && STATUSES.includes(status) ? status : 'active',
    severity: (sp.get('severity') ?? '').split(',').filter(isAlarmSeverity),
    search: sp.get('q') ?? '',
  };
  function sync(q: AlarmListQuery) {
    const p = new URLSearchParams();
    if (q.page > 1) p.set('page', String(q.page));
    if (q.pageSize !== 20) p.set('size', String(q.pageSize));
    if (q.sort) p.set('sort', sortToParam(q.sort)!);
    if (q.status && q.status !== 'active') p.set('status', q.status);
    if (q.severity?.length) p.set('severity', q.severity.join(','));
    if (q.search) p.set('q', q.search);
    router.replace(`/theme/iot/alarms${p.size ? `?${p}` : ''}`, { scroll: false });
  }
  return (
    <>
      <DocumentTitle text="Alarms — IoT Theme" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <AlarmListView hrefs={demoHrefs} initialQuery={initial} onQueryChange={sync} />
      </div>
    </>
  );
}
