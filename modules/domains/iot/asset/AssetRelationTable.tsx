'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { AssetRelation, RelationEntityType } from '../types/asset';
import { assetKindIcon } from './asset-kind';

/**
 * AssetRelationTable — the typed relations of an asset or a device (phase 08; NB `iot_relations`): from, type, to, each end with its
 * entity badge and a link when the host gives one. `CONTAINS` towards a device is its placement. With `onRemove`, a row can be removed.
 * A full list on the DataTable's own toolbar, in the browser (the host holds the rows): search (both ends' names, the type), sortable
 * columns, the type filter, rows per page and paging.
 */
export type AssetRelationTableProps = {
  rows: AssetRelation[];
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  onRemove?: (relationId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export function AssetRelationTable({ rows, hrefs = {}, onRemove, loading, error, onRetry, locale, messages, className }: AssetRelationTableProps) {
  const { m } = useIotText(messages, locale);
  const end = (type: RelationEntityType, id: string, name?: string | null) => {
    const href = type === 'ASSET' ? hrefs.asset?.(id) : hrefs.device?.(id);
    const label = name ?? id;
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <FontAwesomeIcon icon={type === 'ASSET' ? assetKindIcon('SITE') : faMicrochip} className="h-3 w-3 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="sr-only">{type === 'ASSET' ? m.asset.entityAsset : m.asset.entityDevice}</span>
        {href
          ? <a href={href} className="truncate text-sm text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{label}</a>
          : <span className="truncate text-sm">{label}</span>}
      </span>
    );
  };
  const columns: Column<AssetRelation>[] = [
    { key: 'from', header: m.asset.relationFrom, sortable: true, sortValue: (r) => r.fromName ?? r.fromId, searchValue: (r) => r.fromName ?? r.fromId, render: (r) => end(r.fromType, r.fromId, r.fromName) },
    { key: 'type', header: m.asset.relationType, sortable: true, render: (r) => <Badge variant={r.type === 'CONTAINS' ? 'primary' : 'neutral'} size="sm">{r.type}</Badge> },
    { key: 'to', header: m.asset.relationTo, sortable: true, sortValue: (r) => r.toName ?? r.toId, searchValue: (r) => r.toName ?? r.toId, render: (r) => end(r.toType, r.toId, r.toName) },
    ...(onRemove ? [{
      key: 'actions',
      header: <span className="sr-only">{m.asset.removeRelation}</span>,
      align: 'right' as const,
      render: (r: AssetRelation) => (
        <Button variant="ghost" size="xs" iconOnly aria-label={m.asset.removeRelation} title={m.asset.removeRelation} onClick={() => onRemove(r.relationId)}>
          <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
        </Button>
      ),
    }] : []),
  ];
  const types = [...new Set(rows.map((r) => r.type))].sort();
  const filterFields: DataTableFilterField<AssetRelation>[] = types.length > 1
    ? [{ id: 'type', label: m.asset.relationType, type: 'checkboxes', options: types.map((t) => ({ value: t, label: t })) }]
    : [];
  return (
    <DataTable<AssetRelation>
      mode="paginated"
      variant="plain"
      className={className}
      caption={m.asset.relations}
      columns={columns}
      rows={rows}
      rowId={(r) => r.relationId}
      state={error ? 'error' : loading && !rows.length ? 'loading' : undefined}
      errorMessage={error || undefined}
      onRetry={onRetry}
      emptyMessage={m.asset.noRelations}
      messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
      searchPlaceholder={m.asset.searchRelations}
      filterFields={filterFields}
      pageSize={10}
      pageSizeOptions={LIST_PAGE_SIZES}
      keyboardNavigation
    />
  );
}
