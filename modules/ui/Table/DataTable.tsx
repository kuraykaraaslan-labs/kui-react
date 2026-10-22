'use client';
import { cn } from '@/libs/utils/cn';
import { useId, useState } from 'react';
import { Pagination } from '../Pagination';
import { HeaderCell } from './parts/HeaderCell';
import { BodyRow } from './parts/BodyRow';
import { Toolbar } from './parts/Toolbar';
import { StateRow } from './parts/EmptyState';
import { RowActionsCell } from './parts/RowActionsCell';
import { useTable } from './core/useTable';
import { useServerTable } from './core/useServerTable';
import { cellClassFor } from './core/columnHelpers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import type {
  Column,
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableMessages,
  DataTableMode,
  DataTableRowAction,
  DataTableStateValue,
  SortState,
} from './types';
import { DEFAULT_MESSAGES } from './types';

// TODO M2: enableColumnResize, enableColumnReorder, pinnedColumns props.
// TODO M3: virtualize prop (TanStack Virtual).
// TODO M4: selectable, selectedRowIds, onSelectionChange (multi/range), bulk-action toolbar.
// TODO M4: exportFormats prop, onTelemetry hook.
// TODO M5: groupBy, expandable, editable, onCellEdit props.
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
  /** Optional message bundle for i18n. */
  messages?: Partial<DataTableMessages>;
  /** Initial sort. */
  initialSort?: SortState[];
  className?: string;
  /** Stable id used as a prefix for child element ids — falls back to React.useId(). */
  id?: string;
  /**
   * Legacy `AdvancedDataTable` props — preserved so the deprecated alias keeps
   * working without source changes. Will move to dedicated props in M4/M5.
   * @deprecated Use selection / expandable props (coming in M4/M5).
   */
  legacyAdvancedRows?: AdvancedDataTableRow<T>[];
  /** @deprecated Will be replaced by `selectable: 'single' | 'multi'` in M4. */
  selectable?: boolean;
  /** @deprecated Will be replaced by `enableStickyHeader` plugin in M2. */
  stickyHeader?: boolean;
  /** @deprecated Will be replaced by typed selection state in M4. */
  onSelectionChange?: (selected: number[]) => void;
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
 */
export type AdvancedDataTableRow<T> = T & {
  _expanded?: React.ReactNode;
};

export function DataTable<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
) {
  const generatedId = useId();
  const id = props.id ?? `dt-${generatedId.replace(/:/g, '')}`;

  // Legacy AdvancedDataTable branch — preserves the historical render path.
  if (props.legacyAdvancedRows !== undefined) {
    return <LegacyAdvancedView<T> {...props} id={id} />;
  }

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

  const table = useTable<T>({
    rows,
    columns,
    initialSort,
    initialPageSize: isStatic ? Math.max(rows.length, defaultPageSize) : defaultPageSize,
  });

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

  return (
    <div className={cn('space-y-3', className)} data-dt-id={id}>
      {(searchable || (!isStatic && searchable)) && (
        <Toolbar
          id={id}
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

      <div
        className="w-full overflow-x-auto rounded-lg border border-border"
        tabIndex={0}
        role="region"
        aria-label={caption ?? 'Data table'}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-surface-sunken border-b border-border">
            <tr>
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
                colSpan={columns.length + (actions.enabled ? 1 : 0)}
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
              pageRows.map((row, i) => (
                <BodyRow
                  key={i}
                  row={row}
                  columns={columns}
                  onClick={onRowClick}
                  actions={actions.cell(row)}
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

  if (!fetchPage) {
    throw new Error('DataTable mode="server" requires a `fetchPage` prop.');
  }

  const table = useServerTable<T>({
    fetchPage,
    initialPageSize: defaultPageSize,
    initialSort,
  });

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

  return (
    <div className={cn('space-y-3', className)} data-dt-id={id}>
      <Toolbar
        id={id}
        searchable={searchable}
        searchValue={table.search}
        searchPlaceholder={searchPlaceholder ?? msgs.searchPlaceholder}
        onSearchChange={table.setGlobalSearch}
        pageSize={table.pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={table.changePageSize}
        rowsPerPageLabel={msgs.rowsPerPage}
      />

      <div
        className="w-full overflow-x-auto rounded-lg border border-border"
        tabIndex={0}
        role="region"
        aria-label={caption ?? 'Data table'}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-surface-sunken border-b border-border">
            <tr>
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
                colSpan={columns.length + (actions.enabled ? 1 : 0)}
                message={
                  resolvedState === 'loading'
                    ? (loadingMessage ?? msgs.loading)
                    : resolvedState === 'error'
                      ? (errorMessage ?? table.error ?? msgs.error)
                      : (emptyMessage ?? msgs.empty)
                }
              />
            ) : (
              table.rows.map((row, i) => (
                <BodyRow
                  key={i}
                  row={row}
                  columns={columns}
                  onClick={onRowClick}
                  actions={actions.cell(row)}
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
// Legacy AdvancedDataTable visual surface — render path preserved verbatim.
// ---------------------------------------------------------------------------

function LegacyAdvancedView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { id: string },
) {
  const {
    columns,
    legacyAdvancedRows = [],
    caption,
    selectable = false,
    stickyHeader = false,
    emptyMessage = 'No results found.',
    onSelectionChange,
    className,
  } = props;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      onSelectionChange?.([...next]);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === legacyAdvancedRows.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const all = new Set(legacyAdvancedRows.map((_, i) => i));
      setSelected(all);
      onSelectionChange?.([...all]);
    }
  }

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const allSelected =
    legacyAdvancedRows.length > 0 && selected.size === legacyAdvancedRows.length;
  const someSelected =
    selected.size > 0 && selected.size < legacyAdvancedRows.length;
  const hasAnyExpand = legacyAdvancedRows.some((r) => r._expanded !== undefined);
  const totalCols =
    columns.length + (selectable ? 1 : 0) + (hasAnyExpand ? 1 : 0);

  return (
    <div className={cn('space-y-2', className)}>
      {selectable && selected.size > 0 && (
        <p className="text-xs text-text-secondary">
          {selected.size} of {legacyAdvancedRows.length} row
          {legacyAdvancedRows.length !== 1 ? 's' : ''} selected
        </p>
      )}
      <div
        className={cn(
          'w-full rounded-lg border border-border',
          stickyHeader && 'overflow-auto max-h-80',
        )}
        {...(stickyHeader ? { tabIndex: 0, role: 'region', 'aria-label': caption ?? 'Data table' } : {})}
      >
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead
            className={cn(
              'bg-surface-sunken border-b border-border',
              stickyHeader && 'sticky top-0 z-10',
            )}
          >
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 focus-visible:ring-2 focus-visible:ring-border-focus"
                  />
                </th>
              )}
              {hasAnyExpand && (
                <th scope="col" className="w-10 px-4 py-3" aria-label="Expand" />
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider',
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
            {legacyAdvancedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-4 py-10 text-center text-sm text-text-secondary"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              legacyAdvancedRows.map((row, i) => {
                const isSelected = selected.has(i);
                const isExpanded = expanded.has(i);
                const hasExpand = row._expanded !== undefined;

                return (
                  <LegacyAdvancedRow
                    key={i}
                    row={row}
                    rowIndex={i}
                    columns={columns}
                    selectable={selectable}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    hasExpand={hasExpand}
                    hasAnyExpand={hasAnyExpand}
                    totalCols={totalCols}
                    onToggleRow={toggleRow}
                    onToggleExpand={toggleExpand}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LegacyAdvancedRow<T extends Record<string, unknown>>({
  row,
  rowIndex,
  columns,
  selectable,
  isSelected,
  isExpanded,
  hasExpand,
  hasAnyExpand,
  totalCols,
  onToggleRow,
  onToggleExpand,
}: {
  row: AdvancedDataTableRow<T>;
  rowIndex: number;
  columns: Column<T>[];
  selectable: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  hasExpand: boolean;
  hasAnyExpand: boolean;
  totalCols: number;
  onToggleRow: (i: number) => void;
  onToggleExpand: (i: number) => void;
}) {
  return (
    <>
      <tr
        className={cn(
          'hover:bg-surface-overlay transition-colors',
          isSelected && 'bg-primary-subtle',
        )}
      >
        {selectable && (
          <td className="w-10 px-4 py-3">
            <input
              type="checkbox"
              aria-label={`Select row ${rowIndex + 1}`}
              checked={isSelected}
              onChange={() => onToggleRow(rowIndex)}
              className="h-4 w-4 focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </td>
        )}
        {hasExpand && (
          <td className="w-10 px-4 py-3">
            <button
              type="button"
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              aria-expanded={isExpanded}
              onClick={() => onToggleExpand(rowIndex)}
              className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                className="w-2.5 h-2.5"
                aria-hidden="true"
              />
            </button>
          </td>
        )}
        {!hasExpand && hasAnyExpand && <td className="w-10 px-4 py-3" />}
        {columns.map((col) => (
          <td
            key={String(col.key)}
            className={cellClassFor(col, 'px-4 py-3 text-text-primary')}
          >
            {col.render
              ? col.render(row)
              : String(row[col.key as keyof T] ?? '')}
          </td>
        ))}
      </tr>
      {hasExpand && isExpanded && (
        <tr className="bg-surface-sunken">
          <td
            colSpan={totalCols}
            className="px-6 py-3 text-sm text-text-secondary"
          >
            {row._expanded}
          </td>
        </tr>
      )}
    </>
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
