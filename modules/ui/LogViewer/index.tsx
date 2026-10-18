'use client';
// modules/ui/LogViewer/index.tsx
//
// LogViewer — a virtualised log list built for 10k+ lines: severity (text label + colour), search with highlight,
// severity and field facet chips, a wrap toggle, copy line, context lines pulled in around a selected line when
// the list is filtered, and a `follow` mode for a live tail (pause when the user scrolls up, a "new lines"
// counter while paused, a drop counter). The producer side is `useLogStream`. Pure model in ./model.ts.
// Listbox semantics (role="listbox" / "option", aria-activedescendant) keep the keyboard working when rows are windowed.

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faMagnifyingGlass, faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { useVirtualList } from '../Virtual/useVirtualList';
import { copyText } from '../_shared/dom';
import { fillMessage, formatClock, splitMatches, toEpochMs } from '../_shared/format';
import {
  buildDisplay, detectFacetFields, facetCounts, facetValue, formatLineText, hasActiveFilters, matchingIndices, wrappedLineCount,
  type ContextExpansion, type LogLine, type LogSeverity,
} from './model';

export type { LogLine, LogSeverity, LogFieldValue, LogFilters } from './model';
export { LOG_SEVERITIES, matchingIndices, buildDisplay, facetCounts, detectFacetFields, wrappedLineCount, appendWindow } from './model';
export { useLogStream } from './useLogStream';
export type { LogStream, UseLogStreamOptions } from './useLogStream';

export type LogViewerMessages = {
  label: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  wrap: string;
  follow: string;
  paused: string;
  resume: string;
  /** `{count}` */
  newLines: string;
  jumpToLatest: string;
  /** `{count}` */
  dropped: string;
  copy: string;
  copied: string;
  copyFailed: string;
  /** `{count}` */
  showBefore: string;
  /** `{count}` */
  showAfter: string;
  hideContext: string;
  noLines: string;
  noMatches: string;
  /** `{shown}`, `{total}` */
  lineCount: string;
  clearFilters: string;
  previousMatch: string;
  nextMatch: string;
  /** `{current}`, `{total}` */
  matchPosition: string;
  /** `{field}` */
  facetGroup: string;
  selectedLine: string;
  fields: string;
  context: string;
  severity: Record<LogSeverity, string>;
};

export const DEFAULT_LOG_VIEWER_MESSAGES: LogViewerMessages = {
  label: 'Log lines',
  searchLabel: 'Search logs',
  searchPlaceholder: 'Search logs',
  clearSearch: 'Clear search',
  wrap: 'Wrap lines',
  follow: 'Follow',
  paused: 'Paused',
  resume: 'Resume',
  newLines: '{count} new lines',
  jumpToLatest: 'Jump to latest',
  dropped: '{count} lines dropped',
  copy: 'Copy line',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  showBefore: 'Show {count} lines before',
  showAfter: 'Show {count} lines after',
  hideContext: 'Hide context',
  noLines: 'No log lines yet.',
  noMatches: 'No lines match the current filters.',
  lineCount: '{shown} of {total} lines',
  clearFilters: 'Clear filters',
  previousMatch: 'Previous match',
  nextMatch: 'Next match',
  matchPosition: '{current} of {total}',
  facetGroup: 'Filter by {field}',
  selectedLine: 'Selected line',
  fields: 'Fields',
  context: 'context',
  severity: { trace: 'TRACE', debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR', fatal: 'FATAL' },
};

export type LogViewerProps = {
  lines: readonly LogLine[];
  /** Height of the list in px. Default = 420. */
  height?: number;
  /** Search text (controlled) and its change handler. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /** 'filter' lists only matching lines; 'highlight' keeps all lines and steps through matches. Default = 'filter'. */
  searchMode?: 'filter' | 'highlight';
  /** Hide the search box (the `query` prop still applies). */
  hideSearch?: boolean;
  /** Field keys to offer as facet chips. Default = detected from the lines. `severity` chips are always offered. */
  facetFields?: string[];
  /** Wrap long lines (controlled). Default off: lines are truncated and the detail panel shows the full text. */
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  /** Live tail: keep the newest line in view. Pauses when the user scrolls up. Controlled. */
  follow?: boolean;
  defaultFollow?: boolean;
  onFollowChange?: (follow: boolean) => void;
  /** Lines the producer dropped (from `useLogStream().dropped`); shown as a counter. */
  dropped?: number;
  /** Selection (controlled) by line id. */
  selectedId?: string | null;
  onSelect?: (line: LogLine | null) => void;
  /** Lines added per click of the context buttons. Default = 5. */
  contextStep?: number;
  /** Time zone of the timestamps (IANA). Default = the browser's. */
  timeZone?: string;
  /** Called after a line is copied. */
  onCopy?: (line: LogLine) => void;
  messages?: Partial<LogViewerMessages>;
  className?: string;
};

const SEVERITY_STYLE: Record<LogSeverity, { badge: string; bar: string; row: string }> = {
  trace: { badge: 'text-text-disabled', bar: 'border-border', row: '' },
  debug: { badge: 'text-text-secondary', bar: 'border-border-strong', row: '' },
  info: { badge: 'text-info', bar: 'border-info', row: '' },
  warn: { badge: 'text-warning-fg bg-warning-subtle', bar: 'border-warning', row: '' },
  error: { badge: 'text-error-fg bg-error-subtle', bar: 'border-error', row: '' },
  fatal: { badge: 'text-error-fg bg-error-subtle font-bold', bar: 'border-error border-s-4', row: 'bg-error-subtle/40' },
};

const ROW_PAD = 4;
const LINE_H = 20;
// Row chrome in px: padding, border, line number, time, severity badge, copy button and the gaps between them.
const GUTTER_PX = 270;

export function LogViewer({
  lines,
  height = 420,
  query,
  defaultQuery = '',
  onQueryChange,
  searchMode = 'filter',
  hideSearch = false,
  facetFields,
  wrap,
  defaultWrap = false,
  onWrapChange,
  follow,
  defaultFollow = false,
  onFollowChange,
  dropped = 0,
  selectedId,
  onSelect,
  contextStep = 5,
  timeZone,
  onCopy,
  messages,
  className,
}: LogViewerProps) {
  const msg = useMemo(() => ({ ...DEFAULT_LOG_VIEWER_MESSAGES, ...messages, severity: { ...DEFAULT_LOG_VIEWER_MESSAGES.severity, ...messages?.severity } }), [messages]);
  const uid = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  // ── Controlled-or-local state ────────────────────────────────────────────────────────────────
  const [localQuery, setLocalQuery] = useState(defaultQuery);
  const q = query ?? localQuery;
  const setQ = (v: string) => { if (query === undefined) setLocalQuery(v); onQueryChange?.(v); };
  const [localWrap, setLocalWrap] = useState(defaultWrap);
  const wrapOn = wrap ?? localWrap;
  const setWrap = (v: boolean) => { if (wrap === undefined) setLocalWrap(v); onWrapChange?.(v); };
  const [localFollow, setLocalFollow] = useState(defaultFollow);
  const following = follow ?? localFollow;
  const setFollowing = useCallback((v: boolean) => { if (follow === undefined) setLocalFollow(v); onFollowChange?.(v); }, [follow, onFollowChange]);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selectedRaw = selectedId !== undefined ? selectedId : localSelected;
  // A selection that points at a line the stream has already dropped is no selection.
  const selectedIndex = useMemo(() => (selectedRaw ? lines.findIndex((l) => l.id === selectedRaw) : -1), [selectedRaw, lines]);
  const selected = selectedIndex >= 0 ? selectedRaw : null;

  const [severities, setSeverities] = useState<ReadonlySet<LogSeverity>>(new Set());
  const [facetSel, setFacetSel] = useState<Record<string, ReadonlySet<string>>>({});
  const [expansions, setExpansions] = useState<Record<string, ContextExpansion>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [matchPos, setMatchPos] = useState(0);
  const [status, setStatus] = useState('');

  // ── Model ─────────────────────────────────────────────────────────────────────────────────────
  const fields = useMemo(() => facetFields ?? detectFacetFields(lines), [facetFields, lines]);
  const facets = useMemo(() => facetCounts(lines, ['severity', ...fields]), [lines, fields]);
  const filters = useMemo(() => ({
    query: searchMode === 'filter' ? q : '',
    severities,
    facets: facetSel,
  }), [q, searchMode, severities, facetSel]);
  const matches = useMemo(() => matchingIndices(lines, filters), [lines, filters]);
  const display = useMemo(() => buildDisplay(lines, matches, expansions), [lines, matches, expansions]);
  const rows = display.indices;
  const shownSet = useMemo(() => new Set(rows), [rows]);
  const highlightMatches = useMemo(
    () => (searchMode === 'highlight' && q.trim() ? matchingIndices(lines, { query: q }).filter((i) => shownSet.has(i)) : []),
    [lines, q, searchMode, shownSet],
  );

  // ── Row heights (wrap estimates with a monospace probe) ──────────────────────────────────────
  const [charW, setCharW] = useState(7.2);
  const [listW, setListW] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      setListW(el.clientWidth);
      const w = probeRef.current?.getBoundingClientRect().width ?? 0;
      if (w > 0) setCharW(w / 20);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const charsPerRow = Math.max(12, Math.floor(((listW || 800) - GUTTER_PX) / charW));
  const heightOf = useMemo(() => {
    if (!wrapOn) return LINE_H + ROW_PAD * 2;
    return (i: number) => wrappedLineCount(lines[rows[i]]?.message ?? '', charsPerRow) * LINE_H + ROW_PAD * 2;
  }, [wrapOn, lines, rows, charsPerRow]);
  const vl = useVirtualList({ count: rows.length, rowHeight: heightOf, scrollRef: listRef, overscan: 10 });

  // ── Follow: stay at the bottom, pause when the user scrolls up ──────────────────────────────
  const total = lines.length;
  const [seenAtPause, setSeenAtPause] = useState(total);
  const pausedByScroll = useRef(false);
  const newWhilePaused = following ? 0 : Math.max(0, total - seenAtPause);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (following && el) el.scrollTop = el.scrollHeight;
  }, [following, vl.total, rows.length]);
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (following && !atBottom) {
      pausedByScroll.current = true;
      setSeenAtPause(total);
      setFollowing(false);
      setStatus(msg.paused);
    } else if (!following && atBottom && pausedByScroll.current) {
      // Back at the newest line after a scroll-pause: resume. A pause chosen with the button stays until the button.
      pausedByScroll.current = false;
      setFollowing(true);
      setStatus(msg.resume);
    }
  };
  const jumpToLatest = () => {
    pausedByScroll.current = false;
    setFollowing(true);
    setStatus(msg.resume);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  const toggleFollow = () => {
    if (following) { pausedByScroll.current = false; setSeenAtPause(total); setFollowing(false); setStatus(msg.paused); }
    else jumpToLatest();
  };

  // ── Selection and keyboard ──────────────────────────────────────────────────────────────────
  const select = useCallback((id: string | null) => {
    if (selectedId === undefined) setLocalSelected(id);
    onSelect?.(id ? lines.find((l) => l.id === id) ?? null : null);
  }, [selectedId, onSelect, lines]);
  const activeIndex = useMemo(() => {
    const want = activeId ?? selected;
    const i = want ? rows.findIndex((r) => lines[r].id === want) : -1;
    return i >= 0 ? i : rows.length ? 0 : -1;
  }, [rows, lines, activeId, selected]);
  const move = (index: number) => {
    const i = Math.min(Math.max(index, 0), rows.length - 1);
    if (i < 0) return;
    const id = lines[rows[i]].id;
    setActiveId(id);
    select(id);
    vl.scrollToIndex(i);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length || e.altKey || e.ctrlKey || e.metaKey) return;
    const page = Math.max(1, Math.floor(vl.viewportHeight / (LINE_H + ROW_PAD * 2)) - 1);
    switch (e.key) {
      case 'ArrowDown': move(activeIndex + 1); break;
      case 'ArrowUp': move(activeIndex - 1); break;
      case 'PageDown': move(activeIndex + page); break;
      case 'PageUp': move(activeIndex - page); break;
      case 'Home': move(0); break;
      case 'End': move(rows.length - 1); if (!following) jumpToLatest(); break;
      case 'Escape': if (selected) select(null); else return; break;
      default: return;
    }
    e.preventDefault();
  };

  // ── Copy ─────────────────────────────────────────────────────────────────────────────────────
  const copy = async (line: LogLine) => {
    const ok = await copyText(formatLineText(line, formatClock(toEpochMs(line.ts), timeZone)));
    setStatus(ok ? msg.copied : msg.copyFailed);
    if (ok) onCopy?.(line);
    setTimeout(() => setStatus(''), 1800);
  };

  // ── Filters ──────────────────────────────────────────────────────────────────────────────────
  const toggleFacet = (key: string, value: string) => {
    if (key === 'severity') {
      const next = new Set(severities);
      if (next.has(value as LogSeverity)) next.delete(value as LogSeverity); else next.add(value as LogSeverity);
      setSeverities(next);
      return;
    }
    const cur = new Set(facetSel[key] ?? []);
    if (cur.has(value)) cur.delete(value); else cur.add(value);
    setFacetSel({ ...facetSel, [key]: cur });
  };
  const isFacetOn = (key: string, value: string) => (key === 'severity' ? severities.has(value as LogSeverity) : Boolean(facetSel[key]?.has(value)));
  const filtered = hasActiveFilters(filters);
  const clearFilters = () => { setSeverities(new Set()); setFacetSel({}); if (searchMode === 'filter') setQ(''); setExpansions({}); };

  // ── Context expansion of the selected line ──────────────────────────────────────────────────
  const selectedLine = selectedIndex >= 0 ? lines[selectedIndex] : null;
  const hiddenBefore = selectedIndex > 0 && !shownSet.has(selectedIndex - 1);
  const hiddenAfter = selectedIndex >= 0 && selectedIndex < lines.length - 1 && !shownSet.has(selectedIndex + 1);
  const expandContext = (side: 'before' | 'after') => {
    if (!selectedLine) return;
    const cur = expansions[selectedLine.id] ?? { before: 0, after: 0 };
    setExpansions({ ...expansions, [selectedLine.id]: { ...cur, [side]: cur[side] + contextStep } });
  };
  const hideContext = () => {
    if (!selectedLine) return;
    const rest = { ...expansions };
    delete rest[selectedLine.id];
    setExpansions(rest);
  };

  // ── Match stepping (highlight mode) ─────────────────────────────────────────────────────────
  const stepMatch = (dir: 1 | -1) => {
    if (!highlightMatches.length) return;
    const next = (matchPos + dir + highlightMatches.length) % highlightMatches.length;
    setMatchPos(next);
    const idx = rows.indexOf(highlightMatches[next]);
    if (idx >= 0) move(idx);
  };
  const matchSet = useMemo(() => new Set(highlightMatches), [highlightMatches]);

  const rowId = (id: string) => `${uid}-line-${id}`;
  const slice = rows.slice(vl.start, vl.end);
  const facetKeys = ['severity', ...fields];
  const showToolbarCount = filtered || searchMode === 'highlight';

  return (
    <div className={cn('flex flex-col gap-2 text-sm', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {!hideSearch && (
          <div className="relative min-w-48 flex-1">
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-disabled" />
            <input
              type="search"
              value={q}
              aria-label={msg.searchLabel}
              placeholder={msg.searchPlaceholder}
              onChange={(e) => { setQ(e.target.value); setMatchPos(0); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchMode === 'highlight') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); } }}
              className={cn(
                'w-full rounded-md border border-border bg-surface-base py-1.5 ps-8 pe-8 text-text-primary placeholder:text-text-disabled',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              )}
            />
            {q && (
              <button type="button" aria-label={msg.clearSearch} onClick={() => setQ('')} className="absolute end-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-secondary hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
        {searchMode === 'highlight' && q.trim() !== '' && (
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <button type="button" className={ghostBtn} onClick={() => stepMatch(-1)} disabled={!highlightMatches.length}>{msg.previousMatch}</button>
            <button type="button" className={ghostBtn} onClick={() => stepMatch(1)} disabled={!highlightMatches.length}>{msg.nextMatch}</button>
            <span aria-live="polite">{highlightMatches.length ? fillMessage(msg.matchPosition, { current: Math.min(matchPos + 1, highlightMatches.length), total: highlightMatches.length }) : fillMessage(msg.matchPosition, { current: 0, total: 0 })}</span>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={wrapOn} onChange={(e) => setWrap(e.target.checked)} className="h-3.5 w-3.5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus" />
          {msg.wrap}
        </label>
        <button
          type="button"
          aria-pressed={following}
          onClick={toggleFollow}
          className={cn(ghostBtn, 'gap-1.5', following && 'border-success bg-success-subtle text-success-fg')}
        >
          <FontAwesomeIcon icon={following ? faPlay : faPause} aria-hidden="true" className="h-3 w-3" />
          {msg.follow}
          {!following && <span className="text-text-secondary">({msg.paused})</span>}
        </button>
        {dropped > 0 && (
          <span role="status" className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
            {fillMessage(msg.dropped, { count: dropped.toLocaleString() })}
          </span>
        )}
        {showToolbarCount && (
          <span className="ms-auto text-xs text-text-secondary">{fillMessage(msg.lineCount, { shown: rows.length.toLocaleString(), total: total.toLocaleString() })}</span>
        )}
      </div>

      {/* Facet chips */}
      {facetKeys.some((k) => facets[k]?.length) && (
        <div className="flex flex-col gap-1.5">
          {facetKeys.map((key) => facets[key]?.length ? (
            <div key={key} role="group" aria-label={fillMessage(msg.facetGroup, { field: key })} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{key}</span>
              {facets[key].map((f) => {
                const on = isFacetOn(key, f.value);
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleFacet(key, f.value)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      on ? 'border-primary bg-primary-subtle text-primary' : 'border-border bg-surface-base text-text-secondary hover:bg-surface-overlay',
                    )}
                  >
                    {on && <FontAwesomeIcon icon={faCheck} aria-hidden="true" className="h-2.5 w-2.5" />}
                    {key === 'severity' ? msg.severity[f.value as LogSeverity] ?? f.value : f.value}
                    <span className="text-text-disabled">{f.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          ) : null)}
          {filtered && <button type="button" className={cn(ghostBtn, 'self-start')} onClick={clearFilters}>{msg.clearFilters}</button>}
        </div>
      )}

      {/* The list */}
      <div className="relative">
        {/* Hidden monospace probe: 20 characters wide, to turn the container width into characters per row. */}
        <span ref={probeRef} aria-hidden="true" className="invisible absolute -z-10 whitespace-pre font-mono text-xs">{'0'.repeat(20)}</span>
        <div
          ref={listRef}
          role="listbox"
          tabIndex={0}
          aria-label={msg.label}
          aria-activedescendant={activeIndex >= 0 ? rowId(lines[rows[activeIndex]].id) : undefined}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          className={cn(
            'overflow-auto rounded-md border border-border bg-surface-base font-mono text-xs',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          )}
          style={{ height }}
        >
          {rows.length === 0 ? (
            <div className="p-4 font-sans text-sm text-text-secondary">{total === 0 ? msg.noLines : msg.noMatches}</div>
          ) : (
            <>
              {vl.offsetTop > 0 && <div aria-hidden="true" style={{ height: vl.offsetTop }} />}
              {slice.map((lineIndex, i) => {
                const line = lines[lineIndex];
                const position = vl.start + i;
                const sev = SEVERITY_STYLE[line.severity];
                const isSelected = selected === line.id;
                const isContext = display.context.has(lineIndex);
                const isMatch = matchSet.has(lineIndex);
                return (
                  <div
                    key={line.id}
                    id={rowId(line.id)}
                    role="option"
                    aria-selected={isSelected}
                    aria-posinset={position + 1}
                    aria-setsize={rows.length}
                    data-severity={line.severity}
                    data-context={isContext || undefined}
                    data-match={isMatch || undefined}
                    onClick={() => { setActiveId(line.id); select(isSelected ? null : line.id); }}
                    className={cn(
                      'group flex cursor-pointer items-start gap-2 border-s-2 px-2 hover:bg-surface-overlay',
                      sev.bar, sev.row,
                      isSelected && 'bg-primary-subtle',
                      isContext && 'opacity-70',
                      activeIndex === position && 'outline outline-2 -outline-offset-2 outline-border-focus',
                    )}
                    style={{ minHeight: wrapOn ? undefined : LINE_H + ROW_PAD * 2, height: wrapOn ? undefined : LINE_H + ROW_PAD * 2, paddingBlock: ROW_PAD }}
                  >
                    <span aria-hidden="true" className="w-12 shrink-0 select-none text-end text-text-disabled" style={{ lineHeight: `${LINE_H}px` }}>{lineIndex + 1}</span>
                    <time className="w-24 shrink-0 text-text-secondary" style={{ lineHeight: `${LINE_H}px` }} dateTime={new Date(toEpochMs(line.ts)).toISOString()}>{formatClock(toEpochMs(line.ts), timeZone)}</time>
                    <span className={cn('w-12 shrink-0 rounded px-1 text-center text-[10px] font-semibold', sev.badge)} style={{ lineHeight: `${LINE_H}px` }}>
                      {msg.severity[line.severity]}
                    </span>
                    <span
                      className={cn('min-w-0 flex-1 text-text-primary', wrapOn ? 'whitespace-pre-wrap break-all' : 'truncate whitespace-pre')}
                      style={{ lineHeight: `${LINE_H}px` }}
                    >
                      {isContext && <span className="sr-only">{msg.context}: </span>}
                      {line.source && <span className="me-2 text-text-secondary">{line.source}</span>}
                      <Highlighted text={line.message} query={searchMode === 'highlight' || filters.query ? q : ''} />
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={msg.copy}
                      title={msg.copy}
                      onClick={(e) => { e.stopPropagation(); void copy(line); }}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-secondary opacity-0 hover:bg-surface-sunken',
                        'group-hover:opacity-100 focus-visible:opacity-100', isSelected && 'opacity-100',
                      )}
                    >
                      <FontAwesomeIcon icon={faCopy} aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
              {vl.offsetBottom > 0 && <div aria-hidden="true" style={{ height: vl.offsetBottom }} />}
            </>
          )}
        </div>
        {!following && newWhilePaused > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-fg shadow-md hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {fillMessage(msg.newLines, { count: newWhilePaused.toLocaleString() })} · {msg.jumpToLatest}
          </button>
        )}
      </div>

      <div className="sr-only" role="status" aria-live="polite">{status}</div>

      {/* Selected line */}
      {selectedLine && (
        <section role="region" aria-label={msg.selectedLine} className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-text-primary">{selectedLine.message}</pre>
          {selectedLine.fields && Object.keys(selectedLine.fields).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{msg.fields}</span>
              {Object.entries(selectedLine.fields).map(([k, v]) => {
                const on = isFacetOn(k, String(v));
                const filterable = k !== 'severity' && facetValue(selectedLine, k) !== undefined;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    disabled={!filterable}
                    onClick={() => toggleFacet(k, String(v))}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
                      on ? 'border-primary bg-primary-subtle text-primary' : 'border-border bg-surface-base text-text-secondary hover:bg-surface-overlay',
                    )}
                  >
                    {k}={String(v)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => void copy(selectedLine)}>
              <FontAwesomeIcon icon={faCopy} aria-hidden="true" className="me-1.5 h-3 w-3" />{msg.copy}
            </button>
            {hiddenBefore && <button type="button" className={ghostBtn} onClick={() => expandContext('before')}>{fillMessage(msg.showBefore, { count: contextStep })}</button>}
            {hiddenAfter && <button type="button" className={ghostBtn} onClick={() => expandContext('after')}>{fillMessage(msg.showAfter, { count: contextStep })}</button>}
            {expansions[selectedLine.id] && <button type="button" className={ghostBtn} onClick={hideContext}>{msg.hideContext}</button>}
          </div>
        </section>
      )}
    </div>
  );
}

const ghostBtn = cn(
  'inline-flex items-center rounded border border-border bg-surface-base px-2 py-1 text-xs text-text-primary transition-colors',
  'hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {splitMatches(text, query).map((part, i) => part.match
        ? <mark key={i} className="rounded-sm bg-warning-subtle px-0.5 text-text-primary">{part.text}</mark>
        : <span key={i}>{part.text}</span>)}
    </>
  );
}
