// modules/ui/TreeView/types.ts
//
// Public type definitions for the TreeView family. Kept implementation-free so
// it can be safely re-exported from the back-compat shim at
// `modules/ui/TreeView.tsx`.

import type { ReactNode } from 'react';

export type NodeId = string;

export type TreeNode<T = unknown> = {
  id: NodeId;
  label: string;
  children?: TreeNode<T>[];
  /** Optional user payload — preserved by the tree but never inspected. */
  data?: T;
  /** Reserved for M3 lazy load. Treated as `false` until then. */
  // TODO M3: hasChildrenAsync?: boolean;
};

export type SelectionMode = 'single' | 'multi';

/**
 * Where a move puts the moved nodes. `index` is the position the first moved
 * node takes among `parentId`'s children once the move is done, that is after
 * the moved nodes were taken out of their old places (`null` = the root list).
 * `applyTreeMove(nodes, ids, target)` applies one immutably.
 */
export type TreeMoveTarget = { parentId: NodeId | null; index: number };

/** Where a pointer drag would drop, relative to the row under the pointer. */
export type TreeDropPosition = 'before' | 'after' | 'inside';

export type TreeViewMessages = {
  /** aria-label fallback when no `label` prop is supplied. */
  tree: string;
  expandAll: string;
  collapseAll: string;
  /** Announced after a move at the root level. `{label}`, `{pos}`, `{count}` are replaced. */
  moved: string;
  /** Announced after a move inside a parent. `{label}`, `{pos}`, `{count}`, `{parent}` are replaced. */
  movedIn: string;
  /** Announced when `canDrop` refuses a keyboard move. `{label}` is replaced. */
  moveRefused: string;
  /** Stands for `{label}` when several nodes move at once. `{count}` is replaced. */
  itemCount: string;
};

export const DEFAULT_TREE_MESSAGES: TreeViewMessages = {
  tree: 'Tree',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  moved: '{label} moved to position {pos} of {count}',
  movedIn: '{label} moved to position {pos} of {count} in {parent}',
  moveRefused: '{label} cannot move there',
  itemCount: '{count} items',
};

export type TreeViewProps = {
  nodes: TreeNode[];
  /** Single-selection (legacy). When `selectionMode === 'multi'`, prefer `selectedIds`. */
  selectedId?: NodeId;
  selectedIds?: NodeId[];
  /** Controlled expanded set. Uncontrolled defaults to "all expanded" (legacy behaviour). */
  expandedIds?: NodeId[];
  defaultExpandedIds?: NodeId[];
  /** Initially focused row. Defaults to the first visible node. */
  focusId?: NodeId;
  selectionMode?: SelectionMode;

  onSelect?: (id: NodeId) => void;
  onSelectionChange?: (ids: NodeId[]) => void;
  onExpand?: (id: NodeId, expanded: boolean) => void;
  /** Fired on Enter — distinct from `onSelect` which fires on every selection change. */
  onActivate?: (id: NodeId) => void;

  label?: string;
  className?: string;
  /** Hide the "Expand all / Collapse all" toolbar. */
  hideToolbar?: boolean;
  messages?: Partial<TreeViewMessages>;

  /**
   * Turns on moving: pointer drag (a long press on touch) and Alt+Arrow keys.
   * The tree never changes `nodes` itself; apply the move here (for example
   * with `applyTreeMove`) and pass the new `nodes` back. A drag of a selected
   * row in multi-select mode moves every selected node.
   */
  onMove?: (ids: NodeId[], target: TreeMoveTarget) => void;
  /** Refuse a target: no drop indicator there, no keyboard move to it. A node never drops into itself or its own subtree. */
  canDrop?: (ids: NodeId[], target: TreeMoveTarget) => boolean;
  /** With `onMove`: a drag starts only from a grip at the start of each row instead of the whole row. */
  dragHandle?: boolean;
  /** Custom row content after the chevron. Default: `node.label` (type-ahead still matches `node.label`). */
  renderLabel?: (node: TreeNode) => ReactNode;

  // TODO M3: onLoadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  // TODO M3: virtualize?: boolean;
  // TODO M4: contextMenuItems?: (node: TreeNode) => unknown[];
  // TODO M4: onRename?: (id: NodeId, name: string) => Promise<void>;
};

/** A node decorated with traversal metadata produced by `flattenVisible`. */
export type VisibleRow = {
  node: TreeNode;
  depth: number;
  parentId: NodeId | null;
  hasChildren: boolean;
  expanded: boolean;
  /** 1-based, matches WAI-ARIA `aria-level`. */
  level: number;
  /** 1-based position among visible siblings — feeds `aria-posinset`. */
  posInSet: number;
  /** Total visible siblings — feeds `aria-setsize`. */
  setSize: number;
};
