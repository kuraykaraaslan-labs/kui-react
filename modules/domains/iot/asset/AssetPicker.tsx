'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { SearchBar } from '@/modules/ui/SearchBar';
import { TreeView, type TreeNode } from '@/modules/ui/TreeView';
import { useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { IotMessagesInput } from '../messages';
import { filterAssets, withoutAssets, type AssetNode } from '../types/asset';

/**
 * AssetPicker — a searchable asset tree that returns one asset (phase 08: the "Move to…" dialog and the device placement picker).
 * `excluded` ids and everything under them are not offered (a move never puts an asset under itself, a cycle). With `allowTop`,
 * a first entry stands for "top level" (`null`). A search keeps each hit in its place with its ancestors.
 */
export type AssetPickerProps = {
  nodes: AssetNode[];
  value: string | null;
  onChange: (assetId: string | null) => void;
  excluded?: ReadonlySet<string>;
  allowTop?: boolean;
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
  nodes, value, onChange, excluded, allowTop = false, label, searchPlaceholder, locale, messages, className,
}: AssetPickerProps) {
  const { m } = useIotText(messages, locale);
  const [search, setSearch] = useState('');
  const offered = useMemo(() => (excluded?.size ? withoutAssets(nodes, excluded) : nodes), [nodes, excluded]);
  const { nodes: shown } = useMemo(() => filterAssets(offered, search), [offered, search]);
  const tree = useMemo(() => {
    const t = toTree(shown);
    return allowTop && !search.trim() ? [{ id: TOP_LEVEL_ID, label: m.asset.moveTop }, ...t] : t;
  }, [shown, allowTop, search, m.asset.moveTop]);
  const selected = value === null ? (allowTop ? TOP_LEVEL_ID : undefined) : value;
  return (
    <div className={cn('space-y-2', className)}>
      <SearchBar placeholder={searchPlaceholder ?? m.placement.pickSearch} value={search} onChange={setSearch} onClear={() => setSearch('')} />
      <div className="max-h-80 overflow-auto rounded-lg border border-border p-1">
        {tree.length ? (
          <TreeView
            key={search.trim() ? `q:${search.trim()}` : 'all'}
            nodes={tree}
            selectedId={selected}
            label={label ?? m.assets.tree}
            hideToolbar
            onSelect={(id) => onChange(id === TOP_LEVEL_ID ? null : id)}
          />
        ) : (
          <p className="px-2 py-3 text-sm text-text-secondary">{fill(m.assets.noMatch, { search: search.trim() })}</p>
        )}
      </div>
    </div>
  );
}
