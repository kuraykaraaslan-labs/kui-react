'use client';
import { cn } from '@/libs/utils/cn';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../Button';
import { Pagination } from '../Pagination';
import { Spinner } from '../Spinner';
import { HeaderCell } from './parts/HeaderCell';
import { BodyRow } from './parts/BodyRow';
import { Toolbar, type SortByOption } from './parts/Toolbar';
import { StateBlock, StateRow } from './parts/EmptyState';
import { RowActionsCell } from './parts/RowActionsCell';
import { FilterChips, type FilterChip } from './parts/FilterChips';
import {
  ExpandCell,
  ExpandHeaderCell,
  SelectAllHeaderCell,
  SelectCell,
} from './parts/RowExtras';
import { applyGrouping, useTable } from './core/useTable';
import { useServerTable } from './core/useServerTable';
import { useManualTable } from './core/useManualTable';
import { useRowExpansion, useRowSelection } from './core/useRowState';
import {
  filterChipText,
  isRequiredChoice,
  matchFilterField,
  requiredFilterDefaults,
  useFilterPanel,
} from './core/filterPanel';
import { cellClassFor, densityCellClass, sortMappers } from './core/columnHelpers';
import { FilterPanel, FilterToggle, ToolbarFilterControl } from './parts/FilterPanel';
import { ColumnChooser } from './parts/ColumnChooser';
import { isHideable, useColumnVisibility } from './core/columnVisibility';
import type {
  Column,
  DataTableCardContext,
  DataTableDensity,
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableFilterField,
  DataTableFilterValues,
  DataTableLayout,
  DataTableMessages,
  DataTableMode,
  DataTableQuery,
  DataTableRowAction,
  DataTableRowId,
  DataTableRowState,
  DataTableStateValue,
  DataTableVariant,
  FilterState,
  SortState,
} from './types';
import { DEFAULT_MESSAGES, formatMessage } from './types';

// TODO M2: enableColumnResize, enableColumnReorder, pinnedColumns props.
// TODO M3: virtualize prop (TanStack Virtual).
// TODO M4: single / range selection.
// TODO M4: exportFormats prop, onTelemetry hook.
// TODO M5: editable, onCellEdit props.

export type DataTableProps<T extends Record<string, unknown>> = {
  /** Column descriptors. */
  columns: Column<T>[];
  /**
   * Rows — required for `mode="static" | "paginated" | "manual"` (manual: the current page only).
   * Ignored for `mode="server"` (use `fetchPage`).
   */
  rows?: T[];
  /** Table mode — defaults to `paginated` for backwards compatibility with the legacy `<DataTable />`. */
  mode?: DataTableMode;
  /**
   * Server-side fetcher. Required when `mode="server"`.
   * Called whenever sort / filter / search / pagination changes, and when `reloadKey` changes.
   */
  fetchPage?: (args: DataTableFetchArgs) => Promise<DataTableFetchResult<T>>;
  /** Server mode: any value; a change refetches the current page (after a create, update or delete). */
  reloadKey?: unknown;
  /** Server mode: runs after each page arrives (show the total in a page header). */
  onLoaded?: (result: DataTableFetchResult<T>) => void;
  /** Server and manual modes: wait this long after the last keystroke before searching. Default 300. */
  searchDebounceMs?: number;
  /** Manual mode: rows across every page; without it there is no pagination. */
  total?: number;
  /** Manual mode: a request is running. The rows stay on screen under a spinner. */
  loading?: boolean;
  /** Manual mode: the error to show instead of the rows. */
  error?: ReactNode;
  /** Error state (manual mode): adds a Retry button. Server mode retries by itself. */
  onRetry?: () => void;
  /** Manual mode: controlled query fields (sort keys are the outward `Column.sortKey`s). */
  query?: Partial<DataTableQuery>;
  /** Manual and server modes: the query to start from. */
  defaultQuery?: Partial<DataTableQuery>;
  /** Manual mode: every change of the query, and the first one on mount. */
  onQueryChange?: (query: DataTableQuery) => void;
  /** Caption — visually hidden, exposed to screen readers. */
  caption?: string;
  /** Render a search bar above the table. */
  searchable?: boolean;
  /**
   * Static and paginated modes: extra text the search matches per row, beside the searchable columns (a key, a
   * description, a module no column shows). No hidden helper column needed.
   */
  searchText?: (row: T) => string;
  /**
   * Group rows: a full-width header row (card layout: a heading) before each group. Static and paginated modes keep
   * each group's rows together, groups in the order they first appear in `rows`, the sort applied within each group;
   * manual and server modes group the page they have, in the same way.
   */
  groupBy?: (row: T) => string;
  /** Content of a group's header; defaults to the group key. `rows` are the group's rows on this page. */
  renderGroupHeader?: (group: string, rows: T[]) => ReactNode;
  /** Placeholder for the search bar. */
  searchPlaceholder?: string;
  /** Default rows-per-page. */
  pageSize?: number;
  /** Page size options shown in the toolbar select. */
  pageSizeOptions?: number[];
  /** Custom empty-state message. */
  emptyMessage?: ReactNode;
  /** Custom loading message. */
  loadingMessage?: string;
  /** Custom error message. Takes precedence over `errorMessage` from `fetchPage` rejection. */
  errorMessage?: string;
  /**
   * Manual override of the data state. Useful when the consumer owns the
   * fetch lifecycle and wants to show loading/error skeletons.
   */
  state?: DataTableStateValue;
  /** Click handler for individual rows (and Enter / Space on a focused row); the event lets a host stop it there. */
  onRowClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>) => void;
  /** Double click on a row (not on a control inside it). Enter / Space run it when there is no `onRowClick`. */
  onRowDoubleClick?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  /**
   * Keyboard rows: one row in the tab order, Arrow Up/Down, Home/End move between rows.
   * Defaults to on when `onRowClick` or `onRowDoubleClick` is set.
   */
  keyboardNavigation?: boolean;
  /** Live state of a row: `new` highlights it, `leaving` fades it before the host drops it. */
  rowState?: (row: T) => DataTableRowState;
  /** Extra classes per row. */
  rowClassName?: (row: T) => string | undefined;
  /** Inline style per row (a row colour rule). */
  rowStyle?: (row: T) => CSSProperties | undefined;
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
  /** Whether a row can be selected; a string is the reason it cannot (the checkbox's tooltip). */
  isRowSelectable?: (row: T) => true | string;
  /**
   * Ticked and locked: the row shows selected with a disabled checkbox (already placed, always included). It is not
   * part of the selection: left out of the "n selected" count and the ids `bulkActions` gets, and the header
   * checkbox's select-all never toggles it.
   */
  isRowSelectionLocked?: (row: T) => boolean;
  /** Accessible name of a row's checkbox ("Select Pump 4"); defaults to "Select row N". */
  rowSelectLabel?: (row: T) => string;
  /** Controlled selection, as row ids. */
  selectedRowIds?: readonly DataTableRowId[];
  /** Initial selection when uncontrolled. */
  defaultSelectedRowIds?: readonly DataTableRowId[];
  /** Fires with every selected row id, including rows on other pages. */
  onSelectionChange?: (ids: DataTableRowId[]) => void;
  /** Controls in the selection bar while rows are selected (bulk delete, export, …). */
  bulkActions?: (selectedIds: DataTableRowId[], clearSelection: () => void) => ReactNode;
  /**
   * Detail content shown in a full-width row below a row while it is expanded.
   * Return `null` / `undefined` for rows without details; they get no toggle.
   */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Keeps the header visible while the body scrolls; the table is capped at 20rem high. */
  stickyHeader?: boolean;
  /**
   * Filter panel: a "Filters" toolbar button opens these controls (select, multiselect,
   * checkboxes, radio, checkbox, text, number, numberrange, date, daterange, range, custom).
   * Server mode sends the set values to `fetchPage` as `filterValues`; manual mode reports them in
   * `onQueryChange`; the other modes match rows (`row[field.id]` by field type, or the field's `match`).
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
  /** Show the applied filters as removable chips under the toolbar. Default `true`. */
  showFilterChips?: boolean;
  /** Optional message bundle for i18n. */
  messages?: Partial<DataTableMessages>;
  /** Initial sort. */
  initialSort?: SortState[];
  /** Alias of `initialSort`. */
  defaultSort?: SortState[];
  /** `false`: one sort column at a time (shift-click does not add a second). Default `true`. */
  multiSort?: boolean;
  /** Heading of the table (card header). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Controls at the right of the title (a "New" button). */
  headerActions?: ReactNode;
  /** Host controls before the search bar. */
  toolbarStart?: ReactNode;
  /** Host controls after the filter toggle. */
  toolbarEnd?: ReactNode;
  /** `card`: the raised, bordered shell with the header on top. Default `plain`. */
  variant?: DataTableVariant;
  /** `compact`: tighter rows. Default `comfortable`. */
  density?: DataTableDensity;
  /** Plain variant: draw the table's own rounded border. `false` when it sits inside a card already. Default `true`. */
  bordered?: boolean;
  /**
   * The host draws the look: the table, its header and body rows get only the host's classes and styles
   * (`tableClassName`, `Column.thClass` / `thStyle` / `tdClass` / `cellClassName` / `cellStyle`, `rowClassName`,
   * `rowStyle`): no density padding, header band, uppercase headings, row dividers or row hover, and no border
   * around the table. Sorting, keyboard rows, row clicks, selection and states work as always. For a widget with
   * its own styling settings (the dashboard table).
   */
  unstyled?: boolean;
  /** Classes of the `<table>` element. */
  tableClassName?: string;
  /** Inline style of the `<table>` element (a font the host sets). */
  tableStyle?: CSSProperties;
  /**
   * Classes of the scrolling region around the table, e.g. `min-h-0 flex-1` so it fills a flex column and a sticky
   * header (`position: sticky` on the host's header cells) sticks to it.
   */
  scrollClassName?: string;
  /** `cards`: a responsive grid of `renderCard` with the same toolbar, filters, sort and paging. */
  layout?: DataTableLayout;
  /** Card layout: one card per row. */
  renderCard?: (row: T, ctx: DataTableCardContext) => ReactNode;
  /** Card layout: the narrowest a card gets before the grid drops a column. Default `16rem`. */
  cardMinWidth?: string;
  className?: string;
  /** Stable id used as a prefix for child element ids — falls back to React.useId(). */
  id?: string;
  /**
   * A "Columns" toolbar button: the viewer hides and shows columns (`Column.hideable: false` ones stay, the table
   * always keeps one, `Column.defaultHidden` ones start hidden). Off by default. With `tableId` the choice is saved on
   * this device (localStorage) and comes back on the next visit; without one it lasts while the table is mounted.
   * Table layout only.
   */
  columnChooser?: boolean;
  /**
   * Stable name of this table across visits and pages (`'iot.devices'`), the key the column chooser saves this
   * device's choice under. Unlike `id`, never generated.
   */
  tableId?: string;
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
  if (mode === 'manual') {
    return <ManualView<T> {...props} id={id} />;
  }
  return <ClientView<T> {...props} mode={mode} id={id} />;
}

// ---------------------------------------------------------------------------
// The model every mode hands to the frame.
// ---------------------------------------------------------------------------

type ShownRow<T> = {
  row: T;
  id: DataTableRowId;
  /** 1-based position in the whole result, used in the checkbox label. */
  number: number;
  /** Position in the `rows` prop (server mode: in the fetched page), for `Column.render`. */
  index: number;
};

type TableModel<T> = {
  shown: ShownRow<T>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Shows the pagination and the page-size select. */
  paginated: boolean;
  sort: SortState[];
  toggleSort: (key: string, shiftKey: boolean) => void;
  /** Replaces the sort (the card layout's "Sort by" select). */
  setSort: (sort: SortState[]) => void;
  columnFilters: FilterState;
  setColumnFilter: (key: string, value: string) => void;
  clearColumnFilters: () => void;
  search: string;
  setSearch: (v: string) => void;
  searchDebounceMs: number;
  changePageSize: (n: number) => void;
  setPage: (p: number) => void;
  /** `loading` = the first load, nothing to show yet. */
  status: DataTableStateValue;
  /** A later load is running: the rows stay under a spinner overlay. */
  busy: boolean;
  errorMessage?: ReactNode;
  retry?: () => void;
  /** Browser-side search narrowed the rows from this many. */
  filteredFrom?: number;
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

/** Manual and server modes: the page's rows of one group together, in the order the groups first appear. */
function groupShown<T>(groupBy: ((row: T) => string) | undefined, shown: ShownRow<T>[]): ShownRow<T>[] {
  if (!groupBy) return shown;
  return applyGrouping(shown, (s) => groupBy(s.row), shown);
}

/** The shown rows split at every change of group (`groupBy`); one run without it. */
function groupRuns<T>(groupBy: ((row: T) => string) | undefined, shown: ShownRow<T>[]) {
  const runs: { key: string | null; rows: ShownRow<T>[] }[] = [];
  for (const s of shown) {
    const key = groupBy ? groupBy(s.row) : null;
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.rows.push(s);
    else runs.push({ key, rows: [s] });
  }
  return runs;
}

function messagesOf<T extends Record<string, unknown>>(props: DataTableProps<T>): DataTableMessages {
  return { ...DEFAULT_MESSAGES, ...props.messages };
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
    /** The menu alone, for a card. */
    menu: (row: T) =>
      list ? <RowActionsCell<T> row={row} actions={list} label={labelFor(row)} as="div" /> : null,
  };
}

// ---------------------------------------------------------------------------
// Filter panel (`filterFields`): a toolbar toggle, a panel of controls and the chips.
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
    defaultValue: props.defaultFilterValues ?? props.defaultQuery?.filterValues,
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
  const inToolbar = (f: DataTableFilterField<T>) =>
    f.placement === 'toolbar' && (f.type === 'radio' || f.type === 'select');
  const panelFields = fields.filter((f) => !inToolbar(f));
  const toolbarFields = fields.filter(inToolbar);
  /** Set panel fields that narrow the rows by choice (a required choice is always set, so it is not counted). */
  const panelActiveCount = panelFields.filter((f) => f.id in active && !isRequiredChoice(f)).length;

  /** Chips of the set panel fields; removing one re-applies the rest. Toolbar fields and required choices show as themselves. */
  const chips: FilterChip[] = panelFields
    .filter((f) => f.id in active && !isRequiredChoice(f))
    .map((f) => ({
      id: `field:${f.id}`,
      text: filterChipText(f, active[f.id]),
      onRemove: () => {
        const next = { ...filter.applied };
        delete next[f.id];
        filter.commit(next);
      },
    }));

  /** Toolbar toggle and panel; `onApplied` runs after the values change (back to page 1). */
  function parts(onApplied: () => void) {
    if (!enabled) return { toggle: undefined, panel: null, toolbar: null };
    const toolbar =
      toolbarFields.length > 0 ? (
        <>
          {toolbarFields.map((f) => (
            <ToolbarFilterControl<T>
              key={f.id}
              field={f}
              id={`${panelId}-${f.id}`}
              value={filter.applied[f.id]}
              msgs={msgs}
              onChange={(v) => {
                filter.commit({ ...filter.applied, [f.id]: v });
                onApplied();
              }}
            />
          ))}
        </>
      ) : null;
    if (panelFields.length === 0) return { toggle: undefined, panel: null, toolbar };
    return {
      toolbar,
      toggle: (
        <FilterToggle
          controls={open ? panelId : undefined}
          open={open}
          activeCount={panelActiveCount}
          label={msgs.filters ?? 'Filters'}
          onToggle={() => setOpen((o) => !o)}
        />
      ),
      panel: open ? (
        <FilterPanel<T>
          id={panelId}
          fields={panelFields}
          applied={filter.applied}
          live={props.filtersLive ?? false}
          msgs={msgs}
          onApply={(values) => {
            // Reset only knows the panel's fields: the toolbar's keep their values.
            const next = { ...values };
            for (const f of toolbarFields) {
              if (f.id in filter.applied) next[f.id] = filter.applied[f.id];
            }
            filter.commit(next);
            onApplied();
          }}
        />
      ) : null,
    };
  }

  /** "Clear all": every panel field goes and its required choices return to their default; toolbar fields keep their value. */
  function clear() {
    const next: DataTableFilterValues = { ...requiredFilterDefaults(panelFields) };
    for (const f of toolbarFields) {
      if (f.id in filter.applied) next[f.id] = filter.applied[f.id];
    }
    filter.commit(next);
  }

  return { enabled, active, predicate, parts, chips, clear };
}

type FilterUi<T extends Record<string, unknown>> = ReturnType<typeof useFilterParts<T>>;

// ---------------------------------------------------------------------------
// Row selection and expandable rows (every mode), keyed by row id.
// ---------------------------------------------------------------------------

function useRowExtras<T extends Record<string, unknown>>(
  props: DataTableProps<T>,
  msgs: DataTableMessages,
  tableId: string,
  shown: ShownRow<T>[],
) {
  const { selectable = false, renderExpanded, isRowSelectable, isRowSelectionLocked, rowSelectLabel } = props;
  const selection = useRowSelection({
    selectedRowIds: props.selectedRowIds,
    defaultSelectedRowIds: props.defaultSelectedRowIds,
    onSelectionChange: props.onSelectionChange,
  });
  const expansion = useRowExpansion();
  const expandable = renderExpanded !== undefined;

  const isLocked = (row: T) => (selectable && isRowSelectionLocked ? isRowSelectionLocked(row) : false);
  const canSelect = (row: T): true | string => (isRowSelectable ? isRowSelectable(row) : true);
  const selectableIds = shown.filter((s) => !isLocked(s.row) && canSelect(s.row) === true).map((s) => s.id);
  // Locked rows are never part of the selection, even when the host lists their ids.
  const lockedIds = new Set<DataTableRowId>();
  const known = props.mode === 'server' || props.mode === 'manual' ? shown.map((s) => s.row) : (props.rows ?? []);
  if (isRowSelectionLocked && selectable) {
    known.forEach((row, i) => {
      if (isRowSelectionLocked(row)) lockedIds.add(resolveRowId(props.rowId, row, i));
    });
    for (const s of shown) if (isLocked(s.row)) lockedIds.add(s.id);
  }
  const shownSelected = selectableIds.filter((rid) => selection.selected.has(rid)).length;
  const allShownSelected = selectableIds.length > 0 && shownSelected === selectableIds.length;

  const header = (
    <>
      {selectable && (
        <SelectAllHeaderCell
          checked={allShownSelected}
          indeterminate={shownSelected > 0 && !allShownSelected}
          disabled={selectableIds.length === 0}
          label={msgs.selectAllRows ?? 'Select all shown rows'}
          onChange={() => selection.toggleShown(selectableIds)}
        />
      )}
      {expandable && <ExpandHeaderCell label={msgs.expandColumn ?? 'Details'} />}
    </>
  );

  function selectLabel(s: ShownRow<T>) {
    return rowSelectLabel ? rowSelectLabel(s.row) : `${msgs.selectRow ?? 'Select row'} ${s.number}`;
  }

  function row(s: ShownRow<T>, totalCols: number) {
    const locked = isLocked(s.row);
    const isSelected = selectable && (locked || selection.selected.has(s.id));
    const allowed = canSelect(s.row);
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
                label={selectLabel(s)}
                disabledReason={allowed === true ? undefined : allowed}
                locked={locked}
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

  function card(s: ShownRow<T>) {
    const allowed = canSelect(s.row);
    const locked = isLocked(s.row);
    return {
      selected: selectable && (locked || selection.selected.has(s.id)),
      selectable: selectable ? allowed : ('not selectable' as const),
      locked,
      toggle: () => {
        if (selectable && !locked && allowed === true) selection.toggle(s.id);
      },
    };
  }

  const selectedIds = [...selection.selected].filter((rid) => !lockedIds.has(rid));
  // a selectable table keeps the line's room while nothing is selected, so ticking the first row moves no row (run 3 note 51: "30 selected" pushed the
  // table down under the pointer)
  const summary = !selectable ? null : selectedIds.length === 0 ? (
    <div className="min-h-7" data-part="selection-summary-slot" aria-hidden="true" />
  ) : (
      <div className="flex min-h-7 flex-wrap items-center gap-2" data-part="selection-summary">
        <p className="text-xs text-text-secondary">
          {formatMessage(msgs.selectedCount ?? '{count} selected', { count: selectedIds.length })}
        </p>
        <Button variant="ghost" size="xs" onClick={selection.clear}>
          {msgs.clearSelection ?? 'Clear selection'}
        </Button>
        {props.bulkActions && (
          <div className="flex flex-wrap items-center gap-2" data-part="bulk-actions">
            {props.bulkActions(selectedIds, selection.clear)}
          </div>
        )}
      </div>
    );

  return {
    header,
    row,
    card,
    summary,
    /** Columns added before the data columns. */
    leadingCount: (selectable ? 1 : 0) + (expandable ? 1 : 0),
  };
}

// ---------------------------------------------------------------------------
// The frame: shell, toolbar, filters, chips, selection bar, rows (table or cards),
// footer and pagination. Every mode renders through it.
// ---------------------------------------------------------------------------

function columnHeaderText(header: ReactNode, key: string): string {
  return typeof header === 'string' || typeof header === 'number' ? String(header) : key;
}

function TableFrame<T extends Record<string, unknown>>({
  props,
  model,
  filterUi,
  onFiltersApplied,
  msgs,
}: {
  props: DataTableProps<T> & { id: string };
  model: TableModel<T>;
  filterUi: FilterUi<T>;
  onFiltersApplied: () => void;
  msgs: DataTableMessages;
}) {
  const {
    id,
    caption,
    searchable: searchableProp,
    searchPlaceholder,
    pageSizeOptions = [5, 10, 25, 50],
    emptyMessage,
    loadingMessage,
    errorMessage,
    onRowClick,
    onRowDoubleClick,
    rowState,
    rowClassName,
    rowStyle,
    unstyled = false,
    tableClassName,
    tableStyle,
    scrollClassName,
    stickyHeader = false,
    showFilterChips = true,
    title,
    subtitle,
    headerActions,
    toolbarStart,
    toolbarEnd,
    variant = 'plain',
    density = 'comfortable',
    bordered = true,
    layout = 'table',
    renderCard,
    cardMinWidth = '16rem',
    className,
  } = props;

  const isCard = variant === 'card';
  const cards = layout === 'cards' && renderCard !== undefined;
  // The column chooser hides columns of the table layout only; the cards draw no columns.
  const chooser = (props.columnChooser ?? false) && !cards;
  const visibility = useColumnVisibility(props.columns, chooser, props.tableId);
  const columns = visibility.columns;
  // A column the viewer hides leaves the sort, so the rows are never ordered by a column nobody sees (a multi-sort keeps
  // the rest in order). A stored choice that hides the default sort's column drops it the same way.
  const hiddenKeys = JSON.stringify(chooser ? props.columns.filter((c) => !columns.includes(c)).map((c) => String(c.key)) : []);
  const { sort: currentSort, setSort } = model;
  useEffect(() => {
    const hidden = new Set<string>(JSON.parse(hiddenKeys));
    if (currentSort.some((s) => hidden.has(s.key))) setSort(currentSort.filter((s) => !hidden.has(s.key)));
  }, [hiddenKeys, currentSort, setSort]);

  const searchable = searchableProp ?? true;
  // Sort priority numbers show only once the user has built a multi-column sort, never for a default one.
  const [userSorted, setUserSorted] = useState(false);
  const toggleSort = (key: string, shiftKey: boolean) => {
    setUserSorted(true);
    model.toggleSort(key, shiftKey);
  };
  const runs = groupRuns(props.groupBy, model.shown);
  const groupHeader = (key: string, rows: ShownRow<T>[]) =>
    props.renderGroupHeader ? props.renderGroupHeader(key, rows.map((r) => r.row)) : key;
  const actions = rowActionsParts(props, msgs);
  const extras = useRowExtras(props, msgs, id, model.shown);
  const filterParts = filterUi.parts(onFiltersApplied);
  const totalCols = extras.leadingCount + columns.length + (actions.enabled ? 1 : 0);

  // Keyboard rows: the focused row while it exists, else the first, is the one in the tab order.
  const keyboard = props.keyboardNavigation ?? (onRowClick !== undefined || onRowDoubleClick !== undefined);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const keys = model.shown.map((s) => String(s.id));
  const position = new Map(keys.map((k, i) => [k, i]));
  const tabKey = focusKey !== null && keys.includes(focusKey) ? focusKey : (keys[0] ?? null);
  function focusRow(index: number) {
    const key = keys[Math.max(0, Math.min(keys.length - 1, index))];
    if (key === undefined) return;
    setFocusKey(key);
    const rowsEl = bodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row-key]') ?? [];
    Array.from(rowsEl).find((el) => el.dataset.rowKey === key)?.focus();
  }

  // Column header filters as chips too, so "Clear all" covers every filter.
  // A hidden column's filter still narrows the rows, so its chip stays.
  const columnChips: FilterChip[] = props.columns
    .filter((c) => c.filter && model.columnFilters[String(c.key)])
    .map((c) => {
      const key = String(c.key);
      const raw = model.columnFilters[key];
      const shown = c.filter?.options?.find((o) => o.value === raw)?.label ?? raw;
      return {
        id: `column:${key}`,
        text: `${columnHeaderText(c.header, key)}: ${shown}`,
        onRemove: () => model.setColumnFilter(key, ''),
      };
    });
  const chips = showFilterChips ? [...filterUi.chips, ...columnChips] : [];

  // Card layout: no header row to click, so a "Sort by" select.
  const sortable = props.columns.filter((c) => c.sortable);
  const sortBy =
    cards && sortable.length > 0
      ? {
          label: msgs.sortBy ?? 'Sort by',
          value: model.sort[0] ? `${model.sort[0].key}:${model.sort[0].dir}` : '',
          options: [
            { value: '', label: msgs.sortNone ?? 'Default order' },
            ...sortable.flatMap((c): SortByOption[] => {
              const column = columnHeaderText(c.header, String(c.key));
              return [
                { value: `${String(c.key)}:asc`, label: formatMessage(msgs.sortAscending ?? '{column}, ascending', { column }) },
                { value: `${String(c.key)}:desc`, label: formatMessage(msgs.sortDescending ?? '{column}, descending', { column }) },
              ];
            }),
          ],
          onChange: (v: string) => {
            if (!v) return model.setSort([]);
            const [key, dir] = v.split(':');
            model.setSort([{ key, dir: dir === 'desc' ? 'desc' : 'asc' }]);
          },
        }
      : undefined;

  const hideable = props.columns.filter(isHideable);
  const columnChooser =
    chooser && hideable.length > 0 ? (
      <ColumnChooser
        id={id}
        label={msgs.columns ?? 'Columns'}
        resetLabel={msgs.resetColumns ?? 'Reset'}
        hiddenLabel={formatMessage(msgs.hiddenColumns ?? '{count} hidden', { count: visibility.hiddenCount })}
        hiddenCount={visibility.hiddenCount}
        changed={visibility.changed}
        choices={hideable.map((c) => {
          const shown = visibility.isShown(c);
          return {
            key: String(c.key),
            label: columnHeaderText(c.header, String(c.key)),
            shown,
            locked: visibility.isLocked(c),
          };
        })}
        onChange={visibility.setShown}
        onReset={visibility.reset}
      />
    ) : null;

  const showToolbar =
    searchable || filterUi.enabled || columnChooser !== null || toolbarStart !== undefined || toolbarEnd !== undefined || sortBy !== undefined || model.paginated;
  const toolbar = showToolbar ? (
    <Toolbar
      id={id}
      start={toolbarStart}
      end={toolbarEnd}
      extra={
        filterParts.toolbar || filterParts.toggle || columnChooser ? (
          <>
            {filterParts.toolbar}
            {filterParts.toggle}
            {columnChooser}
          </>
        ) : undefined
      }
      sortBy={sortBy}
      searchable={searchable}
      searchValue={model.search}
      searchPlaceholder={searchPlaceholder ?? msgs.searchPlaceholder}
      searchLabel={msgs.search ?? 'Search'}
      onSearchChange={model.setSearch}
      searchDebounceMs={model.searchDebounceMs}
      pageSize={model.paginated ? model.pageSize : undefined}
      pageSizeOptions={model.paginated && pageSizeOptions.length > 0 ? pageSizeOptions : undefined}
      onPageSizeChange={model.paginated ? model.changePageSize : undefined}
      rowsPerPageLabel={msgs.rowsPerPage}
    />
  ) : null;

  const stateMessage =
    model.status === 'loading'
      ? (loadingMessage ?? msgs.loading)
      : model.status === 'error'
        ? (errorMessage ?? model.errorMessage ?? msgs.error)
        : model.search && model.total === 0
          ? formatMessage(msgs.noResultsFor ?? 'No results for “{search}”', { search: model.search })
          : (emptyMessage ?? msgs.empty);

  const overlay =
    model.busy && model.shown.length > 0 && model.status === 'ready' ? (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-base/60" data-part="busy">
        <Spinner size="lg" />
      </div>
    ) : null;

  const hasFooter = columns.some((c) => c.footer !== undefined);
  const rowsView = cards ? (
    <div className="relative" aria-busy={model.busy || undefined}>
      {overlay}
      {model.status !== 'ready' ? (
        <StateBlock
          state={model.status as 'empty' | 'loading' | 'error'}
          message={stateMessage}
          onRetry={model.retry}
          retryLabel={msgs.retry}
        />
      ) : (
        (() => {
          const cardList = (list: ShownRow<T>[], label: string) => (
            <ul
              className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(var(--dt-card-min),100%),1fr))]"
              style={{ '--dt-card-min': cardMinWidth } as CSSProperties}
              aria-label={label}
              data-part="cards"
            >
              {list.map((s) => {
                const c = extras.card(s);
                return (
                  <li key={String(s.id)} data-row-key={String(s.id)} data-state={rowState?.(s.row)} data-selected={c.selected || undefined}
                    className={cn('min-w-0', rowState?.(s.row) === 'leaving' && 'opacity-40 transition-opacity duration-500', rowClassName?.(s.row))}>
                    {renderCard?.(s.row, {
                      id: s.id,
                      selected: c.selected,
                      toggleSelected: c.toggle,
                      selectable: c.selectable,
                      locked: c.locked,
                      actions: actions.menu(s.row),
                    })}
                  </li>
                );
              })}
            </ul>
          );
          const tableLabel = caption ?? msgs.tableLabel ?? 'Data table';
          if (!props.groupBy) return cardList(model.shown, tableLabel);
          // A heading before each group's cards; each group is its own list named by its key.
          return (
            <div className="space-y-4" data-part="card-groups">
              {runs.map((run, r) => (
                <section key={run.key ?? r} data-part="card-group">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary" data-part="group-header">
                    {groupHeader(run.key ?? '', run.rows)}
                  </h4>
                  {cardList(run.rows, run.key ?? tableLabel)}
                </section>
              ))}
            </div>
          );
        })()
      )}
    </div>
  ) : (
    <div
      className={cn(
        'relative w-full',
        stickyHeader ? 'overflow-auto max-h-80' : 'overflow-x-auto',
        !isCard && bordered && !unstyled && 'rounded-lg border border-border',
        isCard && 'border-t border-border',
        scrollClassName,
      )}
      tabIndex={0}
      role="region"
      aria-label={caption ?? msgs.tableLabel ?? 'Data table'}
      aria-busy={model.busy || undefined}
    >
      {overlay}
      <table className={cn('w-full', !unstyled && 'text-sm', tableClassName)} style={tableStyle}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className={cn(!unstyled && 'bg-surface-sunken border-b border-border', stickyHeader && 'sticky top-0 z-10') || undefined}>
          <tr>
            {extras.header}
            {columns.map((col) => (
              <HeaderCell
                key={String(col.key)}
                column={col}
                sort={model.sort}
                showSortOrder={userSorted}
                filterValue={model.columnFilters[String(col.key)] ?? ''}
                onToggleSort={toggleSort}
                onSetFilter={model.setColumnFilter}
                density={density}
                msgs={msgs}
                unstyled={unstyled}
              />
            ))}
            {actions.header}
          </tr>
        </thead>
        <tbody ref={bodyRef} className={unstyled ? undefined : 'divide-y divide-border bg-surface-base'}>
          {model.status !== 'ready' ? (
            <StateRow
              state={model.status as 'empty' | 'loading' | 'error'}
              colSpan={totalCols}
              message={stateMessage}
              onRetry={model.retry}
              retryLabel={msgs.retry}
            />
          ) : (
            runs.map((run, r) => (
              <Fragment key={run.key ?? `run-${r}`}>
                {run.key !== null && (
                  <tr data-part="group-header" className={unstyled ? undefined : 'bg-surface-raised'}>
                    <th
                      scope="rowgroup"
                      colSpan={totalCols}
                      className={unstyled ? undefined : cn(densityCellClass[density], 'text-left text-xs font-semibold uppercase tracking-wider text-text-secondary')}
                    >
                      {groupHeader(run.key, run.rows)}
                    </th>
                  </tr>
                )}
                {run.rows.map((s) => {
                  const index = position.get(String(s.id)) ?? 0;
                  return (
                    <BodyRow
                      key={String(s.id)}
                      rowKey={String(s.id)}
                      row={s.row}
                      columns={columns}
                      onClick={onRowClick}
                      onDoubleClick={onRowDoubleClick}
                      actions={actions.cell(s.row)}
                      state={rowState?.(s.row)}
                      className={rowClassName?.(s.row)}
                      style={rowStyle?.(s.row)}
                      unstyled={unstyled}
                      density={density}
                      focusable={keyboard}
                      tabbable={String(s.id) === tabKey}
                      onFocusRow={() => setFocusKey(String(s.id))}
                      onKeyNav={(k) =>
                        focusRow(k === 'ArrowDown' ? index + 1 : k === 'ArrowUp' ? index - 1 : k === 'Home' ? 0 : keys.length - 1)
                      }
                      cell={{ index: s.index, id: s.id }}
                      {...extras.row(s, totalCols)}
                    />
                  );
                })}
              </Fragment>
            ))
          )}
        </tbody>
        {hasFooter && model.status === 'ready' && (
          <tfoot className="border-t border-border bg-surface-sunken font-medium" data-part="footer">
            <tr>
              {extras.leadingCount > 0 && <td colSpan={extras.leadingCount} />}
              {columns.map((col) => (
                <td key={String(col.key)} className={cellClassFor(col, cn(densityCellClass[density], 'text-text-primary'))}>
                  {col.footer}
                </td>
              ))}
              {actions.enabled && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const start = model.total === 0 ? 0 : (model.page - 1) * model.pageSize + 1;
  const end = Math.min(model.page * model.pageSize, model.total);
  const pagination = model.paginated ? (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', isCard && 'border-t border-border px-4 py-3')} data-part="pagination">
      <p className="text-xs text-text-secondary">
        {model.total === 0
          ? (msgs.noResults ?? 'No results')
          : formatMessage(msgs.showingRange ?? 'Showing {start}–{end} of {total}', { start, end, total: model.total })}
        {model.filteredFrom !== undefined && model.total > 0 && (
          <> {formatMessage(msgs.filteredFrom ?? '(filtered from {total})', { total: model.filteredFrom })}</>
        )}
      </p>
      <Pagination
        page={model.page}
        totalPages={model.totalPages}
        onPageChange={model.setPage}
        labels={{
          navigation: msgs.pagination,
          previous: msgs.previousPage,
          next: msgs.nextPage,
          first: msgs.firstPage,
          last: msgs.lastPage,
          page: msgs.pageNumber,
        }}
      />
    </div>
  ) : null;

  const heading =
    title || subtitle || headerActions ? (
      <div
        className={cn('flex items-start justify-between gap-3 flex-wrap', isCard && 'px-6 py-4 border-b border-border')}
        data-part="header"
      >
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
          {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        {headerActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div>}
      </div>
    ) : null;

  const controls = (
    <>
      {toolbar}
      {filterParts.panel}
      {chips.length > 0 && (
        <FilterChips
          chips={chips}
          msgs={msgs}
          onClearAll={() => {
            filterUi.clear();
            model.clearColumnFilters();
            onFiltersApplied();
          }}
        />
      )}
      {extras.summary}
    </>
  );
  const hasControls = toolbar !== null || filterParts.panel !== null || chips.length > 0 || extras.summary !== null;

  if (isCard) {
    return (
      <div
        className={cn('rounded-xl border border-border bg-surface-raised shadow-sm overflow-hidden', className)}
        data-dt-id={id}
        data-variant="card"
      >
        {heading}
        {hasControls && <div className="space-y-3 p-4">{controls}</div>}
        {cards ? <div className={cn('px-4 pb-4', !hasControls && 'pt-4')}>{rowsView}</div> : rowsView}
        {pagination}
      </div>
    );
  }
  return (
    <div className={cn('space-y-3', className)} data-dt-id={id}>
      {heading}
      {controls}
      {rowsView}
      {pagination}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client view: static + paginated modes — the rows are all here.
// ---------------------------------------------------------------------------

function ClientView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { mode: DataTableMode; id: string },
) {
  const { columns, rows = [], pageSize: defaultPageSize = 10, state, mode, id } = props;
  const msgs = messagesOf(props);
  const isStatic = mode === 'static';
  const filterUi = useFilterParts(props, msgs, id);

  const table = useTable<T>({
    rows,
    columns,
    initialSort: props.initialSort ?? props.defaultSort ?? props.defaultQuery?.sort ?? [],
    initialSearch: props.defaultQuery?.search,
    initialPageSize: isStatic ? Math.max(rows.length, defaultPageSize) : defaultPageSize,
    predicate: filterUi.predicate,
    multiSort: props.multiSort,
    searchText: props.searchText,
    groupBy: props.groupBy,
  });

  const pageRows = isStatic
    ? table.rows
    : table.rows.slice((table.page - 1) * table.pageSize, table.page * table.pageSize);
  const start = table.total === 0 ? 0 : (table.page - 1) * table.pageSize + 1;

  // A row without `rowId` / `id` falls back to its position in `rows`, which
  // sorting, filtering and paging leave alone.
  const sourceIndex = useMemo(() => new Map(rows.map((r, i) => [r, i])), [rows]);
  const shown = pageRows.map((row, i) => ({
    row,
    id: resolveRowId(props.rowId, row, sourceIndex.get(row) ?? i),
    number: start + i,
    index: sourceIndex.get(row) ?? i,
  }));

  const model: TableModel<T> = {
    shown,
    total: table.total,
    page: table.page,
    pageSize: table.pageSize,
    totalPages: table.totalPages,
    paginated: !isStatic,
    sort: table.sort,
    toggleSort: table.toggleSort,
    setSort: (s) => {
      table.setSort(s);
      table.setPage(1);
    },
    columnFilters: table.filters,
    setColumnFilter: table.setColumnFilter,
    clearColumnFilters: () => table.setFilters({}),
    search: table.search,
    setSearch: table.setGlobalSearch,
    searchDebounceMs: 0,
    changePageSize: table.changePageSize,
    setPage: table.setPage,
    status: state ?? (pageRows.length === 0 ? 'empty' : 'ready'),
    busy: false,
    errorMessage: undefined,
    retry: props.onRetry,
    filteredFrom: table.search && table.total !== rows.length ? rows.length : undefined,
  };

  return (
    <TableFrame<T>
      props={props}
      model={model}
      filterUi={filterUi}
      onFiltersApplied={() => table.setPage(1)}
      msgs={msgs}
    />
  );
}

// ---------------------------------------------------------------------------
// Server view: mode="server" — fetchPage owns the data.
// ---------------------------------------------------------------------------

function ServerView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { id: string },
) {
  const { columns, fetchPage, pageSize: defaultPageSize = 10, state: stateOverride, id } = props;
  const msgs = messagesOf(props);
  const filterUi = useFilterParts(props, msgs, id);

  if (!fetchPage) {
    throw new Error('DataTable mode="server" requires a `fetchPage` prop.');
  }

  const mappers = useMemo(() => sortMappers(columns), [columns]);
  const table = useServerTable<T>({
    fetchPage,
    initialPageSize: props.defaultQuery?.pageSize ?? defaultPageSize,
    initialPage: props.defaultQuery?.page,
    initialSort: props.initialSort ?? props.defaultSort ?? mappers.fromWire(props.defaultQuery?.sort ?? []),
    initialSearch: props.defaultQuery?.search,
    initialFilters: props.defaultQuery?.filters,
    filterValues: filterUi.active,
    reloadKey: props.reloadKey,
    multiSort: props.multiSort,
    wireSort: mappers.toWire,
    onLoaded: props.onLoaded,
  });

  const offset = (table.page - 1) * table.pageSize;
  const shown = groupShown(props.groupBy, table.rows.map((row, i) => ({
    row,
    id: resolveRowId(props.rowId, row, offset + i),
    number: offset + i + 1,
    index: i,
  })));

  const status: DataTableStateValue =
    stateOverride ??
    (table.error !== null
      ? 'error'
      : !table.everLoaded
        ? 'loading'
        : table.rows.length === 0
          ? table.loading ? 'loading' : 'empty'
          : 'ready');

  const model: TableModel<T> = {
    shown,
    total: table.total,
    page: table.page,
    pageSize: table.pageSize,
    totalPages: table.totalPages,
    paginated: true,
    sort: table.sort,
    toggleSort: table.toggleSort,
    setSort: (s) => {
      table.setSort(s);
      table.setPage(1);
    },
    columnFilters: table.filters,
    setColumnFilter: table.setColumnFilter,
    clearColumnFilters: () => table.setFilters({}),
    search: table.search,
    setSearch: table.setGlobalSearch,
    searchDebounceMs: props.searchDebounceMs ?? 300,
    changePageSize: table.changePageSize,
    setPage: table.setPage,
    status,
    busy: table.loading,
    // an error without text falls back to `messages.error`
    errorMessage: table.error || undefined,
    retry: table.retry,
  };

  return (
    <TableFrame<T>
      props={props}
      model={model}
      filterUi={filterUi}
      onFiltersApplied={() => table.setPage(1)}
      msgs={msgs}
    />
  );
}

// ---------------------------------------------------------------------------
// Manual view: mode="manual" — the host owns the rows and fetches from onQueryChange.
// ---------------------------------------------------------------------------

function ManualView<T extends Record<string, unknown>>(
  props: DataTableProps<T> & { id: string },
) {
  const { columns, rows = [], pageSize: defaultPageSize = 10, state: stateOverride, id } = props;
  const msgs = messagesOf(props);
  const filterUi = useFilterParts(props, msgs, id);
  const mappers = useMemo(() => sortMappers(columns), [columns]);

  const table = useManualTable({
    query: props.query,
    defaultQuery: props.defaultQuery ?? (props.initialSort || props.defaultSort
      ? { sort: mappers.toWire(props.initialSort ?? props.defaultSort ?? []) }
      : undefined),
    onQueryChange: props.onQueryChange,
    total: props.total ?? rows.length,
    filterValues: filterUi.active,
    defaultPageSize,
    multiSort: props.multiSort,
    toWire: mappers.toWire,
    fromWire: mappers.fromWire,
  });

  const paginated = props.total !== undefined;
  const offset = paginated ? (table.page - 1) * table.pageSize : 0;
  const shown = groupShown(props.groupBy, rows.map((row, i) => ({
    row,
    id: resolveRowId(props.rowId, row, offset + i),
    number: offset + i + 1,
    index: i,
  })));

  const loading = props.loading ?? false;
  const status: DataTableStateValue =
    stateOverride ??
    (props.error !== undefined && props.error !== null && props.error !== false ? 'error' : rows.length === 0 ? (loading ? 'loading' : 'empty') : 'ready');

  const model: TableModel<T> = {
    shown,
    total: props.total ?? rows.length,
    page: table.page,
    pageSize: table.pageSize,
    totalPages: table.totalPages,
    paginated,
    sort: table.sort,
    toggleSort: table.toggleSort,
    setSort: table.setSort,
    columnFilters: table.filters,
    setColumnFilter: table.setColumnFilter,
    clearColumnFilters: () => table.setFilters({}),
    search: table.search,
    setSearch: table.setGlobalSearch,
    searchDebounceMs: props.searchDebounceMs ?? 300,
    changePageSize: table.changePageSize,
    setPage: table.setPage,
    status,
    busy: loading,
    errorMessage: props.error || undefined,
    retry: props.onRetry,
  };

  return (
    <TableFrame<T>
      props={props}
      model={model}
      filterUi={filterUi}
      onFiltersApplied={table.resetPageForFilters}
      msgs={msgs}
    />
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
                rows.map((row, index) => (
                  <tr
                    key={getRowKey(row)}
                    onClick={(e) => onRowClick?.(row, e)}
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
                          ? col.render(row, { index, id: getRowKey(row) })
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
