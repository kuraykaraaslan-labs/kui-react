'use client';
// modules/ui/TreeView/parts/DragPreview.tsx
//
// The chip that follows the pointer while dragging (M2): the dragged node's
// label and, for several nodes, their count. Portalled to the document body so
// no transformed or clipped ancestor moves or cuts it. Its position is written
// straight to `style.transform` by `useTreeDnD` on every pointer move, so the
// tree does not re-render per pixel.

import { createPortal } from 'react-dom';

export type DragPreviewProps = {
  label: string;
  count: number;
  x: number;
  y: number;
  container: HTMLElement;
  previewRef: React.RefObject<HTMLDivElement | null>;
};

export function DragPreview({ label, count, x, y, container, previewRef }: DragPreviewProps) {
  return createPortal(
    <div
      ref={previewRef}
      aria-hidden="true"
      data-tree-drag-preview
      className="pointer-events-none fixed left-0 top-0 z-[80] flex max-w-[16rem] items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-sm text-text-primary shadow-lg"
      style={{ transform: `translate(${x + 12}px, ${y + 12}px)` }}
    >
      <span className="truncate">{label}</span>
      {count > 1 && (
        <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-fg">{count}</span>
      )}
    </div>,
    container,
  );
}
