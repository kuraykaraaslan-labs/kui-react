'use client';
import { useCallback, useMemo, useState } from 'react';
import type { DataTableRowId } from '../types';

export type UseRowSelectionArgs = {
  /** Controlled selection. Leave undefined to let the table own it. */
  selectedRowIds?: readonly DataTableRowId[];
  /** Initial selection when uncontrolled. */
  defaultSelectedRowIds?: readonly DataTableRowId[];
  onSelectionChange?: (ids: DataTableRowId[]) => void;
};

/**
 * Row selection keyed by row id, never by position: a selection survives
 * sorting, filtering and paging because none of them change a row's id.
 */
export function useRowSelection({
  selectedRowIds,
  defaultSelectedRowIds = [],
  onSelectionChange,
}: UseRowSelectionArgs) {
  const [inner, setInner] = useState<readonly DataTableRowId[]>(defaultSelectedRowIds);
  const controlled = selectedRowIds !== undefined;
  const ids = controlled ? selectedRowIds : inner;
  const selected = useMemo(() => new Set(ids), [ids]);

  const commit = useCallback(
    (next: DataTableRowId[]) => {
      if (!controlled) setInner(next);
      onSelectionChange?.(next);
    },
    [controlled, onSelectionChange],
  );

  const toggle = useCallback(
    (id: DataTableRowId) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit([...next]);
    },
    [selected, commit],
  );

  /**
   * Header checkbox: selects the rows shown, or clears them when all are
   * already selected. Rows on other pages keep their state either way.
   */
  const toggleShown = useCallback(
    (shownIds: readonly DataTableRowId[]) => {
      const next = new Set(selected);
      const allShown = shownIds.length > 0 && shownIds.every((id) => next.has(id));
      for (const id of shownIds) {
        if (allShown) next.delete(id);
        else next.add(id);
      }
      commit([...next]);
    },
    [selected, commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  return { selected, count: ids.length, toggle, toggleShown, clear };
}

/** Which rows have their detail row open, keyed by row id. */
export function useRowExpansion() {
  const [expanded, setExpanded] = useState<ReadonlySet<DataTableRowId>>(new Set());
  const toggle = useCallback((id: DataTableRowId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return { expanded, toggle };
}

export type UseRowSelectionReturn = ReturnType<typeof useRowSelection>;
export type UseRowExpansionReturn = ReturnType<typeof useRowExpansion>;
