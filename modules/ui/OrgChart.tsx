'use client';
import { useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faExpand, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

/**
 * OrgChart — a top-down tree of cards joined by connector lines (phase 11.10).
 *
 * Nodes are nested (`getChildren`) or flat with a parent id (`buildOrgTree`). Each card is the host's own
 * (`renderNode`); the chart draws the connectors, collapses and expands subtrees (`defaultExpandedDepth`), opens the
 * path to every node `highlight` matches (search), zooms (−, +, fit) and is a keyboard tree: Arrow Up goes to the
 * parent, Arrow Down to the first child (opening it), Arrow Left / Right to the siblings, Enter or Space runs
 * `onNodeClick`, `*` opens every child of the focused node. No chart library: the layout is nested flex boxes.
 */

export type OrgChartMessages = {
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  expand: string;
  collapse: string;
  /** Count shown on a collapsed node's toggle; `{count}` is the number of children. */
  hiddenChildren: string;
};

const DEFAULT_MESSAGES: OrgChartMessages = {
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomReset: 'Reset zoom',
  expand: 'Expand',
  collapse: 'Collapse',
  hiddenChildren: '{count} more',
};

/** A node of `buildOrgTree`: the row and its children. */
export type OrgTreeNode<T> = { node: T; children: OrgTreeNode<T>[] };

/** Flat rows with a parent id → nested nodes; rows whose parent is missing become roots. */
export function buildOrgTree<T>(
  rows: readonly T[],
  getId: (row: T) => string,
  getParentId: (row: T) => string | null | undefined,
): OrgTreeNode<T>[] {
  type N = OrgTreeNode<T>;
  const byId = new Map<string, N>();
  for (const r of rows) byId.set(getId(r), { node: r, children: [] });
  const roots: N[] = [];
  for (const r of rows) {
    const me = byId.get(getId(r))!;
    const pid = getParentId(r);
    const parent = pid ? byId.get(pid) : undefined;
    if (parent && parent !== me) parent.children.push(me);
    else roots.push(me);
  }
  return roots;
}

type Flat<T> = { node: T; id: string; parentId: string | null; depth: number; childIds: string[] };

export function OrgChart<T>({
  roots,
  getId,
  getChildren,
  renderNode,
  onNodeClick,
  highlight,
  defaultExpandedDepth = 2,
  zoomable = true,
  ariaLabel,
  messages,
  className,
}: {
  roots: readonly T[];
  getId: (node: T) => string;
  getChildren: (node: T) => readonly T[];
  /** The card of one node; `ctx.highlighted` is true when `highlight` matches it. */
  renderNode: (node: T, ctx: { highlighted: boolean; depth: number; childCount: number }) => React.ReactNode;
  onNodeClick?: (node: T) => void;
  /** Marks matching nodes (a search) and opens the path to each match. */
  highlight?: (node: T) => boolean;
  /** Levels open on first render (0 = only the roots). */
  defaultExpandedDepth?: number;
  zoomable?: boolean;
  ariaLabel?: string;
  messages?: Partial<OrgChartMessages>;
  className?: string;
}) {
  const m = { ...DEFAULT_MESSAGES, ...messages };

  // One flat index of the tree: parent, depth and children per id, for keyboard moves and highlight paths.
  const flat = useMemo(() => {
    const map = new Map<string, Flat<T>>();
    const walk = (n: T, parentId: string | null, depth: number) => {
      const id = getId(n);
      const kids = getChildren(n);
      map.set(id, { node: n, id, parentId, depth, childIds: kids.map(getId) });
      for (const k of kids) walk(k, id, depth + 1);
    };
    for (const r of roots) walk(r, null, 0);
    return map;
  }, [roots, getId, getChildren]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const f of flat.values()) if (f.depth < defaultExpandedDepth) s.add(f.id);
    return s;
  });

  // Every ancestor of a highlighted node opens (by value: a new highlight function with the same matches keeps state).
  const matchIds = useMemo(
    () => (highlight ? [...flat.values()].filter((f) => highlight(f.node)).map((f) => f.id) : []),
    [flat, highlight],
  );
  const matchKey = matchIds.join('|');
  const [openedFor, setOpenedFor] = useState('');
  if (matchKey && matchKey !== openedFor) {
    setOpenedFor(matchKey);
    const next = new Set(expanded);
    for (const id of matchIds) {
      let p = flat.get(id)?.parentId ?? null;
      while (p) {
        next.add(p);
        p = flat.get(p)?.parentId ?? null;
      }
    }
    setExpanded(next);
  }
  const matched = useMemo(() => new Set(matchIds), [matchIds]);

  const [focusId, setFocusId] = useState<string | null>(null);
  const tabId = focusId && flat.has(focusId) ? focusId : roots[0] ? getId(roots[0]) : null;
  const treeRef = useRef<HTMLUListElement>(null);
  const [zoom, setZoom] = useState(1);

  function toggle(id: string, open?: boolean) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function focus(id: string | null | undefined) {
    if (!id) return;
    setFocusId(id);
    treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, id: string) {
    const f = flat.get(id);
    if (!f || e.target !== e.currentTarget) return;
    const siblings = f.parentId ? flat.get(f.parentId)!.childIds : roots.map(getId);
    const at = siblings.indexOf(id);
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        focus(f.parentId);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (f.childIds.length) {
          toggle(id, true);
          requestAnimationFrame(() => focus(f.childIds[0]));
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focus(siblings[at - 1]);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focus(siblings[at + 1]);
        break;
      case '*':
        e.preventDefault();
        setExpanded((prev) => new Set([...prev, id, ...f.childIds]));
        break;
      case 'Enter':
      case ' ':
        if (onNodeClick) {
          e.preventDefault();
          onNodeClick(f.node);
        }
        break;
      default:
    }
  }

  function renderBranch(node: T, depth: number, single: boolean): React.ReactNode {
    const id = getId(node);
    const kids = getChildren(node);
    const isOpen = expanded.has(id);
    const isMatch = matched.has(id);
    return (
      <li
        key={id}
        role="none"
        className={cn('relative flex flex-col items-center px-2', depth > 0 && 'pt-6')}
        data-part="org-branch"
      >
        {depth > 0 && (
          <span className="absolute top-0 left-1/2 h-6 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
        )}
        {/* Half rails left and right of this branch join the siblings' stems into one horizontal line. */}
        {depth > 0 && !single && (
          <>
            <span className="absolute top-0 left-0 right-1/2 h-px bg-border [li:first-child>&]:hidden" aria-hidden="true" />
            <span className="absolute top-0 left-1/2 right-0 h-px bg-border [li:last-child>&]:hidden" aria-hidden="true" />
          </>
        )}
        <div
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={kids.length ? isOpen : undefined}
          aria-selected={isMatch || undefined}
          tabIndex={id === tabId ? 0 : -1}
          data-node-id={id}
          data-highlighted={isMatch || undefined}
          onFocus={(e) => { if (e.target === e.currentTarget) setFocusId(id); }}
          onKeyDown={(e) => onKeyDown(e, id)}
          onClick={onNodeClick ? (e) => {
            if ((e.target as HTMLElement).closest('button,a,input,select,textarea')) return;
            onNodeClick(node);
          } : undefined}
          className={cn(
            'relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
            onNodeClick && 'cursor-pointer',
            isMatch && 'ring-2 ring-primary/40',
          )}
        >
          {renderNode(node, { highlighted: isMatch, depth, childCount: kids.length })}
        </div>
        {kids.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => toggle(id)}
            aria-label={isOpen ? m.collapse : m.expand}
            className="relative z-[1] -mt-2 inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-full border border-border bg-surface-raised px-1.5 text-[10px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            data-part="org-toggle"
          >
            <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} className="h-2 w-2" aria-hidden="true" />
            {!isOpen && <span>{m.hiddenChildren.replace('{count}', String(kids.length))}</span>}
          </button>
        )}
        {kids.length > 0 && isOpen && (
          <ul role="group" className="relative flex list-none justify-center" data-part="org-children">
            {kids.map((k) => renderBranch(k, depth + 1, kids.length === 1))}
          </ul>
        )}
      </li>
    );
  }

  const zoomButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-raised text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

  return (
    <div className={cn('relative w-full', className)} data-part="org-chart">
      {zoomable && (
        <div className="absolute right-2 top-2 z-10 flex gap-1" data-part="org-zoom">
          <button type="button" className={zoomButton} aria-label={m.zoomOut} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            <FontAwesomeIcon icon={faMinus} className="h-3 w-3" aria-hidden="true" />
          </button>
          <button type="button" className={zoomButton} aria-label={m.zoomReset} onClick={() => setZoom(1)}>
            <FontAwesomeIcon icon={faExpand} className="h-3 w-3" aria-hidden="true" />
          </button>
          <button type="button" className={zoomButton} aria-label={m.zoomIn} onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
            <FontAwesomeIcon icon={faPlus} className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="w-full overflow-auto rounded-lg border border-border bg-surface-base p-6" data-part="org-viewport">
        <ul
          ref={treeRef}
          role="tree"
          aria-label={ariaLabel}
          className="mx-auto flex w-max list-none justify-center origin-top"
          style={zoom !== 1 ? { transform: `scale(${zoom})` } : undefined}
        >
          {roots.map((r) => renderBranch(r, 0, roots.length === 1))}
        </ul>
      </div>
    </div>
  );
}
