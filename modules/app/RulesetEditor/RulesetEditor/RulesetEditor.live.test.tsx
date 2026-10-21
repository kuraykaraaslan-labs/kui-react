import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesetEditor, type RulesetEditorRef, type RulesetGraph } from './index';
import { catalogFromBlocks } from '../catalog';
import { PULSE_ON_MS } from '../graph/activity';
import type { RuleEdge, RuleNode } from '../types';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const node = (nodeId: string, type: string, label: string, x: number, y: number, extra: Partial<RuleNode> = {}): RuleNode => ({ nodeId, type, label, x, y, ...extra });
const edge = (edgeId: string, from: string, port: string, to: string): RuleEdge => ({ edgeId, sourceNodeId: from, sourcePort: port, targetNodeId: to, targetPort: 'in' });

const NODES = [node('n1', 'TRIGGER', 'Source', 0, 0), node('n2', 'FILTER', 'Gate', 300, 0), node('n3', 'ACTION', 'Sink', 600, 0)];
const EDGES = [edge('e1', 'n1', 'out', 'n2'), edge('e2', 'n2', 'true', 'n3')];

function setup(props: Partial<React.ComponentProps<typeof RulesetEditor>> = {}) {
  const ref = createRef<RulesetEditorRef>();
  const onChange = vi.fn<(g: RulesetGraph) => void>();
  const utils = render(<RulesetEditor ref={ref} initialNodes={NODES} initialEdges={EDGES} onChange={onChange} chainName="Chain" {...props} />);
  const last = () => onChange.mock.calls.at(-1)?.[0];
  return { ref, onChange, last, ...utils };
}
const nodeEl = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} \\(`) });
function clickNode(label: string) {
  const el = nodeEl(label);
  fireEvent.pointerDown(el, { button: 0 });
  fireEvent.pointerUp(el, { button: 0 });
}

describe('edge activity (09 §9.5)', () => {
  it('shows the counter of each connection on hover, from the host or its source port', () => {
    const { container } = setup({ activity: { nodes: { n1: { in: 0, out: { out: 7 } } }, edges: { e2: { count: 3 } }, window: 'last 24 h' } });
    const counts = [...container.querySelectorAll('[data-testid="edge-count"]')].map((g) => g.textContent);
    expect(counts).toEqual(['7 messages', '3 messages']);
    expect(container.querySelector('[data-edge-id="e1"] title')?.textContent).toBe('7 messages on this connection (last 24 h)');
  });

  it('lights a connection when its count goes up, at most twice a second, and puts it out again', () => {
    vi.useFakeTimers();
    const { container, rerender } = setup({ activity: { edges: { e1: { count: 1 } } } });
    const lit = () => container.querySelector('[data-testid="edge-activity"]')?.getAttribute('data-lit');
    expect(lit()).toBe('false');
    const again = (count: number) => rerender(<RulesetEditor initialNodes={NODES} initialEdges={EDGES} chainName="Chain" activity={{ edges: { e1: { count } } }} />);
    again(2);
    expect(lit()).toBe('true');
    act(() => { vi.advanceTimersByTime(PULSE_ON_MS + 10); });
    expect(lit()).toBe('false');
    // a second rise within the gap waits for it
    again(3);
    expect(lit()).toBe('false');
    act(() => { vi.advanceTimersByTime(200); });
    expect(lit()).toBe('true');
  });

  it('shows a block\'s counters in its hover card and in the Messages tab', () => {
    vi.useFakeTimers();
    setup({ activity: { nodes: { n2: { in: 5, out: { true: 4, false: 1 }, errors: 0 } }, window: 'last 24 h' }, nodeMessages: {} });
    fireEvent.pointerEnter(nodeEl('Gate'), { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByTestId('node-tip-counters')).toHaveTextContent('In 5 · Out 5 · Errors 0 (last 24 h)');
  });
});

describe('dragging a connection end (UI-31)', () => {
  it('moves the target end onto another block with the handle, as one undo step', () => {
    const { container, last, ref } = setup();
    fireEvent.pointerDown(container.querySelector('[data-edge-id="e1"]')!);
    const handle = screen.getByTestId('edge-handle-target');
    fireEvent.pointerDown(handle, { button: 0 });
    expect(container.querySelector('[data-testid="edge-rewire-path"]')).not.toBeNull();
    fireEvent.pointerUp(container.querySelector('[data-in-node="n3"]')!, { button: 0 });
    expect(last()?.edges.find((e) => e.edgeId === 'e1')).toMatchObject({ sourceNodeId: 'n1', targetNodeId: 'n3' });
    act(() => ref.current!.undo());
    expect(last()?.edges.find((e) => e.edgeId === 'e1')).toMatchObject({ targetNodeId: 'n2' });
  });

  it('moves the source end to another output of the same block', () => {
    const { container, last } = setup();
    fireEvent.pointerDown(container.querySelector('[data-edge-id="e2"]')!);
    fireEvent.pointerDown(screen.getByTestId('edge-handle-source'), { button: 0 });
    fireEvent.pointerUp(container.querySelector('[data-out-node="n2"][data-out-port="false"]')!, { button: 0 });
    expect(last()?.edges.find((e) => e.edgeId === 'e2')).toMatchObject({ sourceNodeId: 'n2', sourcePort: 'false', targetNodeId: 'n3' });
  });

  it('leaves the connection alone when the drop is refused, and has no handles when read only', () => {
    const { container, onChange } = setup();
    fireEvent.pointerDown(container.querySelector('[data-edge-id="e1"]')!);
    fireEvent.pointerDown(screen.getByTestId('edge-handle-target'), { button: 0 });
    // a trigger has no input: refused (the release is looked up under the pointer, as for a touch)
    const source = nodeEl('Source');
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => source });
    fireEvent.pointerUp(source, { button: 0 });
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    expect(onChange).not.toHaveBeenCalled();
    cleanup();
    const ro = setup({ readOnly: true });
    fireEvent.pointerDown(ro.container.querySelector('[data-edge-id="e1"]')!);
    expect(screen.queryByTestId('edge-handle-target')).toBeNull();
  });
});

describe('the Messages tab (UI-33)', () => {
  const msgs = { n2: [
    { id: 'a', ts: Date.UTC(2026, 0, 1, 10, 0, 0), dir: 'in' as const, run: 'run-0001-abc', msg: { payload: { t: 1 } } },
    { id: 'b', ts: Date.UTC(2026, 0, 1, 10, 0, 1), dir: 'out' as const, port: 'true', run: 'run-0001-abc', msg: { payload: { t: 1 } } },
  ] };

  it('lists the messages, newest first, with bodies only when the host allows them', async () => {
    const user = userEvent.setup();
    setup({ nodeMessages: msgs });
    clickNode('Gate');
    await user.click(screen.getByTestId('panel-tab-messages'));
    const rows = screen.getAllByTestId('panel-message');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Out → true');
    expect(screen.getByTestId('panel-messages-hidden')).toBeInTheDocument();
    expect(rows[0].textContent).not.toContain('payload');
    expect(screen.getByTestId('panel-messages-count')).toHaveTextContent('2');
  });

  it('shows bodies and "Test with this input" for a viewer who may see them', async () => {
    const user = userEvent.setup();
    const onTestMessage = vi.fn();
    setup({ nodeMessages: msgs, messageBodies: true, onTestMessage });
    clickNode('Gate');
    await user.click(screen.getByTestId('panel-tab-messages'));
    expect(screen.getAllByTestId('panel-message')[1]).toHaveTextContent('payload');
    await user.click(screen.getByRole('button', { name: 'Test with this input' }));
    expect(onTestMessage).toHaveBeenCalledWith('n2', expect.objectContaining({ id: 'a' }));
  });

  it('has no Messages tab without a feed', () => {
    setup();
    clickNode('Gate');
    expect(screen.queryByTestId('panel-tab-messages')).toBeNull();
  });
});

describe('the single-script test (06 §6.7)', () => {
  const catalog = catalogFromBlocks([[
    { type: 'trigger.boot', title: 'Boot' },
    { type: 'logic.script', title: 'Script', params: { code: { type: 'code', store: 'script', api: 'automation-script', default: 'return msg;' } } },
  ]]);
  const nodes = [node('t', 'trigger.boot', 'Start', 0, 0), node('s', 'logic.script', 'Calc', 300, 0, { script: 'return msg;' })];

  it('runs the code through the host, shows the outputs and an error in place, and saves the code into the block', async () => {
    const user = userEvent.setup();
    const onScriptTest = vi.fn()
      .mockResolvedValueOnce({ outputs: [{ port: 'out', label: 'out', msg: { payload: 42 } }], log: ['hello'], cpuMs: 3 })
      .mockResolvedValueOnce({ outputs: [], error: { code: 'script_error', message: 'boom', line: 1, col: 8 } });
    const { last } = setup({ catalog, initialNodes: nodes, initialEdges: [edge('x', 't', 'out', 's')], onScriptTest, scriptTestSample: () => ({ msgType: 'T', payload: { v: 1 } }) });
    clickNode('Calc');
    await user.click(screen.getByTestId('panel-test-script'));
    const pane = screen.getByTestId('script-test');
    const code = within(pane).getByLabelText('Code');
    expect(code).toHaveValue('return msg;');
    await user.click(screen.getByTestId('script-test-run'));
    expect(onScriptTest).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 's', code: 'return msg;', msg: expect.objectContaining({ msgType: 'T', payload: { v: 1 } }) }));
    expect(await screen.findByTestId('script-test-output')).toHaveTextContent('42');
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByText('3 ms CPU')).toBeInTheDocument();
    fireEvent.change(code, { target: { value: 'return boom;' } });
    await user.click(screen.getByTestId('script-test-run'));
    expect(await screen.findByTestId('script-test-error')).toHaveTextContent('Line 1, column 8: script_error: boom');
    expect(pane.querySelector('[data-kui-codeeditor-problems]')).toHaveTextContent('boom');
    await user.click(screen.getByTestId('script-test-save'));
    expect(screen.queryByTestId('script-test')).toBeNull();
    expect(last()?.nodes.find((n) => n.nodeId === 's')?.script).toBe('return boom;');
  });

  it('is not offered without a host runner, nor for a block without a script', () => {
    setup({ catalog, initialNodes: nodes, initialEdges: [] });
    clickNode('Calc');
    expect(screen.queryByTestId('panel-test-script')).toBeNull();
  });
});

describe('the side bar (debug comparison items 4 and 6)', () => {
  it('puts Block, Debug, Help, Trace, Errors, Runs, Data and Busiest in one bar, with the node panel as Block', async () => {
    const user = userEvent.setup();
    setup({ sideBar: { messages: [], traceTab: { content: <p>trace here</p> }, runsTab: { content: <p>runs here</p> } } });
    const tabs = screen.getAllByRole('tab').map((t) => t.getAttribute('data-testid'));
    expect(tabs).toEqual(['insight-tab-block', 'insight-tab-debug', 'insight-tab-help', 'insight-tab-trace', 'insight-tab-errors', 'insight-tab-runs', 'insight-tab-data', 'insight-tab-busiest']);
    expect(screen.getByText('Click a block on the canvas to edit it.')).toBeInTheDocument();
    clickNode('Gate');
    expect(screen.getByLabelText('Gate settings')).toBeInTheDocument();
    await user.click(screen.getByTestId('insight-tab-runs'));
    expect(screen.getByText('runs here')).toBeInTheDocument();
    // picking another block brings the bar back to Block
    clickNode('Sink');
    expect(screen.getByLabelText('Sink settings')).toBeInTheDocument();
  });

  it('lists the problems that stop a deploy in Errors: the editor\'s own, then the host\'s, with links', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    const { ref } = setup({ initialNodes: [...NODES, node('g', 'ghost.block', 'Ghost', 900, 0)], sideBar: { messages: [], deployProblems: [{ message: 'plan limit', code: 'limit' }], onReveal } });
    const errors = ref.current!.validate().errors.length;
    expect(errors).toBeGreaterThan(0);
    expect(screen.getByTestId('insight-err-count')).toHaveTextContent(String(errors + 1));
    await user.click(screen.getByTestId('insight-tab-errors'));
    const list = screen.getByTestId('insight-deploy-problems');
    expect(within(list).getByText('plan limit')).toBeInTheDocument();
    const link = within(list).getAllByRole('button')[0];
    await user.click(link);
    expect(onReveal).toHaveBeenCalled();
  });
});
