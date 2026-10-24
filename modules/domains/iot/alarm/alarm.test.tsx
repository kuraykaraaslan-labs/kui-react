import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlarmSeverityBadge } from './AlarmSeverityBadge';
import { AlarmStatusPill } from './AlarmStatusPill';
import { AlarmDetailHeader } from './AlarmDetailHeader';
import { AlarmEventTimeline } from './AlarmEventTimeline';
import { AlarmTable, sortAlarmRows, type AlarmTableRow } from './AlarmTable';
import { ALARM_SEVERITY_META, compareSeverity, isAlarmSeverity, worstSeverity } from './alarm-severity';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { ALARM_SEVERITIES } from '../types/alarm';
import * as barrel from '../index';

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);

describe('alarm-severity (OD-9)', () => {
  it('has exactly the five levels, most severe first, each with its own icon', () => {
    expect(ALARM_SEVERITIES).toEqual(['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO']);
    expect(Object.keys(ALARM_SEVERITY_META).sort()).toEqual([...ALARM_SEVERITIES].sort());
    expect(new Set(ALARM_SEVERITIES.map((s) => ALARM_SEVERITY_META[s].icon.iconName)).size).toBe(5);
    expect(['INFO', 'CRITICAL', 'MINOR'].sort((a, b) => compareSeverity(a as never, b as never))).toEqual(['CRITICAL', 'MINOR', 'INFO']);
    expect(worstSeverity(['WARNING', 'MAJOR', 'INFO'])).toBe('MAJOR');
    expect(worstSeverity([])).toBeNull();
    expect(isAlarmSeverity('MAJOR')).toBe(true);
    expect(isAlarmSeverity('HIGH')).toBe(false);
  });

  it('exports only Alarm* components plus the deprecated Alert* aliases of the same objects', () => {
    expect(barrel.AlertSeverityBadge).toBe(barrel.AlarmSeverityBadge);
    expect(barrel.AlertDetailHeader).toBe(barrel.AlarmDetailHeader);
    expect(barrel.AlertEventTimeline).toBe(barrel.AlarmEventTimeline);
  });
});

describe('AlarmSeverityBadge and AlarmStatusPill', () => {
  it('labels every level, translated by the provider or the prop', () => {
    render(
      <IotAdapterProvider adapter={{}} messages={{ severity: { MAJOR: 'Büyük' } }}>
        {ALARM_SEVERITIES.map((s) => <AlarmSeverityBadge key={s} severity={s} />)}
        <AlarmSeverityBadge severity="INFO" labels={{ INFO: 'Bilgi' }} />
        <AlarmSeverityBadge severity="CRITICAL" iconOnly />
      </IotAdapterProvider>,
    );
    for (const t of ['Critical', 'Büyük', 'Minor', 'Warning', 'Info', 'Bilgi']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-severity="CRITICAL"][title="Critical"]')).not.toBeNull();
  });

  it('renders the three statuses', () => {
    render(<><AlarmStatusPill status="OPEN" /><AlarmStatusPill status="ACKNOWLEDGED" /><AlarmStatusPill status="RESOLVED" labels={{ RESOLVED: 'Done' }} /></>);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});

describe('AlarmDetailHeader', () => {
  it('shows Acknowledge only while OPEN and Clear unless RESOLVED, and nothing without handlers', () => {
    const { rerender } = render(<AlarmDetailHeader title="Hot" severity="MAJOR" status="ACKNOWLEDGED" openedAt={ago(60_000)} now={NOW} onAcknowledge={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    rerender(<AlarmDetailHeader title="Hot" severity="MAJOR" status="RESOLVED" openedAt={ago(60_000)} now={NOW} onAcknowledge={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    rerender(<AlarmDetailHeader title="Hot" severity="MAJOR" status="OPEN" openedAt={ago(60_000)} now={NOW} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables every action while one runs and announces the result', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const onAcknowledge = vi.fn(() => new Promise<void>((r) => { release = r; }));
    render(<AlarmDetailHeader title="Hot" severity="CRITICAL" status="OPEN" openedAt={ago(60_000)} now={NOW} onAcknowledge={onAcknowledge} onClear={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onAcknowledge).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Working…');
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Alarm acknowledged'));
  });

  it('asks for a note first from the menu and passes it on; a failure is announced', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn().mockRejectedValue(new Error('refused'));
    render(<AlarmDetailHeader title="Hot" severity="CRITICAL" status="OPEN" openedAt={ago(60_000)} now={NOW} onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByText('Clear with a note…'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Probe replaced');
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledWith('Probe replaced');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('The action failed: refused'));
  });

  it('keeps the old onResolve name working', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<AlarmDetailHeader title="Hot" severity="INFO" status="OPEN" openedAt={ago(1)} onResolve={onResolve} />);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onResolve).toHaveBeenCalled();
  });
});

describe('AlarmEventTimeline', () => {
  it('names each kind, a severity change and an unknown kind, and posts a note', async () => {
    const user = userEvent.setup();
    const onAddNote = vi.fn().mockResolvedValue(undefined);
    render(
      <AlarmEventTimeline
        onAddNote={onAddNote}
        events={[
          { eventId: '1', kind: 'opened', by: 'flow', at: ago(10_000) },
          { eventId: '2', kind: 'severity_changed', from: 'MAJOR', to: 'CRITICAL', by: 'flow', at: ago(9_000) },
          { eventId: '3', kind: 'something_new', by: 'x', at: ago(8_000) },
          { eventId: '4', kind: 'note', by: 'Ayşe', at: ago(7_000), note: 'On my way' },
        ]}
      />,
    );
    expect(screen.getByText('Alarm opened')).toBeInTheDocument();
    expect(screen.getByText('Severity changed: Major → Critical')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('On my way')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeDisabled();
    await user.type(screen.getByLabelText('Add a note'), '  checked  ');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(onAddNote).toHaveBeenCalledWith('checked');
    await waitFor(() => expect(screen.getByLabelText('Add a note')).toHaveValue(''));
  });

  it('has no note box without onAddNote', () => {
    render(<AlarmEventTimeline events={[]} />);
    expect(screen.queryByLabelText('Add a note')).toBeNull();
    expect(screen.getByText('No events yet.')).toBeInTheDocument();
  });
});

describe('AlarmTable', () => {
  afterEach(() => vi.useRealTimers());
  const rows: AlarmTableRow[] = [
    { id: 'i', severity: 'INFO', status: 'OPEN', title: 'Info one', openedAt: ago(1_000) },
    { id: 'c', severity: 'CRITICAL', status: 'OPEN', title: 'Critical one', openedAt: ago(5_000) },
    { id: 'm', severity: 'MAJOR', status: 'ACKNOWLEDGED', title: 'Major one', openedAt: ago(2_000) },
  ];

  it('sorts most severe first, filters by the chips on the viewer side and caps the rows', async () => {
    const user = userEvent.setup();
    expect(sortAlarmRows(rows).map((r) => r.id)).toEqual(['c', 'm', 'i']);
    render(<AlarmTable rows={rows} now={NOW} maxRows={2} />);
    expect(screen.getByText('Critical one')).toBeInTheDocument();
    expect(screen.queryByText('Info one')).toBeNull();
    const chips = screen.getByRole('group', { name: 'Show severities' });
    expect(within(chips).getAllByRole('button')).toHaveLength(5);
    await user.click(within(chips).getByRole('button', { name: /Critical/ }));
    expect(screen.queryByText('Critical one')).toBeNull();
    expect(screen.getByText('Info one')).toBeInTheDocument();
  });

  it('runs a row action and turns a row click into the host callback', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn().mockResolvedValue(undefined);
    const onRowClick = vi.fn();
    render(<AlarmTable rows={rows} now={NOW} onRowClick={onRowClick} rowAction={{ label: 'Ack', onRun, disabled: (r) => r.status !== 'OPEN' }} />);
    const buttons = screen.getAllByRole('button', { name: 'Ack' });
    expect(buttons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(1);
    await user.click(buttons[0]);
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
    expect(onRowClick).not.toHaveBeenCalled();
    await user.click(screen.getByText('Major one'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  });

  it('fades a row out once it is resolved, then drops it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = render(<AlarmTable rows={rows} now={NOW} fadeOutMs={1_000} />);
    rerender(<AlarmTable rows={rows.map((r) => (r.id === 'c' ? { ...r, status: 'RESOLVED' } : r))} now={NOW} fadeOutMs={1_000} />);
    const row = screen.getByText('Critical one').closest('tr')!;
    expect(row).toHaveAttribute('data-state', 'leaving');
    await act(async () => { vi.advanceTimersByTime(1_200); });
    await waitFor(() => expect(screen.queryByText('Critical one')).toBeNull());
  });

  it('shows loading, error and empty states', () => {
    const { rerender } = render(<AlarmTable rows={[]} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    rerender(<AlarmTable rows={[]} error="No source" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No source');
    rerender(<AlarmTable rows={[]} emptyText="Quiet" />);
    expect(screen.getByText('Quiet')).toBeInTheDocument();
  });
});
