'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { SearchBar } from '@/modules/ui/SearchBar';
import { Select } from '@/modules/ui/Select';
import { Spinner } from '@/modules/ui/Spinner';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { AssetNode, AssetRelation, RelationEntityType } from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { AssetPicker } from './AssetPicker';
import { SEARCH_HITS, useDebounced } from './asset-search';

/**
 * AddRelationDrawer — "Add relation" for one device or asset (NB iot-dashboard 09 §9.5, OQ-4; W8bV-1): a typed edge from this end to a
 * device or an asset, or from one of them to this end. The types offered are the standard ones without CONTAINS (a placement has its
 * own flow, "Change placement"; asset → asset parentage is a move) and "Another type" (letters, digits and _; the host stores it upper
 * case). The other device is found through the host's device list (its record scope applies: a device the person may not see is not
 * offered); an asset through the tree with the host's search. The host judges the edge again (`self_relation`, `placement_shape`, the
 * unique edge, the person's write scope) and its refusal is said in words. Save only; nothing is written while the drawer is open.
 */
export type AddRelationDrawerProps = {
  open: boolean;
  /** This end: the device or asset whose relations are on screen, with its name for the direction words. */
  entity: { type: RelationEntityType; id: string; name?: string | null };
  onClose: () => void;
  onSaved?: (relation: AssetRelation) => void;
};

export const RELATION_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
/** The types the drawer offers first: the standard ones but CONTAINS (placement and parentage have their own flows). */
export const ADDABLE_RELATION_TYPES = ['MANAGES', 'FEEDS', 'MONITORS'] as const;
const CUSTOM = '__custom__';

export function AddRelationDrawer({ open, entity, onClose, onSaved }: AddRelationDrawerProps) {
  const adapter = useIotAdapter();
  const assets = adapter.assets;
  const notify = useIotNotify();
  const { m } = useIotText();
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [otherType, setOtherType] = useState<RelationEntityType>('DEVICE');
  const [typeChoice, setTypeChoice] = useState<string>(ADDABLE_RELATION_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [otherId, setOtherId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const paused = useDebounced(search);
  // the hits of one search, kept with the search they answer (a newer search shows the spinner until it answers)
  const [found, setFound] = useState<{ q: string; items: DeviceRecord[] } | null>(null);
  const [tree, setTree] = useState<{ nodes: AssetNode[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // a fresh form each time it opens: the host mounts the drawer only while it is open (RelationsSection does)

  // devices: the host's list, its record scope applies; this device is never offered
  const devices = adapter.devices;
  useEffect(() => {
    if (!open || otherType !== 'DEVICE' || !devices) return;
    const ctrl = new AbortController();
    const q = paused.trim();
    devices.list({ page: 1, pageSize: SEARCH_HITS, ...(q ? { search: q } : {}) }, ctrl.signal).then(
      (p) => { if (!ctrl.signal.aborted) setFound({ q, items: p.items.filter((d) => !(entity.type === 'DEVICE' && d.deviceId === entity.id)) }); },
      (e) => { if (!ctrl.signal.aborted) { setFound({ q, items: [] }); setError(errorMessage(e, m.devices.loadError)); } },
    );
    return () => ctrl.abort();
  }, [open, otherType, devices, paused, entity.type, entity.id, m.devices.loadError]);

  // assets: the tree, with the host's search when it cut it
  useEffect(() => {
    if (!open || otherType !== 'ASSET' || !assets || tree) return;
    const ctrl = new AbortController();
    assets.tree(ctrl.signal).then(
      (t) => { if (!ctrl.signal.aborted) setTree({ nodes: t.nodes, truncated: t.truncated }); },
      (e) => { if (!ctrl.signal.aborted) setError(errorMessage(e, m.assets.loadError)); },
    );
    return () => ctrl.abort();
  }, [open, otherType, assets, tree, m.assets.loadError]);
  const list = assets?.list;
  const searchAssets = useCallback(
    (q: string, signal: AbortSignal) => list!({ page: 1, pageSize: SEARCH_HITS, search: q }, signal),
    [list],
  );

  const hits = found && found.q === paused.trim() ? found.items : null;
  const relType = typeChoice === CUSTOM ? customType.trim() : typeChoice;
  const thisName = entity.name?.trim() || (entity.type === 'DEVICE' ? m.placement.thisDevice : m.relations.thisAsset);

  async function submit() {
    if (!assets?.createRelation || !otherId) return;
    if (!RELATION_TYPE_PATTERN.test(relType)) { setTypeError(m.relations.typeRule); return; }
    if (relType.toUpperCase() === 'CONTAINS') { setTypeError(m.relations.containsHere); return; }
    setBusy(true);
    setError(null);
    const here = { type: entity.type, id: entity.id };
    const there = { type: otherType, id: otherId };
    const [from, to] = direction === 'out' ? [here, there] : [there, here];
    try {
      const relation = await assets.createRelation({ fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, type: relType.toUpperCase() });
      notify({ tone: 'success', message: m.relations.added });
      onSaved?.(relation);
      onClose();
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'conflict') setError(m.relations.exists);
      else setError(errorMessage(e, m.relations.failed));
    } finally {
      setBusy(false);
    }
  }

  const otherWord = otherType === 'DEVICE' ? m.asset.entityDevice : m.asset.entityAsset;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m.relations.addTitle}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!otherId || !relType} onClick={() => void submit()}>{m.relations.save}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="text-sm text-text-secondary">{m.relations.addHint}</p>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <Select
          id="relation-type"
          label={m.asset.relationType}
          value={typeChoice}
          onChange={(e) => { setTypeChoice(e.target.value); setTypeError(undefined); }}
          options={[...ADDABLE_RELATION_TYPES.map((t) => ({ value: t, label: m.relationType[t] })), { value: CUSTOM, label: m.relations.customType }]}
        />
        {typeChoice === CUSTOM && (
          <Input id="relation-type-custom" label={m.relations.customTypeLabel} required maxLength={32} value={customType} hint={m.relations.typeRule}
            error={typeError} onChange={(e) => { setCustomType(e.target.value); setTypeError(undefined); }} />
        )}
        {typeChoice !== CUSTOM && typeError && <p role="alert" className="text-sm text-error">{typeError}</p>}
        <Select
          id="relation-other-type"
          label={m.relations.otherEnd}
          value={otherType}
          onChange={(e) => { setOtherType(e.target.value as RelationEntityType); setOtherId(null); }}
          options={[{ value: 'DEVICE', label: m.asset.entityDevice }, { value: 'ASSET', label: m.asset.entityAsset }]}
        />
        <Select
          id="relation-direction"
          label={m.relations.direction}
          value={direction}
          onChange={(e) => setDirection(e.target.value as 'out' | 'in')}
          options={[
            { value: 'out', label: fill(m.relations.directionOut, { name: thisName, type: m.relationType[relType as keyof typeof m.relationType] ?? relType, other: otherWord }) },
            { value: 'in', label: fill(m.relations.directionIn, { name: thisName, type: m.relationType[relType as keyof typeof m.relationType] ?? relType, other: otherWord }) },
          ]}
        />
        {otherType === 'DEVICE' ? (
          <div className="space-y-2">
            <SearchBar value={search} onChange={setSearch} placeholder={m.asset.searchDevices} label={m.asset.searchDevices} />
            {hits === null ? <Spinner size="sm" label={m.common.loading} /> : hits.length === 0 ? (
              <p className="text-sm text-text-secondary">{m.relations.noDevice}</p>
            ) : (
              <ul role="radiogroup" aria-label={m.asset.entityDevice} className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {hits.map((d) => (
                  <li key={d.deviceId}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-hover">
                      <input type="radio" name="relation-device" value={d.deviceId} checked={otherId === d.deviceId} onChange={() => setOtherId(d.deviceId)} />
                      <span className="truncate text-text-primary">{d.label?.trim() || d.name}</span>
                      {d.label?.trim() && <span className="truncate text-xs text-text-secondary">{d.name}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : tree ? (
          <AssetPicker
            nodes={tree.nodes}
            value={otherId}
            onChange={setOtherId}
            excluded={entity.type === 'ASSET' ? new Set([entity.id]) : undefined}
            truncated={tree.truncated}
            searchAssets={list ? searchAssets : undefined}
            label={m.asset.entityAsset}
          />
        ) : <Spinner size="sm" label={m.common.loading} />}
      </form>
    </Drawer>
  );
}
