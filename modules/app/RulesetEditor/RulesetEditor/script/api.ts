/**
 * The script API of the automation `logic.script` block, as the editor shows it (phase 06 §6.4 and §6.5 of
 * next-boilerplate, and the router's own help for the same block): the signature line over the code field and the
 * reference in the node panel's Help tab. JavaScript only. One list, so the line and the help cannot drift apart.
 * English markdown, drawn by `help/markdown.tsx` (escaped).
 */

/** the name a code param carries in `ParamSpec.api` when it is such a script */
export const SCRIPT_API = 'automation-script';

/** what the script gets and what it may return, in one read-only line */
export const SCRIPT_SIGNATURE = 'msg, node, context, flow, global, env  →  return msg | [a, b] | [[a, b]] | "label" | nothing';

export const SCRIPT_API_HELP = `# Script API

The code runs once for each message, in an isolated JavaScript sandbox with no network, no files and no timers.

## What the code sees

| Name | What it is |
|---|---|
| \`msg\` | the message, a copy you may change; \`msg.metadata\` is writable except the system fields, \`msg.msgType\` and \`msg.originator\` are read only |
| \`node.send(msg)\` | send a message on output 1 at once (\`node.send([a, b])\` picks outputs as a return does) |
| \`node.status({ fill, shape, text })\` | the status shown under the block |
| \`node.warn(value)\`, \`node.error(text)\` | write to the block's log; they never reach the server log |
| \`context\`, \`flow\`, \`global\` | \`get("key")\` and \`set("key", value)\`: this block, this flow, all flows |
| \`env.get(name)\` | a flow parameter |
| \`console.log(value)\` | the same log as \`node.warn\` |

## What it may return

- \`return msg\` sends the message on output 1.
- \`return [a, b]\` sends \`a\` on output 1 and \`b\` on output 2, up to 4 outputs; \`null\` in the list sends nothing there.
- \`return [[a, b]]\` sends both on output 1.
- \`return "label"\` sends the incoming message on the output with that name.
- Returning nothing sends nothing: the message stops here.

## Helpers

- \`bytes\`: \`fromHex\`, \`toHex\`, \`fromBase64\`, \`toBase64\`, \`sha256\`, \`toText\`, \`fromText\`, \`readUint\`, \`readInt\`, \`readFloat\`, \`writeUint\`, \`writeInt\`, \`writeFloat\`; also \`TextEncoder\` and \`TextDecoder\`.
- \`num\`: \`round(value, digits)\` rounds half up on the shortest decimal; \`toHex(value, { bytes, bigEndian, prefix })\`.
- \`bits\`: \`fromBytes\`, \`fromInt\`, \`toInt\`, \`get\`.
- \`obj\`: \`flatten(value, { separator, exclude, pathInKey })\`.
- \`time\`: \`parse\`, \`format\`, \`add\`, \`fields\` with patterns like \`yyyy-MM-dd HH:mm:ss\` and IANA zones.

## Not there

\`require\`, \`import()\`, \`eval\`, \`Function\`, \`fetch\`, timers (use a Delay block), \`process\`, \`Buffer\`, \`WebAssembly\`, \`SharedArrayBuffer\`. There is no \`util\` object. A very long script (over 8 KiB) gets a warning.
`;

/** One name of the script API for completion and hover: what to type, what it is (short), and a line of help. */
export type ScriptApiItem = { label: string; insertText?: string; detail: string; doc: string };

const helpers = (ns: string, names: string[], what: string): ScriptApiItem[] =>
  names.map((n) => ({ label: `${ns}.${n}`, insertText: `${ns}.${n}(`, detail: `${ns} helper`, doc: `${ns}.${n}(…): ${what}` }));

/**
 * The names the code field completes and explains on hover: the same list as `SCRIPT_API_HELP` (msg, node, context,
 * flow, global, env, console and the helper namespaces of phase 06 §6.5), so completion, hover and help cannot drift.
 */
export const SCRIPT_API_ITEMS: ScriptApiItem[] = [
  { label: 'msg', detail: 'message', doc: 'msg: the message, a copy you may change.' },
  { label: 'msg.payload', detail: 'any', doc: 'msg.payload: the body of the message.' },
  { label: 'msg.metadata', detail: 'object', doc: 'msg.metadata: writable except the system fields.' },
  { label: 'msg.msgType', detail: 'string, read only', doc: 'msg.msgType: the type of the message (read only).' },
  { label: 'msg.originator', detail: '{ type, id }, read only', doc: 'msg.originator: the entity the message is about (read only).' },
  { label: 'node', detail: 'this block', doc: 'node: send, status, warn and error of this block.' },
  { label: 'node.send', insertText: 'node.send(', detail: 'send at once', doc: 'node.send(msg): send a message on output 1 at once; node.send([a, b]) picks outputs as a return does.' },
  { label: 'node.status', insertText: 'node.status(', detail: 'block status', doc: 'node.status({ fill, shape, text }): the status shown under the block.' },
  { label: 'node.warn', insertText: 'node.warn(', detail: 'log a warning', doc: 'node.warn(value): write to the block\'s log.' },
  { label: 'node.error', insertText: 'node.error(', detail: 'log an error', doc: 'node.error(text): write an error to the block\'s log.' },
  { label: 'context', detail: 'this block\'s store', doc: 'context.get("key") and context.set("key", value): kept for this block.' },
  { label: 'context.get', insertText: 'context.get(', detail: 'read', doc: 'context.get("key"): a value kept for this block.' },
  { label: 'context.set', insertText: 'context.set(', detail: 'write', doc: 'context.set("key", value): keep a value for this block.' },
  { label: 'flow', detail: 'this flow\'s store', doc: 'flow.get("key") and flow.set("key", value): shared by the blocks of this flow.' },
  { label: 'flow.get', insertText: 'flow.get(', detail: 'read', doc: 'flow.get("key"): a value of this flow.' },
  { label: 'flow.set', insertText: 'flow.set(', detail: 'write', doc: 'flow.set("key", value): keep a value for this flow.' },
  { label: 'global', detail: 'store of all flows', doc: 'global.get("key") and global.set("key", value): shared by all flows.' },
  { label: 'global.get', insertText: 'global.get(', detail: 'read', doc: 'global.get("key"): a value shared by all flows.' },
  { label: 'global.set', insertText: 'global.set(', detail: 'write', doc: 'global.set("key", value): keep a value for all flows.' },
  { label: 'env', detail: 'flow parameters', doc: 'env.get(name): a flow parameter.' },
  { label: 'env.get', insertText: 'env.get(', detail: 'flow parameter', doc: 'env.get(name): a flow parameter.' },
  { label: 'console.log', insertText: 'console.log(', detail: 'log', doc: 'console.log(value): the same log as node.warn.' },
  { label: 'bytes', detail: 'helpers', doc: 'bytes: fromHex, toHex, fromBase64, toBase64, sha256, toText, fromText, read/write Uint, Int and Float.' },
  ...helpers('bytes', ['fromHex', 'toHex', 'fromBase64', 'toBase64', 'sha256', 'toText', 'fromText', 'readUint', 'readInt', 'readFloat', 'writeUint', 'writeInt', 'writeFloat'], 'bytes and text conversions'),
  { label: 'num', detail: 'helpers', doc: 'num: round(value, digits) rounds half up; toHex(value, { bytes, bigEndian, prefix }).' },
  ...helpers('num', ['round', 'toHex'], 'number helpers'),
  { label: 'bits', detail: 'helpers', doc: 'bits: fromBytes, fromInt, toInt, get.' },
  ...helpers('bits', ['fromBytes', 'fromInt', 'toInt', 'get'], 'bit helpers'),
  { label: 'obj', detail: 'helpers', doc: 'obj: flatten(value, { separator, exclude, pathInKey }).' },
  ...helpers('obj', ['flatten'], 'object helpers'),
  { label: 'time', detail: 'helpers', doc: 'time: parse, format, add, fields with patterns like yyyy-MM-dd HH:mm:ss and IANA zones.' },
  ...helpers('time', ['parse', 'format', 'add', 'fields'], 'date and time helpers'),
];

/** The completion of the code field: the API names, as the kui `CodeEditor` wants them. */
export function scriptSuggestions(): { label: string; insertText?: string; detail?: string; documentation?: string }[] {
  return SCRIPT_API_ITEMS.map((i) => ({ label: i.label, insertText: i.insertText, detail: i.detail, documentation: i.doc }));
}

/** The hover of the code field: the help line of a name (`msg.payload`, `node.send`, `bytes.toHex` …), or of its first part. */
export function scriptHover(word: string): string | null {
  const exact = SCRIPT_API_ITEMS.find((i) => i.label === word);
  if (exact) return exact.doc;
  const parts = word.split('.');
  for (let n = parts.length - 1; n > 0; n--) {
    const hit = SCRIPT_API_ITEMS.find((i) => i.label === parts.slice(0, n).join('.'));
    if (hit) return hit.doc;
  }
  return null;
}
