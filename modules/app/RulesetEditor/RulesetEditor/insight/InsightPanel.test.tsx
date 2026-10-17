import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { InsightPanel } from './InsightPanel';
import type { DebugMessage } from './types';

afterEach(() => cleanup());

const msg = (seq: number, kind: DebugMessage['kind'] = 'msg', extra: Partial<DebugMessage> = {}): DebugMessage => ({ seq, ts: 1000 + seq, node: 'n1', kind, msg: { v: seq }, ...extra });
const names = { n1: 'Source', n2: 'Gate', s1: 'Hold 2 min', c1: 'Catcher' };
const tab = (id: string) => fireEvent.click(screen.getByTestId(`insight-tab-${id}`));

describe('InsightPanel', () => {
  it('switches the four tabs', () => {
    render(<InsightPanel nodeNames={names} />);
    expect(screen.getByTestId('insight-dbg-list')).toBeTruthy();
    tab('busiest');
    expect(screen.getByText('No block has handled a message yet.')).toBeTruthy();
    tab('errors');
    expect(screen.getByText('No errors in the messages read so far.')).toBeTruthy();
    tab('data');
    expect(screen.getByText('No events yet.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('insight-data-context'));
    expect(screen.getByTestId('insight-ctx-scope')).toBeTruthy();
  });

  it('Busiest: names subflow rows after the instance, sorts and reveals the root block', () => {
    const onReveal = vi.fn();
    render(<InsightPanel defaultTab="busiest" onReveal={onReveal} nodeNames={names}
      nodeStats={{ n2: { in: 3, out: 3, avgMs: 9 }, 's1/x': { in: 8, out: 8, avgMs: 1 } }} />);
    const rows = () => within(screen.getByTestId('insight-perf-rows')).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows()[0]).toContain('Hold 2 min');
    fireEvent.click(screen.getByTestId('insight-perf-ms'));
    expect(rows()[0]).toContain('Gate');
    fireEvent.click(screen.getByRole('button', { name: 'Hold 2 min' }));
    expect(onReveal).toHaveBeenCalledWith('s1');
  });

  it('Debug: pause stops reading and resume catches up', () => {
    const { rerender } = render(<InsightPanel nodeNames={names} messages={[msg(1)]} />);
    expect(screen.getByTestId('insight-dbg-list').children).toHaveLength(1);
    fireEvent.click(screen.getByTestId('insight-dbg-pause'));
    expect(screen.getByTestId('insight-dbg-pause').getAttribute('aria-pressed')).toBe('true');
    rerender(<InsightPanel nodeNames={names} messages={[msg(1), msg(2), msg(3)]} />);
    expect(screen.getByTestId('insight-dbg-list').children).toHaveLength(1);
    fireEvent.click(screen.getByTestId('insight-dbg-pause'));
    expect(screen.getByTestId('insight-dbg-list').children).toHaveLength(3);
  });

  it('Debug: kind filter', () => {
    render(<InsightPanel nodeNames={names} messages={[msg(1), msg(2, 'error', { text: 'bad' }), msg(3, 'warn', { text: 'hmm' })]} />);
    const list = screen.getByTestId('insight-dbg-list');
    fireEvent.change(screen.getByTestId('insight-dbg-kind'), { target: { value: 'problem' } });
    expect(list.children).toHaveLength(2);
    fireEvent.change(screen.getByTestId('insight-dbg-kind'), { target: { value: 'msg' } });
    expect(list.children).toHaveLength(1);
  });

  it('Debug: download notices empty, and copies when the download is blocked', () => {
    const onNotice = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { rerender } = render(<InsightPanel nodeNames={names} onNotice={onNotice} />);
    fireEvent.click(screen.getByTestId('insight-dbg-save'));
    expect(onNotice).toHaveBeenCalledWith('empty', 0);
    rerender(<InsightPanel nodeNames={names} onNotice={onNotice} messages={[msg(1)]} />);
    /* jsdom has no URL.createObjectURL, so the download is "blocked" */
    fireEvent.click(screen.getByTestId('insight-dbg-save'));
    expect(onNotice).toHaveBeenLastCalledWith('copied', 1);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Source');
  });

  it('Errors: caught link selects the catcher; its own port is a badge', () => {
    const onReveal = vi.fn();
    render(<InsightPanel defaultTab="errors" onReveal={onReveal} nodeNames={names}
      runs={[{ ts: 5, errors: [{ node: 'n2', message: 'boom', caught: 'c1' }, { node: 'n1', message: 'own', caught: 'n1' }] }]} />);
    fireEvent.click(screen.getByTestId('insight-caught-link'));
    expect(onReveal).toHaveBeenCalledWith('c1');
    expect(screen.getByText('its error port')).toBeTruthy();
  });

  it('Data: fill bar tones, hidden for system scope and without numbers', () => {
    const { rerender } = render(<InsightPanel defaultTab="data" defaultSegment="context" context={{ memory: { bytes: 85, limit: 100 } }} />);
    expect(screen.getByRole('progressbar').getAttribute('data-tone')).toBe('warn');
    rerender(<InsightPanel defaultTab="data" defaultSegment="context" context={{ memory: { bytes: 100, limit: 100 } }} />);
    expect(screen.getByRole('progressbar').getAttribute('data-tone')).toBe('full');
    fireEvent.change(screen.getByTestId('insight-ctx-scope'), { target: { value: 'sys' } });
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.change(screen.getByTestId('insight-ctx-scope'), { target: { value: 'flow' } });
    fireEvent.change(screen.getByTestId('insight-ctx-store'), { target: { value: 'persist' } });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('InsightPanel: uiMessages', () => {
  const de = {
    insPanel: 'Laufzeitübersicht', insTabDebug: 'Fehlersuche', insTabErrors: 'Fehler', insNoBusiest: 'Noch kein Block hat eine Nachricht verarbeitet.',
    insSortBy: 'Sortieren nach', insSortIn: 'Nachrichten ein', insKindLabel: 'Art der Nachrichten', insKindProblem: 'Fehler und Warnungen',
    insPause: 'Nachrichten anhalten', insResume: 'Nachrichten fortsetzen', insNoMessages: 'Noch keine Nachrichten.', insNoErrors: 'Keine Fehler bisher.',
    insErrRunning: 'Fehler im Betrieb', insNotCaught: 'nicht abgefangen', insErrorsN: (n: number) => `${n} Fehler`, insScope: 'Bereich', insScopeSys: 'System (nur lesen)',
    insFill: (l: string, b: string, lim: string, p: number) => `${l}: ${b} von ${lim} belegt (${p} %).`, insFillLabel: 'Der Speicher aller Abläufe',
  };

  it('translates the tabs, the debug tab and its buttons, a message left out stays English', () => {
    render(<InsightPanel uiMessages={de} nodeNames={names} messages={[msg(1)]} />);
    expect(screen.getByRole('complementary', { name: 'Laufzeitübersicht' })).toBeTruthy();
    expect(screen.getByTestId('insight-tab-debug').textContent).toBe('Fehlersuche'); // the open tab shows its name
    expect(screen.getByTestId('insight-tab-busiest').getAttribute('aria-label')).toBe('Busiest'); // not given, and a closed tab is its icon
    expect(screen.getByLabelText('Art der Nachrichten')).toBeTruthy();
    expect(within(screen.getByLabelText('Art der Nachrichten')).getByRole('option', { name: 'Fehler und Warnungen' })).toBeTruthy();
    expect(screen.getByTestId('insight-dbg-pause').getAttribute('aria-label')).toBe('Nachrichten anhalten');
    fireEvent.click(screen.getByTestId('insight-dbg-pause'));
    expect(screen.getByTestId('insight-dbg-pause').getAttribute('aria-label')).toBe('Nachrichten fortsetzen');
  });
  it('translates the busiest tab, the errors tab and the data tab', () => {
    render(<InsightPanel uiMessages={de} defaultTab="busiest" nodeNames={names} />);
    expect(screen.getByText('Noch kein Block hat eine Nachricht verarbeitet.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Sortieren nach' })).toBeTruthy();
    cleanup();
    render(<InsightPanel uiMessages={de} defaultTab="errors" nodeNames={names} messages={[msg(1, 'error', { text: 'boom' })]} nodeStats={{ n1: { in: 1, out: 0, errors: 3 } }} />);
    expect(screen.getByText('Fehler im Betrieb')).toBeTruthy();
    expect(screen.getByText('nicht abgefangen')).toBeTruthy();
    expect(screen.getByText('3 Fehler')).toBeTruthy();
    cleanup();
    render(<InsightPanel uiMessages={de} defaultTab="data" defaultSegment="context" context={{ memory: { bytes: 1024, limit: 4096 } }} />);
    expect(screen.getByLabelText('Bereich')).toBeTruthy();
    expect(within(screen.getByLabelText('Bereich')).getByRole('option', { name: 'System (nur lesen)' })).toBeTruthy();
    expect(screen.getByText(/^Der Speicher aller Abläufe: .* von .* belegt \(25 %\)\.$/)).toBeTruthy();
  });
});

describe('InsightPanel: one bar (debug comparison items 4 and 6)', () => {
  it('lists the problems that stop a deploy first in Errors and counts them', () => {
    const onReveal = vi.fn();
    render(<InsightPanel nodeNames={names} onReveal={onReveal} deployProblems={[{ message: 'needs a value', nodeId: 'n2', code: 'required' }, { message: 'over the plan', severity: 'warning' }]} />);
    expect(screen.getByTestId('insight-err-count')).toHaveTextContent('2');
    tab('errors');
    const list = screen.getByTestId('insight-deploy-problems');
    expect(list).toHaveTextContent('Gate: needs a value');
    expect(list).toHaveTextContent('over the plan');
    fireEvent.click(within(list).getByRole('button', { name: 'Gate: needs a value' }));
    expect(onReveal).toHaveBeenCalledWith('n2');
  });

  it('orders the host tabs as the router does, shows the header and its own tabs, and follows a controlled tab', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<InsightPanel nodeNames={names} header={<p>level</p>} tab="runs" onTabChange={onTabChange}
      slots={{ block: { content: <p>block</p> }, runs: { content: <p>runs</p>, count: 3 } }} extraTabs={[{ id: 'events', label: 'Events', content: <p>events</p> }]} />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('data-testid'))).toEqual([
      'insight-tab-block', 'insight-tab-debug', 'insight-tab-errors', 'insight-tab-runs', 'insight-tab-data', 'insight-tab-busiest', 'insight-tab-events',
    ]);
    expect(screen.getByText('runs')).toBeTruthy();
    expect(screen.getByTestId('insight-header')).toHaveTextContent('level');
    expect(screen.getByTestId('insight-runs-count')).toHaveTextContent('3');
    tab('events');
    expect(onTabChange).toHaveBeenCalledWith('events');
    rerender(<InsightPanel nodeNames={names} header={<p>level</p>} tab="block" slots={{ block: { content: <p>block</p> } }} />);
    expect(screen.getByText('block')).toBeTruthy();
    expect(screen.queryByTestId('insight-header')).toBeNull();
  });
});
