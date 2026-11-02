'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { JobsView } from '@/modules/domains/iot/settings/JobsView';
import { BaselinesView } from '@/modules/domains/iot/settings/BaselinesView';
import { JobDetailView } from '@/modules/domains/iot/settings/JobDetailView';
import { demoFleetAdapter } from '../_demo/demo-settings';

const BASE = '/theme/iot/device-settings';
const jobHref = (id: string) => `${BASE}/job?id=${encodeURIComponent(id)}`;

/** The client halves of /theme/iot/device-settings (bulk jobs), …/baselines and …/job?id= over the demo fleet adapter. */
export function JobsScreen() {
  return <Suspense><JobsInner /></Suspense>;
}
function JobsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JobsView adapter={demoFleetAdapter()} jobHref={jobHref} onOpenJob={(id) => router.push(jobHref(id))} baselinesHref={`${BASE}/baselines`} startWithBaseline={sp.get('baseline') ?? undefined} />
    </div>
  );
}

export function BaselinesScreen() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <BaselinesView adapter={demoFleetAdapter()} jobsHref={BASE} onStartJob={(b) => router.push(`${BASE}?baseline=${encodeURIComponent(b.baselineId)}`)} />
    </div>
  );
}

export function JobScreen() {
  return <Suspense><JobInner /></Suspense>;
}
function JobInner() {
  const sp = useSearchParams();
  const id = sp.get('id') ?? '';
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JobDetailView adapter={demoFleetAdapter()} jobId={id} backHref={BASE} />
    </div>
  );
}
