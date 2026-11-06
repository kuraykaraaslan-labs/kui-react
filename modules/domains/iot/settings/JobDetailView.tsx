'use client';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Spinner } from '@/modules/ui/Spinner';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFetchArgs, DataTableFetchResult, DataTableFilterField } from '@/modules/ui/Table/types';
import { fill } from '../format';
import { SETTINGS_TARGET_STATES, type SettingsJobTarget, type SettingsJobView, type SettingsJobWave, type SettingsTargetState } from '../types/settings';
import type { SettingsMessages, SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { errorText } from './SectionEditorDrawer';
import { JobStateBadge } from './JobsView';
import { titleCase } from './settings-schema';
import { useSettingsText } from './SettingsText';

type WaveRow = SettingsJobWave & Record<string, unknown> & { id: string };
type TargetRow = SettingsJobTarget & Record<string, unknown>;

const pct = (n: number) => Math.round(n * 1000) / 10;

/** What happened to one device of a job, per section, in words. */
export function targetOutcome(m: SettingsMessages, t: Pick<SettingsJobTarget, 'detail' | 'state'>): string {
  const parts = Object.entries(t.detail ?? {}).map(([section, s]) => {
    const what = s.outcome === 'waiting' ? m.fleet.waiting : (m.fleet.targetState as Record<string, string>)[s.outcome] ?? s.outcome;
    const why = s.reason ? ` (${m.fleet.skipReason[s.reason] ?? (m.errors as Record<string, string>)[s.reason] ?? s.reason})` : '';
    return `${m.sections[section] ?? titleCase(section)}: ${what}${why}`;
  });
  return parts.join(' · ') || m.fleet.targetState[t.state];
}

export interface JobDetailViewProps {
  adapter: SettingsFleetAdapter;
  jobId: string;
  /** How often to read again while the job runs or devices still answer (ms). Default 10000; 0 never. */
  pollMs?: number;
  backHref?: string;
  /** Where a device's page is (its name links there). */
  deviceHref?: (deviceId: string) => string;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * JobDetailView — one bulk settings job: its status, why it paused (a person, a wave that failed its check with the shares, a wave nobody
 * answered), Pause / Resume / Cancel (resuming past a failed check says what it means and is recorded; cancelling says that changed devices
 * keep their settings), the waves with their counters and results, and every device with what happened to each of its sections (DataTable
 * with status and wave filters, paged by the host). Reads again every few seconds while the job runs.
 */
export function JobDetailView({ adapter, jobId, pollMs = 10_000, backHref, deviceHref, messages, locale, className }: JobDetailViewProps) {
  const { m } = useSettingsText(messages, locale);
  const [view, setView] = useState<(SettingsJobView & { canManage?: boolean }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [asking, setAsking] = useState<'cancel' | 'override' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    adapter.jobs.get(jobId, ac.signal).then((v) => { setView(v); setError(null); }, (e) => { if (!ac.signal.aborted) setError(errorText(m, e)); });
    return () => ac.abort();
  }, [adapter, jobId, tick, m]);
  const live = !!view && (view.job.state === 'running' || view.job.settling);
  useEffect(() => {
    if (!pollMs || !live) return;
    const id = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setTick((t) => t + 1); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, live]);

  const fetchTargets = useCallback(async (args: DataTableFetchArgs): Promise<DataTableFetchResult<TargetRow>> => {
    const s = args.filterValues.state;
    const state = Array.isArray(s) ? (s as SettingsTargetState[]) : undefined;
    const w = args.filterValues.wave;
    const wave = typeof w === 'string' && w !== '' ? [Number(w)] : undefined;
    const r = await adapter.jobs.targets(jobId, { page: Math.max(0, args.page - 1), pageSize: args.pageSize, state, wave, dir: args.sort[0]?.dir ?? 'asc' }, args.signal);
    return { rows: r.data as TargetRow[], total: r.total };
  }, [adapter, jobId]);

  async function act(kind: 'pause' | 'resume' | 'cancel') {
    setBusy(true);
    try {
      await adapter.jobs[kind](jobId);
      setAsking(null);
      setTick((t) => t + 1);
    } catch (e) {
      setAsking(null);
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return error
      ? <Callout variant="danger" className={className}><p>{error}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>{m.common.retry}</Button></Callout>
      : <div className={cn('flex justify-center p-6', className)} role="status" aria-label={m.common.loading}><Spinner label={null} /></div>;
  }
  const { job, waves } = view;
  const last = [...waves].reverse().find((w) => w.verdict && w.verdict !== 'ok');
  const gate = job.pauseReason === 'gate_failed' ? waves[job.currentWave] : undefined;
  const shares = (w?: SettingsJobWave) => {
    const c = w?.counters;
    const answered = c ? c.applied + c.reverted + c.rejected : 0;
    return { applied: answered ? pct(c!.applied / answered) : 0, reverted: answered ? pct(c!.reverted / answered) : 0 };
  };
  const waveRows: WaveRow[] = waves.map((w) => ({ ...w, id: String(w.wave) }));
  const waveColumns: Column<WaveRow>[] = [
    { key: 'wave', header: m.fleet.waveColumn, sortable: true, searchable: false, render: (r) => fill(m.fleet.wave, { n: r.wave + 1 }) },
    { key: 'size', header: m.fleet.size, sortable: true, searchable: false, render: (r) => String(r.size) },
    { key: 'applied', header: m.fleet.applied, sortable: true, searchable: false, sortValue: (r) => r.counters.applied, render: (r) => String(r.counters.applied) },
    { key: 'reverted', header: m.fleet.reverted, sortable: true, searchable: false, sortValue: (r) => r.counters.reverted, render: (r) => String(r.counters.reverted) },
    { key: 'rejected', header: m.fleet.rejected, hideBelow: 'sm', sortable: true, searchable: false, sortValue: (r) => r.counters.rejected, render: (r) => String(r.counters.rejected) },
    { key: 'offline', header: m.fleet.offline, hideBelow: 'sm', render: (r) => String(r.counters.offline + r.counters.skipped) },
    { key: 'waiting', header: m.fleet.waiting, hideBelow: 'md', render: (r) => String(r.counters.queued + r.counters.sent) },
    {
      key: 'verdict', header: m.fleet.verdict,
      render: (r) => (r.overridden ? m.fleet.overridden : r.verdict === 'ok' ? m.fleet.verdictOk : r.verdict === 'gate_failed' ? m.fleet.verdictFailed
        : r.verdict === 'no_data' ? m.fleet.verdictNoData : r.wave === job.currentWave && job.state === 'running' ? m.fleet.current : m.common.none),
    },
  ];
  const targetColumns: Column<TargetRow>[] = [
    {
      key: 'name', header: m.fleet.device,
      render: (r) => (deviceHref && r.name ? <a href={deviceHref(r.deviceId)} className="font-medium text-primary hover:underline">{r.name}</a> : <span className="font-medium">{r.name ?? m.fleet.deviceGone}</span>),
    },
    { key: 'model', header: m.fleet.model, hideBelow: 'sm', render: (r) => r.model ?? m.common.none },
    { key: 'wave', header: m.fleet.waveColumn, sortable: true, render: (r) => fill(m.fleet.wave, { n: r.wave + 1 }) },
    { key: 'state', header: m.fleet.state, render: (r) => m.fleet.targetState[r.state] },
    { key: 'outcome', header: m.fleet.outcome, hideBelow: 'md', render: (r) => targetOutcome(m, r) },
  ];
  const targetFilters: DataTableFilterField<TargetRow>[] = [
    { id: 'state', label: m.fleet.state, type: 'checkboxes', options: SETTINGS_TARGET_STATES.map((s) => ({ value: s, label: m.fleet.targetState[s] })) },
    { id: 'wave', label: m.fleet.waveColumn, type: 'select', options: waves.map((w) => ({ value: String(w.wave), label: fill(m.fleet.wave, { n: w.wave + 1 }) })) },
  ];
  const can = !!view.canManage;
  const finished = job.state === 'cancelled' || job.state === 'completed';

  return (
    <div className={cn('space-y-4', className)} data-settings-job={job.jobId}>
      {backHref && <a href={backHref} className="text-sm text-text-secondary hover:text-text-primary">← {m.fleet.back}</a>}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold text-text-primary">{job.name}</h1>
          <JobStateBadge job={job} messages={m} />
        </div>
        {can && !finished && (
          <div className="flex flex-wrap gap-2">
            {job.state === 'running' && <Button variant="outline" onClick={() => void act('pause')} disabled={busy}>{m.fleet.pause}</Button>}
            {job.state === 'paused' && (
              <Button variant="outline" onClick={() => (job.pauseReason === 'gate_failed' ? setAsking('override') : void act('resume'))} disabled={busy}>
                {job.pauseReason === 'gate_failed' ? m.fleet.resumeOverride : m.fleet.resume}
              </Button>
            )}
            <Button variant="danger" onClick={() => setAsking('cancel')} disabled={busy}>{m.fleet.cancel}</Button>
          </div>
        )}
      </header>
      {error && <Callout variant="danger">{error}</Callout>}
      {job.state === 'paused' && job.pauseReason === 'manual' && <Callout variant="info">{m.fleet.pausedManual}</Callout>}
      {job.state === 'paused' && job.pauseReason === 'gate_failed' && (
        <Callout variant="warning">{fill(m.fleet.pausedGate, { n: job.currentWave + 1, ...shares(gate) })}</Callout>
      )}
      {job.state === 'paused' && job.pauseReason === 'no_data' && <Callout variant="warning">{fill(m.fleet.pausedNoData, { n: job.currentWave + 1 })}</Callout>}
      <DataTable<WaveRow> columns={waveColumns} rows={waveRows} mode="paginated" variant="plain" title={m.fleet.waveTable} caption={m.fleet.waveTable} rowId={(r) => r.id} />
      <DataTable<TargetRow>
        columns={targetColumns}
        mode="server"
        fetchPage={fetchTargets}
        reloadKey={tick}
        title={m.fleet.targets}
        caption={m.fleet.targetsTable}
        searchable={false}
        rowId={(r) => r.deviceId}
        filterFields={targetFilters}
        defaultSort={[{ key: 'wave', dir: 'asc' }]}
        renderExpanded={(r) => <p className="text-sm text-text-secondary">{targetOutcome(m, r)}</p>}
      />
      <ConfirmDialog
        open={asking === 'cancel'}
        tone="danger"
        title={m.fleet.cancelTitle}
        message={m.fleet.cancelMessage}
        confirmLabel={m.fleet.cancel}
        cancelLabel={m.common.back}
        busy={busy}
        onCancel={() => setAsking(null)}
        onConfirm={() => void act('cancel')}
      />
      <ConfirmDialog
        open={asking === 'override'}
        tone="warning"
        title={m.fleet.resumeOverrideTitle}
        message={fill(m.fleet.resumeOverrideMessage, { n: job.currentWave + 1, ...shares(gate ?? last) })}
        confirmLabel={m.fleet.resumeOverride}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsking(null)}
        onConfirm={() => void act('resume')}
      />
    </div>
  );
}
