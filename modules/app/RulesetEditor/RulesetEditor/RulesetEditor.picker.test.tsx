import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesetEditor, type RulesetGraph } from './index';
import { catalogFromBlocks, FLOW_BLOCKS, type RawBlock } from '../catalog';
import type { RuleEdge, RuleNode } from '../types';

afterEach(() => cleanup());

/** more blocks than the canvas menu lists one by one */
const BLOCKS: RawBlock[] = [
  { type: 'trigger.boot', title: 'Boot' },
  { type: 'trigger.timer', title: 'Timer' },
  ...Array.from({ length: 12 }, (_, i): RawBlock => ({ type: `action.step${i}`, title: `Step ${i}`, description: i === 3 ? 'The special one' : undefined })),
  { type: 'cond.gate', title: 'Gate' },
];
const catalog = catalogFromBlocks([BLOCKS]);

const node = (nodeId: string, type: string, label: string, x: number, y: number): RuleNode => ({ nodeId, type, label, x, y });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

function setup(nodes: RuleNode[] = [], edges: RuleEdge[] = []) {
  const onChange = vi.fn<(g: RulesetGraph) => void>();
  const utils = render(<RulesetEditor catalog={catalog} initialNodes={nodes} initialEdges={edges} onChange={onChange} />);
  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils };
}

describe('RulesetEditor with a large catalog', () => {
  it('opens a picker from the canvas menu instead of listing every block', async () => {
    const user = userEvent.setup();
    const { last } = setup();
    fireEvent.contextMenu(screen.getByLabelText('Rule chain canvas'));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: 'Add Boot' })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Add a block here…' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Boot')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Timer/ }));
    expect(last()?.nodes).toHaveLength(1);
    expect(last()?.nodes[0]).toMatchObject({ type: 'trigger.timer', label: 'Timer' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('searches the picker by title, description and type, and starts in the search field', async () => {
    const user = userEvent.setup();
    setup();
    fireEvent.contextMenu(screen.getByLabelText('Rule chain canvas'));
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Add a block here…' }));
    const search = await screen.findByLabelText('Search blocks');
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, 'special');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('button', { name: /Step/ })).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'action.step1');
    expect(within(dialog).getAllByRole('button', { name: /Step/ }).length).toBeGreaterThan(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(within(dialog).getByText('No block matches.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts a block in the middle of a connection', async () => {
    const user = userEvent.setup();
    const { container, last } = setup(
      [node('a', 'trigger.boot', 'Boot', 0, 0), node('b', 'action.step0', 'Step 0', 400, 0)],
      [edge('e1', 'a', 'out', 'b')],
    );
    const path = container.querySelector('[data-edge-id="e1"]')!;
    fireEvent.contextMenu(path);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Add a block in between…' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Gate/ }));
    const graph = last()!;
    expect(graph.nodes.map((n) => n.type)).toEqual(['trigger.boot', 'action.step0', 'cond.gate']);
    expect(graph.edges.map((e) => [e.sourceNodeId, e.sourcePort, e.targetNodeId])).toEqual([['a', 'out', 'n3'], ['n3', 'yes', 'b']]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(last()?.edges.map((e) => e.edgeId)).toEqual(['e1']);
  });

  it('deletes a selected connection from its menu', async () => {
    const user = userEvent.setup();
    const { container, last } = setup(
      [node('a', 'trigger.boot', 'Boot', 0, 0), node('b', 'action.step0', 'Step 0', 400, 0)],
      [edge('e1', 'a', 'out', 'b')],
    );
    fireEvent.contextMenu(container.querySelector('[data-edge-id="e1"]')!);
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Delete connection' }));
    expect(last()?.edges).toEqual([]);
  });

  it('offers the Flow input block once: a second one is greyed out, with the reason', async () => {
    const user = userEvent.setup();
    const flowCatalog = catalogFromBlocks([BLOCKS, FLOW_BLOCKS]);
    const onChange = vi.fn<(g: RulesetGraph) => void>();
    render(<RulesetEditor catalog={flowCatalog} initialNodes={[]} initialEdges={[]} onChange={onChange} />);
    const add = () => screen.getByRole('button', { name: 'Add Flow input node' });
    expect(add()).not.toHaveAttribute('aria-disabled');
    await user.click(add());
    expect(onChange.mock.calls.at(-1)?.[0].nodes.map((n) => n.type)).toEqual(['trigger.flow_input']);
    expect(add()).toHaveAttribute('aria-disabled', 'true');
    expect(add()).toHaveAttribute('title', 'A flow has one Flow input block only.');
    await user.click(add());
    expect(onChange.mock.calls.at(-1)?.[0].nodes).toHaveLength(1);
    // Run flow can be added any number of times
    await user.click(screen.getByRole('button', { name: 'Add Run flow node' }));
    await user.click(screen.getByRole('button', { name: 'Add Run flow node' }));
    expect(onChange.mock.calls.at(-1)?.[0].nodes).toHaveLength(3);
  });

  it('groups the flow blocks under Flows in the palette', () => {
    render(<RulesetEditor catalog={catalogFromBlocks([BLOCKS, FLOW_BLOCKS])} />);
    const group = screen.getByRole('group', { name: 'Flows' });
    expect(within(group).getByRole('button', { name: 'Add Flow input node' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Add Run flow node' })).toBeInTheDocument();
  });
});
