'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDraftStore, draftKey, DRAFT_DELAY_MS, type Draft, type DraftStore } from '../../graph/draft';
import { secretByName, type SecretTest } from '../../graph/scrub';
import { snapshotOf, stateOf } from '../../graph/state';
import type { RulesetGraph } from '../hooks/useGraphEditor';

const keep0 = (graph: RulesetGraph) => graph;

export type DraftOffer = { draft: Draft; stale: boolean };

export type UseDraft = {
  /** the graph differs from the saved one */
  dirty: boolean;
  /** a draft found on opening: restore or discard it */
  offer: DraftOffer | null;
  /** feed it every change of the editor (its `onChange`) */
  onGraphChange: (graph: RulesetGraph) => void;
  /** write the draft now (before leaving); true when there is nothing to keep or it was kept */
  keep: () => boolean;
  /** put the offered draft in the editor as one undo step */
  restore: () => void;
  discard: () => void;
  /** the graph was saved: it is the new baseline and the draft goes */
  markSaved: (graph?: RulesetGraph) => void;
  /** another version is now the baseline (after a merge); what is open stays a change on top of it */
  rebase: (graph: RulesetGraph) => void;
  /** the baseline graph: what the flow was when it was opened or last saved */
  baseline: () => RulesetGraph;
};

type Options = {
  id: string | null;
  /** the graph the editor starts from (and the baseline) */
  initial: RulesetGraph;
  readOnly?: boolean;
  getGraph: () => RulesetGraph | undefined;
  replaceGraph: (graph: RulesetGraph, options?: { key?: string; fit?: boolean }) => void;
  store?: DraftStore;
  /** which settings are secrets, for the default store (the draft keeps none of them); by key name when absent */
  secretTest?: SecretTest;
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Put a graph in its normal form before it is compared or kept: the baseline, a restored draft, a saved or rebased
   * graph (`ensureFlowInput` for a catalog with the Flow input block). It must be what the editor applies to the graphs
   * it loads, so the editor never starts dirty. Identity by default.
   */
  normalize?: (graph: RulesetGraph) => RulesetGraph;
};

/**
 * The browser draft of the flow open in the editor. Meant for one flow: give the component that uses it a `key`
 * of its own per flow. Every change starts a timer (about 0.8 s); when it runs the draft is written. Nothing is
 * kept while the graph equals the baseline, and the draft goes when a change is undone back to it.
 */
export function useDraft({ id, initial: initialRaw, readOnly = false, getGraph, replaceGraph, store: storeProp, secretTest = secretByName, onDirtyChange, normalize = keep0 }: Options): UseDraft {
  const store = useMemo(() => storeProp ?? createDraftStore(undefined, secretTest), [storeProp, secretTest]);
  const key = draftKey(id);
  const [initial] = useState(() => normalize(initialRaw));
  const [initSnap] = useState(() => snapshotOf(initial));
  const baseGraph = useRef(initial);
  const baseSnap = useRef<string>(initSnap);
  const current = useRef(initSnap);
  const timer = useRef<number | null>(null);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);
  const [offer, setOffer] = useState<DraftOffer | null>(null);
  const offerRef = useRef<DraftOffer | null>(null);
  const onDirtyRef = useRef(onDirtyChange);
  useEffect(() => { onDirtyRef.current = onDirtyChange; });

  const setDirty = useCallback((value: boolean) => {
    if (dirtyRef.current === value) return;
    dirtyRef.current = value;
    setDirtyState(value);
    onDirtyRef.current?.(value);
  }, []);

  const hideOffer = useCallback(() => { offerRef.current = null; setOffer(null); }, []);

  const stopTimer = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
  }, []);

  const write = useCallback(() => store.write(key, current.current, baseSnap.current), [store, key]);

  /* a draft found on opening is offered (read in an effect: storage is not there on the server) */
  useEffect(() => {
    if (readOnly) return;
    const draft = store.read(key, baseSnap.current);
    if (!draft) return;
    const next = { draft, stale: store.isStale(draft, baseSnap.current) };
    offerRef.current = next;
    setOffer(next);
  }, [store, key, readOnly]);

  /* leaving the page or the flow with a change not yet written: write it now */
  useEffect(() => () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
      if (dirtyRef.current && !readOnly) store.write(key, current.current, baseSnap.current);
    }
  }, [store, key, readOnly]);

  /* the tab is closed or reloaded within the delay: write at once (an unmount does not run then) */
  useEffect(() => {
    if (readOnly) return;
    const flush = () => {
      if (timer.current !== null && dirtyRef.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
        store.write(key, current.current, baseSnap.current);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [store, key, readOnly]);

  const onGraphChange = useCallback((graph: RulesetGraph) => {
    if (readOnly) return;
    const snap = snapshotOf(graph);
    current.current = snap;
    if (snap === baseSnap.current) {
      // undone back to the saved state: nothing to keep
      stopTimer();
      setDirty(false);
      if (!offerRef.current) store.clear(key);
      return;
    }
    // the first change after a draft was offered replaces it
    if (offerRef.current) hideOffer();
    setDirty(true);
    stopTimer();
    timer.current = window.setTimeout(() => { timer.current = null; if (dirtyRef.current) write(); }, DRAFT_DELAY_MS);
  }, [readOnly, stopTimer, setDirty, store, key, hideOffer, write]);

  const keep = useCallback(() => {
    if (readOnly || !dirtyRef.current) return true;
    stopTimer();
    return write();
  }, [readOnly, stopTimer, write]);

  const restore = useCallback(() => {
    const o = offerRef.current;
    hideOffer();
    if (!o) return;
    let restored: RulesetGraph;
    try {
      // one undo step: undo goes back to what was open before
      restored = normalize(stateOf(o.draft.snap));
      replaceGraph(restored, { key: 'draft-restore', fit: true });
    } catch {
      return;
    }
    current.current = snapshotOf(restored);
    setDirty(current.current !== baseSnap.current);
  }, [hideOffer, replaceGraph, setDirty, normalize]);

  const discard = useCallback(() => {
    store.clear(key);
    hideOffer();
  }, [store, key, hideOffer]);

  const markSaved = useCallback((graph?: RulesetGraph) => {
    const g = normalize(graph ?? getGraph() ?? baseGraph.current);
    baseGraph.current = g;
    baseSnap.current = snapshotOf(g);
    current.current = baseSnap.current;
    stopTimer();
    store.clear(key);
    hideOffer();
    setDirty(false);
  }, [getGraph, stopTimer, store, key, hideOffer, setDirty, normalize]);

  const rebase = useCallback((graphRaw: RulesetGraph) => {
    const graph = normalize(graphRaw);
    baseGraph.current = graph;
    baseSnap.current = snapshotOf(graph);
    const live = getGraph();
    if (live) current.current = snapshotOf(live);
    setDirty(current.current !== baseSnap.current);
  }, [getGraph, setDirty, normalize]);

  const baseline = useCallback(() => baseGraph.current, []);

  return { dirty, offer, onGraphChange, keep, restore, discard, markSaved, rebase, baseline };
}
