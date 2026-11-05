'use client';
import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Input } from '@/modules/ui/Input';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { TabGroup } from '@/modules/ui/TabGroup';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatDateTime, formatRelative } from '../format';
import { ATTRIBUTE_SCOPES, DESIRED_REPORTED_STATES, type AttributeEntry, type AttributeScope } from '../types/device';
import type { IotMessagesInput } from '../messages';
import { DesiredReportedBadge } from './DesiredReportedBadge';

/**
 * DeviceAttributeTable — a device's attributes in three scope tabs: Server (platform-only), Shared (sent to the device, with
 * the desired/reported sync badge per key when the host sends one) and Client (reported by the device, read-only). Server and
 * Shared values are edited inline as JSON (validated before any request) and added or deleted when `canWrite`; a secret key
 * is write-only and never shown. Values are saved one key at a time through `onSave`.
 *
 * Each scope is a full list on the DataTable's own toolbar, in the browser (the host holds the scope's keys): search (key, value),
 * sortable key, sync and updated columns, the Shared tab's sync filter, rows per page and paging. The sync column and filter show only
 * when some key of the scope has a sync state; "Updated" carries the exact time as its title.
 *
 * A new key is checked here against the host's key rules (`attributeKeyProblem`) before any request, and a key the scope already holds
 * asks before its value is replaced (a shared one is sent to the device). A save that fails says why, or that it failed (NB
 * 41-ui-fixes/22 2.4, 4.3, 6.4, 6.6).
 */
export type DeviceAttributeTableProps = {
  entries: Partial<Record<AttributeScope, readonly AttributeEntry[]>>;
  loading?: Partial<Record<AttributeScope, boolean>>;
  errors?: Partial<Record<AttributeScope, string | null>>;
  canWrite?: boolean;
  onSave?: (scope: Exclude<AttributeScope, 'CLIENT'>, key: string, value: unknown) => Promise<void>;
  onDelete?: (scope: Exclude<AttributeScope, 'CLIENT'>, key: string) => Promise<void>;
  /** Called when a scope tab is opened (load it lazily). */
  onScopeOpen?: (scope: AttributeScope) => void;
  onRetry?: (scope: AttributeScope) => void;
  /** A scope whose newest re-read failed while rows were shown: the rows stay, with this line above them (NB 41-ui-fixes/22 C3). */
  stale?: Partial<Record<AttributeScope, string | null>>;
  defaultScope?: AttributeScope;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

/** The key syntax every scope shares (NB `ATTRIBUTE_KEY`). */
export const ATTRIBUTE_KEY = /^[A-Za-z0-9_.-]{1,128}$/;
/** A shared key other than `cfg.*` can take a desired value, so `<key>.reason` must fit the device's 64-character key limit. */
export const SHARED_KEY_MAX = 57;
const RESERVED_PREFIXES = ['_', 'fw_', 'current_fw_'];
const RESERVED_SUFFIXES = ['.state', '.reason'];
/** Keys the device reports about itself, and the shared key the platform computes (NB `CLIENT_BOOKKEEPING_KEYS`, `COMPUTED_SHARED_KEYS`). */
const RESERVED_KEYS = new Set(['deleted', 'cfg_rejected', 'cfg_applied_ts', 'cfg_hash', 'attr_error', 'rpc_result', 'cert_not_after', 'time_quality']);
const COMPUTED_SHARED = new Set(['session_limits']);

/**
 * Why a key cannot be written by a person in this scope, in words, or null (the host's cloud-write rules, NB iot_device
 * `attributeKeyIssue`): the syntax, the keys the platform or the device own, `cfg.*` in Shared only, a shared key of at most 57.
 */
export function attributeKeyProblem(key: string, scope: Exclude<AttributeScope, 'CLIENT'>, m: { attribute: Record<string, string> }): string | null {
  if (!ATTRIBUTE_KEY.test(key)) return m.attribute.keyInvalid;
  if (RESERVED_KEYS.has(key) || RESERVED_PREFIXES.some((p) => key.startsWith(p)) || RESERVED_SUFFIXES.some((x) => key.endsWith(x))) return m.attribute.keyReserved;
  if (key.startsWith('cfg.')) return scope === 'SHARED' ? null : m.attribute.keyConfigShared;
  if (scope === 'SHARED') {
    if (COMPUTED_SHARED.has(key)) return m.attribute.keyReserved;
    if (key.length > SHARED_KEY_MAX) return m.attribute.keySharedTooLong;
  }
  return null;
}

/** The deepest a value may nest (NB `MAX_VALUE_DEPTH`, protocol 09 §1): a scalar is 0, `{"a":{"b":1}}` is 2. */
export const MAX_VALUE_DEPTH = 8;

/** JSON nesting depth of a value (a scalar is 0), as the host counts it; stops counting past `limit`. */
export function jsonDepth(value: unknown, limit = MAX_VALUE_DEPTH + 1): number {
  if (value === null || typeof value !== 'object') return 0;
  if (limit <= 0) return 1;
  let max = 0;
  for (const v of Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, jsonDepth(v, limit - 1));
    if (max >= limit) break;
  }
  return max + 1;
}

/** The JSON a value is edited as. */
export function valueToText(v: unknown): string {
  return JSON.stringify(v, null, typeof v === 'object' && v !== null ? 2 : 0) ?? '';
}

/** Parses an edited value; `{ ok: false }` when it is not JSON. */
export function parseValue(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    const value = JSON.parse(text);
    return value === null ? { ok: false } : { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function DeviceAttributeTable({
  entries, loading = {}, errors = {}, canWrite = false, onSave, onDelete, onScopeOpen, onRetry, stale = {}, defaultScope = 'SERVER',
  locale, now, messages, className,
}: DeviceAttributeTableProps) {
  const { m } = useIotText(messages, locale);
  return (
    <div className={cn('space-y-3', className)}>
      <TabGroup
        label={m.detail.attributes}
        defaultTab={defaultScope}
        lazy
        tabs={ATTRIBUTE_SCOPES.map((scope) => ({
          id: scope,
          label: m.attribute[scope],
          badge: entries[scope] ? <span className="text-xs text-text-secondary">{entries[scope]!.length}</span> : undefined,
          content: (
            <ScopePanel
              scope={scope}
              rows={entries[scope] ?? []}
              loading={!!loading[scope]}
              error={errors[scope] ?? null}
              stale={stale[scope] ?? null}
              canWrite={canWrite && scope !== 'CLIENT' && !!onSave}
              onSave={onSave}
              onDelete={onDelete}
              onOpen={onScopeOpen}
              onRetry={onRetry}
              locale={locale}
              now={now}
              messages={messages}
            />
          ),
        }))}
      />
    </div>
  );
}

function ScopePanel({ scope, rows, loading, error, stale, canWrite, onSave, onDelete, onOpen, onRetry, locale, now, messages }: {
  scope: AttributeScope;
  rows: readonly AttributeEntry[];
  loading: boolean;
  error: string | null;
  stale: string | null;
  canWrite: boolean;
  onSave?: DeviceAttributeTableProps['onSave'];
  onDelete?: DeviceAttributeTableProps['onDelete'];
  onOpen?: (scope: AttributeScope) => void;
  onRetry?: (scope: AttributeScope) => void;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
}) {
  const { m, locale: lang, timeZone } = useIotText(messages, locale);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftKey, setDraftKey] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const writable = scope === 'CLIENT' ? null : scope;

  // the tabs mount lazily, so mounting a panel is opening its scope (once)
  const openRef = useRef(onOpen);
  useEffect(() => { openRef.current?.(scope); }, [scope]);

  function startEdit(e: AttributeEntry) {
    setEditing(e.key);
    setDraft(e.secret ? '' : valueToText(e.value));
    setFieldError(null);
  }

  function startAdd() {
    setEditing('');
    setDraftKey('');
    setDraft('');
    setFieldError(null);
  }

  async function commit() {
    if (!writable || !onSave || editing === null || busy) return;
    const adding = editing === '';
    const key = adding ? draftKey.trim() : editing;
    if (!key) { setFieldError(m.attribute.keyRequired); return; }
    if (adding) {
      const problem = attributeKeyProblem(key, writable, m);
      if (problem) { setFieldError(problem); return; }
    }
    const parsed = parseValue(draft);
    if (!parsed.ok) { setFieldError(m.attribute.invalidJson); return; }
    // the host's nesting limit (NB MAX_VALUE_DEPTH, 41-ui-fixes/22 C8)
    if (jsonDepth(parsed.value) > MAX_VALUE_DEPTH) { setFieldError(fill(m.attribute.valueTooDeep, { max: MAX_VALUE_DEPTH })); return; }
    // a new key the scope already holds would replace its value (and a shared one goes to the device): ask first
    if (adding && rows.some((r) => r.key === key)) {
      const ok = await confirmDialog({
        title: fill(m.attribute.existsConfirm, { key }), message: writable === 'SHARED' ? m.attribute.existsHintShared : m.attribute.existsHint,
        tone: 'warning', confirmLabel: m.attribute.replace, cancelLabel: m.common.cancel,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await onSave(writable, key, parsed.value);
      setEditing(null);
    } catch (e) {
      // the host's word for this key when it marks one, else its message, else that the save failed (a request with no answer)
      const marked = e instanceof IotApiError && e.fieldErrors ? (e.fieldErrors[key] ?? e.fieldErrors.key ?? e.fieldErrors.value) : undefined;
      setFieldError(marked ?? errorMessage(e, m.attribute.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  const editor = (key: string | null) => (
    <div className="space-y-2">
      {key === null && (
        <Input id={`attr-${scope}-new-key`} label={m.attribute.newKey} maxLength={128} spellCheck={false} value={draftKey} onChange={(e) => { setDraftKey(e.target.value); setFieldError(null); }} />
      )}
      <Textarea
        id={`attr-${scope}-${key ?? 'new'}-value`}
        label={m.attribute.value}
        rows={3}
        className="font-mono"
        value={draft}
        error={fieldError ?? undefined}
        onChange={(e) => { setDraft(e.target.value); setFieldError(null); }}
      />
      <div className="flex gap-2">
        <Button variant="primary" size="xs" loading={busy} disabled={busy} onClick={() => void commit()}>{m.common.save}</Button>
        <Button variant="ghost" size="xs" onClick={() => setEditing(null)} disabled={busy}>{m.common.cancel}</Button>
      </div>
    </div>
  );

  // the sync column and filter only when the host sends a sync state for some key of the scope
  const hasSync = scope === 'SHARED' && rows.some((r) => !!r.sync);
  const columns: Column<AttributeEntry>[] = [
    { key: 'key', header: m.attribute.key, sortable: true, render: (e) => <code className="break-all font-mono text-xs">{e.key}</code> },
    {
      key: 'value',
      header: m.attribute.value,
      // a secret is never searched by its value
      searchValue: (e) => (e.secret ? '' : valueToText(e.value)),
      render: (e) => (editing === e.key ? editor(e.key) : e.secret ? (
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <FontAwesomeIcon icon={faLock} className="h-3 w-3" aria-hidden="true" />{m.attribute.secret}
        </span>
      ) : (
        <code className="block max-w-xs truncate font-mono text-xs sm:max-w-md" title={valueToText(e.value)}>{valueToText(e.value)}</code>
      )),
    },
    ...(hasSync ? [{
      key: 'sync',
      header: m.attribute.device,
      sortable: true,
      searchable: false,
      render: (e: AttributeEntry) => (e.sync ? <DesiredReportedBadge state={e.sync} reason={e.syncReason} messages={messages} /> : null),
    }] : []),
    {
      key: 'updated', header: m.attribute.updated, hideBelow: 'md', sortable: true, searchable: false, sortValue: (e) => (e.updatedAt ? new Date(e.updatedAt).getTime() : null),
      render: (e) => (
        <span className="text-xs text-text-secondary" title={e.updatedAt ? formatDateTime(e.updatedAt, { locale: lang, timeZone }) : undefined}>
          {formatRelative(e.updatedAt, { locale: lang, now })}
        </span>
      ),
    },
    ...(canWrite ? [{
      key: 'actions',
      header: <span className="sr-only">{m.attribute.actions}</span>,
      align: 'right' as const,
      searchable: false,
      render: (e: AttributeEntry) => (editing === e.key ? null : (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="xs" iconOnly aria-label={`${m.attribute.edit} ${e.key}`} onClick={() => startEdit(e)}>
            <FontAwesomeIcon icon={faPen} className="h-3 w-3" aria-hidden="true" />
          </Button>
          {onDelete && writable && (
            <Button onClick={() => { void confirmDialog({ title: fill(m.attribute.deleteConfirm, { key: e.key }), tone: 'danger', confirmLabel: m.attribute.delete, cancelLabel: m.common.cancel }).then((ok) => { if (ok) void onDelete(writable, e.key); }); }} variant="ghost" size="xs" iconOnly aria-label={`${m.attribute.delete} ${e.key}`}>
                  <FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" />
                </Button>
          )}
        </div>
      )),
    }] : []),
  ];

  const filterFields: DataTableFilterField<AttributeEntry>[] = hasSync
    ? [{ id: 'sync', label: m.attribute.device, type: 'checkboxes', options: DESIRED_REPORTED_STATES.map((st) => ({ value: st, label: m.sync[st] })) }]
    : [];

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-text-secondary">
        {scope === 'CLIENT' ? m.attribute.clientReadOnly : scope === 'SHARED' ? m.attribute.sharedHint : m.attribute.serverHint}
      </p>
      {stale && !error && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-xs text-warning-fg">
          {stale}
          {onRetry && <Button variant="outline" size="xs" onClick={() => onRetry(scope)}>{m.common.retry}</Button>}
        </p>
      )}
      <DataTable<AttributeEntry>
        mode="paginated"
        variant="plain"
        caption={m.attribute[scope]}
        columns={columns}
        rows={rows as AttributeEntry[]}
        rowId={(e) => e.key}
        state={error ? 'error' : loading && !rows.length ? 'loading' : undefined}
        errorMessage={error || undefined}
        onRetry={onRetry ? () => onRetry(scope) : undefined}
        emptyMessage={m.attribute.empty}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        density="compact"
        searchPlaceholder={m.attribute.search}
        filterFields={filterFields}
        pageSize={20}
        pageSizeOptions={LIST_PAGE_SIZES}
        keyboardNavigation
      />
      {canWrite && (editing === '' ? (
        <div className="rounded-lg border border-border p-3">{editor(null)}</div>
      ) : (
        <Button variant="outline" size="sm" onClick={startAdd} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>
          {m.attribute.add}
        </Button>
      ))}
    </div>
  );
}
