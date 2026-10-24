'use client';
// The canvas of the process diagram editor: the scene drawn as SVG with everything you do to it with a pointer (select,
// marquee, drag with snapping and guides, ports and connections, resize handles, drawing titles, zones and dividers,
// drop from the palette, zoom and pan) and a focusable stand-in per symbol, shape and connection for the keyboard.
// The state lives in the shell (`SceneEditor.tsx`); every change goes through `apply`, so one drag is one undo step.

import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { isScadaSymbol } from './scada-logic';
import type { SceneHit, SceneModel, SceneSettings, SceneShapeSetting, SceneSide } from './scada-scene-logic';
import {
  addLink, addShape, moveSelection, reconnectLink, resizeShape, setMid, setOwnSize, snapMove, snapPoint, type Guide, type PortRef, type Selection,
} from './scene-edit-logic';
import {
  elementBoxes, linkLegs, marquee, midValue, nearestPort, normalizeRect, pick, portHandles, shapeBounds, shapesOf,
  type Box, type LinkLeg, type PortHit, type Pt,
} from './scene-edit-geometry';
import { fill, type SceneEditorMessages } from './scene-editor-messages-canvas';
import {
  clientToScene, elementAt, fromMarquee, only, ownSizeFromDrag, panBy, pinch, pixelsPerUnit, sceneToLocal, selectionBox, shapeHandles, sizeFromHandle, toggleItem,
  hasItem, thingAt, viewBoxFor, wheelFactor, zoomAt, DEFAULT_SIZE, type ShapeHandle, type Size, type Tool, type ViewBox, type Viewport,
} from './scene-editor-state';
import { SvgTree } from './SvgTree';

const NS = '[vector-effect:non-scaling-stroke]';
/** A pointer must travel this far (screen pixels) before a press becomes a drag. */
const DRAG_PX = 3;
/** The reach of a handle or a port on screen, in pixels. */
const HANDLE_PX = 9;

export type Renaming = { kind: 'element'; id: string } | { kind: 'shape'; index: number };

export interface CanvasHandle {
  focus: () => void;
  /** Cancels a drag in progress (Escape); true when there was one. */
  cancelDrag: () => boolean;
}

export interface SceneEditorCanvasProps {
  settings: SceneSettings;
  /** What is drawn (what-if applied, session-hidden symbols left out). */
  model: SceneModel;
  /** The same scene without rules: every symbol with its box, for hit-testing. */
  geo: SceneModel;
  selection: Selection;
  setSelection: (next: Selection) => void;
  apply: (op: (s: SceneSettings) => import('./scene-edit-logic').EditResult, group?: string) => import('./scene-edit-logic').EditResult;
  tool: Tool;
  setTool: (tool: Tool) => void;
  viewport: Viewport;
  base: ViewBox;
  size: Size;
  onViewport: (next: Viewport) => void;
  onSize: (size: Size) => void;
  grid: boolean;
  guides: boolean;
  linkKind: string;
  locked: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  actionIds?: ReadonlySet<string>;
  m: SceneEditorMessages;
  announce: (message: string) => void;
  /** A symbol was dropped from the palette; the point is snapped. */
  onDropSymbol: (symbol: string, at: Pt) => void;
  /** The last pointer position over the canvas, scene units (null when it left). */
  onPointer?: (p: Pt | null) => void;
  /** A symbol dragged from the palette with a pointer (touch) is being tracked by the shell; the canvas only reports its rectangle. */
  paletteDrag?: { symbol: string } | null;
  renaming: Renaming | null;
  /** Commit the new name: returns a reason when it is refused (the box stays open), or null when done. */
  onRename: (to: string) => string | null;
  onRenameCancel: () => void;
  onRequestRename: (what: Renaming) => void;
  /** An edit group the shell should take back (a drag cancelled with Escape). */
  onCancelGroup: (group: string) => void;
  /** Things from data as drawn: a locked layer, dimmed, never selected or moved (a click only inspects one). */
  things?: readonly SceneHit[];
  /** The thing the inspector shows, outlined on the canvas. */
  inspectedThing?: string | null;
  /** A click on a thing (its id), or on anything else (null). */
  onInspectThing?: (id: string | null) => void;
}

type Drag =
  | { kind: 'pan'; start: Pt; vp: Viewport }
  | { kind: 'pinch'; ids: [number, number]; last: [Pt, Pt] }
  | { kind: 'move'; start: Pt; startClient: Pt; base: SceneSettings; sel: Selection; box: Box; others: Box[]; group: string; moved: boolean; collapseTo: Selection | null; last: SceneSettings }
  | { kind: 'marquee'; start: Pt; additive: boolean; before: Selection }
  | { kind: 'connect'; from: PortPt; reconnect?: { index: number; end: 'from' | 'to'; fixed: Pt; other: string }; target: PortHit | null }
  | { kind: 'draw'; shape: 'zone' | 'divider'; start: Pt; startClient: Pt }
  | { kind: 'resize'; index: number; handle: ShapeHandle; base: SceneSettings; group: string }
  | { kind: 'ownsize'; id: string; anchor: Pt; startPointer: Pt; startScale: number; base: SceneSettings; group: string }
  | { kind: 'mid'; index: number; leg: LinkLeg; base: SceneSettings; group: string };

interface PortPt { id: string; side: SceneSide; at: number; x: number; y: number }

interface Preview {
  guides: Guide[];
  marquee: Box | null;
  link: { from: Pt; to: Pt; target: PortHit | null; fromId: string } | null;
  draw: { kind: 'zone' | 'divider'; box: Box } | null;
}
const NO_PREVIEW: Preview = { guides: [], marquee: null, link: null, draw: null };

let groupCounter = 0;
const nextGroup = (kind: string) => `${kind}:${(groupCounter += 1)}`;

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const elementOf = (s: SceneSettings, id: string): Record<string, unknown> | undefined =>
  (Array.isArray(s.elements) ? s.elements : []).find((e): e is Record<string, unknown> => !!e && typeof e === 'object' && (e as { id?: unknown }).id === id);

export const SceneEditorCanvas = forwardRef<CanvasHandle, SceneEditorCanvasProps>(function SceneEditorCanvas(p, ref) {
  const { settings, model, geo, selection, setSelection, apply, tool, setTool, viewport, base, size, grid, guides, m, announce } = p;
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const space = useRef(false);
  const [preview, setPreview] = useState<Preview>(NO_PREVIEW);
  const [hover, setHover] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [dropping, setDropping] = useState(false);
  const gridId = useId().replace(/:/g, '');

  const vb = viewBoxFor(viewport, base, size);
  const ppu = pixelsPerUnit(viewport, base, size);
  const unit = 1 / ppu;

  // Fresh values for the native wheel listener and the handlers that outlive a render.
  const live = useRef({ viewport, base, size, vb });
  useLayoutEffect(() => { live.current = { viewport, base, size, vb }; });

  const rect = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: DEFAULT_SIZE.w, height: DEFAULT_SIZE.h };
  };
  const toScene = (e: { clientX: number; clientY: number }): Pt => clientToScene({ x: e.clientX, y: e.clientY }, rect(), live.current.vb);

  // Measure the element: the viewport needs its size to show the whole canvas by default.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) p.onSize({ w: r.width, h: r.height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cur = live.current;
      const at = clientToScene({ x: e.clientX, y: e.clientY }, rect(), cur.vb);
      p.onViewport(zoomAt(cur.viewport, cur.base, wheelFactor(e.deltaY, e.ctrlKey), at));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => wrapRef.current?.focus({ preventScroll: true }),
    cancelDrag: () => {
      const d = drag.current;
      if (!d) return false;
      drag.current = null;
      setPreview(NO_PREVIEW);
      setPanning(false);
      if ('group' in d) p.onCancelGroup(d.group);
      return true;
    },
  }));

  const skip = (id: string) => p.locked.has(id) || p.hidden.has(id);
  const reach = HANDLE_PX * unit;

  // ─── Pointer ─────────────────────────────────────────────────────────────

  const capture = (e: ReactPointerEvent) => {
    try { if (typeof svgRef.current?.setPointerCapture === 'function') svgRef.current.setPointerCapture(e.pointerId); } catch { /* not capturable (a synthetic event) */ }
  };

  /** The port a connection would end on at `pt`: a port in reach, else the side of the symbol under the point that is nearest. */
  const targetAt = (pt: Pt, exclude: string[]): PortHit | null => {
    const allowed = geo.hits.map((h) => h.id).filter((id) => !skip(id) && !exclude.includes(id));
    const near = nearestPort(geo, pt, reach * 1.8, { only: allowed, edge: true });
    if (near) return near;
    const body = elementAt(geo, pt, new Set([...exclude, ...geo.hits.map((h) => h.id).filter(skip)]));
    return body ? nearestPort(geo, pt, Infinity, { only: [body] }) : null;
  };

  const startConnect = (port: PortPt, pt: Pt) => {
    drag.current = { kind: 'connect', from: { id: port.id, side: port.side, at: port.at, x: port.x, y: port.y }, target: null };
    setPreview({ ...NO_PREVIEW, link: { from: { x: port.x, y: port.y }, to: pt, target: null, fromId: port.id } });
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    wrapRef.current?.focus({ preventScroll: true });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.entries()];
      drag.current = { kind: 'pinch', ids: [a[0], b[0]], last: [a[1], b[1]] };
      setPreview(NO_PREVIEW);
      return;
    }
    capture(e);
    const client = { x: e.clientX, y: e.clientY };
    const pt = toScene(e);
    if (e.button === 1 || tool === 'pan' || space.current) {
      e.preventDefault();
      drag.current = { kind: 'pan', start: client, vp: viewport };
      setPanning(true);
      return;
    }
    if (e.button !== 0) return;

    const snapped = (q: Pt) => (grid && !e.altKey ? snapPoint(q, { grid: 10, guides: false }) : q);
    if (tool === 'text') {
      const at = snapped(pt);
      const r = apply((s) => addShape(s, 'text', at, { text: m.toolText }));
      if (r.refused) announce(fill(m.refused, { reason: r.refused }));
      else {
        setSelection(only({ kind: 'shape', index: r.index as number }));
        announce(fill(m.addedShape, { kind: m.toolText, x: Math.round(at.x), y: Math.round(at.y) }));
        setTool('select');
        p.onRequestRename({ kind: 'shape', index: r.index as number });
      }
      return;
    }
    if (tool === 'zone' || tool === 'divider') { drag.current = { kind: 'draw', shape: tool, start: snapped(pt), startClient: client }; return; }

    if (tool === 'connect') {
      const near = nearestPort(geo, pt, reach * 1.8, { only: geo.hits.map((h) => h.id).filter((id) => !skip(id)), edge: true });
      const body = near ? null : elementAt(geo, pt, new Set(geo.hits.map((h) => h.id).filter(skip)));
      const port = near ?? (body ? nearestPort(geo, pt, Infinity, { only: [body] }) : null);
      if (port) startConnect(port, pt);
      else setSelection({ elements: [], shapes: [], links: [] });
      return;
    }

    // The select tool. Handles of the single selected thing come first.
    const handle = handleAt(pt);
    if (handle) { startHandleDrag(handle, pt); return; }

    const ports = [...new Set([...(hover ? [hover] : []), ...(selection.elements ?? [])])].filter((id) => !skip(id));
    const hit = pick(geo, settings, pt, { ports: ports.length ? ports : 'none', portRadius: reach });
    if (hit.kind === 'port') {
      const port = portHandles(geo, hit.id).find((h) => h.side === hit.side);
      if (port) { startConnect(port, pt); return; }
    }
    const item = hit.kind === 'element' && !skip(hit.id) ? ({ kind: 'element', id: hit.id } as const)
      : hit.kind === 'shape' ? ({ kind: 'shape', index: hit.index as number } as const)
        : hit.kind === 'link' ? ({ kind: 'link', index: hit.index as number } as const) : null;
    if (!item) {
      // A thing from data is never selected or moved: a click on one only shows it in the inspector.
      const thing = !e.shiftKey && p.things?.length ? thingAt({ hits: [...p.things] }, pt) : null;
      p.onInspectThing?.(thing);
      if (thing) { setSelection({ elements: [], shapes: [], links: [] }); return; }
      drag.current = { kind: 'marquee', start: pt, additive: e.shiftKey, before: selection };
      if (!e.shiftKey) setSelection({ elements: [], shapes: [], links: [] });
      return;
    }
    if (p.inspectedThing) p.onInspectThing?.(null);
    if (e.shiftKey) { setSelection(toggleItem(selection, item)); return; }
    if (item.kind === 'link') { setSelection(only(item)); return; }
    const already = hasItem(selection, item);
    const sel = already ? selection : only(item);
    if (!already) setSelection(sel);
    const boxes = elementBoxes(geo);
    const mine = new Set(sel.elements ?? []);
    const box = selectionBox(sel, geo, settings);
    if (!box) return;
    drag.current = {
      kind: 'move', start: pt, startClient: client, base: settings, sel, box, group: nextGroup('move'), moved: false, last: settings,
      others: [...boxes.entries()].filter(([id]) => !mine.has(id) && !p.hidden.has(id)).map(([, b]) => b),
      collapseTo: already && selectionBoxCount(sel) > 1 ? only(item) : null,
    };
  };

  const selectionBoxCount = (sel: Selection) => (sel.elements?.length ?? 0) + (sel.shapes?.length ?? 0) + (sel.links?.length ?? 0);

  type HandleHit =
    | { kind: 'ownsize'; id: string }
    | { kind: 'shape'; index: number; handle: ShapeHandle }
    | { kind: 'end'; leg: LinkLeg; end: 'from' | 'to' }
    | { kind: 'mid'; leg: LinkLeg };

  const handleAt = (pt: Pt): HandleHit | null => {
    const near = (a: Pt, r = reach * 1.3) => Math.hypot(a.x - pt.x, a.y - pt.y) <= r;
    if (selectionBoxCount(selection) !== 1) return null;
    if (selection.elements?.length === 1) {
      const b = elementBoxes(geo).get(selection.elements[0]);
      if (b && near({ x: b.x + b.w, y: b.y + b.h })) return { kind: 'ownsize', id: selection.elements[0] };
    } else if (selection.shapes?.length === 1) {
      const shape = shapesOf(settings)[selection.shapes[0]] as SceneShapeSetting;
      const h = shape && typeof shape === 'object' ? shapeHandles(shape).find((q) => near(q)) : undefined;
      if (h) return { kind: 'shape', index: selection.shapes[0], handle: h.handle };
    } else if (selection.links?.length === 1) {
      const leg = linkLegs(settings, geo).find((l) => l.index === selection.links?.[0]);
      if (leg) {
        if (leg.handle && near(leg.handle)) return { kind: 'mid', leg };
        if (near(leg.points[0])) return { kind: 'end', leg, end: 'from' };
        if (near(leg.points[leg.points.length - 1])) return { kind: 'end', leg, end: 'to' };
      }
    }
    return null;
  };

  const startHandleDrag = (h: HandleHit, pt: Pt) => {
    if (h.kind === 'ownsize') {
      const el = elementOf(settings, h.id);
      const b = elementBoxes(geo).get(h.id) as Box;
      const centred = settings.anchor !== 'corner';
      drag.current = {
        kind: 'ownsize', id: h.id, anchor: centred ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: b.x, y: b.y }, startPointer: pt,
        startScale: num(el?.scale, 1) > 0 ? num(el?.scale, 1) : 1, base: settings, group: nextGroup('size'),
      };
    } else if (h.kind === 'shape') drag.current = { kind: 'resize', index: h.index, handle: h.handle, base: settings, group: nextGroup('resize') };
    else if (h.kind === 'mid') drag.current = { kind: 'mid', index: h.leg.index, leg: h.leg, base: settings, group: nextGroup('mid') };
    else {
      const fixedEnd = h.end === 'from' ? h.leg.points[h.leg.points.length - 1] : h.leg.points[0];
      const moving = h.end === 'from' ? h.leg.points[0] : h.leg.points[h.leg.points.length - 1];
      const other = h.end === 'from' ? h.leg.to.id : h.leg.from.id;
      const end = h.end === 'from' ? h.leg.from : h.leg.to;
      drag.current = { kind: 'connect', from: { id: end.id, side: end.side, at: end.at, x: moving.x, y: moving.y }, reconnect: { index: h.leg.index, end: h.end, fixed: fixedEnd, other }, target: null };
      setPreview({ ...NO_PREVIEW, link: { from: fixedEnd, to: pt, target: null, fromId: end.id } });
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const client = { x: e.clientX, y: e.clientY };
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, client);
    const pt = toScene(e);
    p.onPointer?.(pt);
    const d = drag.current;

    if (d?.kind === 'pinch') {
      const [i, j] = d.ids;
      const a1 = pointers.current.get(i); const b1 = pointers.current.get(j);
      if (!a1 || !b1) return;
      const r = pinch(d.last[0], d.last[1], a1, b1);
      const cur = live.current;
      const at = clientToScene(r.mid, rect(), cur.vb);
      const zoomed = zoomAt(cur.viewport, cur.base, r.factor, at);
      p.onViewport(panBy(zoomed, cur.base, -r.dx / pixelsPerUnit(zoomed, cur.base, cur.size), -r.dy / pixelsPerUnit(zoomed, cur.base, cur.size)));
      d.last = [a1, b1];
      return;
    }
    if (!d) {
      if (tool === 'select' || tool === 'connect') {
        const id = elementAt(geo, pt, new Set(geo.hits.map((h) => h.id).filter(skip)), reach);
        if (id !== hover) setHover(id);
      } else if (hover) setHover(null);
      return;
    }
    if (d.kind === 'pan') {
      const cur = live.current;
      const k = pixelsPerUnit(d.vp, cur.base, cur.size);
      p.onViewport(panBy(d.vp, cur.base, -(client.x - d.start.x) / k, -(client.y - d.start.y) / k));
      return;
    }
    if (d.kind === 'move') {
      if (!d.moved && Math.hypot(client.x - d.startClient.x, client.y - d.startClient.y) < DRAG_PX) return;
      d.moved = true;
      const free = e.altKey;
      const snap = snapMove(d.box, { x: pt.x - d.start.x, y: pt.y - d.start.y }, { grid: grid && !free ? 10 : false, guides: guides && !free, others: d.others, threshold: Math.max(2, 6 * unit) });
      const r = apply(() => moveSelection(d.base, d.sel, snap.dx, snap.dy), d.group);
      d.last = r.settings;
      setPreview({ ...NO_PREVIEW, guides: snap.guides });
      return;
    }
    if (d.kind === 'marquee') {
      const box = normalizeRect({ x: d.start.x, y: d.start.y, w: pt.x - d.start.x, h: pt.y - d.start.y });
      setPreview({ ...NO_PREVIEW, marquee: box });
      return;
    }
    if (d.kind === 'connect') {
      const exclude = d.reconnect ? [d.reconnect.other] : [d.from.id];
      const target = targetAt(pt, exclude);
      const origin = d.reconnect ? d.reconnect.fixed : { x: d.from.x, y: d.from.y };
      setPreview({ ...NO_PREVIEW, link: { from: origin, to: target ? { x: target.x, y: target.y } : pt, target, fromId: d.from.id } });
      d.target = target;
      return;
    }
    if (d.kind === 'draw') {
      const end = grid && !e.altKey ? snapPoint(pt, { grid: 10, guides: false }) : pt;
      setPreview({ ...NO_PREVIEW, draw: { kind: d.shape, box: drawBox(d.shape, d.start, end) } });
      return;
    }
    if (d.kind === 'resize') {
      const shape = shapesOf(d.base)[d.index] as SceneShapeSetting;
      const patch = sizeFromHandle(shape, d.handle, pt, grid && !e.altKey ? 10 : false);
      apply((s) => resizeShape(s, d.index, patch), d.group);
      return;
    }
    if (d.kind === 'ownsize') {
      const scale = ownSizeFromDrag(d.anchor, d.startPointer, d.startScale, pt);
      apply((s) => setOwnSize(s, d.id, scale), d.group);
      return;
    }
    if (d.kind === 'mid') {
      const raw = midValue(d.leg.handle as NonNullable<LinkLeg['handle']>, pt);
      const v = grid && !e.altKey ? Math.round(raw / 10) * 10 : raw;
      apply((s) => setMid(s, d.index, v), d.group);
    }
  };

  const finish = (e: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.kind === 'pinch') { if (pointers.current.size < 2) drag.current = null; return; }
    if (!d) return;
    drag.current = null;
    setPreview(NO_PREVIEW);
    setPanning(false);
    try { if (typeof svgRef.current?.releasePointerCapture === 'function') svgRef.current.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    if (cancelled) { if ('group' in d) p.onCancelGroup(d.group); return; }
    const pt = toScene(e);

    if (d.kind === 'move') {
      if (!d.moved) { if (d.collapseTo) setSelection(d.collapseTo); return; }
      const ids = d.sel.elements ?? [];
      const count = ids.length + (d.sel.shapes?.length ?? 0);
      const one = count === 1 && ids.length === 1 ? elementOf(d.last, ids[0]) : undefined;
      announce(one ? fill(m.movedOne, { name: String(one.id), x: Math.round(num(one.x)), y: Math.round(num(one.y)) }) : fill(m.movedMany, { count }));
    } else if (d.kind === 'marquee') {
      const box = normalizeRect({ x: d.start.x, y: d.start.y, w: pt.x - d.start.x, h: pt.y - d.start.y });
      if (box.w < unit * DRAG_PX && box.h < unit * DRAG_PX) { announce(m.selectedNone); return; }
      const found = marquee(geo, box, settings);
      const next = fromMarquee(d.before, { elements: found.elements.filter((id) => !skip(id)), shapes: found.shapes }, d.additive);
      setSelection(next);
      const count = selectionBoxCount(next);
      announce(count ? fill(m.selectedMany, { count }) : m.selectedNone);
    } else if (d.kind === 'connect') {
      if (!d.target) return;
      const port: PortRef = { id: d.target.id, side: d.target.side, at: d.target.at };
      if (d.reconnect) {
        const { index, end } = d.reconnect;
        const r = apply((s) => reconnectLink(s, index, end, port));
        announce(r.refused ? fill(m.refused, { reason: r.refused }) : fill(m.reconnected, { name: d.target.id }));
      } else {
        const from: PortRef = { id: d.from.id, side: d.from.side, at: d.from.at };
        const r = apply((s) => addLink(s, from, port, p.linkKind));
        if (r.refused) announce(fill(m.refused, { reason: r.refused }));
        else { setSelection({ elements: [], shapes: [], links: [r.index as number] }); announce(fill(m.connected, { from: d.from.id, to: d.target.id })); }
      }
    } else if (d.kind === 'draw') {
      const end = grid && !e.altKey ? snapPoint(pt, { grid: 10, guides: false }) : pt;
      const moved = Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) >= DRAG_PX;
      const box = drawBox(d.shape, d.start, end);
      const props = moved ? (d.shape === 'zone' ? { w: Math.max(20, box.w), h: Math.max(20, box.h) } : box.w >= box.h ? { w: Math.max(20, box.w), h: 0 } : { w: 0, h: Math.max(20, box.h) }) : {};
      const at = { x: box.x, y: box.y };
      const r = apply((s) => addShape(s, d.shape, at, props));
      if (r.refused) announce(fill(m.refused, { reason: r.refused }));
      else {
        setSelection(only({ kind: 'shape', index: r.index as number }));
        announce(fill(m.addedShape, { kind: d.shape === 'zone' ? m.toolZone : m.toolDivider, x: Math.round(at.x), y: Math.round(at.y) }));
      }
      setTool('select');
    } else if (d.kind === 'resize') announce(fill(m.resized, { name: d.handle === 'end' ? m.toolDivider : m.toolZone }));
    else if (d.kind === 'ownsize') announce(fill(m.resized, { name: d.id }));
    else if (d.kind === 'mid') announce(m.midMoved);
  };

  const onPointerLeave = () => { p.onPointer?.(null); };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== 'select') return;
    const hit = pick(geo, settings, toScene(e), { ports: 'none' });
    if (hit.kind === 'element' && !skip(hit.id)) p.onRequestRename({ kind: 'element', id: hit.id });
    else if (hit.kind === 'shape') {
      const shape = shapesOf(settings)[hit.index as number] as SceneShapeSetting | undefined;
      if (shape && (shape.kind === 'text' || shape.kind === 'zone')) p.onRequestRename({ kind: 'shape', index: hit.index as number });
    }
  };

  // ─── Space pans, drag and drop from the palette ──────────────────────────

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && e.target === wrapRef.current) { space.current = true; e.preventDefault(); }
  };
  const onKeyUp = (e: React.KeyboardEvent) => { if (e.key === ' ') space.current = false; };

  const hasSymbol = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('text/x-scada-symbol') || !!p.paletteDrag;
  const onDragOver = (e: DragEvent) => {
    if (!hasSymbol(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropping) setDropping(true);
  };
  const onDrop = (e: DragEvent) => {
    setDropping(false);
    if (!hasSymbol(e)) return;
    e.preventDefault();
    const symbol = e.dataTransfer.getData('text/x-scada-symbol') || p.paletteDrag?.symbol || '';
    if (!isScadaSymbol(symbol)) return;
    const pt = toScene(e);
    p.onDropSymbol(symbol, grid && !e.altKey ? snapPoint(pt, { grid: 10, guides: false }) : pt);
  };

  // ─── Drawing ─────────────────────────────────────────────────────────────

  const hits = geo.hits;
  const drawnIds = new Set(model.hits.map((h) => h.id));
  const ghosts = hits.filter((h) => !drawnIds.has(h.id) && !p.hidden.has(h.id));
  const legs = linkLegs(settings, geo);
  const shapes = shapesOf(settings);
  const single = selectionBoxCount(selection) === 1;
  const selectedLinks = new Set(selection.links ?? []);
  const portIds = (() => {
    if (tool === 'connect') return hits.map((h) => h.id).filter((id) => !skip(id));
    const ids = new Set<string>([...(hover ? [hover] : []), ...(single ? selection.elements ?? [] : [])]);
    if (preview.link) ids.add(preview.link.fromId);
    return [...ids].filter((id) => !skip(id));
  })();
  const elementName = (id: string) => hits.find((h) => h.id === id)?.name ?? id;
  const showGrid = grid && ppu * 10 >= 4;
  const cursor = panning ? 'cursor-grabbing' : tool === 'pan' ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair';
  const only1 = single && selection.elements?.length === 1 ? elementBoxes(geo).get(selection.elements[0]) : undefined;
  const oneShape = single && selection.shapes?.length === 1 ? (shapes[selection.shapes[0]] as SceneShapeSetting | undefined) : undefined;
  const oneLeg = single && selection.links?.length === 1 ? legs.find((l) => l.index === selection.links?.[0]) : undefined;
  const selectEl = (item: Parameters<typeof only>[0]) => { if (!hasItem(selection, item) || selectionBoxCount(selection) !== 1) setSelection(only(item)); };

  return (
    <div
      ref={wrapRef}
      tabIndex={-1}
      role="group"
      aria-label={m.canvas}
      aria-describedby={`${gridId}-hint`}
      data-testid="scene-canvas"
      className={cn('relative h-full min-h-[18rem] w-full overflow-hidden bg-surface-sunken outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus', dropping && 'ring-2 ring-inset ring-primary')}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <p id={`${gridId}-hint`} className="sr-only">{m.canvasHint}</p>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={cn('block h-full w-full touch-none select-none', cursor)}
        role="presentation"
        data-testid="scene-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <pattern id={`${gridId}-grid`} width={10} height={10} patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" className={cn('stroke-border', NS)} strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={num(settings.width, 1200)} height={num(settings.height, 700)} className={cn('fill-surface-base stroke-border-strong', NS)} strokeWidth={1} strokeDasharray="6 4" />
        {showGrid && <rect x={0} y={0} width={num(settings.width, 1200)} height={num(settings.height, 700)} fill={`url(#${gridId}-grid)`} opacity={0.7} pointerEvents="none" />}

        <g pointerEvents="none" data-layer="scene"><SvgTree nodes={model.nodes} /></g>

        <g pointerEvents="none" data-layer="ghosts">
          {ghosts.map((h) => (
            <g key={h.id} data-ghost={h.id} opacity={0.55}>
              <title>{`${h.id}: ${m.hiddenByRule}`}</title>
              <rect x={h.x} y={h.y} width={h.w} height={h.h} rx={6 * unit} className={cn('fill-surface-raised/40 stroke-text-secondary', NS)} strokeWidth={1} strokeDasharray="4 3" />
            </g>
          ))}
        </g>

        {/* Things from data: a locked layer, dimmed under a veil of the canvas colour; never a keyboard stop or a handle. */}
        {p.things && p.things.length > 0 && (
          <g pointerEvents="none" data-layer="things">
            {p.things.map((h) => (
              <g key={h.id} data-thing={h.id}>
                <title>{fill(m.thingLayer, { name: h.name })}</title>
                <rect x={h.x} y={h.y} width={h.w} height={h.h} rx={6 * unit} className={cn('fill-surface-base stroke-text-secondary', NS)} fillOpacity={0.5} strokeWidth={1} strokeDasharray="2 3" />
                {p.inspectedThing === h.id && <rect data-inspected-thing={h.id} x={h.x - 3 * unit} y={h.y - 3 * unit} width={h.w + 6 * unit} height={h.h + 6 * unit} className={cn('fill-none stroke-border-focus', NS)} strokeWidth={1.5} strokeDasharray="4 3" />}
              </g>
            ))}
          </g>
        )}

        {/* Keyboard stand-ins: one stop per symbol, shape and connection, in draw order. */}
        <g data-layer="focus">
          {hits.filter((h) => !p.hidden.has(h.id)).map((h) => {
            const e = elementOf(settings, h.id);
            const label = fill(m.elementLabel, { name: h.name, symbol: String(e?.symbol ?? ''), x: Math.round(num(e?.x)), y: Math.round(num(e?.y)) });
            return (
              <g key={h.id} role="button" tabIndex={0} aria-label={label} aria-pressed={hasItem(selection, { kind: 'element', id: h.id })} data-element={h.id} className="group outline-none" onFocus={() => selectEl({ kind: 'element', id: h.id })}>
                <rect x={h.x - 2} y={h.y - 2} width={h.w + 4} height={h.h + 4} className={cn('fill-transparent stroke-transparent group-focus-visible:stroke-border-focus', NS)} strokeWidth={2.5} pointerEvents="none" />
              </g>
            );
          })}
          {shapes.map((raw, i) => {
            const b = raw && typeof raw === 'object' ? shapeBounds(raw as SceneShapeSetting) : null;
            if (!b) return null;
            const s = raw as SceneShapeSetting;
            return (
              <g key={`s${i}`} role="button" tabIndex={0} aria-label={fill(m.shapeLabel, { kind: s.kind ?? '', text: s.text ?? '' }).trim()} aria-pressed={hasItem(selection, { kind: 'shape', index: i })} data-shape={i} className="group outline-none" onFocus={() => selectEl({ kind: 'shape', index: i })}>
                <rect x={b.x - 2} y={b.y - 2} width={b.w + 4} height={b.h + 4} className={cn('fill-transparent stroke-transparent group-focus-visible:stroke-border-focus', NS)} strokeWidth={2.5} pointerEvents="none" />
              </g>
            );
          })}
          {legs.map((l) => (
            <g key={`l${l.index}`} role="button" tabIndex={0} aria-label={fill(m.linkLabel, { from: elementName(l.from.id), to: elementName(l.to.id) })} aria-pressed={selectedLinks.has(l.index)} data-link={l.index} className="group outline-none" onFocus={() => selectEl({ kind: 'link', index: l.index })}>
              <polyline points={l.points.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" className={cn('stroke-transparent group-focus-visible:stroke-border-focus', NS)} strokeWidth={4} pointerEvents="none" />
            </g>
          ))}
        </g>

        <g pointerEvents="none" data-layer="overlay">
          {hover && !hasItem(selection, { kind: 'element', id: hover }) && (() => { const b = elementBoxes(geo).get(hover); return b ? <rect x={b.x} y={b.y} width={b.w} height={b.h} className={cn('fill-primary/5 stroke-primary/60', NS)} strokeWidth={1} /> : null; })()}
          {(selection.elements ?? []).map((id) => { const b = elementBoxes(geo).get(id); return b ? <rect key={id} data-selected={id} x={b.x} y={b.y} width={b.w} height={b.h} className={cn('fill-primary/10 stroke-border-focus', NS)} strokeWidth={1.5} /> : null; })}
          {(selection.shapes ?? []).map((i) => { const b = shapeBounds(shapes[i] as SceneShapeSetting); return b ? <rect key={`s${i}`} data-selected-shape={i} x={b.x - 2} y={b.y - 2} width={b.w + 4} height={b.h + 4} className={cn('fill-none stroke-border-focus', NS)} strokeWidth={1.5} strokeDasharray="4 3" /> : null; })}
          {[...selectedLinks].map((i) => { const l = legs.find((q) => q.index === i); return l ? <polyline key={`l${i}`} data-selected-link={i} points={l.points.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" className={cn('stroke-border-focus', NS)} strokeWidth={4} opacity={0.5} strokeLinejoin="round" /> : null; })}

          {p.actionIds && hits.filter((h) => p.actionIds?.has(h.id) && !p.hidden.has(h.id)).map((h) => (
            <circle key={h.id} data-action-dot={h.id} cx={h.x + h.w} cy={h.y} r={5 * unit} className={cn('fill-primary stroke-surface-base', NS)} strokeWidth={1.5}><title>{m.actionDot}</title></circle>
          ))}

          {portIds.flatMap((id) => portHandles(geo, id).map((h) => {
            const target = preview.link?.target;
            const on = target && target.id === h.id && target.side === h.side && target.at === 0.5;
            return <circle key={`${id}.${h.side}`} data-port={`${id}.${h.side}`} cx={h.x} cy={h.y} r={(on ? 6.5 : 4.5) * unit} className={cn(on ? 'fill-primary stroke-surface-base' : 'fill-surface-base stroke-primary', NS)} strokeWidth={1.5} />;
          }))}
          {preview.link?.target && preview.link.target.at !== 0.5 && <circle cx={preview.link.target.x} cy={preview.link.target.y} r={5 * unit} className={cn('fill-primary stroke-surface-base', NS)} strokeWidth={1.5} />}
          {preview.link && <line data-preview="link" x1={preview.link.from.x} y1={preview.link.from.y} x2={preview.link.to.x} y2={preview.link.to.y} className={cn('stroke-border-focus', NS)} strokeWidth={2} strokeDasharray="6 4" />}

          {only1 && <rect data-handle="ownsize" x={only1.x + only1.w - 4 * unit} y={only1.y + only1.h - 4 * unit} width={8 * unit} height={8 * unit} className={cn('fill-surface-base stroke-border-focus', NS)} strokeWidth={1.5}><title>{m.handleOwnSize}</title></rect>}
          {oneShape && shapeHandles(oneShape).map((h) => <rect key={h.handle} data-handle={h.handle} x={h.x - 4 * unit} y={h.y - 4 * unit} width={8 * unit} height={8 * unit} className={cn('fill-surface-base stroke-border-focus', NS)} strokeWidth={1.5}><title>{m.handleResize}</title></rect>)}
          {oneLeg && (
            <>
              {([['from', oneLeg.points[0]], ['to', oneLeg.points[oneLeg.points.length - 1]]] as const).map(([end, q]) => <circle key={end} data-handle={`end-${end}`} cx={q.x} cy={q.y} r={5.5 * unit} className={cn('fill-surface-base stroke-border-focus', NS)} strokeWidth={2}><title>{m.handleReconnect}</title></circle>)}
              {oneLeg.handle && <rect data-handle="mid" x={oneLeg.handle.x - 4 * unit} y={oneLeg.handle.y - 4 * unit} width={8 * unit} height={8 * unit} transform={`rotate(45 ${oneLeg.handle.x} ${oneLeg.handle.y})`} className={cn('fill-primary stroke-surface-base', NS)} strokeWidth={1.5}><title>{m.handleMid}</title></rect>}
            </>
          )}

          {preview.guides.map((g, i) => (
            <line key={i} data-guide={g.axis} x1={g.axis === 'x' ? g.at : g.from} y1={g.axis === 'x' ? g.from : g.at} x2={g.axis === 'x' ? g.at : g.to} y2={g.axis === 'x' ? g.to : g.at} className={cn(g.kind === 'center' ? 'stroke-error' : 'stroke-warning', NS)} strokeWidth={1} strokeDasharray={g.kind === 'center' ? undefined : '3 3'} />
          ))}
          {preview.marquee && <rect data-preview="marquee" {...preview.marquee} width={preview.marquee.w} height={preview.marquee.h} className={cn('fill-primary/10 stroke-border-focus', NS)} strokeWidth={1} strokeDasharray="4 3" />}
          {preview.draw && <rect data-preview="draw" x={preview.draw.box.x} y={preview.draw.box.y} width={preview.draw.box.w} height={preview.draw.box.h} className={cn('fill-primary/5 stroke-border-focus', NS)} strokeWidth={1.5} strokeDasharray="6 4" />}
        </g>
      </svg>
      {p.renaming && <RenameBox {...p} vb={vb} />}
    </div>
  );
});

function drawBox(kind: 'zone' | 'divider', a: Pt, b: Pt): Box {
  const box = normalizeRect({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
  if (kind === 'zone') return box;
  return box.w >= box.h ? { x: box.x, y: a.y, w: box.w, h: 0 } : { x: a.x, y: box.y, w: 0, h: box.h };
}

/** The in-place rename: a text box over the symbol or shape; Enter commits, Escape closes, a refusal stays on screen. */
function RenameBox(p: SceneEditorCanvasProps & { vb: ViewBox }): ReactNode {
  const r = p.renaming as Renaming;
  const initial = r.kind === 'element' ? r.id : String((shapesOf(p.settings)[r.index] as SceneShapeSetting | undefined)?.text ?? '');
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const area = r.kind === 'element' ? elementBoxes(p.geo).get(r.id) : shapeBounds(shapesOf(p.settings)[r.index] as SceneShapeSetting);
  const el = useRef<HTMLInputElement>(null);
  useEffect(() => { el.current?.focus(); el.current?.select(); }, []);
  if (!area) return null;
  const local = sceneToLocal({ x: area.x + area.w / 2, y: area.y + area.h / 2 }, { left: 0, top: 0, width: p.size.w, height: p.size.h }, p.vb);
  const commit = () => { const why = p.onRename(value); if (why) { setError(why); return false; } return true; };
  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: local.x, top: local.y }}>
      <input
        ref={el}
        aria-label={p.m.renameLabel}
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.preventDefault(); p.onRenameCancel(); }
        }}
        onBlur={() => p.onRenameCancel()}
        aria-invalid={error ? true : undefined}
        className="h-8 w-44 rounded-md border border-border bg-surface-base px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      />
      {error && <p role="alert" className="mt-1 max-w-56 rounded-md bg-error-subtle px-2 py-1 text-xs text-error">{error}</p>}
    </div>
  );
}
