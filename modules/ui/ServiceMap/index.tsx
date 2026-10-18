'use client';
// modules/ui/ServiceMap/index.tsx
//
// ServiceMap — services as nodes and calls as edges on a deterministic layered layout (./layout.ts, no graph
// library). Rate / error / latency badges on nodes and edges, pan and zoom (drag, Ctrl + wheel, buttons, keys),
// roving-focus keyboard navigation along the call graph, a node selection slot. Errors are never colour alone:
// a warning icon plus the error percentage, a heavier border and a dashed edge.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassMinus, faMagnifyingGlassPlus, faExpand, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { ResponsiveContainer } from '../Chart/primitives/ResponsiveContainer';
import { fillMessage, formatCompact, formatDurationMs, formatPercent } from '../_shared/format';
import { isRtlElement } from '../_shared/dom';
import { layoutServiceMap, neighbours, type MapLayout, type PlacedEdge, type PlacedNode } from './layout';

export { layoutServiceMap } from './layout';
export type { MapLayout, PlacedNode, PlacedEdge, LayoutOptions } from './layout';

export type ServiceHealth = 'ok' | 'warn' | 'error' | 'unknown';

export type ServiceNode = {
  id: string;
  name: string;
  /** `service`, `database`, `queue`, `cache`, `external`... shown as a caption. */
  kind?: string;
  /** Requests per second. */
  rate?: number;
  /** Fraction of failed requests, 0..1. */
  errorRate?: number;
  /** A representative latency (p95) in ms. */
  latencyMs?: number;
  /** Explicit health; otherwise derived from `errorRate` and `errorThresholds`. */
  status?: ServiceHealth;
};

export type ServiceEdge = {
  id?: string;
  from: string;
  to: string;
  rate?: number;
  errorRate?: number;
  latencyMs?: number;
};

export type ServiceMapMessages = {
  label: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  hint: string;
  empty: string;
  /** `{value}` */
  rate: string;
  /** `{value}` */
  errors: string;
  /** `{value}` */
  latency: string;
  status: Record<ServiceHealth, string>;
  selection: string;
  upstream: string;
  downstream: string;
  none: string;
  clearSelection: string;
  /** `{name}`, `{status}`, `{metrics}`, `{calls}` */
  nodeLabel: string;
  /** `{from}`, `{to}`, `{metrics}` */
  edgeLabel: string;
};

export const DEFAULT_SERVICE_MAP_MESSAGES: ServiceMapMessages = {
  label: 'Service map',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit to view',
  hint: 'Drag to pan, Ctrl + scroll to zoom. Arrow keys move along calls, Enter selects.',
  empty: 'No services to show.',
  rate: '{value} req/s',
  errors: '{value} errors',
  latency: 'p95 {value}',
  status: { ok: 'healthy', warn: 'degraded', error: 'failing', unknown: 'no data' },
  selection: 'Selected service',
  upstream: 'Called by',
  downstream: 'Calls',
  none: 'none',
  clearSelection: 'Clear selection',
  nodeLabel: '{name}, {status}{metrics}{calls}',
  edgeLabel: '{from} to {to}{metrics}',
};

export type ServiceMapProps = {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  /** Controlled selection by node id. */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (node: ServiceNode | null) => void;
  /** Replaces the default panel under the map for the selected service. `false` hides it. */
  renderSelection?: ((node: ServiceNode, ctx: { incoming: ServiceEdge[]; outgoing: ServiceEdge[] }) => React.ReactNode) | false;
  /** Error-rate fractions that make a node degraded / failing when `status` is not given. Default = 1 % / 5 %. */
  errorThresholds?: { warn: number; error: number };
  /** Height of the map in px. Default = 420. */
  height?: number;
  /** Layout direction. Default = read from the page (`dir`). */
  direction?: 'ltr' | 'rtl';
  /** Hide the zoom buttons and the hint. */
  hideControls?: boolean;
  messages?: Partial<ServiceMapMessages>;
  className?: string;
};

const NODE_W = 184;
const NODE_H = 64;
const MIN_K = 0.25;
const MAX_K = 2.5;

type View = { x: number; y: number; k: number };

export function healthOf(node: Pick<ServiceNode, 'status' | 'errorRate'>, t: { warn: number; error: number }): ServiceHealth {
  if (node.status) return node.status;
  if (node.errorRate === undefined) return 'unknown';
  if (node.errorRate >= t.error) return 'error';
  if (node.errorRate >= t.warn) return 'warn';
  return 'ok';
}

/** The viewport transform that fits a drawing of `w` x `h` into `width` x `height` with a margin. */
export function fitView(w: number, h: number, width: number, height: number, margin = 16): View {
  if (w <= 0 || h <= 0 || width <= 0 || height <= 0) return { x: 0, y: 0, k: 1 };
  const k = Math.min(MAX_K, Math.max(MIN_K, Math.min((width - margin * 2) / w, (height - margin * 2) / h, 1.25)));
  return { k, x: (width - w * k) / 2, y: (height - h * k) / 2 };
}

export function ServiceMap({
  nodes,
  edges,
  selectedId,
  defaultSelectedId = null,
  onSelect,
  renderSelection,
  errorThresholds = { warn: 0.01, error: 0.05 },
  height = 420,
  direction,
  hideControls = false,
  messages,
  className,
}: ServiceMapProps) {
  const msg = useMemo(() => ({ ...DEFAULT_SERVICE_MAP_MESSAGES, ...messages, status: { ...DEFAULT_SERVICE_MAP_MESSAGES.status, ...messages?.status } }), [messages]);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dir, setDir] = useState<'ltr' | 'rtl'>(direction ?? 'ltr');
  useEffect(() => { if (!direction) setDir(isRtlElement(wrapRef.current) ? 'rtl' : 'ltr'); }, [direction]);
  const effectiveDir = direction ?? dir;

  const layout = useMemo(() => layoutServiceMap(nodes, edges, { nodeWidth: NODE_W, nodeHeight: NODE_H, direction: effectiveDir }), [nodes, edges, effectiveDir]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edgeData = useMemo(() => {
    const m = new Map<string, ServiceEdge>();
    for (const e of edges) m.set(e.id ?? `${e.from}->${e.to}`, e);
    return m;
  }, [edges]);

  const [localSelected, setLocalSelected] = useState<string | null>(defaultSelectedId);
  const selectedRaw = selectedId !== undefined ? selectedId : localSelected;
  const selected = selectedRaw && nodeById.has(selectedRaw) ? selectedRaw : null;
  const select = useCallback((id: string | null) => {
    if (selectedId === undefined) setLocalSelected(id);
    onSelect?.(id ? nodeById.get(id) ?? null : null);
  }, [selectedId, onSelect, nodeById]);

  const selectedNode = selected ? nodeById.get(selected) ?? null : null;
  const incoming = useMemo(() => (selected ? edges.filter((e) => e.to === selected) : []), [edges, selected]);
  const outgoing = useMemo(() => (selected ? edges.filter((e) => e.from === selected) : []), [edges, selected]);

  return (
    <div ref={wrapRef} className={cn('flex flex-col gap-3', className)}>
      <ResponsiveContainer height={height}>
        {({ width, height: h }) => (
          <MapCanvas
            width={width}
            height={h}
            layout={layout}
            nodeById={nodeById}
            edgeData={edgeData}
            selected={selected}
            onSelect={select}
            thresholds={errorThresholds}
            rtl={effectiveDir === 'rtl'}
            hideControls={hideControls}
            msg={msg}
          />
        )}
      </ResponsiveContainer>
      {renderSelection !== false && selectedNode && (
        <section role="region" aria-label={msg.selection} className="rounded-md border border-border bg-surface-raised p-3 text-sm">
          {renderSelection
            ? renderSelection(selectedNode, { incoming, outgoing })
            : <DefaultSelection node={selectedNode} incoming={incoming} outgoing={outgoing} nodeById={nodeById} thresholds={errorThresholds} msg={msg} onClose={() => select(null)} />}
        </section>
      )}
    </div>
  );
}

type CanvasProps = {
  width: number;
  height: number;
  layout: MapLayout;
  nodeById: Map<string, ServiceNode>;
  edgeData: Map<string, ServiceEdge>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  thresholds: { warn: number; error: number };
  rtl: boolean;
  hideControls: boolean;
  msg: ServiceMapMessages;
};

function MapCanvas({ width, height, layout, nodeById, edgeData, selected, onSelect, thresholds, rtl, hideControls, msg }: CanvasProps) {
  const uid = useId();
  const markerId = `${uid}-arrow`;
  const markerErrId = `${uid}-arrow-err`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<View>(() => fitView(layout.width, layout.height, width, height));
  const [touched, setTouched] = useState(false);
  const [panning, setPanning] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  // Until the viewer moves the map, keep it fitted when the layout or the box changes.
  const fitKey = `${Math.round(layout.width)}x${Math.round(layout.height)}@${width}x${height}`;
  const [lastFitKey, setLastFitKey] = useState(fitKey);
  if (lastFitKey !== fitKey) {
    setLastFitKey(fitKey);
    if (!touched) setView(fitView(layout.width, layout.height, width, height));
  }

  const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setTouched(true);
    setView((v) => {
      const k = clampK(v.k * factor);
      const f = k / v.k;
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
    });
  }, []);
  const fit = () => { setTouched(false); setView(fitView(layout.width, layout.height, width, height)); };

  const placed = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);
  const order = useMemo(() => layout.layers.flat(), [layout]);
  const active = activeId && placed.has(activeId) ? activeId : selected && placed.has(selected) ? selected : order[0] ?? null;

  const ensureVisible = useCallback((n: PlacedNode) => {
    setView((v) => {
      const m = 24;
      const left = n.x * v.k + v.x;
      const right = (n.x + n.width) * v.k + v.x;
      const top = n.y * v.k + v.y;
      const bottom = (n.y + n.height) * v.k + v.y;
      let { x, y } = v;
      if (left < m) x += m - left; else if (right > width - m) x -= right - (width - m);
      if (top < m) y += m - top; else if (bottom > height - m) y -= bottom - (height - m);
      return x === v.x && y === v.y ? v : { ...v, x, y };
    });
  }, [width, height]);

  const focusNode = useCallback((id: string) => {
    setActiveId(id);
    const n = placed.get(id);
    if (n) ensureVisible(n);
    requestAnimationFrame(() => svgRef.current?.querySelector<SVGGElement>(`[data-node-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
  }, [placed, ensureVisible]);

  const nearestByY = (ids: string[], from: PlacedNode) => {
    let best: string | null = null;
    let dist = Infinity;
    for (const id of ids) {
      const n = placed.get(id);
      if (!n) continue;
      const d = Math.abs(n.y - from.y);
      if (d < dist) { dist = d; best = id; }
    }
    return best;
  };

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const cx = width / 2;
    const cy = height / 2;
    if (e.key === '+' || e.key === '=') { zoomAt(1.2, cx, cy); e.preventDefault(); return; }
    if (e.key === '-' || e.key === '_') { zoomAt(1 / 1.2, cx, cy); e.preventDefault(); return; }
    if (e.key === '0') { fit(); e.preventDefault(); return; }
    if (e.shiftKey && e.key.startsWith('Arrow')) {
      setTouched(true);
      const step = 48;
      setView((v) => ({ ...v, x: v.x + (e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0), y: v.y + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0) }));
      e.preventDefault();
      return;
    }
    if (!active) return;
    const me = placed.get(active);
    if (!me) return;
    const nb = neighbours(layout, active);
    // Along the flow = toward callees. The flow points left to right, or right to left when mirrored.
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    let target: string | null = null;
    switch (e.key) {
      case forward: target = nearestByY(nb.downstream, me); break;
      case backward: target = nearestByY(nb.upstream, me); break;
      case 'ArrowDown': target = nb.sameLayer[nb.sameLayer.indexOf(active) + 1] ?? null; break;
      case 'ArrowUp': target = nb.sameLayer[nb.sameLayer.indexOf(active) - 1] ?? null; break;
      case 'Home': target = order[0] ?? null; break;
      case 'End': target = order[order.length - 1] ?? null; break;
      case 'Enter':
      case ' ': onSelect(selected === active ? null : active); e.preventDefault(); return;
      case 'Escape': if (selected) { onSelect(null); e.preventDefault(); } return;
      default: return;
    }
    e.preventDefault();
    if (target) focusNode(target);
  };

  // Pan with the pointer on the background; a click that did not move clears the selection.
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('[data-node-id]')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setPanning(true);
    setTouched(true);
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (d && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d && !d.moved && selected) onSelect(null);
  };
  // Ctrl / Cmd + wheel zooms around the cursor; a plain wheel scrolls the page as usual. Registered natively because React's
  // wheel listener is passive and cannot cancel the page zoom.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  if (!layout.nodes.length) {
    return <div className="flex h-full items-center justify-center rounded-md border border-border bg-surface-base text-sm text-text-secondary">{msg.empty}</div>;
  }

  const nodeText = (n: ServiceNode) => {
    const parts: string[] = [];
    if (n.rate !== undefined) parts.push(fillMessage(msg.rate, { value: formatCompact(n.rate) }));
    if (n.errorRate !== undefined) parts.push(fillMessage(msg.errors, { value: formatPercent(n.errorRate * 100, 1) }));
    if (n.latencyMs !== undefined) parts.push(fillMessage(msg.latency, { value: formatDurationMs(n.latencyMs) }));
    return parts;
  };
  const edgeText = (e: ServiceEdge) => {
    const parts: string[] = [];
    if (e.rate !== undefined) parts.push(`${formatCompact(e.rate)}/s`);
    if (e.errorRate !== undefined) parts.push(formatPercent(e.errorRate * 100, 1));
    if (e.latencyMs !== undefined) parts.push(formatDurationMs(e.latencyMs));
    return parts;
  };

  return (
    <div className="relative h-full overflow-hidden rounded-md border border-border bg-surface-base">
      <svg
        ref={svgRef}
        role="group"
        aria-label={msg.label}
        aria-describedby={`${uid}-hint`}
        width={width}
        height={height}
        className="block touch-none select-none"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: panning ? 'grabbing' : 'grab' }}
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--border-strong)" />
          </marker>
          <marker id={markerErrId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--error)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {layout.edges.map((pe) => (
            <EdgeView
              key={pe.id}
              edge={pe}
              data={edgeData.get(pe.id)}
              dim={selected !== null && pe.from !== selected && pe.to !== selected}
              marker={markerId}
              markerErr={markerErrId}
              textOf={edgeText}
              label={fillMessage(msg.edgeLabel, { from: nodeById.get(pe.from)?.name ?? pe.from, to: nodeById.get(pe.to)?.name ?? pe.to, metrics: edgeText(edgeData.get(pe.id) ?? { from: '', to: '' }).length ? `, ${edgeText(edgeData.get(pe.id) ?? { from: '', to: '' }).join(', ')}` : '' })}
            />
          ))}
          {layout.nodes.map((pn) => {
            const n = nodeById.get(pn.id);
            if (!n) return null;
            const health = healthOf(n, thresholds);
            const metrics = nodeText(n);
            const calls = layout.edges.filter((e) => e.from === n.id).map((e) => nodeById.get(e.to)?.name ?? e.to);
            return (
              <NodeView
                key={pn.id}
                placed={pn}
                node={n}
                health={health}
                line={nodeLine(n, health, msg)}
                selected={selected === n.id}
                focusable={active === n.id}
                dim={selected !== null && selected !== n.id && !layout.edges.some((e) => (e.from === selected && e.to === n.id) || (e.to === selected && e.from === n.id))}
                healthText={msg.status[health]}
                label={fillMessage(msg.nodeLabel, {
                  name: n.name,
                  status: msg.status[health],
                  metrics: metrics.length ? `, ${metrics.join(', ')}` : '',
                  calls: calls.length ? `, ${msg.downstream.toLowerCase()} ${calls.join(', ')}` : '',
                })}
                onActivate={() => { setActiveId(n.id); onSelect(selected === n.id ? null : n.id); }}
                onFocus={() => setActiveId(n.id)}
              />
            );
          })}
        </g>
      </svg>
      {!hideControls && (
        <>
          <div className="absolute end-2 top-2 flex flex-col gap-1">
            <CtrlButton label={msg.zoomIn} icon={faMagnifyingGlassPlus} onClick={() => zoomAt(1.2, width / 2, height / 2)} />
            <CtrlButton label={msg.zoomOut} icon={faMagnifyingGlassMinus} onClick={() => zoomAt(1 / 1.2, width / 2, height / 2)} />
            <CtrlButton label={msg.fit} icon={faExpand} onClick={fit} />
          </div>
          <p id={`${uid}-hint`} className="pointer-events-none absolute bottom-1.5 start-2 max-w-[70%] text-xs text-text-disabled">{msg.hint}</p>
        </>
      )}
      {hideControls && <p id={`${uid}-hint`} className="sr-only">{msg.hint}</p>}
    </div>
  );
}

function CtrlButton({ label, icon, onClick }: { label: string; icon: typeof faExpand; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-raised text-text-secondary transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <FontAwesomeIcon icon={icon} aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

const HEALTH_STROKE: Record<ServiceHealth, string> = {
  ok: 'var(--border-strong)',
  warn: 'var(--warning)',
  error: 'var(--error)',
  unknown: 'var(--border)',
};

type NodeViewProps = {
  placed: PlacedNode;
  node: ServiceNode;
  health: ServiceHealth;
  /** The caption line under the name (the error percentage moves to a badge when the node is degraded or failing). */
  line: string[];
  selected: boolean;
  focusable: boolean;
  dim: boolean;
  healthText: string;
  label: string;
  onActivate: () => void;
  onFocus: () => void;
};

function nodeLine(n: ServiceNode, health: ServiceHealth, msg: ServiceMapMessages): string[] {
  const out: string[] = [];
  if (n.rate !== undefined) out.push(fillMessage(msg.rate, { value: formatCompact(n.rate) }));
  if (n.errorRate !== undefined && health !== 'error' && health !== 'warn') out.push(fillMessage(msg.errors, { value: formatPercent(n.errorRate * 100, 1) }));
  if (n.latencyMs !== undefined) out.push(fillMessage(msg.latency, { value: formatDurationMs(n.latencyMs) }));
  return out;
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function NodeView({ placed, node, health, line, selected, focusable, dim, healthText, label, onActivate, onFocus }: NodeViewProps) {
  const failing = health === 'error';
  const degraded = health === 'warn';
  return (
    <g
      data-node-id={node.id}
      data-health={health}
      role="button"
      tabIndex={focusable ? 0 : -1}
      aria-label={label}
      aria-pressed={selected}
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
      onFocus={onFocus}
      transform={`translate(${placed.x} ${placed.y})`}
      opacity={dim ? 0.45 : 1}
      className="cursor-pointer outline-none [&:focus-visible>rect:first-of-type]:stroke-[var(--border-focus)] [&:focus-visible>rect:first-of-type]:stroke-[3]"
    >
      <rect
        width={placed.width}
        height={placed.height}
        rx={8}
        fill="var(--surface-raised)"
        stroke={selected ? 'var(--primary)' : HEALTH_STROKE[health]}
        strokeWidth={selected ? 3 : failing ? 2.5 : degraded ? 2 : 1.25}
        strokeDasharray={health === 'unknown' ? '4 3' : undefined}
      />
      <text x={12} y={22} fontSize={13} fontWeight={600} fill="var(--text-primary)">{clip(node.name, 20)}</text>
      <text x={12} y={38} fontSize={10.5} fill="var(--text-secondary)">{clip([node.kind, healthText].filter(Boolean).join(' · '), 28)}</text>
      <text x={12} y={54} fontSize={10.5} fill="var(--text-secondary)">{clip(line.join(' · '), 32)}</text>
      {(failing || degraded) && (
        <g transform={`translate(${placed.width - 24} 8)`} aria-hidden="true">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ width: 14, height: 14, color: failing ? 'var(--error)' : 'var(--warning)' }} />
        </g>
      )}
      {node.errorRate !== undefined && (failing || degraded) && (
        <text x={placed.width - 12} y={54} textAnchor="end" fontSize={10.5} fontWeight={700} fill={failing ? 'var(--error)' : 'var(--warning-fg, var(--warning))'}>
          {formatPercent(node.errorRate * 100, 1)}
        </text>
      )}
    </g>
  );
}

type EdgeViewProps = {
  edge: PlacedEdge;
  data: ServiceEdge | undefined;
  dim: boolean;
  marker: string;
  markerErr: string;
  textOf: (e: ServiceEdge) => string[];
  label: string;
};

function EdgeView({ edge, data, dim, marker, markerErr, textOf, label }: EdgeViewProps) {
  const failing = (data?.errorRate ?? 0) >= 0.05;
  const parts = data ? textOf(data) : [];
  const text = parts.join(' · ');
  const w = Math.ceil(text.length * 6) + 14;
  const width = 1 + Math.min(3, Math.log10(1 + (data?.rate ?? 0)) * 0.9);
  return (
    <g opacity={dim ? 0.3 : 1} role="img" aria-label={label}>
      <title>{label}</title>
      <path
        d={edge.path}
        fill="none"
        stroke={failing ? 'var(--error)' : 'var(--border-strong)'}
        strokeWidth={width}
        strokeDasharray={failing ? '6 4' : undefined}
        markerEnd={`url(#${failing ? markerErr : marker})`}
      />
      {text && (
        <g transform={`translate(${edge.mid.x} ${edge.mid.y})`}>
          <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill="var(--surface-base)" stroke={failing ? 'var(--error)' : 'var(--border)'} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={failing ? 700 : 500} fill={failing ? 'var(--error)' : 'var(--text-secondary)'}>
            {failing ? '! ' : ''}{text}
          </text>
        </g>
      )}
    </g>
  );
}

function DefaultSelection({
  node, incoming, outgoing, nodeById, thresholds, msg, onClose,
}: {
  node: ServiceNode;
  incoming: ServiceEdge[];
  outgoing: ServiceEdge[];
  nodeById: Map<string, ServiceNode>;
  thresholds: { warn: number; error: number };
  msg: ServiceMapMessages;
  onClose: () => void;
}) {
  const health = healthOf(node, thresholds);
  const name = (id: string) => nodeById.get(id)?.name ?? id;
  const metrics = [
    node.rate !== undefined ? fillMessage(msg.rate, { value: formatCompact(node.rate) }) : null,
    node.errorRate !== undefined ? fillMessage(msg.errors, { value: formatPercent(node.errorRate * 100, 2) }) : null,
    node.latencyMs !== undefined ? fillMessage(msg.latency, { value: formatDurationMs(node.latencyMs) }) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-text-primary">{node.name}</h3>
          <p className="text-xs text-text-secondary">{[node.kind, msg.status[health]].filter(Boolean).join(' · ')}{metrics.length ? ` · ${metrics.join(' · ')}` : ''}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-border bg-surface-base px-2 py-1 text-xs hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">{msg.clearSelection}</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-text-secondary">{msg.upstream}</dt>
        <dd>{incoming.length ? incoming.map((e) => name(e.from)).join(', ') : msg.none}</dd>
        <dt className="text-text-secondary">{msg.downstream}</dt>
        <dd>{outgoing.length ? outgoing.map((e) => name(e.to)).join(', ') : msg.none}</dd>
      </dl>
    </div>
  );
}
