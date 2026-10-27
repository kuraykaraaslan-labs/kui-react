'use client';
// Unified Table family — public entry point.
//
// Exposes:
// - <Table />              — low-level "dumb" table primitive (named export from ./Table)
// - <DataTable />          — unified rich table (modes: static | paginated | server | manual)
// - <AdvancedDataTable />  — @deprecated thin wrapper over <DataTable selectable renderExpanded />
// - <ServerDataTable />    — @deprecated thin wrapper rendering the legacy server-controlled card
//
// Older `modules/ui/{DataTable,AdvancedDataTable,ServerDataTable}.tsx` re-export
// from here so existing consumers keep working without source changes.

export { Table } from './Table';
export { DataTable } from './DataTable';
export type {
  DataTableProps,
  AdvancedDataTableRow,
} from './DataTable';
export type {
  Column,
  TableColumn,
  SortDirection,
  SortState,
  FilterState,
  PaginationState,
  ColumnFilterConfig,
  DataTableMode,
  DataTableStateValue,
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableMessages,
  DataTableRowAction,
  DataTableRowId,
  DataTableFilterField,
  DataTableFilterOption,
  DataTableFilterValue,
  DataTableFilterValues,
  DataTableQuery,
  DataTableRowState,
  DataTableLayout,
  DataTableVariant,
  DataTableDensity,
  DataTableCardContext,
  DataTableNumberRange,
  DataTableDatePreset,
  ColumnBreakpoint,
} from './types';
export { DEFAULT_MESSAGES, formatMessage } from './types';
export { resolveRowActions } from './parts/RowActionsCell';

// Core hooks — exposed for advanced consumers building bespoke layouts.
export { useTable } from './core/useTable';
export type { UseTableArgs, UseTableReturn } from './core/useTable';
export { useServerTable } from './core/useServerTable';
export { useManualTable } from './core/useManualTable';
export type { UseManualTableArgs, UseManualTableReturn } from './core/useManualTable';
export { useRowSelection, useRowExpansion } from './core/useRowState';
export { columnChoicesKey, useColumnVisibility } from './core/columnVisibility';
export {
  useFilterPanel,
  activeFilterValues,
  isFilterValueActive,
  matchFilterField,
  defaultFilterValues,
  builtInDatePresets,
  filterChipText,
  filterValueText,
} from './core/filterPanel';
export type { UseFilterPanelArgs, UseFilterPanelReturn } from './core/filterPanel';
export type {
  UseRowSelectionArgs,
  UseRowSelectionReturn,
  UseRowExpansionReturn,
} from './core/useRowState';
export type {
  UseServerTableArgs,
  UseServerTableReturn,
} from './core/useServerTable';

// ---------------------------------------------------------------------------
// Backwards-compatible thin wrappers for the deprecated names.
// ---------------------------------------------------------------------------

import { DataTable as UnifiedDataTable } from './DataTable';
import type { DataTableProps, AdvancedDataTableRow } from './DataTable';
import type { Column } from './types';
import type { ReactNode } from 'react';

/**
 * @deprecated Use `<DataTable mode="static" searchable={false} />` with `selectable`,
 * `renderExpanded` and `stickyHeader`. Kept as a thin wrapper so existing consumers
 * keep working; `onSelectionChange` still reports positions in `rows`.
 */
export function AdvancedDataTable<T extends Record<string, unknown>>(props: {
  columns: Column<T>[];
  rows: AdvancedDataTableRow<T>[];
  caption?: string;
  selectable?: boolean;
  stickyHeader?: boolean;
  emptyMessage?: string;
  onSelectionChange?: (selected: number[]) => void;
  className?: string;
}) {
  const { onSelectionChange } = props;
  return (
    <UnifiedDataTable<T>
      mode="static"
      searchable={false}
      columns={props.columns}
      rows={props.rows}
      rowId={(row) => props.rows.indexOf(row as AdvancedDataTableRow<T>)}
      renderExpanded={
        props.rows.some((row) => row._expanded !== undefined)
          ? (row) => (row as AdvancedDataTableRow<T>)._expanded
          : undefined
      }
      caption={props.caption}
      selectable={props.selectable}
      stickyHeader={props.stickyHeader}
      emptyMessage={props.emptyMessage}
      onSelectionChange={
        onSelectionChange && ((ids) => onSelectionChange(ids as number[]))
      }
      className={props.className}
    />
  );
}

/**
 * @deprecated Use `<DataTable mode="server" fetchPage={...} />`. Kept as a thin
 * wrapper for source-compatible migration.
 */
export function ServerDataTable<T extends Record<string, unknown>>(props: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    <UnifiedDataTable<T>
      columns={props.columns}
      rows={props.rows}
      caption={props.caption}
      emptyMessage={props.emptyMessage}
      onRowClick={props.onRowClick}
      className={props.className}
      serverControlled={{
        page: props.page,
        totalPages: props.totalPages,
        total: props.total,
        pageSize: props.pageSize,
        onPageChange: props.onPageChange,
        getRowKey: props.getRowKey,
        loading: props.loading,
        title: props.title,
        subtitle: props.subtitle,
        headerRight: props.headerRight,
        toolbar: props.toolbar,
      }}
    />
  );
}

export type { DataTableProps as DataTablePropsUnified };
