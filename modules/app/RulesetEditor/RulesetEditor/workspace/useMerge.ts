'use client';
import { useCallback, useState } from 'react';
import { mergeGraphs, type MergeResult } from '../../graph/merge';
import type { RulesetGraph } from '../hooks/useGraphEditor';
import { useMessages } from '../messages';
import type { ConflictInfo, LoadedFlow } from './types';

type Options = {
  id: string | null;
  /** the host's current version of this flow (what `theirs` is) */
  loadFlow?: (id: string) => Promise<LoadedFlow | null | undefined>;
  getGraph: () => RulesetGraph | undefined;
  /** what the flow was when it was opened or last saved */
  baseline: () => RulesetGraph;
  replaceGraph: (graph: RulesetGraph, options?: { key?: string; fit?: boolean }) => void;
  /** the host's version is the new baseline */
  rebase: (graph: RulesetGraph) => void;
  onMerged?: (theirs: LoadedFlow, result: MergeResult) => void;
  /** the normal form of a graph (the editor's `ensureFlowInput`), applied to the host's version before the merge */
  normalize?: (graph: RulesetGraph) => RulesetGraph;
};

export type MergeOutcome = { result: MergeResult; theirs: LoadedFlow; info: ConflictInfo };

/**
 * The "Merge" of the conflict dialog: someone saved this flow while it was open here. The host's version is read
 * (`loadFlow`), merged with the changes made here, and put in the editor as one undo step. Nothing is sent: the
 * merged flow is saved with the host's own save, on the new revision.
 */
export function useMerge({ id, loadFlow, getGraph, baseline, replaceGraph, rebase, onMerged, normalize }: Options) {
  const m = useMessages();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<MergeOutcome | null>(null);
  const canMerge = !!loadFlow && !!id;

  const merge = useCallback(async (info: ConflictInfo) => {
    if (!loadFlow || !id) return;
    setBusy(true);
    setError(null);
    try {
      const theirs = await loadFlow(id);
      const mine = getGraph();
      if (!theirs || !mine) { setError(m.wsMergeReadFail); return; }
      const result = mergeGraphs(baseline(), mine, normalize ? normalize(theirs.graph) : theirs.graph);
      replaceGraph(result.graph, { key: 'merge' });
      // the host's version is the new "saved" state; the merged flow is a change on top of it
      rebase(theirs.graph);
      setOutcome({ result, theirs, info });
      onMerged?.(theirs, result);
    } catch {
      setError(m.wsMergeReadFail);
    } finally {
      setBusy(false);
    }
  }, [loadFlow, id, getGraph, baseline, replaceGraph, rebase, onMerged, normalize, m]);

  return { canMerge, busy, error, outcome, merge, closeOutcome: () => setOutcome(null), clearError: () => setError(null) };
}
