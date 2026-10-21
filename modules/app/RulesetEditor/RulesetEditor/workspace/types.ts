import type { RulesetGraph } from '../hooks/useGraphEditor';

/** a flow of the host */
export type WorkspaceFlow = {
  id: string;
  name: string;
  /**
   * The flow has a Flow input block, so a Run flow block can run it. When the host does not say, the workspace looks for the
   * block in the flow (it loads the flow through `loadFlows`); without `loadFlows` the flow is offered.
   */
  callable?: boolean;
};

/** the flow open in the editor; `id: null` is a flow that is not saved yet */
export type ActiveFlow = {
  id: string | null;
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

export type FlowRef = { id: string };
