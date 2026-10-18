// modules/ui/LogViewer/model.ts
//
// Pure log model: severities, filtering (search, severity and field facets), the display list with context lines
// pulled in around a selected line, facet counts, wrapped-height estimation, and the stream buffer rules.
// No React. Unit-tested without a DOM.

export type LogSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_SEVERITIES: readonly LogSeverity[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

export type LogFieldValue = string | number | boolean;

export type LogLine = {
  id: string;
  /** Epoch ms, or an ISO string. */
  ts: number | string;
  severity: LogSeverity;
  message: string;
  /** Structured fields (`service`, `trace_id`, `http.status`...); facets and the detail panel read them. */
  fields?: Record<string, LogFieldValue>;
  /** Emitter shown next to the message (a service or logger name). */
  source?: string;
};

export type LogFilters = {
  /** Case-insensitive literal text, matched in the message, source and field values. */
  query?: string;
  /** Severities to keep; empty or absent keeps all. */
  severities?: ReadonlySet<LogSeverity>;
  /** Per field: the values to keep (OR within a field, AND between fields). */
  facets?: Readonly<Record<string, ReadonlySet<string>>>;
};

export const severityRank = (s: LogSeverity) => LOG_SEVERITIES.indexOf(s);

export function hasActiveFilters(f: LogFilters): boolean {
  return Boolean(f.query?.trim()) || Boolean(f.severities?.size) || Object.values(f.facets ?? {}).some((s) => s.size > 0);
}

/** The value of a facet key on a line (`severity` and `source` are built in; other keys read `fields`). */
export function facetValue(line: LogLine, key: string): string | undefined {
  if (key === 'severity') return line.severity;
  if (key === 'source') return line.source;
  const v = line.fields?.[key];
  return v === undefined ? undefined : String(v);
}

function matchesQuery(line: LogLine, q: string): boolean {
  if (line.message.toLowerCase().includes(q)) return true;
  if (line.source?.toLowerCase().includes(q)) return true;
  if (line.fields) for (const [k, v] of Object.entries(line.fields)) if (`${k}=${v}`.toLowerCase().includes(q)) return true;
  return false;
}

/** Indices (into `lines`) of the lines that satisfy every filter. */
export function matchingIndices(lines: readonly LogLine[], f: LogFilters): number[] {
  const q = f.query?.trim().toLowerCase() ?? '';
  const sev = f.severities && f.severities.size > 0 ? f.severities : null;
  const facetEntries = Object.entries(f.facets ?? {}).filter(([, set]) => set.size > 0);
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (sev && !sev.has(line.severity)) continue;
    if (facetEntries.length && !facetEntries.every(([key, set]) => { const v = facetValue(line, key); return v !== undefined && set.has(v); })) continue;
    if (q && !matchesQuery(line, q)) continue;
    out.push(i);
  }
  return out;
}

export type ContextExpansion = { before: number; after: number };

export type DisplayList = {
  /** Indices into `lines`, ascending. */
  indices: number[];
  /** Indices shown only as context around a selected line (not matches). */
  context: Set<number>;
};

/**
 * What the viewer lists: the matches plus, for each expanded line, the lines around it from the unfiltered stream.
 * `expansions` is keyed by line id. With no filter every line is a match and expansions change nothing.
 */
export function buildDisplay(lines: readonly LogLine[], matches: number[], expansions: Readonly<Record<string, ContextExpansion>>): DisplayList {
  const ids = Object.keys(expansions);
  if (ids.length === 0) return { indices: matches, context: new Set() };
  const matchSet = new Set(matches);
  const keep = new Set(matches);
  if (matchSet.size < lines.length) {
    const byId = new Map<string, number>();
    for (let i = 0; i < lines.length; i++) if (expansions[lines[i].id]) byId.set(lines[i].id, i);
    for (const [id, i] of byId) {
      const { before, after } = expansions[id];
      for (let k = Math.max(0, i - before); k <= Math.min(lines.length - 1, i + after); k++) keep.add(k);
    }
  }
  const indices = [...keep].sort((a, b) => a - b);
  const context = new Set<number>();
  for (const i of indices) if (!matchSet.has(i)) context.add(i);
  return { indices, context };
}

export type FacetCount = { value: string; count: number };

/** Top values per facet key (by count, then name), at most `limit` each. Counted over all `lines`. */
export function facetCounts(lines: readonly LogLine[], keys: readonly string[], limit = 8): Record<string, FacetCount[]> {
  const maps: Record<string, Map<string, number>> = {};
  for (const k of keys) maps[k] = new Map();
  for (const line of lines) {
    for (const k of keys) {
      const v = facetValue(line, k);
      if (v === undefined) continue;
      maps[k].set(v, (maps[k].get(v) ?? 0) + 1);
    }
  }
  const out: Record<string, FacetCount[]> = {};
  for (const k of keys) {
    const rows = [...maps[k]].map(([value, count]) => ({ value, count }));
    if (k === 'severity') rows.sort((a, b) => severityRank(a.value as LogSeverity) - severityRank(b.value as LogSeverity));
    else rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    out[k] = rows.slice(0, limit);
  }
  return out;
}

/** Field keys worth a facet: present on at least a fifth of a sample of lines, with at most `maxValues` distinct values. */
export function detectFacetFields(lines: readonly LogLine[], max = 3, maxValues = 8, sample = 500): string[] {
  const n = Math.min(lines.length, sample);
  if (n === 0) return [];
  const seen = new Map<string, Set<string>>();
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const fields = lines[i].fields;
    if (!fields) continue;
    for (const [k, v] of Object.entries(fields)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      let set = seen.get(k);
      if (!set) { set = new Set(); seen.set(k, set); }
      if (set.size <= maxValues) set.add(String(v));
    }
  }
  return [...seen.entries()]
    .filter(([k, vals]) => vals.size >= 2 && vals.size <= maxValues && (counts.get(k) ?? 0) >= n / 5)
    .sort((a, b) => (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0) || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([k]) => k);
}

/** Visual lines a message takes when it wraps at `charsPerRow` (monospace, break-anywhere). Never less than 1. */
export function wrappedLineCount(message: string, charsPerRow: number): number {
  const width = Math.max(1, Math.floor(charsPerRow));
  let total = 0;
  let from = 0;
  for (;;) {
    const nl = message.indexOf('\n', from);
    const len = (nl === -1 ? message.length : nl) - from;
    total += Math.max(1, Math.ceil(len / width));
    if (nl === -1) break;
    from = nl + 1;
  }
  return total;
}

/** One log line as plain text, for copying. */
export function formatLineText(line: LogLine, timeText: string): string {
  const fields = line.fields ? Object.entries(line.fields).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  return [timeText, line.severity.toUpperCase(), line.source, line.message, fields].filter(Boolean).join(' ');
}

/**
 * The retained window of a stream: appends `incoming` to `current`, keeps the newest `maxLines`, and reports how many
 * of the oldest were dropped. Pure, so the hook's behaviour is testable.
 */
export function appendWindow<T>(current: readonly T[], incoming: readonly T[], maxLines: number): { lines: T[]; dropped: number } {
  const max = Math.max(1, Math.floor(maxLines));
  if (incoming.length === 0) return { lines: current as T[], dropped: 0 };
  const merged = current.concat(incoming);
  const dropped = Math.max(0, merged.length - max);
  return { lines: dropped ? merged.slice(dropped) : merged, dropped };
}
