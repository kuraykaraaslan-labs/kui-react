'use client';
import { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFetchArgs, DataTableFetchResult, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill } from '../format';
import { SETTINGS_JOB_STATES, type SettingsJob, type SettingsJobState } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { NewJobDrawer } from './NewJobDrawer';
import { useSettingsText } from './SettingsText';

type Row = SettingsJob & Record<string, unknown>;

const STATE_VARIANT: Record<SettingsJobState, 'success' | 'warning' | 'info' | 'neutral'> = { running: 'info', paused: 'warning', cancelled: 'neutral', completed: 'success' };

/** A job's state in words, with "Waiting for the last devices" while a finished job still has devices to answer. */
export function JobStateBadge({ job, messages }: { job: Pick<SettingsJob, 'state' | 'settling'>; messages?: SettingsMessagesInput | SettingsMessages }) {
  const { m } = useSettingsText(messages as SettingsMessagesInput);
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-job-state={job.state}>
      <Badge size="sm" variant={STATE_VARIANT[job.state]} dot={job.state === 'running'}>{m.fleet.jobState[job.state]}</Badge>
      {job.settling && <Badge size="sm" variant="neutral">{m.fleet.settling}</Badge>}
    </span>
  );
}

export interface JobsViewProps {
  adapter: SettingsFleetAdapter;
  /** Where a job's page is. */
  jobHref: (jobId: string) => string;
  onOpenJob?: (jobId: string) => void;
  baselinesHref?: string;
  onOpenBaselines?: () => void;
  /** Open the New job drawer on this baseline (a deep link from the baselines page). */
  startWithBaseline?: string;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * JobsView — the tenant's bulk settings jobs: one DataTable (filter by status, newest first, paged by the host) with each job's status and
 * how far its waves have gone; a row opens the job's page. The header holds "Baselines" (the baselines page) and "New job" (a drawer).
 */
export function JobsView({ adapter, jobHref, onOpenJob, baselinesHref, onOpenBaselines, startWithBaseline, messages, locale, className }: JobsViewProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const [canManage, setCanManage] = useState(false);
  const [creating, setCreating] = useState(!!startWithBaseline);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchPage = useCallback(async (args: DataTableFetchArgs): Promise<DataTableFetchResult<Row>> => {
    const raw = args.filterValues.state;
    const state = Array.isArray(raw) ? (raw as SettingsJobState[]) : typeof raw === 'string' && raw ? [raw as SettingsJobState] : undefined;
    const r = await adapter.jobs.list({ page: Math.max(0, args.page - 1), pageSize: args.pageSize, state, dir: args.sort[0]?.dir ?? 'desc' }, args.signal);
    setCanManage(!!r.canManage);
    return { rows: r.data as Row[], total: r.total };
  }, [adapter]);

  const when = (ms: number) => new Date(ms).toLocaleString(lang);
  const columns: Column<Row>[] = [
    { key: 'name', header: m.fleet.name, render: (r) => <span className="font-medium text-text-primary">{r.name}</span> },
    { key: 'state', header: m.fleet.state, render: (r) => <JobStateBadge job={r} messages={m} /> },
    {
      key: 'progress', header: m.fleet.progress, hideBelow: 'sm',
      render: (r) => `${fill(m.fleet.wave, { n: Math.min(r.currentWave + 1, r.waveSizes.length) })} / ${r.waveSizes.length}`,
    },
    { key: 'devices', header: m.fleet.devices, hideBelow: 'sm', render: (r) => String(r.waveSizes.reduce((a, b) => a + b, 0)) },
    { key: 'createdAt', header: m.fleet.created, sortable: true, hideBelow: 'md', render: (r) => when(r.createdAt) },
  ];
  const filterFields: DataTableFilterField<Row>[] = [{
    id: 'state', label: m.fleet.state, type: 'checkboxes', options: SETTINGS_JOB_STATES.map((s) => ({ value: s, label: m.fleet.jobState[s] })),
  }];

  return (
    <div className={cn('space-y-4', className)} data-settings-jobs="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary">{m.fleet.jobsTitle}</h1>
          <p className="text-sm text-text-secondary">{m.fleet.jobsSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(baselinesHref || onOpenBaselines) && (
            baselinesHref ? <Button as="a" href={baselinesHref} variant="outline">{m.fleet.baselinesButton}</Button> : <Button variant="outline" onClick={onOpenBaselines}>{m.fleet.baselinesButton}</Button>
          )}
          {canManage && <Button onClick={() => setCreating(true)}><FontAwesomeIcon icon={faPlus} className="mr-1.5" aria-hidden="true" />{m.fleet.newJob}</Button>}
        </div>
      </header>
      {notice && <Callout variant="tip">{notice}</Callout>}
      <DataTable<Row>
        columns={columns}
        mode="server"
        fetchPage={fetchPage}
        reloadKey={reload}
        caption={m.fleet.jobsTitle}
        searchable={false}
        rowId={(r) => r.jobId}
        filterFields={filterFields}
        defaultSort={[{ key: 'createdAt', dir: 'desc' }]}
        onRowClick={(r) => (onOpenJob ? onOpenJob(r.jobId) : undefined)}
        rowActions={[{ id: 'open', label: m.tab.open, href: (r) => jobHref(r.jobId) }]}
        emptyMessage={(
          <div className="py-6 text-center">
            <p className="font-medium text-text-primary">{m.fleet.noJobs}</p>
            <p className="text-sm text-text-secondary">{m.fleet.noJobsHint}</p>
          </div>
        )}
      />
      {creating && <NewJobDrawer
        open
        onClose={() => setCreating(false)}
        adapter={adapter}
        baselineId={startWithBaseline}
        onCreated={(job) => { setCreating(false); setNotice(m.fleet.started); setReload((n) => n + 1); onOpenJob?.(job.jobId); }}
        messages={m}
        locale={lang}
      />}
    </div>
  );
}
