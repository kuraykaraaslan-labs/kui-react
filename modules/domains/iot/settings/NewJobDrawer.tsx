'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFetchArgs, DataTableFetchResult, DataTableRowId } from '@/modules/ui/Table/types';
import { fill } from '../format';
import type { NewSettingsJob, SettingsBaseline, SettingsJob, SettingsJobPlan, SettingsModel } from '../types/settings';
import type { SettingsMessagesInput } from './messages';
import type { SettingsDeviceOption, SettingsFleetAdapter } from './settings-adapter';
import { errorText } from './SectionEditorDrawer';
import { titleCase } from './settings-schema';
import { useSettingsText } from './SettingsText';

export interface NewJobDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter: SettingsFleetAdapter;
  /** Start from this baseline. */
  baselineId?: string;
  onCreated: (job: SettingsJob) => void;
  messages?: SettingsMessagesInput;
  locale?: string;
}

type Target = 'models' | 'profile' | 'devices';
type DeviceRow = SettingsDeviceOption & Record<string, unknown>;

const controlCls = 'block w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
const newKey = () => `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * NewJobDrawer — a bulk settings job: a baseline, the devices (every device of some models, of a profile, or devices picked from a
 * DataTable), the waves (1 %, 10 %, the rest by default) and their checks, and what to do when another job is changing the same device.
 * "Check" asks the server for the plan (devices, waves, models that lack a section and are skipped, whether it can cut devices off) and
 * stores nothing; "Start the job" asks through the one ConfirmDialog (with START typed when the job can cut devices off). One key per
 * opening makes a double click start one job. Mount it when it opens: it starts empty (or on `baselineId`).
 */
export function NewJobDrawer({ open, onClose, adapter, baselineId, onCreated, messages, locale }: NewJobDrawerProps) {
  const { m } = useSettingsText(messages, locale);
  const [baselines, setBaselines] = useState<SettingsBaseline[]>([]);
  const [models, setModels] = useState<SettingsModel[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState('');
  const [baseline, setBaseline] = useState(baselineId ?? '');
  const [target, setTarget] = useState<Target>('models');
  const [chosenModels, setChosenModels] = useState<string[]>([]);
  const [profile, setProfile] = useState('');
  const [devices, setDevices] = useState<DataTableRowId[]>([]);
  const [customWaves, setCustomWaves] = useState(false);
  const [waves, setWaves] = useState('5, 25');
  const [minApplied, setMinApplied] = useState(95);
  const [maxReverted, setMaxReverted] = useState(1);
  const [onConflict, setOnConflict] = useState<'queue' | 'skip'>('queue');
  const [checked, setChecked] = useState<{ for: string; plan: SettingsJobPlan } | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);

  /** A baseline picked: the job takes its name and its models unless the person already chose them. */
  const pick = (id: string) => {
    setBaseline(id);
    const b = baselines.find((x) => x.baselineId === id);
    if (!b) return;
    setName((cur) => cur || b.name);
    setChosenModels((cur) => (cur.length ? cur : b.models));
  };
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const failed = (e: unknown) => { if (!ac.signal.aborted) setError(errorText(m, e)); };
    adapter.baselines.list({ page: 0, pageSize: 100, dir: 'asc' }, ac.signal).then((r) => {
      setBaselines(r.data);
      const b = baselineId ? r.data.find((x) => x.baselineId === baselineId) : undefined;
      if (b) { setName((cur) => cur || b.name); setChosenModels((cur) => (cur.length ? cur : b.models)); }
    }, failed);
    adapter.models(ac.signal).then(setModels, failed);
    adapter.profiles(ac.signal).then(setProfiles, failed);
    return () => ac.abort();
  }, [open, adapter, baselineId, m]);

  const input = useMemo((): NewSettingsJob | null => {
    if (!baseline || !name.trim()) return null;
    const selector = target === 'models' ? (chosenModels.length ? { models: chosenModels } : null)
      : target === 'profile' ? (profile ? { profileId: profile } : null)
        : (devices.length ? { deviceIds: devices.map(String) } : null);
    if (!selector) return null;
    const percents = waves.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
    return {
      name: name.trim(), baselineId: baseline, selector, onConflict,
      ...(customWaves && percents.length ? { waves: { percent: percents.slice(0, 10) } } : {}),
      gates: { minApplied: Math.min(100, Math.max(0, minApplied)) / 100, maxReverted: Math.min(100, Math.max(0, maxReverted)) / 100 },
    };
  }, [baseline, name, target, chosenModels, profile, devices, waves, customWaves, minApplied, maxReverted, onConflict]);
  // a plan is shown only for the choices it was made for; a change to them asks for a new check
  const inputKey = JSON.stringify(input);
  const plan = checked && checked.for === inputKey ? checked.plan : null;

  const fetchDevices = useCallback(async (args: DataTableFetchArgs): Promise<DataTableFetchResult<DeviceRow>> => {
    const r = await adapter.devices({ search: args.search, page: Math.max(0, args.page - 1), pageSize: args.pageSize }, args.signal);
    return { rows: r.data as DeviceRow[], total: r.total };
  }, [adapter]);
  const deviceColumns: Column<DeviceRow>[] = [
    { key: 'name', header: m.fleet.device, render: (r) => r.name },
    { key: 'model', header: m.fleet.model, render: (r) => r.model ?? m.common.none },
  ];

  async function check() {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adapter.jobs.create(input, { dryRun: true });
      if ('dryRun' in r) setChecked({ for: inputKey, plan: r.plan });
    } catch (e) {
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!input || !plan) return;
    setBusy(true);
    try {
      const r = await adapter.jobs.create({ ...input, confirm: plan.needsConfirm || undefined }, { idempotencyKey: key });
      setAsking(false);
      if (!('dryRun' in r)) onCreated(r);
    } catch (e) {
      setAsking(false);
      setError(errorText(m, e));
    } finally {
      setBusy(false);
    }
  }

  const radio = (value: Target, label: string) => (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
      <input type="radio" name="job-target" value={value} checked={target === value} onChange={() => setTarget(value)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.fleet.newJob}
      closeLabel={m.common.close}
      className="w-full sm:max-w-2xl"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{m.common.cancel}</Button>
          {!plan
            ? <Button onClick={() => void check()} loading={busy} disabled={busy || !input}>{m.fleet.check}</Button>
            : <Button onClick={() => setAsking(true)} disabled={busy || plan.devices === 0}>{m.fleet.start}</Button>}
        </div>
      )}
    >
      <div className="space-y-4" data-new-job="">
        {error && <Callout variant="danger" role="alert">{error}</Callout>}
        <div>
          <label htmlFor="job-baseline" className="mb-1.5 block text-xs font-medium text-text-secondary">{m.fleet.baseline}</label>
          <select id="job-baseline" value={baseline} onChange={(e) => pick(e.target.value)} className={controlCls}>
            <option value="">-</option>
            {baselines.map((b) => <option key={b.baselineId} value={b.baselineId}>{b.name}</option>)}
          </select>
        </div>
        <Input id="job-name" label={m.fleet.jobName} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        <fieldset className="space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{m.fleet.target}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {radio('models', m.fleet.targetModels)}
            {radio('profile', m.fleet.targetProfile)}
            {radio('devices', m.fleet.targetDevices)}
          </div>
          {target === 'models' && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {models.length === 0 && <p className="text-sm text-text-secondary">{m.fleet.noModels}</p>}
              {models.map((x) => (
                <label key={x.model} className="inline-flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
                  <input type="checkbox" checked={chosenModels.includes(x.model)}
                    onChange={(e) => setChosenModels((c) => (e.target.checked ? [...c, x.model] : c.filter((v) => v !== x.model)))}
                    className="h-4 w-4 rounded accent-primary" />
                  {x.model} <span className="text-text-secondary">{fill(m.fleet.modelDevices, { n: x.devices })}</span>
                </label>
              ))}
            </div>
          )}
          {target === 'profile' && (
            <div>
              <label htmlFor="job-profile" className="mb-1.5 block text-xs font-medium text-text-secondary">{m.fleet.profile}</label>
              <select id="job-profile" value={profile} onChange={(e) => setProfile(e.target.value)} className={controlCls}>
                <option value="">-</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {target === 'devices' && (
            <>
              <p className="text-xs text-text-secondary">{fill(m.fleet.picked, { n: devices.length })}</p>
              <DataTable<DeviceRow>
                columns={deviceColumns}
                mode="server"
                fetchPage={fetchDevices}
                variant="plain"
                caption={m.fleet.pickDevices}
                searchable
                searchPlaceholder={m.fleet.searchDevices}
                rowId={(r) => r.deviceId}
                selectable
                selectedRowIds={devices}
                onSelectionChange={setDevices}
                pageSize={10}
              />
            </>
          )}
        </fieldset>
        <fieldset className="space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{m.fleet.waves}</legend>
          <p className="text-xs text-text-secondary">{m.fleet.wavesHint}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
            <input type="radio" name="job-waves" checked={!customWaves} onChange={() => setCustomWaves(false)} className="h-4 w-4 accent-primary" />{m.fleet.wavesDefault}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary sm:min-h-0">
            <input type="radio" name="job-waves" checked={customWaves} onChange={() => setCustomWaves(true)} className="h-4 w-4 accent-primary" />{m.fleet.wavesCustom}
          </label>
          {customWaves && <Input id="job-wave-sizes" label={m.fleet.wavesCustom} hint={m.fleet.wavesCustomHint} value={waves} onChange={(e) => setWaves(e.target.value)} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="job-min-applied" type="number" min={0} max={100} label={m.fleet.gateApplied} value={String(minApplied)} onChange={(e) => setMinApplied(Number(e.target.value))} />
            <Input id="job-max-reverted" type="number" min={0} max={100} label={m.fleet.gateReverted} value={String(maxReverted)} onChange={(e) => setMaxReverted(Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="job-conflict" className="mb-1.5 block text-xs font-medium text-text-secondary">{m.fleet.conflict}</label>
            <select id="job-conflict" value={onConflict} onChange={(e) => setOnConflict(e.target.value as 'queue' | 'skip')} className={controlCls}>
              <option value="queue">{m.fleet.conflictQueue}</option>
              <option value="skip">{m.fleet.conflictSkip}</option>
            </select>
          </div>
        </fieldset>
        {plan && <JobPlanSummary plan={plan} messages={m} />}
      </div>
      <ConfirmDialog
        open={asking}
        tone={plan?.needsConfirm ? 'danger' : 'default'}
        title={m.fleet.startTitle}
        message={plan ? fill(m.fleet.startMessage, { n: plan.devices }) : undefined}
        phrase={plan?.needsConfirm ? m.fleet.phrase : undefined}
        phraseLabel={plan?.needsConfirm ? fill(m.save.phraseLabel, { phrase: m.fleet.phrase }) : undefined}
        confirmLabel={m.fleet.start}
        cancelLabel={m.common.cancel}
        busy={busy}
        onCancel={() => setAsking(false)}
        onConfirm={() => void start()}
      />
    </Drawer>
  );
}

/** A job's plan in words: how many devices in how many waves, who is skipped and why, whether it can cut devices off. */
export function JobPlanSummary({ plan, messages }: { plan: SettingsJobPlan; messages?: SettingsMessagesInput }) {
  const { m } = useSettingsText(messages);
  return (
    <Callout variant={plan.needsConfirm ? 'warning' : 'info'} title={m.fleet.planTitle}>
      <ul className="list-disc space-y-0.5 pl-5" data-job-plan="">
        <li>{fill(m.fleet.planDevices, { n: plan.devices, waves: plan.waveSizes.length })}</li>
        {plan.waveSizes.length > 0 && <li>{fill(m.fleet.planWaves, { sizes: plan.waveSizes.join(' → ') })}</li>}
        {plan.skipped > 0 && <li>{fill(m.fleet.planSkipped, { n: plan.skipped })}</li>}
        {plan.excludedByModel > 0 && <li>{fill(m.fleet.planExcluded, { n: plan.excludedByModel })}</li>}
        {plan.coverage.map((c, i) => (
          <li key={i}>
            {fill(m.fleet.planModel, { model: c.model ?? m.common.none, fw: c.fw ?? m.common.none, n: c.devices })}
            {Object.entries(c.sections).filter(([, s]) => 'missing' in s).map(([id]) => <span key={id} className="block text-text-secondary">{fill(m.fleet.planMissing, { section: m.sections[id] ?? titleCase(id) })}</span>)}
          </li>
        ))}
        {plan.needsConfirm && <li className="font-medium">{m.fleet.planDangerous}</li>}
      </ul>
    </Callout>
  );
}
