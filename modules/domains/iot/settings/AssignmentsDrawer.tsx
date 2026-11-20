'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { NewSettingsAssignment, SettingsAssignment, SettingsBaseline, SettingsJobPlan } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { SettingsFleetAdapter } from './settings-adapter';
import { errorText } from './SectionEditorDrawer';
import { useSettingsText } from './SettingsText';

export interface AssignmentsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Must carry `assignments`; the drawer shows nothing without them. */
  adapter: SettingsFleetAdapter;
  messages?: SettingsMessagesInput;
  locale?: string;
}

type Row = SettingsAssignment & Record<string, unknown>;
type Target = 'PROFILE' | 'ALL';

const controlCls = 'block w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

/**
 * AssignmentsDrawer — baselines kept on a device profile or on every device: a DataTable of the assignments (the baseline, its devices,
 * what it does when a device differs, and its counts: devices, differ now, changed by a person, need a person, sent again), "New
 * assignment" above it (a baseline, a profile or every device; "Check" asks for the plan of the first job and stores nothing; "Assign"
 * asks through the one ConfirmDialog, with the number of devices typed back when it is every device), a row's Re-attach (a job over the
 * devices a person changed since) and Remove, each through the ConfirmDialog. Save / Apply only: nothing is stored until a confirm. Without
 * the right to manage jobs the drawer is read-only.
 */
export function AssignmentsDrawer({ open, onClose, adapter, messages, locale }: AssignmentsDrawerProps) {
  const { m } = useSettingsText(messages, locale);
  const api = adapter.assignments;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [baselines, setBaselines] = useState<SettingsBaseline[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState<Target>('PROFILE');
  const [profile, setProfile] = useState('');
  const [confirmDangerous, setConfirmDangerous] = useState(false);
  const [checked, setChecked] = useState<{ for: string; plan: SettingsJobPlan | null } | null>(null);
  const [asking, setAsking] = useState<'assign' | { remove: Row } | { reattach: Row } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'tip' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const r = await api.list();
      setRows(r.data as Row[]);
      setCanManage(!!r.canManage);
    } catch (e) {
      setNotice({ tone: 'danger', text: errorText(m, e) });
    }
  }, [api, m]);

  useEffect(() => {
    if (!open || !api) return;
    const ac = new AbortController();
    const failed = (e: unknown) => { if (!ac.signal.aborted) setNotice({ tone: 'danger', text: errorText(m, e) }); };
    api.list(ac.signal).then((r) => { setRows(r.data as Row[]); setCanManage(!!r.canManage); }, failed);
    adapter.baselines.list({ page: 0, pageSize: 100, dir: 'asc' }, ac.signal).then((r) => setBaselines(r.data), failed);
    adapter.profiles(ac.signal).then(setProfiles, failed);
    return () => ac.abort();
  }, [open, api, adapter, m]);

  const input = useMemo((): NewSettingsAssignment | null => {
    if (!baseline) return null;
    if (target === 'PROFILE') return profile ? { baselineId: baseline, target: { type: 'PROFILE', profileId: profile } } : null;
    return { baselineId: baseline, target: { type: 'ALL' } };
  }, [baseline, target, profile]);
  // a plan is shown only for the choices it was made for; a change asks for a new check
  const inputKey = JSON.stringify(input);
  const plan = checked && checked.for === inputKey ? checked : null;

  async function check() {
    if (!api || !input) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await api.create(input, { dryRun: true });
      if ('dryRun' in r) setChecked({ for: inputKey, plan: r.plan });
    } catch (e) {
      setNotice({ tone: 'danger', text: errorText(m, e) });
    } finally {
      setBusy(false);
    }
  }

  async function act() {
    if (!api || !asking) return;
    setBusy(true);
    try {
      if (asking === 'assign') {
        if (!input || !plan) return;
        const r = await api.create({
          ...input, ...(plan.plan?.needsConfirm ? { confirm: true } : {}), ...(input.target.type === 'ALL' ? { confirmCount: plan.plan?.devices ?? 0 } : {}),
        }, {});
        setNotice({ tone: 'tip', text: 'job' in r && r.job ? m.assign.saved : m.assign.savedNoJob });
        setChecked(null);
        setBaseline('');
        setProfile('');
        setConfirmDangerous(false);
      } else if ('remove' in asking) {
        await api.remove(asking.remove.assignmentId);
        setNotice({ tone: 'tip', text: m.assign.removed });
      } else {
        await api.reattach(asking.reattach.assignmentId, { confirm: true });
        setNotice({ tone: 'tip', text: m.assign.reattached });
      }
      setAsking(null);
      await load();
    } catch (e) {
      setAsking(null);
      setNotice({ tone: 'danger', text: errorText(m, e) });
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Row>[] = [
    { key: 'baselineName', header: m.assign.baseline, render: (r) => <span className="font-medium text-text-primary">{r.baselineName ?? m.common.none}</span> },
    { key: 'target', header: m.assign.target, render: (r) => (r.targetType === 'ALL' ? m.assign.allDevices : r.profileName ?? m.common.none) },
    { key: 'driftPolicy', header: m.assign.policy, hideBelow: 'sm', render: (r) => (r.driftPolicy === 'ENFORCE' ? m.assign.policyEnforce : m.assign.policyReport) },
    { key: 'members', header: m.assign.devices, render: (r) => r.counts.members },
    { key: 'drifting', header: m.assign.drifting, hideBelow: 'md', render: (r) => r.counts.drifting },
    { key: 'detached', header: m.assign.detached, hideBelow: 'md', render: (r) => r.counts.detached },
    { key: 'blocked', header: m.assign.blocked, hideBelow: 'md', render: (r) => (r.counts.blocked ? <span className="text-warning-fg">{r.counts.blocked}</span> : 0) },
    { key: 'enforcements', header: m.assign.enforced, hideBelow: 'lg', render: (r) => r.counts.enforcements },
    {
      key: 'status', header: m.assign.status, hideBelow: 'sm',
      render: (r) => (r.jobRunning ? m.assign.jobRunning : r.lastError ? fill(m.assign.lastError, { reason: (m.errors as Record<string, string>)[r.lastError] ?? r.lastError }) : m.assign.upToDate),
    },
  ];

  const radio = (value: Target, label: string) => (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
      <input type="radio" name="assignment-target" value={value} checked={target === value} onChange={() => setTarget(value)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
  const needsConfirm = !!plan?.plan?.needsConfirm;
  const ready = !!plan && (!needsConfirm || confirmDangerous);
  const allPhrase = input?.target.type === 'ALL' && plan?.plan ? String(plan.plan.devices) : undefined;

  const dialog = asking === 'assign'
    ? {
      title: m.assign.assignTitle, message: fill(m.assign.assignMessage, { n: plan?.plan?.devices ?? 0 }), confirmLabel: m.assign.save, tone: (needsConfirm ? 'danger' : 'default') as 'danger' | 'default',
      phrase: allPhrase, phraseLabel: allPhrase ? fill(m.assign.allPhraseLabel, { phrase: allPhrase }) : undefined,
    }
    : asking && 'remove' in asking
      ? { title: m.assign.removeTitle, message: m.assign.removeMessage, confirmLabel: m.assign.remove, tone: 'danger' as const }
      : asking && 'reattach' in asking
        ? { title: m.assign.reattachTitle, message: fill(m.assign.reattachMessage, { n: asking.reattach.counts.detached }), confirmLabel: m.assign.reattach, tone: 'default' as const }
        : null;

  return (
    <Drawer open={open} onClose={onClose} title={m.assign.title} closeLabel={m.common.close} className="w-full sm:max-w-3xl"
      footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>{m.common.close}</Button></div>}>
      <div className="space-y-4" data-settings-assignments="">
        <p className="text-sm text-text-secondary">{m.assign.subtitle}</p>
        {notice && <Callout variant={notice.tone} role={notice.tone === 'danger' ? 'alert' : undefined}>{notice.text}</Callout>}
        {canManage && (
          <section className="space-y-3 rounded-lg border border-border p-3" data-assignment-new="">
            <h3 className="text-sm font-medium text-text-primary">{m.assign.newTitle}</h3>
            <div>
              <label htmlFor="assignment-baseline" className="mb-1 block text-sm font-medium text-text-primary">{m.assign.baseline}</label>
              <select id="assignment-baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} className={controlCls}>
                <option value="">{m.common.none}</option>
                {baselines.map((b) => <option key={b.baselineId} value={b.baselineId}>{b.name}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-text-primary">{m.assign.target}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">{radio('PROFILE', m.assign.targetProfile)}{radio('ALL', m.assign.targetAll)}</div>
            </fieldset>
            {target === 'PROFILE' && (
              <div>
                <label htmlFor="assignment-profile" className="mb-1 block text-sm font-medium text-text-primary">{m.assign.profile}</label>
                <select id="assignment-profile" value={profile} onChange={(e) => setProfile(e.target.value)} className={controlCls}>
                  <option value="">{m.common.none}</option>
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {plan && (
              <Callout variant={needsConfirm ? 'warning' : 'info'}>
                <p>{plan.plan ? fill(m.assign.plan, { n: plan.plan.devices }) : m.assign.planNone}</p>
                {needsConfirm && (
                  <>
                    <p className="mt-1">{m.assign.planDangerous}</p>
                    <label className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
                      <input type="checkbox" checked={confirmDangerous} onChange={(e) => setConfirmDangerous(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
                      {m.assign.confirmDangerous}
                    </label>
                  </>
                )}
              </Callout>
            )}
            <p className="text-xs text-text-secondary">{m.assign.enforceHint}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => void check()} disabled={!input || busy} loading={busy && !asking}>{m.assign.check}</Button>
              <Button onClick={() => setAsking('assign')} disabled={!ready || busy}>{m.assign.save}</Button>
            </div>
          </section>
        )}
        {rows && (
          <DataTable<Row>
            columns={columns}
            rows={rows}
            caption={m.assign.table}
            rowId={(r) => r.assignmentId}
            rowActions={canManage ? [
              { id: 'reattach', label: m.assign.reattach, onClick: (r: Row) => setAsking({ reattach: r }), hidden: (r: Row) => r.counts.detached === 0 },
              { id: 'remove', label: m.assign.remove, destructive: true, group: 'danger', onClick: (r: Row) => setAsking({ remove: r }) },
            ] : undefined}
            emptyMessage={(
              <div className="py-6 text-center">
                <p className="font-medium text-text-primary">{m.assign.empty}</p>
                <p className="text-sm text-text-secondary">{m.assign.emptyHint}</p>
              </div>
            )}
          />
        )}
      </div>
      <ConfirmDialog
        open={!!dialog}
        tone={dialog?.tone === 'danger' ? 'danger' : undefined}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={m.common.cancel}
        phrase={dialog && 'phrase' in dialog ? dialog.phrase : undefined}
        phraseLabel={dialog && 'phraseLabel' in dialog ? dialog.phraseLabel : undefined}
        busy={busy}
        onCancel={() => setAsking(null)}
        onConfirm={() => void act()}
      />
    </Drawer>
  );
}
