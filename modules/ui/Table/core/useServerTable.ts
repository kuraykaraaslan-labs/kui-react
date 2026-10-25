'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableFilterValues,
  FilterState,
  SortState,
} from '../types';
import { nextSortState } from './useTable';

// TODO M3: `keepPreviousData` semantic + abort-on-stale request handling.

export type UseServerTableArgs<T> = {
  fetchPage: (args: DataTableFetchArgs) => Promise<DataTableFetchResult<T>>;
  initialPageSize?: number;
  initialSort?: SortState[];
  initialSearch?: string;
  initialFilters?: FilterState;
  /** Manual override of `state` for the consumer (e.g. external error). */
  externalError?: string | null;
  /** Filter-panel values sent as `filterValues`; a change by value refetches. */
  filterValues?: DataTableFilterValues;
};

export function useServerTable<T>({
  fetchPage,
  initialPageSize = 10,
  initialSort = [],
  initialSearch = '',
  initialFilters = {},
  externalError = null,
  filterValues,
}: UseServerTableArgs<T>) {
  // Keyed by value so a fresh object with the same filters does not refetch.
  const filterKey = JSON.stringify(filterValues ?? {});
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortState[]>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(externalError);

  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  // Track the in-flight request key so a stale response doesn't clobber a newer
  // one. M1: just discard out-of-order responses. M3 will swap in AbortController.
  const reqIdRef = useRef(0);

  // A new query starts loading (and clears the previous error) in the same
  // render that requests it; an external error set by the caller wins.
  const [requested, setRequested] = useState<{
    page: number; pageSize: number; sort: SortState[]; search: string; filters: FilterState; filterKey: string;
  } | null>(null);
  if (
    !requested ||
    requested.page !== page ||
    requested.pageSize !== pageSize ||
    requested.sort !== sort ||
    requested.search !== search ||
    requested.filters !== filters ||
    requested.filterKey !== filterKey
  ) {
    setRequested({ page, pageSize, sort, search, filters, filterKey });
    setLoading(true);
    setError(null);
  }
  const [appliedExternalError, setAppliedExternalError] = useState<string | null | undefined>(undefined);
  if (appliedExternalError !== externalError) {
    setAppliedExternalError(externalError);
    setError(externalError);
  }

  useEffect(() => {
    const id = ++reqIdRef.current;
    let cancelled = false;
    fetchRef
      .current({ page, pageSize, sort, search, filters, filterValues: JSON.parse(filterKey) })
      .then((res) => {
        if (cancelled || id !== reqIdRef.current) return;
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled || id !== reqIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Fetch failed');
      })
      .finally(() => {
        if (cancelled || id !== reqIdRef.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, sort, search, filters, filterKey]);

  const toggleSort = useCallback((key: string, shiftKey: boolean) => {
    setSort((curr) => nextSortState(curr, key, shiftKey));
    setPage(1);
  }, []);

  const setColumnFilter = useCallback((key: string, value: string) => {
    setFilters((curr) => {
      if (!value) {
        const next = { ...curr };
        delete next[key];
        return next;
      }
      return { ...curr, [key]: value };
    });
    setPage(1);
  }, []);

  const setGlobalSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const changePageSize = useCallback((n: number) => {
    setPageSize(n);
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows,
    total,
    totalPages,
    page,
    pageSize,
    sort,
    search,
    filters,
    loading,
    error,
    toggleSort,
    setColumnFilter,
    setGlobalSearch,
    changePageSize,
    setPage,
    setSort,
    setFilters,
  };
}

export type UseServerTableReturn<T> = ReturnType<typeof useServerTable<T>>;
