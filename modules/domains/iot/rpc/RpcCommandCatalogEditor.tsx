'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport, faFileImport, faPen, faPlus, faTerminal, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { Checkbox } from '@/modules/ui/Checkbox';
import { Drawer } from '@/modules/ui/Drawer';
import { EmptyState } from '@/modules/ui/EmptyState';
import { Input } from '@/modules/ui/Input';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { ConfirmDialog, confirmDialog } from '@/modules/ui/ConfirmDialog';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, plural } from '../format';
import { isRefusedRpcMethod, type RpcCatalogCommand, type RpcCommandInput } from '../types/rpc';
import { paramRowIssues, paramRowsOf, paramsSchemaOf, RpcParamsBuilder, type RpcParamRow } from './RpcParamsBuilder';

/**
 * RpcCommandCatalogEditor — the command catalog of one device profile (NB iot_rpc 00 §0.3, the profile's "Commands" tab contributed by
 * the RPC module): method, label, tier (basic / privileged / critical, each sent with its own permission), high impact with an optional
 * typed phrase, one-way, long-running, default timeout, persistence, declared parameters and masked parameters.
 * Add, edit (never the method) and remove one command; export the catalog as JSON and import one, which replaces the whole catalog
 * after a typed confirmation. A factory reset is never accepted as a command (OD-8). Read-only without `canManageRpcCommands`.
 *
 * NB 41-ui-fixes/23: removing a command, moving it to another tier and an import say what they break (sending it becomes raw RPC, board
 * controls refuse it, flows no longer check its parameters), and an import lists the methods it removes, changes and adds (1.9); an edit
 * sends only the fields it changed with the version it read, and a command changed meanwhile is refused with a reload (1.17); the form
 * checks what the host checks (a whole-number timeout in range, masked names among the parameters, 1.19); capabilities that are still
 * read or could not be read are not "read-only" (1.16); a failure names what failed (1.21).
 *
 * The parameters are built row by row (`RpcParamsBuilder`); JSON stays behind "Advanced (JSON)" with an example, and a schema the rows
 * cannot draw opens there. "New command" can start from a host template (`rpcCatalog.templates`). A refusal of the host about one
 * parameter is shown on the parameters, in the kit's words with the host's detail, never as a bare "Validation error".
 */
export type RpcCommandCatalogEditorProps = {
  profileId: string;
  className?: string;
};

const METHOD_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const TIERS = ['basic', 'privileged', 'critical'] as const;
const blank = (): RpcCommandInput => ({ method: '', label: '', description: null, paramsSchema: {}, tier: 'basic', highImpact: false, oneway: false, long: false, persistentDefault: false, confirmText: null, maskedParams: [] });
const inputOf = (c: RpcCatalogCommand): RpcCommandInput => ({
  method: c.method, label: c.label, description: c.description ?? null, paramsSchema: c.paramsSchema ?? {}, tier: c.tier, highImpact: c.highImpact,
  oneway: c.oneway, long: !!c.long, defaultTimeoutMs: c.defaultTimeoutMs ?? null, persistentDefault: !!c.persistentDefault, confirmText: c.confirmText ?? null,
  maskedParams: c.maskedParams ?? [],
});

const PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const EDITABLE = ['label', 'description', 'paramsSchema', 'maskedParams', 'tier', 'highImpact', 'oneway', 'long', 'defaultTimeoutMs', 'persistentDefault', 'confirmText'] as const;
/** A command input with every optional field filled the way the host stores it, so two can be compared. */
const normal = (c: RpcCommandInput): RpcCommandInput => ({
  method: c.method, label: c.label, description: c.description ?? null, paramsSchema: c.paramsSchema ?? {}, tier: c.tier, highImpact: !!c.highImpact,
  oneway: !!c.oneway, long: !!c.long, defaultTimeoutMs: c.defaultTimeoutMs ?? null, persistentDefault: !!c.persistentDefault, confirmText: c.confirmText ?? null,
  maskedParams: c.maskedParams ?? [],
});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The fields of `next` that differ from `was`: an edit sends only those (NB 41-ui-fixes/23 1.17). */
export function changedCommandFields(was: RpcCommandInput, next: RpcCommandInput): Partial<Omit<RpcCommandInput, 'method'>> {
  const a = normal(was) as Record<string, unknown>;
  const b = normal(next) as Record<string, unknown>;
  return Object.fromEntries(EDITABLE.filter((k) => !same(a[k], b[k])).map((k) => [k, b[k]])) as Partial<Omit<RpcCommandInput, 'method'>>;
}

/** What an import does to the catalog: the methods it removes, the ones it changes and the ones it adds. */
export function importDiff(current: readonly RpcCatalogCommand[], next: readonly RpcCommandInput[]): { removed: string[]; changed: string[]; added: string[] } {
  const now = new Map(current.map((c) => [c.method, normal(inputOf(c))]));
  const incoming = new Set(next.map((c) => c.method));
  return {
    removed: current.filter((c) => !incoming.has(c.method)).map((c) => c.method),
    changed: next.filter((c) => now.has(c.method) && !same(now.get(c.method), normal(c))).map((c) => c.method),
    added: next.filter((c) => !now.has(c.method)).map((c) => c.method),
  };
}

/** A board control sends only a basic command that asks for no confirmation (NB dashboard command `iot_rpc.call`). */
const boardSendable = (c: Pick<RpcCommandInput, 'tier' | 'highImpact'>) => c.tier === 'basic' && !c.highImpact;

export function RpcCommandCatalogEditor({ profileId, className }: RpcCommandCatalogEditorProps) {
  const api = useIotAdapter().rpcCatalog;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const [commands, setCommands] = useState<RpcCatalogCommand[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ command: RpcCatalogCommand | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  // a new drawer (fresh state) for the command read again after a refused stale edit
  const [editKey, setEditKey] = useState(0);

  const load = useCallback((signal?: AbortSignal): Promise<RpcCatalogCommand[] | null> => {
    if (!api) return Promise.resolve(null);
    return api.list(profileId, signal).then(
      (r) => { if (!signal?.aborted) { setCommands(r.commands); setSupported(r.supported); setError(null); } return r.commands; },
      (e) => { if (!signal?.aborted) setError(errorMessage(e, m.rpcCatalog.loadError)); return null; },
    );
  }, [api, profileId, m.rpcCatalog.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const canEdit = caps.canManageRpcCommands;

  async function remove(c: RpcCatalogCommand) {
    if (!api) return;
    // what goes with it (1.9): sending it becomes raw RPC, board controls refuse it, flows no longer check its parameters
    const ok = await confirmDialog({
      title: fill(m.rpcCatalog.removeConfirm, { method: c.method }), message: fill(m.rpcCatalog.removeEffects, { method: c.method }),
      tone: 'danger', confirmLabel: m.rpcCatalog.remove, cancelLabel: m.common.cancel,
    });
    if (!ok) return;
    try {
      await api.remove(profileId, c.commandId);
      notify({ tone: 'success', message: m.rpcCatalog.deleted });
      await load();
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.rpcCatalog.removeError) });
    }
  }

  async function exportAll() {
    if (!api) return;
    try {
      setExported(JSON.stringify({ commands: await api.exportAll(profileId) }, null, 2));
    } catch (e) {
      notify({ tone: 'error', message: errorMessage(e, m.rpcCatalog.exportError) });
    }
  }

  /** A command changed meanwhile (1.17): the catalog read again and the command opened as it is now (the edits made here are dropped). */
  async function reloadAndEdit(commandId: string) {
    const fresh = await load();
    const c = fresh?.find((x) => x.commandId === commandId);
    setEditKey((k) => k + 1);
    setEditing(c ? { command: c } : null);
  }

  /** A read that failed asks again, and the capabilities too when they could not be read either (1.16). */
  function retry() {
    if (caps.failed) caps.retry();
    void load();
  }

  if (!api) return null;
  if (error && commands === null) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-raised p-8 text-center text-sm text-error">
        {error}
        <Button variant="outline" size="sm" onClick={retry}>{m.common.retry}</Button>
      </div>
    );
  }

  const columns: Column<RpcCatalogCommand>[] = [
    {
      key: 'command',
      header: m.rpcCatalog.method,
      sortable: true,
      sortValue: (c) => c.label || c.method,
      searchValue: (c) => `${c.label} ${c.method}`,
      render: (c) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-text-primary">{c.label}</span>
          <code className="truncate font-mono text-xs text-text-secondary">{c.method}</code>
        </span>
      ),
    },
    {
      key: 'tier',
      header: m.rpcCatalog.tier,
      sortable: true,
      searchable: false,
      sortValue: (c) => ({ basic: 0, privileged: 1, critical: 2 } as Record<string, number>)[c.tier] ?? 3,
      render: (c) => <Badge variant={c.tier === 'critical' ? 'error' : c.tier === 'privileged' ? 'warning' : 'neutral'} size="sm">{m.rpcCatalog[c.tier]}</Badge>,
    },
    {
      key: 'flags',
      header: m.rpcCatalog.flags,
      hideBelow: 'md',
      searchable: false,
      render: (c) => (
        <span className="flex flex-wrap gap-1 text-xs text-text-secondary">
          {c.highImpact && <Badge variant="warning" size="sm">{c.confirmText ? `${m.rpcCatalog.confirmText}: ${c.confirmText}` : m.rpcCatalog.highImpact}</Badge>}
          {c.oneway && <Badge variant="neutral" size="sm">{m.rpcCatalog.oneway}</Badge>}
          {c.long && <Badge variant="neutral" size="sm">{m.rpcCatalog.long}</Badge>}
        </span>
      ),
    },
    ...(canEdit ? [{
      key: 'actions',
      header: <span className="sr-only">{m.profiles.actions}</span>,
      align: 'right' as const,
      searchable: false,
      render: (c: RpcCatalogCommand) => (
        <span className="inline-flex items-center justify-end gap-1">
          <Button variant="ghost" size="xs" aria-label={`${m.rpcCatalog.edit} ${c.method}`} onClick={() => setEditing({ command: c })}
            iconLeft={<FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />}>{m.rpcCatalog.edit}</Button>
          <Button onClick={() => void remove(c)} variant="ghost" size="xs" aria-label={`${m.rpcCatalog.remove} ${c.method}`} iconLeft={<FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />}><span className="sr-only">{m.rpcCatalog.remove}</span></Button>
        </span>
      ),
    }] : []),
  ];

  const filterFields: DataTableFilterField<RpcCatalogCommand>[] = [
    { id: 'tier', label: m.rpcCatalog.tier, type: 'checkboxes', options: (['basic', 'privileged', 'critical'] as const).map((t) => ({ value: t, label: m.rpcCatalog[t] })) },
    { id: 'highImpact', label: m.rpcCatalog.highImpact, type: 'checkbox' },
  ];
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">{m.rpcCatalog.title}</h2>
          <p className="text-xs text-text-secondary">{m.rpcCatalog.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void exportAll()} iconLeft={<FontAwesomeIcon icon={faFileExport} className="h-3 w-3" aria-hidden="true" />}>{m.rpcCatalog.export}</Button>
          {canEdit && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setImporting(true)} iconLeft={<FontAwesomeIcon icon={faFileImport} className="h-3 w-3" aria-hidden="true" />}>{m.rpcCatalog.import}</Button>
              <Button variant="outline" size="sm" onClick={() => setEditing({ command: null })} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>{m.rpcCatalog.add}</Button>
            </>
          )}
        </div>
      </div>
      {!supported && <Callout variant="warning" title={null}>{m.rpcCatalog.unsupported}</Callout>}
      {caps.ready && caps.failed && (
        <Callout variant="warning" title={null}>
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>{m.common.capabilitiesError}</span>
            <Button variant="outline" size="xs" onClick={caps.retry}>{m.common.retry}</Button>
          </span>
        </Callout>
      )}
      {caps.ready && !caps.failed && !canEdit && <Callout variant="info" title={null}>{m.rpcCatalog.readOnly}</Callout>}
      {commands !== null && commands.length === 0 ? (
        <EmptyState icon={<FontAwesomeIcon icon={faTerminal} aria-hidden="true" />} title={m.rpcCatalog.title} description={m.rpcCatalog.empty} />
      ) : (
        <DataTable<RpcCatalogCommand>
          mode="paginated"
          variant="plain"
          caption={m.rpcCatalog.title}
          columns={columns}
          rows={commands ?? []}
          rowId={(c) => c.commandId}
          state={commands === null ? 'loading' : undefined}
          messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
          searchPlaceholder={m.rpcCatalog.search}
          filterFields={filterFields}
          pageSize={25}
          pageSizeOptions={LIST_PAGE_SIZES}
          keyboardNavigation
        />
      )}

      {editing && (
        <CommandDrawer
          key={editKey}
          profileId={profileId}
          command={editing.command}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
          onStale={() => { if (editing.command) void reloadAndEdit(editing.command.commandId); }}
        />
      )}
      {importing && <ImportDrawer profileId={profileId} current={commands ?? []} onClose={() => setImporting(false)} onDone={() => { setImporting(false); void load(); }} />}
      {exported !== null && (
        <Drawer open onClose={() => setExported(null)} title={m.rpcCatalog.exportTitle} closeLabel={m.common.close}>
          <Textarea id="rpc-catalog-export" label={m.rpcCatalog.exportTitle} rows={20} readOnly value={exported} className="font-mono" />
        </Drawer>
      )}
    </div>
  );
}

/** The command fields the drawer shows a host's refusal under; a refusal of any other field is named in the summary. */
const SHOWN_FIELDS = new Set(['method', 'label', 'description', 'tier', 'confirmText', 'defaultTimeoutMs', 'paramsSchema', 'maskedParams']);
const PARAMS_EXAMPLE = '{\n  "value": { "label": "Set-point", "type": "number", "min": 0, "max": 100, "required": true },\n  "mode": { "label": "Mode", "type": "select", "options": ["auto", "manual"] }\n}';

function CommandDrawer({ profileId, command, onClose, onSaved, onStale }: {
  profileId: string; command: RpcCatalogCommand | null; onClose: () => void; onSaved: () => void; onStale: () => void;
}) {
  const api = useIotAdapter().rpcCatalog!;
  const notify = useIotNotify();
  const { m } = useIotText();
  const id = useId();
  const [draft, setDraft] = useState<RpcCommandInput>(() => (command ? inputOf(command) : blank()));
  const [rows, setRows] = useState<RpcParamRow[]>(() => paramRowsOf(draft.paramsSchema) ?? []);
  const [paramsMode, setParamsMode] = useState<'builder' | 'json'>(() => (paramRowsOf(draft.paramsSchema) ? 'builder' : 'json'));
  const [params, setParams] = useState(() => JSON.stringify(draft.paramsSchema ?? {}, null, 2));
  const [masked, setMasked] = useState(() => (draft.maskedParams ?? []).join(', '));
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [stale, setStale] = useState(false);
  const [pressed, setPressed] = useState(false);
  const set = (patch: Partial<RpcCommandInput>) => setDraft((d) => ({ ...d, ...patch }));
  const templates = !command ? (api.templates ?? []) : [];

  function startFrom(tid: string) {
    setTemplateId(tid);
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    const next: RpcCommandInput = { ...blank(), ...structuredClone(t.command) };
    setDraft(next);
    setMasked((next.maskedParams ?? []).join(', '));
    setParams(JSON.stringify(next.paramsSchema ?? {}, null, 2));
    const r = paramRowsOf(next.paramsSchema);
    setRows(r ?? []);
    setParamsMode(r ? 'builder' : 'json');
    setFieldErrors({});
  }
  function toJson() {
    setParams(JSON.stringify(paramsSchemaOf(rows), null, 2));
    setParamsMode('json');
  }
  function toBuilder() {
    try {
      const parsed = JSON.parse(params || '{}') as RpcCommandInput['paramsSchema'];
      const r = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? paramRowsOf(parsed) : null;
      if (!r) { setFieldErrors((f) => ({ ...f, paramsSchema: m.rpcCatalog.paramsNotBuildable })); return; }
      setRows(r);
      setParamsMode('builder');
      setFieldErrors((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'paramsSchema')));
    } catch {
      setFieldErrors((f) => ({ ...f, paramsSchema: m.rpcCatalog.jsonInvalid }));
    }
  }

  async function submit() {
    setPressed(true);
    const errs: Record<string, string> = {};
    if (!command && !METHOD_RE.test(draft.method)) errs.method = m.rpcCatalog.methodInvalid;
    if (!command && isRefusedRpcMethod(draft.method)) errs.method = m.rpcCatalog.refused;
    if (!draft.label.trim()) errs.label = m.rpcCatalog.labelRequired;
    // the host takes a whole number of milliseconds from 1 s to 10 min (1.19)
    const t = draft.defaultTimeoutMs;
    if (t !== null && t !== undefined && !(Number.isInteger(t) && t >= 1000 && t <= 600_000)) errs.defaultTimeoutMs = m.rpcCatalog.timeoutInvalid;
    const maskedList = masked.split(',').map((x) => x.trim()).filter(Boolean);
    let paramsSchema: RpcCommandInput['paramsSchema'] = {};
    if (paramsMode === 'builder') {
      if (Object.keys(paramRowIssues(rows)).length) errs.paramsSchema = m.rpcCatalog.paramsCheck;
      else paramsSchema = paramsSchemaOf(rows);
    } else {
      try {
        const parsed = JSON.parse(params || '{}') as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
        paramsSchema = parsed as RpcCommandInput['paramsSchema'];
      } catch {
        errs.paramsSchema = m.rpcCatalog.jsonInvalid;
      }
    }
    // a masked name is a parameter of the command (the host refuses another one)
    const badNames = maskedList.filter((k) => !PARAM_NAME.test(k));
    const unknown = maskedList.filter((k) => PARAM_NAME.test(k) && !(k in paramsSchema));
    if (badNames.length) errs.maskedParams = m.rpcCatalog.maskedInvalid;
    else if (unknown.length && !errs.paramsSchema) errs.maskedParams = fill(m.rpcCatalog.maskedUnknown, { names: unknown.join(', ') });
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    const body: RpcCommandInput = {
      ...draft,
      label: draft.label.trim(),
      description: draft.description?.trim() || null,
      paramsSchema,
      maskedParams: maskedList,
      confirmText: draft.highImpact ? (draft.confirmText?.trim() || null) : null,
      defaultTimeoutMs: draft.defaultTimeoutMs ?? null,
    };
    // an edit sends what changed, after saying what a new tier or a lost board breaks (1.9, 1.17)
    const patch = command ? changedCommandFields(inputOf(command), body) : null;
    if (command && patch) {
      if (!Object.keys(patch).length) { onClose(); return; }
      const effects = [
        ...(body.tier !== command.tier ? [fill(m.rpcCatalog.tierChangeEffects, { to: m.rpcCatalog[body.tier] })] : []),
        ...(boardSendable(command) && !boardSendable(body) ? [fill(m.rpcCatalog.boardsRefuse, { method: command.method })] : []),
      ];
      if (effects.length) {
        const ok = await confirmDialog({
          title: body.tier !== command.tier
            ? fill(m.rpcCatalog.tierChangeTitle, { method: command.method, from: m.rpcCatalog[command.tier], to: m.rpcCatalog[body.tier] })
            : fill(m.rpcCatalog.changeConfirm, { method: command.method }),
          message: effects.join(' '), tone: 'warning', confirmLabel: m.rpcCatalog.save, cancelLabel: m.common.cancel,
        });
        if (!ok) return;
      }
    }
    setBusy(true);
    setError(null);
    setStale(false);
    try {
      if (command && patch) {
        await api.update(profileId, command.commandId, patch, command.version !== undefined ? { expectedVersion: command.version } : undefined);
        notify({ tone: 'success', message: m.rpcCatalog.saved });
      } else {
        await api.create(profileId, body);
        notify({ tone: 'success', message: m.rpcCatalog.created });
      }
      onSaved();
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'stale') { setStale(true); setError(m.rpcCatalog.stale); return; }
      if (e instanceof IotApiError && e.fieldErrors) {
        const { paramsSchema: paramsDetail, ...rest } = e.fieldErrors;
        setFieldErrors({ ...rest, ...(paramsDetail ? { paramsSchema: fill(m.rpcCatalog.paramsRejected, { detail: paramsDetail }) } : {}) });
        // the host's field messages are shown on their fields: the summary says where to look, in the kit's words, and carries the
        // messages of fields the drawer has no box for
        const unshown = Object.entries(rest).filter(([f]) => !SHOWN_FIELDS.has(f)).map(([f, msg]) => `${f}: ${msg}`);
        setError(unshown.length ? `${m.rpcCatalog.checkFields} ${unshown.join(' ')}` : m.rpcCatalog.checkFields);
      } else {
        setError(errorMessage(e, m.rpcCatalog.saveError));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={command ? m.rpcCatalog.editTitle : m.rpcCatalog.newTitle}
      closeLabel={m.common.close}
      className="w-[40rem]"
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void submit()}>{m.rpcCatalog.save}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-error">
            <span>{error}</span>
            {stale && <Button variant="outline" size="xs" onClick={onStale}>{m.rpcCatalog.reload}</Button>}
          </div>
        )}
        {templates.length > 0 && (
          <Select id={`${id}-template`} label={m.rpcCatalog.template} hint={m.rpcCatalog.templateHint} value={templateId}
            options={[{ value: '', label: m.rpcCatalog.templateNone }, ...templates.map((t) => ({ value: t.id, label: t.label }))]}
            onChange={(e) => startFrom(e.target.value)} />
        )}
        <Input id={`${id}-method`} label={m.rpcCatalog.method} hint={m.rpcCatalog.methodHint} required readOnly={!!command} maxLength={64} className="font-mono"
          value={draft.method} error={fieldErrors.method} onChange={(e) => set({ method: e.target.value })} />
        <Input id={`${id}-label`} label={m.rpcCatalog.label} required maxLength={120} value={draft.label} error={fieldErrors.label} onChange={(e) => set({ label: e.target.value })} />
        <Textarea id={`${id}-description`} label={m.rpcCatalog.description} rows={2} maxLength={500} value={draft.description ?? ''} error={fieldErrors.description}
          onChange={(e) => set({ description: e.target.value })} />
        <Select id={`${id}-tier`} label={m.rpcCatalog.tier} value={draft.tier} error={fieldErrors.tier} onChange={(e) => set({ tier: e.target.value as RpcCommandInput['tier'] })}
          options={TIERS.map((t) => ({ value: t, label: m.rpcCatalog[t] }))} />
        <Checkbox id={`${id}-high`} label={m.rpcCatalog.highImpact} checked={draft.highImpact} onChange={(e) => set({ highImpact: e.target.checked })} />
        {draft.highImpact && (
          <Input id={`${id}-confirm`} label={m.rpcCatalog.confirmText} hint={m.rpcCatalog.confirmTextHint} maxLength={120} value={draft.confirmText ?? ''}
            error={fieldErrors.confirmText} onChange={(e) => set({ confirmText: e.target.value })} />
        )}
        <Checkbox id={`${id}-oneway`} label={m.rpcCatalog.oneway} checked={draft.oneway} onChange={(e) => set({ oneway: e.target.checked })} />
        <Checkbox id={`${id}-long`} label={m.rpcCatalog.long} checked={!!draft.long} onChange={(e) => set({ long: e.target.checked })} />
        <Checkbox id={`${id}-persistent`} label={m.rpcCatalog.persistent} checked={!!draft.persistentDefault} onChange={(e) => set({ persistentDefault: e.target.checked })} />
        <Input id={`${id}-timeout`} type="number" label={m.rpcCatalog.timeout} min={1000} max={600_000} step={1000} value={draft.defaultTimeoutMs ?? ''}
          error={fieldErrors.defaultTimeoutMs}
          onChange={(e) => set({ defaultTimeoutMs: e.target.value === '' ? null : Number(e.target.value) })} />
        <div className="space-y-2" role="group" aria-labelledby={`${id}-params-title`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={`${id}-params-title`} className="text-sm font-medium text-text-primary">{m.rpcCatalog.params}</p>
            <div className="flex gap-1" role="group" aria-label={`${m.rpcCatalog.paramsBuilder} / ${m.rpcCatalog.paramsJson}`}>
              <Button variant={paramsMode === 'builder' ? 'secondary' : 'ghost'} size="xs" aria-pressed={paramsMode === 'builder'}
                onClick={() => (paramsMode === 'json' ? toBuilder() : undefined)}>{m.rpcCatalog.paramsBuilder}</Button>
              <Button variant={paramsMode === 'json' ? 'secondary' : 'ghost'} size="xs" aria-pressed={paramsMode === 'json'}
                onClick={() => (paramsMode === 'builder' ? toJson() : undefined)}>{m.rpcCatalog.paramsJson}</Button>
            </div>
          </div>
          {fieldErrors.paramsSchema && <p role="alert" className="text-xs text-error">{fieldErrors.paramsSchema}</p>}
          {paramsMode === 'builder' ? (
            <RpcParamsBuilder rows={rows} onChange={setRows} showIssues={pressed} />
          ) : (
            <Textarea id={`${id}-params`} label={m.rpcCatalog.paramsJson} rows={8} className="font-mono" value={params} placeholder={PARAMS_EXAMPLE}
              hint={m.rpcCatalog.paramsJsonHint} onChange={(e) => setParams(e.target.value)} />
          )}
        </div>
        <Input id={`${id}-masked`} label={m.rpcCatalog.masked} hint={m.rpcCatalog.maskedHint} value={masked} error={fieldErrors.maskedParams} onChange={(e) => setMasked(e.target.value)} />
      </form>
    </Drawer>
  );
}

function ImportDrawer({ profileId, current, onClose, onDone }: { profileId: string; current: readonly RpcCatalogCommand[]; onClose: () => void; onDone: () => void }) {
  const api = useIotAdapter().rpcCatalog!;
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const id = useId();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<RpcCommandInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // what the import does, said before the typed confirmation (1.9)
  const diff = parsed ? importDiff(current, parsed) : null;
  const listed = (methods: string[]) => (methods.length > 8
    ? fill(m.rpcCatalog.more, { list: methods.slice(0, 8).join(', '), n: methods.length - 8 })
    : methods.join(', '));
  const details = diff && (
    <div className="space-y-1 text-sm">
      {diff.removed.length > 0 && <p>{fill(m.rpcCatalog.importRemoved, { n: diff.removed.length, methods: listed(diff.removed) })}</p>}
      {diff.changed.length > 0 && <p>{fill(m.rpcCatalog.importChanged, { n: diff.changed.length, methods: listed(diff.changed) })}</p>}
      {diff.added.length > 0 && <p>{fill(m.rpcCatalog.importAdded, { n: diff.added.length, methods: listed(diff.added) })}</p>}
      {!diff.removed.length && !diff.changed.length && <p>{m.rpcCatalog.importNothing}</p>}
      {diff.removed.length > 0 && <p className="text-warning-fg">{m.rpcCatalog.importRemovedEffects}</p>}
    </div>
  );

  function check() {
    try {
      const v = JSON.parse(text) as { commands?: unknown };
      if (!v || !Array.isArray(v.commands)) throw new Error('shape');
      const commands = v.commands as RpcCommandInput[];
      if (commands.some((c) => typeof c?.method === 'string' && isRefusedRpcMethod(c.method))) { setError(m.rpcCatalog.refused); return; }
      setError(null);
      setParsed(commands);
    } catch {
      setError(m.rpcCatalog.jsonInvalid);
    }
  }

  async function replace() {
    if (!parsed) return;
    setBusy(true);
    try {
      const saved = await api.importAll(profileId, parsed);
      notify({ tone: 'success', message: plural(saved.length, { one: m.rpcCatalog.importedOne, other: m.rpcCatalog.imported }, locale) });
      onDone();
    } catch (e) {
      setParsed(null);
      setError(errorMessage(e, m.rpcCatalog.importError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={m.rpcCatalog.importTitle}
        closeLabel={m.common.close}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
            <Button variant="danger" size="sm" disabled={!text.trim()} onClick={check}>{m.rpcCatalog.importConfirm}</Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">{m.rpcCatalog.importHint}</p>
          <Textarea id={`${id}-import`} label={m.rpcCatalog.importTitle} rows={16} className="font-mono" value={text} error={error ?? undefined}
            onChange={(e) => { setText(e.target.value); setError(null); }} />
        </div>
      </Drawer>
      <ConfirmDialog
        open={parsed !== null}
        title={m.rpcCatalog.importConfirm}
        message={m.rpcCatalog.importHint}
        details={details || undefined}
        phrase="REPLACE"
        phraseLabel={fill(m.rpc.typeToConfirm, { phrase: 'REPLACE' })}
        confirmLabel={m.rpcCatalog.importConfirm}
        cancelLabel={m.common.cancel}
        tone="danger"
        busy={busy}
        onConfirm={() => void replace()}
        onCancel={() => setParsed(null)}
      />
    </>
  );
}
