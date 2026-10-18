import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, within } from '@testing-library/react';
import {
  LogViewer, useLogStream, matchingIndices, buildDisplay, facetCounts, detectFacetFields, wrappedLineCount, appendWindow,
  type LogLine, type LogSeverity,
} from './index';

const SEVS: LogSeverity[] = ['trace', 'debug', 'info', 'info', 'info', 'warn', 'error'];
function makeLines(n: number, start = 0): LogLine[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `l${start + i}`,
    ts: 1_700_000_000_000 + (start + i) * 1000,
    severity: SEVS[(start + i) % SEVS.length],
    message: `line ${start + i} ${(start + i) % 10 === 0 ? 'needle' : 'hay'}`,
    fields: { service: (start + i) % 2 ? 'api' : 'worker', region: 'eu' },
  }));
}

afterEach(() => { vi.useRealTimers(); });

describe('log model', () => {
  const lines = makeLines(30);
  it('filters by text across message, source and fields', () => {
    expect(matchingIndices(lines, { query: 'needle' })).toEqual([0, 10, 20]);
    expect(matchingIndices(lines, { query: 'service=api' }).length).toBe(15);
    expect(matchingIndices(lines, { query: 'NEEDLE' })).toEqual([0, 10, 20]);
  });
  it('ANDs between filters and ORs within one', () => {
    const only = matchingIndices(lines, { severities: new Set<LogSeverity>(['error']), facets: { service: new Set(['api']) } });
    expect(only.every((i) => lines[i].severity === 'error' && lines[i].fields!.service === 'api')).toBe(true);
    const either = matchingIndices(lines, { severities: new Set<LogSeverity>(['error', 'warn']) });
    expect(either.every((i) => ['error', 'warn'].includes(lines[i].severity))).toBe(true);
  });
  it('adds context lines around an expanded line only when it is filtered out neighbours', () => {
    const matches = matchingIndices(lines, { query: 'needle' });
    const d = buildDisplay(lines, matches, { l10: { before: 2, after: 1 } });
    expect(d.indices).toEqual([0, 8, 9, 10, 11, 20]);
    expect([...d.context].sort((a, b) => a - b)).toEqual([8, 9, 11]);
    const all = buildDisplay(lines, lines.map((_, i) => i), { l10: { before: 5, after: 5 } });
    expect(all.indices.length).toBe(30);
    expect(all.context.size).toBe(0);
  });
  it('counts facets, severities in severity order', () => {
    const f = facetCounts(lines, ['severity', 'service']);
    expect(f.severity.map((x) => x.value)).toEqual(['trace', 'debug', 'info', 'warn', 'error']);
    expect(f.service.map((x) => x.value).sort()).toEqual(['api', 'worker']);
  });
  it('detects facet fields with a few distinct values', () => {
    expect(detectFacetFields(lines)).toEqual(['service']); // region has one value: not a useful facet
  });
  it('estimates wrapped line counts', () => {
    expect(wrappedLineCount('abc', 10)).toBe(1);
    expect(wrappedLineCount('a'.repeat(25), 10)).toBe(3);
    expect(wrappedLineCount('ab\ncd\n', 10)).toBe(3);
    expect(wrappedLineCount('', 10)).toBe(1);
  });
  it('keeps the newest window and reports drops', () => {
    expect(appendWindow([1, 2, 3], [4, 5], 4)).toEqual({ lines: [2, 3, 4, 5], dropped: 1 });
    expect(appendWindow([1], [], 4)).toEqual({ lines: [1], dropped: 0 });
  });
});

describe('LogViewer', () => {
  it('windows 20 000 lines: only a screenful is in the DOM, and the list still reports the full size', () => {
    render(<LogViewer lines={makeLines(20_000)} />);
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBeLessThan(80);
    expect(opts[0]).toHaveAttribute('aria-setsize', '20000');
    expect(opts[0]).toHaveAttribute('aria-posinset', '1');
  });

  it('labels severity with text, not only colour', () => {
    render(<LogViewer lines={makeLines(7)} />);
    const err = screen.getAllByRole('option').find((o) => o.getAttribute('data-severity') === 'error')!;
    expect(within(err).getByText('ERROR')).toBeInTheDocument();
  });

  it('filters by search text and highlights the match', () => {
    render(<LogViewer lines={makeLines(30)} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search logs' }), { target: { value: 'needle' } });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(document.querySelectorAll('mark')).toHaveLength(3);
    expect(screen.getByText('3 of 30 lines')).toBeInTheDocument();
  });

  it('highlight mode keeps every line and steps through matches', () => {
    render(<LogViewer lines={makeLines(30)} searchMode="highlight" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'needle' } });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-setsize', '30'); // nothing filtered out
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });

  it('toggles field and severity facet chips', () => {
    render(<LogViewer lines={makeLines(14)} />);
    const group = screen.getByRole('group', { name: 'Filter by service' });
    fireEvent.click(within(group).getByRole('button', { name: /api/ }));
    expect(within(group).getByRole('button', { name: /api/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(7);
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by severity' })).getByRole('button', { name: /ERROR/ }));
    expect(screen.getAllByRole('option').length).toBeLessThan(7);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('option')).toHaveLength(14);
  });

  it('expands context lines around a selected match', () => {
    render(<LogViewer lines={makeLines(30)} contextStep={2} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'needle' } });
    fireEvent.click(screen.getAllByRole('option')[1]); // line 10
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 lines before' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 lines after' }));
    expect(screen.getAllByRole('option')).toHaveLength(3 + 4);
    expect(document.querySelectorAll('[data-context="true"]')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Hide context' }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('moves selection with the arrow keys and clears it with Escape', () => {
    const onSelect = vi.fn();
    render(<LogViewer lines={makeLines(10)} onSelect={onSelect} />);
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'l1' }));
    fireEvent.keyDown(list, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'l9' }));
    expect(list).toHaveAttribute('aria-activedescendant', expect.stringContaining('l9'));
    fireEvent.keyDown(list, { key: 'Escape' });
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('copies a line as text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopy = vi.fn();
    render(<LogViewer lines={makeLines(3)} onCopy={onCopy} timeZone="UTC" />);
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Copy line' })[0]); });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('line 0 needle'));
    expect(writeText.mock.calls[0][0]).toContain('TRACE');
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('toggles wrap and reports it', () => {
    const onWrapChange = vi.fn();
    render(<LogViewer lines={makeLines(3)} onWrapChange={onWrapChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wrap lines' }));
    expect(onWrapChange).toHaveBeenCalledWith(true);
    expect(screen.getAllByRole('option')[0].querySelector('.whitespace-pre-wrap')).not.toBeNull();
  });

  it('shows the drop counter and the empty states', () => {
    const { rerender } = render(<LogViewer lines={[]} dropped={1234} />);
    expect(screen.getByText(/1,?234 lines dropped/)).toBeInTheDocument();
    expect(screen.getByText('No log lines yet.')).toBeInTheDocument();
    rerender(<LogViewer lines={makeLines(3)} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No lines match the current filters.')).toBeInTheDocument();
  });

  it('follow: pins to the newest line, pauses when the user scrolls up, counts new lines and resumes', () => {
    const onFollowChange = vi.fn();
    const { rerender } = render(<LogViewer lines={makeLines(50)} follow onFollowChange={onFollowChange} />);
    const list = screen.getByRole('listbox');
    let scrollHeight = 2000;
    Object.defineProperty(list, 'scrollHeight', { get: () => scrollHeight, configurable: true });
    Object.defineProperty(list, 'clientHeight', { get: () => 400, configurable: true });
    // The user scrolls away from the bottom.
    list.scrollTop = 500;
    fireEvent.scroll(list);
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    rerender(<LogViewer lines={makeLines(50)} follow={false} onFollowChange={onFollowChange} />);
    rerender(<LogViewer lines={makeLines(58)} follow={false} onFollowChange={onFollowChange} />);
    const jump = screen.getByRole('button', { name: /8 new lines/ });
    fireEvent.click(jump);
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
    scrollHeight = 3000;
    rerender(<LogViewer lines={makeLines(58)} follow onFollowChange={onFollowChange} />);
    expect(list.scrollTop).toBe(3000);
  });

  it('follow: scrolling back to the bottom resumes a scroll-pause', () => {
    const onFollowChange = vi.fn();
    const { rerender } = render(<LogViewer lines={makeLines(50)} follow onFollowChange={onFollowChange} />);
    const list = screen.getByRole('listbox');
    Object.defineProperty(list, 'scrollHeight', { get: () => 2000, configurable: true });
    Object.defineProperty(list, 'clientHeight', { get: () => 400, configurable: true });
    list.scrollTop = 100;
    fireEvent.scroll(list);
    rerender(<LogViewer lines={makeLines(50)} follow={false} onFollowChange={onFollowChange} />);
    list.scrollTop = 1600;
    fireEvent.scroll(list);
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
  });

  it('the follow button toggles', () => {
    const onFollowChange = vi.fn();
    render(<LogViewer lines={makeLines(3)} defaultFollow onFollowChange={onFollowChange} />);
    const btn = screen.getByRole('button', { name: /Follow/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onFollowChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: /Follow/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('useLogStream', () => {
  it('coalesces pushes into one update, keeps the newest lines and counts drops (including upstream ones)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLogStream({ maxLines: 5, flushMs: 100 }));
    act(() => {
      result.current.push(makeLines(3));
      result.current.push(makeLines(1, 3));
      result.current.push(makeLines(3, 4), { dropped: 10 });
    });
    expect(result.current.lines).toHaveLength(0); // nothing until the flush
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.lines.map((l) => l.id)).toEqual(['l2', 'l3', 'l4', 'l5', 'l6']);
    expect(result.current.dropped).toBe(2 + 10);
    act(() => result.current.clear());
    expect(result.current.lines).toEqual([]);
    expect(result.current.dropped).toBe(0);
  });

  it('flushMs 0 updates on every push', () => {
    const { result } = renderHook(() => useLogStream({ flushMs: 0 }));
    act(() => result.current.push(makeLines(1)[0]));
    expect(result.current.lines).toHaveLength(1);
  });
});
