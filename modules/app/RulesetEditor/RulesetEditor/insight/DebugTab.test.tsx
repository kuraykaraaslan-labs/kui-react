import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightPanel } from './InsightPanel';
import { JsonTree, TREE_MAX_CHILDREN } from './JsonTree';
import type { DebugMessage } from './types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const T0 = new Date(2026, 9, 12, 7, 5, 9, 42).getTime() / 1000;
const msg = (seq: number, extra: Partial<DebugMessage> = {}): DebugMessage => ({ seq, ts: T0 + seq, flow: 'f1', node: 'n1', kind: 'msg', msg: { temp: 31.5, unit: 'C', tags: ['a', 'b'] }, topic: 'boiler/temp', ...extra });
const names = { n1: 'Sensor in', n2: 'Too hot?', s1: 'Hold 2 min' };
const cards = () => screen.getByTestId('insight-dbg-list').querySelectorAll('[data-kind]');

describe('Debug tab: the message card', () => {
  it('has the time with milliseconds, the block link, a copy button, the type line and the topic', () => {
    render(<InsightPanel nodeNames={names} messages={[msg(1)]} />);
    const card = cards()[0] as HTMLElement;
    expect(card.querySelector('.tabular-nums')?.textContent).toBe('07:05:10.042');
    expect(within(card).getByTitle('Show this block')).toHaveTextContent('Sensor in');
    expect(within(card).getByTestId('insight-dbg-copy')).toBeInTheDocument();
    expect(card).toHaveTextContent('msg : object · topic boiler/temp');
  });
  it('draws the accent bar in the colour of the kind', () => {
    render(<InsightPanel nodeNames={names} messages={[msg(1), msg(2, { kind: 'warn', text: 'queue' }), msg(3, { kind: 'error', text: 'bad' })]} />);
    const [m, w, e] = Array.from(cards());
    expect(m.className).toContain('border-l-primary');
    expect(w.className).toContain('border-l-warning');
    expect(e.className).toContain('border-l-error');
    expect(w).toHaveTextContent('queue');
    expect(w.querySelector('details')).toBeNull(); // a warning has no value
    expect(e).toHaveTextContent('bad');
  });
  it('shows an error without the fields the engine adds', () => {
    render(<InsightPanel nodeNames={names} messages={[msg(1, { kind: 'error', text: 'bad', msg: { temp: 'abc', _msgid: 'x', _run: 1, _hops: 2, event: {} } })]} />);
    const card = cards()[0];
    expect(card).toHaveTextContent('temp');
    expect(card).not.toHaveTextContent('_msgid');
    expect(card).not.toHaveTextContent('_hops');
  });
  it('says a cut value was cut and shows its text', () => {
    render(<InsightPanel messages={[msg(1, { truncated: true, size: 70000, msg: 'abcdef…' })]} />);
    expect(cards()[0]).toHaveTextContent('msg : text (cut, 70000 bytes)');
    expect(cards()[0]).toHaveTextContent('abcdef…');
  });
  it('names a block of another flow with its flow, and a block id with a path after its first segment', () => {
    render(<InsightPanel nodeNames={names} flowId="f1" messages={[msg(1, { flow: 'f2' }), msg(2, { node: 's1/x' })]} />);
    fireEvent.change(screen.getByTestId('insight-dbg-source'), { target: { value: 'all' } });
    const links = Array.from(cards()).map((c) => within(c as HTMLElement).getByTitle('Show this block').textContent);
    expect(links).toEqual(['f2 / Sensor in', 'Hold 2 min']);
  });
  it('reveals the root block when its name is pressed', async () => {
    const onReveal = vi.fn();
    render(<InsightPanel nodeNames={names} messages={[msg(1, { node: 's1/x' })]} onReveal={onReveal} />);
    await userEvent.click(within(cards()[0] as HTMLElement).getByTitle('Show this block'));
    expect(onReveal).toHaveBeenCalledWith('s1');
  });
});

describe('Debug tab: the value tree', () => {
  it('opens a small first level and folds the rest, which opens on a click and draws its children then', async () => {
    render(<InsightPanel nodeNames={names} messages={[msg(1)]} />);
    const card = cards()[0] as HTMLElement;
    expect(card).toHaveTextContent('temp: 31.5');
    expect(card).toHaveTextContent('unit: "C"');
    expect(card.querySelector('details[open]')).not.toBeNull();
    expect(card).toHaveTextContent('tags: array[2]');
    expect(card).not.toHaveTextContent('"a"'); // the array is folded and not drawn yet
    const fold = Array.from(card.querySelectorAll('details')).find((d) => d.textContent?.startsWith('tags'))!;
    fireEvent(fold, new Event('toggle')); // closed: nothing
    fold.open = true;
    fireEvent(fold, new Event('toggle'));
    expect(card).toHaveTextContent('"a"');
    expect(card).toHaveTextContent('0: "a"');
  });
  it('colours the kinds of value apart and leaves markup as text', () => {
    const { container } = render(<JsonTree value={{ s: '<b>x</b>', n: 3, b: true, z: null, e: {} }} />);
    expect(container.querySelector('.text-success-fg')?.textContent).toBe('"<b>x</b>"');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('.text-info')?.textContent).toBe('3');
    expect(container.querySelector('.text-warning-fg')?.textContent).toBe('true');
    expect(Array.from(container.querySelectorAll('.text-text-disabled')).some((e) => e.textContent === 'null')).toBe(true);
    expect(container).toHaveTextContent('e: { }');
  });
  it('shows the first three keys of a folded object', () => {
    const big = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, i]));
    const { container } = render(<JsonTree value={big} />);
    expect(container.querySelector('details[open]')).toBeNull(); // more than eight keys: folded
    expect(container).toHaveTextContent('object { k0, k1, k2, … }');
  });
  it('draws at most 200 children and counts the rest', () => {
    const many = Array.from({ length: TREE_MAX_CHILDREN + 5 }, (_, i) => i);
    const { container } = render(<JsonTree value={{ list: many }} />);
    const fold = container.querySelector('details details') as HTMLDetailsElement;
    fold.open = true;
    fireEvent(fold, new Event('toggle'));
    expect(fold.querySelectorAll(':scope > div > div').length).toBe(TREE_MAX_CHILDREN + 1);
    expect(fold).toHaveTextContent('… 5 more');
  });
  it('draws a plain value alone', () => {
    const { container } = render(<JsonTree value="hi" />);
    expect(container.textContent).toBe('"hi"');
  });
});

describe('Debug tab: the tools row', () => {
  it('filters by flow, selected block or all flows, and by kind', () => {
    render(<InsightPanel nodeNames={names} flowId="f1" selectedNodeId="n2"
      messages={[msg(1), msg(2, { flow: 'f2' }), msg(3, { node: 'n2', kind: 'error', text: 'bad' })]} />);
    expect(cards()).toHaveLength(2); // this flow
    fireEvent.change(screen.getByTestId('insight-dbg-source'), { target: { value: 'all' } });
    expect(cards()).toHaveLength(3);
    fireEvent.change(screen.getByTestId('insight-dbg-source'), { target: { value: 'node' } });
    expect(cards()).toHaveLength(1);
    fireEvent.change(screen.getByTestId('insight-dbg-kind'), { target: { value: 'msg' } });
    expect(screen.getByTestId('insight-dbg-list')).toHaveTextContent('No messages yet.');
  });
  it('asks for a block when none is selected', () => {
    render(<InsightPanel messages={[msg(1)]} />);
    fireEvent.change(screen.getByTestId('insight-dbg-source'), { target: { value: 'node' } });
    expect(screen.getByTestId('insight-dbg-list')).toHaveTextContent('Select a block on the canvas.');
  });
  it('copies one message and all messages, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    const onNotice = vi.fn();
    render(<InsightPanel nodeNames={names} messages={[msg(1), msg(2, { kind: 'warn', text: 'queue' })]} onNotice={onNotice} />);
    await userEvent.click(within(cards()[0] as HTMLElement).getByTestId('insight-dbg-copy'));
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('Sensor in  topic boiler/temp'));
    expect(onNotice).toHaveBeenLastCalledWith('copied', 1);
    await userEvent.click(screen.getByTestId('insight-dbg-copy-all'));
    expect(writeText.mock.calls.at(-1)?.[0]).toContain('queue');
    expect(onNotice).toHaveBeenLastCalledWith('copied', 2);
  });
  it('says there is nothing to copy', async () => {
    const onNotice = vi.fn();
    render(<InsightPanel messages={[]} onNotice={onNotice} />);
    await userEvent.click(screen.getByTestId('insight-dbg-copy-all'));
    expect(onNotice).toHaveBeenCalledWith('empty', 0);
  });
  it('marks the pause button while paused and has the empty text of the router', () => {
    render(<InsightPanel messages={[]} />);
    expect(screen.getByTestId('insight-dbg-list')).toHaveTextContent('No messages yet. Add a Debug block, connect it, save and switch the flow on.');
    fireEvent.click(screen.getByTestId('insight-dbg-pause'));
    expect(screen.getByTestId('insight-dbg-pause').className).toContain('bg-primary-subtle');
  });
});

describe('InsightPanel: the tab strip', () => {
  it('has the tabs in the order of the router (Debug, Errors, Data, Busiest), the open one with its name and the others as icons', () => {
    render(<InsightPanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-label'))).toEqual(['Debug', 'Errors', 'Data', 'Busiest']);
    expect(tabs[0]).toHaveTextContent('Debug');
    expect(tabs[1].textContent).toBe('');
    expect(tabs.every((t) => t.querySelector('svg'))).toBe(true);
    fireEvent.click(tabs[2]);
    expect(screen.getByTestId('insight-tab-data')).toHaveTextContent('Data');
    expect(screen.getByTestId('insight-tab-debug').textContent).toBe('');
  });
  it('counts the messages that came while another tab was open, until Debug is opened again', () => {
    const { rerender } = render(<InsightPanel messages={[msg(1)]} />);
    expect(screen.queryByTestId('insight-dbg-count')).toBeNull();
    fireEvent.click(screen.getByTestId('insight-tab-data'));
    rerender(<InsightPanel messages={[msg(1), msg(2), msg(3)]} />);
    expect(screen.getByTestId('insight-dbg-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByTestId('insight-tab-debug'));
    expect(screen.queryByTestId('insight-dbg-count')).toBeNull();
  });
  it('shows 99+ for a long list and the error count in red', () => {
    const many = Array.from({ length: 120 }, (_, i) => msg(i + 1));
    const { rerender } = render(<InsightPanel messages={[]} defaultTab="data" />);
    rerender(<InsightPanel messages={many} defaultTab="data" />);
    expect(screen.getByTestId('insight-dbg-count')).toHaveTextContent('99+');
    rerender(<InsightPanel messages={[msg(1, { kind: 'error', text: 'x' })]} defaultTab="data" />);
    expect(screen.getByTestId('insight-err-count').className).toContain('bg-error');
  });
  it('has a close button only when the host gives onClose', () => {
    const onClose = vi.fn();
    const { rerender } = render(<InsightPanel />);
    expect(screen.queryByTestId('insight-close')).toBeNull();
    rerender(<InsightPanel onClose={onClose} />);
    fireEvent.click(screen.getByTestId('insight-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('is the frame of the router side bar: a left border and a raised fill, not a rounded card', () => {
    render(<InsightPanel />);
    const aside = screen.getByRole('complementary');
    expect(aside.className).toContain('border-l');
    expect(aside.className).toContain('bg-surface-raised');
    expect(aside.className).not.toContain('rounded');
  });
});
