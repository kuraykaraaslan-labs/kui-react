'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column, DataTableFilterField, DataTableQuery } from '@/modules/ui/Table/types';
import { LIST_PAGE_SIZES } from '../api/list-table';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessages, IotMessagesInput } from '../messages';
import type { AssetRelation, RelationEntityType } from '../types/asset';
import { assetKindIcon, relationTypeLabel } from './asset-kind';

/**
 * AssetRelationTable — the typed relations of an asset or a device (phase 08; NB `iot_relations`): from, type, to, each end with its
 * entity badge and a link when the host gives one. `CONTAINS` towards a device is its placement. With `onRemove`, a row can be removed.
 * A full list on the DataTable's own toolbar, in the browser (the host holds the rows): search (both ends' names, the type), sortable
 * columns, the type filter, rows per page and paging. With `onQueryChange` the host serves the pages instead (`total` rows in all; its
 * pages only: no search, sort or filter), so none is dropped unseen.
 *
 * The remove button names the relation (the host asks before it removes one); a standard type is shown in words; an end the host could
 * not name (deleted) says so instead of showing its id; with `onNavigate` the links open through the host's router.
 */
export type AssetRelationTableProps = {
  rows: AssetRelation[];
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  /** Remove a row (the row is given so the host can name it). */
  onRemove?: (relationId: string, row: AssetRelation) => void;
  busyId?: string | null;
  onNavigate?: (href: string) => void;
  /** With `onQueryChange`: the rows across every page. */
  total?: number;
  /** The host serves the pages (page and rows per page). */
  onQueryChange?: (query: DataTableQuery) => void;
  defaultQuery?: Partial<DataTableQuery>;
  /** The page the host shows (controlled; it steps back after the last row of a page went). */
  query?: Partial<DataTableQuery>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

/** A relation end's words: its name, or that it is gone (an end the host could not name). Pure. */
export function relationEndName(type: RelationEntityType, name: string | null | undefined, m: IotMessages): string {
  return name ?? (type === 'ASSET' ? m.asset.deletedAsset : m.asset.deletedDevice);
}

/** "Coolant station Feeds Press line": a relation in words (a confirm, a button's label). Pure. */
export function relationWords(r: AssetRelation, m: IotMessages): { from: string; type: string; to: string } {
  return { from: relationEndName(r.fromType, r.fromName, m), type: relationTypeLabel(r.type, m), to: relationEndName(r.toType, r.toName, m) };
}

function plainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function AssetRelationTable({
  rows, hrefs = {}, onRemove, busyId, onNavigate, total, onQueryChange, defaultQuery, query, loading, error, onRetry, locale, messages, className,
}: AssetRelationTableProps) {
  const { m } = useIotText(messages, locale);
  const end = (type: RelationEntityType, id: string, name?: string | null) => {
    // an end without a name is gone: no link to it
    const href = name == null ? undefined : type === 'ASSET' ? hrefs.asset?.(id) : hrefs.device?.(id);
    const label = relationEndName(type, name, m);
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <FontAwesomeIcon icon={type === 'ASSET' ? assetKindIcon('SITE') : faMicrochip} className="h-3 w-3 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="sr-only">{type === 'ASSET' ? m.asset.entityAsset : m.asset.entityDevice}</span>
        {href
          ? <a href={href} onClick={onNavigate ? (e) => { if (plainClick(e)) { e.preventDefault(); onNavigate(href); } } : undefined} className="truncate text-sm text-text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{label}</a>
          : <span className={name == null ? 'truncate text-sm italic text-text-secondary' : 'truncate text-sm'}>{label}</span>}
      </span>
    );
  };
  const columns: Column<AssetRelation>[] = [
    { key: 'from', header: m.asset.relationFrom, sortable: true, sortValue: (r) => relationEndName(r.fromType, r.fromName, m), searchValue: (r) => relationEndName(r.fromType, r.fromName, m), render: (r) => end(r.fromType, r.fromId, r.fromName) },
    { key: 'type', header: m.asset.relationType, sortable: true, sortValue: (r) => relationTypeLabel(r.type, m), searchValue: (r) => relationTypeLabel(r.type, m),
      render: (r) => <Badge variant={r.type === 'CONTAINS' ? 'primary' : 'neutral'} size="sm">{relationTypeLabel(r.type, m)}</Badge> },
    { key: 'to', header: m.asset.relationTo, sortable: true, sortValue: (r) => relationEndName(r.toType, r.toName, m), searchValue: (r) => relationEndName(r.toType, r.toName, m), render: (r) => end(r.toType, r.toId, r.toName) },
    ...(onRemove ? [{
      key: 'actions',
      header: <span className="sr-only">{m.asset.removeRelation}</span>,
      align: 'right' as const,
      render: (r: AssetRelation) => (
        <Button variant="ghost" size="xs" iconOnly loading={busyId === r.relationId} aria-label={fill(m.asset.removeRelationNamed, relationWords(r, m))} title={m.asset.removeRelation} onClick={() => onRemove(r.relationId, r)}>
          <FontAwesomeIcon icon={faXmark} className="h-3 w-3" aria-hidden="true" />
        </Button>
      ),
    }] : []),
  ];
  const types = [...new Set(rows.map((r) => r.type))].sort();
  const filterFields: DataTableFilterField<AssetRelation>[] = types.length > 1
    ? [{ id: 'type', label: m.asset.relationType, type: 'checkboxes', options: types.map((t) => ({ value: t, label: relationTypeLabel(t, m) })) }]
    : [];
  if (onQueryChange) {
    // the host's pages: its rows in its order, no browser search, sort or filter over one page
    return (
      <DataTable<AssetRelation>
        mode="manual"
        variant="plain"
        className={className}
        caption={m.asset.relations}
        columns={columns.map((c) => ({ ...c, sortable: false }))}
        rows={rows}
        total={total ?? rows.length}
        onQueryChange={onQueryChange}
        defaultQuery={defaultQuery}
        query={query}
        rowId={(r) => r.relationId}
        loading={loading}
        error={error || undefined}
        onRetry={onRetry}
        emptyMessage={m.asset.noRelations}
        messages={{ loading: m.common.loading, retry: m.common.retry, selectAllRows: m.common.selectAll }}
        searchable={false}
        pageSize={query?.pageSize ?? defaultQuery?.pageSize ?? 10}
        pageSizeOptions={LIST_PAGE_SIZES}
        keyboardNavigation
      />
    );
  }
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
