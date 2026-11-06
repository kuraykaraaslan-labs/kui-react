'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataTableQuery } from '@/modules/ui/Table/types';
import { confirmDialog } from '@/modules/ui/ConfirmDialog';
import { errorMessage, IotApiError, type IotListSort } from '../api/adapter';
import { toIotSort } from '../api/list-table';
import { useIotAdapter, useIotCapabilities, useIotNotify, useIotText } from '../api/IotAdapterProvider';
import { fill } from '../format';
import type { AssetRelation, RelationEntityType } from '../types/asset';
import { AssetRelationTable, RELATION_SORT_KEYS, relationWords, type RelationSortKey } from './AssetRelationTable';

/**
 * RelationsSection — the relations of one asset or one device (the asset drawer's Relations section; the device's "Placement &
 * relations" tab, NB 41-ui-fixes/26 1.3): `AssetRelationTable` read through the adapter, a page at a time with the host's search, sort
 * and type filter when the host pages them (`relationsPage`), else every row in the browser. Removing a relation asks first and names
 * both ends (a placement says the device is no longer placed); a relation already gone says so. `onChanged` runs after a removal (a
 * placement's end changes the counts, the devices and where a device is) and is expected to bump `reloadKey`, which reads the same page
 * again (without `onChanged` the section reads again itself).
 */
export type RelationsSectionProps = {
  entity: { type: RelationEntityType; id: string };
  hrefs?: { asset?: (assetId: string) => string; device?: (deviceId: string) => string };
  reloadKey?: number;
  pageSize?: number;
  onChanged?: () => void;
  onNavigate?: (href: string) => void;
  className?: string;
};

export function RelationsSection({ entity, hrefs = {}, reloadKey = 0, pageSize = 10, onChanged, onNavigate, className }: RelationsSectionProps) {
  const api = useIotAdapter().assets!;
  const caps = useIotCapabilities();
  const notify = useIotNotify();
  const { m } = useIotText();
  const paged = !!api.relationsPage;
  // the host's page with its search, sort and type filter (NB-only, 41-ui-fixes/25 1.15)
  const [paging, setPaging] = useState<{ page: number; pageSize: number; search?: string; sort?: IotListSort<RelationSortKey>; type?: string }>({ page: 1, pageSize });
  const [rows, setRows] = useState<AssetRelation[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seq = useRef(0);
  const { type: entityType, id: entityId } = entity;
  // a host that pages relations is read a page at a time (none dropped unseen); a write elsewhere (reloadKey) reads the same page again
  const load = useCallback((signal?: AbortSignal) => {
    const mine = ++seq.current;
    const at = { type: entityType, id: entityId };
    const read = api.relationsPage
      ? api.relationsPage(at, paging, signal)
      : api.relations!(at, signal).then((items) => ({ items, total: items.length }));
    return read.then(
      (r) => { if (!signal?.aborted && mine === seq.current) { setRows(r.items); setTotal(r.total); setError(null); } },
      (e) => { if (!signal?.aborted && mine === seq.current) setError(errorMessage(e, m.asset.loadError)); },
    );
  }, [api, entityType, entityId, paging, m.asset.loadError]);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load, reloadKey]);
  const changed = () => { if (onChanged) onChanged(); else void load(); };
  async function removeRelation(id: string, r: AssetRelation) {
    const words = relationWords(r, m);
    const placement = r.type === 'CONTAINS' && r.toType === 'DEVICE';
    const ok = await confirmDialog({
      title: m.asset.removeRelationConfirm,
      message: fill(placement ? m.asset.removePlacementHint : m.asset.removeRelationHint, words),
      tone: 'danger', confirmLabel: m.asset.removeRelation, cancelLabel: m.common.cancel,
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.removeRelation!(id);
      notify({ tone: 'success', message: m.asset.relationRemoved });
      // the last row of a later page gone: step back a page instead of reading an empty one
      if (paged && (rows?.length ?? 0) <= 1 && paging.page > 1) setPaging((p) => ({ ...p, page: p.page - 1 }));
      // a placement's end changes the devices and the counts too: the host reads everything again (its reloadKey), else the table does
      changed();
    } catch (e) {
      if (e instanceof IotApiError && e.code === 'not_found') {
        notify({ tone: 'info', message: m.asset.relationGone });
        changed();
      } else {
        notify({ tone: 'error', message: errorMessage(e, m.asset.failed) });
      }
    } finally {
      setBusyId(null);
    }
  }
  return (
    <AssetRelationTable
      className={className}
      rows={rows ?? []}
      hrefs={hrefs}
      onNavigate={onNavigate}
      loading={rows === null && !error}
      error={error}
      onRetry={() => void load()}
      busyId={busyId}
      {...(paged ? {
        total,
        query: { page: paging.page, pageSize: paging.pageSize },
        onQueryChange: (q: DataTableQuery) => {
          const sort = toIotSort(q.sort, RELATION_SORT_KEYS);
          const type = typeof q.filterValues.type === 'string' && q.filterValues.type ? q.filterValues.type : undefined;
          const next = {
            page: q.page, pageSize: q.pageSize,
            ...(q.search.trim() ? { search: q.search.trim() } : {}),
            ...(sort ? { sort } : {}),
            ...(type ? { type } : {}),
          };
          setPaging((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        },
      } : {})}
      onRemove={caps.canPlaceDevices && api.removeRelation ? (id, r) => void removeRelation(id, r) : undefined}
    />
  );
}
