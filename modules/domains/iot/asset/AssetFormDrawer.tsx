'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { Input } from '@/modules/ui/Input';
import { Select } from '@/modules/ui/Select';
import { Textarea } from '@/modules/ui/Textarea';
import { errorMessage, IotApiError } from '../api/adapter';
import { useIotAdapter, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import { isSuggestedAssetKind, SUGGESTED_ASSET_KINDS, type AssetInput, type AssetRecord } from '../types/asset';

/**
 * AssetFormDrawer — create a site or asset (under `parent`, or at the top) or edit one (phase 08 §8.1): name, kind (the suggested
 * kinds or another one, NB A-4), code (derived from the name by the host when empty; a change rewrites the paths below), description,
 * time zone (inherited down the tree when empty) and coordinates. Only changed fields are sent on an edit.
 */
export type AssetFormDrawerProps = {
  open: boolean;
  /** Edit this asset; absent = create. */
  asset?: AssetRecord | null;
  /** Create under this asset; absent = a top-level site. */
  parent?: { assetId: string; name: string } | null;
  onClose: () => void;
  onSaved?: (assetId: string) => void;
};

const CUSTOM = '__custom__';

function defaultKind(parent: AssetFormDrawerProps['parent']): string {
  return parent ? 'BUILDING' : 'SITE';
}

export function AssetFormDrawer({ open, asset, parent, onClose, onSaved }: AssetFormDrawerProps) {
  const api = useIotAdapter().assets;
  const notify = useIotNotify();
  const { m } = useIotText();
  const editing = !!asset;
  const startKind = asset?.kind ?? defaultKind(parent);
  const [name, setName] = useState(asset?.name ?? '');
  const [kindChoice, setKindChoice] = useState(isSuggestedAssetKind(startKind) ? startKind : CUSTOM);
  const [customKind, setCustomKind] = useState(isSuggestedAssetKind(startKind) ? '' : startKind);
  const [code, setCode] = useState(asset?.code ?? '');
  const [description, setDescription] = useState(asset?.description ?? '');
  const [timezone, setTimezone] = useState(asset?.timezone ?? '');
  const [lat, setLat] = useState(asset?.lat === null || asset?.lat === undefined ? '' : String(asset.lat));
  const [lng, setLng] = useState(asset?.lng === null || asset?.lng === undefined ? '' : String(asset.lng));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const title = editing ? fill(m.asset.editTitle, { name: asset!.name }) : parent ? fill(m.asset.newChildTitle, { name: parent.name }) : m.asset.newTitle;

  function collect(): AssetInput | null {
    const errs: Record<string, string> = {};
    const kind = (kindChoice === CUSTOM ? customKind : kindChoice).trim().toUpperCase();
    if (!name.trim()) errs.name = m.asset.nameRequired;
    if (!kind) errs.kind = m.asset.kindRequired;
    const la = lat.trim() === '' ? null : Number(lat);
    const ln = lng.trim() === '' ? null : Number(lng);
    if ((la !== null && (!Number.isFinite(la) || la < -90 || la > 90)) || (ln !== null && (!Number.isFinite(ln) || ln < -180 || ln > 180))) {
      errs.lat = m.asset.coordinatesInvalid;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return null;
    return {
      name: name.trim(), kind, ...(code.trim() ? { code: code.trim() } : {}), description: description.trim() || null,
      timezone: timezone.trim() || null, lat: la, lng: ln,
    };
  }

  async function submit() {
    if (!api) return;
    const input = collect();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const before: Record<string, unknown> = {
          name: asset!.name, kind: asset!.kind, code: asset!.code, description: asset!.description ?? null, timezone: asset!.timezone ?? null,
          lat: asset!.lat ?? null, lng: asset!.lng ?? null,
        };
        const patch = Object.fromEntries(Object.entries(input).filter(([k, v]) => JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null)));
        if (Object.keys(patch).length) await api.update(asset!.assetId, patch);
        notify({ tone: 'success', message: m.asset.saved });
        onSaved?.(asset!.assetId);
      } else {
        const { assetId } = await api.create({ ...input, parentId: parent?.assetId ?? null });
        notify({ tone: 'success', message: m.asset.createdNotice });
        onSaved?.(assetId);
      }
      onClose();
    } catch (e) {
      if (e instanceof IotApiError && e.fieldErrors) setFieldErrors(e.fieldErrors);
      setError(errorMessage(e, m.asset.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={() => void submit()}>{editing ? m.asset.save : m.asset.create}</Button>
        </div>
      )}
    >
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <Input id="asset-name" label={m.asset.name} required maxLength={255} value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
        <Select
          id="asset-kind"
          label={m.asset.kind}
          value={kindChoice}
          error={kindChoice === CUSTOM ? undefined : fieldErrors.kind}
          onChange={(e) => setKindChoice(e.target.value)}
          options={[...SUGGESTED_ASSET_KINDS.map((k) => ({ value: k, label: m.assetKind[k] })), { value: CUSTOM, label: m.assetKind.custom }]}
        />
        {kindChoice === CUSTOM && (
          <Input id="asset-kind-custom" label={m.asset.customKind} required maxLength={24} value={customKind} error={fieldErrors.kind} onChange={(e) => setCustomKind(e.target.value)} />
        )}
        <Input id="asset-code" label={m.asset.code} maxLength={32} value={code} hint={m.asset.codeHint} error={fieldErrors.code} onChange={(e) => setCode(e.target.value)} />
        <Textarea id="asset-description" label={m.asset.description} rows={3} maxLength={1000} value={description} error={fieldErrors.description} onChange={(e) => setDescription(e.target.value)} />
        <Input id="asset-timezone" label={m.asset.timezone} maxLength={64} placeholder="Europe/Istanbul" value={timezone} error={fieldErrors.timezone} onChange={(e) => setTimezone(e.target.value)} />
        <div className="grid grid-cols-2 items-end gap-3">
          <Input id="asset-lat" label={m.asset.latitude} inputMode="decimal" value={lat} error={fieldErrors.lat} onChange={(e) => setLat(e.target.value)} />
          <Input id="asset-lng" label={m.asset.longitude} inputMode="decimal" value={lng} error={fieldErrors.lng} onChange={(e) => setLng(e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}
