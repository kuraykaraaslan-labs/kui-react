'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import type { FontValue } from '../../SchemaForm/types';
import { metaFormat, valueMapList } from '../settings/source-meta';
import { cssColor, fontStyle, formatValue, rangeFor, type RangeEdges, type ValueFormat } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { PagedEcho, SlotData, WidgetKindView, WidgetViewProps } from '../kind';
import { isInternalPath } from '../templates/map';
import { SettingIcon, useKitMessages, useWidgetKit } from '../WidgetKitContext';
import type { CommonMessages, TableMessages } from '../messages';
import { useNow } from '../useNow';
import { Meta, Pill, tint } from './ui';

// ── Shared data helpers (also used by the feed and map views) ───────────────────

type Row = Record<string, unknown>;
type DeclaredColumn = NonNullable<SlotData['columns']>[number];

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const TONE_NAMES = ['success', 'warning', 'error', 'info', 'neutral', 'primary'] as const;
export type ToneName = (typeof TONE_NAMES)[number];
const TONE_VAR: Record<ToneName, string> = {
  success: 'var(--success)', warning: 'var(--warning)', error: 'var(--error)',
  info: 'var(--info)', neutral: 'var(--text-secondary)', primary: 'var(--primary)',
};
export const toneOf = (v: unknown): ToneName | undefined => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (TONE_NAMES as readonly string[]).includes(s) ? (s as ToneName) : undefined;
};

/** A colour from DATA: a tone name (`success`) or any CSS colour that `cssColor` accepts; else undefined. */
export function dataColor(v: unknown): string | undefined {
  const tone = toneOf(v);
  return tone ? TONE_VAR[tone] : cssColor(v);
}

/** Common status words and the tone they mean, so a plain "Online" / "Offline" column reads right without setup. */
const STATUS_WORDS: Record<string, ToneName> = {
  online: 'success', active: 'success', ok: 'success', running: 'success', healthy: 'success', up: 'success',
  done: 'success', completed: 'success', resolved: 'success', connected: 'success', enabled: 'success', normal: 'success',
  warning: 'warning', warn: 'warning', degraded: 'warning', pending: 'warning', idle: 'warning', maintenance: 'warning', minor: 'warning', major: 'warning',
  offline: 'error', error: 'error', failed: 'error', failure: 'error', critical: 'error', down: 'error', alarm: 'error',
  disconnected: 'error', stopped: 'error', fault: 'error',
  info: 'info', new: 'info', open: 'info', indeterminate: 'neutral', unknown: 'neutral', disabled: 'neutral', inactive: 'neutral',
};

/** A tone name, a CSS colour, or a common status word ("Online", "Offline") → a colour; else undefined. */
export function statusColor(v: unknown): string | undefined {
  const direct = dataColor(v);
  if (direct) return direct;
  const word = typeof v === 'string' ? STATUS_WORDS[v.trim().toLowerCase()] : undefined;
  return word ? TONE_VAR[word] : undefined;
}

/** One value → colour mapping row (`valueMap` / `valueColors` settings). */
export interface ValueColor { value?: string; label?: string; color?: string; icon?: string }

/** The mapping entry whose value equals the raw value (trimmed, case-insensitive). */
export function matchValue(raw: unknown, map: unknown): ValueColor | undefined {
  if (!Array.isArray(map) || raw === null || raw === undefined) return undefined;
  const key = (typeof raw === 'object' ? JSON.stringify(raw) : String(raw)).trim().toLowerCase();
  return (map as ValueColor[]).find((e) => e && typeof e.value === 'string' && e.value.trim().toLowerCase() === key);
}

/** The declared columns of a table slot; without a declaration, the first row's keys as text. */
export function declaredColumns(slot: SlotData | undefined): DeclaredColumn[] {
  if (slot?.columns?.length) return slot.columns;
  const first = slot?.rows?.[0];
  return first ? Object.keys(first).map((key) => ({ key, label: key, type: typeof first[key] === 'number' ? 'number' : 'text' })) : [];
}

// ── Dates ─────────────────────────────────────────────────────────────────────

export type DateDisplay = 'relative' | 'date' | 'time' | 'datetime' | 'custom';

const hasTimeOfDay = (raw: string) => /[T\s]\d{1,2}:\d{2}/.test(raw);

/** Epoch ms of a date value (ISO text or a number), or null. */
export function toEpoch(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
  const at = typeof raw === 'number' ? raw : Date.parse(String(raw));
  return Number.isFinite(at) ? at : null;
}

/** "5 minutes ago" ("5m ago" narrow) in the viewer's locale. */
export function relativeTime(at: number, now = Date.now(), locale?: string, style: 'long' | 'short' | 'narrow' = 'long'): string {
  const diffSec = Math.round((at - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style });
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(diffSec / 86_400), 'day');
  if (abs < 365 * 86_400) return rtf.format(Math.round(diffSec / (30 * 86_400)), 'month');
  return rtf.format(Math.round(diffSec / (365 * 86_400)), 'year');
}

const PATTERN_RE = /'[^']*'|yyyy|yy|MMMM|MMM|MM|M|EEEE|EEE|dd|d|HH|H|hh|h|mm|ss|a/g;

/** A date by a pattern: yyyy yy MMMM MMM MM M EEEE EEE dd d HH H hh h mm ss a; 'quoted' text is literal. */
export function formatDatePattern(d: Date, pattern: string, locale?: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const h12 = d.getHours() % 12 || 12;
  const parts: Record<string, () => string> = {
    yyyy: () => String(d.getFullYear()),
    yy: () => pad(d.getFullYear() % 100),
    MMMM: () => d.toLocaleString(locale, { month: 'long' }),
    MMM: () => d.toLocaleString(locale, { month: 'short' }),
    MM: () => pad(d.getMonth() + 1),
    M: () => String(d.getMonth() + 1),
    EEEE: () => d.toLocaleString(locale, { weekday: 'long' }),
    EEE: () => d.toLocaleString(locale, { weekday: 'short' }),
    dd: () => pad(d.getDate()),
    d: () => String(d.getDate()),
    HH: () => pad(d.getHours()),
    H: () => String(d.getHours()),
    hh: () => pad(h12),
    h: () => String(h12),
    mm: () => pad(d.getMinutes()),
    ss: () => pad(d.getSeconds()),
    a: () => (d.getHours() < 12 ? 'AM' : 'PM'),
  };
  return pattern.slice(0, 60).replace(PATTERN_RE, (tok) => (tok.startsWith("'") ? tok.slice(1, -1) : parts[tok]()));
}

export interface DateOptions {
  display?: DateDisplay;
  pattern?: string;
  now?: number;
  /** Relative wording: 'long' = "5 minutes ago", 'narrow' = "5m ago". */
  relativeStyle?: 'long' | 'short' | 'narrow';
  /** The value names a day only (no time of day): time-of-day displays fall back to the date. */
  dateOnly?: boolean;
}

/** An instant as the display setting asks: relative, a short date/time, or a custom pattern. */
export function formatDateValue(at: number, opts: DateOptions = {}, locale?: string): string {
  const d = new Date(at);
  const now = opts.now ?? Date.now();
  const thisYear = d.getFullYear() === new Date(now).getFullYear();
  const date = () => d.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
  const display = opts.dateOnly && (opts.display === 'time' || opts.display === 'datetime') ? 'date' : opts.display ?? 'relative';
  switch (display) {
    case 'time': return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    case 'date': return date();
    case 'datetime': return `${date()} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
    case 'custom': return opts.pattern?.trim() ? formatDatePattern(d, opts.pattern, locale) : formatDateValue(at, { ...opts, display: 'datetime' }, locale);
    default: return relativeTime(at, now, locale, opts.relativeStyle ?? 'long');
  }
}

/** The full local date and time, for a hover title. */
export const fullDate = (at: number, locale?: string) =>
  new Date(at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * One cell as display text, by its declared type and the value format (dates by `date`, else as a full
 * local date). `yesNo` words a boolean (default Yes / No).
 */
export function cellText(
  value: unknown, type: DeclaredColumn['type'] | undefined, format: ValueFormat, override: { unit?: string; decimals?: number }, locale?: string,
  date?: DateOptions, yesNo?: CommonMessages,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'number' || override.unit !== undefined || override.decimals !== undefined) {
    if (num(value) !== null) return formatValue(value, type === 'number' ? format : {}, override, locale);
    if (type === 'number') return String(value);
  }
  if (type === 'date') {
    const at = toEpoch(value);
    if (at === null) return String(value);
    const dateOnly = typeof value === 'string' && !hasTimeOfDay(value);
    if (date) return formatDateValue(at, { ...date, dateOnly }, locale);
    const d = new Date(at);
    return dateOnly ? d.toLocaleDateString(locale) : d.toLocaleString(locale);
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 200 ? `${json.slice(0, 197)}…` : json;
  }
  if (typeof value === 'boolean') return value ? yesNo?.yes ?? 'Yes' : yesNo?.no ?? 'No';
  return String(value);
}

/**
 * Expand `/admin/devices/{id}` with a row's values. Only an INTERNAL path may come out: the
 * template is checked BEFORE expansion, and each value is URL-encoded, so a row value cannot add
 * a scheme, a host or a path escape. Null when the template is unsafe or a token has no value.
 */
export function expandLinkTemplate(template: unknown, row: Row | undefined): string | null {
  if (typeof template !== 'string' || !template || !row || !isInternalPath(template)) return null;
  let missing = false;
  const out = template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_, key: string) => {
    const v = row[key];
    if (v === null || v === undefined || v === '') { missing = true; return ''; }
    return encodeURIComponent(String(v));
  });
  return missing || !isInternalPath(out) ? null : out;
}

/** A CSV cell's raw text. */
export const rawText = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Plain anchor or the host's router link. */
export function linkTo(
  href: string, children: ReactNode, className: string, renderLink?: WidgetViewProps['renderLink'],
): ReactNode {
  return renderLink ? renderLink(href, children, className) : <a href={href} className={className}>{children}</a>;
}

const LINK_CLASS = 'font-medium text-primary underline-offset-2 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

/** An icon class list a row may name (`fas fa-bolt`). */
const ICON_RE = /^[a-z0-9:-]+(?: [a-z0-9:-]+){0,3}$/i;

// ── Table settings and columns ────────────────────────────────────────────────

type Visible = 'always' | 'desktop' | 'mobile' | 'hidden';
type Cell = 'auto' | 'text' | 'number' | 'date' | 'badge' | 'bar' | 'progress' | 'link' | 'icon';
type Wrap = 'nowrap' | 'truncate' | 'wrap';

interface ColumnSetting {
  key?: string; label?: string; visible?: Visible; cell?: Cell; linkTemplate?: string; sortable?: boolean;
  align?: 'auto' | 'start' | 'center' | 'end'; width?: 'auto' | 'narrow' | 'wide' | 'px'; widthPx?: number;
  unit?: string; decimals?: number; color?: string; headerColor?: string; barMax?: number; ranges?: unknown[];
  dateFormat?: 'inherit' | DateDisplay; datePattern?: string; valueMap?: ValueColor[]; badgeStyle?: 'soft' | 'dot' | 'solid';
  icon?: string; font?: FontValue; wrap?: Wrap;
}

/** A row colour rule: the first matching rule colours the row. */
interface RowRule {
  column?: string;
  op?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty';
  value?: string;
  /** `column`: compare against the row's own `valueColumn` instead of `value` (a threshold held in a sibling column). */
  valueFrom?: 'value' | 'column';
  valueColumn?: string;
  /** The rule applies only to rows whose gate column is true (a flag that says the threshold is armed). */
  gateColumn?: string;
  color?: string;
  target?: 'background' | 'text' | 'bar';
}

type S = {
  columns?: ColumnSetting[];
  maxRows?: number;
  paging?: 'none' | 'pages' | 'scroll';
  sortable?: boolean;
  defaultSort?: string;
  defaultSortDir?: 'asc' | 'desc';
  search?: boolean;
  columnPicker?: boolean;
  showRowNumbers?: boolean;
  onlyChanges?: boolean;
  historyLayout?: boolean;
  emptyText?: string;
  dateFormat?: DateDisplay;
  datePattern?: string;
  density?: 'compact' | 'normal' | 'comfortable';
  stickyHeader?: boolean;
  striped?: boolean;
  stripeColor?: string;
  rowHover?: boolean;
  gridLines?: 'rows' | 'all' | 'none';
  borderColor?: string;
  rowColorColumn?: string;
  rowRules?: RowRule[];
  headerFont?: FontValue;
  headerColor?: string;
  headerBackground?: string;
  cellFont?: FontValue;
  cellColor?: string;
  ranges?: unknown;
  rangeEdges?: RangeEdges;
};

/** One effective column: its declaration merged with its settings. */
export interface TableColumn {
  key: string;
  label: string;
  type: DeclaredColumn['type'];
  visible: Visible;
  cell: Exclude<Cell, 'auto'>;
  linkTemplate?: string;
  sortable: boolean;
  align: 'start' | 'center' | 'end';
  width: 'auto' | 'narrow' | 'wide' | 'px';
  widthPx?: number;
  override: { unit?: string; decimals?: number };
  color?: string;
  headerColor?: string;
  barMax?: number;
  ranges?: unknown[];
  /** Undefined = the table's date format. */
  dateFormat?: DateDisplay;
  datePattern?: string;
  valueMap?: ValueColor[];
  badgeStyle: 'soft' | 'dot' | 'solid';
  icon?: string;
  font?: FontValue;
  wrap: Wrap;
}

/** The cell a column gets when set to Auto: badge columns and value maps → badge, numbers, dates, else text. */
function autoCell(decl: DeclaredColumn, valueMap: ValueColor[] | undefined): TableColumn['cell'] {
  if (decl.type === 'badge' || (valueMap && valueMap.length > 0)) return 'badge';
  if (decl.type === 'number') return 'number';
  if (decl.type === 'date') return 'date';
  return 'text';
}

/**
 * The columns a table shows: the configured ones in their order (a key the query no longer
 * declares is skipped, never shown with an empty header), or every declared column when none is
 * configured. Hidden columns are left out. With no result at all (the empty shape), the configured
 * columns stand on their own settings, as text.
 */
export function tableColumns(slot: SlotData | undefined, settings: Sparse): TableColumn[] {
  const s = settings as S;
  const declared = declaredColumns(slot);
  const byKey = new Map(declared.map((c) => [c.key, c]));
  const configured = (Array.isArray(s.columns) ? s.columns : []).filter((c) => c && typeof c.key === 'string' && c.key);
  const source: Array<{ decl: DeclaredColumn; cfg: ColumnSetting }> = configured.length
    ? configured.flatMap((cfg) => {
      const decl = byKey.get(cfg.key!) ?? (slot ? undefined : { key: cfg.key!, label: cfg.label?.trim() || cfg.key!, type: 'text' as const });
      return decl ? [{ decl, cfg }] : [];
    })
    : declared.map((decl) => ({ decl, cfg: {} }));
  const seen = new Set<string>();
  const out: TableColumn[] = [];
  for (const { decl, cfg } of source) {
    if (seen.has(decl.key) || cfg.visible === 'hidden') continue;
    seen.add(decl.key);
    // What the source says about the column (unit, decimals, value map) is the default; the placement's own setting wins.
    const ownMap = Array.isArray(cfg.valueMap) && cfg.valueMap.length ? cfg.valueMap : undefined;
    const valueMap = ownMap ?? (valueMapList(decl).length ? valueMapList(decl) : undefined);
    const cell = cfg.cell && cfg.cell !== 'auto' ? cfg.cell : autoCell(decl, valueMap);
    const numeric = cell === 'number' || cell === 'bar' || cell === 'progress';
    out.push({
      key: decl.key,
      label: cfg.label?.trim() || decl.label || decl.key,
      type: cell === 'number' ? 'number' : cell === 'date' ? 'date' : decl.type,
      visible: cfg.visible ?? 'always',
      cell,
      linkTemplate: cfg.linkTemplate || undefined,
      sortable: cfg.sortable !== false,
      align: cfg.align && cfg.align !== 'auto' ? cfg.align : numeric ? 'end' : cell === 'icon' ? 'center' : 'start',
      width: cfg.width ?? 'auto',
      widthPx: cfg.widthPx,
      override: {
        ...metaFormat(decl),
        ...(cfg.unit ? { unit: cfg.unit } : {}),
        ...(typeof cfg.decimals === 'number' ? { decimals: cfg.decimals } : {}),
      },
      color: cfg.color,
      headerColor: cfg.headerColor,
      barMax: typeof cfg.barMax === 'number' ? cfg.barMax : undefined,
      ranges: Array.isArray(cfg.ranges) && cfg.ranges.length ? cfg.ranges : undefined,
      dateFormat: cfg.dateFormat && cfg.dateFormat !== 'inherit' ? cfg.dateFormat : undefined,
      datePattern: cfg.datePattern || undefined,
      valueMap,
      badgeStyle: cfg.badgeStyle ?? 'soft',
      icon: cfg.icon || undefined,
      font: cfg.font && Object.keys(cfg.font).length ? cfg.font : undefined,
      wrap: cfg.wrap ?? 'nowrap',
    });
  }
  // The history preset: the first date column leads, unless the placement ordered its columns itself.
  if (s.historyLayout && !configured.length) {
    const at = out.findIndex((c) => c.type === 'date');
    if (at > 0) out.unshift(...out.splice(at, 1));
  }
  return out;
}

/** A row equal to the one before it on every column but the dates is dropped (history-shaped rows). */
export function dropRepeats(rows: Row[], columns: TableColumn[]): Row[] {
  const keys = columns.filter((c) => c.type !== 'date').map((c) => c.key);
  if (!keys.length) return rows;
  const same = (a: Row, b: Row) => keys.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null));
  return rows.filter((row, i) => i === 0 || !same(row, rows[i - 1]));
}

const compareValues = (a: unknown, b: unknown, type: DeclaredColumn['type']): number => {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const na = num(a);
  const nb = num(b);
  if (na !== null && nb !== null) return na - nb;
  if (type === 'date') {
    const ta = Date.parse(String(a));
    const tb = Date.parse(String(b));
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

/** Rows sorted by a column (empty values last in both directions). Stable; never mutates. */
export function sortRows(rows: Row[], key: string, dir: 'asc' | 'desc', type?: DeclaredColumn['type']): Row[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      const ex = x.row[key] === null || x.row[key] === undefined || x.row[key] === '';
      const ey = y.row[key] === null || y.row[key] === undefined || y.row[key] === '';
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
      const c = compareValues(x.row[key], y.row[key], type ?? 'text');
      return (dir === 'asc' ? c : -c) || x.i - y.i;
    })
    .map((x) => x.row);
}

/** A flag cell that says yes: true, 1, or the words true / yes / on / 1. */
function truthy(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return typeof v === 'string' && ['true', 'yes', 'on', '1'].includes(v.trim().toLowerCase());
}

/** Whether a row matches a colour rule. Numbers compare numerically; text case-insensitively. */
export function ruleMatches(rule: RowRule, row: Row): boolean {
  if (!rule || typeof rule.column !== 'string' || !rule.column) return false;
  if (rule.gateColumn && !truthy(row[rule.gateColumn])) return false;
  const raw = row[rule.column];
  const op = rule.op ?? 'eq';
  const empty = raw === null || raw === undefined || raw === '';
  if (op === 'empty') return empty;
  if (empty) return op === 'ne';
  const text = (typeof raw === 'object' ? JSON.stringify(raw) : String(raw)).trim().toLowerCase();
  const operand = rule.valueFrom === 'column' && rule.valueColumn ? row[rule.valueColumn] : rule.value;
  if (rule.valueFrom === 'column' && (operand === null || operand === undefined || operand === '')) return false;
  const want = (operand === null || operand === undefined ? '' : typeof operand === 'object' ? JSON.stringify(operand) : String(operand)).trim().toLowerCase();
  const a = num(raw);
  const b = num(operand);
  switch (op) {
    case 'ne': return a !== null && b !== null ? a !== b : text !== want;
    case 'gt': return a !== null && b !== null && a > b;
    case 'gte': return a !== null && b !== null && a >= b;
    case 'lt': return a !== null && b !== null && a < b;
    case 'lte': return a !== null && b !== null && a <= b;
    case 'contains': return want !== '' && text.includes(want);
    default: return a !== null && b !== null ? a === b : text === want;
  }
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

/** Row heights (DESIGN.md: 36px rows, compact 28px). */
const ROW_H: Record<NonNullable<S['density']>, string> = { compact: 'h-7', normal: 'h-9', comfortable: 'h-11' };
const ALIGN: Record<TableColumn['align'], string> = { start: 'text-left', center: 'text-center', end: 'text-right' };
const JUSTIFY: Record<TableColumn['align'], string> = { start: 'justify-start', center: 'justify-center', end: 'justify-end' };
const WIDTH: Record<TableColumn['width'], string> = { auto: '', narrow: 'w-20', wide: 'min-w-60', px: '' };
const VISIBLE: Record<Visible, string | false> = { always: false, hidden: false, desktop: 'hidden md:table-cell', mobile: 'md:hidden' };
const WRAP: Record<Wrap, string> = { nowrap: 'whitespace-nowrap', truncate: 'max-w-64 truncate', wrap: 'whitespace-normal break-words' };
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';
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
  const allColumns = useMemo(() => tableColumns(result, settings), [result, settings]);
  const [hiddenByViewer, setHiddenByViewer] = useState<string[]>([]);
  const columns = allColumns.filter((c) => !hiddenByViewer.includes(c.key));
  // No result at all: the empty shape, the configured headers over no rows, without a search or column picker.
  const shapeOnly = !result && columns.length > 0;
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    s.defaultSort ? { key: s.defaultSort, dir: s.defaultSortDir ?? 'desc' } : null,
  );
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState(echo?.q ?? '');
  useServerDefaultSort(paged ? echo : undefined, paged ? paging : undefined, s.defaultSort, s.defaultSortDir);
  const [page, setPage] = useState(1);

  const dateOf = (c: TableColumn): DateOptions => ({
    display: c.dateFormat ?? s.dateFormat ?? 'relative',
    pattern: c.dateFormat ? c.datePattern : s.datePattern,
    now: nowMs,
    relativeStyle: 'narrow',
  });
  const textOf = (c: TableColumn, raw: unknown) => cellText(raw, c.type, format, c.override, locale, dateOf(c), kit.common);

  const allRows = useMemo(
    () => (s.onlyChanges && !paged ? dropRepeats(result?.rows ?? [], allColumns) : result?.rows ?? []),
    [result, s.onlyChanges, paged, allColumns],
  );
  const pageSize = Math.max(1, Math.min(100, Number(s.maxRows) || 10));
  const viewerSort = s.sortable !== false;
  const clientSearch = !paged && s.search !== false;
  const mode = s.paging ?? 'none';

  const prepared = (() => {
    if (paged) return allRows;
    let rows = allRows;
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => columns.some((c) => {
        const mapped = matchValue(row[c.key], c.valueMap)?.label;
        return (mapped ?? textOf(c, row[c.key])).toLowerCase().includes(q) || rawText(row[c.key]).toLowerCase().includes(q);
      }));
    }
    if (sort) {
      const col = allColumns.find((c) => c.key === sort.key) ?? declaredColumns(result).find((c) => c.key === sort.key);
      rows = sortRows(rows, sort.key, sort.dir, col?.type);
    }
    return rows;
  })();

  const clientPages = !paged && mode === 'pages' ? Math.max(1, Math.ceil(prepared.length / pageSize)) : 1;
  const current = Math.min(page, clientPages);
  const offset = mode === 'pages' && !paged ? (current - 1) * pageSize : 0;
  const rows = paged
    ? prepared
    : mode === 'pages'
      ? prepared.slice(offset, offset + pageSize)
      : mode === 'scroll' ? prepared : prepared.slice(0, pageSize);

  // Bar scales: the largest absolute value per bar column over the loaded rows.
  const barMax = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of allColumns) {
      if (c.cell === 'bar') out[c.key] = c.barMax ?? Math.max(0, ...allRows.map((r) => Math.abs(num(r[c.key]) ?? 0)));
      if (c.cell === 'progress') out[c.key] = c.barMax ?? 100;
    }
    return out;
  }, [allColumns, allRows]);

  const onRow = rowActions?.rowClick;
  const onDouble = rowActions?.rowDoubleClick;
  const interactive = !!(onRow || onDouble);
  const buttons = rowActions?.buttons ?? [];
  const cellCols = rowActions?.cellClickColumns ?? [];
  const cellClickable = (key: string) => cellCols.includes('*') || cellCols.includes(key);
  const rowH = ROW_H[s.density ?? 'normal'] ?? ROW_H.normal;
  const border = cssColor(s.borderColor);
  const edges = s.rangeEdges ?? 'from';
  const lines = s.gridLines ?? 'rows';
  const sticky = s.stickyHeader !== false;
  const rules = Array.isArray(s.rowRules) ? s.rowRules : [];

  // Header: 12px medium secondary on a subtle band (DESIGN.md). A sticky header stays opaque over scrolling rows.
  const headBg = cssColor(s.headerBackground);
  const band = tint('var(--text-primary)', 5)!;
  const headerStyle: CSSProperties = {
    ...fontStyle(s.headerFont, s.headerColor),
    ...(headBg
      ? { background: headBg }
      : sticky
        ? { backgroundColor: 'var(--surface-raised)', backgroundImage: `linear-gradient(${band}, ${band})` }
        : { background: band }),
  };
  const cellBorder = cn(lines !== 'none' && 'border-b border-border', lines === 'all' && 'border-r last:border-r-0');
  const borderStyle: CSSProperties | undefined = border ? { borderColor: border } : undefined;

  const sortDirOf = (key: string) => (paged ? (echo!.sort?.key === key ? echo!.sort.dir : null) : sort?.key === key ? sort.dir : null);
  const canSort = (c: TableColumn) => viewerSort && c.sortable && (paged ? echo!.sortable.includes(c.key) : true);
  const toggleSort = (key: string) => {
    const dir = sortDirOf(key);
    const next = dir === 'asc' ? { key, dir: 'desc' as const } : dir === 'desc' ? undefined : { key, dir: 'asc' as const };
    if (paged) paging!.set({ sort: next });
    else { setSort(next ?? null); setPage(1); }
  };

  const rangeColorOf = (c: TableColumn, v: unknown) => cssColor(rangeFor(v, c.ranges ?? s.ranges, edges)?.color);

  const renderCell = (c: TableColumn, row: Row): ReactNode => {
    const raw = row[c.key];
    const empty = raw === null || raw === undefined || raw === '';
    const text = textOf(c, raw);
    const n = num(raw);
    if (empty) return <span className="text-text-secondary/60">—</span>;
    const mapped = matchValue(raw, c.valueMap);
    if (c.cell === 'badge') {
      const color = cssColor(mapped?.color) ?? statusColor(raw) ?? (n !== null ? rangeColorOf(c, n) : undefined) ?? cssColor(c.color);
      return <Pill size="sm" variant={c.badgeStyle} label={mapped?.label || text} color={color} icon={mapped?.icon || undefined} />;
    }
    if (c.cell === 'icon') {
      const name = mapped?.icon || (typeof raw === 'string' && ICON_RE.test(raw.trim()) && raw.includes('fa-') ? raw.trim() : undefined) || c.icon;
      const color = cssColor(mapped?.color) ?? statusColor(raw) ?? cssColor(c.color) ?? 'var(--text-secondary)';
      const label = mapped?.label || text;
      return (
        <span className={cn('inline-flex items-center', JUSTIFY[c.align])} title={label}>
          {name && renderIcon?.(name, {}) != null
            ? <SettingIcon name={name} style={{ color, fontSize: 14, width: 14, height: 14 }} />
            : <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
          <span className="sr-only">{label}</span>
        </span>
      );
    }
    if (c.cell === 'bar' || c.cell === 'progress') {
      if (n === null) return text;
      const max = barMax[c.key] || 0;
      const pct = max > 0 ? Math.min(100, Math.max(0, (Math.abs(n) / max) * 100)) : 0;
      const color = rangeColorOf(c, n) ?? cssColor(c.color) ?? 'var(--primary)';
      const label = c.cell === 'progress' && !c.override.unit && !format.unit
        ? `${formatValue(pct, { decimals: 0 }, {}, locale)} %`
        : text;
      return (
        <span className="flex items-center justify-end gap-2">
          <span
            role="meter"
            aria-valuenow={n}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={c.label}
            className={cn('h-1.5 flex-1 overflow-hidden rounded-full', c.cell === 'progress' ? 'min-w-16' : 'min-w-12')}
            style={{ background: c.cell === 'progress' ? tint(color, 18) : tint('var(--text-primary)', 8) }}
          >
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
          </span>
          <span className="min-w-10 text-right tabular-nums">{label}</span>
        </span>
      );
    }
    if (c.cell === 'link') {
      const href = c.linkTemplate ? expandLinkTemplate(c.linkTemplate, row) : isInternalPath(raw) ? raw : null;
      if (href) return linkTo(href, mapped?.label || text, LINK_CLASS, renderLink);
    }
    if (c.cell === 'date' || c.type === 'date') {
      const at = toEpoch(raw);
      if (at !== null) return <time dateTime={new Date(at).toISOString()} title={fullDate(at, locale)}>{text}</time>;
    }
    return mapped?.label || text;
  };

  /** A text/number/date cell's colour: its value map, then ranges, then the column colour. */
  const textColor = (c: TableColumn, row: Row): string | undefined => {
    if (c.cell === 'badge' || c.cell === 'bar' || c.cell === 'progress' || c.cell === 'icon') return undefined;
    return cssColor(matchValue(row[c.key], c.valueMap)?.color)
      ?? (c.ranges ? rangeColorOf(c, row[c.key]) : undefined)
      ?? cssColor(c.color);
  };

  const rowLook = (row: Row, i: number): { style: CSSProperties; accent?: string } => {
    const rule = rules.find((r) => ruleMatches(r, row));
    const ruleColor = rule ? cssColor(rule.color) ?? statusColor(rule.color) : undefined;
    const style: CSSProperties = {};
    let accent: string | undefined;
    if (ruleColor && rule?.target === 'text') style.color = ruleColor;
    else if (ruleColor && rule?.target === 'bar') accent = ruleColor;
    else if (ruleColor) style.background = tint(ruleColor, 12);
    if (!style.background) {
      const byColumn = s.rowColorColumn ? statusColor(row[s.rowColorColumn]) : undefined;
      if (byColumn) style.background = tint(byColumn, 12);
      else if (s.striped && i % 2 === 1) style.background = cssColor(s.stripeColor) ?? tint('var(--text-primary)', 3);
    }
    return { style, accent };
  };

  const showSearch = clientSearch || (paged && echo!.searchable && s.search !== false);
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      {(showSearch || s.columnPicker) && !shapeOnly && (
        <div className="flex items-center gap-2 px-2 pt-1">
          {clientSearch && searchInput(query, (v) => { setQuery(v); setPage(1); })}
          {paged && echo!.searchable && s.search !== false && (
            <form
              role="search"
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); paging!.set({ q: serverQuery.trim() }); }}
            >
              {searchInput(serverQuery, setServerQuery)}
              {echo!.q && (
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
          {s.columnPicker && (
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
        {rows.length === 0 && !shapeOnly ? (
          <p className="py-6 text-center text-[13px] text-text-secondary">{s.emptyText?.trim() || m.noMatches}</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-[13px] text-text-primary" style={fontStyle(s.cellFont, s.cellColor)}>
            <thead>
              <tr>
                {s.showRowNumbers && (
                  <th scope="col" className={cn('h-8 w-8 px-2 text-right text-xs font-medium text-text-secondary first:rounded-l-md', sticky && 'sticky top-0 z-10')} style={headerStyle}>
                    <span aria-hidden="true">#</span><span className="sr-only">{m.rowNumber}</span>
                  </th>
                )}
                {columns.map((c) => {
                  const dir = sortDirOf(c.key);
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(
                        'h-8 whitespace-nowrap px-2 text-xs font-medium text-text-secondary first:rounded-l-md last:rounded-r-md',
                        ALIGN[c.align], WIDTH[c.width], VISIBLE[c.visible],
                        sticky && 'sticky top-0 z-10',
                        s.historyLayout && c.key === columns[0]?.key && 'sticky left-0 z-20',
                      )}
                      style={{
                        ...headerStyle,
                        ...(cssColor(c.headerColor) ? { color: cssColor(c.headerColor) } : {}),
                        ...(c.width === 'px' && c.widthPx ? { width: c.widthPx, minWidth: c.widthPx } : {}),
                      }}
                    >
                      {canSort(c) ? (
                        <button
                          type="button"
                          className={cn('group/sort inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-text-primary', c.align === 'end' && 'flex-row-reverse', FOCUS)}
                          onClick={() => toggleSort(c.key)}
                        >
                          {c.label}
                          <Svg
                            d={dir === 'asc' ? ICON_SORT_UP : ICON_SORT_DOWN}
                            className={cn('h-3 w-3', dir ? 'text-text-primary' : 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60')}
                          />
                        </button>
                      ) : c.label}
                    </th>
                  );
                })}
                {buttons.length > 0 && (
                  <th scope="col" className={cn('h-8 px-2 last:rounded-r-md', sticky && 'sticky top-0 z-10')} style={headerStyle}>
                    <span className="sr-only">{m.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const look = rowLook(row, i);
                return (
                  <tr
                    key={i}
                    className={cn(
                      'group/row [&:last-child>td]:border-b-0',
                      s.rowHover !== false && 'hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)]',
                      interactive && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus',
                    )}
                    style={look.style}
                    {...(interactive ? {
                      tabIndex: 0,
                      onClick: (e: React.MouseEvent) => { e.stopPropagation(); onRow?.(row); },
                      onDoubleClick: onDouble ? (e: React.MouseEvent) => { e.stopPropagation(); onDouble(row); } : undefined,
                      onKeyDown: (e: React.KeyboardEvent) => {
                        // Only the row's own Enter/Space: a key press on an inner button belongs to that button.
                        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault(); e.stopPropagation(); (onRow ?? onDouble)?.(row);
                        }
                      },
                    } : {})}
                  >
                    {s.showRowNumbers && (
                      <td className={cn(rowH, cellBorder, 'w-8 px-2 text-right text-xs tabular-nums text-text-secondary')} style={{ ...borderStyle, ...(look.accent ? { boxShadow: `inset 3px 0 0 ${look.accent}` } : {}) }}>
                        {offset + i + 1}
                      </td>
                    )}
                    {columns.map((c, ci) => {
                      const color = textColor(c, row);
                      const content = renderCell(c, row);
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            rowH, cellBorder, 'px-2 py-0.5',
                            ALIGN[c.align], WIDTH[c.width], VISIBLE[c.visible], WRAP[c.wrap],
                            (c.cell === 'number' || c.cell === 'bar' || c.cell === 'progress') && 'tabular-nums',
                            ci === 0 && c.cell === 'text' && 'font-medium',
                            s.historyLayout && ci === 0 && 'sticky left-0 z-[1]',
                          )}
                          style={{
                            ...(s.historyLayout && ci === 0 ? { backgroundColor: 'var(--surface-raised)' } : {}),
                            ...borderStyle,
                            ...fontStyle(c.font),
                            ...(color ? { color } : {}),
                            ...(c.width === 'px' && c.widthPx ? { width: c.widthPx, minWidth: c.widthPx, maxWidth: c.widthPx } : {}),
                            ...(look.accent && ci === 0 && !s.showRowNumbers ? { boxShadow: `inset 3px 0 0 ${look.accent}` } : {}),
                          }}
                        >
                          {rowActions && cellClickable(c.key) && c.cell !== 'link' ? (
                            <button
                              type="button"
                              className={cn('cursor-pointer rounded-sm text-left underline-offset-2 hover:underline', FOCUS)}
                              onClick={(e) => { e.stopPropagation(); rowActions.cellClick(c.key, row); }}
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              {content}
                            </button>
                          ) : content}
                        </td>
                      );
                    })}
                    {buttons.length > 0 && (
                      <td className={cn(rowH, cellBorder, 'whitespace-nowrap px-2 text-right')} style={borderStyle}>
                        {buttons.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className={cn(ROW_BUTTON, 'ml-1')}
                            onClick={(e) => { e.stopPropagation(); rowActions?.runButton(b.id, row); }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            {b.label}
                          </button>
                        ))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!paged && mode === 'none' && prepared.length > rows.length && (
        <div className="flex min-h-8 items-center px-2"><Meta>{m.rowsShown(rows.length, prepared.length)}</Meta></div>
      )}
      {!paged && mode === 'pages' && clientPages > 1 && (
        <Pager
          m={m}
          info={m.range(offset + 1, offset + rows.length, prepared.length)}
          page={current}
          pages={clientPages}
          onPage={setPage}
          canNext={current < clientPages}
        />
      )}
      {paged && (() => {
        const total = result?.total;
        const pages = total !== undefined ? Math.max(1, Math.ceil(total / echo!.pageSize)) : null;
        const from = (echo!.page - 1) * echo!.pageSize + 1;
        return (
          <Pager
            m={m}
            info={total !== undefined ? m.range(Math.min(from, total), Math.min(from + allRows.length - 1, total), total) : m.rowCount(allRows.length)}
            page={echo!.page}
            pages={pages}
            onPage={(p) => paging!.set({ page: p })}
            canNext={pages !== null ? echo!.page < pages : allRows.length >= echo!.pageSize}
          />
        );
      })()}
    </div>
  );
}

/** "Label (unit)" when the column has a unit. */
export function csvHeader(c: TableColumn): string {
  return c.override.unit ? `${c.label} (${c.override.unit})` : c.label;
}

/** The export's cell: the mapped word instead of a raw code, a number at the column's decimals, else the raw text. */
export function csvCell(c: TableColumn, raw: unknown): string {
  const mapped = matchValue(raw, c.valueMap)?.label;
  if (mapped) return mapped;
  const n = num(raw);
  if (n !== null && typeof c.override.decimals === 'number' && c.type === 'number') return n.toFixed(c.override.decimals);
  return rawText(raw);
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
