'use client';
// modules/ui/TraceWaterfall/index.tsx
//
// TraceWaterfall — a distributed trace as nested rows with offset/duration bars on a shared time ruler.
// Tree semantics (role="tree" / "treeitem", aria-level/-setsize/-posinset, aria-expanded, aria-selected) with
// aria-activedescendant on the tree, so the keyboard works the same when the list is windowed (> 500 rows).
// Critical path highlight, error spans (icon + text, not only colour), a detail slot for the selected span.
// Pure model in ./model.ts. No chart library.

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { useVirtualList } from '../Virtual/useVirtualList';
import { formatDurationMs, fillMessage } from '../_shared/format';
import { hashIndex, isRtlElement } from '../_shared/dom';
import {
  buildTraceTree, criticalPathIds, expandableIds, rulerTicks, selfTime, barBox, visibleRows,
  type TraceNode, type TraceRow, type TraceSpan,
} from './model';

export type { TraceSpan, SpanStatus } from './model';
export { buildTraceTree, criticalPathIds, rulerTicks, visibleRows, selfTime, barBox } from './model';

export type TraceWaterfallMessages = {
  label: string;
  spanColumn: string;
  expandAll: string;
  collapseAll: string;
  criticalPath: string;
  noSpans: string;
  /** `{count}` */
  spanCount: string;
  error: string;
  onCriticalPath: string;
  details: string;
  clearSelection: string;
  service: string;
  status: string;
  kind: string;
  start: string;
  duration: string;
  selfTime: string;
  attributes: string;
  /** `{name}` */
  expand: string;
  /** `{name}` */
  collapse: string;
};

export const DEFAULT_TRACE_WATERFALL_MESSAGES: TraceWaterfallMessages = {
  label: 'Trace waterfall',
  spanColumn: 'Span',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  criticalPath: 'Critical path',
  noSpans: 'No spans in this trace.',
  spanCount: '{count} spans',
  error: 'error',
  onCriticalPath: 'on the critical path',
  details: 'Span details',
  clearSelection: 'Clear selection',
  service: 'Service',
  status: 'Status',
  kind: 'Kind',
  start: 'Start',
  duration: 'Duration',
  selfTime: 'Self time',
  attributes: 'Attributes',
  expand: 'Expand {name}',
  collapse: 'Collapse {name}',
};

export type TraceSpanInfo = {
  depth: number;
  /** ms from the trace start. */
  offset: number;
  duration: number;
  selfTime: number;
  childCount: number;
  onCriticalPath: boolean;
};

export type TraceWaterfallProps = {
  spans: TraceSpan[];
  /** Controlled selection (a span id, or null for none). */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (span: TraceSpan | null) => void;
  /** Controlled set of collapsed span ids. */
  collapsedIds?: string[];
  defaultCollapsedIds?: string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** Highlight the critical path. Default = true (the toolbar switch changes it locally). */
  showCriticalPath?: boolean;
  /** Replaces the default detail panel for the selected span. `false` hides the panel. */
  renderDetail?: ((span: TraceSpan, info: TraceSpanInfo) => React.ReactNode) | false;
  /** Colour bars by service (stable palette slot per service) or all with the primary tone. Default = 'service'. */
  colorBy?: 'service' | 'none';
  /** CSS colour per service name, over the stable palette. */
  serviceColors?: Record<string, string>;
  /** Width of the span-name column in px. Default = 280. */
  labelWidth?: number;
  /** Row height in px. Default = 28. */
  rowHeight?: number;
  /** Rows above which the list is windowed. Default = 500. */
  virtualizeThreshold?: number;
  /** Max height of the scrolling tree in px. Default = 420. */
  maxHeight?: number;
  /** Hide the toolbar (expand/collapse all, critical path switch). */
  hideToolbar?: boolean;
  messages?: Partial<TraceWaterfallMessages>;
  /** Accessible name of the tree (else `messages.label`). */
  ariaLabel?: string;
  className?: string;
};

const PALETTE = ['var(--primary)', 'var(--secondary)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--primary-active)'];
const HEADER_H = 28;

export function TraceWaterfall({
  spans,
  selectedId,
  defaultSelectedId = null,
  onSelect,
  collapsedIds,
  defaultCollapsedIds,
  onCollapsedChange,
  showCriticalPath = true,
  renderDetail,
  colorBy = 'service',
  serviceColors,
  labelWidth = 280,
  rowHeight = 28,
  virtualizeThreshold = 500,
  maxHeight = 420,
  hideToolbar = false,
  messages,
  ariaLabel,
  className,
}: TraceWaterfallProps) {
  const msg = useMemo(() => ({ ...DEFAULT_TRACE_WATERFALL_MESSAGES, ...messages }), [messages]);
  const uid = useId();
  const treeRef = useRef<HTMLDivElement | null>(null);

  const tree = useMemo(() => buildTraceTree(spans), [spans]);
  const critical = useMemo(() => criticalPathIds(tree), [tree]);
  const [criticalOn, setCriticalOn] = useState(showCriticalPath);
  const [prevShow, setPrevShow] = useState(showCriticalPath);
  if (prevShow !== showCriticalPath) { setPrevShow(showCriticalPath); setCriticalOn(showCriticalPath); }

  // Collapse state: controlled or local.
  const [localCollapsed, setLocalCollapsed] = useState<string[]>(defaultCollapsedIds ?? []);
  const collapsedList = collapsedIds ?? localCollapsed;
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const setCollapsed = useCallback((next: string[]) => {
    if (collapsedIds === undefined) setLocalCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsedIds, onCollapsedChange]);

  // Selection: controlled or local.
  const [localSelected, setLocalSelected] = useState<string | null>(defaultSelectedId);
  const selected = selectedId !== undefined ? selectedId : localSelected;
  const select = useCallback((id: string | null) => {
    if (selectedId === undefined) setLocalSelected(id);
    onSelect?.(id ? tree.byId.get(id)?.span ?? null : null);
  }, [selectedId, onSelect, tree]);

  const rows = useMemo(() => visibleRows(tree, collapsed), [tree, collapsed]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = useMemo(() => {
    const i = rows.findIndex((r) => r.node.span.id === (activeId ?? selected));
    return i >= 0 ? i : rows.length ? 0 : -1;
  }, [rows, activeId, selected]);

  const virtualEnabled = rows.length > virtualizeThreshold;
  const vl = useVirtualList({ count: rows.length, rowHeight, scrollRef: treeRef, stickyTop: HEADER_H, enabled: virtualEnabled });
  const visible = rows.slice(vl.start, vl.end);

  const toggle = useCallback((node: TraceNode) => {
    if (!node.children.length) return;
    const id = node.span.id;
    setCollapsed(collapsed.has(id) ? collapsedList.filter((x) => x !== id) : [...collapsedList, id]);
  }, [collapsed, collapsedList, setCollapsed]);

  const move = useCallback((index: number) => {
    const clamped = Math.min(Math.max(index, 0), rows.length - 1);
    const row = rows[clamped];
    if (!row) return;
    setActiveId(row.node.span.id);
    vl.scrollToIndex(clamped);
  }, [rows, vl]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!rows.length || e.altKey || e.ctrlKey || e.metaKey) return;
    const row = rows[activeIndex];
    if (!row) return;
    const rtl = isRtlElement(treeRef.current);
    const open = rtl ? 'ArrowLeft' : 'ArrowRight';
    const close = rtl ? 'ArrowRight' : 'ArrowLeft';
    const page = Math.max(1, Math.floor((vl.viewportHeight - HEADER_H) / rowHeight) - 1);
    switch (e.key) {
      case 'ArrowDown': move(activeIndex + 1); break;
      case 'ArrowUp': move(activeIndex - 1); break;
      case 'PageDown': move(activeIndex + page); break;
      case 'PageUp': move(activeIndex - page); break;
      case 'Home': move(0); break;
      case 'End': move(rows.length - 1); break;
      case open:
        if (row.node.children.length && collapsed.has(row.node.span.id)) toggle(row.node);
        else if (row.node.children.length) move(activeIndex + 1);
        else return;
        break;
      case close:
        if (row.node.children.length && !collapsed.has(row.node.span.id)) toggle(row.node);
        else if (row.node.parent) {
          const pi = rows.findIndex((r) => r.node === row.node.parent);
          if (pi >= 0) move(pi);
        } else return;
        break;
      case 'Enter':
      case ' ':
        select(selected === row.node.span.id ? null : row.node.span.id);
        break;
      case 'Escape':
        if (selected) select(null); else return;
        break;
      case '*': {
        // Expand every sibling that has children (WAI-ARIA tree pattern).
        const sibs = (row.node.parent?.children ?? tree.roots).map((n) => n.span.id);
        setCollapsed(collapsedList.filter((x) => !sibs.includes(x)));
        break;
      }
      default: return;
    }
    e.preventDefault();
  };

  const ticks = useMemo(() => rulerTicks(tree.duration), [tree.duration]);
  const colorOf = (span: TraceSpan) => {
    if (span.status === 'error') return 'var(--error)';
    if (colorBy === 'none' || !span.service) return 'var(--primary)';
    return serviceColors?.[span.service] ?? PALETTE[hashIndex(span.service, PALETTE.length)];
  };
  const rowId = (id: string) => `${uid}-row-${id}`;

  const selectedNode = selected ? tree.byId.get(selected) ?? null : null;
  const infoOf = (node: TraceNode): TraceSpanInfo => ({
    depth: node.depth,
    offset: node.span.start - tree.start,
    duration: Math.max(0, node.span.duration),
    selfTime: selfTime(node),
    childCount: node.children.length,
    onCriticalPath: critical.has(node.span.id),
  });

  if (!tree.byId.size) {
    return <div className={cn('rounded-md border border-border bg-surface-raised p-4 text-sm text-text-secondary', className)}>{msg.noSpans}</div>;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {!hideToolbar && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span>{fillMessage(msg.spanCount, { count: tree.byId.size })}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDurationMs(tree.duration)}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <button type="button" className={toolBtn} onClick={() => setCollapsed([])}>{msg.expandAll}</button>
            <button type="button" className={toolBtn} onClick={() => setCollapsed(expandableIds(tree))}>{msg.collapseAll}</button>
            <button
              type="button"
              role="switch"
              aria-checked={criticalOn}
              className={cn(toolBtn, criticalOn && 'border-warning bg-warning-subtle text-warning-fg')}
              onClick={() => setCriticalOn((v) => !v)}
            >
              {msg.criticalPath}
            </button>
          </div>
        </div>
      )}

      <div
        ref={treeRef}
        role="tree"
        tabIndex={0}
        aria-label={ariaLabel ?? msg.label}
        aria-activedescendant={activeIndex >= 0 ? rowId(rows[activeIndex].node.span.id) : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'relative overflow-auto rounded-md border border-border bg-surface-base text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        )}
        style={{ maxHeight }}
      >
        {/* Ruler: sticky inside the scroller so its columns line up with the rows' scrollbar-aware width. */}
        <div
          aria-hidden="true"
          className="sticky top-0 z-10 flex border-b border-border bg-surface-raised text-xs text-text-secondary"
          style={{ height: HEADER_H }}
        >
          <div className="shrink-0 truncate px-3 leading-7" style={{ width: labelWidth }}>{msg.spanColumn}</div>
          <div className="relative min-w-0 flex-1">
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 whitespace-nowrap leading-7"
                style={{ insetInlineStart: `${tree.duration > 0 ? (t / tree.duration) * 100 : 0}%`, paddingInlineStart: 4 }}
              >
                {formatDurationMs(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* Vertical grid lines for the ticks, behind the rows. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-0" style={{ insetInlineStart: labelWidth }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute inset-y-0 border-s border-border"
                style={{ insetInlineStart: `${tree.duration > 0 ? (t / tree.duration) * 100 : 0}%` }}
              />
            ))}
          </div>
          {virtualEnabled && vl.offsetTop > 0 && <div aria-hidden="true" style={{ height: vl.offsetTop }} />}
          {visible.map((row, i) => (
            <WaterfallRow
              key={row.node.span.id}
              row={row}
              id={rowId(row.node.span.id)}
              tree={tree}
              selected={selected === row.node.span.id}
              active={activeIndex === vl.start + i}
              collapsed={collapsed.has(row.node.span.id)}
              critical={criticalOn && critical.has(row.node.span.id)}
              color={colorOf(row.node.span)}
              labelWidth={labelWidth}
              height={rowHeight}
              msg={msg}
              onSelect={() => { setActiveId(row.node.span.id); select(selected === row.node.span.id ? null : row.node.span.id); }}
              onToggle={() => toggle(row.node)}
            />
          ))}
          {virtualEnabled && vl.offsetBottom > 0 && <div aria-hidden="true" style={{ height: vl.offsetBottom }} />}
        </div>
      </div>

      {renderDetail !== false && selectedNode && (
        <section role="region" aria-label={msg.details} className="rounded-md border border-border bg-surface-raised p-3 text-sm">
          {renderDetail ? renderDetail(selectedNode.span, infoOf(selectedNode)) : <DefaultDetail node={selectedNode} info={infoOf(selectedNode)} msg={msg} onClose={() => select(null)} />}
        </section>
      )}
    </div>
  );
}

const toolBtn = cn(
  'rounded border border-border bg-surface-base px-2 py-1 text-xs text-text-primary transition-colors',
  'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
);

type RowProps = {
  row: TraceRow;
  id: string;
  tree: ReturnType<typeof buildTraceTree>;
  selected: boolean;
  active: boolean;
  collapsed: boolean;
  critical: boolean;
  color: string;
  labelWidth: number;
  height: number;
  msg: TraceWaterfallMessages;
  onSelect: () => void;
  onToggle: () => void;
};

function WaterfallRow({ row, id, tree, selected, active, collapsed, critical, color, labelWidth, height, msg, onSelect, onToggle }: RowProps) {
  const { node } = row;
  const span = node.span;
  const hasKids = node.children.length > 0;
  const box = barBox(span, tree);
  const isError = span.status === 'error';
  const durationText = formatDurationMs(Math.max(0, span.duration));
  // The label sits after the bar unless the bar ends in the last third; then it sits before the bar.
  const labelAfter = box.left + box.width < 66;
  const name = span.service ? `${span.name} (${span.service})` : span.name;
  return (
    <div
      id={id}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-setsize={row.setSize}
      aria-posinset={row.posInSet}
      aria-expanded={hasKids ? !collapsed : undefined}
      aria-selected={selected}
      aria-label={`${name}, ${durationText}${isError ? `, ${msg.error}` : ''}${critical ? `, ${msg.onCriticalPath}` : ''}`}
      data-span-id={span.id}
      data-critical={critical || undefined}
      data-error={isError || undefined}
      onClick={onSelect}
      className={cn(
        'relative flex cursor-pointer items-center border-b border-border/50',
        selected ? 'bg-primary-subtle' : 'hover:bg-surface-overlay',
        active && 'outline outline-2 -outline-offset-2 outline-border-focus',
      )}
      style={{ height }}
    >
      <div
        className={cn('flex min-w-0 shrink-0 items-center gap-1 pe-2', critical && 'border-s-2 border-warning')}
        style={{ width: labelWidth, paddingInlineStart: 8 + node.depth * 14 }}
      >
        {hasKids ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={fillMessage(collapsed ? msg.expand : msg.collapse, { name: span.name })}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-surface-sunken"
          >
            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" className={cn('h-3 w-3 transition-transform motion-reduce:transition-none', !collapsed && 'rotate-90 rtl:-rotate-90', collapsed && 'rtl:rotate-180')} />
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        {isError && (
          <>
            <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-error" />
            <span className="sr-only">{msg.error}</span>
          </>
        )}
        <span className={cn('truncate', isError && 'font-medium text-error-fg')}>{span.name}</span>
        {span.service && <span className="truncate text-xs text-text-secondary">{span.service}</span>}
      </div>
      <div className="relative h-full min-w-0 flex-1" aria-hidden="true">
        <div
          className={cn('absolute top-1/2 -translate-y-1/2 rounded-sm', critical && 'ring-2 ring-warning', isError && 'ring-1 ring-error')}
          style={{
            insetInlineStart: `${box.left}%`,
            width: `${box.width}%`,
            height: Math.max(6, height - 14),
            background: isError
              ? `repeating-linear-gradient(135deg, ${color} 0 4px, color-mix(in srgb, ${color} 55%, transparent) 4px 8px)`
              : color,
          }}
        />
        <span
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-text-secondary"
          style={labelAfter
            ? { insetInlineStart: `calc(${box.left + box.width}% + 4px)` }
            : { insetInlineEnd: `calc(${100 - box.left}% + 4px)` }}
        >
          {durationText}
        </span>
      </div>
    </div>
  );
}

function DefaultDetail({ node, info, msg, onClose }: { node: TraceNode; info: TraceSpanInfo; msg: TraceWaterfallMessages; onClose: () => void }) {
  const span = node.span;
  const attrs = span.attributes ? Object.entries(span.attributes) : [];
  const rowsOf: [string, string][] = [
    [msg.start, `+${formatDurationMs(info.offset)}`],
    [msg.duration, formatDurationMs(info.duration)],
    [msg.selfTime, formatDurationMs(info.selfTime)],
  ];
  if (span.service) rowsOf.unshift([msg.service, span.service]);
  if (span.kind) rowsOf.push([msg.kind, span.kind]);
  rowsOf.push([msg.status, span.status === 'error' ? msg.error : span.status ?? 'unset']);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-semibold text-text-primary">{span.name}</h3>
        <button type="button" className={toolBtn} onClick={onClose}>{msg.clearSelection}</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rowsOf.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-text-secondary">{k}</dt>
            <dd className="text-text-primary">{v}</dd>
          </div>
        ))}
      </dl>
      {attrs.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-text-secondary">{msg.attributes}</h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            {attrs.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-text-secondary">{k}</dt>
                <dd className="break-all text-text-primary">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

