'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Modal } from '@/modules/ui/Modal';
import { Spinner } from '@/modules/ui/Spinner';
import { errorMessage } from '../api/adapter';
import { useIotAdapter, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { AssetCrumb, AssetNode } from '../types/asset';
import { AssetPicker } from './AssetPicker';
import { SEARCH_HITS } from './asset-search';

/**
 * DevicePlacementPicker — a dialog with the searchable asset tree that returns one asset (phase 08 §8.2: the device page's
 * Placement tab and bulk placement). It reads the tree itself through the adapter; `onPick` gets the chosen asset id.
 * With `current` (the path of where the device is now, root first; `[]`: nowhere) the dialog says it on top, since the dialog covers
 * the tab that shows it (NB 41-ui-fixes/26 1.13). When the host cut its tree (`truncated`), a search asks the host (`assets.list`), so
 * an asset the tree does not hold can still be picked (1.14).
 */
export type DevicePlacementPickerProps = {
  open: boolean;
  value?: string | null;
  /** Where the device is now, root first (`[]`: not placed); said on top of the dialog. */
  current?: AssetCrumb[];
  onClose: () => void;
  onPick: (assetId: string) => void | Promise<void>;
  title?: string;
};

export function DevicePlacementPicker({ open, value = null, current, onClose, onPick, title }: DevicePlacementPickerProps) {
  const api = useIotAdapter().assets;
  const { m } = useIotText();
  const [tree, setTree] = useState<{ nodes: AssetNode[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(value);
  const [busy, setBusy] = useState(false);
  const list = api?.list;
  const searchAssets = useCallback(
    (search: string, signal: AbortSignal) => list!({ page: 1, pageSize: SEARCH_HITS, search }, signal),
    [list],
  );

  useEffect(() => {
    if (!open || !api) return;
    const ctrl = new AbortController();
    api.tree(ctrl.signal).then(
      (t) => { if (!ctrl.signal.aborted) setTree({ nodes: t.nodes, truncated: t.truncated }); },
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
      {current && (
        <p className="mb-2 text-sm text-text-secondary">
          {current.length ? fill(m.placement.now, { path: current.map((c) => c.name).join(' › ') }) : m.placement.nowNone}
        </p>
      )}
      {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
      {tree === null && !error ? (
        <div className="flex justify-center py-6"><Spinner size="sm" label={m.common.loading} /></div>
      ) : tree ? (
        <AssetPicker
          nodes={tree.nodes}
          value={choice}
          onChange={setChoice}
          truncated={tree.truncated}
          searchAssets={list ? searchAssets : undefined}
          searchPlaceholder={m.placement.pickSearch}
        />
      ) : null}
    </Modal>
  );
}
