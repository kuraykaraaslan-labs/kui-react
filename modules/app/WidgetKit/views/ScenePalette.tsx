'use client';
// The symbol palette: every symbol of the registry by family and sector, searched by name and alias. (Stub: filled in by the panels work.)
export interface ScenePaletteProps {
  /** Add the symbol at the centre of the view (Enter or double click) or by dragging it onto the canvas (the shell reads `onDragStart`). */
  onAdd: (symbol: string) => void;
  onDragStart?: (symbol: string, event: React.DragEvent | React.PointerEvent) => void;
  recent?: string[];
  locale?: string;
}
export function ScenePalette(_: ScenePaletteProps) { return <div data-stub="palette" />; }
