'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Checkbox } from '@/modules/ui/Checkbox';
import { ComboBox, type ComboBoxOption } from '@/modules/ui/ComboBox';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { COMMAND_BINDING_SORT_KEYS, errorMessage, IotApiError, type CommandBindingQuery } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { choiceOf, LIST_PAGE_SIZES, toIotSort } from '../api/list-table';
import { fill, formatDateTime, formatRelative } from '../format';
import type { IotMessages, IotMessagesInput } from '../messages';
import {
  COMMAND_BINDING_POSITIONS, COMMAND_BINDING_STATES, CONTROL_TIERS, type BindableCommand, type BindableKind, type CommandBinding, type CommandBindingProblem,
  type ControlTier, type EntityControl,
} from '../types/rpc';
import {
  draftComplete, draftOf, inputOf, paramRowsOf, sendsText, stateText, tierText, tierVariant, type BindingDraft, type ParamRow,
} from './entity-controls';

/**
 * RpcCommandBindingsDrawer — "Record controls" of one device (NB iot-rpc 04 §4.8): the records whose named controls reach this device
 * (a record's control → one of this device's catalog commands, or a set of its shared values). A full DataTable served by the host
 * (search, sortable columns, paging, filters: record type, tier, enabled, state); **New binding** (with `canManage`) and a row open the
 * binding editor. There is no Send / Test button (RPC-25): a control is sent from its record, the console tests the device.
 *
 * CommandBindingEditorDrawer — one binding: the record type and record, the control (its tier, confirmation and values in words), what
 * the device does (a command of its catalog this control may bind, or "Set device values" when the host allows it), the values sent in
 * a browser DataTable (each from a control value or fixed), the order among the control's devices, enabled and a note. **Check** asks
 * the host for the problems in words without saving; **Save** / Cancel only (nothing is saved on its own); **Delete** asks first.
 * `fixed` pins what the opener already knows (this device; or the record and its control). No id is typed or shown.
 */
export type RpcCommandBindingsDrawerProps = {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName?: string | null;
  /** The viewer may create, edit and delete bindings (the host judges every call again). */
  canManage?: boolean;
  /** How many bindings reach the device, after each read (the opener's "Record controls (n)"). */
  onCountChange?: (n: number) => void;
  messages?: IotMessagesInput;
  locale?: string;
};

const PAGE_SIZE = 20;

export function RpcCommandBindingsDrawer({ open, onClose, deviceId, deviceName, canManage = false, onCountChange, messages, locale }: RpcCommandBindingsDrawerProps) {
  const api = useIotAdapter().commandBindings;
  const { m, locale: lang, timeZone } = useIotText(messages, locale);
  const [rows, setRows] = useState<CommandBinding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kinds, setKinds] = useState<BindableKind[]>([]);
  const [editing, setEditing] = useState<{ binding: CommandBinding | null } | null>(null);
  const query = useRef<DataTableQuery | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.kinds(ctrl.signal).then(setKinds, () => setKinds([]));
    return () => ctrl.abort();
  }, [open, api]);

  const load = useCallback((q: DataTableQuery) => {
    if (!api) return;
    query.current = q;
    const mine = ++seq.current;
    const fv = q.filterValues ?? {};
    const enabled = choiceOf(fv.enabled, ['true', 'false'] as const);
    const req: CommandBindingQuery = {
      page: q.page, pageSize: q.pageSize, deviceId, search: q.search || undefined,
      sort: toIotSort(q.sort, COMMAND_BINDING_SORT_KEYS),
      targetKind: typeof fv.targetKind === 'string' && fv.targetKind ? fv.targetKind : undefined,
      tier: choiceOf(fv.tier, CONTROL_TIERS),
      enabled: enabled === undefined ? undefined : enabled === 'true',
      state: choiceOf(fv.state, COMMAND_BINDING_STATES),
    };
    setLoading(true);
    api.list(req).then((page) => {
      if (mine !== seq.current) return;
      setRows(page.items);
      setTotal(page.total);
      setError(null);
      if (!req.search && !req.targetKind && !req.tier && req.enabled === undefined && !req.state) onCountChange?.(page.total);
    }, (e: unknown) => {
      if (mine !== seq.current) return;
      setError(errorMessage(e, m.controls.bindingsFailed));
    }).finally(() => { if (mine === seq.current) setLoading(false); });
  }, [api, deviceId, m, onCountChange]);
  const reload = () => { if (query.current) load(query.current); };

  const columns: Column<CommandBinding>[] = [
    {
      key: 'targetKind', header: m.controls.colRecord, sortable: true,
      searchValue: (b) => `${b.targetKindLabel} ${b.targetLabel ?? ''}`,
      render: (b) => <span>{b.targetKindLabel} · {b.targetLabel ?? <span className="text-text-secondary">{stateText('record_missing', m)}</span>}</span>,
    },
    { key: 'control', header: m.controls.colControl, sortable: true, render: (b) => b.controlLabel ?? <span className="text-text-secondary">{stateText('control_gone', m)}</span> },
    { key: 'sends', header: m.controls.colSends, searchable: false, hideBelow: 'md', render: (b) => sendsText(b, m) },
    { key: 'tier', header: m.controls.colTier, searchable: false, render: (b) => <Badge variant={tierVariant(b.tier)} size="sm">{tierText(b.tier, m)}</Badge> },
    { key: 'enabled', header: m.controls.colEnabled, searchable: false, hideBelow: 'sm', render: (b) => (b.enabled ? m.controls.enabledYes : m.controls.enabledNo) },
    { key: 'state', header: m.controls.colState, searchable: false, hideBelow: 'md', render: (b) => <span className={b.state === 'ok' ? undefined : 'text-warning-fg'}>{stateText(b.state, m)}</span> },
    {
      key: 'updatedAt', header: m.controls.colUpdated, sortable: true, searchable: false, hideBelow: 'lg',
      render: (b) => <time className="text-xs text-text-secondary" title={formatDateTime(b.updatedAt, { locale: lang, timeZone })}>{formatRelative(b.updatedAt, { locale: lang })}</time>,
    },
  ];
  const filterFields = useMemo((): DataTableFilterField<CommandBinding>[] => [
    { id: 'targetKind', label: m.controls.recordType, type: 'select', options: kinds.map((k) => ({ value: k.kind, label: k.label })) },
    { id: 'tier', label: m.controls.colTier, type: 'select', options: CONTROL_TIERS.map((t) => ({ value: t, label: tierText(t, m) })) },
    { id: 'enabled', label: m.controls.colEnabled, type: 'select', options: [{ value: 'true', label: m.controls.enabledYes }, { value: 'false', label: m.controls.enabledNo }] },
    { id: 'state', label: m.controls.colState, type: 'select', options: COMMAND_BINDING_STATES.map((s) => ({ value: s, label: stateText(s, m) })) },
  ], [kinds, m]);

  if (!api) return null;
  return (
    <>
      <Drawer open={open} onClose={onClose} title={m.controls.bindingsTitle} closeLabel={m.common.close} className="max-w-4xl">
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">{m.controls.bindingsIntro}</p>
          {canManage && (
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setEditing({ binding: null })}>{m.controls.newBinding}</Button>
            </div>
          )}
          {open && (
            <DataTable<CommandBinding>
              mode="manual"
              total={total}
              onQueryChange={load}
              loading={loading}
              error={error ?? undefined}
              onRetry={reload}
              variant="plain"
              caption={m.controls.bindingsTitle}
              columns={columns}
              rows={rows}
              rowId={(b) => b.bindingId}
              onRowClick={(b) => setEditing({ binding: b })}
              multiSort={false}
              searchPlaceholder={m.controls.search}
              filterFields={filterFields}
              pageSize={PAGE_SIZE}
              pageSizeOptions={LIST_PAGE_SIZES}
              defaultQuery={{ sort: [{ key: 'updatedAt', dir: 'desc' }] }}
              emptyMessage={m.controls.bindingsEmpty}
              messages={{ loading: m.common.loading, retry: m.common.retry }}
              density="compact"
              keyboardNavigation
            />
          )}
        </div>
      </Drawer>
      <CommandBindingEditorDrawer
        open={!!editing}
        binding={editing?.binding ?? null}
        fixed={{ deviceId, deviceName: deviceName ?? null }}
        canManage={canManage}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); reload(); }}
        onDeleted={() => { setEditing(null); reload(); }}
        messages={messages}
        locale={locale}
      />
    </>
  );
}

// ── the editor ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type CommandBindingEditorDrawerProps = {
  open: boolean;
  /** The binding to edit; null: a new one. */
  binding: CommandBinding | null;
  /** What the opener pins: this device (its record controls), or a record and its control (the controls drawer). */
  fixed?: Partial<Pick<BindingDraft, 'deviceId' | 'deviceName' | 'targetKind' | 'targetEntityId' | 'targetLabel' | 'control'>>;
  canManage?: boolean;
  onClose: () => void;
  onSaved?: (b: CommandBinding) => void;
  onDeleted?: () => void;
  messages?: IotMessagesInput;
  locale?: string;
};

const confirmationText = (c: EntityControl, m: IotMessages) => (m.controls as Record<string, string>)[`confirmation_${c.confirmation}`] ?? c.confirmation;
const controlParamsText = (c: EntityControl, m: IotMessages) => {
  const labels = Object.values(c.params ?? {}).map((p) => p.label);
  return labels.length ? fill(m.controls.controlParams, { params: labels.join(', ') }) : m.controls.controlNoParams;
};

export function CommandBindingEditorDrawer({ open, binding, fixed, canManage = false, onClose, onSaved, onDeleted, messages, locale }: CommandBindingEditorDrawerProps) {
  const adapter = useIotAdapter();
  const api = adapter.commandBindings;
  const devices = adapter.devices;
  const notify = useIotNotify();
  const { m } = useIotText(messages, locale);
  const uid = useId();
  const [draft, setDraft] = useState<BindingDraft>(() => draftOf(binding, fixed));
  const [kinds, setKinds] = useState<BindableKind[]>([]);
  const [commands, setCommands] = useState<{ for: string; list: BindableCommand[]; attributesAllowed: boolean } | null>(null);
  const [problems, setProblems] = useState<CommandBindingProblem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readOnly = !canManage;

  // every opening starts from the binding as it is now (state adjusted while rendering)
  const [opened, setOpened] = useState<{ open: boolean; binding: CommandBinding | null }>({ open, binding });
  if (opened.open !== open || opened.binding !== binding) {
    setOpened({ open, binding });
    if (open) {
      setDraft(draftOf(binding, fixed));
      setProblems(null);
      setError(null);
      setCommands(null);
    }
  }

  useEffect(() => {
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.kinds(ctrl.signal).then(setKinds, () => setKinds([]));
    return () => ctrl.abort();
  }, [open, api]);

  const kind = kinds.find((k) => k.kind === draft.targetKind);
  const control = kind?.controls.find((c) => c.name === draft.control);
  const commandsKey = draft.deviceId && draft.targetKind && draft.control ? `${draft.deviceId}|${draft.targetKind}|${draft.control}` : '';
  useEffect(() => {
    if (!open || !api || !commandsKey) return;
    const [deviceId, k, c] = commandsKey.split('|');
    const ctrl = new AbortController();
    api.commands(deviceId, k, c, ctrl.signal).then(
      (r) => setCommands({ for: commandsKey, list: r.commands, attributesAllowed: r.attributesAllowed }),
      () => setCommands({ for: commandsKey, list: [], attributesAllowed: false }),
    );
    return () => ctrl.abort();
  }, [open, api, commandsKey]);
  const bindable = commands && commands.for === commandsKey ? commands : null;
  const command = bindable?.list.find((c) => c.method === draft.method) ?? null;

  const set = (patch: Partial<BindingDraft>) => { setDraft((d) => ({ ...d, ...patch })); setProblems(null); setError(null); };
  const pickCommand = (method: string) => {
    const c = bindable?.list.find((x) => x.method === method);
    set({ method, rows: c ? paramRowsOf({}, c.paramsSchema) : [] });
  };
  const setRow = (id: string, patch: Partial<ParamRow>) => set({ rows: draft.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const searchTargets = useCallback(async (text: string, signal?: AbortSignal): Promise<ComboBoxOption[]> => {
    if (!api || !draft.targetKind) return [];
    const found = await api.targets(draft.targetKind, { search: text }, signal);
    return found.map((o) => ({ value: o.id, label: o.label }));
  }, [api, draft.targetKind]);
  const searchDevices = useCallback(async (text: string, signal?: AbortSignal): Promise<ComboBoxOption[]> => {
    if (!devices) return [];
    const page = await devices.list({ page: 1, pageSize: 20, search: text || undefined }, signal);
    return page.items.map((d) => ({ value: d.deviceId, label: d.name }));
  }, [devices]);
  const deviceLabels = useRef(new Map<string, string>());

  const runCheck = async () => {
    if (!api) return;
    if (!draftComplete(draft)) { setProblems([{ reason: 'incomplete', message: m.controls.pickFirst }]); return; }
    setBusy(true);
    try {
      setProblems(await api.check(inputOf(draft, command), binding?.bindingId));
    } catch (e) {
      setError(errorMessage(e, m.controls.saveFailed));
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!api) return;
    if (!draftComplete(draft)) { setProblems([{ reason: 'incomplete', message: m.controls.pickFirst }]); return; }
    setBusy(true);
    try {
      const input = inputOf(draft, command);
      const saved = binding ? await api.update(binding.bindingId, input, binding.version) : await api.create(input);
      notify({ tone: 'success', message: m.controls.saved });
      onSaved?.(saved);
    } catch (e) {
      const listed = e instanceof IotApiError && Array.isArray(e.details?.problems) ? (e.details!.problems as CommandBindingProblem[]) : null;
      if (listed?.length) setProblems(listed);
      setError(errorMessage(e, m.controls.saveFailed));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!api || !binding) return;
    const done = await confirmDialog({
      title: m.controls.deleteTitle, tone: 'danger', confirmLabel: m.controls.remove, cancelLabel: m.controls.cancel,
      message: fill(m.controls.deleteMessage, {
        control: binding.controlLabel ?? stateText('control_gone', m), record: binding.targetLabel ?? stateText('record_missing', m), device: binding.deviceName,
      }),
      action: () => api.remove(binding.bindingId, binding.version),
      errorMessage: (e) => errorMessage(e, m.controls.saveFailed),
    });
    if (!done) return;
    notify({ tone: 'success', message: m.controls.deleted });
    onDeleted?.();
  };

  const schema = draft.targetType === 'COMMAND' ? command?.paramsSchema : undefined;
  const fromOptions = [
    { value: 'fixed', label: m.controls.fixedValue },
    ...Object.entries(control?.params ?? {}).map(([k, p]) => ({ value: `from:${k}`, label: fill(m.controls.fromControl, { param: p.label }) })),
  ];
  const paramColumns: Column<ParamRow>[] = [
    {
      key: 'key', header: m.controls.colParam,
      render: (r) => (draft.targetType === 'ATTRIBUTES' && !readOnly
        ? <Input id={`${uid}-k-${r.id}`} label={m.controls.valueName} hideLabel value={r.key} onChange={(e) => setRow(r.id, { key: e.target.value })} />
        : <span>{schema?.[r.key]?.label ?? r.key}</span>),
      searchValue: (r) => schema?.[r.key]?.label ?? r.key,
    },
    {
      key: 'source', header: m.controls.colFrom, searchable: false,
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Select id={`${uid}-s-${r.id}`} label={m.controls.colFrom} hideLabel value={r.source} disabled={readOnly}
            options={fromOptions} onChange={(e) => setRow(r.id, { source: e.target.value as ParamRow['source'] })} />
          {r.source === 'fixed' && (
            <Input id={`${uid}-v-${r.id}`} label={m.controls.fixedValue} hideLabel value={r.value} disabled={readOnly}
              placeholder={m.controls.fixedValue} onChange={(e) => setRow(r.id, { value: e.target.value })} />
          )}
          {draft.targetType === 'ATTRIBUTES' && !readOnly && (
            <Button variant="ghost" size="sm" onClick={() => set({ rows: draft.rows.filter((x) => x.id !== r.id) })}>{m.controls.removeValue}</Button>
          )}
        </div>
      ),
    },
  ];

  if (!api) return null;
  const fixedRecord = !!fixed?.targetKind && !!fixed?.targetEntityId;
  const fixedDevice = !!fixed?.deviceId;
  const recordOption = draft.targetEntityId ? [{ value: draft.targetEntityId, label: draft.targetLabel ?? stateText('record_missing', m) }] : [];
  const deviceOption = draft.deviceId ? [{ value: draft.deviceId, label: draft.deviceName ?? deviceLabels.current.get(draft.deviceId) ?? '' }] : [];
  return (
    <Drawer
      open={open}
      onClose={() => { if (!busy) onClose(); }}
      title={binding ? m.controls.editBinding : m.controls.newBinding}
      closeLabel={m.common.close}
      className="max-w-2xl"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{binding && canManage && <Button variant="danger" size="sm" onClick={remove} disabled={busy}>{m.controls.remove}</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{m.controls.cancel}</Button>
            {canManage && <Button variant="outline" size="sm" onClick={runCheck} disabled={busy}>{m.controls.check}</Button>}
            {canManage && <Button variant="primary" size="sm" onClick={save} loading={busy}>{m.controls.save}</Button>}
          </div>
        </div>
      )}
    >
      <div className="space-y-4">
        <Select id={`${uid}-kind`} label={m.controls.recordType} value={draft.targetKind} disabled={readOnly || fixedRecord || !!binding}
          placeholder={m.controls.recordType}
          options={[...kinds.map((k) => ({ value: k.kind, label: k.label })), ...(draft.targetKind && !kind ? [{ value: draft.targetKind, label: binding?.targetKindLabel ?? draft.targetKind }] : [])]}
          onChange={(e) => set({ targetKind: e.target.value, targetEntityId: '', targetLabel: null, control: '', method: '', rows: [] })} />
        {fixedRecord ? (
          <p className="text-sm"><span className="font-medium">{m.controls.record}: </span>{draft.targetLabel ?? ''}</p>
        ) : (
          <ComboBox id={`${uid}-record`} label={m.controls.record} placeholder={m.controls.recordSearch} options={recordOption}
            value={draft.targetEntityId} disabled={readOnly || !draft.targetKind || !!binding} onSearch={searchTargets}
            noResultsText={m.controls.noRecords} messages={{ loading: m.common.loading }}
            onChange={(id) => set({ targetEntityId: id, targetLabel: null })} />
        )}
        <div>
          <Select id={`${uid}-control`} label={m.controls.control} value={draft.control} disabled={readOnly || !kind || (fixedRecord && !!fixed?.control)}
            placeholder={m.controls.control}
            options={(kind?.controls ?? []).map((c) => ({ value: c.name, label: c.label }))}
            onChange={(e) => set({ control: e.target.value, method: '', rows: [] })} />
          {control && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <Badge variant={tierVariant(control.tier)} size="sm">{tierText(control.tier, m)}</Badge>
              <span>{confirmationText(control, m)}</span>
              <span>{controlParamsText(control, m)}</span>
            </p>
          )}
        </div>
        {fixedDevice ? (
          <p className="text-sm"><span className="font-medium">{m.controls.device}: </span>{draft.deviceName ?? ''}</p>
        ) : (
          <ComboBox id={`${uid}-device`} label={m.controls.device} placeholder={m.controls.deviceSearch} options={deviceOption}
            value={draft.deviceId} disabled={readOnly || !!binding} noResultsText={m.controls.noDevices} messages={{ loading: m.common.loading }}
            onSearch={async (text, signal) => {
              const found = await searchDevices(text, signal);
              for (const o of found) deviceLabels.current.set(o.value, o.label);
              return found;
            }}
            onChange={(id) => set({ deviceId: id, deviceName: deviceLabels.current.get(id) ?? null, method: '', rows: [] })} />
        )}
        <fieldset className="space-y-2" disabled={readOnly}>
          <legend className="text-sm font-medium text-text-primary">{m.controls.does}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name={`${uid}-does`} checked={draft.targetType === 'COMMAND'} onChange={() => set({ targetType: 'COMMAND', rows: command ? paramRowsOf({}, command.paramsSchema) : [] })} />
              {m.controls.doesCommand}
            </label>
            {(bindable?.attributesAllowed || draft.targetType === 'ATTRIBUTES') && (
              <label className="inline-flex items-center gap-2">
                <input type="radio" name={`${uid}-does`} checked={draft.targetType === 'ATTRIBUTES'}
                  onChange={() => set({ targetType: 'ATTRIBUTES', method: '', rows: draft.targetType === 'ATTRIBUTES' ? draft.rows : [] })} />
                {m.controls.doesValues}
              </label>
            )}
          </div>
          {draft.targetType === 'COMMAND' && (
            bindable && !bindable.list.length && !draft.method
              ? <p className="text-sm text-text-secondary">{m.controls.noCommands}</p>
              : (
                <Select id={`${uid}-command`} label={m.controls.command} value={draft.method} placeholder={m.controls.command}
                  options={[...(bindable?.list ?? []).map((c) => ({ value: c.method, label: c.label })), ...(draft.method && !command ? [{ value: draft.method, label: binding?.commandLabel ?? stateText('command_gone', m) }] : [])]}
                  onChange={(e) => pickCommand(e.target.value)} />
              )
          )}
        </fieldset>
        {(draft.rows.length > 0 || draft.targetType === 'ATTRIBUTES') && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">{m.controls.paramMap}</h3>
            <DataTable<ParamRow>
              mode="paginated"
              variant="plain"
              caption={m.controls.paramMap}
              columns={paramColumns}
              rows={draft.rows}
              rowId={(r) => r.id}
              pageSize={10}
              pageSizeOptions={LIST_PAGE_SIZES}
              searchPlaceholder={m.controls.paramMap}
              emptyMessage={m.controls.controlNoParams}
              messages={{ loading: m.common.loading, retry: m.common.retry }}
              density="compact"
            />
            {draft.targetType === 'ATTRIBUTES' && !readOnly && (
              <Button variant="outline" size="sm" onClick={() => set({ rows: [...draft.rows, { id: `n${Date.now()}${draft.rows.length}`, key: '', source: 'fixed', value: '' }] })}>
                {m.controls.addValue}
              </Button>
            )}
          </div>
        )}
        <Select id={`${uid}-order`} label={m.controls.order} value={String(draft.position)} disabled={readOnly}
          options={Array.from({ length: COMMAND_BINDING_POSITIONS }, (_, i) => ({ value: String(i), label: fill(m.controls.orderN, { n: i + 1 }) }))}
          onChange={(e) => set({ position: Number(e.target.value) })} />
        <Checkbox id={`${uid}-enabled`} label={m.controls.enabled} checked={draft.enabled} disabled={readOnly} onChange={(e) => set({ enabled: e.target.checked })} />
        <Input id={`${uid}-note`} label={m.controls.note} value={draft.note} disabled={readOnly} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
        {problems && (
          problems.length
            ? (
              <div role="alert" className="rounded-md border border-warning bg-warning-subtle p-3 text-sm">
                <p className="font-medium">{m.controls.problems}</p>
                <ul className="mt-1 list-disc pl-5">{problems.map((p, i) => <li key={`${p.reason}-${i}`}>{p.message}</li>)}</ul>
              </div>
            )
            : <p role="status" className="text-sm text-success-fg">{m.controls.checkOk}</p>
        )}
        {error && !problems?.length && <p role="alert" className="text-sm text-error-fg">{error}</p>}
      </div>
    </Drawer>
  );
}

export type { ControlTier };
