import { describe, expect, it } from 'vitest';
import { snapshotOf, stateOf, type EditorState } from './state';
import type { GraphEdge, GraphNode } from './types';
import { createHistory } from './history';

const node = (nodeId: string, type: string): GraphNode => ({ nodeId, type, label: nodeId, x: 0, y: 0 });
const edge = (edgeId: string, from: string, port: string, to: string): GraphEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

const state: EditorState = {
  nodes: [node('a', 'trigger.boot'), node('i', 'logic.step'), node('t', 'action.log')],
  edges: [edge('e1', 'a', 'out', 'i'), edge('e2', 'i', 'out', 't')],
  groups: [],
};

describe('snapshots', () => {
  it('equal state is an equal snapshot, whatever the key order', () => {
    expect(snapshotOf(state)).toBe(snapshotOf(stateOf(snapshotOf(state))));
    expect(snapshotOf({ ...state, groups: [] })).toBe(snapshotOf(state));
  });
  it('restores a state, with empty lists for what is missing', () => {
    expect(stateOf('{}')).toEqual({ nodes: [], edges: [], groups: [] });
    expect(stateOf(snapshotOf(state))).toEqual(state);
  });
  it('ignores a `subflows` list an older snapshot may carry', () => {
    expect(stateOf(JSON.stringify({ ...state, subflows: [{ subflowId: 's' }] }))).toEqual(state);
  });
  it('works with the history', () => {
    const h = createHistory();
    h.reset(snapshotOf(state));
    const next = { ...state, nodes: state.nodes.slice(1) };
    expect(h.push(snapshotOf(next), undefined, 0)).toBe(true);
    expect(h.push(snapshotOf({ ...next }), undefined, 9000)).toBe(false);
    expect(stateOf(h.undo() as string)).toEqual(state);
    expect(stateOf(h.redo() as string)).toEqual(next);
  });
});
