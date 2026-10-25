// Shared types for the unified Table / DataTable family.
// All public type names live here so consumers can import a single namespace.

import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortState = {
  /** Column key. */
  key: string;
  /** Direction. */
  dir: SortDirection;
};

export type ColumnFilterKind = 'text' | 'select';

export type ColumnFilterConfig = {
  /** Filter kind — M1 only supports 'text' and 'select'. */
  kind: ColumnFilterKind;
  /** Placeholder text for text inputs. */
  placeholder?: string;
  /** Options for 'select' kind. */
  options?: { label: string; value: string }[];
};

export type FilterState = Record<string, string>;

export type PaginationState = {
  /** 1-based page index. */
  page: number;
  /** Rows per page. */
  pageSize: number;
};

/**
 * Column definition shared by every table mode.
 * Backwards compatible with the legacy `TableColumn<T>` shape.
 */
export type Column<T> = {
  key: keyof T | string;
  /**
   * Column heading.
   *
   * Widened from `string` to `ReactNode` so a header can carry a control —
   * a select-all checkbox, a help tooltip — without the consumer overlaying
   * one absolutely and hoping the alignment holds. Every existing `string`
   * header keeps working unchanged.
   */
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** M1: per-column filter popover config. Set to truthy to enable. */
  filter?: ColumnFilterConfig;
  /** Optional CSS class for the `<th>`. */
  thClass?: string;
  /** Optional CSS class for the `<td>`. */
  tdClass?: string;
};

/**
 * Backwards-compatible alias preserved so legacy `TableColumn<T>` imports
 * keep working without source changes.
 */
export type TableColumn<T> = Column<T>;

export type DataTableMode = 'static' | 'paginated' | 'server';

export type DataTableStateValue = 'empty' | 'loading' | 'error' | 'ready';

export type DataTableFetchArgs = {
  page: number;
  pageSize: number;
  sort: SortState[];
  search: string;
  /** Per-column header filters (`Column.filter`). */
  filters: FilterState;
  /** Active values of the filter panel (`filterFields`), keyed by field id. Empty fields are left out. */
  filterValues: DataTableFilterValues;
};

export type DataTableFilterOption = { label: string; value: string };

/**
 * A value of the filter panel. Every value serialises as-is, so it can go to a
 * server untouched: dates are `YYYY-MM-DD` strings, a date range is
 * `{ from, to }`, a numeric range is `[min, max]`.
 */
export type DataTableFilterValue =
  | string
  | string[]
  | number
  | boolean
  | [number, number]
  | { from: string | null; to: string | null }
  | null;

export type DataTableFilterValues = Record<string, DataTableFilterValue>;

type DataTableFilterFieldBase<T> = {
  /** Key of the value; also the row key the default client-side match reads. */
  id: string;
  label: string;
  hint?: string;
  /**
   * Static and paginated modes: whether a row passes this field's value.
   * Defaults to comparing `row[id]` by field type. Server mode ignores it.
   */
  match?: (row: T, value: DataTableFilterValue) => boolean;
};

/** One control of the `DataTable` filter panel (`filterFields`). */
export type DataTableFilterField<T = Record<string, unknown>> = DataTableFilterFieldBase<T> &
  (
    | { type: 'text'; placeholder?: string }
    | { type: 'number'; placeholder?: string; min?: number; max?: number; step?: number }
    /** Single choice from a dropdown; the empty "Any" option clears it. */
    | { type: 'select'; options: DataTableFilterOption[]; placeholder?: string }
    | { type: 'multiselect'; options: DataTableFilterOption[]; placeholder?: string }
    /** Several choices as a checkbox list. */
    | { type: 'checkboxes'; options: DataTableFilterOption[] }
    /** Single choice as radio buttons, with a leading "Any" option. */
    | { type: 'radio'; options: DataTableFilterOption[]; anyLabel?: string }
    /** One checkbox; `label` sits next to it and the value is `true` while ticked. */
    | { type: 'checkbox' }
    | { type: 'date'; locale?: 'tr' | 'en' }
    | { type: 'daterange'; locale?: 'tr' | 'en' }
    /** A two-thumb slider; inactive while it spans the whole `min`–`max`. */
    | { type: 'range'; min: number; max: number; step?: number }
    /** Anything else: render your own control and report its value. */
    | {
        type: 'custom';
        render: (ctx: {
          id: string;
          value: DataTableFilterValue | undefined;
          onChange: (value: DataTableFilterValue) => void;
        }) => ReactNode;
      }
  );

export type DataTableFetchResult<T> = {
  rows: T[];
  total: number;
  cursor?: string;
};

export type DataTableMessages = {
  empty: string;
  loading: string;
  error: string;
  searchPlaceholder: string;
  rowsPerPage: string;
  filter: string;
  clearFilter: string;
  apply: string;
  /** Accessible label of each row's actions button. */
  rowActions?: string;
  /** Screen-reader heading of the row-actions column. */
  actionsColumn?: string;
  /** Accessible label of the header checkbox (selects the rows shown). */
  selectAllRows?: string;
  /** Accessible label of a row's checkbox, followed by the row's number. */
  selectRow?: string;
  /** Selection summary above the table; `{count}` is the number of selected rows. */
  selectedCount?: string;
  /** Button that clears the selection. */
  clearSelection?: string;
  /** Accessible label of a collapsed row's expand button. */
  expandRow?: string;
  /** Accessible label of an expanded row's collapse button. */
  collapseRow?: string;
  /** Screen-reader heading of the expand column. */
  expandColumn?: string;
  /** The toolbar button that opens the filter panel, and the panel's name. */
  filters?: string;
  /** Empty choice of select and radio filter fields. */
  any?: string;
  /** Clears every filter-panel field. */
  resetFilters?: string;
};

export const DEFAULT_MESSAGES: DataTableMessages = {
  empty: 'No results found.',
  loading: 'Loading…',
  error: 'Something went wrong.',
  searchPlaceholder: 'Search…',
  rowsPerPage: 'Rows per page:',
  filter: 'Filter',
  clearFilter: 'Clear',
  apply: 'Apply',
  rowActions: 'Row actions',
  actionsColumn: 'Actions',
  selectAllRows: 'Select all shown rows',
  selectRow: 'Select row',
  selectedCount: '{count} selected',
  clearSelection: 'Clear selection',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  expandColumn: 'Details',
  filters: 'Filters',
  any: 'Any',
  resetFilters: 'Reset',
};

/**
 * Stable identity of a row, used by selection and expandable rows
 * (`DataTable` `rowId`).
 */
export type DataTableRowId = string | number;

/**
 * One entry of a row's actions menu (`DataTable` `rowActions`). Every per-row field also takes
 * a function of the row, so one descriptor list serves the whole table.
 */
export type DataTableRowAction<T> = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: (row: T) => void;
  /** Makes the action a link. */
  href?: string | ((row: T) => string | undefined);
  hidden?: boolean | ((row: T) => boolean);
  disabled?: boolean | ((row: T) => boolean);
  /** Shown under the label (and as its tooltip) while the action is disabled. */
  disabledReason?: string | ((row: T) => string | undefined);
  /** Danger styling, for delete-like actions. */
  destructive?: boolean;
  /** Position in the menu, like CSS `order`: missing counts as 0. */
  order?: number;
  /** Actions of a group sit together, split from other groups by a separator. */
  group?: string;
};
