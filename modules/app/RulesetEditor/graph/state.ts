import { stable } from './history';
import { clone } from './ids';
import type { GraphEdge, GraphNode, RuleGroup } from './types';

/**
 * Everything undo and redo step over: the graph of the chain. Selection, view and the open panel are not
 * part of it.
 */
export type EditorState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: RuleGroup[];
};

export function snapshotOf(state: EditorState): string {
  return stable(state);
}

export function stateOf(snapshot: string): EditorState {
  const raw = JSON.parse(snapshot) as Partial<EditorState>;
  return { nodes: raw.nodes ?? [], edges: raw.edges ?? [], groups: raw.groups ?? [] };
}

export { clone };
