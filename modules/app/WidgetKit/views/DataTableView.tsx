'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { PagedEcho, WidgetKindView, WidgetViewProps } from '../kind';
import { SettingIcon, useKitMessages, useWidgetKit } from '../WidgetKitContext';
import type { TableMessages } from '../messages';
import { useNow } from '../useNow';
import { Meta, Pill } from './ui';
import {
  FOCUS, LINK_CLASS, csvCell, csvHeader, tableColumns, tableModel,
  type CellContent, type Row, type TableSettings as S,
} from './table-logic';

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
  buttons: Array<{ id: string; label: string }>;
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

const TOOL_BUTTON = cn('inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-overlay hover:text-text-primary', FOCUS);
const ROW_BUTTON = cn('inline-flex h-6 cursor-pointer items-center rounded-md border border-border px-2 text-xs font-medium text-text-primary hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50', FOCUS);
const PAGE_BUTTON = cn('inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent', FOCUS);

const Svg = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', className)}>
    <path d={d} />
  </svg>
);
const ICON_SEARCH = 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM14.5 14.5 11 11';
const ICON_COLUMNS = 'M2.5 2.5h11v11h-11zM6.2 2.5v11M9.8 2.5v11';
const ICON_PREV = 'M10 3.5 5.5 8l4.5 4.5';
const ICON_NEXT = 'M6 3.5 10.5 8 6 12.5';
const ICON_SORT_UP = 'M4.5 9.5 8 6l3.5 3.5';
const ICON_SORT_DOWN = 'M4.5 6.5 8 10l3.5-3.5';

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

  const toggleSort = (key: string) => {
    const dir = head.find((h) => h.key === key)?.dir ?? null;
    const next = dir === 'asc' ? { key, dir: 'desc' as const } : dir === 'desc' ? undefined : { key, dir: 'asc' as const };
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

      {/* Its own scroller: a wide result must not widen the board's grid cell. */}
      <div className="min-h-0 flex-1 overflow-auto">
        {model.empty ? (
          <p className="py-6 text-center text-[13px] text-text-secondary">{model.emptyText}</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px] text-text-primary" style={model.tableStyle as CSSProperties}>
            <thead>
              <tr>
                {model.rowNumberHead && (
                  <th scope="col" className={model.rowNumberHead.className} style={model.rowNumberHead.style as CSSProperties}>
                    <span aria-hidden="true">#</span><span className="sr-only">{model.rowNumberHead.label}</span>
                  </th>
                )}
                {head.map((h) => (
                  <th key={h.key} scope="col" aria-sort={h.ariaSort} className={h.className} style={h.style as CSSProperties}>
                    {h.sortable ? (
                      <button
                        type="button"
                        className={cn('group/sort inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-text-primary', h.alignEnd && 'flex-row-reverse', FOCUS)}
                        onClick={() => toggleSort(h.key)}
                      >
                        {h.label}
                        <Svg
                          d={h.dir === 'asc' ? ICON_SORT_UP : ICON_SORT_DOWN}
                          className={cn('h-3 w-3', h.dir ? 'text-text-primary' : 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60')}
                        />
                      </button>
                    ) : h.label}
                  </th>
                ))}
                {model.buttonsHead && (
                  <th scope="col" className={model.buttonsHead.className} style={model.buttonsHead.style as CSSProperties}>
                    <span className="sr-only">{model.buttonsHead.label}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.index}
                  className={model.rowClass}
                  style={r.style as CSSProperties}
                  {...(interactive ? {
                    tabIndex: 0,
                    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRow?.(r.raw); },
                    onDoubleClick: onDouble ? (e: React.MouseEvent) => { e.stopPropagation(); onDouble(r.raw); } : undefined,
                    onKeyDown: (e: React.KeyboardEvent) => {
                      // Only the row's own Enter/Space: a key press on an inner button belongs to that button.
                      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                        e.preventDefault(); e.stopPropagation(); (onRow ?? onDouble)?.(r.raw);
                      }
                    },
                  } : {})}
                >
                  {r.numberCell && (
                    <td className={r.numberCell.className} style={r.numberCell.style as CSSProperties}>{r.numberCell.text}</td>
                  )}
                  {r.cells.map((cell) => {
                    const content = renderContent(cell.content);
                    return (
                      <td key={cell.key} className={cell.className} style={cell.style as CSSProperties}>
                        {cell.clickable && rowActions ? (
                          <button
                            type="button"
                            className={cn('cursor-pointer rounded-sm text-left underline-offset-2 hover:underline', FOCUS)}
                            onClick={(e) => { e.stopPropagation(); rowActions.cellClick(cell.key, r.raw); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            {content}
                          </button>
                        ) : content}
                      </td>
                    );
                  })}
                  {r.buttonsCell && (
                    <td className={r.buttonsCell.className} style={r.buttonsCell.style as CSSProperties}>
                      {buttons.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={cn(ROW_BUTTON, 'ml-1')}
                          onClick={(e) => { e.stopPropagation(); rowActions?.runButton(b.id, r.raw); }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          {b.label}
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
