'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { SearchBar } from '@/modules/ui/SearchBar';
import { TreeView, type TreeNode } from '@/modules/ui/TreeView';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import { filterAssets, withoutAssets, type AssetNode } from '../types/asset';
import { assetHitLabel, useDebounced, useHostAssetSearch, type AssetSearch } from './asset-search';

/**
 * AssetPicker — a searchable asset tree that returns one asset (phase 08: the "Move to…" dialog and the device placement picker).
 * `excluded` ids and everything under them are not offered (a move never puts an asset under itself, a cycle). With `allowTop`,
 * a first entry stands for "top level" (`null`). A search waits for typing to pause and keeps each hit in its place with its ancestors.
 * When the host cut the tree (`truncated`) and gives `searchAssets`, a search asks the host and lists its hits flat with their place
 * (an excluded asset, or one under it, is left out), so an asset the tree does not hold can still be picked.
 */
export type AssetPickerProps = {
  nodes: AssetNode[];
  value: string | null;
  onChange: (assetId: string | null) => void;
  excluded?: ReadonlySet<string>;
  allowTop?: boolean;
  /** The host answered only part of its tree. */
  truncated?: boolean;
  /** Search every asset on the host (used while `truncated`). */
  searchAssets?: AssetSearch;
  /** Accessible name of the tree. */
  label?: string;
  searchPlaceholder?: string;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

export const TOP_LEVEL_ID = '__top__';

const toTree = (nodes: AssetNode[]): TreeNode[] => nodes.map((n) => ({ id: n.assetId, label: n.name, children: n.children.length ? toTree(n.children) : undefined }));

export function AssetPicker({
  nodes, value, onChange, excluded, allowTop = false, truncated = false, searchAssets, label, searchPlaceholder, locale, messages, className,
}: AssetPickerProps) {
  const { m } = useIotText(messages, locale);
  const [search, setSearch] = useState('');
  const paused = useDebounced(search);
  const q = search.trim() ? paused.trim() : '';
  const onHost = truncated && !!searchAssets && !!q;
  const host = useHostAssetSearch(onHost ? searchAssets : undefined, q);
  const offered = useMemo(() => (excluded?.size ? withoutAssets(nodes, excluded) : nodes), [nodes, excluded]);
  const { nodes: shown } = useMemo(() => filterAssets(offered, onHost ? '' : q), [offered, q, onHost]);
  const tree = useMemo(() => {
    if (onHost) {
      const hits = host.hits.filter((h) => !excluded?.has(h.assetId) && !h.location.some((l) => excluded?.has(l.assetId)));
      return hits.map((h) => ({ id: h.assetId, label: assetHitLabel(h, m) }));
    }
    const t = toTree(shown);
    return allowTop && !q ? [{ id: TOP_LEVEL_ID, label: m.asset.moveTop }, ...t] : t;
  }, [onHost, host.hits, excluded, m, shown, allowTop, q]);
  const selected = value === null ? (allowTop ? TOP_LEVEL_ID : undefined) : value;
  return (
    <div className={cn('space-y-2', className)}>
      <SearchBar placeholder={searchPlaceholder ?? m.placement.pickSearch} clearLabel={m.common.clearSearch} value={search} onChange={setSearch} onClear={() => setSearch('')} />
      {truncated && <p role="status" className="px-1 text-xs text-warning-fg">{m.assets.truncated}</p>}
      <div className="max-h-80 overflow-auto rounded-lg border border-border p-1">
        {onHost && host.loading ? (
          <p role="status" className="px-2 py-3 text-sm text-text-secondary">{m.assets.searching}</p>
        ) : onHost && host.failed ? (
          <p role="alert" className="px-2 py-3 text-sm text-error">{m.assets.searchFailed}</p>
        ) : tree.length ? (
          <TreeView
            key={onHost ? `host:${q}` : q ? `q:${q}` : 'all'}
            nodes={tree}
            selectedId={selected}
            label={label ?? m.assets.tree}
            hideToolbar
            onSelect={(id) => onChange(id === TOP_LEVEL_ID ? null : id)}
          />
        ) : (
          <p className="px-2 py-3 text-sm text-text-secondary">{fill(m.assets.noMatch, { search: q })}</p>
        )}
      </div>
      {onHost && host.total > host.hits.length && (
        <p className="px-1 text-xs text-text-secondary">{fill(m.assets.searchMore, { shown: host.hits.length, n: host.total })}</p>
      )}
    </div>
  );
}
