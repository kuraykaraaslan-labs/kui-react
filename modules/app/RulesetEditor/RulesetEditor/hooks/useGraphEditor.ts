'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createHistory, type History } from '../../graph/history';
import { snapshotOf, stateOf, type EditorState } from '../../graph/state';
import type { Graph } from '../../graph/types';

/** What the editor hands to its host: the nodes, connections and groups of the flow. */
export type RulesetGraph = EditorState;

export type GraphEditor = {
  state: EditorState;
  /** the graph on the canvas (the state itself: the editor shows one flow) */
  graph: Graph;
  /** always the latest graph, also inside a handler that runs before the next render */
  getGraph: () => Graph;
  getState: () => EditorState;
  /** change the graph without a history step (while dragging); call `commit` when done */
  setGraph: (fn: (graph: Graph) => Graph) => void;
  setState: (fn: (state: EditorState) => EditorState) => void;
  /** push the present state as a history step; steps with the same key within a second join */
  commit: (key?: string) => void;
  apply: (fn: (graph: Graph) => Graph, key?: string) => void;
  applyState: (fn: (state: EditorState) => EditorState, key?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  history: History;
};

/**
 * The state of the editor with undo and redo. Selection, view and open panels are not in it: only what
 * `snapshotOf` covers is stepped over. `onChange` runs after every committed change, undo and redo.
 */
export function useGraphEditor(initial: EditorState, onChange?: (graph: RulesetGraph) => void): GraphEditor {
  const [state, setStateValue] = useState(initial);
  const [history] = useState(() => {
    const h = createHistory();
    h.reset(snapshotOf(initial));
    return h;
  });
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const put = useCallback((next: EditorState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const notify = useCallback(() => onChangeRef.current?.(stateRef.current), []);

  const getGraph = useCallback((): Graph => stateRef.current, []);
  const getState = useCallback(() => stateRef.current, []);

  const setGraph = useCallback((fn: (graph: Graph) => Graph) => {
    const next = fn(stateRef.current);
    put({ nodes: next.nodes, edges: next.edges, groups: next.groups });
  }, [put]);

  const setState = useCallback((fn: (s: EditorState) => EditorState) => put(fn(stateRef.current)), [put]);

  const commit = useCallback((key?: string) => {
    if (history.push(snapshotOf(stateRef.current), key)) {
      bump();
      notify();
    }
  }, [history, notify]);

  const apply = useCallback((fn: (graph: Graph) => Graph, key?: string) => {
    setGraph(fn);
    commit(key);
  }, [setGraph, commit]);

  const applyState = useCallback((fn: (s: EditorState) => EditorState, key?: string) => {
    setState(fn);
    commit(key);
  }, [setState, commit]);

  const restore = useCallback((snapshot: string | null) => {
    if (snapshot === null) return;
    const next = stateOf(snapshot);
    put(next);
    bump();
    notify();
  }, [put, notify]);

  const undo = useCallback(() => restore(history.undo()), [history, restore]);
  const redo = useCallback(() => restore(history.redo()), [history, restore]);

  return {
    state, graph: state, getGraph, getState, setGraph, setState, commit, apply, applyState,
    undo, redo, canUndo: history.canUndo(), canRedo: history.canRedo(), history,
  };
}
