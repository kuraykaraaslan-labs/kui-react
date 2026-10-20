// The pure logic of the data table (no React, no DOM): column resolution from the source's meta and the
// placement's settings, cell text, value maps, sorting, row colour rules, history filtering and CSV cells.
// `DataTableView.tsx` draws it; kui-ejs and KUInative vendor this file so all three share one implementation.

import type { FontValue } from '../../SchemaForm/types';
import { metaFormat, valueMapList } from '../settings/source-meta';
import { cssColor, formatValue, type RangeEdges, type ValueFormat } from '../settings/style';
import type { Sparse } from '../settings/types';
import type { SlotData } from '../kind';
import type { CommonMessages } from '../messages';
import { isInternalPath } from '../templates/map';

// ── Shared data helpers (also used by the feed and map views) ───────────────────

export type Row = Record<string, unknown>;
export type DeclaredColumn = NonNullable<SlotData['columns']>[number];

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

// ── Table settings and columns ────────────────────────────────────────────────

export type Visible = 'always' | 'desktop' | 'mobile' | 'hidden';
export type Cell = 'auto' | 'text' | 'number' | 'date' | 'badge' | 'bar' | 'progress' | 'link' | 'icon';
export type Wrap = 'nowrap' | 'truncate' | 'wrap';

export interface ColumnSetting {
  key?: string; label?: string; visible?: Visible; cell?: Cell; linkTemplate?: string; sortable?: boolean;
  align?: 'auto' | 'start' | 'center' | 'end'; width?: 'auto' | 'narrow' | 'wide' | 'px'; widthPx?: number;
  unit?: string; decimals?: number; color?: string; headerColor?: string; barMax?: number; ranges?: unknown[];
  dateFormat?: 'inherit' | DateDisplay; datePattern?: string; valueMap?: ValueColor[]; badgeStyle?: 'soft' | 'dot' | 'solid';
  icon?: string; font?: FontValue; wrap?: Wrap;
}

/** A row colour rule: the first matching rule colours the row. */
export interface RowRule {
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

export type TableSettings = {
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
  const s = settings as TableSettings;
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

