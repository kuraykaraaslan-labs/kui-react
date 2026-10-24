'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import { subtreeIds, type AssetNode } from '../types/asset';
import { AssetPicker } from './AssetPicker';

/**
 * MoveAssetDialog — "Move to…" (phase 08 §8.1, the keyboard alternative to drag-and-drop): picks the new parent in the tree, the
 * asset itself and its subtree left out (cycle prevention in the view; the host refuses one too), or the top level.
 */
export type MoveAssetDialogProps = {
  open: boolean;
  asset: { assetId: string; name: string; parentId: string | null };
  nodes: AssetNode[];
  onClose: () => void;
  onMoved?: (parentId: string | null) => void;
};

export function MoveAssetDialog({ open, asset, nodes, onClose, onMoved }: MoveAssetDialogProps) {
  const api = useIotAdapter().assets;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [target, setTarget] = useState<string | null>(asset.parentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excluded = useMemo(() => subtreeIds(nodes, asset.assetId), [nodes, asset.assetId]);
  const unchanged = target === asset.parentId;

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
      {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
      <AssetPicker nodes={nodes} value={target} onChange={setTarget} excluded={excluded} allowTop searchPlaceholder={m.placement.pickSearch} />
    </Modal>
  );
}
