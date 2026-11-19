'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import { ComboBox, type ComboBoxOption } from '@/modules/ui/ComboBox';
import { Modal } from '@/modules/ui/Modal';
import { SkeletonText } from '@/modules/ui/Skeleton';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { errorMessage } from '../api/adapter';
import { AssetTree } from '../asset/AssetTree';
import { SEARCH_HITS } from '../asset/asset-search';
import { fill, plural } from '../format';
import type { IotMessages, IotMessagesInput } from '../messages';
import type { IotAccessScope, IotAccessSubject, IotAccessTargetType, IotEffectiveAccess } from '../types/access';
import type { AssetNode } from '../types/asset';
import type { DeviceRecord } from '../types/device';
import { AccessGrantTable } from './AccessGrantTable';
import { useAccessGrants } from './useAccessGrants';

/**
 * SubjectAccessPanel — "What <name> can see" for one member or group (restricted IoT access). For a member, a preview of what they
 * see now (`access.effective`): every site and asset or how many, every device or how many, and whether that comes through their
 * role or the Full IoT view group or through the grants. Then the subject's grants in a DataTable (the site, asset or device with
 * its badge, "Removed" when it no longer exists, when it was given). With `canManageAccess`: "Add a site or asset" (a dialog with the
 * asset tree from `assets.tree`, one pick) and "Add a device" (a dialog with a device search through `devices.list`, one pick), each
 * then `access.createGrant`, and Remove on each row (asks first). The preview is read again after every change. Draws nothing
 * without `adapter.access`.
 */
export type SubjectAccessPanelProps = {
  subject: IotAccessSubject;
  /** Any change of the subject's grants, for a host that shows counts elsewhere. */
  onChanged?: () => void;
  messages?: IotMessagesInput;
  className?: string;
};

export function SubjectAccessPanel({ subject, onChanged, messages, className }: SubjectAccessPanelProps) {
  const adapter = useIotAdapter();
  const api = adapter.access;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText(messages);
  const a = m.access;
  const grants = useAccessGrants(api, { subjectType: subject.type, subjectId: subject.id }, a.loadError);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState<IotAccessTargetType | null>(null);
  const name = subject.label;

  if (!api) return null;
  const canManage = caps.canManageAccess;

  function changed() {
    setVersion((v) => v + 1);
    onChanged?.();
  }

  async function add(targetType: IotAccessTargetType, targetId: string) {
    if (!api) return;
    await api.createGrant({ subjectType: subject.type, subjectId: subject.id, targetType, targetId });
    notify({ tone: 'success', message: a.given });
    setAdding(null);
    void grants.load();
    changed();
  }

  return (
    <section className={cn('space-y-3', className)} aria-label={fill(a.subjectTitle, { name })} data-testid="iot-subject-access">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{fill(a.subjectTitle, { name })}</h3>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {adapter.assets && (
              <Button variant="outline" size="sm" onClick={() => setAdding('ASSET')}
                iconLeft={<FontAwesomeIcon icon={faSitemap} className="h-3 w-3" aria-hidden="true" />}>
                {a.addAsset}
              </Button>
            )}
            {adapter.devices && (
              <Button variant="outline" size="sm" onClick={() => setAdding('DEVICE')}
                iconLeft={<FontAwesomeIcon icon={faMicrochip} className="h-3 w-3" aria-hidden="true" />}>
                {a.addDevice}
              </Button>
            )}
          </div>
        )}
      </div>

      {subject.type === 'USER'
        ? <EffectiveAccessCard userId={subject.id} name={name} reloadKey={version} messages={messages} />
        : <p className="text-sm text-text-secondary">{fill(a.groupNote, { name })}</p>}

      <AccessGrantTable
        by="subject"
        rows={grants.rows}
        error={grants.error}
        onRetry={() => void grants.load()}
        canManage={canManage}
        onRemoved={() => { void grants.load(); changed(); }}
        caption={fill(a.subjectCaption, { name })}
        emptyMessage={fill(a.subjectEmpty, { name })}
        names={{ subject: name }}
        messages={messages}
      />

      {canManage && adding === 'ASSET' && (
        <AddAssetDialog name={name} onClose={() => setAdding(null)} onPick={(id) => add('ASSET', id)} messages={messages} />
      )}
      {canManage && adding === 'DEVICE' && (
        <AddDeviceDialog name={name} onClose={() => setAdding(null)} onPick={(id) => add('DEVICE', id)} messages={messages} />
      )}
    </section>
  );
}

/** "Every site and asset" or "{n} sites and assets" (and the same for devices). Pure. */
export function scopeText(scope: IotAccessScope, kind: 'assets' | 'devices', m: IotMessages, locale?: string): string {
  const a = m.access;
  if (scope.all) return kind === 'assets' ? a.assetsAll : a.devicesAll;
  const n = scope.count ?? scope.ids.length;
  return kind === 'assets'
    ? plural(n, { one: a.assetsCount_one, other: a.assetsCount }, locale)
    : plural(n, { one: a.devicesCount_one, other: a.devicesCount }, locale);
}

export type EffectiveAccessCardProps = {
  userId: string;
  /** The member's name, for the texts. */
  name: string;
  /** Any change reads the preview again. */
  reloadKey?: number;
  messages?: IotMessagesInput;
  className?: string;
};

/**
 * EffectiveAccessCard — what one member sees now (`access.effective`): sites and assets, devices, each "every" or a count, and where
 * it comes from (their role or the Full IoT view group when everything; the grants otherwise). A member who is not in the workspace
 * is said to get nothing from their grants.
 */
export function EffectiveAccessCard({ userId, name, reloadKey = 0, messages, className }: EffectiveAccessCardProps) {
  const api = useIotAdapter().access;
  const { m, locale } = useIotText(messages);
  const a = m.access;
  const [state, setState] = useState<{ for: string; access: IotEffectiveAccess | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const read = api?.effective;

  useEffect(() => {
    if (!read) return;
    const ctrl = new AbortController();
    read(userId, ctrl.signal).then(
      (access) => { if (!ctrl.signal.aborted) setState({ for: userId, access, error: null }); },
      (e) => { if (!ctrl.signal.aborted) setState({ for: userId, access: null, error: errorMessage(e, a.previewError) }); },
    );
    return () => ctrl.abort();
  }, [read, userId, reloadKey, attempt, a.previewError]);

  if (!api) return null;
  // what was read for another member is not shown under this one's name
  const current = state && state.for === userId ? state : null;
  const access = current?.access ?? null;

  const tile = (label: string, scope: IotAccessScope, kind: 'assets' | 'devices') => (
    <div className="min-w-0 flex-1 rounded-md border border-border bg-surface-base px-3 py-2">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-sm font-semibold text-text-primary" data-testid={`iot-access-${kind}`}>{scopeText(scope, kind, m, locale)}</dd>
      <dd className="text-xs text-text-secondary">{scope.all ? a.throughRole : a.throughGrants}</dd>
    </div>
  );

  return (
    <div className={cn('rounded-lg border border-border bg-surface-raised p-3', className)} aria-busy={!current} data-testid="iot-effective-access">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{a.previewTitle}</p>
      {current?.error ? (
        <Callout variant="danger" title={null} className="my-0">
          <p>{current.error}</p>
          <Button variant="outline" size="xs" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>{m.common.retry}</Button>
        </Callout>
      ) : !access ? (
        <SkeletonText lines={2} label={m.common.loading} />
      ) : (
        <>
          {!access.member && <Callout variant="warning" title={null} className="my-0 mb-2">{fill(a.notMember, { name })}</Callout>}
          <dl className="flex flex-col gap-2 sm:flex-row">
            {tile(a.previewAssets, access.assets, 'assets')}
            {tile(a.previewDevices, access.devices, 'devices')}
          </dl>
          {(access.assets.all || access.devices.all) && access.grants.assets + access.grants.devices > 0 && (
            <p className="mt-2 text-xs text-text-secondary">{a.grantsIgnored}</p>
          )}
        </>
      )}
    </div>
  );
}

type PickDialogProps = {
  name: string;
  onClose: () => void;
  /** Gives the access; a throw keeps the dialog open with the host's reason. */
  onPick: (id: string) => Promise<void>;
  messages?: IotMessagesInput;
};

/** "Add a site or asset": the asset tree (`assets.tree`; the host's search when it cut the tree), one pick, then Add. */
function AddAssetDialog({ name, onClose, onPick, messages }: PickDialogProps) {
  const api = useIotAdapter().assets;
  const { m } = useIotText(messages);
  const a = m.access;
  const [tree, setTree] = useState<{ nodes: AssetNode[]; truncated: boolean } | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = api?.list;
  const searchAssets = useCallback(
    (search: string, signal: AbortSignal) => list!({ page: 1, pageSize: SEARCH_HITS, search }, signal),
    [list],
  );

  useEffect(() => {
    if (!api) return;
    const ctrl = new AbortController();
    api.tree(ctrl.signal).then(
      (t) => { if (!ctrl.signal.aborted) { setTree({ nodes: t.nodes, truncated: t.truncated }); setTreeError(null); } },
      (e) => { if (!ctrl.signal.aborted) setTreeError(errorMessage(e, a.treeFailed)); },
    );
    return () => ctrl.abort();
  }, [api, attempt, a.treeFailed]);

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try { await onPick(choice); } catch (e) { setError(errorMessage(e, a.giveFailed)); } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fill(a.addAssetTitle, { name })}
      description={fill(a.addAssetHint, { name })}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!choice} onClick={() => void submit()}>{a.add}</Button>
        </div>
      )}
    >
      {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
      <div className="max-h-96 overflow-auto">
        <AssetTree
          nodes={tree?.nodes ?? []}
          truncated={tree?.truncated}
          searchAssets={list ? searchAssets : undefined}
          loading={tree === null && !treeError}
          error={treeError}
          onRetry={() => { setTreeError(null); setAttempt((n) => n + 1); }}
          selectedId={choice}
          onSelect={setChoice}
          messages={messages}
        />
      </div>
    </Modal>
  );
}

const DEVICE_HITS = 20;

/** "Add a device": a device search (`devices.list` with the typed text), one pick, then Add. */
function AddDeviceDialog({ name, onClose, onPick, messages }: PickDialogProps) {
  const api = useIotAdapter().devices;
  const { m } = useIotText(messages);
  const a = m.access;
  const id = useId();
  const [choice, setChoice] = useState<DeviceRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Map<string, DeviceRecord>());
  const optionOf = useCallback((d: DeviceRecord): ComboBoxOption => ({
    value: d.deviceId,
    label: d.name,
    description: d.label || d.serial || undefined,
    icon: <FontAwesomeIcon icon={faMicrochip} className="h-3 w-3 text-text-secondary" aria-hidden="true" />,
  }), []);
  const list = api?.list;
  const onSearch = useCallback(async (text: string, signal?: AbortSignal) => {
    if (!list) return [];
    try {
      const page = await list({ page: 1, pageSize: DEVICE_HITS, ...(text ? { search: text } : {}) }, signal);
      for (const d of page.items) seen.current.set(d.deviceId, d);
      setFailed(false);
      return page.items.map(optionOf);
    } catch (e) {
      if (signal?.aborted) throw e;
      setFailed(true);
      return [];
    }
  }, [list, optionOf]);
  const options = useMemo(() => (choice ? [optionOf(choice)] : []), [choice, optionOf]);

  async function submit() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try { await onPick(choice.deviceId); } catch (e) { setError(errorMessage(e, a.giveFailed)); } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fill(a.addDeviceTitle, { name })}
      description={fill(a.addDeviceHint, { name })}
      closeLabel={m.common.close}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="primary" size="sm" loading={busy} disabled={!choice} onClick={() => void submit()}>{a.add}</Button>
        </div>
      )}
    >
      <div className="space-y-2">
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
        <ComboBox
          id={`iot-access-device-${id}`}
          label={a.pickDevice}
          placeholder={a.searchDevices}
          options={options}
          value={choice?.deviceId ?? ''}
          onChange={(key) => setChoice(key ? (seen.current.get(key) ?? null) : null)}
          onSearch={onSearch}
          error={failed ? a.devicesFailed : undefined}
          noResultsText={a.noDevices}
          messages={{ clear: a.clearChoice, loading: m.common.loading }}
        />
      </div>
    </Modal>
  );
}
