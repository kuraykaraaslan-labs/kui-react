'use client';
import { cn } from '@/libs/utils/cn';
import { useId, useMemo, useState } from 'react';
import { Button } from '../Button';
import { Pagination } from '../Pagination';
import { HeaderCell } from './parts/HeaderCell';
import { BodyRow } from './parts/BodyRow';
import { Toolbar } from './parts/Toolbar';
import { StateRow } from './parts/EmptyState';
import { RowActionsCell } from './parts/RowActionsCell';
import {
  ExpandCell,
  ExpandHeaderCell,
  SelectAllHeaderCell,
  SelectCell,
} from './parts/RowExtras';
import { useTable } from './core/useTable';
import { useServerTable } from './core/useServerTable';
import { useRowExpansion, useRowSelection } from './core/useRowState';
import { matchFilterField, useFilterPanel } from './core/filterPanel';
import { FilterPanel, FilterToggle } from './parts/FilterPanel';
import type {
  Column,
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableFilterField,
  DataTableFilterValues,
  DataTableMessages,
  DataTableMode,
  DataTableRowAction,
  DataTableRowId,
  DataTableStateValue,
  SortState,
} from './types';
import { DEFAULT_MESSAGES } from './types';

// TODO M2: enableColumnResize, enableColumnReorder, pinnedColumns props.
// TODO M3: virtualize prop (TanStack Virtual).
// TODO M4: single / range selection, bulk-action toolbar.
// TODO M4: exportFormats prop, onTelemetry hook.
// TODO M5: groupBy, editable, onCellEdit props.
// TODO M6: ARIA grid pattern (role="grid"), roving tabindex, messages prop full coverage.

export type DataTableProps<T extends Record<string, unknown>> = {
  /** Column descriptors. */
  columns: Column<T>[];
  /** Rows — required for `mode="static" | "paginated"`. Ignored for `mode="server"` (use `fetchPage`). */
  rows?: T[];
  /** Table mode — defaults to `paginated` for backwards compatibility with the legacy `<DataTable />`. */
  mode?: DataTableMode;
  /**
   * Server-side fetcher. Required when `mode="server"`.
   * Called whenever sort / filter / search / pagination changes.
   */
  fetchPage?: (args: DataTableFetchArgs) => Promise<DataTableFetchResult<T>>;
  /** Caption — visually hidden, exposed to screen readers. */
  caption?: string;
  /** Render a search bar above the table. */
  searchable?: boolean;
  /** Placeholder for the search bar. */
  searchPlaceholder?: string;
  /** Default rows-per-page. */
  pageSize?: number;
  /** Page size options shown in the toolbar select. */
  pageSizeOptions?: number[];
  /** Custom empty-state message. */
  emptyMessage?: string;
  /** Custom loading message. */
  loadingMessage?: string;
  /** Custom error message. Takes precedence over `errorMessage` from `fetchPage` rejection. */
  errorMessage?: string;
  /**
   * Manual override of the data state. Useful when the consumer owns the
   * fetch lifecycle and wants to show loading/error skeletons.
   */
  state?: DataTableStateValue;
  /** Click handler for individual rows. */
  onRowClick?: (row: T) => void;
  /**
   * Per-row actions, shown as a menu in a trailing column (static, paginated and server modes).
   * Hidden actions are left out per row; a row with none left gets an empty cell.
   */
  rowActions?: DataTableRowAction<T>[];
  /** Accessible label of a row's actions button; a function names the row (e.g. "Actions for Acme"). */
  rowActionsLabel?: string | ((row: T) => string);
  /**
   * Stable id of a row, used by selection and expandable rows. Defaults to `row.id`
   * when it is a string or number, else the row's position in `rows` (server mode:
   * its position in the whole result). Pass it when rows can be inserted or removed,
   * or in server mode when the sort can change.
   */
  rowId?: (row: T) => DataTableRowId;
  /**
   * Adds a leading checkbox column. The header checkbox selects (or clears) the rows
   * shown; rows on other pages keep their state.
   */
  selectable?: boolean;
  /** Controlled selection, as row ids. */
  selectedRowIds?: readonly DataTableRowId[];
  /** Initial selection when uncontrolled. */
  defaultSelectedRowIds?: readonly DataTableRowId[];
  /** Fires with every selected row id, including rows on other pages. */
  onSelectionChange?: (ids: DataTableRowId[]) => void;
  /**
   * Detail content shown in a full-width row below a row while it is expanded.
   * Return `null` / `undefined` for rows without details; they get no toggle.
   */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Keeps the header visible while the body scrolls; the table is capped at 20rem high. */
  stickyHeader?: boolean;
  /**
   * Filter panel: a "Filters" toolbar button opens these controls (select, multiselect,
   * checkboxes, radio, checkbox, text, number, date, daterange, range, custom). Server
   * mode sends the set values to `fetchPage` as `filterValues`; the other modes match
   * rows (`row[field.id]` by field type, or the field's `match`).
   */
  filterFields?: DataTableFilterField<T>[];
  /** Controlled applied filter-panel values. */
  filterValues?: DataTableFilterValues;
  /** Initial applied filter-panel values when uncontrolled. */
  defaultFilterValues?: DataTableFilterValues;
  /** Fires on Apply / Reset (or on every edit with `filtersLive`). */
  onFilterValuesChange?: (values: DataTableFilterValues) => void;
  /** Apply every filter edit at once instead of on the Apply button. */
  filtersLive?: boolean;
  /** Open the filter panel on first render. */
  defaultFiltersOpen?: boolean;
  /** Optional message bundle for i18n. */
  messages?: Partial<DataTableMessages>;
  /** Initial sort. */
  initialSort?: SortState[];
  className?: string;
  /** Stable id used as a prefix for child element ids — falls back to React.useId(). */
  id?: string;
  /**
   * Legacy ServerDataTable props.
   * @deprecated Server-controlled props — prefer the unified `mode="server"` + `fetchPage` flow.
   */
  serverControlled?: {
    page: number;
    totalPages: number;
    total?: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    getRowKey: (row: T) => string;
    loading?: boolean;
    title?: string;
    subtitle?: string;
    headerRight?: React.ReactNode;
    toolbar?: React.ReactNode;
  };
};

/**
 * Legacy advanced-table row shape — accepts an `_expanded` slot for
 * expandable detail rows.
 * @deprecated Use `DataTable` `renderExpanded`.
 */
export type AdvancedDataTableRow<T> = T & {
  _expanded?: React.ReactNode;
};

export function DataTable<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
) {
  const generatedId = useId();
  const id = props.id ?? `dt-${generatedId.replace(/:/g, '')}`;

  // Legacy ServerDataTable branch — render the historical card shell.
  if (props.serverControlled) {
    return <LegacyServerView<T> {...props} id={id} />;
  }

  const mode: DataTableMode = props.mode ?? 'paginated';
  if (mode === 'server') {
    return <ServerView<T> {...props} id={id} />;
  }
  return <ClientView<T> {...props} mode={mode} id={id} />;
}

// ---------------------------------------------------------------------------
// Row actions: a trailing column, only when `rowActions` has entries.
// ---------------------------------------------------------------------------

function rowActionsParts<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
  msgs: DataTableMessages,
) {
  const { rowActions, rowActionsLabel } = props;
  const list = rowActions && rowActions.length > 0 ? rowActions : null;
  const labelFor = (row: T) =>
    typeof rowActionsLabel === 'function'
      ? rowActionsLabel(row)
      : (rowActionsLabel ?? msgs.rowActions ?? 'Row actions');
  return {
    enabled: list !== null,
    header: list ? (
      <th scope="col" className="w-12 px-2 py-3">
        <span className="sr-only">{msgs.actionsColumn ?? 'Actions'}</span>
      </th>
    ) : null,
    cell: (row: T) => (list ? <RowActionsCell<T> row={row} actions={list} label={labelFor(row)} /> : undefined),
  };
}

// ---------------------------------------------------------------------------
// Row selection, expandable rows and the sticky header (static, paginated and
// server modes). Both selection and expansion are keyed by row id.
// ---------------------------------------------------------------------------

type ShownRow<T> = {
  row: T;
  id: DataTableRowId;
  /** 1-based position in the whole result, used in the checkbox label. */
  number: number;
};

function resolveRowId<T extends Record<string, unknown>>(
  rowId: DataTableProps<T>['rowId'],
  row: T,
  fallback: number,
): DataTableRowId {
  if (rowId) return rowId(row);
  const own = row.id;
  return typeof own === 'string' || typeof own === 'number' ? own : fallback;
}

// ---------------------------------------------------------------------------
// Filter panel (`filterFields`): a toolbar toggle plus a panel of controls.
// ---------------------------------------------------------------------------

const NO_FILTER_FIELDS: never[] = [];

function useFilterParts<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
  msgs: DataTableMessages,
  tableId: string,
) {
  const fields: DataTableFilterField<T>[] = props.filterFields ?? NO_FILTER_FIELDS;
  const filter = useFilterPanel<T>({
    fields,
    value: props.filterValues,
    defaultValue: props.defaultFilterValues,
    onChange: props.onFilterValuesChange,
  });
  const [open, setOpen] = useState(props.defaultFiltersOpen ?? false);

  const { active } = filter;
  const predicate = useMemo(() => {
    const set = fields.filter((f) => f.id in active);
    if (set.length === 0) return undefined;
    return (row: T) => set.every((f) => matchFilterField(f, row, active[f.id]));
  }, [fields, active]);

  const panelId = `${tableId}-filters`;
  const enabled = fields.length > 0;

  /** Toolbar toggle and panel; `onApplied` runs after the values change (back to page 1). */
  function parts(onApplied: () => void) {
    if (!enabled) return { toggle: undefined, panel: null };
    return {
      toggle: (
        <FilterToggle
          controls={open ? panelId : undefined}
          open={open}
          activeCount={filter.activeCount}
          label={msgs.filters ?? 'Filters'}
          onToggle={() => setOpen((o) => !o)}
        />
      ),
      panel: open ? (
        <FilterPanel<T>
          id={panelId}
          fields={fields}
          applied={filter.applied}
          live={props.filtersLive ?? false}
          msgs={msgs}
          onApply={(values) => {
            filter.commit(values);
            onApplied();
          }}
        />
      ) : null,
    };
  }

  return { enabled, active, predicate, parts };
}

function useRowExtras<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
  msgs: DataTableMessages,
  tableId: string,
  shown: ShownRow<T>[],
) {
  const { selectable = false, renderExpanded, stickyHeader = false } = props;
  const selection = useRowSelection({
    selectedRowIds: props.selectedRowIds,
    defaultSelectedRowIds: props.defaultSelectedRowIds,
    onSelectionChange: props.onSelectionChange,
  });
  const expansion = useRowExpansion();
  const expandable = renderExpanded !== undefined;

  const shownIds = shown.map((s) => s.id);
  const shownSelected = shownIds.filter((rid) => selection.selected.has(rid)).length;
  const allShownSelected = shownIds.length > 0 && shownSelected === shownIds.length;

  const header = (
    <>
      {selectable && (
        <SelectAllHeaderCell
          checked={allShownSelected}
          indeterminate={shownSelected > 0 && !allShownSelected}
          disabled={shownIds.length === 0}
          label={msgs.selectAllRows ?? 'Select all shown rows'}
          onChange={() => selection.toggleShown(shownIds)}
        />
      )}
      {expandable && <ExpandHeaderCell label={msgs.expandColumn ?? 'Details'} />}
    </>
  );

  function row(s: ShownRow<T>, totalCols: number) {
    const isSelected = selectable && selection.selected.has(s.id);
    const content = renderExpanded?.(s.row);
    const hasDetail = content !== null && content !== undefined && content !== false;
    const isOpen = hasDetail && expansion.expanded.has(s.id);
    const detailId = `${tableId}-detail-${String(s.id).replace(/[^\w-]/g, '_')}`;
    return {
      selected: isSelected,
      leading:
        selectable || expandable ? (
          <>
            {selectable && (
              <SelectCell
                checked={isSelected}
                label={`${msgs.selectRow ?? 'Select row'} ${s.number}`}
                onChange={() => selection.toggle(s.id)}
              />
            )}
            {expandable && (
              <ExpandCell
                expandable={hasDetail}
                expanded={isOpen}
                controls={detailId}
                label={isOpen ? (msgs.collapseRow ?? 'Collapse row') : (msgs.expandRow ?? 'Expand row')}
                onToggle={() => expansion.toggle(s.id)}
              />
            )}
          </>
        ) : undefined,
      detail: isOpen ? { id: detailId, content, colSpan: totalCols } : undefined,
    };
  }

  const summary =
    selectable && selection.count > 0 ? (
      <div className="flex items-center gap-2" data-part="selection-summary">
        <p className="text-xs text-text-secondary">
          {(msgs.selectedCount ?? '{count} selected').replace('{count}', String(selection.count))}
        </p>
        <Button variant="ghost" size="xs" onClick={selection.clear}>
          {msgs.clearSelection ?? 'Clear selection'}
        </Button>
      </div>
    ) : null;

  return {
    header,
    row,
    summary,
    /** Columns added before the data columns. */
    leadingCount: (selectable ? 1 : 0) + (expandable ? 1 : 0),
    scrollClass: stickyHeader ? 'overflow-auto max-h-80' : 'overflow-x-auto',
    theadClass: stickyHeader ? 'sticky top-0 z-10' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Client view: static + paginated modes share this implementation.
// ---------------------------------------------------------------------------

function ClientView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { mode: DataTableMode; id: string },
) {
  const {
    columns,
    rows = [],
    caption,
    searchable: searchableProp,
    searchPlaceholder,
    pageSize: defaultPageSize = 10,
    pageSizeOptions = [5, 10, 25, 50],
    emptyMessage,
    state,
    loadingMessage,
    errorMessage,
    onRowClick,
    messages,
    initialSort = [],
    className,
    mode,
    id,
  } = props;

  const msgs: DataTableMessages = { ...DEFAULT_MESSAGES, ...messages };
  const searchable = searchableProp ?? true;
  const isStatic = mode === 'static';
  const actions = rowActionsParts(props, msgs);
  const filterUi = useFilterParts(props, msgs, id);

  const table = useTable<T>({
    rows,
    columns,
    initialSort,
    initialPageSize: isStatic ? Math.max(rows.length, defaultPageSize) : defaultPageSize,
    predicate: filterUi.predicate,
  });
  const filterParts = filterUi.parts(() => table.setPage(1));

  const total = table.total;
  const pageRows = isStatic
    ? table.rows
    : table.rows.slice(
        (table.page - 1) * table.pageSize,
        table.page * table.pageSize,
      );

  const start = total === 0 ? 0 : (table.page - 1) * table.pageSize + 1;
  const end = Math.min(table.page * table.pageSize, total);

  const resolvedState: DataTableStateValue =
    state ?? (pageRows.length === 0 ? 'empty' : 'ready');

  // A row without `rowId` / `id` falls back to its position in `rows`, which
  // sorting, filtering and paging leave alone.
  const sourceIndex = useMemo(() => new Map(rows.map((r, i) => [r, i])), [rows]);
  const shown = pageRows.map((row, i) => ({
    row,
    id: resolveRowId(props.rowId, row, sourceIndex.get(row) ?? i),
    number: start + i,
  }));
  const extras = useRowExtras(props, msgs, id, shown);
  const totalCols = extras.leadingCount + columns.length + (actions.enabled ? 1 : 0);

  return (
    <div className={cn('space-y-3', className)} data-dt-id={id}>
      {(searchable || filterUi.enabled) && (
        <Toolbar
          id={id}
          extra={filterParts.toggle}
          searchable={searchable}
          searchValue={table.search}
          searchPlaceholder={searchPlaceholder ?? msgs.searchPlaceholder}
          onSearchChange={table.setGlobalSearch}
          pageSize={isStatic ? undefined : table.pageSize}
          pageSizeOptions={isStatic ? undefined : pageSizeOptions}
          onPageSizeChange={isStatic ? undefined : table.changePageSize}
          rowsPerPageLabel={msgs.rowsPerPage}
        />
      )}

      {filterParts.panel}

      {extras.summary}

      <div
        className={cn('w-full rounded-lg border border-border', extras.scrollClass)}
        tabIndex={0}
        role="region"
        aria-label={caption ?? 'Data table'}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn('bg-surface-sunken border-b border-border', extras.theadClass)}>
            <tr>
              {extras.header}
              {columns.map((col) => (
                <HeaderCell
                  key={String(col.key)}
                  column={col}
                  sort={table.sort}
                  filterValue={table.filters[String(col.key)] ?? ''}
                  onToggleSort={table.toggleSort}
                  onSetFilter={table.setColumnFilter}
                />
              ))}
              {actions.header}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface-base">
            {resolvedState !== 'ready' ? (
              <StateRow
                state={resolvedState as 'empty' | 'loading' | 'error'}
                colSpan={totalCols}
                message={
                  resolvedState === 'loading'
                    ? (loadingMessage ?? msgs.loading)
                    : resolvedState === 'error'
                      ? (errorMessage ?? msgs.error)
                      : table.search && total === 0
                        ? `No results for "${table.search}"`
                        : (emptyMessage ?? msgs.empty)
                }
              />
            ) : (
              shown.map((s) => (
                <BodyRow
                  key={String(s.id)}
                  row={s.row}
                  columns={columns}
                  onClick={onRowClick}
                  actions={actions.cell(s.row)}
                  {...extras.row(s, totalCols)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isStatic && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-text-secondary">
            {total === 0
              ? 'No results'
              : `Showing ${start}–${end} of ${total}${table.search ? ` (filtered from ${rows.length})` : ''}`}
          </p>
          <Pagination
            page={table.page}
            totalPages={table.totalPages}
            onPageChange={table.setPage}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server view: mode="server" — fetchPage owns the data.
// ---------------------------------------------------------------------------

function ServerView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { id: string },
) {
  const {
    columns,
    fetchPage,
    caption,
    searchable: searchableProp,
    searchPlaceholder,
    pageSize: defaultPageSize = 10,
    pageSizeOptions = [5, 10, 25, 50],
    emptyMessage,
    state: stateOverride,
    loadingMessage,
    errorMessage,
    onRowClick,
    messages,
    initialSort = [],
    className,
    id,
  } = props;

  const msgs: DataTableMessages = { ...DEFAULT_MESSAGES, ...messages };
  const searchable = searchableProp ?? true;
  const actions = rowActionsParts(props, msgs);
  const filterUi = useFilterParts(props, msgs, id);

  if (!fetchPage) {
    throw new Error('DataTable mode="server" requires a `fetchPage` prop.');
  }

  const table = useServerTable<T>({
    fetchPage,
    initialPageSize: defaultPageSize,
    initialSort,
    filterValues: filterUi.active,
  });
  const filterParts = filterUi.parts(() => table.setPage(1));

  const resolvedState: DataTableStateValue =
    stateOverride ??
    (table.loading
      ? 'loading'
      : table.error
        ? 'error'
        : table.rows.length === 0
          ? 'empty'
          : 'ready');

  const start = table.total === 0 ? 0 : (table.page - 1) * table.pageSize + 1;
  const end = Math.min(table.page * table.pageSize, table.total);

  const offset = (table.page - 1) * table.pageSize;
  const shown = table.rows.map((row, i) => ({
    row,
    id: resolveRowId(props.rowId, row, offset + i),
    number: offset + i + 1,
  }));
  const extras = useRowExtras(props, msgs, id, shown);
  const totalCols = extras.leadingCount + columns.length + (actions.enabled ? 1 : 0);

  return (
    <div className={cn('space-y-3', className)} data-dt-id={id}>
      <Toolbar
        id={id}
        extra={filterParts.toggle}
        searchable={searchable}
        searchValue={table.search}
        searchPlaceholder={searchPlaceholder ?? msgs.searchPlaceholder}
        onSearchChange={table.setGlobalSearch}
        pageSize={table.pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={table.changePageSize}
        rowsPerPageLabel={msgs.rowsPerPage}
      />

      {filterParts.panel}

      {extras.summary}

      <div
        className={cn('w-full rounded-lg border border-border', extras.scrollClass)}
        tabIndex={0}
        role="region"
        aria-label={caption ?? 'Data table'}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className={cn('bg-surface-sunken border-b border-border', extras.theadClass)}>
            <tr>
              {extras.header}
              {columns.map((col) => (
                <HeaderCell
                  key={String(col.key)}
                  column={col}
                  sort={table.sort}
                  filterValue={table.filters[String(col.key)] ?? ''}
                  onToggleSort={table.toggleSort}
                  onSetFilter={table.setColumnFilter}
                />
              ))}
              {actions.header}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface-base">
            {resolvedState !== 'ready' ? (
              <StateRow
                state={resolvedState as 'empty' | 'loading' | 'error'}
                colSpan={totalCols}
                message={
                  resolvedState === 'loading'
                    ? (loadingMessage ?? msgs.loading)
                    : resolvedState === 'error'
                      ? (errorMessage ?? table.error ?? msgs.error)
                      : (emptyMessage ?? msgs.empty)
                }
              />
            ) : (
              shown.map((s) => (
                <BodyRow
                  key={String(s.id)}
                  row={s.row}
                  columns={columns}
                  onClick={onRowClick}
                  actions={actions.cell(s.row)}
                  {...extras.row(s, totalCols)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-text-secondary">
          {table.total === 0
            ? 'No results'
            : `Showing ${start}–${end} of ${table.total}`}
        </p>
        <Pagination
          page={table.page}
          totalPages={table.totalPages}
          onPageChange={table.setPage}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legacy ServerDataTable surface — card shell + server-controlled pagination.
// ---------------------------------------------------------------------------

function LegacyServerView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { id: string },
) {
  const {
    columns,
    rows = [],
    caption,
    emptyMessage = 'No results found.',
    onRowClick,
    className,
    serverControlled,
  } = props;

  if (!serverControlled) return null;

  const {
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    getRowKey,
    loading = false,
    title,
    subtitle,
    headerRight,
    toolbar,
  } = serverControlled;

  const safeTotalPages = Math.max(1, totalPages);
  const rangeStart =
    total !== undefined && pageSize ? (page - 1) * pageSize + 1 : null;
  const rangeEnd =
    total !== undefined && pageSize ? Math.min(page * pageSize, total) : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-raised shadow-sm overflow-hidden',
        className,
      )}
    >
      {(title || headerRight) && (
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-text-primary">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}

      {toolbar && <div className="px-6 pt-4 pb-0">{toolbar}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={caption ?? 'Data table'}
        >
          <table className="w-full text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-border bg-surface-sunken">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    scope="col"
                    className={cn(
                      'px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right',
                      !col.align && 'text-left',
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-base">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-10 text-center text-sm text-text-secondary"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'hover:bg-surface-overlay transition-colors',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={cn(
                          'px-6 py-4 text-text-primary',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right',
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : String(row[col.key as keyof T] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-border flex-wrap">
          <p className="text-xs text-text-secondary">
            {total !== undefined && rangeStart !== null && rangeEnd !== null
              ? `Showing ${rangeStart}–${rangeEnd} of ${total}`
              : total !== undefined
                ? `${total} result${total !== 1 ? 's' : ''}`
                : null}
          </p>
          <Pagination
            page={page}
            totalPages={safeTotalPages}
            onPageChange={onPageChange}
            showFirstLast
          />
        </div>
      )}
    </div>
  );
}
