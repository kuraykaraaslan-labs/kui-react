/**
 * A sample for the showcase and the demo page: a small catalog written the way `blocks.d` files of
 * roltek-automation-1 are (enum with labels, `when`, dynamic outputs, host lists, a script, secrets),
 * the lists a host injects, and a flow that uses a group, calls another flow and has one problem to find.
 * Not used by the editor itself.
 */
import { FLOW_BLOCKS, FLOWS_SOURCE } from './catalog/flow';
import { catalogFromBlocks, type RawBlock } from './catalog/fromBlocks';
import type { ParamChoices } from './catalog/types';
import type { RuleChain } from './types';

const BLOCKS: RawBlock[] = [
  {
    type: 'trigger.schedule', group: 'input', icon: 'calendar', title: 'Schedule',
    description: 'At a time of day, by cron, or at sunrise / sunset',
    summary: '${mode} ${time}',
    params: {
      mode: { type: 'enum', options: ['daily', 'cron', 'sun'], default: 'daily' },
      time: { type: 'time', default: '08:00', when: { param: 'mode', value: 'daily' } },
      weekdays: { type: 'weekdays', default: [], when: { param: 'mode', value: 'daily' } },
      cron: { type: 'cron', default: '0 8 * * 1-5', when: { param: 'mode', value: 'cron' } },
      sun: { type: 'enum', options: ['rise', 'set'], default: 'set', when: { param: 'mode', value: 'sun' } },
      offset_min: { type: 'number', int: true, min: -720, max: 720, default: 0, unit: 'min', when: { param: 'mode', value: 'sun' } },
    },
  },
  {
    type: 'trigger.mqtt_in', group: 'input', icon: 'tower-broadcast', title: 'MQTT in',
    description: 'A message on a topic of a broker',
    summary: '${topic}',
    params: {
      broker: { type: 'source', source: 'brokers', required: true },
      topic: { type: 'topic', required: true, hint: 'MQTT filters such as site/+/temp are fine' },
    },
  },
  {
    type: 'cond.compare', group: 'function', icon: 'equals', title: 'Compare',
    description: 'Send the message down yes or no by comparing a value',
    summary: '${path} ${op} ${value}',
    params: {
      path: { type: 'path', default: 'msg.payload.temp', label: 'Look at' },
      op: { type: 'enum', options: ['eq', 'gt', 'lt', 'between'], option_labels: { eq: '=', gt: '>', lt: '<', between: 'between' }, default: 'gt' },
      value: { type: 'value', default: { kind: 'num', v: 30 } },
    },
  },
  {
    type: 'logic.switch', group: 'function', icon: 'shuffle', title: 'Switch',
    description: 'One output per rule, and an else',
    outputs: { dynamic: 'rules', prefix: 'o', max: 8, extra: ['else'] },
    params: {
      rules: {
        type: 'rules', max: 8,
        items: {
          op: { type: 'enum', options: ['eq', 'gt', 'lt', 'empty'], option_labels: { eq: 'equals', gt: 'is above', lt: 'is below', empty: 'is empty' }, default: 'eq' },
          value: { type: 'value', when: { param: 'op', not: ['empty'] } },
          label: { type: 'string', hint: 'Name of the output' },
        },
      },
    },
  },
  {
    type: 'logic.script', group: 'function', icon: 'file-code', title: 'Script (JavaScript)',
    description: 'Your own JavaScript on each message; return an array to use several outputs',
    outputs: { count: 'outputs', prefix: 'o', max: 4 },
    params: {
      code: { type: 'code', lang: 'js', store: 'script', required: true, label: 'Code', default: '// msg.payload is the incoming data\nreturn msg;' },
      outputs: { type: 'number', int: true, min: 1, max: 4, default: 1, pins: 'labels' },
      labels: { type: 'string', max_len: 128, default: '', label: 'Output names', hint: 'Comma separated, one per output' },
    },
  },
  {
    type: 'logic.delay', group: 'function', icon: 'hourglass-half', title: 'Delay',
    summary: '${hold}',
    params: { hold: { type: 'duration', min: 0, max: 3_600_000, default: 5000, label: 'Hold for' } },
  },
  {
    type: 'action.notify', group: 'output', icon: 'envelope', title: 'Notify', risk: 'external',
    description: 'Send a message to one or more channels',
    summary: '${channels}',
    params: {
      channels: { type: 'source', source: 'channels', multiple: true, required: true },
      message: { type: 'template', required: true, hint: 'Use {{msg.payload.temp}} to put a value in' },
      token: { type: 'secret', label: 'API token', hint: 'Left out of exports' },
    },
  },
  {
    type: 'action.mqtt_out', group: 'output', icon: 'paper-plane', title: 'MQTT out',
    summary: '${topic}',
    params: {
      broker: { type: 'source', source: 'brokers', required: true },
      topic: { type: 'topic', required: true },
      retain: { type: 'bool', default: false, hint: 'Keep the last message on the broker' },
    },
  },
  {
    type: 'action.adc_alarm', group: 'output', icon: 'sliders', title: 'Analog alarm threshold', risk: 'control',
    description: 'Change the alarm thresholds of an analog input',
    summary: '${channel} ${mode}',
    params: {
      channel: { type: 'source', source: 'adc_channels', default: 'adc1' },
      mode: { type: 'enum', options: ['high', 'low', 'both', 'clear'], option_labels: { high: 'Upper', low: 'Lower', both: 'Both', clear: 'Turn off' }, default: 'high' },
      high: { type: 'value', default: { kind: 'path', v: 'msg.payload' }, when: { param: 'mode', value: ['high', 'both'] } },
      low: { type: 'value', when: { param: 'mode', value: ['low', 'both'] } },
      hysteresis: { type: 'number', min: 0, hint: 'Empty keeps the stored value' },
    },
  },
  {
    type: 'action.log', group: 'debug', icon: 'clipboard-list', title: 'Log',
    summary: '${level}: ${text}',
    params: {
      level: { type: 'enum', options: ['info', 'warn', 'error'], default: 'info' },
      text: { type: 'text', default: 'Got a message' },
    },
  },
];

/** the sample catalog, in the roltek-automation-1 shape (error port on every node with an input) */
export const DEMO_CATALOG = catalogFromBlocks([BLOCKS, FLOW_BLOCKS]);

/** the lists a host app would inject for `source` fields */
export const DEMO_CHOICES: ParamChoices = {
  brokers: [{ value: 'broker-lan', label: 'LAN broker' }, { value: 'broker-cloud', label: 'Cloud broker' }],
  channels: [{ value: 'email', label: 'E-mail' }, { value: 'sms', label: 'SMS' }, { value: 'webhook', label: 'Webhook' }],
  adc_channels: [{ value: 'adc1', label: 'Analog input 1' }, { value: 'adc2', label: 'Analog input 2' }],
  // the callable flows of the workspace (every flow has a Flow input block), the open one left out
  [FLOWS_SOURCE]: [{ value: 'escalation', label: 'Escalation' }, { value: 'night-shift', label: 'Night shift' }],
};

/**
 * A flow with its fixed Flow input, a group (n1 and n2), a Run flow block at the end of a chain, a connection from an error
 * port, and a notify block without a channel: the editor marks it and lists the problem.
 */
export const DEMO_FLOW: Pick<RuleChain, 'nodes' | 'edges' | 'groups'> = {
  nodes: [
    // the fixed Flow input every flow has (not wired: it does not have to be)
    { nodeId: 'flow_input', type: 'trigger.flow_input', label: 'Flow input', x: -192, y: 80, config: {} },
    { nodeId: 'n1', type: 'trigger.mqtt_in', label: 'Boiler temperature', x: 40, y: 80, config: { broker: 'broker-lan', topic: 'site/boiler/temp' } },
    { nodeId: 'n2', type: 'cond.compare', label: 'Too hot?', x: 260, y: 80, config: { path: 'msg.payload.temp', op: 'gt', value: { kind: 'num', v: 90 } } },
    { nodeId: 'n3', type: 'logic.delay', label: 'Hold 2 min', x: 480, y: 40, config: { hold: 120000 } },
    { nodeId: 'n4', type: 'action.notify', label: 'Tell the operator', x: 720, y: 20, config: { message: 'Boiler is at {{msg.payload.temp}} °C' } },
    { nodeId: 'n5', type: 'action.log', label: 'Log it', x: 480, y: 190, config: { level: 'info', text: 'Boiler is fine' } },
    { nodeId: 'n6', type: 'action.log', label: 'Log the error', x: 480, y: 330, config: { level: 'error', text: 'Compare failed' } },
    { nodeId: 'n7', type: 'action.flow_run', label: 'Escalate', x: 720, y: 150, config: { flow: 'escalation' } },
  ],
  edges: [
    { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' },
    { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'yes', targetNodeId: 'n3', targetPort: 'in' },
    { edgeId: 'e3', sourceNodeId: 'n3', sourcePort: 'out', targetNodeId: 'n4', targetPort: 'in' },
    { edgeId: 'e4', sourceNodeId: 'n3', sourcePort: 'out', targetNodeId: 'n7', targetPort: 'in' },
    { edgeId: 'e5', sourceNodeId: 'n2', sourcePort: 'no', targetNodeId: 'n5', targetPort: 'in' },
    { edgeId: 'e6', sourceNodeId: 'n2', sourcePort: 'error', targetNodeId: 'n6', targetPort: 'in' },
  ],
  groups: [{ groupId: 'g1', name: 'Sensing', color: 4, nodeIds: ['n1', 'n2'] }],
};
