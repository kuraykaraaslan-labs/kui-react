'use client';
// modules/ui/TreeView/index.tsx
//
// Public entry point for the TreeView family: M1 (core nav + selection) and
// M2 (move: pointer drag, touch long press, Alt+Arrow keys, live-region
// announcements). The tree stays controlled by `nodes`: a move calls
// `onMove(ids, target)` and the caller passes the new `nodes` back
// (`applyTreeMove` does it for a plain tree).
//
// The legacy `modules/ui/TreeView.tsx` re-exports from this file, so every
// existing consumer continues to work unchanged. Lazy load, virtualize,
// context menu and full a11y polish ship in M3-M5.

import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDoubleDown,
  faAngleDoubleUp,
} from '@fortawesome/free-solid-svg-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TreeNodeRow } from './parts/Node';
import { DragPreview } from './parts/DragPreview';
import { useTreeState } from './hooks/useTreeState';
import { useKeyboardNav, type MoveDirection } from './hooks/useKeyboardNav';
import { useTreeDnD } from './hooks/useTreeDnD';
import {
  indexTree,
  keyboardTarget,
  moveAnnouncement,
  refusedAnnouncement,
} from './hooks/treeMove';
import {
  DEFAULT_TREE_MESSAGES,
  type NodeId,
  type TreeMoveTarget,
  type TreeViewProps,
  type TreeViewMessages,
} from './types';

export type {
  NodeId,
  TreeNode,
  TreeViewProps,
  SelectionMode,
  TreeViewMessages,
  TreeMoveTarget,
  TreeDropPosition,
} from './types';
export { DEFAULT_TREE_MESSAGES } from './types';
export { applyTreeMove } from './hooks/treeMove';

export function TreeView({
  nodes,
  selectedId,
  selectedIds,
  expandedIds,
  defaultExpandedIds,
  focusId: initialFocusId,
  selectionMode = 'single',
  onSelect,
  onSelectionChange,
  onExpand,
  onActivate,
  label,
  className,
  hideToolbar = false,
  messages,
  onMove,
  canDrop,
  dragHandle = false,
  renderLabel,
}: TreeViewProps) {
  const msgs: TreeViewMessages = useMemo(
    () => ({ ...DEFAULT_TREE_MESSAGES, ...messages }),
    [messages],
  );

  const state = useTreeState({
    nodes,
    selectionMode,
    selectedIds,
    selectedId,
    expandedIds,
    defaultExpandedIds,
    initialFocusId,
    onSelectionChange,
    onSelect,
    onExpand,
  });

  const {
    focusId,
    setFocusId,
    visibleRows,
    selected,
    expanded,
    setExpanded,
    toggleExpanded,
    expandAll,
    collapseAll,
    selectSingle,
    toggleSelection,
    selectRange,
  } = state;

  const listRef = useRef<HTMLUListElement>(null);
  const treeIndex = useMemo(() => indexTree(nodes), [nodes]);
  const movable = !!onMove;

  // ── Live region (polite). A zero-width space alternates so the same text twice is still announced. ──
  const [announcement, setAnnouncement] = useState({ text: '', flip: false });
  const announce = useCallback((text: string) => {
    setAnnouncement((prev) => ({ text, flip: !prev.flip }));
  }, []);

  const commitMove = useCallback(
    (ids: NodeId[], target: TreeMoveTarget) => {
      if (!onMove || !ids.length) return;
      const text = moveAnnouncement(nodes, treeIndex, ids, target, msgs);
      onMove(ids, target);
      // A node moved into a closed (or brand-new) parent stays in sight.
      if (target.parentId !== null && !expanded.has(target.parentId)) setExpanded(target.parentId, true);
      announce(text);
    },
    [onMove, nodes, treeIndex, msgs, expanded, setExpanded, announce],
  );

  // After a keyboard move the row is re-ordered in the DOM; keep the focus on it.
  const refocusRef = useRef<NodeId | null>(null);

  const onMoveKey = useCallback(
    (id: NodeId, direction: MoveDirection) => {
      const target = keyboardTarget(nodes, treeIndex, id, direction);
      if (!target) return;
      if (canDrop && !canDrop([id], target)) {
        announce(refusedAnnouncement(treeIndex, [id], msgs));
        return;
      }
      refocusRef.current = id;
      commitMove([id], target);
    },
    [nodes, treeIndex, canDrop, announce, msgs, commitMove],
  );

  const { onKeyDown, anchorRef } = useKeyboardNav({
    state,
    onActivate,
    onMoveKey: movable ? onMoveKey : undefined,
  });

  const dnd = useTreeDnD({
    enabled: movable,
    nodes,
    index: treeIndex,
    visibleRows,
    listRef,
    selected,
    selectionMode,
    canDrop,
    commit: commitMove,
    expand: (id) => setExpanded(id, true),
  });

  // Roving focus: the DOM focus follows `focusId` while the focus is inside the
  // tree (arrow keys), and comes back to a row a keyboard move re-ordered.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !focusId) return;
    const force = refocusRef.current === focusId;
    refocusRef.current = null;
    const active = list.ownerDocument.activeElement;
    if (!force && !(active && list.contains(active))) return;
    const item = Array.from(list.querySelectorAll<HTMLElement>('[data-tree-node-id]')).find(
      (el) => el.getAttribute('data-tree-node-id') === focusId,
    );
    const row = item?.querySelector<HTMLElement>(':scope > [data-tree-row]');
    if (row && row !== active) row.focus();
  }, [focusId, visibleRows]);

  const handleActivate = (e: React.MouseEvent, id: NodeId) => {
    const row = state.findRow(id);
    if (!row) return;

    if (e.shiftKey) {
      selectRange(anchorRef.current ?? id, id);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      toggleSelection(id);
      anchorRef.current = id;
      return;
    }

    // Plain click — legacy behaviour: clicking a parent toggles, leaf selects.
    if (row.hasChildren) {
      toggleExpanded(id);
      // Still surface a selection event so consumers that drive UI off the
      // current node (e.g. a "Reveal in editor" preview pane) keep working.
      if (selectionMode === 'single') selectSingle(id);
      else if (!selected.has(id)) toggleSelection(id);
      anchorRef.current = id;
    } else {
      selectSingle(id);
      anchorRef.current = id;
    }
  };

  const showToolbar = !hideToolbar && visibleRows.some((r) => r.hasChildren);
  const dragging = dnd.drag ? new Set(dnd.drag.ids) : null;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {showToolbar && (
        <div
          data-tree-toolbar
          className="flex items-center gap-1 px-1 pb-1 text-xs text-text-secondary"
        >
          <button
            type="button"
            data-tree-action="expand-all"
            onClick={() => expandAll()}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md',
              'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'transition-colors',
            )}
          >
            <FontAwesomeIcon icon={faAngleDoubleDown} className="w-3 h-3" aria-hidden="true" />
            <span>{msgs.expandAll}</span>
          </button>
          <button
            type="button"
            data-tree-action="collapse-all"
            onClick={() => collapseAll()}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md',
              'hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
              'transition-colors',
            )}
          >
            <FontAwesomeIcon icon={faAngleDoubleUp} className="w-3 h-3" aria-hidden="true" />
            <span>{msgs.collapseAll}</span>
          </button>
        </div>
      )}

      <ul
        ref={listRef}
        role="tree"
        aria-label={label ?? msgs.tree}
        aria-multiselectable={selectionMode === 'multi' ? true : undefined}
        onKeyDown={onKeyDown}
        onClickCapture={movable ? dnd.onClickCapture : undefined}
        onContextMenu={movable ? dnd.onContextMenu : undefined}
        data-tree-dragging={dnd.drag ? 'true' : undefined}
        className={cn('space-y-0.5')}
      >
        {visibleRows.map((row) => (
          <TreeNodeRow
            key={row.node.id}
            row={row}
            isSelected={selected.has(row.node.id)}
            isFocused={focusId === row.node.id}
            onActivate={handleActivate}
            onToggle={toggleExpanded}
            onFocus={setFocusId}
            movable={movable}
            dragHandle={dragHandle}
            onDragPointerDown={dnd.onRowPointerDown}
            isDragging={dragging?.has(row.node.id) ?? false}
            dropPosition={dnd.drop?.rowId === row.node.id ? dnd.drop.position : null}
            dropDepth={dnd.drop?.rowId === row.node.id ? dnd.drop.depth : undefined}
            renderLabel={renderLabel}
          />
        ))}
      </ul>

      {movable && (
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-tree-live>
          {announcement.text ? announcement.text + (announcement.flip ? '​' : '') : ''}
        </div>
      )}

      {dnd.drag && (
        <DragPreview
          label={dnd.drag.ids.length > 1 ? msgs.itemCount.replace('{count}', String(dnd.drag.ids.length)) : dnd.drag.label}
          count={dnd.drag.ids.length}
          x={dnd.drag.x}
          y={dnd.drag.y}
          container={dnd.drag.host}
          previewRef={dnd.previewRef}
        />
      )}
    </div>
  );
}
