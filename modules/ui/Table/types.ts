// Shared types for the unified Table / DataTable family.
// All public type names live here so consumers can import a single namespace.

import type { CSSProperties, ReactNode } from 'react';

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
  /**
   * Cell content. The second argument (`index`: the row's position in the `rows` the host passed, in server mode in the
   * fetched page; `id`: its row id) lets an editable cell write back to its source row without wrapping rows.
   */
  render?: (row: T, ctx: CellContext) => ReactNode;
  /**
   * Static and paginated modes: the text the toolbar search matches for this column (a computed or rendered cell, a
   * name plus its key). Defaults to `row[key]`.
   */
  searchValue?: (row: T) => string;
  /** `false`: the toolbar search skips this column (static and paginated modes). Default `true`. */
  searchable?: boolean;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  /** M1: per-column filter popover config. Set to truthy to enable. */
  filter?: ColumnFilterConfig;
  /** Optional CSS class for the `<th>`. */
  thClass?: string;
  /** Optional CSS class for the `<td>`. */
  tdClass?: string;
  /** Inline style of the `<th>` (merged over `width`). */
  thStyle?: CSSProperties;
  /** Classes of one row's cell in this column, after `tdClass` (a value-driven colour, a sticky first column). */
  cellClassName?: (row: T) => string | undefined;
  /** Inline style of one row's cell in this column. */
  cellStyle?: (row: T) => CSSProperties | undefined;
  /**
   * Hide the column below this breakpoint, so a phone width needs no horizontal scroll.
   * Header, cells and footer all hide.
   */
  hideBelow?: ColumnBreakpoint;
  /**
   * The sort key the table reports outward (`fetchPage` args, `onQueryChange`) when it differs from `key`,
   * for example the API field `created_at` behind the column `createdAt`.
   */
  sortKey?: string;
  /** Footer cell (a total, a count). A `<tfoot>` row appears when any column has one. */
  footer?: ReactNode;
  /** CSS width of the column (`'8rem'`, `'20%'`). */
  width?: string;
  /**
   * Column chooser (`DataTable` `columnChooser`): `false` keeps the column on screen and out of the chooser (the name a
   * row is known by, a control column). Default `true`.
   */
  hideable?: boolean;
  /** Column chooser: hidden until the viewer shows it. */
  defaultHidden?: boolean;
};

export type ColumnBreakpoint = 'sm' | 'md' | 'lg';

/** What `Column.render` gets besides the row. */
export type CellContext = {
  /** Position of the row in the `rows` prop (server mode: in the fetched page); sorting and filtering leave it alone. */
  index: number;
  /** The row's id (`rowId`, else `row.id`, else its position). */
  id: DataTableRowId;
};

/**
 * Backwards-compatible alias preserved so legacy `TableColumn<T>` imports
 * keep working without source changes.
 */
export type TableColumn<T> = Column<T>;

/**
 * - `static`: every row shown, sorted and filtered in the browser.
 * - `paginated`: the same, a page at a time.
 * - `server`: `fetchPage` loads each page.
 * - `manual`: the host passes `rows` and `total` and fetches itself; the table reports its query
 *   (`onQueryChange`) and owns no data. For live lists and hosts with their own data hooks.
 */
export type DataTableMode = 'static' | 'paginated' | 'server' | 'manual';

/** Everything that decides which rows a page shows. Sort keys are the outward ones (`Column.sortKey`). */
export type DataTableQuery = {
  /** 1-based. */
  page: number;
  pageSize: number;
  sort: SortState[];
  search: string;
  /** Per-column header filters (`Column.filter`). */
  filters: FilterState;
  /** Applied filter-panel values that are set (`filterFields`). */
  filterValues: DataTableFilterValues;
};

/** Live state of a row (`rowState`): `new` highlights it, `leaving` fades it before the host drops it. */
export type DataTableRowState = 'new' | 'leaving' | undefined;

/** How rows are laid out: a table, or a grid of cards drawn by `renderCard`. */
export type DataTableLayout = 'table' | 'cards';

export type DataTableVariant = 'plain' | 'card';

export type DataTableDensity = 'comfortable' | 'compact';

/** What `renderCard` gets besides the row. */
export type DataTableCardContext = {
  id: DataTableRowId;
  /** Whether the row is selected (`selectable`). */
  selected: boolean;
  toggleSelected: () => void;
  /** Whether the row can be selected; a string is the reason it cannot. */
  selectable: true | string;
  /** Ticked and locked (`isRowSelectionLocked`): shown selected, cannot be changed, not in the selection. */
  locked: boolean;
  /** The row's actions menu (`rowActions`), to place inside the card; null without actions. */
  actions: ReactNode;
};

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
  /** Aborted when a newer query replaces this one (or the table unmounts); pass it to `fetch`/axios. */
  signal?: AbortSignal;
};

export type DataTableFilterOption = { label: string; value: string };

/** A bounded-or-not numeric range (`numberrange` field); either end may be empty. */
export type DataTableNumberRange = { min: number | null; max: number | null };

/**
 * A value of the filter panel. Every value serialises as-is, so it can go to a
 * server untouched: dates are `YYYY-MM-DD` strings, a date range is
 * `{ from, to }`, a slider range is `[min, max]`, a number range is `{ min, max }`.
 */
export type DataTableFilterValue =
  | string
  | string[]
  | number
  | boolean
  | [number, number]
  | { from: string | null; to: string | null }
  | DataTableNumberRange
  | null;

export type DataTableFilterValues = Record<string, DataTableFilterValue>;

/** A quick choice under a date-range field; `from` / `to` are `YYYY-MM-DD`. */
export type DataTableDatePreset = { label: string; from: string | null; to: string | null };

type DataTableFilterFieldBase<T> = {
  /** Key of the value; also the row key the default client-side match reads. */
  id: string;
  label: string;
  hint?: string;
  /** The field's value before anyone changes it (also what Reset returns to). */
  defaultValue?: DataTableFilterValue;
  /** Text of the field's active-filter chip; defaults to a readable form of the value. */
  formatChip?: (value: DataTableFilterValue) => string;
  /**
   * `select` and `radio`: a single choice that is always set (a status a server needs): no "Any" option, never
   * cleared by a chip or "Clear all", Reset and Clear all return it to `defaultValue` (else the first option). It has
   * no chip and is not counted on the Filters button.
   */
  required?: boolean;
  /**
   * `select` and `radio`: `toolbar` draws the field in the toolbar instead of the panel (radio as a segmented button
   * group, select as a labelled dropdown), applied at once. Default `panel`.
   */
  placement?: 'panel' | 'toolbar';
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
    /**
     * `presets: true` adds Today, Last 7 days, Last 30 days, This month and Last month under the
     * picker; a list gives your own.
     */
    | { type: 'daterange'; locale?: 'tr' | 'en'; presets?: boolean | DataTableDatePreset[] }
    /** A two-thumb slider; inactive while it spans the whole `min`–`max`. */
    | { type: 'range'; min: number; max: number; step?: number }
    /** Two number inputs (min, max) for values without known bounds (amounts, counts). */
    | { type: 'numberrange'; min?: number; max?: number; step?: number }
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
  /** Accessible name of the toolbar search input (the placeholder is a hint, not a name). */
  search?: string;
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
  /** Column header filter button; `{column}` is the column heading. */
  columnFilter?: string;
  editColumnFilter?: string;
  /** "Any value" option of a select header filter. */
  columnFilterAll?: string;
  /** Placeholder of a text header filter. */
  columnFilterContains?: string;
  /** Accessible name of the scrolling table region when there is no `caption`. */
  tableLabel?: string;
  /** Range under the table; `{start}`, `{end}` and `{total}` are filled in. */
  showingRange?: string;
  /** Range under the table when it holds no rows. */
  noResults?: string;
  /** Empty state while a search finds nothing; `{search}` is the query. */
  noResultsFor?: string;
  /** Appended to the range while the browser-side search narrows the rows; `{total}` is the unfiltered count. */
  filteredFrom?: string;
  /** Retry button of the error state. */
  retry?: string;
  /** Label of the "Sort by" select of the card layout. */
  sortBy?: string;
  /** The "Sort by" option that turns sorting off. */
  sortNone?: string;
  /** "Sort by" option text; `{column}` is the column heading. */
  sortAscending?: string;
  sortDescending?: string;
  /** Accessible name of the active-filter chips. */
  activeFilters?: string;
  /** Accessible label of a chip's remove button; `{filter}` is the chip text. */
  removeFilter?: string;
  /** Clears every filter, the chips and the column filters. */
  clearAllFilters?: string;
  /** Number-range inputs. */
  rangeMin?: string;
  rangeMax?: string;
  /** Date-range presets (`presets: true`). */
  presetToday?: string;
  presetLast7Days?: string;
  presetLast30Days?: string;
  presetThisMonth?: string;
  presetLastMonth?: string;
  /** Pagination labels (`Pagination` `labels`); `{page}` is a page number. */
  previousPage?: string;
  nextPage?: string;
  firstPage?: string;
  lastPage?: string;
  pageNumber?: string;
  /** Accessible name of the pagination landmark. */
  pagination?: string;
  /** The column chooser's toolbar button and panel (`columnChooser`). */
  columns?: string;
  /** Column chooser: back to the default columns. */
  resetColumns?: string;
  /** Column chooser: accessible text of the button's count; `{count}` is the number of hidden columns. */
  hiddenColumns?: string;
};

export const DEFAULT_MESSAGES: DataTableMessages = {
  empty: 'No results found.',
  loading: 'Loading…',
  error: 'Something went wrong.',
  searchPlaceholder: 'Search…',
  search: 'Search',
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
  columnFilter: 'Filter {column}',
  editColumnFilter: 'Edit filter on {column}',
  columnFilterAll: 'All',
  columnFilterContains: 'Contains…',
  tableLabel: 'Data table',
  showingRange: 'Showing {start}–{end} of {total}',
  noResults: 'No results',
  noResultsFor: 'No results for “{search}”',
  filteredFrom: '(filtered from {total})',
  retry: 'Retry',
  sortBy: 'Sort by',
  sortNone: 'Default order',
  sortAscending: '{column}, ascending',
  sortDescending: '{column}, descending',
  activeFilters: 'Active filters',
  removeFilter: 'Remove filter {filter}',
  clearAllFilters: 'Clear all',
  rangeMin: 'Min',
  rangeMax: 'Max',
  presetToday: 'Today',
  presetLast7Days: 'Last 7 days',
  presetLast30Days: 'Last 30 days',
  presetThisMonth: 'This month',
  presetLastMonth: 'Last month',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  firstPage: 'First page',
  lastPage: 'Last page',
  pageNumber: 'Page {page}',
  pagination: 'Pagination',
  columns: 'Columns',
  resetColumns: 'Reset',
  hiddenColumns: '{count} hidden',
};

/** Fills `{name}` placeholders of a message. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, name: string) =>
    name in values ? String(values[name]) : all,
  );
}

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
