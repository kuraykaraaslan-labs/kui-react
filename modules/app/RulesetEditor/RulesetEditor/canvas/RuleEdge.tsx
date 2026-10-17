'use client';
import { portColor, portEdgeLabel } from '../node-meta';
import { edgePath, inputAnchor, outputAnchor, type NodeLayout } from '../geometry';
import type { RuleNode, RuleEdge as RuleEdgeType } from '../../types';
import type { DiffTint } from '../../graph/diff-view';

const DIFF_STROKE: Record<DiffTint, string> = { added: 'var(--success)', changed: 'var(--warning)', removed: 'var(--error)' };

/** A click selects the connection (it is deleted with Delete / Backspace or the
 *  canvas button), so a stray click no longer removes it. A connection that leaves the
 *  error port is dashed and starts at the bottom of its node. */
export function RuleEdge({ edge, nodes, layouts, readOnly, selected, diff, onSelect }: {
  edge: RuleEdgeType;
  nodes: RuleNode[];
  layouts: Map<string, NodeLayout>;
  readOnly: boolean;
  selected: boolean;
  /** in a version compare: the connection was added or removed (its colour; a removed one is dashed) */
  diff?: DiffTint;
  onSelect: (edgeId: string) => void;
}) {
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
  return (
    <g className="group">
      <path d={d} stroke="transparent" strokeWidth={14} fill="none" data-edge-id={edge.edgeId}
        style={{ pointerEvents:'stroke', cursor: readOnly ? 'default' : 'pointer' }}
        onPointerDown={(e) => { e.stopPropagation(); if (!readOnly) onSelect(edge.edgeId); }} />
      <path d={d} stroke={color} strokeWidth={selected || diff ? 3 : 2} fill="none" strokeDasharray={diff === 'removed' ? '6 4' : from.down ? '5 3' : undefined}
        data-diff={diff}
        markerEnd="url(#re-arrow)" className="transition-opacity group-hover:opacity-60"
        style={selected ? { filter:'drop-shadow(0 0 3px var(--primary))' } : undefined} />
      {label && (
        <g style={{ pointerEvents:'none' }}>
          <rect x={midX-lw/2} y={midY-9} width={lw} height={18} rx={9} fill="var(--surface-base)" stroke={color} strokeWidth={1.5} />
          <text x={midX} y={midY+4.5} textAnchor="middle" fontSize="9" fontFamily="system-ui,sans-serif" fontWeight="700" fill={color}>{label}</text>
        </g>
      )}
    </g>
  );
}
