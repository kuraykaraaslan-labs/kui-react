'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataTableQuery } from '@/modules/ui/Table/types';
import { errorMessage, type IotAccessApi } from '../api/adapter';
import type { IotAccessGrant, IotAccessGrantQuery } from '../types/access';

/** The filters of a grant page: one subject's grants, one target's grants. */
export type AccessGrantFilter = Omit<IotAccessGrantQuery, 'page' | 'pageSize'>;

export const ACCESS_PAGE_SIZE = 10;

/**
 * One page of grants through `access.listGrants` for the access panels' tables (manual DataTable mode): the rows, the total, a read
 * error, the page the table asks for. Another filter starts again at page 1; `reloadKey` reads the same page again (after a write).
 * `removedOne` reads again after a grant was removed, stepping back a page when the last row of a later page went.
 */
export function useAccessGrants(api: IotAccessApi | undefined, filter: AccessGrantFilter, loadErrorText: string, reloadKey = 0) {
  const filterKey = JSON.stringify(filter);
  const [paging, setPaging] = useState({ page: 1, pageSize: ACCESS_PAGE_SIZE });
  const [rows, setRows] = useState<IotAccessGrant[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readFor, setReadFor] = useState(filterKey);
  const seq = useRef(0);
  // another subject or target: its first page, nothing of the previous one on screen (state adjusted while rendering)
  if (readFor !== filterKey) {
    setReadFor(filterKey);
    setPaging((p) => ({ ...p, page: 1 }));
    setRows(null);
    setError(null);
  }

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    const mine = ++seq.current;
    const query: IotAccessGrantQuery = { ...(JSON.parse(filterKey) as AccessGrantFilter), page: paging.page, pageSize: paging.pageSize };
    return api.listGrants(query, signal).then(
      (p) => { if (!signal?.aborted && mine === seq.current) { setRows(p.items); setTotal(p.total); setError(null); } },
      (e) => { if (!signal?.aborted && mine === seq.current) setError(errorMessage(e, loadErrorText)); },
    );
  }, [api, filterKey, paging, loadErrorText]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, reloadKey]);

  const onQueryChange = useCallback((q: DataTableQuery) => {
    setPaging((prev) => (prev.page === q.page && prev.pageSize === q.pageSize ? prev : { page: q.page, pageSize: q.pageSize }));
  }, []);

  const removedOne = useCallback(() => {
    if ((rows?.length ?? 0) <= 1 && paging.page > 1) setPaging((p) => ({ ...p, page: p.page - 1 }));
    else void load();
  }, [rows, paging.page, load]);

  return { rows, total, error, paging, load, onQueryChange, removedOne };
}
