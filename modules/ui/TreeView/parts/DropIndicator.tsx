'use client';
// modules/ui/TreeView/parts/DropIndicator.tsx
//
// Where a drag would drop (M2). Absolutely positioned inside the row's `li`
// (which is `relative` while moving is on), so it never shifts the layout:
//   - before / after: a 2px line in the 2px gap above / below the row, starting
//     where a row of `depth` starts its content (depth × 1.25rem);
//   - inside: a 2px frame around the row (the row itself takes the tint).
// Pixel-parity contract with kui-ejs `TreeView/partials/_node.ejs` and the
// KUInative TreeView.

import type { TreeDropPosition } from '../types';

export type DropIndicatorProps = {
  /** When `null` the indicator renders nothing. */
  position?: TreeDropPosition | null;
  /** Depth of the slot the line marks (before/after only). */
  depth?: number;
};

export function DropIndicator({ position = null, depth = 0 }: DropIndicatorProps) {
  if (!position) return null;
  if (position === 'inside') {
    return (
      <span
        aria-hidden="true"
        data-tree-drop-indicator="inside"
        className="pointer-events-none absolute inset-0 rounded-md border-2 border-border-focus"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-tree-drop-indicator={position}
      className="pointer-events-none absolute right-0 h-0.5 rounded-full bg-border-focus"
      style={{ left: `${depth * 1.25}rem`, ...(position === 'before' ? { top: '-2px' } : { bottom: '-2px' }) }}
    />
  );
}
