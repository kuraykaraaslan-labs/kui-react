import type { RawBlock } from './fromBlocks';

/**
 * Flows that call each other, as ThingsBoard rule chains do. A flow with a `flow_input` block is callable; a
 * `flow_run` block at the end of another flow's chain forwards the message to it. Data travels in the message only:
 * there is no output node, no params passing and no return.
 *
 * The router serves these blocks from its own `blocks.d` JSON; this is the same declaration for catalogs built here
 * (the demo, tests). The `flow` param of `flow_run` is a `source` field: the host (or `FlowWorkspace`) injects the list
 * under `FLOWS_SOURCE`, the callable flows other than the open one.
 */

/** name of the choice list that holds the flows a `flow_run` block can run (`ParamChoices`) */
export const FLOWS_SOURCE = 'flows';

/** the fixed entry of a callable flow; at most one per flow */
export const FLOW_INPUT_BLOCK: RawBlock = {
  type: 'trigger.flow_input', category: 'flow', group: 'flow', icon: 'right-to-bracket', title: 'Flow input',
  description: 'The entry of this flow. Other flows can run it with a Run flow block. One per flow.',
  inputs: 0, outputs: ['out'], params: {},
};

/** the terminal block that forwards the message to another flow and never returns */
export const FLOW_RUN_BLOCK: RawBlock = {
  type: 'action.flow_run', category: 'flow', group: 'flow', icon: 'right-from-bracket', title: 'Run flow',
  description: 'Forwards the message to the Flow input of another flow. Put it at the end of a chain; nothing comes back.',
  summary: '${flow}',
  inputs: 1, outputs: [], params: { flow: { type: 'source', source: FLOWS_SOURCE, required: true, label: 'Flow' } },
};

export const FLOW_BLOCKS: RawBlock[] = [FLOW_INPUT_BLOCK, FLOW_RUN_BLOCK];
