'use client';
// The overview of the diagram editor: the whole canvas in miniature with the rectangle the canvas shows now. A click or a
// drag moves the view; the arrow keys do the same from the keyboard.

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import { cn } from '@/libs/utils/cn';
import type { SceneModel, SceneSettings, SceneShapeSetting } from './scada-scene-logic';
import { shapeBounds, shapesOf, unionBox, type Pt } from './scene-edit-geometry';
import { clientToScene, viewBoxFor, type ViewBox } from './scene-editor-state';

export const MINIMAP_SIZE = { w: 160, h: 100 } as const;

export interface SceneMinimapProps {
  settings: SceneSettings;
  geo: Pick<SceneModel, 'hits'>;
  /** The whole canvas with its margin. */
  base: ViewBox;
  /** What the canvas shows now. */
  view: ViewBox;
  onCenter: (point: Pt) => void;
  label: string;
  className?: string;
}

export function SceneMinimap({ settings, geo, base, view, onCenter, label, className }: SceneMinimapProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const region = unionBox([base, view]) as ViewBox;
  const pad = Math.max(region.w, region.h) * 0.04;
  const full: ViewBox = { x: region.x - pad, y: region.y - pad, w: region.w + 2 * pad, h: region.h + 2 * pad };
  const vb = viewBoxFor({ cx: full.x + full.w / 2, cy: full.y + full.h / 2, zoom: 1 }, full, MINIMAP_SIZE);
  const unit = vb.w / MINIMAP_SIZE.w;

  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current?.getBoundingClientRect();
    const rect = r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: MINIMAP_SIZE.w, height: MINIMAP_SIZE.h };
    return clientToScene({ x: e.clientX, y: e.clientY }, rect, vb);
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    try { if (typeof svg.current?.setPointerCapture === 'function') svg.current.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    onCenter(at(e));
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => { if (dragging.current) onCenter(at(e)); };
  const up = () => { dragging.current = false; };
  const key = (e: KeyboardEvent) => {
    const step = Math.max(view.w, view.h) * 0.1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault(); e.stopPropagation();
    onCenter({ x: view.x + view.w / 2 + dx, y: view.y + view.h / 2 + dy });
  };

  return (
    <svg
      ref={svg}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={MINIMAP_SIZE.w}
      height={MINIMAP_SIZE.h}
      role="application"
      aria-label={label}
      tabIndex={0}
      data-testid="scene-minimap"
      className={cn('touch-none rounded-md border border-border bg-surface-raised/90 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus', className)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <rect x={base.x} y={base.y} width={base.w} height={base.h} className="fill-surface-base stroke-border" strokeWidth={unit} />
      {shapesOf(settings).map((raw, i) => {
        const b = raw && typeof raw === 'object' ? shapeBounds(raw as SceneShapeSetting) : null;
        return b ? <rect key={`s${i}`} x={b.x} y={b.y} width={Math.max(b.w, unit)} height={Math.max(b.h, unit)} className="fill-none stroke-text-secondary/60" strokeWidth={unit} /> : null;
      })}
      {geo.hits.map((h) => <rect key={h.id} x={h.x} y={h.y} width={h.w} height={h.h} className="fill-text-secondary/50" />)}
      <rect data-testid="minimap-view" x={view.x} y={view.y} width={view.w} height={view.h} className="fill-primary/10 stroke-border-focus" strokeWidth={1.5 * unit} pointerEvents="none" />
    </svg>
  );
}
