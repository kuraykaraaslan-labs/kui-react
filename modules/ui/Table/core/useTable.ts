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
// TODO M5: inline-edit state

/** Empty cells (`null`, `undefined`, `''`) sort last in both directions, like a server's NULLS LAST. */
function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/**
 * Compare two set values using a localeCompare with numeric awareness.
 * Returns negative if a<b, positive if a>b, 0 if equal.
 */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/**
 * Apply multi-column sort. Sort entries are evaluated in order; the first
 * one that returns a non-zero comparison wins. Empty values go last whatever the direction.
 */
export function applySort<T extends Record<string, unknown>>(
  rows: T[],
  sort: SortState[],
  /** The columns, for a column's own `sortValue`; without them each key reads `row[key]`. */
  columns?: readonly Column<T>[],
): T[] {
  if (!sort.length) return rows;
  const valueOf = new Map<string, (row: T) => unknown>();
  for (const s of sort) {
    const col = columns?.find((c) => String(c.key) === s.key);
    valueOf.set(s.key, col?.sortValue ?? ((row: T) => row[s.key as keyof T]));
  }
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const get = valueOf.get(s.key)!;
      const av = get(a);
      const bv = get(b);
      const ae = isEmptyValue(av);
      const be = isEmptyValue(bv);
      if (ae || be) {
        if (ae && be) continue;
        return ae ? 1 : -1;
      }
      const cmp = compareValues(av, bv);
      if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

/**
 * Filter rows by a global search query — case-insensitive substring match
 * across every searchable column (`Column.searchValue`, else `row[key]`) and the
 * table's extra `searchText`.
 */
export function applySearch<T extends Record<string, unknown>>(
  rows: T[],
  columns: Column<T>[],
  query: string,
  searchText?: (row: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  const searched = columns.filter((col) => col.searchable !== false);
  return rows.filter((row) => {
    if (searchText && searchText(row).toLowerCase().includes(q)) return true;
    return searched.some((col) => {
      const raw = col.searchValue ? col.searchValue(row) : row[col.key as keyof T];
      if (raw === undefined || raw === null) return false;
      return String(raw).toLowerCase().includes(q);
    });
  });
}

/**
 * Rows of one group together (`groupBy`), groups in the order they first appear in `order`
 * (the unsorted rows), each group keeping the order `rows` gave it (the sort).
 */
export function applyGrouping<T>(rows: T[], groupBy: (row: T) => string, order: readonly T[]): T[] {
  const rank = new Map<string, number>();
  for (const row of order) {
    const g = groupBy(row);
    if (!rank.has(g)) rank.set(g, rank.size);
  }
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const g = groupBy(row);
    if (!rank.has(g)) rank.set(g, rank.size);
    const list = buckets.get(g);
    if (list) list.push(row);
    else buckets.set(g, [row]);
  }
  return [...buckets.entries()]
    .sort((a, b) => (rank.get(a[0]) ?? 0) - (rank.get(b[0]) ?? 0))
    .flatMap(([, list]) => list);
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
  /** Extra text the search matches per row (keep it stable between renders). */
  searchText?: (row: T) => string;
  /** Keeps each group's rows together, sorted within the group (keep it stable between renders). */
  groupBy?: (row: T) => string;
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
  searchText,
  groupBy,
}: UseTableArgs<T>) {
  const [sort, setSort] = useState<SortState[]>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const filtered = useMemo(() => {
    const narrowed = applyColumnFilters(applySearch(rows, columns, search, searchText), columns, filters);
    return predicate ? narrowed.filter(predicate) : narrowed;
  }, [rows, columns, search, filters, predicate, searchText]);
  const sorted = useMemo(() => {
    const ordered = applySort(filtered, sort, columns);
    return groupBy ? applyGrouping(ordered, groupBy, rows) : ordered;
  }, [filtered, sort, columns, groupBy, rows]);

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
