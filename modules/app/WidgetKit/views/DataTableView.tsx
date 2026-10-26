'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { DataTable } from '@/modules/ui/Table/DataTable';
import type { Column } from '@/modules/ui/Table/types';
import type { PagedEcho, WidgetKindView, WidgetViewProps } from '../kind';
import { SettingIcon, useKitMessages, useWidgetKit } from '../WidgetKitContext';
import type { TableMessages } from '../messages';
import { useNow } from '../useNow';
import { Meta, Pill } from './ui';
import {
  FOCUS, ICON_COLUMNS, ICON_NEXT, ICON_PREV, ICON_SEARCH, LINK_CLASS, PAGE_BUTTON, ROW_BUTTON, TOOL_BUTTON,
  csvCell, csvHeader, tableColumns, tableModel,
  type CellContent, type Row, type TableColumn, type TableRowModel, type TableSettings as S,
} from './table-logic';

/** One body row of the kit table: the model's row, keyed by its position. */
type ViewRow = { id: number; m: TableRowModel };

const ALIGN_OF: Record<TableColumn['align'], Column<ViewRow>['align']> = { start: 'left', center: 'center', end: 'right' };

export * from './table-logic';

/** Plain anchor or the host's router link. */
export function linkTo(
  href: string, children: ReactNode, className: string, renderLink?: WidgetViewProps['renderLink'],
): ReactNode {
  return renderLink ? renderLink(href, children, className) : <a href={href} className={className}>{children}</a>;
}


// ── View ──────────────────────────────────────────────────────────────────────

/** Row, cell and button actions of a table placement (the host runs them; the view never names what happens). */
export interface TableRowActions {
  rowClick?: (row: Row) => void;
  rowDoubleClick?: (row: Row) => void;
  /** Columns that have a cell action; `'*'` = every column. */
  cellClickColumns: string[];
  cellClick: (columnKey: string, row: Row) => void;
  /**
   * One button per row-button entry. `icon` is drawn before the label; `iconOnly` (an entry with an icon and no name)
   * draws the icon alone, named by `label`.
   */
  buttons: Array<{ id: string; label: string; icon?: string; iconOnly?: boolean }>;
  runButton: (id: string, row: Row) => void;
}

export type { PagedEcho } from '../kind';

export type { TableMessages } from '../messages';

export type DataTableViewProps = WidgetViewProps & {
  /** Row / cell / button actions (16.4). */
  rowActions?: TableRowActions;
  /**
   * Set when the host can page the `rows` slot on the server; used only when the result echoes `paging`. The table
   * asks for the saved "Sort by" itself (once per query, when the echo says it can sort by it). `key` names the
   * query: a new key (the slot bound to another query) is a fresh table that gets the default sort again.
   */
  paging?: {
    set: (patch: { page?: number; sort?: { key: string; dir: 'asc' | 'desc' } | undefined; q?: string }) => void;
    key?: string;
  };
  messages?: Partial<TableMessages>;
  /** Fixed "now" for relative dates (tests, snapshots). */
  now?: number;
};

const Svg = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', className)}>
    <path d={d} />
  </svg>
);
/** The footer pager: "1–10 of 42" on the left, previous / page / next on the right. */
function Pager({ info, page, pages, onPage, canNext, m }: {
  info: ReactNode; page: number; pages: number | null; onPage: (p: number) => void; canNext: boolean; m: TableMessages;
}) {
  return (
    <nav className="flex min-h-8 items-center justify-between gap-2 px-2" aria-label={m.pager}>
      <Meta className="tabular-nums">{info}</Meta>
      <span className="flex items-center gap-1">
        <button type="button" className={PAGE_BUTTON} aria-label={m.previous} title={m.previous} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Svg d={ICON_PREV} />
        </button>
        <span className="px-1 text-xs tabular-nums text-text-secondary">{m.pageOf(page, pages)}</span>
        <button type="button" className={PAGE_BUTTON} aria-label={m.next} title={m.next} disabled={!canNext} onClick={() => onPage(page + 1)}>
          <Svg d={ICON_NEXT} />
        </button>
      </span>
    </nav>
  );
}

/**
 * A server-paged table's saved "Sort by" (`defaultSort` / `defaultSortDir`), asked of the server: the rows arrive
 * sorted, so the table cannot sort them itself. It asks once per query (`paging.key`), when the echo says the key is
 * sortable (asking for another would be refused), and again when the setting changes. A query the viewer has already
 * sorted, searched or paged keeps the viewer's choice. Clearing the setting, or naming a key the query cannot sort by,
 * removes the sort this asked for, unless the viewer has sorted since.
 */
function useServerDefaultSort(
  echo: PagedEcho | undefined,
  paging: DataTableViewProps['paging'],
  defaultSort: string | undefined,
  defaultSortDir: 'asc' | 'desc' | undefined,
): void {
  const setting = `${defaultSort ?? ''}|${defaultSortDir ?? ''}`;
  const key = paging?.key ?? '';
  const considered = useRef<{ key: string; setting: string } | null>(null);
  const seeded = useRef<string | null>(null);
  const active = !!echo && !!paging;
  useEffect(() => {
    if (!echo || !paging) return;
    const last = considered.current;
    if (last && last.key === key && last.setting === setting) return;
    const fresh = !last || last.key !== key;
    considered.current = { key, setting };
    if (fresh) seeded.current = null;
    if (fresh && (echo.sort || echo.q || echo.page > 1)) return;
    const want = defaultSort && echo.sortable.includes(defaultSort)
      ? { key: defaultSort, dir: defaultSortDir === 'asc' ? 'asc' as const : 'desc' as const }
      : null;
    if (want) {
      if (echo.sort?.key !== want.key || echo.sort.dir !== want.dir) paging.set({ sort: want });
      seeded.current = JSON.stringify(want);
    } else if (seeded.current && JSON.stringify(echo.sort ?? null) === seeded.current) {
      paging.set({ sort: undefined });
      seeded.current = null;
    }
    // The echo and the setter are read when the setting or the query changes: a new page must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, setting, key]);
}

/** `data.table`: the bound rows with per-column display, viewer sort/search/paging and full styling. */
export function DataTableView({
  settings, format, data, locale, renderLink, rowActions, paging, messages, now,
}: DataTableViewProps) {
  const s = settings as S;
  const kit = useKitMessages();
  // The host's texts, then the explicit `messages` prop.
  const m: TableMessages = { ...kit.table, ...messages };
  const clock = useNow(60_000);
  const { renderIcon } = useWidgetKit();
  const nowMs = now ?? clock;
  const result = data.rows;
  const echo = result?.paging;
  const paged = !!echo && !!paging;
  const [hiddenByViewer, setHiddenByViewer] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    s.defaultSort ? { key: s.defaultSort, dir: s.defaultSortDir ?? 'desc' } : null,
  );
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState(echo?.q ?? '');
  useServerDefaultSort(paged ? echo : undefined, paged ? paging : undefined, s.defaultSort, s.defaultSortDir);
  const [page, setPage] = useState(1);

  const onRow = rowActions?.rowClick;
  const onDouble = rowActions?.rowDoubleClick;
  const interactive = !!(onRow || onDouble);
  const model = tableModel({
    settings, format, rows: result, locale, now: nowMs, messages: { table: m, common: kit.common },
    viewer: { sort, query, page, hiddenColumns: hiddenByViewer }, paged,
    actions: rowActions ? { interactive, cellClickColumns: rowActions.cellClickColumns, buttons: rowActions.buttons, hasCellActions: true } : (interactive ? { interactive, cellClickColumns: [], buttons: [], hasCellActions: false } : undefined),
    iconAvailable: (name) => renderIcon?.(name, {}) != null,
  });
  const { allColumns, head, rows } = model;
  const buttons = rowActions?.buttons ?? [];

  // The sort the header shows: the server's echo for a paged slot, else the viewer's own.
  const currentSort = paged ? echo!.sort : sort ?? undefined;
  /** The table's reported sort (the first report, on mount, is the sort it was given). */
  const onSortChange = (next: { key: string; dir: 'asc' | 'desc' } | undefined) => {
    if ((next?.key ?? null) === (currentSort?.key ?? null) && (next?.dir ?? null) === (currentSort?.dir ?? null)) return;
    if (paged) paging!.set({ sort: next });
    else { setSort(next ?? null); setPage(1); }
  };

  const searchInput = (value: string, onChange: (v: string) => void) => (
    <label className="relative flex min-w-0 max-w-72 flex-1 items-center">
      <Svg d={ICON_SEARCH} className="pointer-events-none absolute left-2.5 text-text-secondary" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        placeholder={m.search}
        aria-label={m.search}
        className={cn('h-8 w-full min-w-0 rounded-md border border-border bg-transparent pl-8 pr-2 text-[13px] text-text-primary placeholder:text-text-secondary/70', FOCUS)}
      />
    </label>
  );

  const renderContent = (c: CellContent): ReactNode => {
    switch (c.kind) {
      case 'dash': return <span className="text-text-secondary/60">—</span>;
      case 'text': return c.text;
      case 'badge': return <Pill size="sm" variant={c.variant} label={c.label} color={c.color} icon={c.icon} />;
      case 'icon':
        return (
          <span className={cn('inline-flex items-center', c.justify)} title={c.label}>
            {c.name
              ? <SettingIcon name={c.name} style={{ color: c.color, fontSize: 14, width: 14, height: 14 }} />
              : <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />}
            <span className="sr-only">{c.label}</span>
          </span>
        );
      case 'bar':
        return (
          <span className="flex items-center justify-end gap-2">
            <span
              role="meter"
              aria-valuenow={c.n}
              aria-valuemin={0}
              aria-valuemax={c.max}
              aria-label={c.columnLabel}
              className={cn('h-1.5 flex-1 overflow-hidden rounded-full', c.progress ? 'min-w-16' : 'min-w-12')}
              style={{ background: c.trackBackground }}
            >
              <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
            </span>
            <span className="min-w-10 text-right tabular-nums">{c.label}</span>
          </span>
        );
      case 'link': return linkTo(c.href, c.text, LINK_CLASS, renderLink);
      case 'time': return <time dateTime={c.dateTime} title={c.title}>{c.text}</time>;
    }
  };

  const cell = (r: ViewRow, ci: number): ReactNode => {
    const c = r.m.cells[ci];
    const content = renderContent(c.content);
    return c.clickable && rowActions ? (
      <button
        type="button"
        className={cn('cursor-pointer rounded-sm text-left underline-offset-2 hover:underline', FOCUS)}
        onClick={(e) => { e.stopPropagation(); rowActions.cellClick(c.key, r.m.raw); }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {content}
      </button>
    ) : content;
  };
  const viewRows: ViewRow[] = rows.map((r) => ({ id: r.index, m: r }));
  const columns: Column<ViewRow>[] = [
    ...(model.rowNumberHead ? [{
      key: '__rowNumber',
      header: <><span aria-hidden="true">#</span><span className="sr-only">{model.rowNumberHead.label}</span></>,
      thClass: model.rowNumberHead.className,
      thStyle: model.rowNumberHead.style as CSSProperties,
      cellClassName: (r: ViewRow) => r.m.numberCell?.className,
      cellStyle: (r: ViewRow) => r.m.numberCell?.style as CSSProperties | undefined,
      render: (r: ViewRow) => r.m.numberCell?.text,
    }] : []),
    ...head.map((h, ci): Column<ViewRow> => ({
      key: h.key,
      header: h.label,
      // The model's own alignment classes are in `className`; this only keeps the kit's defaults in step with them.
      align: ALIGN_OF[model.columns[ci].align],
      sortable: h.sortable,
      thClass: h.className,
      thStyle: h.style as CSSProperties,
      cellClassName: (r) => r.m.cells[ci].className,
      cellStyle: (r) => r.m.cells[ci].style as CSSProperties,
      render: (r) => cell(r, ci),
    })),
    ...(model.buttonsHead ? [{
      key: '__buttons',
      header: <span className="sr-only">{model.buttonsHead.label}</span>,
      thClass: model.buttonsHead.className,
      thStyle: model.buttonsHead.style as CSSProperties,
      cellClassName: (r: ViewRow) => r.m.buttonsCell?.className,
      cellStyle: (r: ViewRow) => r.m.buttonsCell?.style as CSSProperties | undefined,
      render: (r: ViewRow) => buttons.map((b) => {
        // Without an icon renderer an icon-only button keeps its label, so it never draws empty.
        const icon = b.icon && renderIcon ? <span aria-hidden="true" className="inline-flex">{renderIcon(b.icon, { className: 'h-3 w-3' })}</span> : null;
        const iconOnly = !!icon && !!b.iconOnly;
        return (
          <button
            key={b.id}
            type="button"
            className={cn(ROW_BUTTON, 'ml-1', icon && !iconOnly && 'gap-1', iconOnly && 'w-6 justify-center px-0')}
            aria-label={iconOnly ? b.label : undefined}
            title={iconOnly ? b.label : undefined}
            onClick={(e) => { e.stopPropagation(); rowActions?.runButton(b.id, r.m.raw); }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {icon}
            {iconOnly ? null : b.label}
          </button>
        );
      }),
    }] : []),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      {model.showToolbar && (
        <div className="flex items-center gap-2 px-2 pt-1">
          {model.clientSearch && searchInput(query, (v) => { setQuery(v); setPage(1); })}
          {model.serverSearch && (
            <form
              role="search"
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); paging!.set({ q: serverQuery.trim() }); }}
            >
              {searchInput(serverQuery, setServerQuery)}
              {model.searchQuery && (
                <button
                  type="button"
                  className={cn('shrink-0 rounded-sm text-xs font-medium text-primary hover:underline', FOCUS)}
                  onClick={() => { setServerQuery(''); paging!.set({ q: '' }); }}
                >
                  {m.clearSearch}
                </button>
              )}
            </form>
          )}
          {model.columnPicker && (
            <details className="relative ml-auto shrink-0">
              <summary className={cn(TOOL_BUTTON, 'list-none [&::-webkit-details-marker]:hidden')}>
                <Svg d={ICON_COLUMNS} />{m.columns}
              </summary>
              <fieldset className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col gap-0.5 rounded-lg border border-border bg-surface-raised p-1.5 shadow-lg">
                <legend className="sr-only">{m.columns}</legend>
                {allColumns.map((c) => (
                  <label key={c.key} className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[13px] text-text-primary hover:bg-surface-overlay">
                    <input
                      type="checkbox"
                      className={cn('accent-[var(--primary)]', FOCUS)}
                      checked={!hiddenByViewer.includes(c.key)}
                      onChange={(e) => setHiddenByViewer((h) => (e.target.checked ? h.filter((k) => k !== c.key) : [...h, c.key]))}
                    />
                    {c.label}
                  </label>
                ))}
              </fieldset>
            </details>
          )}
        </div>
      )}

      {/* The kit's DataTable, in manual mode: the rows arrive sorted, searched and paged (by the model, or by the server
          for a paged slot), the table draws them in the model's look and reports a header sort as its query. Its
          scrolling region fills the rest of the widget and is what the sticky header sticks to; a wide result
          scrolls there instead of widening the board's grid cell. */}
      {model.empty ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <p className="py-6 text-center text-[13px] text-text-secondary">{model.emptyText}</p>
        </div>
      ) : (
        <DataTable<ViewRow>
          // A fixed id: the table renders no element ids of its own here (no search, filters or detail rows), and a
          // generated one would differ between the kits that draw this widget.
          id="wk-table"
          mode="manual"
          unstyled
          rows={viewRows}
          columns={columns}
          rowId={(r) => r.id}
          state="ready"
          searchable={false}
          multiSort={false}
          query={{ sort: currentSort ? [currentSort] : [] }}
          onQueryChange={(q) => onSortChange(q.sort[0])}
          onRowClick={onRow ? (r, e) => { e.stopPropagation(); onRow(r.m.raw); } : undefined}
          onRowDoubleClick={onDouble ? (r, e) => { e.stopPropagation(); onDouble(r.m.raw); } : undefined}
          keyboardNavigation={interactive}
          rowClassName={() => model.rowClass}
          rowStyle={(r) => r.m.style as CSSProperties}
          className="flex min-h-0 flex-1 flex-col"
          scrollClassName="min-h-0 flex-1 overflow-auto"
          tableClassName="border-separate border-spacing-0 text-[13px] text-text-primary"
          tableStyle={model.tableStyle as CSSProperties}
          messages={{ tableLabel: m.table }}
        />
      )}

      {model.footer.kind === 'rowsShown' && (
        <div className="flex min-h-8 items-center px-2"><Meta>{model.footer.text}</Meta></div>
      )}
      {model.footer.kind === 'pager' && (
        <Pager
          m={m}
          info={model.footer.info}
          page={model.footer.page}
          pages={model.footer.pages}
          onPage={paged ? (p) => paging!.set({ page: p }) : setPage}
          canNext={model.footer.canNext}
        />
      )}
    </div>
  );
}

export const DATA_TABLE_VIEW: WidgetKindView = {
  View: DataTableView,
  isEmpty: (data, settings) => !data.rows?.rows?.length || tableColumns(data.rows, settings).length === 0,
  toCsv: (data, settings) => {
    const cols = tableColumns(data.rows, settings);
    if (!cols.length || !data.rows) return [];
    return [cols.map(csvHeader), ...(data.rows?.rows ?? []).map((row) => cols.map((c) => csvCell(c, row[c.key])))];
  },
  emptyShape: true,
};
