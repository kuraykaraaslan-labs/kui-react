'use client';
import { useCallback, useMemo, useState } from 'react';
import type {
  Column,
  FilterState,
  SortDirection,
  SortState,
} from '../types';

// TODO M2: column show/hide, pinning, resize, reorder state
// TODO M4: single / range selection (multi-select and expansion live in useRowState)
// TODO M5: row grouping, inline-edit state

/**
 * Compare two values using a localeCompare with numeric awareness.
 * Returns negative if a<b, positive if a>b, 0 if equal.
 */
function compareValues(a: unknown, b: unknown): number {
  const av = a === undefined || a === null ? '' : a;
  const bv = b === undefined || b === null ? '' : b;
  return String(av).localeCompare(String(bv), undefined, { numeric: true });
}

/**
 * Apply multi-column sort. Sort entries are evaluated in order; the first
 * one that returns a non-zero comparison wins.
 */
export function applySort<T extends Record<string, unknown>>(
  rows: T[],
  sort: SortState[],
): T[] {
  if (!sort.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const cmp = compareValues(a[s.key as keyof T], b[s.key as keyof T]);
      if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/**
 * Filter rows by a global search query — case-insensitive substring match
 * across the stringified value of every column on every row.
 */
export function applySearch<T extends Record<string, unknown>>(
  rows: T[],
  columns: Column<T>[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    columns.some((col) => {
      if (col.render) {
        // Custom-render columns: fall back to raw key lookup if available.
        const raw = row[col.key as keyof T];
        if (raw === undefined || raw === null) return false;
        return String(raw).toLowerCase().includes(q);
      }
      return String(row[col.key as keyof T] ?? '')
        .toLowerCase()
        .includes(q);
    }),
  );
}

/**
 * Apply per-column filters (text contains / exact select-match).
 */
export function applyColumnFilters<T extends Record<string, unknown>>(
  rows: T[],
  columns: Column<T>[],
  filters: FilterState,
): T[] {
  const active = columns.filter((c) => c.filter && filters[String(c.key)]);
  if (active.length === 0) return rows;
  return rows.filter((row) =>
    active.every((col) => {
      const key = String(col.key);
      const target = String(row[col.key as keyof T] ?? '').toLowerCase();
      const filterValue = filters[key]?.toLowerCase() ?? '';
      if (!filterValue) return true;
      if (col.filter?.kind === 'select') return target === filterValue;
      return target.includes(filterValue);
    }),
  );
}

/**
 * Compute the next sort state given a key click. Mirrors the legacy
 * 3-state cycle (asc → desc → off) when shiftKey is not held. With shiftKey
 * the column is appended/toggled as a secondary sort.
 */
export function nextSortState(
  current: SortState[],
  key: string,
  shiftKey: boolean,
): SortState[] {
  const idx = current.findIndex((s) => s.key === key);
  // Without shift: clear other sorts, cycle on the clicked one.
  if (!shiftKey) {
    if (idx < 0) return [{ key, dir: 'asc' }];
    const existing = current[idx];
    if (existing.dir === 'asc') return [{ key, dir: 'desc' }];
    return []; // desc → off (clears).
  }
  // With shift: multi-column.
  const next = [...current];
  if (idx < 0) {
    next.push({ key, dir: 'asc' });
    return next;
  }
  const existing = next[idx];
  if (existing.dir === 'asc') {
    next[idx] = { key, dir: 'desc' };
    return next;
  }
  // desc → remove from multi-sort.
  next.splice(idx, 1);
  return next;
}

export type UseTableArgs<T extends Record<string, unknown>> = {
  rows: T[];
  columns: Column<T>[];
  initialSort?: SortState[];
  initialPageSize?: number;
  initialFilters?: FilterState;
  initialSearch?: string;
  /** Extra row filter (the filter panel); keep it stable between renders. */
  predicate?: (row: T) => boolean;
  /** `false` (default `true`): a click on another column replaces the sort even with shift held. */
  multiSort?: boolean;
};

/**
 * Client-side table state hook used by `mode="static" | "paginated"`.
 * Server mode lives in `useServerTable`.
 */
export function useTable<T extends Record<string, unknown>>({
  rows,
  columns,
  initialSort = [],
  initialPageSize = 10,
  initialFilters = {},
  initialSearch = '',
  predicate,
  multiSort = true,
}: UseTableArgs<T>) {
  const [sort, setSort] = useState<SortState[]>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const filtered = useMemo(() => {
    const narrowed = applyColumnFilters(applySearch(rows, columns, search), columns, filters);
    return predicate ? narrowed.filter(predicate) : narrowed;
  }, [rows, columns, search, filters, predicate]);
  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const toggleSort = useCallback(
    (key: string, shiftKey: boolean) => {
      setSort((curr) => nextSortState(curr, key, multiSort && shiftKey));
      setPage(1);
    },
    [multiSort],
  );

  const setColumnFilter = useCallback(
    (key: string, value: string) => {
      setFilters((curr) => {
        if (!value) {
          const next = { ...curr };
          delete next[key];
          return next;
        }
        return { ...curr, [key]: value };
      });
      setPage(1);
    },
    [],
  );

  const setGlobalSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const changePageSize = useCallback((n: number) => {
    setPageSize(n);
    setPage(1);
  }, []);

  return {
    // State
    sort,
    page: safePage,
    pageSize,
    search,
    filters,
    // Derived
    rows: sorted,
    total,
    totalPages,
    // Actions
    toggleSort,
    setColumnFilter,
    setGlobalSearch,
    changePageSize,
    setPage,
    setSort,
    setFilters,
  };
}

export type UseTableReturn<T extends Record<string, unknown>> = ReturnType<typeof useTable<T>>;

/** Re-export so callers can build a custom sort dir cycle if needed. */
export type { SortDirection };
