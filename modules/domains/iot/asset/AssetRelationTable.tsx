'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Badge } from '@/modules/ui/Badge';
import { Button } from '@/modules/ui/Button';
import { KeyedTable, type KeyedTableColumn } from '@/modules/ui/KeyedTable';
import { useIotText } from '../api/IotAdapterProvider';
import type { IotMessagesInput } from '../messages';
import type { AssetRelation, RelationEntityType } from '../types/asset';
import { assetKindIcon } from './asset-kind';

/**
 * AssetRelationTable — the typed relations of an asset or a device (phase 08; NB `iot_relations`): from, type, to, each end with its
 * entity badge and a link when the host gives one. `CONTAINS` towards a device is its placement. With `onRemove`, a row can be removed.
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
  const columns: KeyedTableColumn<AssetRelation>[] = [
    { key: 'from', header: m.asset.relationFrom, render: (r) => end(r.fromType, r.fromId, r.fromName) },
    { key: 'type', header: m.asset.relationType, render: (r) => <Badge variant={r.type === 'CONTAINS' ? 'primary' : 'neutral'} size="sm">{r.type}</Badge> },
    { key: 'to', header: m.asset.relationTo, render: (r) => end(r.toType, r.toId, r.toName) },
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
  return (
    <KeyedTable
      className={className}
      caption={m.asset.relations}
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.relationId}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyText={m.asset.noRelations}
      messages={{ loading: m.common.loading, retry: m.common.retry, selectAll: m.common.selectAll }}
    />
  );
}
