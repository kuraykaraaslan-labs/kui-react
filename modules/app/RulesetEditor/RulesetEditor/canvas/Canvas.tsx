'use client';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassMinus, faMagnifyingGlassPlus, faExpand, faTrash, faRotateLeft, faRotateRight, faDiagramProject, faBinoculars, faVectorPolygon, faMaximize, faMinimize, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/libs/utils/cn';
import { portColor } from '../node-meta';
import { fillTemplate, useMessages } from '../messages';
import { NODE_W, PORT_R, GRID_SIZE, inputAnchor, outputAnchor, edgePath, type NodeLayout, type View } from '../geometry';
import { RuleNode, type RuleNodeStatus } from './RuleNode';
import { RuleEdge } from './RuleEdge';
import { GroupFrame } from './GroupFrame';
import { GuideLines } from './GuideLines';
import type { GuideLine } from '../../graph/snap';
import { groupBounds } from '../../graph/groups';
import type { Catalog } from '../../catalog/types';
import type { GraphIssue } from '../../graph/validate';
import { edgeTintOf, type CanvasDiffTint } from '../../graph/diff-view';
import type { EdgeActivity, NodeActivity } from '../../graph/activity';
import type { Rewiring } from '../hooks/useEdgeRewire';
import type { RuleGroup, RuleNode as RuleNodeT, RuleEdge as RuleEdgeT } from '../../types';

const zoomBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-secondary';

export function Canvas({
  containerRef, nodes, edges, groups, catalog, layouts, view,
  selectedIds, selectedEdgeId, editingNodeId, dragNodeId, connecting, mouse, readOnly, nodeStatus, issues,
  onPointerDown, onPointerDownCapture, onPointerMove, onPointerUp, onContextMenu, onWheel, onKeyDown, onDrop, onDragOver, children,
  onNodePointerDown, onOutputPortDown, onInputPortUp, onSelectEdge, onDeleteSelectedEdge, onGroupTabPointerDown, onGroupTabDoubleClick,
  onZoomIn, onZoomOut, onFit, canUndo, canRedo, onUndo, onRedo,
  guides = [], onPointerCancel, onArrange, canArrange = true, boxMode = false, onToggleBoxMode, miniOn = false, onToggleMini, fullscreen = false, onToggleFullscreen, onShowShortcuts, search, toolbarExtra, diffTint,
  edgeActivity, litEdges, nodeActivity, activityWindow, rewiring = null, onEdgeEndDown, onOutputPortUp,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodes: RuleNodeT[];
  edges: RuleEdgeT[];
  groups: RuleGroup[];
  catalog: Catalog;
  layouts: Map<string, NodeLayout>;
  view: View;
  selectedIds: ReadonlySet<string>;
  selectedEdgeId: string | null;
  editingNodeId: string | null;
  dragNodeId: string | null;
  connecting: { nodeId: string; portId: string; x: number; y: number } | null;
  mouse: { x: number; y: number };
  readOnly: boolean;
  nodeStatus?: Record<string, RuleNodeStatus>;
  issues: Map<string, GraphIssue[]>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerDownCapture: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** overlays inside the canvas (context menu, palette button) */
  children?: React.ReactNode;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onNodePointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onOutputPortDown: (e: React.PointerEvent, nodeId: string, portId: string) => void;
  onInputPortUp: (e: React.PointerEvent, nodeId: string, portId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onDeleteSelectedEdge: () => void;
  onGroupTabPointerDown: (e: React.PointerEvent, groupId: string) => void;
  onGroupTabDoubleClick: (groupId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** alignment lines shown while a block is dragged */
  guides?: GuideLine[];
  /** a cancelled gesture; the pointer-up handler by default */
  onPointerCancel?: (e: React.PointerEvent) => void;
  /** auto layout; no button without it */
  onArrange?: () => void;
  canArrange?: boolean;
  /** the frame mode (a one-finger drag draws a selection frame) */
  boxMode?: boolean;
  onToggleBoxMode?: () => void;
  /** is the mini map showing */
  miniOn?: boolean;
  onToggleMini?: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** the keyboard icon of the tool bar */
  onShowShortcuts?: () => void;
  /** while the find box is open: the ids of the matching blocks and the one stepped to; the others are dimmed */
  search?: { matches: ReadonlySet<string>; current: string | null } | null;
  /** extra controls at the start of the zoom bar */
  toolbarExtra?: React.ReactNode;
  /** a version compare: added, changed and removed blocks and connections are tinted */
  diffTint?: CanvasDiffTint;
  /** live counters per connection (shown on hover) and the connections lit just now */
  edgeActivity?: Record<string, EdgeActivity>;
  litEdges?: ReadonlySet<string>;
  /** live counters per block, shown in its hover card */
  nodeActivity?: Record<string, NodeActivity>;
  /** the span the counters cover ("last 24 h") */
  activityWindow?: string;
  /** an end of a connection being dragged to another port (UI-31) */
  rewiring?: Rewiring;
  /** a press on an end handle of the selected connection; `at` is that end's world point. No handles without it */
  onEdgeEndDown?: (e: React.PointerEvent, edgeId: string, end: 'source' | 'target', at: { x: number; y: number }) => void;
  /** the pointer was released on an output port (the drop of a dragged source end) */
  onOutputPortUp?: (e: React.PointerEvent, nodeId: string, portId: string) => void;
}) {
  const m = useMessages();
  /* one stable function per callback for the memoised blocks and connections: they always call the latest handler */
  const latest = useRef({ onNodePointerDown, onSelectEdge });
  useLayoutEffect(() => { latest.current = { onNodePointerDown, onSelectEdge }; });
  const nodeDown = useCallback((e: React.PointerEvent, nodeId: string) => latest.current.onNodePointerDown(e, nodeId), []);
  const selectEdge = useCallback((edgeId: string) => latest.current.onSelectEdge(edgeId), []);
  /* the two ends of a connection, in world points (null while a block of it is missing) */
  const endsOf = (edgeId: string | null) => {
    const edge = edgeId ? edges.find((x) => x.edgeId === edgeId) : undefined;
    const src = edge && nodes.find((n) => n.nodeId === edge.sourceNodeId);
    const tgt = edge && nodes.find((n) => n.nodeId === edge.targetNodeId);
    const sl = src && layouts.get(src.nodeId), tl = tgt && layouts.get(tgt.nodeId);
    if (!edge || !src || !tgt || !sl || !tl) return null;
    const from = outputAnchor(src, sl, edge.sourcePort);
    const ti = tl.inputs.findIndex((p) => p.id === edge.targetPort);
    if (!from || ti < 0) return null;
    return { from, to: inputAnchor(tgt, tl, ti) };
  };
  const handles = !readOnly && onEdgeEndDown && !rewiring && !connecting ? endsOf(selectedEdgeId) : null;
  const rewireEnds = rewiring ? endsOf(rewiring.edgeId) : null;
  const liveFrom = (() => {
    if (!connecting) return null;
    const n = nodes.find((x) => x.nodeId === connecting.nodeId);
    const l = n && layouts.get(n.nodeId);
    return n && l ? outputAnchor(n, l, connecting.portId) : null;
  })();

  return (
    <div ref={containerRef}
      tabIndex={0} aria-label={m.canvasLabel}
      className="relative min-h-0 flex-1 overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus"
      style={{
        backgroundImage:'radial-gradient(circle, var(--canvas-dot, var(--border)) 1.5px, transparent 1.5px)',
        backgroundSize:`${GRID_SIZE * view.k}px ${GRID_SIZE * view.k}px`,
        backgroundPosition:`${view.x}px ${view.y}px`,
        backgroundColor:'var(--canvas-bg, var(--surface-base))', cursor: connecting || rewiring ? 'crosshair' : 'default', touchAction:'none',
      }}
      onDrop={onDrop} onDragOver={onDragOver} onWheel={onWheel} onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerDownCapture={onPointerDownCapture} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel ?? onPointerUp} onContextMenu={onContextMenu}>

      {/* the world: everything below moves and scales with the view */}
      <div className="absolute left-0 top-0" data-testid="ruleset-world" style={{ transform:`translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin:'0 0' }}>
        {groups.map((group) => {
          const bounds = groupBounds(nodes, group, NODE_W, (n) => layouts.get(n.nodeId)?.height ?? 0);
          return bounds && (
            <GroupFrame key={group.groupId} group={group} bounds={bounds} readOnly={readOnly}
              onTabPointerDown={onGroupTabPointerDown} onTabDoubleClick={onGroupTabDoubleClick} />
          );
        })}
        <GuideLines guides={guides} zoom={view.k} />
        <svg className="absolute left-0 top-0 h-px w-px overflow-visible" style={{ zIndex:10, pointerEvents:'none' }}>
          <defs>
            <marker id="re-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="context-stroke" />
            </marker>
          </defs>
          {edges.map((edge) => (
            <RuleEdge key={edge.edgeId} edge={edge} nodes={nodes} layouts={layouts} readOnly={readOnly}
              selected={selectedEdgeId === edge.edgeId} diff={edgeTintOf(diffTint, edge)} onSelect={selectEdge}
              activity={edgeActivity?.[edge.edgeId]} lit={!!litEdges?.has(edge.edgeId)} activityWindow={activityWindow}
              ghost={rewiring?.edgeId === edge.edgeId} />
          ))}
          {rewireEnds && rewiring && (
            <path data-testid="edge-rewire-path" d={rewiring.end === 'target' ? edgePath(rewireEnds.from, mouse) : edgePath({ ...mouse, down: false }, rewireEnds.to)}
              stroke="var(--primary)" strokeWidth={2} fill="none" strokeDasharray="6 3" />
          )}
          {liveFrom && (
            <path d={edgePath(liveFrom, mouse)}
              stroke="var(--border-strong)" strokeWidth={2} fill="none" strokeDasharray="6 3" />
          )}
          {nodes.map((node) => {
            const layout = layouts.get(node.nodeId);
            if (!layout) return null;
            const errorAt = layout.hasError ? outputAnchor(node, layout, 'error') : null;
            return (
              <g key={`ports-${node.nodeId}`}>
                {layout.inputs.map((port, i) => {
                  const at = inputAnchor(node, layout, i);
                  return (
                    <circle key={`in-${port.id}`} cx={at.x} cy={at.y} r={PORT_R}
                      data-in-node={node.nodeId} data-in-port={port.id}
                      fill="var(--surface-base)" stroke="var(--border-strong)" strokeWidth={2}
                      style={{ pointerEvents:'auto', cursor:'crosshair' }}
                      className="transition-colors hover:fill-primary-subtle hover:stroke-primary"
                      onPointerUp={(e) => onInputPortUp(e, node.nodeId, port.id)} />
                  );
                })}
                {layout.outputs.map((port) => {
                  const at = outputAnchor(node, layout, port.id);
                  const c = portColor(port.id);
                  return at && (
                    <circle key={`out-${port.id}`} cx={at.x} cy={at.y} r={PORT_R}
                      data-out-node={node.nodeId} data-out-port={port.id}
                      onPointerUp={onOutputPortUp && ((e) => onOutputPortUp(e, node.nodeId, port.id))}
                      fill={c} stroke={c} strokeWidth={1.5}
                      style={{ pointerEvents:'auto', cursor:'crosshair', opacity:0.9 }}
                      className="transition-opacity hover:opacity-100"
                      onPointerDown={(e) => { e.stopPropagation(); onOutputPortDown(e, node.nodeId, port.id); }} />
                  );
                })}
                {errorAt && (
                  <circle key="out-error" cx={errorAt.x} cy={errorAt.y} r={PORT_R - 1}
                    data-out-node={node.nodeId} data-out-port="error"
                    onPointerUp={onOutputPortUp && ((e) => onOutputPortUp(e, node.nodeId, 'error'))}
                    fill="var(--surface-base)" stroke={portColor('error')} strokeWidth={2}
                    style={{ pointerEvents:'auto', cursor:'crosshair' }}
                    className="transition-colors hover:fill-error-subtle"
                    onPointerDown={(e) => { e.stopPropagation(); onOutputPortDown(e, node.nodeId, 'error'); }}>
                    <title>{m.canvasErrorPath}</title>
                  </circle>
                )}
              </g>
            );
          })}
          {handles && selectedEdgeId && (['source', 'target'] as const).map((end) => {
            const at = end === 'source' ? handles.from : handles.to;
            return (
              <circle key={`handle-${end}`} data-testid={`edge-handle-${end}`} cx={at.x} cy={at.y} r={PORT_R + 2}
                fill="var(--primary)" stroke="var(--surface-base)" strokeWidth={2}
                style={{ pointerEvents:'auto', cursor:'grab' }}
                onPointerDown={(e) => { e.stopPropagation(); onEdgeEndDown?.(e, selectedEdgeId, end, { x: at.x, y: at.y }); }}>
                <title>{end === 'source' ? m.edgeHandleSource : m.edgeHandleTarget}</title>
              </circle>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const layout = layouts.get(node.nodeId);
          return layout && (
            <RuleNode
              key={node.nodeId}
              node={node}
              decl={catalog.blocks[node.type]}
              layout={layout}
              issues={issues.get(node.nodeId)}
              diff={diffTint?.nodes[node.nodeId]}
              search={search ? (search.current === node.nodeId ? 'current' : search.matches.has(node.nodeId) ? 'match' : 'dim') : undefined}
              isEditing={editingNodeId === node.nodeId}
              isSelected={selectedIds.has(node.nodeId)}
              isDragging={dragNodeId === node.nodeId}
              status={nodeStatus?.[node.nodeId]}
              activity={nodeActivity?.[node.nodeId]}
              activityWindow={activityWindow}
              onPointerDown={nodeDown}
            />
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-1">
          <p className="text-sm font-medium text-text-secondary">{m.canvasEmpty}</p>
          <p className="text-xs text-text-secondary">
            {fillTemplate(m.canvasEmptyWire, { out: <span className="font-bold text-primary">●</span>, in: <span className="font-bold">○</span> })}
          </p>
        </div>
      )}

      {children}

      {/* undo, redo, zoom and selection controls */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 rounded-lg border border-border bg-surface-base p-1 shadow-sm"
        onPointerDown={(e) => e.stopPropagation()}>
        {toolbarExtra}
        {!readOnly && selectedEdgeId && (
          <button type="button" onClick={onDeleteSelectedEdge}
            className="mr-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-error-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
            <FontAwesomeIcon icon={faTrash} className="h-3 w-3" aria-hidden="true" /> {m.toolDeleteConnection}
          </button>
        )}
        {!readOnly && (
          <>
            <button type="button" onClick={onUndo} disabled={!canUndo} aria-label={m.toolUndo} title={m.toolUndoTitle} className={zoomBtn}>
              <FontAwesomeIcon icon={faRotateLeft} className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={onRedo} disabled={!canRedo} aria-label={m.toolRedo} title={m.toolRedoTitle} className={zoomBtn}>
              <FontAwesomeIcon icon={faRotateRight} className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
          </>
        )}
        {!readOnly && onArrange && (
          <button type="button" onClick={onArrange} disabled={!canArrange} aria-label={m.toolArrange} title={m.toolArrange} className={zoomBtn}>
            <FontAwesomeIcon icon={faDiagramProject} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {onToggleBoxMode && (
          <button type="button" onClick={onToggleBoxMode} aria-label={m.toolBox} aria-pressed={boxMode} title={m.toolBoxTitle}
            className={cn(zoomBtn, boxMode && 'border border-primary bg-primary-subtle text-primary')}>
            <FontAwesomeIcon icon={faVectorPolygon} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onZoomOut} aria-label={m.toolZoomOut} title={m.toolZoomOut} className={zoomBtn}>
          <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="min-w-12 text-center text-xs tabular-nums text-text-secondary" aria-live="polite">{Math.round(view.k * 100)}%</span>
        <button type="button" onClick={onZoomIn} aria-label={m.toolZoomIn} title={m.toolZoomIn} className={zoomBtn}>
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onFit} aria-label={m.toolFit} title={m.toolFit} className={zoomBtn}>
          <FontAwesomeIcon icon={faExpand} className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {onShowShortcuts && (
          <button type="button" onClick={onShowShortcuts} aria-label={m.shortcutsTitle} title={`${m.shortcutsTitle} (?)`} className={cn(zoomBtn, 'max-md:hidden')}>
            <FontAwesomeIcon icon={faKeyboard} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {onToggleFullscreen && (
          <button type="button" onClick={onToggleFullscreen} aria-label={fullscreen ? m.toolExitFullscreen : m.toolFullscreen} aria-pressed={fullscreen}
            title={fullscreen ? m.toolExitFullscreen : m.toolFullscreen} className={cn(zoomBtn, fullscreen && 'border border-primary bg-primary-subtle text-primary')}>
            <FontAwesomeIcon icon={fullscreen ? faMinimize : faMaximize} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {onToggleMini && (
          <button type="button" onClick={onToggleMini} aria-label={m.toolMiniMap} aria-pressed={miniOn} title={m.toolMiniMap}
            className={cn(zoomBtn, 'max-md:hidden', miniOn && 'border border-primary bg-primary-subtle text-primary')}>
            <FontAwesomeIcon icon={faBinoculars} className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
