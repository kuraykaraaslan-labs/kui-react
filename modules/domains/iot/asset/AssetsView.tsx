'use client';
import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { EmptyState } from '@/modules/ui/EmptyState';
import { PageHeader } from '@/modules/ui/PageHeader';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotCapabilities, useIotText } from '../api/IotAdapterProvider';
import type { AssetNode } from '../types/asset';
import { AssetDetailView } from './AssetDetailView';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetTree } from './AssetTree';

/**
 * AssetsView — the "Sites & assets" page (phase 08; NB iot_asset 03 §3.2): the tree with search on the left, the selected asset's
 * `AssetDetailView` on the right (stacked on a phone). "New site" creates a top-level node; children are added from the detail.
 * The selected asset and the open tab are the host's (its URL): `selectedId` / `onSelect`, `tab` / `onTabChange`. The tree is read
 * again after every write the detail makes.
 */
export type AssetsViewProps = {
  selectedId?: string | null;
  onSelect?: (assetId: string | null) => void;
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  tab?: string;
  onTabChange?: (tab: string) => void;
  now?: number;
  className?: string;
};

export function AssetsView({ selectedId = null, onSelect, hrefs, tab, onTabChange, now, className }: AssetsViewProps) {
  const api = useIotAdapter().assets;
  const caps = useIotCapabilities();
  const { m } = useIotText();
  const [nodes, setNodes] = useState<AssetNode[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    return api.tree(signal).then(
      (t) => { if (!signal?.aborted) { setNodes(t.nodes); setTruncated(t.truncated); setError(null); setLoading(false); } },
      (e) => { if (!signal?.aborted) { setError(errorMessage(e, m.assets.loadError)); setLoading(false); } },
    );
  }, [api, m.assets.loadError]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  if (!api) return null;
  const newSite = caps.canManageAssets ? (
    <Button variant="primary" size="sm" onClick={() => setCreating(true)} iconLeft={<FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />}>{m.assets.newSite}</Button>
  ) : undefined;

  return (
    <div className={cn('space-y-4', className)}>
      <PageHeader
        title={m.assets.title}
        subtitle={m.assets.subtitle}
        actions={caps.canManageAssets ? [{
          label: <><FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" /> {m.assets.newSite}</>,
          onClick: () => setCreating(true),
        }] : undefined}
      />
      {truncated && <p role="status" className="text-xs text-warning-fg">{m.assets.truncated}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside aria-label={m.assets.tree} className="min-w-0 rounded-xl border border-border bg-surface-raised p-3">
          <AssetTree
            nodes={nodes}
            selectedId={selectedId}
            onSelect={(id) => onSelect?.(id)}
            loading={loading}
            error={error}
            onRetry={() => void load()}
            emptyAction={newSite}
          />
        </aside>
        <div className="min-w-0">
          {selectedId ? (
            <AssetDetailView
              assetId={selectedId}
              nodes={nodes}
              hrefs={hrefs}
              tab={tab}
              onTabChange={onTabChange}
              onChanged={() => void load()}
              onDeleted={(parentId) => onSelect?.(parentId)}
              onOpenAsset={onSelect ? (id) => onSelect(id) : undefined}
              now={now}
            />
          ) : (
            <EmptyState icon={<FontAwesomeIcon icon={faSitemap} aria-hidden="true" />} title={m.assets.select} description={m.assets.selectHint} />
          )}
        </div>
      </div>
      {creating && (
        <AssetFormDrawer open onClose={() => setCreating(false)} onSaved={(id) => { void load(); onSelect?.(id); }} />
      )}
    </div>
  );
}
