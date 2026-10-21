import type { RulesetGraph } from '../hooks/useGraphEditor';

/** a flow of the host */
export type WorkspaceFlow = {
  id: string;
  name: string;
  /**
   * A Run flow block can run this flow. Every flow has its fixed Flow input block, so a flow is callable unless the host
   * says `false`.
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
