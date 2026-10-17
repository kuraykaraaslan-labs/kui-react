'use client';
import { portColor, portEdgeLabel } from '../node-meta';
import { edgePath, inputAnchor, outputAnchor, type NodeLayout } from '../geometry';
import type { RuleNode, RuleEdge as RuleEdgeType } from '../../types';
import type { DiffTint } from '../../graph/diff-view';
import type { EdgeActivity } from '../../graph/activity';
import { useMessages } from '../messages';

const DIFF_STROKE: Record<DiffTint, string> = { added: 'var(--success)', changed: 'var(--warning)', removed: 'var(--error)' };

/** A click selects the connection (it is deleted with Delete / Backspace or the
 *  canvas button), so a stray click no longer removes it. A connection that leaves the
 *  error port is dashed and starts at the bottom of its node. */
export function RuleEdge({ edge, nodes, layouts, readOnly, selected, diff, activity, lit = false, activityWindow, ghost = false, onSelect }: {
  edge: RuleEdgeType;
  nodes: RuleNode[];
  layouts: Map<string, NodeLayout>;
  readOnly: boolean;
  selected: boolean;
  /** in a version compare: the connection was added or removed (its colour; a removed one is dashed) */
  diff?: DiffTint;
  /** the host's counter of this connection: shown on hover */
  activity?: EdgeActivity;
  /** a message passed just now: the connection lights up (the editor keeps this at 2 Hz at most) */
  lit?: boolean;
  /** the span the counter covers ("last 24 h") */
  activityWindow?: string;
  /** an end of it is being dragged elsewhere: drawn faint until the drop */
  ghost?: boolean;
  onSelect: (edgeId: string) => void;
}) {
  const m = useMessages();
  const src = nodes.find((n) => n.nodeId === edge.sourceNodeId);
  const tgt = nodes.find((n) => n.nodeId === edge.targetNodeId);
  const srcLayout = src && layouts.get(src.nodeId);
  const tgtLayout = tgt && layouts.get(tgt.nodeId);
  if (!src || !tgt || !srcLayout || !tgtLayout) return null;
  const from = outputAnchor(src, srcLayout, edge.sourcePort);
  const tgtIdx = tgtLayout.inputs.findIndex((p) => p.id === edge.targetPort);
  if (!from || tgtIdx < 0) return null;
  const to = inputAnchor(tgt, tgtLayout, tgtIdx);
  const color = diff ? DIFF_STROKE[diff] : portColor(edge.sourcePort), label = portEdgeLabel(edge.sourcePort);
  const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
  const lw = label ? label.length * 5.5 + 16 : 0;
  const d = edgePath(from, to);
  const countText = activity ? m.edgeCount(activity.count) : '';
  const cw = countText.length * 5.5 + 14;
  const cy = label ? midY + 13 : midY;
  return (
    <g className="group" style={ghost ? { opacity: 0.25 } : undefined}>
      <path d={d} stroke="transparent" strokeWidth={14} fill="none" data-edge-id={edge.edgeId}
        style={{ pointerEvents:'stroke', cursor: readOnly ? 'default' : 'pointer' }}
        onPointerDown={(e) => { e.stopPropagation(); if (!readOnly) onSelect(edge.edgeId); }}>
        {activity && <title>{m.edgeActivityTitle(activity.count, activityWindow)}</title>}
      </path>
      {activity && (
        <path d={d} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" data-testid="edge-activity" data-lit={lit ? 'true' : 'false'}
          className="transition-opacity duration-300 motion-reduce:transition-none"
          style={{ pointerEvents:'none', opacity: lit ? 0.45 : 0 }} />
      )}
      <path d={d} stroke={color} strokeWidth={selected || diff ? 3 : 2} fill="none" strokeDasharray={diff === 'removed' ? '6 4' : from.down ? '5 3' : undefined}
        data-diff={diff}
        markerEnd="url(#re-arrow)" className="transition-opacity group-hover:opacity-60"
        style={selected ? { filter:'drop-shadow(0 0 3px var(--primary))' } : undefined} />
      {activity && (
        <g data-testid="edge-count" className="opacity-0 transition-opacity group-hover:opacity-100" style={{ pointerEvents:'none' }}>
          <rect x={midX-cw/2} y={cy-8} width={cw} height={16} rx={8} fill="var(--surface-overlay)" stroke="var(--border-strong)" strokeWidth={1} />
          <text x={midX} y={cy+3.5} textAnchor="middle" fontSize="9" fontFamily="system-ui,sans-serif" fontWeight="600" fill="var(--text-primary)">{countText}</text>
        </g>
      )}
      {label && (
        <g style={{ pointerEvents:'none' }}>
          <rect x={midX-lw/2} y={midY-9} width={lw} height={18} rx={9} fill="var(--surface-base)" stroke={color} strokeWidth={1.5} />
          <text x={midX} y={midY+4.5} textAnchor="middle" fontSize="9" fontFamily="system-ui,sans-serif" fontWeight="700" fill={color}>{label}</text>
        </g>
      )}
    </g>
  );
}
