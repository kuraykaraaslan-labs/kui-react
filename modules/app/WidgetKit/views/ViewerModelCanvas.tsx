'use client';
// The `viewer.model` widget's 3D canvas: kui-viewer's React binding, loaded lazily by ViewerModelView
// (never on the server, never in a card that is not shown). Everything kit-specific (sensor markers,
// tooltips, the things' labels, the load and error states) is drawn here as DOM over the viewer's canvas,
// in kit styles; the things themselves are instanced meshes in the viewer's scene (`viewer-things.ts`,
// three.js loaded lazily too, only once there is a thing to draw).
//
// kui-viewer's stylesheet is prefixed (`kuiviewer:` utilities and `--kuiviewer-*` tokens), so it
// does not touch the host's styles; it is imported here, so a board without a 3D card never loads it.
import '@kuraykaraaslan/kui-viewer/styles.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { KUIViewer, ModelLoader, NavCube, useViewer, type KUIViewerProps } from '@kuraykaraaslan/kui-viewer/react';
import { cn } from '@/libs/utils/cn';
import { useKitMessages } from '../WidgetKitContext';
import type { ModelSource } from './ViewerModelView';
import { ViewerStatus } from './ViewerModelView';
import {
  cameraForTarget, MAX_THING_LABELS, viewerViewKey, type Row, type SensorMarker, type ThingMarker, type ViewerModelSettings, type ViewerView,
} from './viewer-model-logic';
import { useReducedMotion } from './useReducedMotion';
import {
  disposeThingMeshes, hasPulsingThings, nearestThings, newThingMeshState, pickThing, pulseThingMeshes, syncThingMeshes,
  type PickSceneLike, type ThingMeshState, type ThreeLib,
} from './viewer-things';

type Viewer = Parameters<NonNullable<KUIViewerProps['onReady']>>[0];

// The few parts of the viewer this widget touches, typed structurally (three.js types are not a
// dependency of the kit, and this keeps the widget independent of kui-viewer's internals).
interface Vec3 { x: number; y: number; z: number; set(x: number, y: number, z: number): Vec3; project(camera: unknown): Vec3; clone(): Vec3 }
interface ViewerLike {
  scene: { background: unknown; children: Array<{ position: Vec3 }>; add(object: object): unknown; remove(object: object): unknown };
  camera: { position: Vec3; fov: number; aspect: number; updateMatrixWorld(): void; matrixWorld: { elements: ArrayLike<number> } };
  controls: { enabled: boolean; enableZoom?: boolean; target?: Vec3; update?: () => void };
  renderer: { domElement: HTMLCanvasElement };
  /** The origin shift (scene = world − global); `onChange` fires when a model sets it or a re-tile moves it. */
  rtc: { global: Vec3; onChange?: (listener: () => void) => () => void };
  invalidate(source?: string): void;
}
const asLike = (v: Viewer) => v as unknown as ViewerLike;

/** A CSS colour (a token like `var(--surface-base)` included) as `#rrggbb`, read back from a 1px canvas. */
export function resolveCssColor(css: string, host: Element): string | null {
  const probe = document.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const ctx = document.createElement('canvas').getContext('2d');
  if (!computed || !ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillStyle = computed;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** View directions (world, Y up) of the start views; the IFC front is its south side (−Y), i.e. +Z here. */
const PRESET_DIR: Record<NonNullable<ViewerModelSettings['cameraPreset']>, [number, number, number]> = {
  iso: [1, 0.75, 1],
  top: [0, 1, 0.0001],
  front: [0, 0.12, 1],
};

/** Centre and size of the loaded models, from their element centroids (scene frame). */
function modelBounds(handles: Iterable<{ globalIdToCentroid: Map<string, { x: number; y: number; z: number }> }>) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const h of handles) {
    for (const c of h.globalIdToCentroid.values()) {
      const p = [c.x, c.y, c.z];
      for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; }
    }
  }
  if (!Number.isFinite(min[0])) return null;
  return { center: min.map((v, i) => (v + max[i]) / 2) as [number, number, number], size: max.map((v, i) => v - min[i]) as [number, number, number] };
}

/** Look at the bounds from `dir`, far enough that they fit both ways of the canvas. */
function fitCamera(viewer: ViewerLike, bounds: NonNullable<ReturnType<typeof modelBounds>>, dir: [number, number, number]) {
  const { camera, controls } = viewer;
  const len = Math.hypot(...dir) || 1;
  const d = dir.map((v) => v / len);
  const radius = Math.max(1, Math.hypot(...bounds.size) / 2);
  const vfov = (camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (camera.aspect || 1));
  const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.68;
  const [cx, cy, cz] = bounds.center;
  camera.position.set(cx + d[0] * dist, cy + d[1] * dist, cz + d[2] * dist);
  controls.target?.set(cx, cy, cz);
  controls.update?.();
  viewer.invalidate('widget-kit:fit');
}

/**
 * Points the camera for a patch's view: a preset looks at the models (or, with none loaded, at the current orbit
 * centre from the current distance) from that side; a target and a distance put the orbit centre on the target and
 * the camera that far from it, keeping the current direction. Scene = world − the viewer's origin shift.
 */
function aimCamera(viewer: ViewerLike, view: ViewerView, bounds: ReturnType<typeof modelBounds>, coordinates: ViewerModelSettings['coordinates']) {
  const { camera, controls } = viewer;
  const t = controls.target;
  const current: [number, number, number] = t ? [camera.position.x - t.x, camera.position.y - t.y, camera.position.z - t.z] : [1, 0.75, 1];
  if ('preset' in view) {
    if (bounds) { fitCamera(viewer, bounds, PRESET_DIR[view.preset] ?? PRESET_DIR.iso); return; }
    if (!t) return;
    const dist = Math.hypot(...current) || 10;
    const d = PRESET_DIR[view.preset] ?? PRESET_DIR.iso;
    const len = Math.hypot(...d) || 1;
    camera.position.set(t.x + (d[0] / len) * dist, t.y + (d[1] / len) * dist, t.z + (d[2] / len) * dist);
  } else {
    const g = viewer.rtc.global;
    const aim = cameraForTarget(view.target, view.distance, current, coordinates);
    camera.position.set(aim.position[0] - g.x, aim.position[1] - g.y, aim.position[2] - g.z);
    t?.set(aim.target[0] - g.x, aim.target[1] - g.y, aim.target[2] - g.z);
  }
  controls.update?.();
  viewer.invalidate('widget-kit:patch-view');
}

/**
 * kui-viewer (≤ 0.3.x) listens for hotkeys on the whole window, in the capture phase, and swallows
 * Escape and its shortcuts wherever focus is: on a board, Escape would no longer close a dialog or a
 * menu. A widget is one card among many, so the viewer's window-wide keyboard is switched off (the
 * canvas' own arrow-key navigation stays). Guarded: a viewer without that internal is left alone.
 */
function detachWindowHotkeys(viewer: Viewer) {
  const kbd = (viewer as unknown as { input?: { kbd?: { dispose?: () => void } } }).input?.kbd;
  if (typeof kbd?.dispose === 'function') kbd.dispose();
}

/**
 * kui-viewer 0.3.32 disposes a model's meshes with `geometry.disposeBoundsTree()`, a method three-mesh-bvh
 * adds to three's BufferGeometry prototype, but that package does not patch the prototype itself (fixed in
 * later kui-viewer). Unloading a model (closing full screen, leaving the board, editing the list) then
 * throws inside React's cleanup and takes the page down. The missing method is added with three-mesh-bvh's
 * own meaning (forget the tree); a viewer that already has it is untouched.
 */
function ensureBvhDispose(handle: { meshes?: Array<{ geometry?: object }> }) {
  for (const mesh of handle.meshes ?? []) {
    const proto = mesh.geometry ? Object.getPrototypeOf(mesh.geometry) as Record<string, unknown> | null : null;
    if (proto && typeof proto.disposeBoundsTree !== 'function') {
      proto.disposeBoundsTree = function disposeBoundsTree(this: { boundsTree?: unknown }) { this.boundsTree = null; };
    }
  }
}

/** Orbit, pan and zoom on or off; the wheel zooms only with `wheel` (else it scrolls the page). */
function setInteraction(viewer: ViewerLike, enabled: boolean, wheel: boolean) {
  const controls = viewer.controls;
  controls.enabled = enabled;
  if ('enableZoom' in controls) controls.enableZoom = wheel;
}

/** What a frame of the overlays depends on: the camera, the canvas size and the origin shift. */
function frameKey(v: ViewerLike, w: number, h: number): string {
  const g = v.rtc.global;
  return `${Array.prototype.join.call(v.camera.matrixWorld.elements, ',')}|${w}x${h}|${g.x},${g.y},${g.z}`;
}

/** Moves an overlay node to a projected point (NDC) on a canvas of `w` × `h` px, hiding it when off screen. */
function placeNode(el: HTMLElement, p: Vec3, w: number, h: number): boolean {
  const inView = p.z > -1 && p.z < 1 && Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05;
  el.style.visibility = inView ? 'visible' : 'hidden';
  el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px)`;
  return inView;
}

type Handle = Parameters<NonNullable<ComponentProps<typeof ModelLoader>['onLoad']>>[0];

/** Loads one model into the viewer (headless) and reports the outcome. */
function ModelSlot({ url, onDone }: { url: string; onDone: (url: string, result: Handle | Error) => void }) {
  const onLoad = useCallback((h: Handle) => onDone(url, h), [url, onDone]);
  const onError = useCallback((e: Error) => onDone(url, e), [url, onDone]);
  return <ModelLoader source={url} onLoad={onLoad} onError={onError} />;
}

/** Background, grid, camera and interaction: the settings that act on the live viewer; and a patch's view. */
function SceneSync({ settings, dark, host, handles, settled, view }: {
  settings: ViewerModelSettings;
  dark: boolean;
  host: HTMLElement | null;
  handles: Map<string, Handle>;
  settled: boolean;
  view?: ViewerView | null;
}) {
  const viewer = asLike(useViewer());

  // Background: the setting, or the theme's surface (re-read when the theme flips).
  useEffect(() => {
    if (!host) return;
    const bg = viewer.scene.background as { isColor?: boolean; set?: (c: string) => void } | null;
    const hex = resolveCssColor(settings.background || 'var(--surface-raised)', host);
    if (hex && bg?.isColor && bg.set) {
      bg.set(hex);
      viewer.invalidate('widget-kit:background');
    }
  }, [viewer, settings.background, dark, host]);

  // Interaction: locked = no orbit, pan or zoom; the wheel zooms only when asked to.
  useEffect(() => {
    setInteraction(viewer, settings.interactive !== false, settings.scrollZoom === true);
  }, [viewer, settings.interactive, settings.scrollZoom]);

  // Start view: fitted to the models once every model has loaded or failed.
  const preset = settings.cameraPreset ?? 'iso';
  const autoFit = settings.autoFitOnLoad !== false;
  useEffect(() => {
    if (!settled || !autoFit) return;
    const bounds = modelBounds(handles.values());
    if (bounds) fitCamera(viewer, bounds, PRESET_DIR[preset] ?? PRESET_DIR.iso);
  }, [viewer, settled, autoFit, preset, handles]);

  // A patch's view: applied once the models settle and again only when the view itself changes (its key), never per
  // frame, so the viewer can orbit away from it in between. Declared after the start view, so it wins over a refit.
  const viewKey = viewerViewKey(view ?? null);
  const stableView = useMemo<ViewerView | null>(() => (viewKey ? (JSON.parse(viewKey) as ViewerView) : null), [viewKey]);
  useEffect(() => {
    if (!settled || !stableView) return;
    aimCamera(viewer, stableView, modelBounds(handles.values()), settings.coordinates);
  }, [viewer, settled, stableView, handles, settings.coordinates]);

  // Ground grid: kui-viewer's own helpers (same three.js instance as the viewer), under the models.
  useEffect(() => {
    if (!settings.showGrid || !settled || !host) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    import('@kuraykaraaslan/kui-viewer').then((m) => {
      if (cancelled) return;
      const scene = viewer.scene;
      const before = new Set(scene.children);
      const bounds = modelBounds(handles.values());
      const span = bounds ? Math.max(bounds.size[0], bounds.size[2]) : 50;
      const size = Math.max(10, Math.ceil((span * 1.4) / 10) * 10);
      m.addGridHelpers(scene as never, {
        size, divisions: Math.min(100, size / 5),
        colorMajor: resolveCssColor('var(--border)', host) ?? '#cccccc',
        colorMinor: resolveCssColor('color-mix(in srgb, var(--border) 50%, transparent)', host) ?? '#e5e5e5',
      });
      const floor = bounds ? bounds.center[1] - bounds.size[1] / 2 : 0;
      for (const child of scene.children) {
        if (before.has(child)) continue;
        child.position.set(bounds?.center[0] ?? 0, floor - 0.05, bounds?.center[2] ?? 0);
      }
      viewer.invalidate('widget-kit:grid');
      remove = () => { m.removeHelpers(scene as never); viewer.invalidate('widget-kit:grid'); };
    }).catch(() => { /* no grid is not an error worth a state */ });
    return () => { cancelled = true; remove?.(); };
  }, [viewer, settings.showGrid, settled, host, handles, dark]);

  return null;
}

/** Sensor markers: DOM over the canvas, moved with the camera every frame it changes. A click reports the marker's row. */
function SensorOverlay({ viewer, sensors, settings, onMarkerClick }: {
  viewer: Viewer | null;
  sensors: SensorMarker[];
  settings: ViewerModelSettings;
  onMarkerClick?: (row: Row) => void;
}) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const dirty = useRef(true);
  const [active, setActive] = useState<string | null>(null);
  const trigger = settings.tooltipTrigger ?? 'hover';
  const defaultSize = typeof settings.markerSize === 'number' ? settings.markerSize : 14;
  const showLabels = settings.showSensorLabels !== false;
  const content = settings.labelContent ?? 'both';
  const pulse = settings.pulseAlarms !== false;

  useLayoutEffect(() => { dirty.current = true; });

  useEffect(() => {
    if (!viewer) return;
    const v = asLike(viewer);
    const p = v.camera.position.clone();
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = v.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const g = v.rtc.global;
      v.camera.updateMatrixWorld();
      const key = frameKey(v, w, h);
      if (key === last && !dirty.current) return;
      last = key;
      dirty.current = false;
      for (const s of sensors) {
        const el = nodes.current.get(s.id);
        if (!el) continue;
        p.set(s.position[0] - g.x, s.position[1] - g.y, s.position[2] - g.z).project(v.camera);
        placeNode(el, p, w, h);
        // Nearer markers draw over farther ones.
        el.style.zIndex = active === s.id ? '30' : String(10 + Math.round((1 - p.z) * 1000));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewer, sensors, active]);

  if (!viewer || sensors.length === 0) return null;
  return (
    <div data-part="sensors" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {sensors.map((s) => {
        const open = active === s.id && trigger !== 'none';
        const size = s.size ?? defaultSize;
        const text = content === 'label' ? s.label : content === 'value' ? s.valueText : [s.label, s.valueText].filter(Boolean).join(' · ');
        const dot: CSSProperties = { width: size, height: size, background: s.color, boxShadow: `0 0 0 2px var(--surface-base), 0 1px 4px rgb(0 0 0 / 0.35)` };
        return (
          <div key={s.id} ref={(el) => { if (el) nodes.current.set(s.id, el); else nodes.current.delete(s.id); }}
            data-sensor={s.id} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
            <button
              type="button"
              aria-label={[s.tooltip.title, s.valueText, s.tooltip.description].filter(Boolean).join(', ')}
              aria-expanded={trigger === 'click' ? open : undefined}
              className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={dot}
              onMouseEnter={trigger === 'hover' ? () => setActive(s.id) : undefined}
              onMouseLeave={trigger === 'hover' ? () => setActive((a) => (a === s.id ? null : a)) : undefined}
              onFocus={() => setActive(s.id)}
              onBlur={() => setActive((a) => (a === s.id ? null : a))}
              onClick={trigger === 'click' || onMarkerClick ? () => {
                // The tooltip toggles as before; the host hears about the click as well.
                if (trigger === 'click') setActive((a) => (a === s.id ? null : s.id));
                onMarkerClick?.(s.row);
              } : undefined}
            >
              {s.alarm && pulse && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: s.color }} />}
            </button>
            {showLabels && text && !open && (
              <span aria-hidden="true" data-part="sensor-label"
                className="absolute left-0 top-0 whitespace-nowrap rounded-md border border-border bg-surface-raised/90 px-1.5 py-0.5 text-[11px] font-medium leading-4 tabular-nums text-text-primary shadow-sm backdrop-blur-sm"
                style={{ transform: `translate(${size / 2 + 6}px, -50%)` }}>
                {text}
              </span>
            )}
            {open && (
              <div role="tooltip" data-part="sensor-tooltip"
                className="pointer-events-none absolute left-0 top-0 min-w-40 max-w-64 rounded-lg border border-border bg-surface-raised px-3 py-2 shadow-md"
                style={{ transform: `translate(${size / 2 + 8}px, -50%)` }}>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-xs font-semibold text-text-primary">{s.tooltip.title}</span>
                </div>
                {s.tooltip.description && <div className="mt-0.5 text-[11px] text-text-secondary">{s.tooltip.description}</div>}
                {s.tooltip.fields.length > 0 && (
                  <dl className="mt-1.5 flex flex-col gap-0.5">
                    {s.tooltip.fields.map((f) => (
                      <div key={f.label} className="flex items-baseline justify-between gap-3 text-[11px] leading-4">
                        <dt className="shrink-0 text-text-secondary">{f.label}</dt>
                        <dd className="m-0 min-w-0 text-right font-medium tabular-nums text-text-primary">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The things' labels: DOM for the nearest `MAX_THING_LABELS` labelled things, placed just above each shape every frame the camera changes. */
function ThingLabels({ viewer, things }: { viewer: Viewer; things: ThingMarker[] }) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const dirty = useRef(true);
  const [shown, setShown] = useState<ThingMarker[]>([]);

  useLayoutEffect(() => { dirty.current = true; });

  useEffect(() => {
    const v = asLike(viewer);
    const p = v.camera.position.clone();
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const canvas = v.renderer.domElement;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const g = v.rtc.global;
      v.camera.updateMatrixWorld();
      const key = frameKey(v, w, h);
      if (key === last && !dirty.current) return;
      last = key;
      dirty.current = false;
      // The nearest set changes with the camera: a new set renders first, and is placed on the next frame.
      const near = nearestThings(things, v.camera.position, g, MAX_THING_LABELS);
      if (near.length !== shown.length || near.some((t, i) => t !== shown[i])) { setShown(near); return; }
      for (const t of near) {
        const el = nodes.current.get(t.id);
        if (!el) continue;
        p.set(t.position[0] - g.x, t.position[1] - g.y + t.size, t.position[2] - g.z).project(v.camera);
        placeNode(el, p, w, h);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [viewer, things, shown]);

  if (shown.length === 0) return null;
  return (
    <div data-part="things" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {shown.map((t) => (
        <div key={t.id} ref={(el) => { if (el) nodes.current.set(t.id, el); else nodes.current.delete(t.id); }}
          data-thing={t.id} className="absolute left-0 top-0" style={{ visibility: 'hidden' }}>
          <span aria-hidden="true" data-part="thing-label"
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface-raised/90 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-text-primary shadow-sm backdrop-blur-sm">
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A pointer that travels further, or stays down longer, is an orbit, not a click on a thing. */
const CLICK_PX = 6;
const CLICK_MS = 600;

/**
 * The things: one instanced mesh per kind in the viewer's scene, written in place as the rows change, the alarm ones
 * pulsing, a click on a shape reported to the host with the thing's row, and a DOM label over the nearest ones.
 */
function ThingsLayer({ viewer, things, host, dark, showLabels, onMarkerClick }: {
  viewer: Viewer | null;
  things: ThingMarker[];
  host: HTMLElement | null;
  dark: boolean;
  showLabels: boolean;
  onMarkerClick?: (row: Row) => void;
}) {
  const [three, setThree] = useState<ThreeLib | null>(null);
  const state = useRef<ThingMeshState>(newThingMeshState());
  const colorCache = useRef(new Map<string, string | null>());
  const [originTick, setOriginTick] = useState(0);
  const reduced = useReducedMotion();

  // three.js (the viewer's own copy) comes in once there is a thing to draw, never before.
  useEffect(() => {
    if (three || things.length === 0) return;
    let on = true;
    import('three').then((m) => { if (on) setThree(m); }).catch(() => { /* no three: the markers still draw, the things do not */ });
    return () => { on = false; };
  }, [three, things.length]);

  // The viewer's origin shift (set when the first model loads, moved by a re-tile): the instances follow it.
  useEffect(() => {
    if (!viewer) return;
    return asLike(viewer).rtc.onChange?.(() => setOriginTick((n) => n + 1));
  }, [viewer]);

  // A colour resolves once per CSS text and theme (a token's value flips with the theme).
  useEffect(() => {
    colorCache.current = new Map();
    state.current.colors.clear();
  }, [host, dark]);

  // The meshes follow the things, the origin and the theme.
  useEffect(() => {
    if (!three || !viewer || !host) return;
    const v = asLike(viewer);
    syncThingMeshes(three, v.scene, state.current, things, v.rtc.global, (css) => {
      const cached = colorCache.current.get(css);
      if (cached !== undefined) return cached;
      const hex = resolveCssColor(css, host);
      colorCache.current.set(css, hex);
      return hex;
    });
    v.invalidate('widget-kit:things');
  }, [three, viewer, host, things, dark, originTick]);

  // Everything out of the scene when the layer goes.
  useEffect(() => {
    if (!three || !viewer) return;
    const v = asLike(viewer);
    const st = state.current;
    return () => { disposeThingMeshes(v.scene, st); v.invalidate('widget-kit:things'); };
  }, [three, viewer]);

  // The pulse: the alarm things breathe in size, unless the viewer asks for reduced motion.
  useEffect(() => {
    if (!three || !viewer || reduced || !hasPulsingThings(state.current)) return;
    const v = asLike(viewer);
    const st = state.current;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (pulseThingMeshes(three, st, v.rtc.global, 1 + 0.12 * Math.sin(now / 250))) v.invalidate('widget-kit:things');
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (pulseThingMeshes(three, st, v.rtc.global, 1)) v.invalidate('widget-kit:things');
    };
  }, [three, viewer, things, reduced, originTick]);

  // A click on a shape (not an orbit drag) reports the thing's row.
  useEffect(() => {
    if (!three || !viewer || !onMarkerClick) return;
    const v = asLike(viewer);
    const canvas = v.renderer.domElement;
    let down: { x: number; y: number; at: number } | null = null;
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_PX || performance.now() - start.at > CLICK_MS) return;
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ndc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      // The whole scene is cast, so a thing behind the model's walls is not reported for a click that landed on them.
      const id = pickThing(three, v.camera as unknown as Parameters<typeof pickThing>[1], state.current, ndc, v.scene as unknown as PickSceneLike);
      const hit = id === null ? undefined : things.find((t) => t.id === id);
      if (hit) onMarkerClick(hit.row);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [three, viewer, things, onMarkerClick]);

  if (!viewer || !showLabels || things.length === 0) return null;
  return <ThingLabels viewer={viewer} things={things} />;
}

export interface ViewerModelCanvasProps {
  models: ModelSource[];
  sensors: SensorMarker[];
  /** The things after the rules (an empty list draws none and never loads three.js). */
  things: ThingMarker[];
  settings: ViewerModelSettings;
  dark: boolean;
  /** A sensor marker or a thing was clicked: the host gets its row. */
  onMarkerClick?: (row: Row) => void;
  /** A scene patch's camera (a preset, or a target and a distance), applied when it changes. */
  view?: ViewerView | null;
}

/** The live viewer, its models, the things and the sensor overlay. The viewer is disposed when this unmounts. */
export function ViewerModelCanvas({ models, sensors, things, settings, dark, onMarkerClick, view }: ViewerModelCanvasProps) {
  const texts = useKitMessages().viewer;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [outcome, setOutcome] = useState<Map<string, Handle | Error>>(() => new Map());
  const onReady = useCallback((v: Viewer) => {
    detachWindowHotkeys(v);
    setViewer(v);
  }, []);
  const onDone = useCallback((url: string, result: Handle | Error) => {
    if (!(result instanceof Error)) ensureBvhDispose(result as never);
    setOutcome((prev) => new Map(prev).set(url, result));
  }, []);

  const handles = useMemo(() => {
    const out = new Map<string, Handle>();
    for (const [u, r] of outcome) if (!(r instanceof Error) && models.some((m) => m.url === u)) out.set(u, r);
    return out;
  }, [outcome, models]);
  const failed = models.filter((m) => outcome.get(m.url) instanceof Error);
  const done = models.filter((m) => outcome.has(m.url)).length;
  const settled = !!viewer && done === models.length;
  const allFailed = models.length > 0 && failed.length === models.length;
  const navCube = settings.showNavCube !== false && settings.interactive !== false;

  return (
    // The viewer's own chrome (toolbars, command line, modal layer) is not part of a widget: hidden.
    <div ref={setHost} data-theme={dark ? 'dark' : 'light'}
      className="absolute inset-0 [&_[data-kui-modal-layer]]:hidden! [&_[data-kui-overlay]]:hidden!">
      <KUIViewer className="h-full w-full" onReady={onReady} pixelRatioCap={2}>
        {models.map((m) => <ModelSlot key={m.url} url={m.url} onDone={onDone} />)}
        <SceneSync settings={settings} dark={dark} host={host} handles={handles} settled={settled} view={view} />
        {navCube && (
          <div data-part="navcube" className="absolute right-1 top-1 z-20 h-24 w-24 origin-top-right scale-[0.7] [&>div]:h-full [&>div]:w-full">
            <NavCube />
          </div>
        )}
      </KUIViewer>
      <SensorOverlay viewer={viewer} sensors={sensors} settings={settings} onMarkerClick={onMarkerClick} />
      <ThingsLayer viewer={viewer} things={things} host={host} dark={dark} showLabels={settings.showThingLabels !== false} onMarkerClick={onMarkerClick} />
      {!settled && models.length > 0 && (
        <ViewerStatus kind="loading" className="pointer-events-none bg-transparent"
          text={models.length > 1 ? texts.loadingModels(done, models.length) : texts.loadingModel} />
      )}
      {settled && allFailed && (
        <ViewerStatus kind="error" text={texts.loadFailed(models.length, (outcome.get(failed[0].url) as Error).message)} />
      )}
      {settled && !allFailed && failed.length > 0 && (
        <div role="status" data-part="viewer-partial"
          className={cn('pointer-events-none absolute left-2 top-2 z-20 rounded-md border border-border bg-surface-raised/90 px-2 py-1 text-[11px] text-text-secondary shadow-sm')}>
          {texts.notLoaded(failed.map((f) => f.label).join(', '))}
        </div>
      )}
    </div>
  );
}
