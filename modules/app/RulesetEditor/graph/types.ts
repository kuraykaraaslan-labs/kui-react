import type { RuleEdge, RuleGroup, RuleNode } from '../types';

/**
 * The graph the editor works on. A node has any string type: one of the built-in types, or a block
 * type of the catalog the editor was given.
 */

export type GraphNode = RuleNode;
export type GraphEdge = RuleEdge;
export type { RuleGroup };

/** token names of the eight group colours, by `RuleGroup.color` */
export const GROUP_COLORS = ['primary', 'success', 'warning', 'error', 'info', 'secondary', 'text-secondary', 'border-strong'] as const;

export type Graph<N extends GraphNode = GraphNode, E extends GraphEdge = GraphEdge> = {
  nodes: N[];
  edges: E[];
  groups: RuleGroup[];
};

/** ids of flows: lower case letters, digits, `_` and `-` */
export const ID_RE = /^[a-z0-9_-]{1,32}$/;

/** the entry block of a callable flow: at most one per flow */
export const FLOW_INPUT = 'trigger.flow_input';
/** the terminal block that forwards the message to the `flow_input` of another flow */
export const FLOW_RUN = 'action.flow_run';
