import type { RulesetGraph } from '../hooks/useGraphEditor';

export type FlowKind = 'flow' | 'subflow';

/** a flow or a subflow of the host */
export type WorkspaceFlow = {
  id: string;
  kind: FlowKind;
  name: string;
};

/** the flow open in the editor; `id: null` is a flow that is not saved yet */
export type ActiveFlow = {
  id: string | null;
  kind: FlowKind;
  name: string;
  graph: RulesetGraph;
};

/** a flow as the host has it */
export type LoadedFlow = { name?: string; graph: RulesetGraph };

/** a conflict the host found when it saved: someone saved this flow in the meantime */
export type ConflictInfo = {
  /** seconds since the epoch, when the other version was saved */
  at?: number;
  by?: string;
};

export type FlowRef = { kind: FlowKind; id: string };
