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

export type UseServerTableArgs<T> = {
  fetchPage: (args: DataTableFetchArgs) => Promise<DataTableFetchResult<T>>;
  initialPageSize?: number;
  initialSort?: SortState[];
  initialSearch?: string;
  initialFilters?: FilterState;
  /** 1-based page to start on. */
  initialPage?: number;
  /** Manual override of `state` for the consumer (e.g. external error). */
  externalError?: string | null;
  /** Filter-panel values sent as `filterValues`; a change by value refetches. */
  filterValues?: DataTableFilterValues;
  /** Any value; a change refetches the current page with the current query. */
  reloadKey?: unknown;
  /** `false` (default `true`): a click on another column replaces the sort even with shift held. */
  multiSort?: boolean;
  /** Maps the table's sort keys to the ones `fetchPage` receives (`Column.sortKey`). */
  wireSort?: (sort: SortState[]) => SortState[];
  /** Runs after each successful page load. */
  onLoaded?: (result: DataTableFetchResult<T>) => void;
};

export function useServerTable<T>({
  fetchPage,
  initialPageSize = 10,
  initialSort = [],
  initialSearch = '',
  initialFilters = {},
  initialPage = 1,
  externalError = null,
  filterValues,
  reloadKey,
  multiSort = true,
  wireSort,
  onLoaded,
}: UseServerTableArgs<T>) {
  // Keyed by value so a fresh object with the same filters does not refetch.
  const filterKey = JSON.stringify(filterValues ?? {});
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortState[]>(initialSort);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(externalError);
  /** Whether a page has ever arrived: later loads keep the old rows on screen under an overlay. */
  const [everLoaded, setEverLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchRef = useRef(fetchPage);
  const onLoadedRef = useRef(onLoaded);
  const wireSortRef = useRef(wireSort);
  useEffect(() => {
    fetchRef.current = fetchPage;
    onLoadedRef.current = onLoaded;
    wireSortRef.current = wireSort;
  });

  // A new query starts loading (and clears the previous error) in the same
  // render that requests it; an external error set by the caller wins.
  const [requested, setRequested] = useState<{
    page: number; pageSize: number; sort: SortState[]; search: string; filters: FilterState; filterKey: string;
    reloadKey: unknown; retryCount: number;
  } | null>(null);
  if (
    !requested ||
    requested.page !== page ||
    requested.pageSize !== pageSize ||
    requested.sort !== sort ||
    requested.search !== search ||
    requested.filters !== filters ||
    requested.filterKey !== filterKey ||
    !Object.is(requested.reloadKey, reloadKey) ||
    requested.retryCount !== retryCount
  ) {
    setRequested({ page, pageSize, sort, search, filters, filterKey, reloadKey, retryCount });
    setLoading(true);
    setError(null);
  }
  const [appliedExternalError, setAppliedExternalError] = useState<string | null | undefined>(undefined);
  if (appliedExternalError !== externalError) {
    setAppliedExternalError(externalError);
    setError(externalError);
  }

  useEffect(() => {
    // A newer query aborts this one; its late answer is dropped either way.
    const controller = new AbortController();
    const outSort = wireSortRef.current ? wireSortRef.current(sort) : sort;
    fetchRef
      .current({
        page,
        pageSize,
        sort: outSort,
        search,
        filters,
        filterValues: JSON.parse(filterKey),
        signal: controller.signal,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        setRows(res.rows);
        setTotal(res.total);
        setEverLoaded(true);
        setLoading(false);
        onLoadedRef.current?.(res);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // an empty message is still an error (null is none): the table then shows its own, translated `messages.error`
        setError(err instanceof Error ? err.message : '');
        setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, sort, search, filters, filterKey, reloadKey, retryCount]);

  // The last page can empty out (rows deleted elsewhere): step back to the new last page.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (everLoaded && !loading && page > totalPages) setPage(totalPages);

  const toggleSort = useCallback(
    (key: string, shiftKey: boolean) => {
      setSort((curr) => nextSortState(curr, key, multiSort && shiftKey));
      setPage(1);
    },
    [multiSort],
  );

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

  /** Load the current page again (the error state's Retry). */
  const retry = useCallback(() => setRetryCount((n) => n + 1), []);

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
    everLoaded,
    toggleSort,
    setColumnFilter,
    setGlobalSearch,
    changePageSize,
    setPage,
    setSort,
    setFilters,
    retry,
  };
}

export type UseServerTableReturn<T> = ReturnType<typeof useServerTable<T>>;
