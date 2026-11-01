'use client';
// modules/ui/TreeView/hooks/useTreeDnD.ts
//
// Pointer drag for moving nodes (M2). Pointer events rather than HTML5
// drag-and-drop, so mouse, pen and touch behave the same: a mouse drag starts
// after a 4 px move, a touch drag after a long press (or at once from the drag
// handle). The drop target comes from the row under the pointer: the top
// quarter drops before it, the bottom quarter after it, the middle inside it
// (falling back to before/after when "inside" is refused). Dropping after the
// last child of a group can climb out of the group by moving the pointer left.
// Near the top or bottom edge of the scroll box the box scrolls.
//
// The hook never changes `nodes`; a drop calls `commit(ids, target)`.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId, SelectionMode, TreeDropPosition, TreeMoveTarget, TreeNode, VisibleRow } from '../types';
import {
  autoScrollStep,
  dropTarget,
  isNoopMove,
  isStructurallyValid,
  normalizeMoveIds,
  type TreeIndex,
} from './treeMove';

const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 400;
const AUTO_EXPAND_MS = 700;

/** `host` is the document body the drag preview is portalled to. */
export type TreeDragState = { ids: NodeId[]; label: string; x: number; y: number; host: HTMLElement };
export type TreeDropState = { rowId: NodeId; position: TreeDropPosition; depth: number; target: TreeMoveTarget };

type Options = {
  enabled: boolean;
  nodes: TreeNode[];
  index: TreeIndex;
  visibleRows: VisibleRow[];
  listRef: React.RefObject<HTMLUListElement | null>;
  selected: Set<NodeId>;
  selectionMode: SelectionMode;
  canDrop?: (ids: NodeId[], target: TreeMoveTarget) => boolean;
  commit: (ids: NodeId[], target: TreeMoveTarget) => void;
  expand: (id: NodeId) => void;
};

type Pending = {
  id: NodeId;
  pointerId: number;
  touch: boolean;
  fromHandle: boolean;
  startX: number;
  startY: number;
  el: HTMLElement;
  timer?: ReturnType<typeof setTimeout>;
};

function sameDrop(a: TreeDropState | null, b: TreeDropState | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.rowId === b.rowId && a.position === b.position && a.depth === b.depth
    && a.target.parentId === b.target.parentId && a.target.index === b.target.index;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  const view = el.ownerDocument.defaultView;
  let cur: HTMLElement | null = el.parentElement;
  while (cur && view) {
    const oy = view.getComputedStyle(cur).overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  return null;
}

export function useTreeDnD(options: Options) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const [drag, setDrag] = useState<TreeDragState | null>(null);
  const [drop, setDrop] = useState<TreeDropState | null>(null);
  const dragRef = useRef<TreeDragState | null>(null);
  const dropRef = useRef<TreeDropState | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const previewRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const expandTimerRef = useRef<{ id: NodeId; timer: ReturnType<typeof setTimeout> } | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  const updateDrop = useCallback((next: TreeDropState | null) => {
    if (sameDrop(dropRef.current, next)) return;
    dropRef.current = next;
    setDrop(next);
    // Hovering "inside" a collapsed parent for a moment opens it.
    const pending = expandTimerRef.current;
    if (pending && pending.id !== next?.rowId) {
      clearTimeout(pending.timer);
      expandTimerRef.current = null;
    }
    if (next?.position === 'inside' && expandTimerRef.current?.id !== next.rowId) {
      const row = latest.current.visibleRows.find((r) => r.node.id === next.rowId);
      if (row?.hasChildren && !row.expanded) {
        const id = next.rowId;
        expandTimerRef.current = {
          id,
          timer: setTimeout(() => {
            expandTimerRef.current = null;
            latest.current.expand(id);
          }, AUTO_EXPAND_MS),
        };
      }
    }
  }, []);

  const computeDrop = useCallback((x: number, y: number): TreeDropState | null => {
    const { listRef, visibleRows, nodes, index, canDrop } = latest.current;
    const current = dragRef.current;
    const list = listRef.current;
    if (!list || !current) return null;
    const box = list.getBoundingClientRect();
    if (x < box.left - 24 || x > box.right + 24) return null;
    const rowEls = Array.from(list.querySelectorAll<HTMLElement>('[data-tree-row]'));
    if (!rowEls.length) return null;
    let hitIdx = rowEls.findIndex((el) => y < el.getBoundingClientRect().bottom);
    if (hitIdx === -1) hitIdx = rowEls.length - 1;
    const el = rowEls[hitIdx];
    const id = el.closest('[data-tree-node-id]')?.getAttribute('data-tree-node-id');
    const rowPos = visibleRows.findIndex((r) => r.node.id === id);
    const row = visibleRows[rowPos];
    if (!row) return null;
    const rect = el.getBoundingClientRect();
    const rel = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
    const candidates: TreeDropPosition[] = rel < 0.25 ? ['before'] : rel > 0.75 ? ['after'] : ['inside', rel < 0.5 ? 'before' : 'after'];

    const fontSize = parseFloat(list.ownerDocument.defaultView?.getComputedStyle(list.ownerDocument.documentElement).fontSize ?? '') || 16;
    const indent = fontSize * 1.25;
    const next = visibleRows[rowPos + 1];
    const openParent = row.hasChildren && row.expanded;
    const ids = current.ids;

    for (const position of candidates) {
      let afterDepth: number | undefined;
      let depth = row.depth;
      if (position === 'after') {
        if (openParent) {
          depth = row.depth + 1;
        } else if (row.posInSet === row.setSize) {
          const minDepth = next ? Math.min(next.depth, row.depth) : 0;
          const wanted = Math.floor((x - rect.left) / indent);
          afterDepth = Math.max(minDepth, Math.min(row.depth, wanted));
          depth = afterDepth;
        }
      }
      const target = dropTarget(nodes, index, ids, row.node.id, position, { expanded: openParent, afterDepth });
      if (!target) continue;
      if (!isStructurallyValid(index, ids, target)) continue;
      if (isNoopMove(nodes, index, ids, target)) continue;
      if (canDrop && !canDrop(ids, target)) continue;
      return { rowId: row.node.id, position, depth, target };
    }
    return null;
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const runAutoScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    const list = latest.current.listRef.current;
    if (!list) return;
    const box = scrollParent(list);
    const doc = list.ownerDocument;
    const tick = () => {
      frameRef.current = null;
      if (!dragRef.current) return;
      const { x, y } = pointerRef.current;
      const top = box ? box.getBoundingClientRect().top : 0;
      const bottom = box ? box.getBoundingClientRect().bottom : doc.defaultView?.innerHeight ?? 0;
      const step = autoScrollStep(y, top, bottom);
      if (!step) return;
      const scroller = box ?? (doc.scrollingElement as HTMLElement | null);
      if (!scroller) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + step;
      if (scroller.scrollTop === before) return;
      updateDrop(computeDrop(x, y));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [computeDrop, updateDrop]);

  const end = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.timer) clearTimeout(pending.timer);
    pendingRef.current = null;
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current.timer);
    expandTimerRef.current = null;
    stopAutoScroll();
    detachRef.current?.();
    detachRef.current = null;
    dragRef.current = null;
    dropRef.current = null;
    setDrag(null);
    setDrop(null);
  }, [stopAutoScroll]);

  const start = useCallback((x: number, y: number) => {
    const pending = pendingRef.current;
    if (!pending) return;
    const { index, selected, selectionMode } = latest.current;
    const ids = selectionMode === 'multi' && selected.has(pending.id) && selected.size > 1
      ? normalizeMoveIds(index, Array.from(selected))
      : [pending.id];
    const label = index.get(pending.id)?.node.label ?? pending.id;
    const state = { ids, label, x, y, host: pending.el.ownerDocument.body };
    dragRef.current = state;
    setDrag(state);
    try {
      pending.el.setPointerCapture?.(pending.pointerId);
    } catch {
      // The pointer may already be gone (released between the timer and now).
    }
    updateDrop(computeDrop(x, y));
  }, [computeDrop, updateDrop]);

  const onRowPointerDown = useCallback((e: React.PointerEvent<HTMLElement>, id: NodeId, fromHandle: boolean) => {
    if (!latest.current.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // A press whose release never reached us (outside the window) is stale.
    if (pendingRef.current) end();
    const touch = e.pointerType === 'touch';
    const pending: Pending = {
      id,
      pointerId: e.pointerId,
      touch,
      fromHandle,
      startX: e.clientX,
      startY: e.clientY,
      el: e.currentTarget,
    };
    pendingRef.current = pending;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (touch && !fromHandle) {
      pending.timer = setTimeout(() => {
        if (pendingRef.current === pending && !dragRef.current) start(pointerRef.current.x, pointerRef.current.y);
      }, LONG_PRESS_MS);
    }

    const doc = e.currentTarget.ownerDocument;
    const onMove = (ev: PointerEvent) => {
      const p = pendingRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      pointerRef.current = { x: ev.clientX, y: ev.clientY };
      if (!dragRef.current) {
        const moved = Math.hypot(ev.clientX - p.startX, ev.clientY - p.startY);
        if (p.touch && !p.fromHandle) {
          // Moving before the long press fires is a scroll, not a drag.
          if (moved > TOUCH_SLOP) end();
          return;
        }
        if (moved <= MOUSE_SLOP) return;
        start(ev.clientX, ev.clientY);
        return;
      }
      ev.preventDefault();
      if (previewRef.current) previewRef.current.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
      updateDrop(computeDrop(ev.clientX, ev.clientY));
      runAutoScroll();
    };
    const onUp = (ev: PointerEvent) => {
      const p = pendingRef.current;
      if (!p || ev.pointerId !== p.pointerId) return;
      const dragging = dragRef.current;
      const target = dropRef.current;
      if (dragging) {
        // The click that follows a drag must not select or toggle the row.
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
      end();
      if (dragging && target) latest.current.commit(dragging.ids, target.target);
    };
    const onCancel = (ev: PointerEvent) => {
      if (pendingRef.current && ev.pointerId === pendingRef.current.pointerId) end();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !dragRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      end();
    };
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onCancel);
    doc.addEventListener('keydown', onKey, true);
    detachRef.current = () => {
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      doc.removeEventListener('keydown', onKey, true);
    };
  }, [computeDrop, end, runAutoScroll, start, updateDrop]);

  // A touch drag must not scroll the page: the browser decides at touchstart
  // whether a region has a blocking listener, so it is bound for the tree's
  // lifetime and only blocks while a drag runs.
  const enabled = options.enabled;
  const listRef = options.listRef;
  useEffect(() => {
    const list = listRef.current;
    if (!enabled || !list) return;
    const block = (ev: TouchEvent) => {
      if (dragRef.current) ev.preventDefault();
    };
    list.addEventListener('touchmove', block, { passive: false });
    return () => list.removeEventListener('touchmove', block);
  }, [enabled, listRef]);

  useEffect(() => end, [end]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // A long press on touch opens the context menu on some systems.
    if (pendingRef.current?.touch || dragRef.current) e.preventDefault();
  }, []);

  return { drag, drop, previewRef, onRowPointerDown, onClickCapture, onContextMenu };
}
