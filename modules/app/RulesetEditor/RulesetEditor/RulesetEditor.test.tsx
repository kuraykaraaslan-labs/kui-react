import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesetEditor, type ParamEditorProps, type RulesetEditorRef, type RulesetGraph } from './index';
import { catalogFromBlocks } from '../catalog';
import type { RuleEdge, RuleNode } from '../types';

afterEach(() => cleanup());

const node = (nodeId: string, type: string, label: string, x: number, y: number, extra: Partial<RuleNode> = {}): RuleNode => ({ nodeId, type, label, x, y, ...extra });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

const NODES = [
  node('n1', 'TRIGGER', 'Source', 0, 0),
  node('n2', 'FILTER', 'Gate', 300, 0),
  node('n3', 'ACTION', 'Sink', 600, 0),
];
const EDGES = [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'true', 'n3')];

function setup(props: Partial<React.ComponentProps<typeof RulesetEditor>> = {}) {
  const ref = createRef<RulesetEditorRef>();
  const onChange = vi.fn<(g: RulesetGraph) => void>();
  const utils = render(<RulesetEditor ref={ref} initialNodes={NODES} initialEdges={EDGES} onChange={onChange} chainName="Chain" {...props} />);
  const canvas = screen.getByLabelText(props.messages?.canvasLabel ?? 'Rule chain canvas');
  const last = () => onChange.mock.calls.at(-1)?.[0];
  return { ref, onChange, canvas, last, ...utils };
}

const nodeEl = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\(`) });

/** a click on a node: press and release without moving */
function clickNode(label: string, init: PointerEventInit = {}) {
  const el = nodeEl(label);
  fireEvent.pointerDown(el, { button: 0, ...init });
  fireEvent.pointerUp(el, { button: 0, ...init });
}

async function key(canvas: HTMLElement, keys: string) {
  const user = userEvent.setup();
  canvas.focus();
  await user.keyboard(keys);
}

describe('RulesetEditor: what it shows', () => {
  it('draws the nodes and the palette of the catalog', () => {
    setup();
    expect(nodeEl('Source')).toBeInTheDocument();
    expect(nodeEl('Gate')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Routing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Filter node' })).toBeInTheDocument();
  });
  it('has no palette and no undo when read only', () => {
    setup({ readOnly: true });
    expect(screen.queryByLabelText('Node palette')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
  it('offers the blocks of another catalog', () => {
    const catalog = catalogFromBlocks([[{ type: 'trigger.quota', title: 'Quota' }, { type: 'action.wifi_set', title: 'Set Wi-Fi' }]]);
    setup({ catalog, initialNodes: [], initialEdges: [] });
    expect(screen.getByRole('button', { name: 'Add Quota node' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Filter node' })).not.toBeInTheDocument();
  });
});

describe('RulesetEditor: undo and redo', () => {
  it('starts with nothing to undo', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('undoes and redoes an added node with the buttons', async () => {
    const user = userEvent.setup();
    const { last, onChange } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Delay node' }));
    expect(last()?.nodes).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(last()?.nodes).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /^Delay \(/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(last()?.nodes).toHaveLength(4);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('works from the keyboard: Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z', async () => {
    const user = userEvent.setup();
    const { canvas, last } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Delay node' }));
    await key(canvas, '{Control>}z{/Control}');
    expect(last()?.nodes).toHaveLength(3);
    await key(canvas, '{Control>}y{/Control}');
    expect(last()?.nodes).toHaveLength(4);
    await key(canvas, '{Control>}z{/Control}');
    await key(canvas, '{Control>}{Shift>}z{/Shift}{/Control}');
    expect(last()?.nodes).toHaveLength(4);
  });

  it('is also on the ref', async () => {
    const user = userEvent.setup();
    const { ref, last } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Delay node' }));
    expect(ref.current?.getGraph().nodes).toHaveLength(4);
    act(() => ref.current?.undo());
    expect(ref.current?.getGraph().nodes).toHaveLength(3);
    act(() => ref.current?.redo());
    expect(last()?.nodes).toHaveLength(4);
  });

  it('forgets the redo steps after a new change', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Add Delay node' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Add Alarm node' }));
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});

describe('RulesetEditor: selection', () => {
  it('selects with a click, adds with Shift or Ctrl, and selects all with Ctrl+A', async () => {
    const { canvas } = setup();
    clickNode('Source');
    expect(nodeEl('Source')).toHaveAttribute('aria-pressed', 'true');
    clickNode('Gate', { shiftKey: true });
    expect(nodeEl('Source')).toHaveAttribute('aria-pressed', 'true');
    expect(nodeEl('Gate')).toHaveAttribute('aria-pressed', 'true');
    clickNode('Sink', { ctrlKey: true });
    expect(nodeEl('Sink')).toHaveAttribute('aria-pressed', 'true');
    clickNode('Gate', { shiftKey: true });
    expect(nodeEl('Gate')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerDown(canvas, { button: 0 });
    fireEvent.pointerUp(canvas, { button: 0 });
    expect(nodeEl('Source')).toHaveAttribute('aria-pressed', 'false');
    await key(canvas, '{Control>}a{/Control}');
    for (const l of ['Source', 'Gate', 'Sink']) expect(nodeEl(l)).toHaveAttribute('aria-pressed', 'true');
  });

  it('deletes the whole selection as one step, with its connections', async () => {
    const { canvas, last } = setup();
    clickNode('Gate');
    clickNode('Sink', { shiftKey: true });
    await key(canvas, '{Delete}');
    expect(last()?.nodes.map((n) => n.nodeId)).toEqual(['n1']);
    expect(last()?.edges).toEqual([]);
    await key(canvas, '{Control>}z{/Control}');
    expect(last()?.nodes).toHaveLength(3);
    expect(last()?.edges).toHaveLength(2);
  });

  it('copies, cuts and pastes a selection with the connections between its nodes', async () => {
    const { canvas, last } = setup();
    clickNode('Source');
    clickNode('Gate', { shiftKey: true });
    await key(canvas, '{Control>}c{/Control}');
    await key(canvas, '{Control>}v{/Control}');
    expect(last()?.nodes).toHaveLength(5);
    expect(last()?.edges).toHaveLength(3);
    expect(new Set(last()?.nodes.map((n) => n.nodeId)).size).toBe(5);
    await key(canvas, '{Control>}z{/Control}');
    expect(last()?.nodes).toHaveLength(3);
  });

  it('cuts', async () => {
    const { canvas, last } = setup();
    clickNode('Sink');
    await key(canvas, '{Control>}x{/Control}');
    expect(last()?.nodes.map((n) => n.nodeId)).toEqual(['n1', 'n2']);
    await key(canvas, '{Control>}v{/Control}');
    expect(last()?.nodes).toHaveLength(3);
  });
});

describe('RulesetEditor: the node panel', () => {
  it('opens on a click and writes a new label through as one history step', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    const label = within(panel).getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'Strict gate');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('Strict gate');
    expect(screen.getByRole('button', { name: /^Strict gate \(Filter\)/ })).toBeInTheDocument();
  });

  it('edits the script of a built-in node in a code field, and resets it', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    const code = within(panel).getByRole('textbox', { name: 'Script' });
    expect((code as HTMLTextAreaElement).value).toContain('return');
    await user.clear(code);
    await user.type(code, 'return false;');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.script).toBe('return false;');
    await user.click(within(panel).getByRole('button', { name: /Reset script/ }));
    expect((within(panel).getByRole('textbox', { name: 'Script' }) as HTMLTextAreaElement).value).toContain('//');
  });

  it('shows the host\'s own editor of a block type in place of the form, and stores what it writes as the params', async () => {
    const user = userEvent.setup();
    const catalog = catalogFromBlocks([[
      { type: 'trigger.quota', title: 'Quota', params: { level: { type: 'enum', options: ['exceeded', 'warning'], default: 'exceeded' } } },
      { type: 'trigger.other', title: 'Other', params: { level: { type: 'enum', options: ['exceeded', 'warning'], default: 'exceeded' } } },
    ]]);
    const seen: Array<{ type: string; disabled?: boolean }> = [];
    const QuotaEditor = ({ params, onChange, disabled, node: n, decl }: ParamEditorProps) => {
      seen.push({ type: `${n.type}/${decl.type}`, disabled });
      return (
        <button type="button" disabled={disabled} onClick={() => onChange({ ...params, level: 'warning', custom: true })}>
          custom {String(params.level)}
        </button>
      );
    };
    const { last } = setup({
      catalog, paramEditors: { 'trigger.quota': QuotaEditor },
      initialNodes: [node('a', 'trigger.quota', 'Quota', 0, 0, { config: { level: 'exceeded' } }), node('b', 'trigger.other', 'Other', 300, 0, { config: { level: 'exceeded' } })], initialEdges: [],
    });
    clickNode('Quota');
    const panel = screen.getByRole('complementary', { name: 'Quota settings' });
    expect(within(panel).queryByLabelText('Level')).not.toBeInTheDocument(); // no generated form
    await user.click(within(panel).getByRole('button', { name: 'custom exceeded' }));
    expect(last()?.nodes[0].config).toEqual({ level: 'warning', custom: true });
    expect(within(panel).getByRole('button', { name: 'custom warning' })).toBeInTheDocument();
    expect(seen[0]).toEqual({ type: 'trigger.quota/trigger.quota', disabled: false });
    // a type without an editor keeps the form
    clickNode('Other');
    expect(within(screen.getByRole('complementary', { name: 'Other settings' })).getByLabelText('Level')).toBeInTheDocument();
  });

  it('hands the custom editor `disabled` in a read-only editor', async () => {
    const user = userEvent.setup();
    const catalog = catalogFromBlocks([[{ type: 'trigger.quota', title: 'Quota', params: { level: { type: 'enum', options: ['exceeded'], default: 'exceeded' } } }]]);
    const Editor = ({ disabled }: ParamEditorProps) => <p>{disabled ? 'locked' : 'open'}</p>;
    setup({ catalog, readOnly: true, paramEditors: { 'trigger.quota': Editor }, initialNodes: [node('a', 'trigger.quota', 'Quota', 0, 0)], initialEdges: [] });
    fireEvent.contextMenu(nodeEl('Quota'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'View' }));
    expect(within(screen.getByRole('complementary', { name: 'Quota settings' })).getByText('locked')).toBeInTheDocument();
  });

  it('shows the form of a block of another catalog and stores the values as the params of the node', async () => {
    const user = userEvent.setup();
    const catalog = catalogFromBlocks([[
      { type: 'trigger.quota', title: 'Quota', params: { level: { type: 'enum', options: ['exceeded', 'warning'], default: 'exceeded' }, limit: { type: 'number', int: true, min: 1, when: { param: 'level', value: 'warning' } } } },
    ]]);
    const { last } = setup({ catalog, initialNodes: [node('a', 'trigger.quota', 'Quota', 0, 0, { config: { level: 'exceeded' } })], initialEdges: [] });
    clickNode('Quota');
    const panel = screen.getByRole('complementary', { name: 'Quota settings' });
    expect(within(panel).queryByLabelText('Limit')).not.toBeInTheDocument();
    await user.selectOptions(within(panel).getByLabelText('Level'), 'warning');
    await user.type(within(panel).getByLabelText('Limit'), '5');
    expect(last()?.nodes[0].config).toEqual({ level: 'warning', limit: 5 });
  });

  it('shows a placeholder as not available', () => {
    setup({ initialNodes: [node('p', 'PLACEHOLDER', 'Odd', 0, 0, { original: { type: 'mqtt in', source: 'node-red', outputs: ['out'] } })], initialEdges: [] });
    clickNode('Odd');
    expect(screen.getAllByText(/Not available/).length).toBeGreaterThan(0);
    expect(screen.getByText('mqtt in', { selector: 'span.font-mono.font-semibold' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: connections', () => {
  it('shows ports from the catalog, with an error port for catalogs that have one', () => {
    const catalog = catalogFromBlocks([[{ type: 'trigger.a' }, { type: 'cond.b' }]]);
    const { container } = setup({ catalog, initialNodes: [node('a', 'trigger.a', 'A', 0, 0), node('b', 'cond.b', 'B', 300, 0)], initialEdges: [] });
    expect(container.querySelectorAll('[data-in-node]')).toHaveLength(1);
    expect(container.querySelector('title')?.textContent).toMatch(/Error path/);
  });
});

describe('RulesetEditor: context menu, groups and subflows', () => {
  async function menu(label: string) {
    fireEvent.contextMenu(nodeEl(label));
    return screen.findByRole('menu');
  }

  it('groups the selected nodes, shows the frame, renames it and ungroups', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Source');
    clickNode('Gate', { shiftKey: true });
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Group…' }));
    await user.type(await screen.findByLabelText('Name'), 'Front');
    await user.click(screen.getByRole('radio', { name: 'success' }));
    await user.click(screen.getByRole('button', { name: 'Group' }));
    expect(last()?.groups).toEqual([{ groupId: 'g1', name: 'Front', color: 1, nodeIds: ['n1', 'n2'] }]);
    const tab = screen.getByRole('button', { name: /Group Front, 2 nodes/ });
    expect(tab).toBeInTheDocument();

    fireEvent.doubleClick(tab);
    const name = await screen.findByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Intake');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(last()?.groups[0].name).toBe('Intake');

    fireEvent.contextMenu(screen.getByRole('button', { name: /Group Intake/ }));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Ungroup' }));
    expect(last()?.groups).toEqual([]);
    expect(screen.queryByRole('button', { name: /Group Intake/ })).not.toBeInTheDocument();
  });

  it('selects the members of a group by its tab, and drops a node that is deleted from it', async () => {
    const { canvas, last } = setup({ initialGroups: [{ groupId: 'g1', name: 'Pair', color: 0, nodeIds: ['n2', 'n3'] }] });
    fireEvent.pointerDown(screen.getByRole('button', { name: /Group Pair/ }), { button: 0 });
    fireEvent.pointerUp(screen.getByRole('button', { name: /Group Pair/ }), { button: 0 });
    expect(nodeEl('Gate')).toHaveAttribute('aria-pressed', 'true');
    expect(nodeEl('Sink')).toHaveAttribute('aria-pressed', 'true');
    expect(nodeEl('Source')).toHaveAttribute('aria-pressed', 'false');
    clickNode('Sink');
    await key(canvas, '{Delete}');
    expect(last()?.groups).toEqual([{ groupId: 'g1', name: 'Pair', color: 0, nodeIds: ['n2'] }]);
  });

  it('skips and wakes a node', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Skip' }));
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.disabled).toBe(true);
    expect(screen.getByText('Skipped')).toBeInTheDocument();
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Wake up' }));
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.disabled).toBeUndefined();
  });

  it('duplicates a node', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Duplicate' }));
    expect(last()?.nodes).toHaveLength(4);
    expect(last()?.nodes.at(-1)).toMatchObject({ type: 'FILTER', x: 332, y: 32 });
  });

  it('converts the selection to a subflow, enters it, and goes back', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Gate');
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Convert to a subflow…' }));
    await user.type(await screen.findByLabelText('Name of the subflow'), 'My gate');
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    const graph = last()!;
    expect(graph.subflows).toHaveLength(1);
    expect(graph.subflows[0]).toMatchObject({ subflowId: 'my-gate', name: 'My gate', inputs: 1 });
    expect(graph.nodes.map((n) => n.type)).toEqual(['TRIGGER', 'ACTION', 'subflow.my-gate']);
    expect(graph.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId])).toEqual([['n1', 'out', 'n4'], ['n4', 'out', 'n3']]);
    expect(nodeEl('My gate')).toBeInTheDocument();

    fireEvent.contextMenu(nodeEl('My gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Edit the subflow' }));
    expect(screen.getByText('Subflow: My gate')).toBeInTheDocument();
    expect(nodeEl('Subflow input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Subflow output node' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Chain' }));
    expect(screen.queryByText('Subflow: My gate')).not.toBeInTheDocument();
    expect(nodeEl('Source')).toBeInTheDocument();
  });

  it('undoes the conversion in one step', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Gate');
    await user.click(within(await menu('Gate')).getByRole('menuitem', { name: 'Convert to a subflow…' }));
    await user.type(await screen.findByLabelText('Name of the subflow'), 'X');
    await user.click(screen.getByRole('button', { name: 'Convert' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(last()?.subflows).toEqual([]);
    expect(last()?.nodes.map((n) => n.type)).toEqual(['TRIGGER', 'FILTER', 'ACTION']);
  });

  it('makes a new subflow from the palette and lands inside it', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    await user.click(screen.getByRole('button', { name: /New subflow/ }));
    await user.type(await screen.findByLabelText('Name of the subflow'), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(last()?.subflows[0]).toMatchObject({ subflowId: 'fresh', outputs: ['out'] });
    expect(screen.getByText('Subflow: Fresh')).toBeInTheDocument();
    // a subflow has one input only: the block is greyed out
    expect(screen.getByRole('button', { name: 'Add Subflow input node' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('renames an output in the settings and keeps what is wired to it', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    await user.click(screen.getByRole('button', { name: /New subflow/ }));
    await user.type(await screen.findByLabelText('Name of the subflow'), 'Fresh');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Subflow settings' }));
    const out = await screen.findByLabelText('Output 1');
    await user.clear(out);
    await user.type(out, 'done');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const sf = last()!.subflows[0];
    expect(sf.outputs).toEqual(['done']);
    expect(sf.nodes.find((n) => n.type === 'port.out')?.config).toEqual({ port: 'done' });
  });

  it('cannot delete a subflow that is in use, and can delete one that is not', async () => {
    const user = userEvent.setup();
    const { last } = setup({
      initialNodes: [node('i', 'subflow.a', 'A inst', 0, 0)], initialEdges: [],
      initialSubflows: [
        { subflowId: 'a', name: 'A', inputs: 1, outputs: ['out'], params: {}, nodes: [], edges: [], groups: [] },
        { subflowId: 'b', name: 'B', inputs: 1, outputs: ['out'], params: {}, nodes: [], edges: [], groups: [] },
      ],
    });
    fireEvent.contextMenu(nodeEl('A inst'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Edit the subflow' }));
    await user.click(screen.getByRole('button', { name: 'Subflow settings' }));
    expect(screen.getByRole('button', { name: 'Delete subflow' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Back to Chain' }));
    expect(last()).toBeUndefined();
  });
});

describe('RulesetEditor: problems', () => {
  const catalog = catalogFromBlocks([[
    { type: 'trigger.a' },
    { type: 'action.log', params: { text: { type: 'string', required: true } } },
  ]]);
  const nodes = [node('a', 'trigger.a', 'A', 0, 0), node('b', 'action.log', 'Log', 300, 0, { config: {} })];

  it('counts problems, lists them and marks the node', async () => {
    const user = userEvent.setup();
    setup({ catalog, initialNodes: nodes, initialEdges: [edge('e', 'a', 'out', 'b')] });
    const button = screen.getByRole('button', { name: /Problems: 0 errors, 1 warnings/ });
    await user.click(button);
    const list = screen.getByRole('list', { name: 'Problems' });
    expect(within(list).getByText('Text is required.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Text is required.' })).toBeInTheDocument();
  });

  it('makes a missing required param an error when the chain is active', () => {
    setup({ catalog, initialNodes: nodes, initialEdges: [edge('e', 'a', 'out', 'b')], active: true });
    expect(screen.getByRole('button', { name: /Problems: 1 errors, 0 warnings/ })).toBeInTheDocument();
  });

  it('shows nothing when the graph is fine', () => {
    setup({ catalog, initialNodes: [nodes[0], { ...nodes[1], config: { text: 'x' } }], initialEdges: [edge('e', 'a', 'out', 'b')] });
    expect(screen.queryByRole('button', { name: /Problems/ })).not.toBeInTheDocument();
  });

  it('the problems are on the ref, and clear after the param is filled in', async () => {
    const user = userEvent.setup();
    const { ref } = setup({ catalog, initialNodes: nodes, initialEdges: [edge('e', 'a', 'out', 'b')] });
    expect(ref.current?.validate().warnings.map((w) => w.code)).toEqual(['required']);
    clickNode('Log');
    const panel = screen.getByRole('complementary', { name: 'Log settings' });
    await user.type(within(panel).getByLabelText(/Text/), 'hello');
    expect(ref.current?.validate()).toEqual({ errors: [], warnings: [] });
  });
});

describe('RulesetEditor: compatibility', () => {
  it('still gives nodes and edges on the ref, now with groups and subflows', () => {
    const { ref } = setup();
    expect(ref.current?.getGraph()).toEqual({ nodes: NODES, edges: EDGES, groups: [], subflows: [] });
  });
  it('does not call onChange before the first change', () => {
    const { onChange } = setup();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('RulesetEditor: secrets stay out of the copied clip', () => {
  it('keeps secret values out of the clipboard storage and the pasted node', async () => {
    window.localStorage.clear();
    const secret = node('n9', 'ACTION', 'Notify', 0, 200, { config: { url: 'https://x', api_key: 'abc123', token: { $secret: true } } });
    const { canvas, last } = setup({ initialNodes: [...NODES, secret] });
    clickNode('Notify');
    await key(canvas, '{Control>}c{/Control}');
    expect(window.localStorage.getItem('kui-ruleset-clipboard')).not.toContain('abc123');
    await key(canvas, '{Control>}v{/Control}');
    const copy = last()!.nodes.find((n) => n.nodeId !== 'n9' && n.label === 'Notify')!;
    expect(copy.config).toEqual({ url: 'https://x', token: { $secret: true } });
    expect(last()!.nodes.find((n) => n.nodeId === 'n9')!.config).toMatchObject({ api_key: 'abc123' });
  });
});

describe('RulesetEditor: the browser script runner', () => {
  const debugEntries = async (label: string) => {
    fireEvent.contextMenu(nodeEl(label));
    const items = within(await screen.findByRole('menu')).queryAllByRole('menuitem').map((i) => i.textContent);
    return items.filter((t) => /Debug/.test(t ?? ''));
  };

  it('offers Debug node, Debug chain and the palette button by default', async () => {
    setup();
    expect(screen.getByRole('button', { name: /Debug Chain/ })).toBeInTheDocument();
    expect(await debugEntries('Gate')).toEqual(['Debug node']);
  });
  it('offers none of them with browserDebug off', async () => {
    setup({ browserDebug: false });
    expect(screen.queryByRole('button', { name: /Debug Chain/ })).toBeNull();
    expect(await debugEntries('Gate')).toEqual([]);
  });
  it('offers none of them to a viewer (readOnly)', async () => {
    setup({ readOnly: true });
    expect(await debugEntries('Gate')).toEqual([]);
  });
  it('the ref opens the chain debugger only when it is on', async () => {
    const on = setup();
    act(() => on.ref.current?.openRulesetDebug());
    expect(await screen.findByText('Debug — Chain')).toBeInTheDocument();
    cleanup();
    const off = setup({ browserDebug: false });
    act(() => off.ref.current?.openRulesetDebug());
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByText('Debug — Chain')).toBeNull();
  });
});

describe('RulesetEditor: the panel writes through', () => {
  it('has no Apply button and says changes apply as you type', () => {
    setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    expect(within(panel).queryByRole('button', { name: /Apply/ })).toBeNull();
    expect(within(panel).getByText(/apply as you type/i)).toBeInTheDocument();
  });

  it('writes every field change at once, typing in one field is one undo step, and undo reverts it', async () => {
    const user = userEvent.setup();
    const { last, canvas } = setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    const label = within(panel).getByLabelText('Label');
    await user.clear(label);
    await user.type(label, 'Strict');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('Strict');
    // one step: a single undo goes back to the original label
    canvas.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('Gate');
  });

  it('the open panel follows undo and redo', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    const label = within(panel).getByLabelText('Label') as HTMLInputElement;
    await user.clear(label);
    await user.type(label, 'Strict');
    expect(label.value).toBe('Strict');
    canvas.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect((within(screen.getByRole('complementary', { name: /settings/ })).getByLabelText('Label') as HTMLInputElement).value).toBe('Gate');
    await user.keyboard('{Control>}y{/Control}');
    expect((within(screen.getByRole('complementary', { name: /settings/ })).getByLabelText('Label') as HTMLInputElement).value).toBe('Strict');
  });

  it('a viewer cannot change anything through the panel', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ readOnly: true });
    fireEvent.contextMenu(nodeEl('Gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'View' }));
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    expect(within(panel).getByDisplayValue('Gate')).toHaveAttribute('readonly');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the title of the block when the label field is emptied, and the label again when it is typed', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    clickNode('Gate');
    const label = within(screen.getByRole('complementary', { name: 'Gate settings' })).getByLabelText('Label');
    expect(label).toHaveAttribute('placeholder', 'Filter');
    await user.clear(label);
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('');
    expect(screen.getByRole('button', { name: /^Filter \(Filter\)/ })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Filter settings' })).toBeInTheDocument();
    await user.type(label, 'Strict');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('Strict');
    expect(screen.getByRole('button', { name: /^Strict \(Filter\)/ })).toBeInTheDocument();
  });
  it('names a block with no label by its block title in the problems list too, and the label can be undone', async () => {
    const user = userEvent.setup();
    setup({ initialNodes: [node('x', 'nope.y', '', 0, 0)], initialEdges: [] });
    await user.click(screen.getByRole('button', { name: /^Problems:/ }));
    expect(within(screen.getByRole('list', { name: 'Problems' })).getByText('nope.y')).toBeInTheDocument();
    cleanup();
    const second = setup();
    clickNode('Gate');
    await user.clear(within(screen.getByRole('complementary', { name: 'Gate settings' })).getByLabelText('Label'));
    second.canvas.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(second.last()?.nodes.find((n) => n.nodeId === 'n2')?.label).toBe('Gate');
  });
});

describe('RulesetEditor: blocks the host cannot run', () => {
  const unavailable = { FILTER: 'The filter module is not installed.' };

  it('greys the entry out with the reason and does not add it', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ unavailable, initialNodes: [], initialEdges: [] });
    const entry = screen.getByRole('button', { name: 'Add Filter node' });
    expect(entry).toHaveAttribute('aria-disabled', 'true');
    expect(entry).toHaveAttribute('title', 'The filter module is not installed.');
    expect(entry).toHaveAttribute('draggable', 'false');
    await user.click(entry);
    expect(onChange).not.toHaveBeenCalled();
    const other = screen.getByRole('button', { name: 'Add Trigger node' });
    expect(other).not.toHaveAttribute('aria-disabled');
    await user.click(other);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('keeps the blocks already on the canvas', () => {
    setup({ unavailable });
    expect(nodeEl('Gate')).toBeInTheDocument();
  });
  it('leaves the entry out of the canvas menu', async () => {
    const { canvas } = setup({ unavailable, initialNodes: [], initialEdges: [] });
    fireEvent.contextMenu(canvas);
    const items = within(await screen.findByRole('menu')).queryAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toContain('Add Trigger');
    expect(items).not.toContain('Add Filter');
  });
});

describe('RulesetEditor: messages', () => {
  const de = {
    paletteTitle: 'Knotentypen', paletteAdd: (t: string) => `${t} hinzufügen`, menuCopy: (n: number) => (n > 1 ? `${n} Knoten kopieren` : 'Kopieren'),
    menuUndo: 'Rückgängig', panelLabel: (l: string) => `Einstellungen: ${l}`, panelAppliesAsYouType: 'Änderungen gelten sofort.',
    panelNameLabel: 'Bezeichnung',
  };

  it('keeps the English words when no message is given', () => {
    setup();
    expect(screen.getByText('Node Types')).toBeInTheDocument();
  });
  it('translates the palette, the menu and the node panel from the messages prop', async () => {
    const user = userEvent.setup();
    setup({ messages: de });
    expect(screen.getByText('Knotentypen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter hinzufügen' })).toBeInTheDocument();
    clickNode('Source');
    clickNode('Gate', { shiftKey: true });
    fireEvent.contextMenu(nodeEl('Gate'));
    const nodeItems = within(await screen.findByRole('menu')).getAllByRole('menuitem').map((i) => i.querySelector('span')?.textContent);
    expect(nodeItems).toContain('2 Knoten kopieren');
    await user.keyboard('{Escape}');
    fireEvent.contextMenu(screen.getByLabelText('Rule chain canvas'));
    const items = within(await screen.findByRole('menu')).getAllByRole('menuitem').map((i) => i.querySelector('span')?.textContent);
    expect(items).toContain('Rückgängig');
    expect(items).toContain('Select all'); // not given: stays English
    await user.keyboard('{Escape}');
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Einstellungen: Gate' });
    expect(within(panel).getByLabelText('Bezeichnung')).toBeInTheDocument();
    expect(within(panel).getByText('Änderungen gelten sofort.')).toBeInTheDocument();
  });
});

describe('RulesetEditor: messages of the canvas and the dialogs', () => {
  const de = {
    canvasLabel: 'Regelkette', toolUndo: 'Rückgängig', toolZoomIn: 'Vergrößern', canvasEmpty: 'Knoten aus der Palette ziehen',
    dialogCancel: 'Abbrechen', groupNameLabel: 'Bezeichnung', groupColourLabel: 'Gruppenfarbe', menuGroup: 'Gruppe…',
    issuesSummary: (e: number, w: number) => `Probleme: ${e} Fehler, ${w} Warnungen`,
    scopeBack: (c: string) => `Zurück zu ${c}`, scopeSubflow: (n: string) => `Unterablauf: ${n}`,
  };

  it('translates the tool bar and the empty canvas', () => {
    setup({ messages: de, initialNodes: [], initialEdges: [] });
    expect(screen.getByLabelText('Regelkette')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vergrößern' })).toBeInTheDocument();
    expect(screen.getByText('Knoten aus der Palette ziehen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument(); // not given
  });
  it('translates the problems button', () => {
    setup({ messages: de, initialNodes: [node('x', 'nope.y', 'X', 0, 0)], initialEdges: [] });
    expect(screen.getByRole('button', { name: /^Probleme: 1 Fehler/ })).toBeInTheDocument();
  });
  it('translates the group dialog the menu opens', async () => {
    const user = userEvent.setup();
    setup({ messages: de });
    fireEvent.contextMenu(nodeEl('Gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Gruppe…' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Bezeichnung')).toBeInTheDocument();
    expect(within(dialog).getByRole('radiogroup', { name: 'Gruppenfarbe' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: messages of the subflow dialogs', () => {
  const de = {
    paletteNewSubflow: 'Neuer Unterablauf…', subflowNameLabel: 'Name des Unterablaufs', newSubflowCreate: 'Anlegen',
    scopeSettings: 'Unterablauf-Einstellungen', sfTitle: 'Unterablauf-Einstellungen', sfSave: 'Speichern', dialogCancel: 'Abbrechen',
    sfOutputs: 'Ausgänge', sfOutputN: (n: number) => `Ausgang ${n}`, sfRemoveOutput: (n: number) => `Ausgang ${n} entfernen`,
    sfAddParam: 'Parameter hinzufügen', sfParamType: 'Typ', sfTypeBool: 'Ja / nein', sfDelete: 'Unterablauf löschen',
  };

  it('translates the name dialog and the settings dialog, a message left out stays English', async () => {
    const user = userEvent.setup();
    setup({ messages: de });
    await user.click(screen.getByRole('button', { name: /Neuer Unterablauf/ }));
    await user.type(await screen.findByLabelText('Name des Unterablaufs'), 'Frisch');
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));
    await user.click(screen.getByRole('button', { name: 'Unterablauf-Einstellungen' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Unterablauf löschen' })).toBeInTheDocument();
    expect(within(dialog).getByText('Ausgänge')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Ausgang 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Ausgang 1 entfernen' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Description')).toBeInTheDocument(); // not given
    await user.click(within(dialog).getByRole('button', { name: 'Parameter hinzufügen' }));
    const type = within(dialog).getByLabelText('Typ') as HTMLSelectElement;
    expect(within(type).getByRole('option', { name: 'Ja / nein' })).toBeInTheDocument();
    expect(within(type).getByRole('option', { name: 'Text' })).toBeInTheDocument(); // not given
  });
});

describe('RulesetEditor: the words of the problems', () => {
  const de = {
    issueText: (code: string, arg?: string) => (code === 'unknown' ? `Unbekannter Blocktyp ${arg}.` : code === 'unconnected' ? 'Mit nichts verbunden.' : `${code}`),
    nodeAriaLabel: (label: string, kind: string, skipped: boolean, problems: number) => `${label} [${kind}]${skipped ? ' übersprungen' : ''}${problems ? ` ${problems} Problem(e)` : ''}`,
    nodeSkipped: 'Übersprungen',
    paramIssueText: (code: string, label: string) => `${label}: ${code} (de)`,
  };

  it('uses the host words for the issues on the canvas, the problems list and the node label', async () => {
    const user = userEvent.setup();
    setup({ messages: de as never, initialNodes: [node('x', 'nope.y', 'Odd', 0, 0)], initialEdges: [] });
    expect(screen.getByRole('button', { name: /^Odd \[nope\.y\]/ }).getAttribute('aria-label')).toMatch(/Problem\(e\)$/);
    await user.click(screen.getByRole('button', { name: /^Problems:/ }));
    expect(within(screen.getByRole('list', { name: 'Problems' })).getByText('Unbekannter Blocktyp nope.y.')).toBeInTheDocument();
  });
  it('uses the host words for the skipped badge', () => {
    setup({ messages: de as never, initialNodes: [node('a', 'FILTER', 'Gate', 0, 0, { disabled: true })], initialEdges: [] });
    expect(screen.getByText('Übersprungen')).toBeInTheDocument();
  });
});

describe('RulesetEditor: texts with a marked part', () => {
  const de = {
    paletteHelpWire: 'Von {out} Ausgang zu {in} Eingang ziehen.', canvasEmptyWire: 'Verbinde {out} Ausgänge mit {in} Eingängen',
    panelPlaceholderBody: 'Dieser Knoten kam aus {source}, sein Typ {type} fehlt hier.', panelSourceNodeRed: 'einem Node-RED-Ablauf',
    groupColours: ['Primär', 'Erfolg', 'Warnung', 'Fehler', 'Info', 'Sekundär', 'Grau', 'Rand'], menuGroup: 'Gruppe…',
  };

  it('puts the marked parts into the translated palette help and empty canvas text', () => {
    setup({ messages: de, initialNodes: [], initialEdges: [] });
    const help = screen.getByText((_, el) => el?.tagName === 'P' && /Von .* Ausgang zu .* Eingang ziehen\./.test(el.textContent ?? ''));
    expect(within(help).getByText('●')).toHaveClass('text-primary');
    expect(within(help).getByText('○')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && /^Verbinde .* Ausgänge mit .* Eingängen$/.test(el.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('Drag or click a node type to add it.'))).toBeInTheDocument(); // not given
  });
  it('translates the placeholder explanation, with the source and the type put in', () => {
    setup({ messages: de, initialNodes: [node('p', 'PLACEHOLDER', 'Odd', 0, 0, { original: { type: 'mqtt in', source: 'node-red', outputs: ['out'] } })], initialEdges: [] });
    clickNode('Odd');
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('Dieser Knoten kam aus einem Node-RED-Ablauf, sein Typ mqtt in fehlt hier.');
    expect(within(note).getByText('mqtt in')).toHaveClass('font-mono');
  });
  it('names the group colours from the messages', async () => {
    const user = userEvent.setup();
    setup({ messages: de });
    fireEvent.contextMenu(nodeEl('Gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Gruppe…' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: 'Erfolg' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Rand' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: Ctrl+S', () => {
  const ctrlS = (el: Element, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true, ...init });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it('calls onSave and keeps the browser from saving the page', () => {
    const onSave = vi.fn();
    const { canvas } = setup({ onSave });
    expect(ctrlS(canvas)).toBe(true);
    expect(onSave).toHaveBeenCalledWith({ valid: true });
    expect(ctrlS(canvas, { ctrlKey: false, metaKey: true, key: 'S' })).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(2);
  });
  it('says the graph is not valid while it has errors', () => {
    const onSave = vi.fn();
    const { canvas } = setup({ onSave, initialNodes: [node('x', 'nope.y', 'Odd', 0, 0)], initialEdges: [] });
    ctrlS(canvas);
    expect(onSave).toHaveBeenCalledWith({ valid: false });
  });
  it('works from a field of the node panel, but not from a dialog', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    setup({ onSave });
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    ctrlS(within(panel).getByLabelText('Label'));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(nodeEl('Gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Group…' }));
    const dialog = await screen.findByRole('dialog');
    expect(ctrlS(within(dialog).getByLabelText('Name'))).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
  it('is left to the browser without onSave, and never calls onSave when read only', () => {
    const { canvas } = setup();
    expect(ctrlS(canvas)).toBe(false);
    cleanup();
    const onSave = vi.fn();
    const ro = setup({ onSave, readOnly: true });
    expect(ctrlS(ro.canvas)).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
  it('ignores Ctrl+Alt+S and other letters', () => {
    const onSave = vi.fn();
    const { canvas } = setup({ onSave });
    expect(ctrlS(canvas, { altKey: true })).toBe(false);
    expect(ctrlS(canvas, { key: 'd' })).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('RulesetEditor: fullscreen', () => {
  it('has a button that covers the page with the editor and gives it back', async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole('button', { name: 'Fullscreen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-fs="true"]')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
    expect(document.querySelector('[data-fs="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  });
  it('is named from the messages', () => {
    setup({ messages: { toolFullscreen: 'Vollbild' } });
    expect(screen.getByRole('button', { name: 'Vollbild' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: node description', () => {
  const desc = (panel: HTMLElement) => within(panel).getByLabelText('Description') as HTMLTextAreaElement;

  it('has a description field (at most 500 characters) that writes through as one step and goes back with undo', async () => {
    const user = userEvent.setup();
    const { last, canvas } = setup();
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    expect(desc(panel)).toHaveAttribute('maxlength', '500');
    await user.type(desc(panel), 'Blocks bad readings');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.description).toBe('Blocks bad readings');
    canvas.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(last()?.nodes.find((n) => n.nodeId === 'n2')?.description).toBeUndefined();
    expect(desc(screen.getByRole('complementary', { name: /settings/ })).value).toBe('');
  });
  it('shows the description a block has and clears it when the field is emptied', async () => {
    const user = userEvent.setup();
    const { last } = setup({ initialNodes: [node('a', 'FILTER', 'Gate', 0, 0, { description: 'Old note' })], initialEdges: [] });
    clickNode('Gate');
    const panel = screen.getByRole('complementary', { name: 'Gate settings' });
    expect(desc(panel).value).toBe('Old note');
    await user.clear(desc(panel));
    expect(last()?.nodes[0].description).toBeUndefined();
  });
  it('is read only for a viewer and is translated from the messages', async () => {
    const user = userEvent.setup();
    setup({ readOnly: true, initialNodes: [node('a', 'FILTER', 'Gate', 0, 0, { description: 'Old note' })], initialEdges: [] });
    fireEvent.contextMenu(nodeEl('Gate'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'View' }));
    expect(desc(screen.getByRole('complementary', { name: 'Gate settings' }))).toHaveAttribute('readonly');
    cleanup();
    setup({ messages: { panelDescriptionLabel: 'Beschreibung' } });
    clickNode('Gate');
    expect(within(screen.getByRole('complementary', { name: 'Gate settings' })).getByLabelText('Beschreibung')).toBeInTheDocument();
  });
  it('is kept by copy and paste', async () => {
    const { last, canvas } = setup({ initialNodes: [node('a', 'FILTER', 'Gate', 0, 0, { description: 'Note' })], initialEdges: [] });
    clickNode('Gate');
    await key(canvas, '{Control>}c{/Control}');
    await key(canvas, '{Control>}v{/Control}');
    expect(last()?.nodes.map((n) => n.description)).toEqual(['Note', 'Note']);
  });
});

describe('RulesetEditor: hover card of a block', () => {
  afterEach(() => { vi.useRealTimers(); });
  const hover = (label: string, init: Record<string, unknown> = {}) => fireEvent.pointerEnter(nodeEl(label), { pointerType: 'mouse', ...init });

  it('shows the label, the kind and the description after half a second, as text', () => {
    vi.useFakeTimers();
    setup({ initialNodes: [node('a', 'FILTER', 'Gate', 0, 0, { description: 'Blocks <b>bad</b> readings' })], initialEdges: [] });
    hover('Gate');
    act(() => { vi.advanceTimersByTime(499); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('Gate')).toBeInTheDocument();
    expect(within(tip).getByText('FILTER – Filter')).toBeInTheDocument();
    expect(within(tip).getByText('Blocks <b>bad</b> readings')).toBeInTheDocument();
    expect(tip.querySelector('b')).toBeNull();
    expect(nodeEl('Gate')).toHaveAttribute('aria-describedby', tip.id);
  });
  it('goes when the pointer leaves, and does not come if it left before the time', () => {
    vi.useFakeTimers();
    setup();
    hover('Gate');
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(nodeEl('Gate'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover('Source');
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerLeave(nodeEl('Source'));
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('goes on a press (a drag or a click starts) and is not for touch', () => {
    vi.useFakeTimers();
    setup();
    hover('Gate');
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerDown(nodeEl('Gate'), { button: 0 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    hover('Source', { pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('says what a placeholder was, and uses the host words for the kind line', () => {
    vi.useFakeTimers();
    setup({ initialNodes: [node('p', 'PLACEHOLDER', 'Odd', 0, 0, { original: { type: 'mqtt in', source: 'node-red', outputs: ['out'] } }), node('a', 'FILTER', 'Gate', 300, 0)], initialEdges: [],
      messages: { nodeTipKind: (type: string, title: string) => `${title} (${type})` } });
    hover('Odd');
    act(() => { vi.advanceTimersByTime(600); });
    expect(within(screen.getByRole('tooltip')).getByText('mqtt in – Not available')).toBeInTheDocument();
    fireEvent.pointerLeave(nodeEl('Odd'));
    hover('Gate');
    act(() => { vi.advanceTimersByTime(600); });
    expect(within(screen.getByRole('tooltip')).getByText('Filter (FILTER)')).toBeInTheDocument();
  });
});

describe('RulesetEditor: keyboard shortcuts', () => {
  it('? opens the list of shortcuts, read from the table, and Close closes it', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    canvas.focus();
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const row = (id: string) => dialog.querySelector(`[data-shortcut="${id}"]`) as HTMLElement;
    expect(within(row('undo')).getByText('Ctrl+Z')).toBeInTheDocument();
    expect(within(row('redo')).getByText('Ctrl+Y')).toBeInTheDocument();
    expect(within(row('redo')).getByText('Ctrl+Shift+Z')).toBeInTheDocument();
    expect(within(row('duplicate')).getByText('Ctrl+D')).toBeInTheDocument();
    expect(within(row('delete')).getByText('Del')).toBeInTheDocument();
    expect(row('save')).toBeNull(); // no onSave: not listed
    expect(within(dialog).getByRole('region', { name: 'Edit' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('lists Ctrl+S when the host handles it, and leaves out what changes the flow when read only', async () => {
    const user = userEvent.setup();
    const { canvas } = setup({ onSave: vi.fn() });
    canvas.focus();
    await user.keyboard('?');
    expect((await screen.findByRole('dialog')).querySelector('[data-shortcut="save"]')).not.toBeNull();
    cleanup();
    const ro = setup({ readOnly: true });
    ro.canvas.focus();
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('[data-shortcut="undo"]')).toBeNull();
    expect(dialog.querySelector('[data-shortcut="copy"]')).not.toBeNull();
    expect(dialog.querySelector('[data-shortcut="help"]')).not.toBeNull();
  });
  it('opens from the tool bar and from the canvas menu', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.contextMenu(canvas);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
  it('Ctrl+D duplicates the selection as one undo step', async () => {
    const { canvas, last } = setup();
    clickNode('Gate');
    await key(canvas, '{Control>}d{/Control}');
    expect(last()?.nodes).toHaveLength(4);
    await key(canvas, '{Control>}z{/Control}');
    expect(last()?.nodes).toHaveLength(3);
  });
  it('Ctrl+D with nothing selected, or when read only, does nothing', async () => {
    const { canvas, onChange } = setup();
    await key(canvas, '{Control>}d{/Control}');
    expect(onChange).not.toHaveBeenCalled();
    cleanup();
    const ro = setup({ readOnly: true });
    clickNode('Gate');
    await key(ro.canvas, '{Control>}d{/Control}');
    expect(ro.onChange).not.toHaveBeenCalled();
  });
  it('the menu entries show the keys that do the same, which are not part of their names', async () => {
    const { canvas } = setup();
    fireEvent.contextMenu(canvas);
    const menu = await screen.findByRole('menu');
    const undo = within(menu).getByRole('menuitem', { name: 'Undo' });
    expect(undo).toHaveTextContent('Ctrl+Z');
    expect(undo).toHaveAttribute('aria-keyshortcuts', 'Control+Z');
    expect(within(menu).getByRole('menuitem', { name: 'Paste' })).toHaveTextContent('Ctrl+V');
    expect(within(menu).getByRole('menuitem', { name: 'Keyboard shortcuts' })).toHaveTextContent('?');
  });
  it('is in the host words', async () => {
    const user = userEvent.setup();
    const { canvas } = setup({ messages: { shortcutsTitle: 'Tastenkürzel', shortcutText: (id: string) => (id === 'undo' ? 'Rückgängig' : id), shortcutGroup: (g: string) => g.toUpperCase() } as never });
    canvas.focus();
    await user.keyboard('?');
    const dialog = await screen.findByRole('dialog', { name: 'Tastenkürzel' });
    expect(within(dialog).getByText('Rückgängig')).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'EDIT' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: find box', () => {
  const marks = () => Object.fromEntries(screen.getAllByRole('button', { name: /\(\w[\w ]*\)/ }).filter((e) => e.hasAttribute('data-node-id')).map((e) => [e.getAttribute('data-node-id'), e.getAttribute('data-find')]));
  const DESCRIBED = [node('n1', 'TRIGGER', 'Source', 0, 0), node('n2', 'FILTER', 'Gate', 300, 0, { description: 'Blocks Gürültü' }), node('n3', 'ACTION', 'Sink', 600, 0)];

  it('Ctrl+F opens it with the focus in the field, Esc closes it and the dimming goes', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    expect(screen.queryByTestId('find-bar')).toBeNull();
    await key(canvas, '{Control>}f{/Control}');
    const input = screen.getByTestId('find-input');
    expect(input).toHaveFocus();
    expect(marks()).toEqual({ n1: null, n2: null, n3: null }); // empty: nothing dimmed
    await user.type(input, 'gate');
    expect(marks()).toEqual({ n1: 'dim', n2: 'current', n3: 'dim' });
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('find-bar')).toBeNull();
    expect(marks()).toEqual({ n1: null, n2: null, n3: null });
  });
  it('marks every match, counts them, and Enter and Shift+Enter step through them', async () => {
    const user = userEvent.setup();
    const { canvas } = setup({ initialNodes: [node('a1', 'FILTER', 'Alpha one', 0, 0), node('a2', 'FILTER', 'Alpha two', 300, 0), node('b1', 'ACTION', 'Beta', 600, 0)], initialEdges: [] });
    await key(canvas, '{Control>}f{/Control}');
    await user.type(screen.getByTestId('find-input'), 'alpha');
    expect(screen.getByTestId('find-count')).toHaveTextContent('1 of 2');
    expect(marks()).toEqual({ a1: 'current', a2: 'match', b1: 'dim' });
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('find-count')).toHaveTextContent('2 of 2');
    expect(marks()).toEqual({ a1: 'match', a2: 'current', b1: 'dim' });
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('find-count')).toHaveTextContent('1 of 2');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(screen.getByTestId('find-count')).toHaveTextContent('2 of 2');
    await user.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(screen.getByTestId('find-count')).toHaveTextContent('1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByTestId('find-count')).toHaveTextContent('2 of 2');
  });
  it('folds accents and finds by description, type and id', async () => {
    const user = userEvent.setup();
    const { canvas } = setup({ initialNodes: DESCRIBED, initialEdges: [] });
    await key(canvas, '{Control>}f{/Control}');
    const input = screen.getByTestId('find-input');
    await user.type(input, 'gurultu');
    expect(marks()).toEqual({ n1: 'dim', n2: 'current', n3: 'dim' });
    await user.clear(input);
    await user.type(input, 'ACTION');
    expect(marks()).toEqual({ n1: 'dim', n2: 'dim', n3: 'current' });
    await user.clear(input);
    await user.type(input, 'n1');
    expect(marks()).toEqual({ n1: 'current', n2: 'dim', n3: 'dim' });
  });
  it('says when nothing matches, and the arrows are off', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    await key(canvas, '{Control>}f{/Control}');
    await user.type(screen.getByTestId('find-input'), 'zzz');
    expect(screen.getByTestId('find-count')).toHaveTextContent('No match');
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
    expect(marks()).toEqual({ n1: 'dim', n2: 'dim', n3: 'dim' });
  });
  it('the close button closes it, and a second Ctrl+F keeps what was typed', async () => {
    const user = userEvent.setup();
    const { canvas } = setup();
    await key(canvas, '{Control>}f{/Control}');
    await user.type(screen.getByTestId('find-input'), 'gate');
    canvas.focus();
    await key(canvas, '{Control>}f{/Control}');
    expect(screen.getByTestId('find-input')).toHaveValue('gate');
    await user.click(screen.getByRole('button', { name: 'Close the find box' }));
    expect(screen.queryByTestId('find-bar')).toBeNull();
  });
  it('is in the sheet, is not a change (works read only) and speaks the host words', async () => {
    const user = userEvent.setup();
    const ro = setup({ readOnly: true, messages: { findLabel: 'Baustein suchen', findCount: (c: number, t: number) => `${c} von ${t}`, findPlaceholder: 'Name…' } });
    await key(ro.canvas, '{Control>}f{/Control}');
    expect(screen.getByLabelText('Baustein suchen')).toHaveAttribute('placeholder', 'Name…');
    await user.type(screen.getByLabelText('Baustein suchen'), 'gate');
    expect(screen.getByTestId('find-count')).toHaveTextContent('1 von 1');
    cleanup();
    const { canvas } = setup();
    canvas.focus();
    await user.keyboard('?');
    const row = (await screen.findByRole('dialog')).querySelector('[data-shortcut="find"]') as HTMLElement;
    expect(within(row).getByText('Ctrl+F')).toBeInTheDocument();
  });
});

describe('RulesetEditor: change the port of a connection', () => {
  const openPortDialog = async (container: HTMLElement, edgeId: string) => {
    const user = userEvent.setup();
    fireEvent.contextMenu(container.querySelector(`[data-edge-id="${edgeId}"]`)!);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Change port…' }));
    return { user, dialog: await screen.findByRole('dialog', { name: 'Change the output' }) };
  };

  it('moves the source end to another output of the block, in one undo step', async () => {
    const { container, last, canvas } = setup();
    const { user, dialog } = await openPortDialog(container, 'e2');
    expect(within(dialog).getByLabelText('Output')).toHaveValue('true');
    await user.selectOptions(within(dialog).getByLabelText('Output'), 'false');
    await user.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(last()?.edges.find((e) => e.edgeId === 'e2')).toMatchObject({ sourceNodeId: 'n2', sourcePort: 'false', targetNodeId: 'n3' });
    canvas.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(last()?.edges.find((e) => e.edgeId === 'e2')?.sourcePort).toBe('true');
  });
  const WITH_ERROR = catalogFromBlocks([[{ type: 'trigger.t' }, { type: 'cond.c', outputs: ['yes', 'no'] }, { type: 'action.a' }]]);
  const errNodes = [node('t', 'trigger.t', 'T', 0, 0), node('c', 'cond.c', 'Cond', 300, 0), node('a', 'action.a', 'A', 600, 0)];

  it('can move it to the error output', async () => {
    const { container, last } = setup({ catalog: WITH_ERROR, initialNodes: errNodes, initialEdges: [edge('e1', 't', 'out', 'c'), edge('e2', 'c', 'yes', 'a')] });
    const { user, dialog } = await openPortDialog(container, 'e2');
    await user.selectOptions(within(dialog).getByLabelText('Output'), 'error');
    await user.click(within(dialog).getByRole('button', { name: 'Change' }));
    expect(last()?.edges.find((e) => e.edgeId === 'e2')?.sourcePort).toBe('error');
  });
  it('names an output that already has this connection, cannot choose it, and keeps Change off for the current one', async () => {
    const { container } = setup({ catalog: WITH_ERROR, initialNodes: errNodes, initialEdges: [edge('e1', 't', 'out', 'c'), edge('e2', 'c', 'yes', 'a'), edge('e3', 'c', 'no', 'a')] });
    const { user, dialog } = await openPortDialog(container, 'e2');
    expect(within(dialog).getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(within(dialog).getByRole('option', { name: /already connected there/ })).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Output'), 'no');
    expect(within(dialog).getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Output'), 'error');
    expect(within(dialog).getByRole('button', { name: 'Change' })).toBeEnabled();
  });
  it('is not offered for a block with one output, or to a viewer', async () => {
    const { container } = setup({ catalog: catalogFromBlocks([[{ type: 'trigger.a' }, { type: 'action.b' }]]), initialNodes: [node('a', 'trigger.a', 'A', 0, 0), node('b', 'action.b', 'B', 300, 0)], initialEdges: [edge('e1', 'a', 'out', 'b')] });
    fireEvent.contextMenu(container.querySelector('[data-edge-id="e1"]')!);
    expect(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Delete connection' })).toBeInTheDocument();
    expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: 'Change port…' })).toBeNull();
    cleanup();
    const ro = setup({ readOnly: true });
    fireEvent.contextMenu(ro.container.querySelector('[data-edge-id="e2"]')!);
    expect(screen.queryByRole('menu')).toBeNull();
  });
  it('is in the host words', async () => {
    const { container } = setup({ messages: { menuChangePort: 'Ausgang ändern…', portDialogTitle: 'Ausgang wechseln', portDialogSave: 'Wechseln', portDialogIntro: (l: string) => `Ausgang von „${l}“.` } });
    const user = userEvent.setup();
    fireEvent.contextMenu(container.querySelector('[data-edge-id="e2"]')!);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Ausgang ändern…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ausgang wechseln' });
    expect(within(dialog).getByText('Ausgang von „Gate“.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Wechseln' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: comments', () => {
  const comment = (id: string, text: string, x = 0, y = 200) => node(id, 'note.comment', 'Comment', x, y, { config: { text } });
  const cards = () => document.querySelectorAll('[data-node-id][aria-label^="Comment:"]');

  it('Alt+N adds a comment card in the middle of the canvas and opens its panel on the text', async () => {
    const user = userEvent.setup();
    const { canvas, last } = setup();
    canvas.focus();
    await user.keyboard('{Alt>}n{/Alt}');
    expect(last()?.nodes.filter((n) => n.type === 'note.comment')).toHaveLength(1);
    expect(cards()).toHaveLength(1);
    const panel = screen.getByRole('complementary', { name: /settings/ });
    expect(within(panel).getByLabelText('Text')).toBeInTheDocument();
    expect(within(panel).queryByLabelText('Label')).toBeNull();
    expect(within(panel).queryByLabelText('Description')).toBeNull();
    await user.type(within(panel).getByLabelText('Text'), 'Check the wiring');
    expect(last()?.nodes.find((n) => n.type === 'note.comment')?.config).toEqual({ text: 'Check the wiring' });
    expect(cards()[0]).toHaveTextContent('Check the wiring');
  });
  it('shows the text of a comment as plain text on a card with no ports, and an empty one says so', () => {
    setup({ initialNodes: [...NODES, comment('k1', 'Line one\n<b>not bold</b>'), comment('k2', '', 300)] });
    const card = document.querySelector('[data-node-id="k1"]') as HTMLElement;
    expect(card).toHaveTextContent('Line one');
    expect(card).toHaveTextContent('<b>not bold</b>');
    expect(card.querySelector('b')).toBeNull();
    expect(card.querySelector('[data-port], circle')).toBeNull();
    expect(document.querySelector('[data-node-id="k2"]')).toHaveTextContent('Empty comment');
  });
  it('is not a problem to leave a comment unconnected, and finds with Ctrl+F by its text', async () => {
    const user = userEvent.setup();
    const { canvas, ref } = setup({ initialNodes: [...NODES, comment('k1', 'Remember the Gürültü filter')] });
    expect(ref.current?.validate().warnings.map((w) => w.nodeId)).not.toContain('k1');
    await key(canvas, '{Control>}f{/Control}');
    await user.type(screen.getByTestId('find-input'), 'gurultu');
    expect(document.querySelector('[data-node-id="k1"]')).toHaveAttribute('data-find', 'current');
  });
  it('is added from the canvas menu at the clicked place, not when read only', async () => {
    const user = userEvent.setup();
    const { canvas, last } = setup();
    fireEvent.contextMenu(canvas);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Add a comment here' }));
    expect(last()?.nodes.filter((n) => n.type === 'note.comment')).toHaveLength(1);
    cleanup();
    const ro = setup({ readOnly: true });
    ro.canvas.focus();
    await user.keyboard('{Alt>}n{/Alt}');
    expect(ro.onChange).not.toHaveBeenCalled();
    fireEvent.contextMenu(ro.canvas);
    expect(within(await screen.findByRole('menu')).queryByRole('menuitem', { name: 'Add a comment here' })).toBeNull();
  });
  it('can be copied, moved with the others and deleted like any block, and undone', async () => {
    const { canvas, last } = setup({ initialNodes: [comment('k1', 'keep me')], initialEdges: [] });
    fireEvent.pointerDown(document.querySelector('[data-node-id="k1"]')!, { button: 0 });
    fireEvent.pointerUp(document.querySelector('[data-node-id="k1"]')!, { button: 0 });
    await key(canvas, '{Control>}d{/Control}');
    expect(last()?.nodes).toHaveLength(2);
    await key(canvas, '{Delete}');
    expect(last()?.nodes).toHaveLength(1);
    await key(canvas, '{Control>}z{/Control}');
    expect(last()?.nodes).toHaveLength(2);
  });
  it('is in the sheet and the menu with its key, in the host words', async () => {
    const user = userEvent.setup();
    const { canvas } = setup({ messages: { menuAddComment: 'Kommentar hier', shortcutText: (id: string) => (id === 'note' ? 'Kommentar' : id) } as never });
    fireEvent.contextMenu(canvas);
    const item = await screen.findByRole('menuitem', { name: 'Kommentar hier' });
    expect(item).toHaveTextContent('Alt+N');
    await user.keyboard('{Escape}');
    canvas.focus();
    await user.keyboard('?');
    const row = (await screen.findByRole('dialog')).querySelector('[data-shortcut="note"]') as HTMLElement;
    expect(within(row).getByText('Kommentar')).toBeInTheDocument();
    expect(within(row).getByText('Alt+N')).toBeInTheDocument();
  });
});

describe('RulesetEditor: help of a block', () => {
  const HELP = catalogFromBlocks([[
    { type: 'cond.quota', title: 'Quota', description: 'Short description', outputs: ['yes', 'no'],
      help: '# Quota\n\nPasses the message when the **quota** is `exceeded`.\n\n- Needs a modem\n- Runs on every message\n\n```\nmsg.payload\n```\n<script>alert(1)</script>' },
    { type: 'logic.plain', title: 'Plain', description: 'Only a description' },
    { type: 'logic.bare', title: 'Bare' },
  ]]);
  const nodes = [node('q', 'cond.quota', 'Quota', 0, 0), node('p', 'logic.plain', 'Plain', 300, 0), node('b', 'logic.bare', 'Bare', 600, 0)];
  const panel = () => screen.getByRole('complementary', { name: /settings/ });

  it('has Settings and Help tabs, starting on Settings with its fields', async () => {
    setup({ catalog: HELP, initialNodes: nodes, initialEdges: [] });
    clickNode('Quota');
    expect(within(panel()).getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panel()).getByLabelText('Label')).toBeInTheDocument();
    expect(within(panel()).queryByTestId('panel-help')).toBeNull();
  });
  it('shows the help text drawn from markdown, escaped, with the ports of the block', async () => {
    const user = userEvent.setup();
    setup({ catalog: HELP, initialNodes: nodes, initialEdges: [] });
    clickNode('Quota');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    const help = within(panel()).getByTestId('panel-help');
    expect(within(help).getByRole('heading', { name: 'Quota' })).toBeInTheDocument();
    expect(help.querySelector('strong')?.textContent).toBe('quota');
    expect(help.querySelector('p code')?.textContent).toBe('exceeded');
    expect(help.querySelectorAll('li')).toHaveLength(2 + 4); // two list items, then the ports
    expect(help.querySelector('pre')?.textContent).toBe('msg.payload');
    expect(help.querySelector('script')).toBeNull();
    expect(help).toHaveTextContent('<script>alert(1)</script>');
    const ports = within(help).getByRole('heading', { name: 'Ports' }).nextElementSibling as HTMLElement;
    expect(ports).toHaveTextContent('in · In');
    expect(ports).toHaveTextContent('yes · Out');
    expect(ports).toHaveTextContent('error · Out');
    expect(within(panel()).queryByLabelText('Label')).toBeNull();
    await user.click(within(panel()).getByRole('tab', { name: 'Settings' }));
    expect(within(panel()).getByLabelText('Label')).toBeInTheDocument();
  });
  it('falls back to the description, then to a line saying there is none', async () => {
    const user = userEvent.setup();
    setup({ catalog: HELP, initialNodes: nodes, initialEdges: [] });
    clickNode('Plain');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    expect(within(panel()).getByTestId('panel-help')).toHaveTextContent('Only a description');
    clickNode('Bare');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    expect(within(panel()).getByTestId('panel-help')).toHaveTextContent('No help for this block yet.');
  });
  it('goes back to Settings when another block is opened, and edits survive a visit to Help', async () => {
    const user = userEvent.setup();
    const { last } = setup({ catalog: HELP, initialNodes: nodes, initialEdges: [] });
    clickNode('Quota');
    await user.type(within(panel()).getByLabelText('Description'), 'note');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    await user.click(within(panel()).getByRole('tab', { name: 'Settings' }));
    expect(within(panel()).getByLabelText('Description')).toHaveValue('note');
    expect(last()?.nodes.find((n) => n.nodeId === 'q')?.description).toBe('note');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    clickNode('Plain');
    expect(within(panel()).getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
  });
  it('has no tabs for a placeholder or a comment', () => {
    setup({ catalog: HELP, initialNodes: [node('p', 'PLACEHOLDER', 'Odd', 0, 0, { original: { type: 'mqtt in', source: 'node-red', outputs: ['out'] } }), node('k', 'note.comment', 'Comment', 300, 0, { config: { text: 'x' } })], initialEdges: [] });
    clickNode('Odd');
    expect(within(screen.getByRole('complementary', { name: /settings/ })).queryByRole('tablist')).toBeNull();
    fireEvent.pointerDown(document.querySelector('[data-node-id="k"]')!, { button: 0 });
    fireEvent.pointerUp(document.querySelector('[data-node-id="k"]')!, { button: 0 });
    expect(within(screen.getByRole('complementary', { name: /settings/ })).queryByRole('tablist')).toBeNull();
  });
  it('puts the first paragraph of the help in the palette hint, else the description', () => {
    setup({ catalog: HELP, initialNodes: [], initialEdges: [] });
    expect(screen.getByRole('button', { name: 'Add Quota node' })).toHaveAttribute('title', 'Passes the message when the quota is exceeded.');
    expect(screen.getByRole('button', { name: 'Add Plain node' })).toHaveAttribute('title', 'Only a description');
    expect(screen.getByRole('button', { name: 'Add Bare node' })).toHaveAttribute('title', 'Bare');
  });
  it('is in the host words', async () => {
    const user = userEvent.setup();
    setup({ catalog: HELP, initialNodes: nodes, initialEdges: [], messages: { panelTabHelp: 'Hilfe', panelTabSettings: 'Einstellungen', panelHelpNone: 'Noch keine Hilfe.', panelHelpPorts: 'Anschlüsse' } });
    clickNode('Bare');
    await user.click(within(panel()).getByRole('tab', { name: 'Hilfe' }));
    expect(within(panel()).getByTestId('panel-help')).toHaveTextContent('Noch keine Hilfe.');
    expect(within(panel()).getByRole('tab', { name: 'Einstellungen' })).toBeInTheDocument();
  });
});

describe('RulesetEditor: script block', () => {
  const SCRIPT = catalogFromBlocks([[
    { type: 'logic.script', title: 'Script', outputs: ['o0'], params: { code: { type: 'code', lang: 'js', label: 'Code' } } },
    { type: 'logic.change', title: 'Change' },
  ]]);
  const nodes = [node('s', 'logic.script', 'Calc', 0, 0, { config: { code: 'return msg;' } }), node('c', 'logic.change', 'Chg', 300, 0)];
  const panel = () => screen.getByRole('complementary', { name: /settings/ });

  it('shows the signature over the code, and the API in the Help tab of a script block only', async () => {
    const user = userEvent.setup();
    setup({ catalog: SCRIPT, initialNodes: nodes, initialEdges: [] });
    clickNode('Calc');
    expect(within(panel()).getByTestId('script-signature')).toHaveTextContent('return msg | [a, b]');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    const api = within(panel()).getByTestId('script-api');
    expect(within(api).getByRole('heading', { name: 'Script API' })).toBeInTheDocument();
    expect(api).toHaveTextContent('node.send(msg)');
    expect(api).toHaveTextContent('There is no util object');
    expect(api.querySelectorAll('table')).toHaveLength(1);
    clickNode('Chg');
    await user.click(within(panel()).getByRole('tab', { name: 'Help' }));
    expect(within(panel()).queryByTestId('script-api')).toBeNull();
  });
});

describe('diffTint (a version compare)', () => {
  it('outlines and labels added, changed and removed blocks, and colours tinted connections', () => {
    const { container } = setup({ readOnly: true, diffTint: { nodes: { n1: 'added', n2: 'changed', n3: 'removed' }, edges: { 'n1\u0000out\u0000n2': 'added', 'n2\u0000true\u0000n3': 'removed' } } });
    expect(nodeEl('Source').getAttribute('data-diff')).toBe('added');
    expect(nodeEl('Gate').getAttribute('data-diff')).toBe('changed');
    expect(nodeEl('Sink')).toHaveAccessibleName(/, Removed$/);
    expect(screen.getAllByTestId('node-diff').map((b) => b.textContent)).toEqual(['Added', 'Changed', 'Removed']);
    const tinted = [...container.querySelectorAll('path[data-diff]')];
    expect(tinted.map((p) => [p.getAttribute('data-diff'), p.getAttribute('stroke'), p.getAttribute('stroke-dasharray')])).toEqual([
      ['added', 'var(--success)', null], ['removed', 'var(--error)', '6 4'],
    ]);
  });

  it('draws nothing extra without it, and takes translated badge words', () => {
    setup({ diffTint: { nodes: { n2: 'changed' } }, messages: { diffChanged: 'Geändert' } });
    expect(screen.getByTestId('node-diff').textContent).toBe('Geändert');
    expect(nodeEl('Source').hasAttribute('data-diff')).toBe(false);
    cleanup();
    setup();
    expect(screen.queryByTestId('node-diff')).toBeNull();
  });
});
