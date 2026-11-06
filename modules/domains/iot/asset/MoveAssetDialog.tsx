'use client';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill, plural } from '../format';
import { subtreeIds, type AssetNode } from '../types/asset';
import { AssetPicker } from './AssetPicker';
import { SEARCH_HITS } from './asset-search';

/**
 * MoveAssetDialog — "Move to…" (phase 08 §8.1, the keyboard alternative to drag-and-drop): picks the new parent in the tree, the
 * asset itself and its subtree left out (cycle prevention in the view; the host refuses one too), or the top level. It says what moves
 * with the asset: everything under it (its child assets and the devices placed on it and below, with the counts when given), the
 * device counts and roll-ups by place, and, for an asset without a time zone of its own, the zone it inherits. When the host cut the
 * tree (`truncated`), the picker's search asks the host (`assets.list`), so any asset can be the new parent.
 */
export type MoveAssetDialogProps = {
  open: boolean;
  asset: { assetId: string; name: string; parentId: string | null; childCount?: number; deviceCount?: number; timezone?: string | null };
  nodes: AssetNode[];
  /** The host answered only part of its tree. */
  truncated?: boolean;
  onClose: () => void;
  onMoved?: (parentId: string | null) => void;
};

export function MoveAssetDialog({ open, asset, nodes, truncated = false, onClose, onMoved }: MoveAssetDialogProps) {
  const api = useIotAdapter().assets;
  const notify = useIotNotify();
  const { m, locale } = useIotText();
  const [target, setTarget] = useState<string | null>(asset.parentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excluded = useMemo(() => {
    const ids = subtreeIds(nodes, asset.assetId);
    ids.add(asset.assetId);
    return ids;
  }, [nodes, asset.assetId]);
  const unchanged = target === asset.parentId;
  const list = api?.list;
  const searchAssets = useCallback(
    (search: string, signal: AbortSignal) => list!({ page: 1, pageSize: SEARCH_HITS, search }, signal),
    [list],
  );

  async function submit() {
    if (!api || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      await api.move(asset.assetId, target);
      notify({ tone: 'success', message: m.asset.moved });
      onMoved?.(target);
      onClose();
    } catch (e) {
      setError(errorMessage(e, m.asset.moveFailed));
    } finally {
      setBusy(false);
    }
  }

  const counts = asset.childCount !== undefined && asset.deviceCount !== undefined
    ? fill(m.asset.moveCounts, {
      children: plural(asset.childCount, { one: m.asset.childCount_one, other: m.asset.childCount }, locale),
      devices: plural(asset.deviceCount, { one: m.asset.devicesHere_one, other: m.asset.devicesHere }, locale),
    })
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fill(m.asset.moveTitle, { name: asset.name })}
      description={m.asset.moveHint}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={unchanged} onClick={() => void submit()}>{m.asset.moveTo}</Button>
        </div>
      )}
    >
      <div className="mb-3 space-y-1 text-sm text-text-secondary">
        <p>{m.asset.moveWhat}</p>
        {counts && <p>{counts}</p>}
        {!asset.timezone && <p>{m.asset.moveTimezone}</p>}
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
      <AssetPicker
        nodes={nodes}
        value={target}
        onChange={setTarget}
        excluded={excluded}
        allowTop
        truncated={truncated}
        searchAssets={list ? searchAssets : undefined}
        searchPlaceholder={m.placement.pickSearch}
      />
    </Modal>
  );
}
