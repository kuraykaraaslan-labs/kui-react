'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { Spinner } from '@/modules/ui/Spinner';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import type { AssetNode } from '../types/asset';
import { AssetPicker } from './AssetPicker';

/**
 * DevicePlacementPicker — a dialog with the searchable asset tree that returns one asset (phase 08 §8.2: the device page's
 * Placement tab and bulk placement). It reads the tree itself through the adapter; `onPick` gets the chosen asset id.
 */
export type DevicePlacementPickerProps = {
  open: boolean;
  value?: string | null;
  onClose: () => void;
  onPick: (assetId: string) => void | Promise<void>;
  title?: string;
};

export function DevicePlacementPicker({ open, value = null, onClose, onPick, title }: DevicePlacementPickerProps) {
  const api = useIotAdapter().assets;
  const { m } = useIotText();
  const [nodes, setNodes] = useState<AssetNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.tree(ctrl.signal).then(
      (t) => { if (!ctrl.signal.aborted) setNodes(t.nodes); },
      (e) => { if (!ctrl.signal.aborted) setError(errorMessage(e, m.assets.loadError)); },
    );
    return () => ctrl.abort();
  }, [api, open, m.assets.loadError]);

  async function pick() {
    if (!choice) return;
    setBusy(true);
    try { await onPick(choice); } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? m.placement.pickTitle}
      description={m.placement.pickHint}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!choice || choice === value} onClick={() => void pick()}>{m.placement.pick}</Button>
        </div>
      )}
    >
      {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
      {nodes === null && !error ? (
        <div className="flex justify-center py-6"><Spinner size="sm" /></div>
      ) : nodes ? (
        <AssetPicker nodes={nodes} value={choice} onChange={setChoice} searchPlaceholder={m.placement.pickSearch} />
      ) : null}
    </Modal>
  );
}
