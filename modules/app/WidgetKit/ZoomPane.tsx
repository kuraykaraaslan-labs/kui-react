'use client';
// The full-screen view of a picture that zooms (a process diagram). It opens fitted; Ctrl or Cmd + wheel, a pinch, the
// + - 0 keys or the buttons zoom about the pointer (the buttons and keys about the middle). The wheel, the scroll bars or
// a drag move a zoomed picture; a press that does not move stays a click, so a symbol's action still runs.
import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faMagnifyingGlassMinus, faMagnifyingGlassPlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { useKitMessages } from './WidgetKitContext';
import { pinch } from './views/scene-editor-state';
import { clampZoom, scrollForZoom, stepZoom, wheelZoom, zoomKey, zoomPercent, ZOOM_MAX, ZOOM_MIN, type Pt, type Scroll } from './zoom-logic';

/** A press that moves less than this (pixels) is a click, not a drag. */
const DRAG_PX = 4;

export function ZoomPane({ children, className }: { children: ReactNode; className?: string }) {
  const m = useKitMessages().card;
  const hintId = useId();
  const pane = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [panning, setPanning] = useState(false);
  // Fresh values for the native wheel listener and the pointer handlers between renders.
  const zoomRef = useRef(ZOOM_MIN);
  const pointers = useRef(new Map<number, Pt>());
  const drag = useRef<{ id: number; start: Pt; scroll: Scroll; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  const local = (p: { clientX: number; clientY: number } | Pt): Pt => {
    const r = pane.current!.getBoundingClientRect();
    return 'clientX' in p ? { x: p.clientX - r.left, y: p.clientY - r.top } : { x: p.x - r.left, y: p.y - r.top };
  };
  // Reads refs only, so the copy the wheel listener kept from the first render stays right.
  const zoomTo = (to: number, at?: Pt) => {
    const el = pane.current;
    const from = zoomRef.current;
    const next = clampZoom(to);
    if (!el || next === from) return;
    const s = scrollForZoom({ left: el.scrollLeft, top: el.scrollTop }, at ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 }, from, next);
    zoomRef.current = next;
    // The picture must have its new size before the scroll can reach the new spot.
    flushSync(() => setZoom(next));
    el.scrollLeft = s.left;
    el.scrollTop = s.top;
  };

  // Ctrl + wheel zooms instead of the page, so the listener cannot be passive; the wheel alone scrolls as usual.
  useEffect(() => {
    const el = pane.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(wheelZoom(zoomRef.current, e.deltaY, e.deltaMode), local(e));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size > 1) { drag.current = null; return; }
    // A mouse drags only a zoomed picture (there is nothing to move at fit) and only with the main button.
    if (e.pointerType === 'mouse' && (e.button !== 0 || zoomRef.current === ZOOM_MIN)) return;
    const el = pane.current!;
    drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, scroll: { left: el.scrollLeft, top: el.scrollTop }, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(e.pointerId);
    if (!before) return;
    const now = { x: e.clientX, y: e.clientY };
    const el = pane.current!;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.entries()];
      pointers.current.set(e.pointerId, now);
      const r = pinch(a[1], b[1], pointers.current.get(a[0])!, pointers.current.get(b[0])!);
      el.scrollLeft -= r.dx;
      el.scrollTop -= r.dy;
      zoomTo(zoomRef.current * r.factor, local(r.mid));
      swallowClick.current = true;
      return;
    }
    pointers.current.set(e.pointerId, now);
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = now.x - d.start.x;
    const dy = now.y - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      el.setPointerCapture?.(e.pointerId);
      setPanning(true);
    }
    el.scrollLeft = d.scroll.left - dx;
    el.scrollTop = d.scroll.top - dy;
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (drag.current?.id !== e.pointerId) return;
    if (drag.current.moved) { swallowClick.current = true; setPanning(false); }
    drag.current = null;
  };

  const step = (dir: 1 | -1) => zoomTo(stepZoom(zoomRef.current, dir));
  const fit = () => zoomTo(ZOOM_MIN);
  const size = `${zoom * 100}%`;

  return (
    <div className={cn('relative h-full min-h-0', className)} data-part="zoom-pane">
      <div
        ref={pane}
        tabIndex={0}
        role="group"
        aria-label={m.zoomLevel(zoomPercent(zoom))}
        aria-describedby={hintId}
        data-zoom={zoom}
        className={cn(
          'h-full overflow-auto overscroll-contain rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          zoom > ZOOM_MIN && (panning ? 'cursor-grabbing select-none' : 'cursor-grab'),
        )}
        // Touch pans and pinches here, not the page.
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        // The click that ends a drag or a pinch is not a click on a symbol.
        onClickCapture={(e) => { if (swallowClick.current) { swallowClick.current = false; e.preventDefault(); e.stopPropagation(); } }}
        onKeyDown={(e) => {
          const k = zoomKey(e);
          if (!k) return;
          e.preventDefault();
          if (k === 'fit') fit(); else step(k === 'in' ? 1 : -1);
        }}
      >
        <div className="@container" style={{ width: size, height: size }}>{children}</div>
      </div>
      <p id={hintId} className="sr-only">{m.zoomHint}</p>
      <div role="toolbar" aria-label={m.zoom} title={m.zoomHint} className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5 shadow-sm">
        <Button variant="ghost" size="sm" iconOnly disabled={zoom <= ZOOM_MIN} onClick={() => step(-1)} aria-label={m.zoomOut} title={`${m.zoomOut} (-)`}>
          <FontAwesomeIcon icon={faMagnifyingGlassMinus} fixedWidth aria-hidden="true" />
        </Button>
        <span aria-hidden="true" className="min-w-11 px-1 text-center text-xs tabular-nums text-text-secondary" data-part="zoom-level">{zoomPercent(zoom)}%</span>
        <Button variant="ghost" size="sm" iconOnly disabled={zoom >= ZOOM_MAX} onClick={() => step(1)} aria-label={m.zoomIn} title={`${m.zoomIn} (+)`}>
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} fixedWidth aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" iconOnly disabled={zoom <= ZOOM_MIN} onClick={fit} aria-label={m.zoomFit} title={`${m.zoomFit} (0)`}>
          <FontAwesomeIcon icon={faExpand} fixedWidth aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
