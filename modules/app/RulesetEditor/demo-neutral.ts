/**
 * A sample that has nothing to do with devices: a business flow with the blocks any automation product has (a
 * schedule, a webhook in, a comparison, a notification, a webhook out). It shows that the editor takes the blocks of
 * any catalog; the IoT demos (`demo.ts`) stay for the device case. Used by the showcase, not by the editor.
 */
import { catalogFromBlocks, type RawBlock } from './catalog/fromBlocks';
import type { ParamChoices } from './catalog/types';
import type { RuleEdge, RuleNode } from './types';
import { diffView } from './graph/diff-view';

const BLOCKS: RawBlock[] = [
  {
    type: 'trigger.schedule', group: 'input', icon: 'calendar', title: 'Schedule', description: 'At a time of day, on chosen weekdays',
    summary: '${time}',
    params: { time: { type: 'time', default: '08:00' }, weekdays: { type: 'weekdays', default: [1, 2, 3, 4, 5] } },
  },
  {
    type: 'trigger.webhook_in', group: 'input', icon: 'link', title: 'Webhook in', description: 'A call to a URL of this system starts the flow',
    summary: '${path}',
    params: { path: { type: 'path', default: '/hooks/invoices', label: 'Path' }, secret: { type: 'secret', label: 'Shared secret' } },
  },
  {
    type: 'cond.compare', group: 'function', icon: 'equals', title: 'Compare', description: 'Send the message down yes or no by comparing a value',
    summary: '${path} ${op} ${value}',
    params: {
      path: { type: 'path', default: 'msg.payload.overdue', label: 'Look at' },
      op: { type: 'enum', options: ['eq', 'gt', 'lt'], option_labels: { eq: '=', gt: '>', lt: '<' }, default: 'gt' },
      value: { type: 'value', default: { kind: 'num', v: 0 }, label: 'Compare with' },
    },
    outputs: ['yes', 'no'],
  },
  {
    type: 'action.notify', group: 'output', icon: 'bell', title: 'Send a notification', description: 'Tell a person or a team',
    summary: '${channel} ${to}',
    params: {
      channel: { type: 'enum', options: ['email', 'chat', 'sms'], option_labels: { email: 'Email', chat: 'Chat', sms: 'SMS' }, default: 'email' },
      to: { type: 'source', source: 'teams', required: true, label: 'Send to' },
      text: { type: 'template', default: '{{ msg.payload.overdue }} invoices are overdue.', label: 'Text' },
    },
    outputs: [],
  },
  {
    type: 'action.webhook', group: 'output', icon: 'globe', title: 'Call a webhook', description: 'Send the message to a URL',
    summary: '${method} ${url}',
    params: {
      url: { type: 'string', required: true, label: 'URL', hint: 'https://…' },
      method: { type: 'enum', options: ['POST', 'PUT'], default: 'POST' },
      token: { type: 'secret', label: 'Bearer token' },
    },
    outputs: [],
  },
];

export const NEUTRAL_CATALOG = catalogFromBlocks([BLOCKS]);

/** the list the `to` field offers (a host injects it) */
export const NEUTRAL_CHOICES: ParamChoices = {
  teams: [{ value: 'finance', label: 'Finance team' }, { value: 'sales', label: 'Sales team' }, { value: 'ops', label: 'Operations' }],
};

const node = (nodeId: string, type: string, label: string, x: number, y: number, config: Record<string, unknown> = {}): RuleNode => ({ nodeId, type, label, x, y, config });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

/** every Monday: if invoices are overdue, tell finance and update the CRM */
export const NEUTRAL_FLOW: { nodes: RuleNode[]; edges: RuleEdge[] } = {
  nodes: [
    node('n1', 'trigger.schedule', 'Every Monday', 0, 40, { time: '08:00', weekdays: [1] }),
    node('n2', 'cond.compare', 'Overdue invoices?', 280, 40, { path: 'msg.payload.overdue', op: 'gt', value: { kind: 'num', v: 0 } }),
    node('n3', 'action.notify', 'Tell finance', 560, 0, { channel: 'email', to: 'finance', text: '{{ msg.payload.overdue }} invoices are overdue.' }),
    node('n4', 'action.webhook', 'Update the CRM', 560, 140, { url: 'https://crm.example.com/api/overdue', method: 'POST' }),
  ],
  edges: [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'yes', 'n3'), edge('e3', 'n2', 'yes', 'n4')],
};

/**
 * The next version of the flow, for the version compare demo: the threshold is raised, the CRM call is gone and a
 * webhook to the accounting system is new.
 */
export const NEUTRAL_FLOW_NEXT: { nodes: RuleNode[]; edges: RuleEdge[] } = {
  nodes: [
    NEUTRAL_FLOW.nodes[0],
    { ...NEUTRAL_FLOW.nodes[1], config: { ...NEUTRAL_FLOW.nodes[1].config, value: { kind: 'num', v: 5 } } },
    NEUTRAL_FLOW.nodes[2],
    node('n5', 'action.webhook', 'Tell accounting', 560, 280, { url: 'https://accounting.example.com/api/overdue', method: 'POST' }),
  ],
  edges: [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'yes', 'n3'), edge('e4', 'n2', 'yes', 'n5')],
};

/** both versions in one graph, with the tints (`RulesetEditor readOnly diffTint`) */
export const NEUTRAL_DIFF = diffView(NEUTRAL_FLOW, NEUTRAL_FLOW_NEXT);
