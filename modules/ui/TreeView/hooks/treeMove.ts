// modules/ui/TreeView/hooks/treeMove.ts
//
// Pure helpers behind moving nodes (M2): where a drop or an Alt+Arrow key puts
// the moved nodes, whether that target is allowed, the announcement text, and
// `applyTreeMove`, which a caller uses to apply a move to its own `nodes`.
// No React, no DOM: the same rules hold for pointer and keyboard moves.

import type { NodeId, TreeDropPosition, TreeMoveTarget, TreeNode, TreeViewMessages } from '../types';

export type IndexedNode = {
  node: TreeNode;
  parentId: NodeId | null;
  /** Position among the parent's children (or the root list). */
  index: number;
  depth: number;
  /** Pre-order position in the whole tree. */
  order: number;
};

export type TreeIndex = Map<NodeId, IndexedNode>;

export function indexTree(nodes: TreeNode[]): TreeIndex {
  const out: TreeIndex = new Map();
  let order = 0;
  const walk = (list: TreeNode[], parentId: NodeId | null, depth: number) => {
    list.forEach((node, index) => {
      out.set(node.id, { node, parentId, index, depth, order: order++ });
      if (node.children?.length) walk(node.children, node.id, depth + 1);
    });
  };
  walk(nodes, null, 0);
  return out;
}

export function childrenOf(nodes: TreeNode[], index: TreeIndex, parentId: NodeId | null): TreeNode[] {
  if (parentId === null) return nodes;
  return index.get(parentId)?.node.children ?? [];
}

/** True when `id` is `ancestorId` or lies in its subtree. */
export function isSelfOrDescendant(index: TreeIndex, ancestorId: NodeId, id: NodeId | null): boolean {
  let cur: NodeId | null = id;
  while (cur !== null) {
    if (cur === ancestorId) return true;
    cur = index.get(cur)?.parentId ?? null;
  }
  return false;
}

/** Known ids only, none inside another moved node's subtree, in tree order. */
export function normalizeMoveIds(index: TreeIndex, ids: NodeId[]): NodeId[] {
  const known = Array.from(new Set(ids)).filter((id) => index.has(id));
  const set = new Set(known);
  return known
    .filter((id) => {
      let p = index.get(id)!.parentId;
      while (p !== null) {
        if (set.has(p)) return false;
        p = index.get(p)?.parentId ?? null;
      }
      return true;
    })
    .sort((a, b) => index.get(a)!.order - index.get(b)!.order);
}

/** Final index of a slot that sits before `rawIndex` in the current children of `parentId`, once `ids` are taken out. */
function finalIndex(siblings: TreeNode[], rawIndex: number, ids: Set<NodeId>): number {
  let n = rawIndex;
  for (let i = 0; i < rawIndex && i < siblings.length; i++) if (ids.has(siblings[i].id)) n--;
  return n;
}

/**
 * The move target of a drop on `rowId`. `inside` appends as the last child;
 * `after` an expanded parent becomes its first child; `afterDepth` (smaller
 * than the row's depth) puts the nodes after the row's ancestor at that depth.
 */
export function dropTarget(
  nodes: TreeNode[],
  index: TreeIndex,
  ids: NodeId[],
  rowId: NodeId,
  position: TreeDropPosition,
  opts: { expanded?: boolean; afterDepth?: number } = {},
): TreeMoveTarget | null {
  const row = index.get(rowId);
  if (!row) return null;
  const moving = new Set(ids);
  if (position === 'inside') {
    const kids = row.node.children ?? [];
    return { parentId: rowId, index: kids.filter((k) => !moving.has(k.id)).length };
  }
  if (position === 'after' && opts.expanded && row.node.children?.length) {
    return { parentId: rowId, index: 0 };
  }
  let anchor = row;
  if (position === 'after' && opts.afterDepth !== undefined) {
    while (anchor.depth > opts.afterDepth && anchor.parentId !== null) {
      const up = index.get(anchor.parentId);
      if (!up) break;
      anchor = up;
    }
  }
  const siblings = childrenOf(nodes, index, anchor.parentId);
  const raw = position === 'before' ? anchor.index : anchor.index + 1;
  return { parentId: anchor.parentId, index: finalIndex(siblings, raw, moving) };
}

/** A node can never drop into itself or its own subtree. */
export function isStructurallyValid(index: TreeIndex, ids: NodeId[], target: TreeMoveTarget): boolean {
  if (target.parentId !== null && !index.has(target.parentId)) return false;
  return !ids.some((id) => isSelfOrDescendant(index, id, target.parentId));
}

/** True when the move would leave every node where it is. */
export function isNoopMove(nodes: TreeNode[], index: TreeIndex, ids: NodeId[], target: TreeMoveTarget): boolean {
  if (!ids.every((id) => index.get(id)?.parentId === target.parentId)) return false;
  const current = childrenOf(nodes, index, target.parentId).map((n) => n.id);
  const moving = new Set(ids);
  const rest = current.filter((id) => !moving.has(id));
  const next = [...rest.slice(0, target.index), ...ids, ...rest.slice(target.index)];
  return next.length === current.length && next.every((id, i) => id === current[i]);
}

/** Applies a move immutably: takes `ids` out of the tree and inserts them, in tree order, at `target`. */
export function applyTreeMove<T>(nodes: TreeNode<T>[], ids: NodeId[], target: TreeMoveTarget): TreeNode<T>[] {
  const index = indexTree(nodes as TreeNode[]);
  const moving = normalizeMoveIds(index, ids);
  if (!moving.length || !isStructurallyValid(index, moving, target)) return nodes;
  const set = new Set(moving);
  const picked = moving.map((id) => index.get(id)!.node as TreeNode<T>);
  const strip = (list: TreeNode<T>[]): TreeNode<T>[] =>
    list
      .filter((n) => !set.has(n.id))
      .map((n) => (n.children ? { ...n, children: strip(n.children) } : n));
  const insert = (list: TreeNode<T>[]): TreeNode<T>[] => {
    const at = Math.max(0, Math.min(target.index, list.length));
    return [...list.slice(0, at), ...picked, ...list.slice(at)];
  };
  const stripped = strip(nodes);
  if (target.parentId === null) return insert(stripped);
  const place = (list: TreeNode<T>[]): TreeNode<T>[] =>
    list.map((n) => {
      if (n.id === target.parentId) return { ...n, children: insert(n.children ?? []) };
      return n.children ? { ...n, children: place(n.children) } : n;
    });
  return place(stripped);
}

/** The Alt+Arrow target for the node `id`, or null at a boundary. */
export function keyboardTarget(
  nodes: TreeNode[],
  index: TreeIndex,
  id: NodeId,
  direction: 'up' | 'down' | 'out' | 'in',
): TreeMoveTarget | null {
  const info = index.get(id);
  if (!info) return null;
  const siblings = childrenOf(nodes, index, info.parentId);
  switch (direction) {
    case 'up':
      return info.index > 0 ? { parentId: info.parentId, index: info.index - 1 } : null;
    case 'down':
      return info.index < siblings.length - 1 ? { parentId: info.parentId, index: info.index + 1 } : null;
    case 'out': {
      if (info.parentId === null) return null;
      const parent = index.get(info.parentId);
      return parent ? { parentId: parent.parentId, index: parent.index + 1 } : null;
    }
    case 'in': {
      if (info.index === 0) return null;
      const prev = siblings[info.index - 1];
      return { parentId: prev.id, index: prev.children?.length ?? 0 };
    }
  }
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The live-region text for a move, worked out from the tree before the move. */
export function moveAnnouncement(
  nodes: TreeNode[],
  index: TreeIndex,
  ids: NodeId[],
  target: TreeMoveTarget,
  messages: TreeViewMessages,
): string {
  const moving = new Set(ids);
  const label = ids.length === 1 ? index.get(ids[0])?.node.label ?? ids[0] : fill(messages.itemCount, { count: ids.length });
  const count = childrenOf(nodes, index, target.parentId).filter((n) => !moving.has(n.id)).length + ids.length;
  const vars = { label, pos: target.index + 1, count };
  if (target.parentId === null) return fill(messages.moved, vars);
  return fill(messages.movedIn, { ...vars, parent: index.get(target.parentId)?.node.label ?? target.parentId });
}

export function refusedAnnouncement(index: TreeIndex, ids: NodeId[], messages: TreeViewMessages): string {
  const label = ids.length === 1 ? index.get(ids[0])?.node.label ?? ids[0] : fill(messages.itemCount, { count: ids.length });
  return fill(messages.moveRefused, { label });
}

/** Pixels to scroll this frame while dragging near an edge of the scroll box (negative = up). */
export function autoScrollStep(pointerY: number, top: number, bottom: number, edge = 40, max = 16): number {
  if (bottom - top <= edge * 2) return 0;
  if (pointerY < top + edge) return -Math.ceil(((top + edge - Math.max(pointerY, top)) / edge) * max);
  if (pointerY > bottom - edge) return Math.ceil(((Math.min(pointerY, bottom) - (bottom - edge)) / edge) * max);
  return 0;
}
