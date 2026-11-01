'use client';
// modules/ui/TreeView.tsx
//
// Backwards-compatible shim — the implementation now lives in
// `modules/ui/TreeView/`. Existing imports such as
//   import { TreeView, TreeNode } from '@/modules/ui/TreeView';
// continue to resolve through this barrel.

export { TreeView, applyTreeMove, DEFAULT_TREE_MESSAGES } from './TreeView/index';
export type {
  TreeNode,
  TreeViewProps,
  NodeId,
  SelectionMode,
  TreeViewMessages,
  TreeMoveTarget,
  TreeDropPosition,
} from './TreeView/index';
