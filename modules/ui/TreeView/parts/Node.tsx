'use client';
// modules/ui/TreeView/parts/Node.tsx
//
// Single tree row. Renders the drag grip (optional), the chevron / leaf spacer
// and the label, and forwards mouse / keyboard / drag intents to the parent
// via callbacks. Stateless — all state lives in `useTreeState` / `useTreeDnD`.

import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import type { NodeId, TreeDropPosition, TreeNode, VisibleRow } from '../types';
import { DropIndicator } from './DropIndicator';

export type TreeNodeRowProps = {
  row: VisibleRow;
  isSelected: boolean;
  isFocused: boolean;
  onActivate: (e: React.MouseEvent, id: NodeId) => void;
  onToggle: (id: NodeId) => void;
  onFocus: (id: NodeId) => void;
  /** Moving is on (`onMove` given): the row can be dragged and can show a drop indicator. */
  movable?: boolean;
  /** Drag only from the grip. */
  dragHandle?: boolean;
  onDragPointerDown?: (e: React.PointerEvent<HTMLElement>, id: NodeId, fromHandle: boolean) => void;
  /** This row is one of the nodes being dragged. */
  isDragging?: boolean;
  dropPosition?: TreeDropPosition | null;
  dropDepth?: number;
  renderLabel?: (node: TreeNode) => React.ReactNode;
};

export function TreeNodeRow({
  row,
  isSelected,
  isFocused,
  onActivate,
  onToggle,
  onFocus,
  movable = false,
  dragHandle = false,
  onDragPointerDown,
  isDragging = false,
  dropPosition = null,
  dropDepth,
  renderLabel,
}: TreeNodeRowProps) {
  const { node, depth, hasChildren, expanded, level, posInSet, setSize } = row;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
      aria-level={level}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      data-tree-node-id={node.id}
      data-has-children={hasChildren ? 'true' : 'false'}
      className={movable ? 'relative' : undefined}
    >
      <DropIndicator position={dropPosition} depth={dropDepth ?? depth} />
      <div
        tabIndex={isFocused ? 0 : -1}
        data-tree-row
        onClick={(e) => {
          onFocus(node.id);
          onActivate(e, node.id);
        }}
        onFocus={() => onFocus(node.id)}
        onPointerDown={movable && !dragHandle ? (e) => onDragPointerDown?.(e, node.id, false) : undefined}
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          'hover:bg-surface-overlay transition-colors',
          isSelected && 'bg-primary-subtle text-primary font-medium',
          dropPosition === 'inside' && 'bg-primary-subtle hover:bg-primary-subtle',
          isDragging && 'opacity-50',
        )}
      >
        {movable && dragHandle && (
          <span
            aria-hidden="true"
            data-tree-drag-handle
            onPointerDown={(e) => onDragPointerDown?.(e, node.id, true)}
            className="text-text-disabled w-3 shrink-0 flex items-center justify-center cursor-grab touch-none"
          >
            <FontAwesomeIcon icon={faGripVertical} className="w-2.5 h-2.5" />
          </span>
        )}
        {hasChildren ? (
          <span
            aria-hidden="true"
            data-tree-chevron
            onClick={(e) => {
              // Chevron only toggles expand — never selects.
              e.stopPropagation();
              onFocus(node.id);
              onToggle(node.id);
            }}
            className="text-text-disabled w-3 shrink-0 flex items-center justify-center"
          >
            <FontAwesomeIcon
              icon={expanded ? faChevronDown : faChevronRight}
              className="w-2.5 h-2.5"
            />
          </span>
        ) : (
          <span className="w-3 shrink-0" aria-hidden="true" />
        )}
        {renderLabel ? (
          <span data-tree-label={node.label} className="min-w-0 flex-1">{renderLabel(node)}</span>
        ) : (
          <span>{node.label}</span>
        )}
      </div>
    </li>
  );
}
