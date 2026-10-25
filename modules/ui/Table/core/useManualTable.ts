'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataTableFilterValues, DataTableQuery, FilterState, SortState } from '../types';
import { nextSortState } from './useTable';

// `mode="manual"`: the host passes the rows and the total and fetches itself. The table owns
// (or, with `query`, mirrors) the query and reports every change through `onQueryChange`,
// including the first one on mount, so the host can fetch from that callback alone.

type OwnQuery = Pick<DataTableQuery, 'page' | 'pageSize' | 'sort' | 'search' | 'filters'>;

export type UseManualTableArgs = {
  /** Controlled query fields; a field left out stays with the table. Sort keys are the outward ones. */
  query?: Partial<DataTableQuery>;
  /** Initial query when uncontrolled. */
  defaultQuery?: Partial<DataTableQuery>;
  onQueryChange?: (query: DataTableQuery) => void;
  /** Rows across every page (drives the pagination). */
  total: number;
  /** Applied filter-panel values that are set; they ride along in the reported query. */
  filterValues: DataTableFilterValues;
  defaultPageSize: number;
  multiSort?: boolean;
  /** Column keys → outward sort keys, and back (`Column.sortKey`). */
  toWire: (sort: SortState[]) => SortState[];
  fromWire: (sort: SortState[]) => SortState[];
};

export function useManualTable({
  query,
  defaultQuery,
  onQueryChange,
  total,
  filterValues,
  defaultPageSize,
  multiSort = true,
  toWire,
  fromWire,
}: UseManualTableArgs) {
  const [inner, setInner] = useState<OwnQuery>(() => ({
    page: defaultQuery?.page ?? 1,
    pageSize: defaultQuery?.pageSize ?? defaultPageSize,
    sort: fromWire(defaultQuery?.sort ?? []),
    search: defaultQuery?.search ?? '',
    filters: defaultQuery?.filters ?? {},
  }));

  const current: OwnQuery = {
    page: query?.page ?? inner.page,
    pageSize: query?.pageSize ?? inner.pageSize,
    sort: query?.sort ? fromWire(query.sort) : inner.sort,
    search: query?.search ?? inner.search,
    filters: query?.filters ?? inner.filters,
  };

  const latest = useRef({ current, filterValues, onQueryChange, toWire });
  useEffect(() => {
    latest.current = { current, filterValues, onQueryChange, toWire };
  });

  // Never report the same query twice in a row (a controlled host feeding it back, a re-render).
  const reported = useRef<string | null>(null);
  const emit = useCallback((q: OwnQuery, fv: DataTableFilterValues) => {
    const out: DataTableQuery = { ...q, sort: latest.current.toWire(q.sort), filterValues: fv };
    const key = JSON.stringify(out);
    if (reported.current === key) return;
    reported.current = key;
    latest.current.onQueryChange?.(out);
  }, []);

  // Mount, and every applied change of the filter panel (which also returns to page 1).
  const filterKey = JSON.stringify(filterValues);
  const resetPending = useRef(false);
  useEffect(() => {
    const q = latest.current.current;
    emit(resetPending.current ? { ...q, page: 1 } : q, latest.current.filterValues);
    resetPending.current = false;
  }, [filterKey, emit]);

  const patch = useCallback(
    (next: Partial<OwnQuery>) => {
      setInner((prev) => ({ ...prev, ...next }));
      emit({ ...latest.current.current, ...next }, latest.current.filterValues);
    },
    [emit],
  );

  const toggleSort = useCallback(
    (columnKey: string, shiftKey: boolean) =>
      patch({ sort: nextSortState(latest.current.current.sort, columnKey, multiSort && shiftKey), page: 1 }),
    [patch, multiSort],
  );
  const setColumnFilter = useCallback(
    (columnKey: string, value: string) => {
      const next: FilterState = { ...latest.current.current.filters };
      if (value) next[columnKey] = value;
      else delete next[columnKey];
      patch({ filters: next, page: 1 });
    },
    [patch],
  );
  const setGlobalSearch = useCallback((v: string) => patch({ search: v, page: 1 }), [patch]);
  const changePageSize = useCallback((n: number) => patch({ pageSize: n, page: 1 }), [patch]);
  const setPage = useCallback((p: number) => patch({ page: p }), [patch]);
  const setFilters = useCallback((f: FilterState) => patch({ filters: f, page: 1 }), [patch]);
  const setSort = useCallback((sort: SortState[]) => patch({ sort, page: 1 }), [patch]);
  /** The filter panel was applied: back to page 1, reported together with the new values. */
  const resetPageForFilters = useCallback(() => {
    resetPending.current = true;
    setInner((prev) => ({ ...prev, page: 1 }));
  }, []);

  return {
    ...current,
    total,
    totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
    toggleSort,
    setColumnFilter,
    setGlobalSearch,
    changePageSize,
    setPage,
    setFilters,
    setSort,
    resetPageForFilters,
  };
}

export type UseManualTableReturn = ReturnType<typeof useManualTable>;
