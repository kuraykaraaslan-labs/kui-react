'use client';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faSitemap, faTrashCan, faUser, faUserGroup } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { ConfirmDialog } from '@/modules/ui/ConfirmDialog';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { errorMessage, IotApiError } from '../api/adapter';
import { fill, formatDateTime } from '../format';
import type { IotMessages, IotMessagesInput } from '../messages';
import type { IotAccessGrant, IotAccessSubjectType, IotAccessTargetType } from '../types/access';

/**
 * AccessGrantTable — the grants of one target (`by="target"`: who, a Member / Group badge, granted) or of one subject (`by="subject"`:
 * what, a Site or asset / Device badge, "Removed" for a target that no longer exists, granted): every grant the panel's `useAccessGrants`
 * read, searched, sorted, filtered (Member / Group, or Site or asset / Device) and paged in the browser (`mode="paginated"`). With `canManage` each row has Remove, which asks first (ConfirmDialog) and deletes through `access.deleteGrant`;
 * a grant someone removed meanwhile is said and the page read again. Internal to `TargetAccessPanel` and `SubjectAccessPanel`.
 */
export type AccessGrantTableProps = {
  by: 'target' | 'subject';
  rows: IotAccessGrant[] | null;
  error: string | null;
  onRetry: () => void;
  canManage: boolean;
  /** A grant was removed (or was gone already): the panel reads again. */
  onRemoved: (grant: IotAccessGrant) => void;
  caption: string;
  emptyMessage: string;
  /** The names the panel knows better than a grant row (the subject's or the target's own name). */
  names?: { subject?: string; target?: string };
  messages?: IotMessagesInput;
  className?: string;
};

type Row = IotAccessGrant & Record<string, unknown>;

export function subjectTypeLabel(type: IotAccessSubjectType, m: IotMessages): string {
  return type === 'GROUP' ? m.access.group : m.access.member;
}

export function targetTypeLabel(type: IotAccessTargetType, m: IotMessages): string {
  return type === 'DEVICE' ? m.access.device : m.access.siteOrAsset;
}

/** A Member / Group badge with its icon. */
export function AccessSubjectBadge({ type, messages }: { type: IotAccessSubjectType; messages?: IotMessagesInput }) {
  const { m } = useIotText(messages);
  return (
    <Badge variant={type === 'GROUP' ? 'primary' : 'neutral'} size="sm" className="whitespace-nowrap">
      <FontAwesomeIcon icon={type === 'GROUP' ? faUserGroup : faUser} className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
      {subjectTypeLabel(type, m)}
    </Badge>
  );
}

/** A Site or asset / Device badge with its icon. */
export function AccessTargetBadge({ type, messages }: { type: IotAccessTargetType; messages?: IotMessagesInput }) {
  const { m } = useIotText(messages);
  return (
    <Badge variant={type === 'DEVICE' ? 'info' : 'neutral'} size="sm" className="whitespace-nowrap">
      <FontAwesomeIcon icon={type === 'DEVICE' ? faMicrochip : faSitemap} className="mr-1 h-2.5 w-2.5" aria-hidden="true" />
      {targetTypeLabel(type, m)}
    </Badge>
  );
}

export function AccessGrantTable({
  by, rows, error, onRetry, canManage, onRemoved, caption, emptyMessage, names, messages, className,
}: AccessGrantTableProps) {
  const api = useIotAdapter().access;
  const notify = useIotNotify();
  const { m, locale, timeZone } = useIotText(messages);
  const a = m.access;
  const [removing, setRemoving] = useState<IotAccessGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | undefined>();

  const subjectName = (g: IotAccessGrant) => names?.subject ?? g.subjectLabel ?? g.subjectId;
  const targetName = (g: IotAccessGrant) => names?.target ?? g.targetName ?? a.targetGone;

  async function remove(g: IotAccessGrant) {
    if (!api) return;
    setBusy(true);
    setRemoveError(undefined);
    try {
      await api.deleteGrant(g.grantId);
      setRemoving(null);
      notify({ tone: 'success', message: a.removed });
      onRemoved(g);
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'not_found') {
        setRemoving(null);
        notify({ tone: 'info', message: a.alreadyRemoved });
        onRemoved(g);
      } else {
        setRemoveError(errorMessage(e, a.removeFailed));
      }
    } finally {
      setBusy(false);
    }
  }

  const who: Column<Row> = {
    key: 'subjectLabel',
    header: a.who,
    sortable: true,
    sortValue: (g) => (g.subjectLabel ?? g.subjectId).toLowerCase(),
    searchValue: (g) => `${g.subjectLabel ?? ''} ${g.subjectId}`,
    render: (g) => (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={cn('min-w-0 truncate text-sm text-text-primary', g.subjectLabel === null && 'font-mono text-xs')}>{g.subjectLabel ?? g.subjectId}</span>
        <AccessSubjectBadge type={g.subjectType} messages={messages} />
      </div>
    ),
  };
  const what: Column<Row> = {
    key: 'targetName',
    header: a.what,
    sortable: true,
    sortValue: (g) => (g.targetName ?? '').toLowerCase(),
    searchValue: (g) => g.targetName ?? a.targetGone,
    render: (g) => (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {g.targetName === null ? (
          <span className="text-sm italic text-text-secondary" title={a.targetGoneHint}>{a.targetGone}</span>
        ) : (
          <span className="min-w-0 truncate text-sm text-text-primary">{g.targetName}</span>
        )}
        <AccessTargetBadge type={g.targetType} messages={messages} />
      </div>
    ),
  };
  const columns: Column<Row>[] = [
    by === 'target' ? who : what,
    {
      key: 'createdAt',
      header: a.granted,
      sortable: true,
      sortValue: (g) => new Date(g.createdAt),
      searchValue: () => '',
      render: (g) => <span className="text-sm">{formatDateTime(g.createdAt, { locale, timeZone })}</span>,
    },
    ...(canManage && api ? [{
      key: 'actions',
      header: <span className="sr-only">{a.actions}</span>,
      align: 'right' as const,
      render: (g: Row) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          aria-label={fill(a.removeNamed, { subject: subjectName(g), target: targetName(g) })}
          onClick={() => { setRemoveError(undefined); setRemoving(g); }}
          iconLeft={<FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" aria-hidden="true" />}
        >
          {a.remove}
        </Button>
      ),
    }] : []),
  ];

  // a member or a group of one target; a site or asset or a device of one subject (the client match reads the row's key)
  const filterFields: DataTableFilterField<Row>[] = by === 'target'
    ? [{ id: 'subjectType', label: a.who, type: 'select', options: [{ value: 'USER', label: a.member }, { value: 'GROUP', label: a.group }] }]
    : [{ id: 'targetType', label: a.what, type: 'select', options: [{ value: 'ASSET', label: a.siteOrAsset }, { value: 'DEVICE', label: a.device }] }];

  return (
    <>
      <DataTable<Row>
        className={className}
        mode="paginated"
        variant="plain"
        caption={caption}
        columns={columns}
        rows={(rows ?? []) as Row[]}
        pageSize={10}
        searchPlaceholder={a.searchGrants}
        filterFields={filterFields}
        rowId={(g) => g.grantId}
        state={error ? 'error' : rows === null ? 'loading' : undefined}
        errorMessage={error ?? undefined}
        onRetry={onRetry}
        emptyMessage={emptyMessage}
        messages={{ loading: m.common.loading, retry: m.common.retry }}
        density="compact"
      />
      <ConfirmDialog
        open={removing !== null}
        title={a.removeTitle}
        message={removing ? fill(a.removeBody, { subject: subjectName(removing), target: targetName(removing) }) : undefined}
        tone="danger"
        confirmLabel={a.remove}
        cancelLabel={m.common.cancel}
        closeLabel={m.common.close}
        busy={busy}
        error={removeError}
        onConfirm={() => { if (removing) void remove(removing); }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
