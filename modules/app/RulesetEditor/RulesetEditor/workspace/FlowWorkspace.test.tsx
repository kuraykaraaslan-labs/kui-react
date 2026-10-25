import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowWorkspace, type FlowWorkspaceProps, type FlowWorkspaceRef } from './FlowWorkspace';
import { catalogFromBlocks, FLOW_BLOCKS } from '../../catalog';
import { createDraftStore, draftKey, type DraftStorage, type DraftStore } from '../../graph/draft';
import { snapshotOf } from '../../graph/state';
import type { RulesetGraph } from '../hooks/useGraphEditor';
import type { RuleNode } from '../../types';

afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });
beforeEach(() => localStorage.clear());

const CATALOG = catalogFromBlocks([[
  { type: 'trigger.link_in', title: 'Link in' },
  { type: 'action.link_out', title: 'Link out' },
  { type: 'logic.link_call', title: 'Link call' },
  { type: 'logic.step', title: 'Step' },
]]);

const node = (nodeId: string, type: string, label: string, x: number, config: Record<string, unknown> = {}): RuleNode => ({ nodeId, type, label, x, y: 0, config });
const graph = (nodes: RuleNode[] = [node('n1', 'logic.step', 'First', 0), node('n2', 'logic.step', 'Second', 300)]): RulesetGraph => ({ nodes, edges: [], groups: [] });

const FLOWS = [
  { id: 'main', name: 'Main flow' },
  { id: 'night', name: 'Night' },
  { id: 'calc', name: 'Calc' },
];

/** the open flow can leave only through a link jump: a link out whose link in is in the flow "night" */
const LEAVER = (x = 300) => graph([node('out1', 'action.link_out', 'Send alarm', 0, { targets: ['alarm'] }), node('n2', 'logic.step', 'Second', x)]);
const NIGHT = [{ id: 'night', name: 'Night', nodes: [node('a1', 'trigger.link_in', 'Alarm in', 0, { name: 'alarm' })] }];
const leaverProps = (): Partial<FlowWorkspaceProps> => ({ flow: { id: 'main', name: 'Main flow', graph: LEAVER() }, loadFlows: vi.fn(async () => NIGHT) });

function memory(): DraftStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function setup(props: Partial<FlowWorkspaceProps> = {}, store?: DraftStore) {
  const ref = createRef<FlowWorkspaceRef>();
  const mem = memory();
  const draftStore = store ?? createDraftStore(() => mem);
  const handlers = { onOpen: vi.fn() };
  const full: FlowWorkspaceProps = {
    ref, flows: FLOWS, flow: { id: 'main', name: 'Main flow', graph: graph() }, catalog: CATALOG, draftStore, ...handlers, ...props,
  };
  const utils = render(<FlowWorkspace {...full} />);
  return { ref, mem, draftStore, ...handlers, ...utils, rerender: (p: Partial<FlowWorkspaceProps> = {}) => utils.rerender(<FlowWorkspace {...full} {...p} />) };
}

const nodeEl = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\(`) });
/** leave the open flow the one way there is: the "Go to the link in" entry of a link out */
async function jumpAway() {
  fireEvent.contextMenu(nodeEl('Send alarm'));
  fireEvent.click(await within(await screen.findByRole('menu')).findByRole('menuitem', { name: 'Go to the link in' }));
}

/** put a graph in the editor as the host would: through the ref */
function edit(ref: React.RefObject<FlowWorkspaceRef | null>, g: RulesetGraph, key = 'test') {
  act(() => ref.current!.editor!.replaceGraph(g, { key }));
}

describe('FlowWorkspace: browser draft', () => {
  const CHANGED = () => graph([node('n1', 'logic.step', 'First', 40), node('n2', 'logic.step', 'Second', 300)]);

  it('writes a draft about 0.8 s after a change, not before', () => {
    vi.useFakeTimers();
    const { ref, mem } = setup();
    edit(ref, CHANGED());
    expect(mem.data.size).toBe(0);
    act(() => { vi.advanceTimersByTime(700); });
    expect(mem.data.size).toBe(0);
    act(() => { vi.advanceTimersByTime(200); });
    expect(mem.data.has(draftKey('main'))).toBe(true);
  });

  it('removes the draft when the change is undone back to the saved state', () => {
    vi.useFakeTimers();
    const { ref, mem } = setup();
    edit(ref, CHANGED());
    act(() => { vi.advanceTimersByTime(900); });
    expect(mem.data.size).toBe(1);
    act(() => ref.current!.editor!.undo());
    expect(mem.data.size).toBe(0);
    expect(ref.current!.isDirty()).toBe(false);
  });

  it('clears the draft when the host saved', () => {
    vi.useFakeTimers();
    const { ref, mem } = setup();
    edit(ref, CHANGED());
    act(() => { vi.advanceTimersByTime(900); });
    act(() => ref.current!.markSaved());
    expect(mem.data.size).toBe(0);
    expect(ref.current!.isDirty()).toBe(false);
    expect(screen.queryByRole('img', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });

  it('offers a kept draft; Restore puts it in as one undo step', () => {
    const mem = memory();
    const store = createDraftStore(() => mem);
    const base = graph();
    store.write(draftKey('main'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), snapshotOf(base));
    const { ref } = setup({ flow: { id: 'main', name: 'Main flow', graph: base } }, store);
    expect(screen.getByTestId('flow-draft')).toHaveTextContent('Unsaved changes from');
    expect(screen.queryByText(/changed on the server since/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('flow-draft-restore'));
    expect(screen.queryByTestId('flow-draft')).not.toBeInTheDocument();
    expect(nodeEl('Draft node')).toBeInTheDocument();
    expect(ref.current!.isDirty()).toBe(true);
    act(() => ref.current!.editor!.undo());
    expect(nodeEl('First')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Draft node \(/ })).not.toBeInTheDocument();
  });

  it('Discard throws the draft away', () => {
    const mem = memory();
    const store = createDraftStore(() => mem);
    store.write(draftKey('main'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), snapshotOf(graph()));
    setup({}, store);
    fireEvent.click(screen.getByTestId('flow-draft-discard'));
    expect(screen.queryByTestId('flow-draft')).not.toBeInTheDocument();
    expect(mem.data.size).toBe(0);
  });

  it('warns that the flow changed since the draft was made', () => {
    const mem = memory();
    const store = createDraftStore(() => mem);
    store.write(draftKey('main'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), 'an older saved state');
    setup({}, store);
    expect(screen.getByTestId('flow-draft')).toHaveTextContent('The flow changed on the server since');
  });

  it('does not offer a draft for a read-only flow, and a draft belongs to its own flow', () => {
    const mem = memory();
    const store = createDraftStore(() => mem);
    store.write(draftKey('other'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), snapshotOf(graph()));
    setup({}, store);
    expect(screen.queryByTestId('flow-draft')).not.toBeInTheDocument();
    cleanup();
    store.write(draftKey('main'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), snapshotOf(graph()));
    setup({ readOnly: true }, store);
    expect(screen.queryByTestId('flow-draft')).not.toBeInTheDocument();
  });

  it('writes the draft before leaving for another flow', async () => {
    const { ref, mem, onOpen } = setup(leaverProps());
    edit(ref, LEAVER(340));
    await jumpAway();
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(mem.data.has(draftKey('main'))).toBe(true);
  });

  it('refuses to leave with a message when the draft cannot be kept', async () => {
    const blocked = createDraftStore(() => null);
    const { ref, onOpen } = setup(leaverProps(), blocked);
    edit(ref, LEAVER(340));
    await jumpAway();
    await waitFor(() => expect(screen.getByTestId('flow-notice')).toHaveTextContent('Save or undo your changes first: this browser cannot keep a draft.'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('leaves freely when nothing changed, even with blocked storage', async () => {
    const blocked = createDraftStore(() => null);
    const { onOpen } = setup(leaverProps(), blocked);
    await jumpAway();
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
  });
});

describe('FlowWorkspace: link jumps', () => {
  const OWN = graph([
    node('out1', 'action.link_out', 'Send alarm', 0, { targets: ['alarm'] }),
    node('in1', 'trigger.link_in', 'Local in', 300, { name: 'local' }),
    node('lonely', 'action.link_out', 'Send nowhere', 600, { targets: ['nowhere'] }),
  ]);
  const other = (id: string, nodes: RuleNode[]) => ({ id, name: `Name of ${id}`, nodes });
  async function goFrom(label: string) {
    fireEvent.contextMenu(nodeEl(label));
    return within(await screen.findByRole('menu'));
  }

  it('jumps to the link in of another flow through the host, with the block to show', async () => {
    const loadFlows = vi.fn(async () => [other('night', [node('a1', 'trigger.link_in', 'Alarm in', 0, { name: 'alarm' })])]);
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows });
    fireEvent.click(await (await goFrom('Send alarm')).findByRole('menuitem', { name: 'Go to the link in' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'night' }, { nodeId: 'a1' }));
    expect(loadFlows).toHaveBeenCalledWith(['night', 'calc']);
  });

  it('keeps the other flows for 30 s', async () => {
    const loadFlows = vi.fn(async () => [other('night', [node('a1', 'trigger.link_in', 'Alarm in', 0, { name: 'alarm' })])]);
    setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows });
    for (let i = 0; i < 2; i++) {
      fireEvent.click(await (await goFrom('Send alarm')).findByRole('menuitem', { name: 'Go to the link in' }));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    }
    expect(loadFlows).toHaveBeenCalledTimes(1);
  });

  it('shows the block when the link in is in the open flow', async () => {
    const own = graph([node('out1', 'action.link_out', 'Send local', 0, { targets: ['local'] }), node('in1', 'trigger.link_in', 'Local in', 300, { name: 'local' })]);
    const { ref, onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: own } });
    fireEvent.click(await (await goFrom('Send local')).findByRole('menuitem', { name: 'Go to the link in' }));
    await waitFor(() => expect(ref.current!.editor!.getSelection()).toEqual(['in1']));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('reads the open flow live from the editor, not from the first graph', async () => {
    const { ref, onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: graph([node('out1', 'action.link_out', 'Send local', 0, { targets: ['local'] })]) } });
    edit(ref, graph([node('out1', 'action.link_out', 'Send local', 0, { targets: ['local'] }), node('in9', 'trigger.link_in', 'Added in', 300, { name: 'local' })]));
    fireEvent.click(await (await goFrom('Send local')).findByRole('menuitem', { name: 'Go to the link in' }));
    await waitFor(() => expect(ref.current!.editor!.getSelection()).toEqual(['in9']));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('lists several hits and goes to the one picked', async () => {
    const loadFlows = async () => [
      other('night', [node('a1', 'trigger.link_in', 'Alarm in', 0, { name: 'alarm' })]),
      other('calc', [node('a2', 'trigger.link_in', 'Alarm in too', 0, { name: 'alarm' })]),
    ];
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows });
    fireEvent.click(await (await goFrom('Send alarm')).findByRole('menuitem', { name: 'Go to the link in' }));
    const hits = await screen.findAllByTestId('flow-link-hit');
    expect(hits.map((h) => h.textContent)).toEqual(['Name of night › Alarm in', 'Name of calc › Alarm in too']);
    fireEvent.click(hits[1]);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'calc' }, { nodeId: 'a2' }));
    expect(screen.queryByTestId('flow-link-hits')).not.toBeInTheDocument();
  });

  it('a link in lists the blocks that call it', async () => {
    const loadFlows = async () => [other('night', [node('c1', 'logic.link_call', 'Call it', 0, { target: 'local' })])];
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows });
    fireEvent.click(await (await goFrom('Local in')).findByRole('menuitem', { name: 'Show the blocks that call it' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'night' }, { nodeId: 'c1' }));
  });

  it('says so when there is no hit', async () => {
    setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows: async () => [] });
    fireEvent.click(await (await goFrom('Send nowhere')).findByRole('menuitem', { name: 'Go to the link in' }));
    expect(await screen.findByTestId('flow-notice')).toHaveTextContent('No link in is called nowhere.');
  });

  it('only searches the open flow without loadFlows', async () => {
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: OWN } });
    fireEvent.click(await (await goFrom('Send alarm')).findByRole('menuitem', { name: 'Go to the link in' }));
    expect(await screen.findByTestId('flow-notice')).toHaveTextContent('No link in is called alarm.');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the draft before it jumps to another flow, and stays when it cannot', async () => {
    const loadFlows = async () => [other('night', [node('a1', 'trigger.link_in', 'Alarm in', 0, { name: 'alarm' })])];
    const blocked = createDraftStore(() => null);
    const { ref, onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: OWN }, loadFlows }, blocked);
    edit(ref, graph([...OWN.nodes, node('x', 'logic.step', 'Extra', 900)]));
    fireEvent.click(await (await goFrom('Send alarm')).findByRole('menuitem', { name: 'Go to the link in' }));
    expect(await screen.findByTestId('flow-notice')).toHaveTextContent('cannot keep a draft');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('has no link entry on other blocks', async () => {
    setup();
    fireEvent.contextMenu(nodeEl('First'));
    const menu = within(await screen.findByRole('menu'));
    expect(menu.queryByRole('menuitem', { name: 'Go to the link in' })).not.toBeInTheDocument();
  });

  it('selects the block a jump from another flow named', () => {
    const { ref } = setup({ focusNodeId: 'n2' });
    expect(ref.current!.editor!.getSelection()).toEqual(['n2']);
  });
});

describe('FlowWorkspace: flows that run each other', () => {
  const FLOW_CATALOG = catalogFromBlocks([[{ type: 'logic.step', title: 'Step' }], FLOW_BLOCKS]);
  const other = (id: string, nodes: RuleNode[]) => ({ id, name: `Name of ${id}`, nodes });
  const RUN = graph([node('run1', 'action.flow_run', 'Escalate', 0, { flow: 'night' })]);
  const ENTRY = graph([node('fi1', 'trigger.flow_input', 'Entry', 0)]);
  async function goFrom(label: string) {
    fireEvent.contextMenu(nodeEl(label));
    return within(await screen.findByRole('menu'));
  }

  it('a Run flow block goes to the Flow input of the flow it runs', async () => {
    const loadFlows = vi.fn(async () => [other('night', [node('fi', 'trigger.flow_input', 'Entry', 0)]), other('calc', [])]);
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: RUN }, catalog: FLOW_CATALOG, loadFlows });
    fireEvent.click(await (await goFrom('Escalate')).findByRole('menuitem', { name: 'Go to the Flow input of that flow' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'night' }, { nodeId: 'fi' }));
  });

  it('says so when the flow it runs has no Flow input block', async () => {
    const loadFlows = async () => [other('night', [node('n1', 'logic.step', 'Step', 0)])];
    setup({ flow: { id: 'main', name: 'Main flow', graph: RUN }, catalog: FLOW_CATALOG, loadFlows });
    fireEvent.click(await (await goFrom('Escalate')).findByRole('menuitem', { name: 'Go to the Flow input of that flow' }));
    expect(await screen.findByTestId('flow-notice')).toHaveTextContent('The flow this block runs has no Flow input block.');
  });

  it('a Flow input lists the Run flow blocks that run its flow', async () => {
    const loadFlows = async () => [other('night', [node('r1', 'action.flow_run', 'Run main', 0, { flow: 'main' })]), other('calc', [])];
    const { onOpen } = setup({ flow: { id: 'main', name: 'Main flow', graph: ENTRY }, catalog: FLOW_CATALOG, loadFlows });
    fireEvent.click(await (await goFrom('Entry')).findByRole('menuitem', { name: 'Show the blocks that run this flow' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'night' }, { nodeId: 'r1' }));
  });

  it('has no flow entry for a Run flow block that names no flow', async () => {
    setup({ flow: { id: 'main', name: 'Main flow', graph: graph([node('run1', 'action.flow_run', 'Escalate', 0, {})]) }, catalog: FLOW_CATALOG });
    const menu = await goFrom('Escalate');
    expect(menu.queryByRole('menuitem', { name: 'Go to the Flow input of that flow' })).not.toBeInTheDocument();
  });
});

describe('FlowWorkspace: the fixed Flow input', () => {
  const FLOW_CATALOG = catalogFromBlocks([[{ type: 'logic.step', title: 'Step' }], FLOW_BLOCKS]);
  const LEGACY = () => graph([node('n1', 'logic.step', 'First', 300)]);
  const open = () => setup({ catalog: FLOW_CATALOG, flow: { id: 'main', name: 'Main flow', graph: LEGACY() } });

  it('adds it to a flow that lacks it without making the flow dirty or writing a draft', () => {
    vi.useFakeTimers();
    const { ref, mem } = open();
    expect(ref.current!.getGraph()!.nodes.map((n) => n.type)).toEqual(['trigger.flow_input', 'logic.step']);
    expect(ref.current!.isDirty()).toBe(false);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(mem.data.size).toBe(0);
  });

  it('is dirty after a change and clean again once the change is undone', () => {
    const { ref } = open();
    const g = ref.current!.getGraph()!;
    edit(ref, { ...g, nodes: g.nodes.map((n) => (n.nodeId === 'n1' ? { ...n, x: 340 } : n)) });
    expect(ref.current!.isDirty()).toBe(true);
    act(() => ref.current!.editor!.undo());
    expect(ref.current!.isDirty()).toBe(false);
  });

  it('treats a graph the host saves without it as the same baseline', () => {
    const { ref } = open();
    act(() => ref.current!.markSaved(LEGACY()));
    expect(ref.current!.isDirty()).toBe(false);
    edit(ref, ref.current!.getGraph()!);
    expect(ref.current!.isDirty()).toBe(false);
  });
});

describe('FlowWorkspace: merge', () => {
  const BASE = graph([node('n1', 'logic.step', 'First', 0), node('n2', 'logic.step', 'Second', 300)]);
  /** mine: First moved; theirs: Second renamed, a node added */
  const MINE = graph([node('n1', 'logic.step', 'First', 40), node('n2', 'logic.step', 'Second', 300)]);
  const THEIRS = graph([node('n1', 'logic.step', 'First', 0), node('n2', 'logic.step', 'Second renamed', 300), node('n3', 'logic.step', 'Theirs new', 600)]);

  it('does not show the conflict dialog without a conflict, and has Merge only when the host can load', () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    cleanup();
    setup({ conflict: { at: 1_700_000_000, by: 'Ada' } });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('flow-merge')).not.toBeInTheDocument();
  });

  it('merges the host version with the changes here as one undo step', async () => {
    const loadFlow = vi.fn(async () => ({ graph: THEIRS }));
    const onMerged = vi.fn();
    const onConflictClose = vi.fn();
    const { ref } = setup({ flow: { id: 'main', name: 'Main flow', graph: BASE }, conflict: { at: 1_700_000_000, by: 'Ada' }, loadFlow, onMerged, onConflictClose });
    edit(ref, MINE);
    fireEvent.click(screen.getByTestId('flow-merge'));
    expect(await screen.findByTestId('flow-merge-summary')).toHaveTextContent('(Ada)');
    expect(loadFlow).toHaveBeenCalledWith('main');
    const merged = ref.current!.getGraph()!;
    expect(merged.nodes.map((n) => [n.nodeId, n.label, n.x])).toEqual([['n1', 'First', 40], ['n2', 'Second renamed', 300], ['n3', 'Theirs new', 600]]);
    expect(screen.getByTestId('flow-merge-summary')).toHaveTextContent('2 changes taken');
    expect(screen.getByText('Nothing was changed on both sides.')).toBeInTheDocument();
    expect(onMerged).toHaveBeenCalledTimes(1);
    expect(ref.current!.isDirty()).toBe(true);

    // one undo step back to the version before the merge
    act(() => ref.current!.editor!.undo());
    expect(ref.current!.getGraph()!.nodes.map((n) => [n.nodeId, n.x])).toEqual([['n1', 40], ['n2', 300]]);

    fireEvent.click(screen.getByTestId('flow-merge-ok'));
    expect(onConflictClose).toHaveBeenCalledTimes(1);
  });

  it('keeps mine for a block both sides changed and lists it', async () => {
    const theirs = graph([node('n1', 'logic.step', 'First', 80), node('n2', 'logic.step', 'Second', 300)]);
    const { ref } = setup({ flow: { id: 'main', name: 'Main flow', graph: BASE }, conflict: {}, loadFlow: async () => ({ graph: theirs }) });
    edit(ref, MINE);
    fireEvent.click(screen.getByTestId('flow-merge'));
    const list = await screen.findByTestId('flow-merge-conflicts');
    expect(list).toHaveTextContent('First (n1)');
    expect(ref.current!.getGraph()!.nodes.find((n) => n.nodeId === 'n1')?.x).toBe(40);
  });

  it('names a block you deleted that the other side changed', async () => {
    const mine = graph([node('n2', 'logic.step', 'Second', 300)]);
    const theirs = graph([node('n1', 'logic.step', 'First', 80), node('n2', 'logic.step', 'Second', 300)]);
    const { ref } = setup({ flow: { id: 'main', name: 'Main flow', graph: BASE }, conflict: {}, loadFlow: async () => ({ graph: theirs }) });
    edit(ref, mine);
    fireEvent.click(screen.getByTestId('flow-merge'));
    expect(await screen.findByTestId('flow-merge-conflicts')).toHaveTextContent('First (n1) (you deleted it)');
  });

  it('says so when the host version cannot be read, and changes nothing', async () => {
    const { ref } = setup({ flow: { id: 'main', name: 'Main flow', graph: BASE }, conflict: {}, loadFlow: async () => null });
    edit(ref, MINE);
    fireEvent.click(screen.getByTestId('flow-merge'));
    expect(await screen.findByText('Could not read the version on the server.')).toBeInTheDocument();
    expect(ref.current!.getGraph()!.nodes.map((n) => n.x)).toEqual([40, 300]);
  });

  it('shows the host\'s own buttons and closes with Cancel', () => {
    const onConflictClose = vi.fn();
    setup({ conflict: {}, conflictActions: <button type="button">Overwrite</button>, onConflictClose });
    expect(screen.getByRole('button', { name: 'Overwrite' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConflictClose).toHaveBeenCalled();
  });
});

describe('FlowWorkspace: messages', () => {
  const de = {
    wsDraftFound: (t: string) => `Ungespeicherte Änderungen von ${t} wurden in diesem Browser behalten.`, wsRestore: 'Wiederherstellen', wsDiscard: 'Verwerfen',
    wsConflictTitle: 'Dieser Ablauf wurde von jemand anderem gespeichert', wsConflictNewer: (w: string) => `Die Fassung von ${w} ist neuer.`,
    dialogCancel: 'Abbrechen', wsLocale: 'de-DE', paletteTitle: 'Knotentypen',
  };

  it('translates the editor below, a message left out stays English', () => {
    setup({ messages: de });
    expect(screen.getByText('Knotentypen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  });
  it('translates the draft banner', () => {
    const mem = memory();
    const store = createDraftStore(() => mem);
    const base = graph();
    store.write(draftKey('main'), snapshotOf(graph([node('n9', 'logic.step', 'Draft node', 0)])), snapshotOf(base));
    setup({ messages: de, flow: { id: 'main', name: 'Main flow', graph: base } }, store);
    expect(screen.getByTestId('flow-draft')).toHaveTextContent('Ungespeicherte Änderungen von');
    expect(screen.getByTestId('flow-draft-restore')).toHaveTextContent('Wiederherstellen');
    expect(screen.getByTestId('flow-draft-discard')).toHaveTextContent('Verwerfen');
  });
  it('translates the conflict dialog', () => {
    setup({ messages: de, conflict: { at: 1_700_000_000, by: 'Ada' } });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Dieser Ablauf wurde von jemand anderem gespeichert')).toBeInTheDocument();
    expect(within(dialog).getByText(/Die Fassung von .* \(Ada\) ist neuer\./)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });
});

describe('FlowWorkspace: leave guard', () => {
  const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
  const change = (ref: React.RefObject<FlowWorkspaceRef | null>) => edit(ref, LEAVER(340));

  // The question is the kit's ConfirmDialog (vitest.setup.ts mounts its host): "Stay" keeps the flow, "Leave" goes.
  const leaveDialog = () => screen.queryByRole('dialog', { name: 'Leave without saving' });
  it('does nothing unless the host switches it on', async () => {
    const { ref, onOpen } = setup(leaverProps());
    change(ref);
    expect(unload()).toBe(false);
    await jumpAway();
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    expect(leaveDialog()).toBeNull();
  });
  it('guards a reload and a jump that leaves, while the flow is dirty', async () => {
    const user = userEvent.setup();
    const { ref, onOpen } = setup({ ...leaverProps(), leaveGuard: true });
    expect(unload()).toBe(false); // clean
    change(ref);
    expect(unload()).toBe(true);
    await jumpAway();
    expect(await screen.findByText('You have changes that are not saved. Leave without saving them?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay' }));
    expect(onOpen).not.toHaveBeenCalled();
    await waitFor(() => expect(leaveDialog()).toBeNull());
    await jumpAway();
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ id: 'night' }, { nodeId: 'a1' }));
  });
  it('lets the host decide with a function of dirty (a change already in the server draft is not guarded)', async () => {
    let kept = true;
    const { ref, onOpen } = setup({ ...leaverProps(), leaveGuard: (dirty) => dirty && !kept });
    change(ref);
    expect(unload()).toBe(false);
    await jumpAway();
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
    expect(leaveDialog()).toBeNull();
    kept = false;
    cleanup();
    const second = setup({ leaveGuard: (dirty) => dirty && !kept });
    change(second.ref);
    expect(unload()).toBe(true);
  });
  it('says it in the host words', async () => {
    const { ref } = setup({ ...leaverProps(), leaveGuard: true, messages: { wsLeaveConfirm: 'Ungespeicherte Änderungen verwerfen?', wsLeaveTitle: 'Ohne Speichern verlassen', wsLeaveAction: 'Verlassen', wsLeaveStay: 'Bleiben' } });
    change(ref);
    await jumpAway();
    expect(await screen.findByText('Ungespeicherte Änderungen verwerfen?')).toBeInTheDocument();
    expect(screen.getByText('Ohne Speichern verlassen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verlassen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bleiben' })).toBeInTheDocument();
  });
});

describe('FlowWorkspace: Ctrl+S', () => {
  it('tells the host whether the flow is dirty', () => {
    const onSave = vi.fn();
    const { ref } = setup({ onSave });
    const canvas = screen.getByLabelText('Rule chain canvas');
    const press = () => canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    press();
    expect(onSave).toHaveBeenLastCalledWith({ valid: true, dirty: false });
    edit(ref, graph([node('n1', 'logic.step', 'First', 0)]));
    press();
    expect(onSave).toHaveBeenLastCalledWith({ valid: true, dirty: true });
  });
});

describe('FlowWorkspace: fullscreen', () => {
  it('takes the whole workspace, not only the canvas', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    const marked = document.querySelector('[data-fs="true"]') as HTMLElement;
    expect(marked).toHaveAttribute('data-ruleset-workspace');
    expect(marked.contains(screen.getByLabelText('Rule chain canvas'))).toBe(true);
  });
});
