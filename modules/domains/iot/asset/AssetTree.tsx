'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { assetPath, filterAssets, type AssetNode } from '../types/asset';
import { assetHitLabel, useDebounced, useHostAssetSearch, type AssetSearch } from './asset-search';

/**
 * AssetTree — the site and asset tree with search (phase 08 §8.1) on the generic `TreeView` (keyboard navigation, expand and
 * collapse all). The tree opens on its roots and the path to the selected asset (scrolled into view, so a deep link shows its asset),
 * keeps what the reader opened, and opens a node that gains a child while selected. A search waits for typing to pause; it keeps every
 * hit in its place with its ancestors, all expanded. When the host cut the tree (`truncated`) and gives `searchAssets`, a search asks
 * the host instead and lists its hits flat, each with its place, so every asset can be found. `error` with nodes already shown (a
 * reload after a write that failed) keeps the tree under a notice; `loading` with nodes says it is updating.
 * Rows show the asset's name: kind icons and counts inside rows, lazy children and drag-to-move wait for the generic `TreeView`
 * improvements (`renderNode`, `onMove`, `onLoadChildren`, its M2 / M3 / M5 items); the kind and counts are on the detail and the moves
 * go through "Move to…".
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
  /** The host answered only part of its tree. */
  truncated?: boolean;
  /** Search every asset on the host (used while `truncated`). */
  searchAssets?: AssetSearch;
  locale?: string;
  messages?: IotMessagesInput;
  className?: string;
};

const toTree = (nodes: AssetNode[]): TreeNode[] => nodes.map((n) => ({ id: n.assetId, label: n.name, children: n.children.length ? toTree(n.children) : undefined }));

/** The ids a tree opens on: its roots, and the path to `selectedId` with the node itself. Pure. */
export function openPath(nodes: readonly AssetNode[], selectedId: string | null | undefined): string[] {
  return [...nodes.map((n) => n.assetId), ...selectedPath(nodes, selectedId)];
}

/** The path to `selectedId`, root first, the node itself included (empty when the tree does not hold it). Pure. */
export function selectedPath(nodes: readonly AssetNode[], selectedId: string | null | undefined): string[] {
  return selectedId ? assetPath(nodes, selectedId).map((n) => n.assetId) : [];
}

/** How many children the tree holds under `selectedId` (0 when it does not hold the node). Pure. */
function childrenHeld(nodes: readonly AssetNode[], selectedId: string | null | undefined): number {
  const path = selectedId ? assetPath(nodes, selectedId) : [];
  return path.length ? path[path.length - 1].children.length : 0;
}

/**
 * What a new tree or selection opens (pure): the roots and the path to the selection on the first tree that has nodes; afterwards only
 * the path to a newly selected node, or the selected node again when it gained a child (a child added under it shows). A root or a node
 * the reader closed stays closed across a re-read after a write.
 */
export function toOpen(
  before: { nodes: readonly AssetNode[]; selectedId: string | null | undefined; seeded: boolean },
  nodes: readonly AssetNode[],
  selectedId: string | null | undefined,
): string[] {
  if (!before.seeded) return nodes.length ? openPath(nodes, selectedId) : [];
  if (before.selectedId !== selectedId) return selectedPath(nodes, selectedId);
  return childrenHeld(nodes, selectedId) > childrenHeld(before.nodes, selectedId) ? selectedPath(nodes, selectedId) : [];
}

/** Scrolls the row of `id` into view inside `root` (jsdom and old browsers have no scrollIntoView: then nothing). */
export function scrollToNode(root: HTMLElement | null, id: string | null | undefined): void {
  if (!root || !id) return;
  const row = [...root.querySelectorAll<HTMLElement>('[data-tree-node-id]')].find((el) => el.dataset.treeNodeId === id);
  const target = row?.querySelector<HTMLElement>('[data-tree-row]') ?? row;
  if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
}

export function AssetTree({
  nodes, selectedId, onSelect, loading, error, onRetry, emptyAction, truncated = false, searchAssets, locale, messages, className,
}: AssetTreeProps) {
  const { m } = useIotText(messages, locale);
  const [search, setSearch] = useState('');
  const paused = useDebounced(search);
  // clearing is at once; typing waits for the pause
  const q = search.trim() ? paused.trim() : '';
  const onHost = truncated && !!searchAssets && !!q;
  const host = useHostAssetSearch(onHost ? searchAssets : undefined, q);
  const { nodes: shown } = useMemo(() => filterAssets(nodes, onHost ? '' : q), [nodes, q, onHost]);
  const tree = useMemo(() => toTree(shown), [shown]);
  const hitTree = useMemo<TreeNode[]>(() => host.hits.map((h) => ({ id: h.assetId, label: assetHitLabel(h, m) })), [host.hits, m]);
  // what is open: the roots once (the first tree read), then what the reader opens, the path to each new selection and the selected
  // node when it gains a child (state adjusted while rendering, React's pattern for state derived from props)
  const [opened, setOpened] = useState<Set<string>>(() => new Set(nodes.length ? openPath(nodes, selectedId) : []));
  const [openedFor, setOpenedFor] = useState({ nodes, selectedId, seeded: nodes.length > 0 });
  if (openedFor.nodes !== nodes || openedFor.selectedId !== selectedId) {
    const want = toOpen(openedFor, nodes, selectedId);
    setOpenedFor({ nodes, selectedId, seeded: openedFor.seeded || nodes.length > 0 });
    if (!want.every((id) => opened.has(id))) setOpened(new Set([...opened, ...want]));
  }
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!q) scrollToNode(box.current, selectedId); }, [selectedId, q, nodes.length]);
  const failedReload = !!error && nodes.length > 0;
  return (
    <div className={cn('space-y-2', className)}>
      <SearchBar placeholder={m.assets.search} clearLabel={m.common.clearSearch} value={search} onChange={setSearch} onClear={() => setSearch('')} />
      {truncated && <p role="status" className="px-1 text-xs text-warning-fg">{m.assets.truncated}</p>}
      {failedReload && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-error">
          <span className="min-w-0 flex-1">{m.assets.reloadFailed}</span>
          {onRetry && <button type="button" onClick={onRetry} className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{m.common.retry}</button>}
        </div>
      )}
      {loading && nodes.length > 0 && !failedReload && <p role="status" className="px-1 text-xs text-text-secondary">{m.assets.updating}</p>}
      {error && !failedReload ? (
        <div role="alert" className="space-y-2 rounded-lg border border-border p-3 text-sm text-error">
          <p>{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{m.common.retry}</button>}
        </div>
      ) : loading && !nodes.length ? (
        <SkeletonText lines={6} label={m.common.loading} />
      ) : !nodes.length ? (
        <EmptyState icon={<FontAwesomeIcon icon={faSitemap} aria-hidden="true" />} title={m.assets.empty} description={m.assets.emptyHint} action={emptyAction} />
      ) : onHost ? (
        <div ref={box} className="space-y-1">
          {host.loading ? (
            <p role="status" className="px-2 py-3 text-sm text-text-secondary">{m.assets.searching}</p>
          ) : host.failed ? (
            <p role="alert" className="px-2 py-3 text-sm text-error">{m.assets.searchFailed}</p>
          ) : hitTree.length ? (
            <>
              <TreeView key={`host:${q}`} nodes={hitTree} selectedId={selectedId ?? undefined} label={m.assets.tree} hideToolbar onSelect={(id) => onSelect?.(id)} />
              {host.total > host.hits.length && (
                <p className="px-2 text-xs text-text-secondary">{fill(m.assets.searchMore, { shown: host.hits.length, n: host.total })}</p>
              )}
            </>
          ) : (
            <p className="px-2 py-3 text-sm text-text-secondary">{fill(m.assets.noMatch, { search: q })}</p>
          )}
        </div>
      ) : tree.length ? (
        <div ref={box}>
          <TreeView
            key={q ? `q:${q}` : 'all'}
            nodes={tree}
            selectedId={selectedId ?? undefined}
            // a search opens every hit's path; otherwise the reader's own opened set
            {...(q ? {} : { expandedIds: [...opened], onExpand: (id: string, open: boolean) => setOpened((prev) => { const next = new Set(prev); if (open) next.add(id); else next.delete(id); return next; }) })}
            label={m.assets.tree}
            onSelect={(id) => onSelect?.(id)}
            messages={{ tree: m.assets.tree, expandAll: m.assets.expandAll, collapseAll: m.assets.collapseAll }}
          />
        </div>
      ) : (
        <p className="px-2 py-3 text-sm text-text-secondary">{fill(m.assets.noMatch, { search: q })}</p>
      )}
    </div>
  );
}

