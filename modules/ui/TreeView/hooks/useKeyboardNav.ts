// modules/ui/TreeView/hooks/useKeyboardNav.ts
//
// Keyboard handler returning an `onKeyDown` callback bound to the tree root.
// Implements the WAI-ARIA Tree pattern (M1 subset) including type-ahead, and
// (M2, when moving is on) Alt+Arrow moves of the focused node.

import { useCallback, useRef } from 'react';
import type { NodeId, VisibleRow } from '../types';
import type { UseTreeStateReturn } from './useTreeState';

const TYPE_AHEAD_RESET_MS = 500;

export type MoveDirection = 'up' | 'down' | 'out' | 'in';

const MOVE_KEYS: Record<string, MoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'out',
  ArrowRight: 'in',
};

type Options = {
  state: UseTreeStateReturn;
  onActivate?: (id: NodeId) => void;
  /** Alt+ArrowUp/Down among siblings, Alt+ArrowLeft out to the parent's level, Alt+ArrowRight into the previous sibling. */
  onMoveKey?: (id: NodeId, direction: MoveDirection) => void;
};

export function useKeyboardNav({ state, onActivate, onMoveKey }: Options) {
  const {
    visibleRows,
    focusId,
    setFocusId,
    setExpanded,
    selected,
    selectSingle,
    toggleSelection,
    selectRange,
    selectAllVisible,
    moveFocus,
    focusFirst,
    focusLast,
    findRow,
  } = state;

  /** Multi-selection anchor — set on the previous single click / focus. */
  const anchorRef = useRef<NodeId | undefined>(focusId);
  const typeAheadRef = useRef<{ buffer: string; lastAt: number }>({
    buffer: '',
    lastAt: 0,
  });

  const updateAnchorOnFocus = useCallback(
    (id: NodeId) => {
      anchorRef.current = id;
    },
    [],
  );

  const jumpTypeAhead = useCallback(
    (char: string) => {
      const now = Date.now();
      const prev = typeAheadRef.current;
      const buffer = now - prev.lastAt > TYPE_AHEAD_RESET_MS ? char : prev.buffer + char;
      typeAheadRef.current = { buffer, lastAt: now };

      if (!visibleRows.length) return;
      const order = visibleRows;
      const currentIdx = Math.max(
        0,
        order.findIndex((r) => r.node.id === focusId),
      );

      // Single-char buffer: continue scanning from the next sibling (rotating).
      // Multi-char buffer: search from the start so the match doesn't drift.
      const startOffset = buffer.length === 1 ? 1 : 0;
      const total = order.length;
      const needle = buffer.toLowerCase();
      for (let i = 0; i < total; i++) {
        const probe = order[(currentIdx + startOffset + i) % total];
        const label = probe.node.label?.toLowerCase() ?? '';
        if (label.startsWith(needle)) {
          setFocusId(probe.node.id);
          return;
        }
      }
    },
    [visibleRows, focusId, setFocusId],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focusId) return;
      const row = findRow(focusId);
      if (!row) return;

      // Alt+Arrow moves the focused node (only when moving is on).
      if (onMoveKey && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && MOVE_KEYS[e.key]) {
        e.preventDefault();
        onMoveKey(focusId, MOVE_KEYS[e.key]);
        return;
      }

      // Type-ahead — printable single characters, no modifiers (except Shift for caps).
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        // Space is special — handled below for selection toggle.
        e.key !== ' '
      ) {
        e.preventDefault();
        jumpTypeAhead(e.key);
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          moveFocus(1);
          if (e.shiftKey) {
            // Range-extend toward the next row.
            const nextIdx = Math.min(visibleRows.length - 1, indexOf(visibleRows, focusId) + 1);
            const target = visibleRows[nextIdx]?.node.id;
            if (target) selectRange(anchorRef.current ?? focusId, target);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          moveFocus(-1);
          if (e.shiftKey) {
            const prevIdx = Math.max(0, indexOf(visibleRows, focusId) - 1);
            const target = visibleRows[prevIdx]?.node.id;
            if (target) selectRange(anchorRef.current ?? focusId, target);
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (row.hasChildren && !row.expanded) {
            setExpanded(row.node.id, true);
          } else if (row.hasChildren && row.expanded) {
            // Move to first child.
            const idx = indexOf(visibleRows, focusId);
            const child = visibleRows[idx + 1];
            if (child && child.depth > row.depth) setFocusId(child.node.id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (row.hasChildren && row.expanded) {
            setExpanded(row.node.id, false);
          } else if (row.parentId) {
            setFocusId(row.parentId);
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusFirst();
          break;
        }
        case 'End': {
          e.preventDefault();
          focusLast();
          break;
        }
        case ' ': {
          e.preventDefault();
          if (e.shiftKey) {
            selectRange(anchorRef.current ?? focusId, focusId);
          } else if (e.ctrlKey || e.metaKey) {
            toggleSelection(focusId);
            anchorRef.current = focusId;
          } else {
            toggleSelection(focusId);
            anchorRef.current = focusId;
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          // Enter activates without toggling expansion automatically.
          if (!selected.has(focusId)) selectSingle(focusId);
          anchorRef.current = focusId;
          onActivate?.(focusId);
          break;
        }
        case '*': {
          // ARIA spec: expand all siblings of focused node.
          e.preventDefault();
          // Lightweight M1 implementation: expand every visible row's children.
          visibleRows.forEach((r) => {
            if (r.parentId === row.parentId && r.hasChildren && !r.expanded) {
              setExpanded(r.node.id, true);
            }
          });
          break;
        }
        default: {
          // Ctrl/Cmd+A → select all visible (multi-select mode only).
          if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            selectAllVisible();
          }
        }
      }
    },
    [
      focusId,
      findRow,
      jumpTypeAhead,
      moveFocus,
      visibleRows,
      selectRange,
      setExpanded,
      setFocusId,
      focusFirst,
      focusLast,
      toggleSelection,
      selectSingle,
      selectAllVisible,
      selected,
      onActivate,
      onMoveKey,
    ],
  );

  return { onKeyDown, updateAnchorOnFocus, anchorRef };
}

function indexOf(rows: VisibleRow[], id: NodeId | undefined): number {
  if (!id) return -1;
  return rows.findIndex((r) => r.node.id === id);
}
