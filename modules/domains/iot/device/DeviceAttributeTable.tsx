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
import { useIotText } from '../api/IotAdapterProvider';
import { fill, formatRelative } from '../format';
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
 * sortable key, sync and updated columns, the Shared tab's sync filter, rows per page and paging.
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
  defaultScope?: AttributeScope;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
  className?: string;
};

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
  entries, loading = {}, errors = {}, canWrite = false, onSave, onDelete, onScopeOpen, onRetry, defaultScope = 'SERVER',
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

function ScopePanel({ scope, rows, loading, error, canWrite, onSave, onDelete, onOpen, onRetry, locale, now, messages }: {
  scope: AttributeScope;
  rows: readonly AttributeEntry[];
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onSave?: DeviceAttributeTableProps['onSave'];
  onDelete?: DeviceAttributeTableProps['onDelete'];
  onOpen?: (scope: AttributeScope) => void;
  onRetry?: (scope: AttributeScope) => void;
  locale?: string;
  now?: number;
  messages?: IotMessagesInput;
}) {
  const { m, locale: lang } = useIotText(messages, locale);
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
    if (!writable || !onSave || editing === null) return;
    const key = editing === '' ? draftKey.trim() : editing;
    if (!key) { setFieldError(m.attribute.keyRequired); return; }
    const parsed = parseValue(draft);
    if (!parsed.ok) { setFieldError(m.attribute.invalidJson); return; }
    setBusy(true);
    try {
      await onSave(writable, key, parsed.value);
      setEditing(null);
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const editor = (key: string | null) => (
    <div className="space-y-2">
      {key === null && (
        <Input id={`attr-${scope}-new-key`} label={m.attribute.newKey} value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
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
        <Button variant="primary" size="xs" loading={busy} onClick={() => void commit()}>{m.common.save}</Button>
        <Button variant="ghost" size="xs" onClick={() => setEditing(null)}>{m.common.cancel}</Button>
      </div>
    </div>
  );

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
    ...(scope === 'SHARED' ? [{
      key: 'sync',
      header: m.attribute.device,
      sortable: true,
      searchable: false,
      render: (e: AttributeEntry) => (e.sync ? <DesiredReportedBadge state={e.sync} reason={e.syncReason} messages={messages} /> : null),
    }] : []),
    { key: 'updated', header: m.attribute.updated, hideBelow: 'md', sortable: true, searchable: false, sortValue: (e) => (e.updatedAt ? new Date(e.updatedAt).getTime() : null), render: (e) => <span className="text-xs text-text-secondary">{formatRelative(e.updatedAt, { locale: lang, now })}</span> },
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

  const filterFields: DataTableFilterField<AttributeEntry>[] = scope === 'SHARED'
    ? [{ id: 'sync', label: m.attribute.device, type: 'checkboxes', options: DESIRED_REPORTED_STATES.map((st) => ({ value: st, label: m.sync[st] })) }]
    : [];

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-text-secondary">
        {scope === 'CLIENT' ? m.attribute.clientReadOnly : scope === 'SHARED' ? m.attribute.sharedHint : m.attribute.serverHint}
      </p>
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
