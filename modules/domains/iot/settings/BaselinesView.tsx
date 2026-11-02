'use client';
import { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFetchArgs, DataTableFetchResult } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { SettingsBaseline } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { BaselineEditorDrawer } from './BaselineEditorDrawer';
import { errorText } from './SectionEditorDrawer';
import { titleCase } from './settings-schema';
import { useSettingsText } from './SettingsText';

type Row = SettingsBaseline & Record<string, unknown>;

export interface BaselinesViewProps {
  adapter: SettingsFleetAdapter;
  /** The header's way back to the jobs (a link or a callback). */
  jobsHref?: string;
  onOpenJobs?: () => void;
  /** "Start a job" on a baseline row. */
  onStartJob?: (b: SettingsBaseline) => void;
  messages?: SettingsMessagesInput;
  locale?: string;
  className?: string;
}

/**
 * BaselinesView — the tenant's baselines (named sets of settings for some models, applied in bulk by a job): one DataTable with search
 * and sort by name, paged by the host; a row opens the baseline's editor in a drawer, "New baseline" in the header opens an empty one, a
 * row's menu deletes it through the ConfirmDialog (jobs already started keep their own copy). Without the right to manage baselines the
 * page is read-only.
 */
export function BaselinesView({ adapter, jobsHref, onOpenJobs, onStartJob, messages, locale, className }: BaselinesViewProps) {
  const { m, locale: lang } = useSettingsText(messages, locale);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<SettingsBaseline | null | 'new'>(null);
  const [deleting, setDeleting] = useState<SettingsBaseline | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'tip' | 'danger'; text: string } | null>(null);

  const fetchPage = useCallback(async (args: DataTableFetchArgs): Promise<DataTableFetchResult<Row>> => {
    const r = await adapter.baselines.list({ page: Math.max(0, args.page - 1), pageSize: args.pageSize, search: args.search || undefined, dir: args.sort[0]?.dir ?? 'asc' }, args.signal);
    setCanManage(!!r.canManage);
    return { rows: r.data as Row[], total: r.total };
  }, [adapter]);

  const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang); };
  const columns: Column<Row>[] = [
    { key: 'name', header: m.fleet.name, sortable: true, render: (r) => <span className="font-medium text-text-primary">{r.name}</span> },
    { key: 'models', header: m.fleet.models, render: (r) => r.models.join(', ') || m.common.none },
    { key: 'sections', header: m.fleet.sections, hideBelow: 'sm', render: (r) => Object.keys(r.sections).map((s) => m.sections[s] ?? titleCase(s)).join(', ') || m.common.none },
    { key: 'updatedAt', header: m.fleet.updated, hideBelow: 'md', render: (r) => when(r.updatedAt) },
  ];

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await adapter.baselines.remove(deleting.baselineId);
      setDeleting(null);
      setReload((n) => n + 1);
    } catch (e) {
      setDeleting(null);
      setNotice({ tone: 'danger', text: errorText(m, e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('space-y-4', className)} data-settings-baselines="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary">{m.fleet.baselinesTitle}</h1>
          <p className="text-sm text-text-secondary">{m.fleet.baselinesSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(jobsHref || onOpenJobs) && (
            jobsHref ? <Button as="a" href={jobsHref} variant="outline">{m.fleet.jobsButton}</Button> : <Button variant="outline" onClick={onOpenJobs}>{m.fleet.jobsButton}</Button>
          )}
          {canManage && <Button onClick={() => setEditing('new')}><FontAwesomeIcon icon={faPlus} className="mr-1.5" aria-hidden="true" />{m.fleet.newBaseline}</Button>}
        </div>
      </header>
      {notice && <Callout variant={notice.tone}>{notice.text}</Callout>}
      <DataTable<Row>
        columns={columns}
        mode="server"
        fetchPage={fetchPage}
        reloadKey={reload}
        caption={m.fleet.baselinesTitle}
        rowId={(r) => r.baselineId}
        searchable
        defaultSort={[{ key: 'name', dir: 'asc' }]}
        onRowClick={(r) => setEditing(r)}
        rowActions={[
          { id: 'edit', label: canManage ? m.common.edit : m.tab.open, onClick: (r) => setEditing(r) },
          ...(onStartJob && canManage ? [{ id: 'job', label: m.fleet.newJob, onClick: (r: Row) => onStartJob(r) }] : []),
          ...(canManage ? [{ id: 'delete', label: m.fleet.delete, destructive: true, onClick: (r: Row) => setDeleting(r), group: 'danger' }] : []),
        ]}
        emptyMessage={(
          <div className="py-6 text-center">
            <p className="font-medium text-text-primary">{m.fleet.noBaselines}</p>
            <p className="text-sm text-text-secondary">{m.fleet.noBaselinesHint}</p>
          </div>
        )}
      />
      {editing !== null && <BaselineEditorDrawer
        key={editing === 'new' ? 'new' : editing.baselineId}
        open
        onClose={() => setEditing(null)}
        adapter={adapter}
        baseline={editing === 'new' ? null : editing}
        canManage={canManage}
        onSaved={() => { setEditing(null); setNotice({ tone: 'tip', text: m.fleet.saved }); setReload((n) => n + 1); }}
        messages={m}
        locale={lang}
      />}
      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        title={m.fleet.deleteTitle}
        message={deleting ? fill(m.fleet.deleteMessage, { name: deleting.name }) : undefined}
        confirmLabel={m.fleet.delete}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
