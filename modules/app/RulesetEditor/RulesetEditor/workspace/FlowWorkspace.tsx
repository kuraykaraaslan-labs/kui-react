'use client';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { cn } from '@/libs/utils/cn';
import type { DraftStore } from '../../graph/draft';
import type { LinkFlow } from '../../graph/links';
import { secretTestOf } from '../../graph/scrub';
import type { MergeResult } from '../../graph/merge';
import { MessagesProvider, useMergedMessages, useMessages } from '../messages';
import { RulesetEditor, type ContextMenuItem, type NodeMenuContext, type RulesetEditorProps, type RulesetEditorRef } from '../index';
import type { RulesetGraph } from '../hooks/useGraphEditor';
import { DraftBanner, NoticeBanner, type Notice } from './DraftBanner';
import { LinkHitsDialog } from './LinkHitsDialog';
import { ConflictDialog, MergedDialog } from './MergeDialog';
import type { ActiveFlow, ConflictInfo, FlowKind, FlowRef, LoadedFlow, WorkspaceFlow } from './types';
import { FULLSCREEN_CLASSES } from '../hooks/useFullscreen';
import { useLeaveGuard } from '../hooks/useLeaveGuard';
import { useDraft } from './useDraft';
import { useFlowLinks } from './useFlowLinks';
import { useMerge } from './useMerge';

export type FlowWorkspaceRef = {
  /** the editor inside (null until it is mounted) */
  editor: RulesetEditorRef | null;
  getGraph: () => RulesetGraph | undefined;
  /** the open flow has changes that were not saved */
  isDirty: () => boolean;
  /** call after the host saved: the graph (or the one given) is the new baseline and the draft goes */
  markSaved: (graph?: RulesetGraph) => void;
  /** write the draft now; false when the browser cannot keep it */
  keepDraft: () => boolean;
};

type EditorProps = Omit<RulesetEditorProps, 'initialNodes' | 'initialEdges' | 'initialGroups' | 'initialSubflows' | 'chainName' | 'bannerSlot' | 'ref'>;

export type FlowWorkspaceProps = EditorProps & {
  /** every flow and subflow of the host (the open one may be left out until it is saved); the workspace searches them for link jumps */
  flows: WorkspaceFlow[];
  /** the flow in the editor. The workspace loads its graph once: give another flow to open another one */
  flow: ActiveFlow;
  /** a link jump to another flow: show that flow. `nodeId` is a block to select and bring into view */
  onOpen: (flow: FlowRef, options?: { nodeId?: string }) => void;
  /** other flows with their blocks, for link jumps across flows (kept 30 s). Without it only the open flow is searched */
  loadFlows?: (ids: string[]) => Promise<LinkFlow[] | null | undefined>;
  /** one flow as the host has it: the other side of a merge */
  loadFlow?: (kind: FlowKind, id: string) => Promise<LoadedFlow | null | undefined>;
  /** set when saving found a newer version: shows the conflict dialog with Merge */
  conflict?: ConflictInfo | null;
  /** more buttons in the conflict dialog (overwrite, reload …) */
  conflictActions?: React.ReactNode;
  /** the conflict dialog (or the merge summary) was closed */
  onConflictClose?: () => void;
  /** a merge was made: the host's version is the new baseline (take its revision) */
  onMerged?: (theirs: LoadedFlow, result: MergeResult) => void;
  /** a block to select and bring into view when the flow opens (a jump from another flow) */
  focusNodeId?: string | null;
  /** the open flow became dirty or clean */
  onDirtyChange?: (dirty: boolean) => void;
  /** called with every change of the editor, like `RulesetEditor`'s */
  onChange?: (graph: RulesetGraph) => void;
  /** for tests: where drafts are kept */
  draftStore?: DraftStore;
  /**
   * Guard against leaving with a change that is not kept anywhere else: while it is active, a reload or a closed tab asks
   * the browser to confirm, and a link jump that leaves this flow asks first. `true` guards while the flow is dirty; a
   * function gets `dirty` and says (a host with a server draft returns `dirty && !serverDraftSaved`). Off by default.
   */
  leaveGuard?: boolean | ((dirty: boolean) => boolean);
  /** Ctrl+S in the editor (see `RulesetEditor`'s): `dirty` says whether the flow differs from what was opened or last saved */
  onSave?: (state: { valid: boolean; dirty: boolean }) => void;
  className?: string;
  ref?: React.Ref<FlowWorkspaceRef>;
};

/**
 * `RulesetEditor` with the pieces a host that has many flows needs: a browser draft per flow, jumps through link blocks
 * and a three-way merge for a save conflict. The editor stays one flow at a time; opening another flow is navigation,
 * done through the host's `onOpen`. Flows are created, renamed, duplicated and exported from the host's list. Use it
 * instead of the bare editor, with the same props.
 */
export function FlowWorkspace(props: FlowWorkspaceProps) {
  // the words of the banners and dialogs, and (through the editor props) of the editor
  const m = useMergedMessages(props.messages);
  // one editor, one draft and one set of dialogs per flow
  return <MessagesProvider value={m}><WorkspaceBody key={`${props.flow.kind}:${props.flow.id ?? 'new'}`} {...props} /></MessagesProvider>;
}

function WorkspaceBody({
  flows, flow, onOpen, loadFlows, loadFlow, conflict, conflictActions, onConflictClose,
  onMerged, focusNodeId, onDirtyChange, onChange, draftStore, leaveGuard, onSave, className, nodeMenuItems, ref, ...editorProps
}: FlowWorkspaceProps) {
  const m = useMessages();
  const readOnly = !!editorProps.readOnly;
  const secretTest = useMemo(() => secretTestOf(editorProps.catalog), [editorProps.catalog]);
  const editorRef = useRef<RulesetEditorRef>(null);
  const getGraph = useCallback(() => editorRef.current?.getGraph(), []);
  const replaceGraph = useCallback((g: RulesetGraph, o?: { key?: string; fit?: boolean }) => editorRef.current?.replaceGraph(g, o), []);
  const [notice, setNotice] = useState<Notice | null>(null);
  const say = useCallback((text: string, tone: Notice['tone'] = 'info') => setNotice({ text, tone }), []);

  const draft = useDraft({ kind: flow.kind, id: flow.id, initial: flow.graph, readOnly, getGraph, replaceGraph, store: draftStore, secretTest, onDirtyChange });
  const guard = useLeaveGuard(typeof leaveGuard === 'function' ? leaveGuard(draft.dirty) : !!leaveGuard && draft.dirty, m.wsLeaveConfirm);

  /** leaving this flow: the draft keeps what is unsaved; if the browser cannot keep it, stay and say so */
  function leave(): boolean {
    if (!guard.confirmLeave()) return false;
    if (draft.keep()) return true;
    say(m.wsKeepDraftFail, 'warning');
    return false;
  }

  /* ── link jumps ── */
  const revealNode = useCallback((nodeId: string) => {
    editorRef.current?.select([nodeId]);
    editorRef.current?.reveal(nodeId);
  }, []);
  const here = useMemo(() => ({ id: flow.id, kind: flow.kind, name: flow.name }), [flow.id, flow.kind, flow.name]);
  const otherIds = useMemo(() => flows.filter((t) => !(t.id === flow.id && t.kind === flow.kind)).map((t) => t.id), [flows, flow.id, flow.kind]);
  const links = useFlowLinks({
    here, getGraph, otherIds, loadFlows, reveal: revealNode, notify: say,
    jump: (hit) => { if (leave()) onOpen({ kind: hit.kind, id: hit.flow }, { nodeId: hit.node }); },
  });
  const menuItems = useCallback((ctx: NodeMenuContext): ContextMenuItem[] => [...links.menuItems(ctx), ...(nodeMenuItems?.(ctx) ?? [])], [links, nodeMenuItems]);

  /* opened by a jump from another flow: show the block */
  useEffect(() => {
    if (focusNodeId && getGraph()?.nodes.some((n) => n.nodeId === focusNodeId)) revealNode(focusNodeId);
  }, [focusNodeId, getGraph, revealNode]);

  /* ── merge ── */
  const merge = useMerge({
    kind: flow.kind, id: flow.id, loadFlow, getGraph, baseline: draft.baseline, replaceGraph, rebase: draft.rebase, onMerged,
  });

  useImperativeHandle(ref, () => ({
    get editor() { return editorRef.current; },
    getGraph,
    isDirty: () => draft.dirty,
    markSaved: draft.markSaved,
    keepDraft: draft.keep,
  }), [getGraph, draft.dirty, draft.markSaved, draft.keep]);

  const banner = (draft.offer || notice) ? (
    <>
      {draft.offer && <DraftBanner draft={draft.offer.draft} stale={draft.offer.stale} onRestore={draft.restore} onDiscard={draft.discard} />}
      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}
    </>
  ) : null;

  return (
    <div data-ruleset-workspace className={cn('flex h-full min-h-0 flex-col', FULLSCREEN_CLASSES, className)}>
      <div className="min-h-0 flex-1">
        <RulesetEditor
          {...editorProps}
          ref={editorRef}
          initialNodes={flow.graph.nodes}
          initialEdges={flow.graph.edges}
          initialGroups={flow.graph.groups}
          initialSubflows={flow.graph.subflows}
          chainName={flow.name}
          nodeMenuItems={menuItems}
          bannerSlot={banner}
          onSave={onSave ? (s) => onSave({ ...s, dirty: draft.dirty }) : undefined}
          onChange={(g) => { draft.onGraphChange(g); onChange?.(g); }}
          className="h-full"
        />
      </div>

      {links.list && <LinkHitsDialog title={links.list.title} hits={links.list.hits} here={here} onPick={links.pick} onClose={links.closeList} />}
      {conflict && !merge.outcome && (
        <ConflictDialog info={conflict} canMerge={merge.canMerge} busy={merge.busy} error={merge.error} actions={conflictActions}
          onMerge={() => { void merge.merge(conflict); }} onClose={() => { merge.clearError(); onConflictClose?.(); }} />
      )}
      {merge.outcome && (
        <MergedDialog info={merge.outcome.info} result={merge.outcome.result} theirs={merge.outcome.theirs.graph}
          onClose={() => { merge.closeOutcome(); onConflictClose?.(); }} />
      )}
    </div>
  );
}
