'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { lookOf } from '../block-visual';
import { portColor } from '../node-meta';
import { NODE_W, NODE_HEADER_H, PORT_TOP_OFFSET, PORT_STEP, SUMMARY_H, type NodeLayout } from '../geometry';
import type { BlockDecl } from '../../catalog/types';
import { isNote, noteText } from '../../catalog/note';
import { nodeName } from '../../graph/names';
import type { GraphIssue } from '../../graph/validate';
import type { DiffTint } from '../../graph/diff-view';
import { useMessages } from '../messages';
import type { RuleNode as RuleNodeType } from '../../types';

/** how long the pointer rests on a block before its hover card shows */
export const NODE_TIP_DELAY_MS = 500;

/** Live state shown under a node (e.g. "3 waiting", "connected", last error). */
export type RuleNodeStatus = { tone: 'success' | 'error' | 'warning' | 'info' | 'neutral'; text: string; ring?: boolean };

/** the outline and badge of a block in a version compare */
const DIFF_LOOK: Record<DiffTint, { outline: string; badge: string }> = {
  added: { outline: 'outline-2 outline-offset-2 outline-success', badge: 'bg-success text-success-fg' },
  changed: { outline: 'outline-2 outline-offset-2 outline-warning', badge: 'bg-warning text-warning-fg' },
  removed: { outline: 'outline-2 outline-offset-2 outline-dashed outline-error opacity-60', badge: 'bg-error text-error-fg' },
};

const TONE: Record<RuleNodeStatus['tone'], string> = {
  success: 'var(--success)', error: 'var(--error)', warning: 'var(--warning)', info: 'var(--info)', neutral: 'var(--text-secondary)',
};

export function RuleNode({ node, decl, layout, issues = [], search, diff, isSelected, isEditing, isDragging, status, onPointerDown }: {
  node: RuleNodeType;
  decl: BlockDecl | undefined;
  layout: NodeLayout;
  issues?: GraphIssue[];
  /** while the find box is open: this block matches (`current` is the one stepped to) or is dimmed */
  search?: 'match' | 'current' | 'dim';
  /** in a version compare: the block was added, changed or removed (outline and badge) */
  diff?: DiffTint;
  isSelected: boolean;
  isEditing: boolean;
  isDragging: boolean;
  status?: RuleNodeStatus;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const m = useMessages();
  const tipId = useId();
  const [tip, setTip] = useState(false);
  const tipTimer = useRef<number | null>(null);
  const hideTip = () => { if (tipTimer.current !== null) { window.clearTimeout(tipTimer.current); tipTimer.current = null; } setTip(false); };
  useEffect(() => () => { if (tipTimer.current !== null) window.clearTimeout(tipTimer.current); }, []);
  const tipShown = tip && !isDragging;
  const look = lookOf(decl);
  const placeholder = layout.placeholder;
  const originalType = node.original?.type ?? 'unknown';
  const title = placeholder ? m.nodeNotAvailable : decl?.title ?? node.type;
  const hasError = issues.some((i) => i.severity === 'error');
  const name = nodeName(node, decl);
  const issueText = issues.map((i) => i.message).join(' ');
  const diffLabel = diff ? (diff === 'added' ? m.diffAdded : diff === 'changed' ? m.diffChanged : m.diffRemoved) : '';
  const diffBadge = diff && (
    <span data-testid="node-diff" aria-hidden="true"
      className={cn('pointer-events-none absolute -top-2.5 left-2 z-10 rounded px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide', DIFF_LOOK[diff].badge)}>
      {diffLabel}
    </span>
  );
  if (isNote(node)) {
    /* a comment: a text card with no ports; the engine never runs it */
    const text = noteText(node);
    return (
      <div
        data-node-id={node.nodeId} role="button" tabIndex={0} aria-label={diff ? `${m.noteAria(text)}, ${diffLabel}` : m.noteAria(text)} aria-pressed={isSelected} data-find={search} data-diff={diff}
        className={cn('absolute overflow-hidden rounded-lg border-2 border-dashed border-warning/60 bg-warning-subtle px-3 py-2.5 text-xs leading-4 text-text-primary transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          isEditing ? 'border-primary shadow-lg ring-2 ring-primary/30' : isSelected ? 'border-primary/70 shadow-md' : 'hover:shadow-md',
          search === 'dim' && 'opacity-30', search === 'match' && 'ring-2 ring-warning/60', search === 'current' && 'ring-2 ring-warning',
          diff && DIFF_LOOK[diff].outline,
          isDragging ? 'cursor-grabbing shadow-xl' : 'cursor-pointer')}
        style={{ left: node.x, top: node.y, width: NODE_W, height: layout.height, zIndex: isSelected || isEditing ? 20 : 4 }}
        onPointerDown={onPointerDown}>
        {diffBadge}
        <p className={cn('h-full whitespace-pre-wrap break-words', !text && 'italic text-text-secondary')}>{text || m.noteEmpty}</p>
      </div>
    );
  }
  return (
    <div
      data-node-id={node.nodeId}
      role="button" tabIndex={0}
      aria-label={`${placeholder ? m.nodeAriaPlaceholder(name, originalType) : m.nodeAriaLabel(name, title, !!node.disabled, issues.length)}${diff ? `, ${diffLabel}` : ''}`}
      data-diff={diff}
      aria-pressed={isSelected}
      className={cn('absolute rounded-xl border-2 bg-surface-base transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        placeholder && 'border-dashed',
        node.disabled && 'opacity-60',
        search === 'dim' && 'opacity-30',
        search === 'match' && 'ring-2 ring-warning/60',
        search === 'current' && 'ring-2 ring-warning',
        isEditing ? 'border-primary shadow-lg ring-2 ring-primary/30'
          : isSelected ? 'border-primary/70 shadow-md'
          : placeholder ? 'border-border-strong shadow-sm hover:shadow-md'
          : 'border-border shadow-sm hover:border-border-strong hover:shadow-md',
        diff && DIFF_LOOK[diff].outline,
        isDragging ? 'cursor-grabbing shadow-xl' : 'cursor-pointer')}
      data-find={search}
      aria-describedby={tipShown ? tipId : undefined}
      style={{ left:node.x, top:node.y, width:NODE_W, height:layout.height, zIndex: tipShown ? 40 : isSelected||isEditing ? 20 : 5 }}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch' || isDragging || tipTimer.current !== null) return;
        tipTimer.current = window.setTimeout(() => { tipTimer.current = null; setTip(true); }, NODE_TIP_DELAY_MS);
      }}
      onPointerLeave={hideTip}
      onBlur={hideTip}
      onPointerDown={(e) => { hideTip(); onPointerDown(e); }}>
      {diffBadge}
      <div className={cn('flex items-center gap-2 rounded-t-[10px] border-b border-border px-3', placeholder && 'border-dashed', look.headerBg)} style={{ height:NODE_HEADER_H }}>
        <FontAwesomeIcon icon={look.icon} className={cn('h-3.5 w-3.5 shrink-0', look.iconColor)} aria-hidden="true" />
        <span className={cn('flex-1 truncate text-xs font-semibold leading-tight', placeholder ? 'text-text-secondary' : 'text-text-primary')}>{name}</span>
        {node.disabled && <span className="shrink-0 rounded bg-surface-overlay px-1 text-[9px] font-semibold uppercase tracking-wide text-text-secondary">{m.nodeSkipped}</span>}
      </div>
      {placeholder ? (
        <p className="truncate px-3 pt-1 text-[10px] leading-none text-text-secondary" style={{ height:SUMMARY_H }} title={originalType}>
          <span className="font-semibold">{m.nodeNotAvailable}</span> · <span className="font-mono">{originalType}</span>
        </p>
      ) : layout.summary !== null && (
        <p className="truncate px-3 pt-1 text-[10px] leading-none text-text-secondary" style={{ height:SUMMARY_H }} title={layout.summary}>{layout.summary}</p>
      )}
      <div className="flex justify-between px-5" style={{ paddingTop:PORT_TOP_OFFSET }}>
        <div className="flex flex-col" style={{ gap:PORT_STEP-14 }}>
          {layout.inputs.map((p) => <span key={p.id} className="text-[10px] leading-none text-text-secondary">{p.label}</span>)}
        </div>
        <div className="flex flex-col items-end" style={{ gap:PORT_STEP-14 }}>
          {layout.outputs.map((p) => <span key={p.id} style={{ color:portColor(p.id) }} className="text-[10px] font-medium leading-none">{p.label}</span>)}
        </div>
      </div>
      {issues.length > 0 && (
        <span role="img" aria-label={issueText} title={issueText}
          className={cn('absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none',
            hasError ? 'bg-error text-error-fg' : 'bg-warning text-warning-fg')}>
          {issues.length}
        </span>
      )}
      {tipShown && (
        <div id={tipId} role="tooltip" data-testid="node-tip"
          className="pointer-events-none absolute bottom-full left-0 mb-2 w-max max-w-64 rounded-lg border border-border bg-surface-overlay px-2.5 py-1.5 text-xs text-text-primary shadow-lg">
          <p className="font-semibold">{name}</p>
          <p className="mt-0.5 text-text-secondary">{placeholder ? `${originalType} – ${m.nodeNotAvailable}` : m.nodeTipKind(node.type, title)}</p>
          {node.description && <p className="mt-1 whitespace-pre-wrap break-words">{node.description}</p>}
        </div>
      )}
      {status && (
        <div className="pointer-events-none absolute left-1 top-full mt-1.5 flex max-w-full items-center gap-1.5 truncate text-[11px] text-text-secondary">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
            style={status.ring ? { border:`2px solid ${TONE[status.tone]}` } : { background:TONE[status.tone] }} />
          <span className="truncate">{status.text}</span>
        </div>
      )}
    </div>
  );
}
