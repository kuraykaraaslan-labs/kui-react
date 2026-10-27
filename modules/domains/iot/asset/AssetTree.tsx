'use client';
import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSitemap } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { EmptyState } from '@/modules/ui/EmptyState';
import { SearchBar } from '@/modules/ui/SearchBar';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { TreeView, type TreeNode } from '@/modules/ui/TreeView';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import { filterAssets, type AssetNode } from '../types/asset';

/**
 * AssetTree — the site and asset tree with search (phase 08 §8.1) on the generic `TreeView` (keyboard navigation, expand and
 * collapse all). A search keeps every hit in its place with its ancestors, all expanded. Rows show the asset's name: kind icons and
 * device-count badges inside rows, lazy children and drag-to-move wait for the generic `TreeView` improvements (`renderNode`, `onMove`,
 * `onLoadChildren`, its M2 / M3 / M5 items); the kind and counts are on the detail and the moves go through "Move to…".
 */
export type AssetTreeProps = {
  nodes: AssetNode[];
  selectedId?: string | null;
  onSelect?: (assetId: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Shown under the empty state (e.g. a "New site" button). */
  emptyAction?: React.ReactNode;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const toTree = (nodes: AssetNode[]): TreeNode[] => nodes.map((n) => ({ id: n.assetId, label: n.name, children: n.children.length ? toTree(n.children) : undefined }));

export function AssetTree({ nodes, selectedId, onSelect, loading, error, onRetry, emptyAction, locale, messages, className }: AssetTreeProps) {
  const { m } = useIotText(messages, locale);
  const [search, setSearch] = useState('');
  const { nodes: shown } = useMemo(() => filterAssets(nodes, search), [nodes, search]);
  const tree = useMemo(() => toTree(shown), [shown]);
  const q = search.trim();
  return (
    <div className={cn('space-y-2', className)}>
      <SearchBar placeholder={m.assets.search} value={search} onChange={setSearch} onClear={() => setSearch('')} />
      {error ? (
        <div role="alert" className="space-y-2 rounded-lg border border-border p-3 text-sm text-error">
          <p>{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{m.common.retry}</button>}
        </div>
      ) : loading && !nodes.length ? (
        <SkeletonText lines={6} />
      ) : !nodes.length ? (
        <EmptyState icon={<FontAwesomeIcon icon={faSitemap} aria-hidden="true" />} title={m.assets.empty} description={m.assets.emptyHint} action={emptyAction} />
      ) : tree.length ? (
        <TreeView
          key={q ? `q:${q}` : 'all'}
          nodes={tree}
          selectedId={selectedId ?? undefined}
          label={m.assets.tree}
          onSelect={(id) => onSelect?.(id)}
          messages={{ tree: m.assets.tree, expandAll: m.assets.expandAll, collapseAll: m.assets.collapseAll }}
        />
      ) : (
        <p className="px-2 py-3 text-sm text-text-secondary">{fill(m.assets.noMatch, { search: q })}</p>
      )}
    </div>
  );
}
