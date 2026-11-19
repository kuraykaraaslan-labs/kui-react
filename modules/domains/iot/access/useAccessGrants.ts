'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, type IotAccessApi } from '../api/adapter';
import type { IotAccessGrant, IotAccessGrantQuery } from '../types/access';

/** The filters of a grant list: one subject's grants, one target's grants. */
export type AccessGrantFilter = Omit<IotAccessGrantQuery, 'page' | 'pageSize'>;

/** The page size the grants are read in (the host's own maximum) and the most rows one panel holds. */
export const ACCESS_READ_PAGE = 200;
export const ACCESS_ROWS_MAX = 1000;

/** Every grant of the filter, page by page, at most `ACCESS_ROWS_MAX`. */
async function readAll(api: IotAccessApi, base: AccessGrantFilter, signal?: AbortSignal): Promise<IotAccessGrant[]> {
  const all: IotAccessGrant[] = [];
  for (let page = 1; all.length < ACCESS_ROWS_MAX; page++) {
    const p = await api.listGrants({ ...base, page, pageSize: ACCESS_READ_PAGE }, signal);
    all.push(...p.items);
    if (!p.items.length || all.length >= p.total) break;
  }
  return all.slice(0, ACCESS_ROWS_MAX);
}

/**
 * Every grant of one subject or one target through `access.listGrants` (read page by page, at most `ACCESS_ROWS_MAX`), for the access
 * panels' tables: one subject's or one target's grants are a short list, so the table searches, sorts, filters and pages them in the
 * browser (`mode="paginated"`). Another filter reads again from scratch (nothing of the previous one on screen); `reloadKey` and `load`
 * read again (after a write).
 */
export function useAccessGrants(api: IotAccessApi | undefined, filter: AccessGrantFilter, loadErrorText: string, reloadKey = 0) {
  const filterKey = JSON.stringify(filter);
  const [rows, setRows] = useState<IotAccessGrant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readFor, setReadFor] = useState(filterKey);
  const seq = useRef(0);
  // another subject or target: nothing of the previous one on screen (state adjusted while rendering)
  if (readFor !== filterKey) {
    setReadFor(filterKey);
    setRows(null);
    setError(null);
  }

  const load = useCallback((signal?: AbortSignal) => {
    if (!api) return Promise.resolve();
    const mine = ++seq.current;
    return readAll(api, JSON.parse(filterKey) as AccessGrantFilter, signal).then(
      (all) => { if (!signal?.aborted && mine === seq.current) { setRows(all); setError(null); } },
      (e) => { if (!signal?.aborted && mine === seq.current) setError(errorMessage(e, loadErrorText)); },
    );
  }, [api, filterKey, loadErrorText]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, reloadKey]);

  return { rows, error, load };
}
