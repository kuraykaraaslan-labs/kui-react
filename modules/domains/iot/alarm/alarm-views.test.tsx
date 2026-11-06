import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { IotApiError, type AlarmListQuery, type IotAdapter, type IotCapabilities } from '../api/adapter';
import type { IotLive, IotLiveState, IotLiveSubscription } from '../api/live';
import type { Alarm } from '../types/alarm';
import { AlarmListView } from './AlarmListView';
import { AlarmDetailView, mergeLiveAlarm } from './AlarmDetailView';
import { AlarmBellMenu, useAlarmBellSource, worstOpen } from './AlarmBellMenu';
import { ACKNOWLEDGE_ALL_MAX_ROUNDS, acknowledgeAllOpen } from './acknowledgeAll';
import { acknowledgeAllNotice, unchangedText } from './alarm-results';
import { IOT_MESSAGES, type IotMessages } from '../messages';
import { NEUTRAL_COUNT_CLASS, countClassOf } from './alarm-severity';

/* NB 41-ui-fixes/24: the alarm screens tell what is current and true. */

const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);
const ALL: Partial<IotCapabilities> = { canReadAlarms: true, canAcknowledge: true, canClear: true, canComment: true };
const m = IOT_MESSAGES as unknown as IotMessages;

const alarm = (id: string, patch: Partial<Alarm> = {}): Alarm => ({
  alarmId: id, type: 't', severity: 'MAJOR', status: 'OPEN', title: `Alarm ${id}`, deviceId: 'd1', deviceName: 'Pump 4', openedAt: ago(60_000),
  occurrences: 1, flapping: false, ...patch,
});

function createFakeLive(initial: IotLiveState = 'live') {
  const subs = new Set<IotLiveSubscription>();
  let state = initial;
  const live: IotLive & { publish(kind: string, payload: unknown): void; snapshot(kind: string): void } = {
    get state() { return state; },
    subscribe(sub) { subs.add(sub as IotLiveSubscription); return () => { subs.delete(sub as IotLiveSubscription); }; },
    onState() { return () => undefined; },
    publish(kind, payload) { for (const s of [...subs]) if (s.kind === kind) s.onLive(payload); },
    snapshot(kind) { for (const s of [...subs]) if (s.kind === kind) s.onSnapshot?.({}); },
  };
  void state;
  state = initial;
  return live;
}

const counts = { open: 1, acknowledged: 1, bySeverity: { CRITICAL: 0, MAJOR: 2, MINOR: 0, WARNING: 0, INFO: 0 } };

function adapterWith(alarms: Partial<NonNullable<IotAdapter['alarms']>> = {}): IotAdapter {
  return {
    alarms: {
      list: vi.fn().mockImplementation(async (q: AlarmListQuery) => (q.status === 'OPEN'
        ? { items: [alarm('a1')], total: 1 }
        : { items: [alarm('a1'), alarm('a2', { status: 'ACKNOWLEDGED' })], total: 2 })),
      get: vi.fn().mockResolvedValue(alarm('a1', { origin: { kind: 'profileRule', profileId: 'p1', ruleId: 'r1', ruleName: 'Too hot' }, runbook: 'Cool it down.' })),
      events: vi.fn().mockResolvedValue([]),
      acknowledge: vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true }))),
      clear: vi.fn().mockImplementation(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true }))),
      comment: vi.fn().mockResolvedValue(undefined),
      counts: vi.fn().mockResolvedValue(counts),
      parseLive: (p: unknown) => p as never,
      ...alarms,
    },
  };
}

function wrap(ui: React.ReactNode, o: { adapter?: IotAdapter; live?: IotLive | null; caps?: Partial<IotCapabilities>; notify?: (n: unknown) => void } = {}) {
  return render(
    <IotAdapterProvider adapter={o.adapter ?? adapterWith()} live={o.live ?? null} capabilities={o.caps ?? ALL} notify={o.notify} locale="en" timeZone="UTC">
      {ui}
    </IotAdapterProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe('acknowledgeAllOpen (1.2)', () => {
  it('acts on the scope and filters, leaves alarms opened after it started and never throws', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ items: [alarm('old1', { openedAt: ago(5_000) }), alarm('old2', { openedAt: ago(9_000) })], total: 2 });
    const acknowledge = vi.fn(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: alarmId !== 'old2' })));
    const r = await acknowledgeAllOpen({ list, acknowledge }, { deviceId: 'd1', severity: ['CRITICAL'], search: 'pump' }, 'night');
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 100, status: 'OPEN', deviceId: 'd1', severity: ['CRITICAL'], search: 'pump' });
    expect(acknowledge).toHaveBeenCalledWith(['old1', 'old2'], 'night');
    expect(r).toEqual({ done: 1, skipped: 1 });

    // a full page whose newer alarms (opened while it ran) stay on top: they are left OPEN and the next page is read
    const page1 = Array.from({ length: 100 }, (_, i) => alarm(`n${i}`, { openedAt: ago(1_000 - i) }));
    const list2 = vi.fn()
      .mockResolvedValueOnce({ items: page1, total: 100 })
      .mockResolvedValueOnce({ items: [alarm('late', { openedAt: ago(0) }), alarm('x', { openedAt: ago(2_000) })], total: 102 });
    const ack2 = vi.fn(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true })));
    const r2 = await acknowledgeAllOpen({ list: list2, acknowledge: ack2 }, {});
    expect(ack2.mock.calls[1][0]).toEqual(['x']);
    expect(r2.done).toBe(101);

    const failing = vi.fn().mockRejectedValue(new IotApiError('unavailable', ''));
    expect(await acknowledgeAllOpen({ list: failing, acknowledge }, {})).toEqual({ done: 0, skipped: 0, error: expect.any(IotApiError) });
  });

  it('reads from page 1 again after a round that acknowledged something, so rows that moved up are not skipped', async () => {
    // page 1 holds only alarms opened after the press, the older ones are on page 2; once those are acknowledged (and the newer ones by
    // someone else meanwhile) an older alarm has moved up to page 1: reading page 2 on would never see it
    const fresh = Array.from({ length: 100 }, (_, i) => alarm(`f${i}`, { openedAt: ago(i) }));
    const old = Array.from({ length: 100 }, (_, i) => alarm(`o${i}`, { openedAt: ago(80_000 + i) }));
    const pages: Record<number, Alarm[][]> = { 1: [fresh, [alarm('moved', { openedAt: ago(90_000) })]], 2: [old, []] };
    const list = vi.fn(async (q: AlarmListQuery) => ({ items: pages[q.page].shift() ?? [], total: 0 }));
    const acknowledge = vi.fn(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true })));
    const r = await acknowledgeAllOpen({ list, acknowledge }, {}, undefined, NOW - 60_000);
    expect(list.mock.calls.map(([q]) => q.page)).toEqual([1, 2, 1]);
    expect(acknowledge.mock.calls.map(([ids]) => ids)).toEqual([old.map((a) => a.alarmId), ['moved']]);
    expect(r).toEqual({ done: 101, skipped: 0 });
  });

  it('stops at its round limit with "more", the count done kept and worded', async () => {
    let n = 0;
    const list = vi.fn(async () => ({ items: Array.from({ length: 100 }, () => alarm(`a${++n}`, { openedAt: ago(10_000) })), total: 99_999 }));
    const acknowledge = vi.fn(async (ids: string[]) => ids.map((alarmId) => ({ alarmId, ok: true })));
    const r = await acknowledgeAllOpen({ list, acknowledge }, {});
    expect(list).toHaveBeenCalledTimes(ACKNOWLEDGE_ALL_MAX_ROUNDS);
    expect(r).toEqual({ done: 100 * ACKNOWLEDGE_ALL_MAX_ROUNDS, skipped: 0, more: true });
    expect(acknowledgeAllNotice(m, r, 'en')).toEqual({ tone: 'info', message: '5,000 alarms acknowledged. Some may still be open: press Acknowledge all again to go on.' });
  });

  it('words a failure part way with the count done, changed alarms as skipped, and the plural', () => {
    expect(acknowledgeAllNotice(m, { done: 3, skipped: 0, error: new Error('') })).toEqual({ tone: 'error', message: 'Acknowledge all stopped part way: 3 acknowledged. The alarms could not be acknowledged.' });
    expect(acknowledgeAllNotice(m, { done: 2, skipped: 1 })).toEqual({ tone: 'info', message: '2 done, 1 skipped' });
    expect(acknowledgeAllNotice(m, { done: 1, skipped: 0 }, 'en').message).toBe('1 alarm acknowledged');
  });
});

describe('results from the host (1.7)', () => {
  it('says why nothing changed from the reason, else the status read again', () => {
    expect(unchangedText(m, 'already_acknowledged')).toBe('Nothing changed: the alarm was already acknowledged.');
    expect(unchangedText(m, 'not_active')).toBe('Nothing changed: the alarm was already cleared.');
    expect(unchangedText(m, 'other', 'RESOLVED')).toBe('Nothing changed: the alarm was already Resolved.');
    expect(unchangedText(m)).toBe('Nothing changed: the alarm had changed meanwhile.');
  });
});

describe('AlarmListView (1.2, 1.9, 1.10, 1.12, 1.17)', () => {
  it('shows only the newest answer: a late read of an older filter never overwrites the rows', async () => {
    const user = userEvent.setup();
    let release!: (v: unknown) => void;
    const list = vi.fn().mockImplementation(async (q: AlarmListQuery) => {
      if (q.pageSize === 1) return { items: [], total: 0 };
      if (q.status === 'OPEN') return { items: [alarm('fresh', { title: 'Newest answer' })], total: 1 };
      if (list.mock.calls.filter(([x]) => (x as AlarmListQuery).pageSize !== 1).length === 1) return new Promise((r) => { release = r; });
      return { items: [alarm('a1')], total: 1 };
    });
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} now={NOW} />, { adapter: adapterWith({ list }) });
    await user.click(await screen.findByRole('button', { name: 'Open (1)' }));
    expect(await screen.findByText('Newest answer')).toBeInTheDocument();
    await act(async () => { release({ items: [alarm('stale', { title: 'Late answer' })], total: 1 }); });
    expect(screen.queryByText('Late answer')).toBeNull();
    expect(screen.getByText('Newest answer')).toBeInTheDocument();
  });

  it('while live, a row that leaves the filter drops out with its count and from the selection', async () => {
    const user = userEvent.setup();
    const live = createFakeLive();
    const adapter = adapterWith({
      list: vi.fn().mockImplementation(async (q: AlarmListQuery) => (q.pageSize === 1 ? { items: [], total: 2 } : { items: [alarm('a1'), alarm('a3')], total: 2 })),
    });
    wrap(<AlarmListView hrefs={{ alarm: (id) => id }} initialQuery={{ status: 'OPEN' }} now={NOW} />, { adapter, live });
    await user.click(await screen.findByRole('checkbox', { name: 'Select Alarm a1' }));
    expect(screen.getByRole('button', { name: 'Acknowledge (1)' })).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a1', { status: 'ACKNOWLEDGED' }), transition: 'acknowledged' }));
    await waitFor(() => expect(screen.queryByText('Alarm a1')).toBeNull());
    expect(screen.getByText('Alarm a3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge (1)' })).toBeNull();
  });

  it('acknowledge all: the count is the host\'s for the filters, offered on OPEN or not resolved only, and the confirmation names the scope', async () => {
    const user = userEvent.setup();
    const list = vi.fn().mockImplementation(async (q: AlarmListQuery) => (q.status === 'OPEN'
      ? { items: [alarm('a1', { severity: 'CRITICAL' })], total: q.severity?.length ? 7 : 12 }
      : { items: [alarm('a1')], total: 1 }));
    const adapter = adapterWith({ list });
    const { rerender } = wrap(<AlarmListView hrefs={{ alarm: (id) => id }} initialQuery={{ severity: ['CRITICAL'] }} now={NOW} />, { adapter });
    await user.click(await screen.findByRole('button', { name: 'Acknowledge all (7)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Acknowledge 7 open alarms?' });
    expect(within(dialog).getByText(/matches these filters is acknowledged.*send no more reminders/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Acknowledge all (7)' }));
    await waitFor(() => expect(adapter.alarms!.acknowledge).toHaveBeenCalled());
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'OPEN', pageSize: 100, severity: ['CRITICAL'] }));
    rerender(
      <IotAdapterProvider adapter={adapter} capabilities={ALL} locale="en">
        <AlarmListView hrefs={{ alarm: (id) => id }} initialQuery={{ status: 'ACKNOWLEDGED' }} now={NOW} />
      </IotAdapterProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: /Acknowledge all/ })).toBeNull());
  });

  it('a page past the end moves to the last page; the host\'s query is followed by value', async () => {
    const list = vi.fn().mockImplementation(async (q: AlarmListQuery) => (q.pageSize === 1 ? { items: [], total: 0 }
      : q.page > 3 ? { items: [], total: 45 } : { items: [alarm(`p${q.page}`)], total: 45 }));
    const onQueryChange = vi.fn();
    const adapter = adapterWith({ list });
    const { rerender } = wrap(<AlarmListView hrefs={{ alarm: (id) => id }} initialQuery={{ page: 9 }} onQueryChange={onQueryChange} now={NOW} />, { adapter });
    expect(await screen.findByText('Alarm p3')).toBeInTheDocument();
    expect(onQueryChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    rerender(
      <IotAdapterProvider adapter={adapter} capabilities={ALL} locale="en">
        <AlarmListView hrefs={{ alarm: (id) => id }} initialQuery={{ page: 2 }} onQueryChange={onQueryChange} now={NOW} />
      </IotAdapterProvider>,
    );
    expect(await screen.findByText('Alarm p2')).toBeInTheDocument();
  });

  it('capabilities that could not be read say so with a retry; a link opens through the host', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const adapter = { ...adapterWith(), capabilities: vi.fn().mockRejectedValue(new Error('down')) };
    render(<IotAdapterProvider adapter={adapter} locale="en"><AlarmListView hrefs={{ alarm: (id) => `/a/${id}` }} onOpen={onOpen} now={NOW} /></IotAdapterProvider>);
    expect(await screen.findByText(/could not be read, so nothing can be changed yet/)).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Alarm a1' }));
    expect(onOpen).toHaveBeenCalledWith('/a/a1');
  });
});

describe('AlarmDetailView (1.7, 1.8, 1.14)', () => {
  it('a live event keeps the runbook and the rule name; an older event is ignored; a reconnect reads again', async () => {
    const user = userEvent.setup();
    const live = createFakeLive();
    const adapter = adapterWith();
    wrap(<AlarmDetailView alarmId="a1" />, { adapter, live });
    expect(await screen.findByText(/Too hot/)).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a1', { occurrences: 3, status: 'ACKNOWLEDGED' }), transition: 'updated' }));
    expect(await screen.findByText('Fired 3 times')).toBeInTheDocument();
    expect(screen.getByText(/Too hot/)).toBeInTheDocument();
    act(() => live.publish('alarms', { alarm: alarm('a1', { occurrences: 1 }), transition: 'created' }));
    expect(screen.getByText('Fired 3 times')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Runbook' }));
    expect(await screen.findByText('Cool it down.')).toBeInTheDocument();
    const reads = (adapter.alarms!.get as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => { live.snapshot('alarms'); live.snapshot('alarms'); });
    await waitFor(() => expect((adapter.alarms!.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(reads + 1));
    expect(mergeLiveAlarm(alarm('a1', { runbook: 'x', message: 'm' }), alarm('a1', { runbook: undefined })).runbook).toBe('x');
  });

  it('a failed re-read keeps the alarm and says how old it is; a refused action says why from the host', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const get = vi.fn().mockResolvedValueOnce(alarm('a1')).mockRejectedValue(new IotApiError('unavailable', ''));
    const adapter = adapterWith({ get, acknowledge: vi.fn().mockResolvedValue([{ alarmId: 'a1', ok: false, reason: 'already_acknowledged' }]) });
    wrap(<AlarmDetailView alarmId="a1" />, { adapter, notify });
    await user.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'info', message: 'Nothing changed: the alarm was already acknowledged.' }));
    expect(await screen.findByText(/This may be out of date: reading it again failed/)).toBeInTheDocument();
    expect(screen.getByText('Alarm a1')).toBeInTheDocument();
  });

  it('a note the host took empties the box even when the timeline cannot be read again', async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    const events = vi.fn().mockResolvedValueOnce([]).mockRejectedValue(new IotApiError('unavailable', ''));
    wrap(<AlarmDetailView alarmId="a1" />, { adapter: adapterWith({ events }), notify });
    await user.type(await screen.findByLabelText('Add a note'), 'checked');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(screen.getByLabelText('Add a note')).toHaveValue(''));
    expect(notify).toHaveBeenCalledWith({ tone: 'info', message: 'The note was added, but the timeline could not be read again: it may not show it yet.' });
  });
});

describe('AlarmBellMenu (1.11, 1.15, N6)', () => {
  it('a failed first read says so with a retry, not "No open alarms"', async () => {
    const user = userEvent.setup();
    const counts = vi.fn().mockRejectedValueOnce(new IotApiError('unavailable', '')).mockResolvedValue({ open: 1, acknowledged: 0, bySeverity: { CRITICAL: 0, MAJOR: 1, MINOR: 0, WARNING: 0, INFO: 0 } });
    wrap(<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => id }} now={NOW} />, { adapter: adapterWith({ counts }) });
    await user.click(await screen.findByRole('button', { name: /^Alarms: Open \(0\)/ }));
    expect(await screen.findByText('The alarms could not be read.')).toBeInTheDocument();
    expect(screen.queryByText('No open alarms')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('link', { name: 'Alarm a1' })).toBeInTheDocument();
  });

  it('takes the badge\'s colour from the OPEN alarms and names the worst; minor and warning read in both themes', async () => {
    expect(worstOpen({ open: 1, acknowledged: 3, bySeverity: { CRITICAL: 3, MAJOR: 0, MINOR: 1, WARNING: 0, INFO: 0 }, openBySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 1, WARNING: 0, INFO: 0 } }, [])).toBe('MINOR');
    expect(worstOpen({ open: 1, acknowledged: 1, bySeverity: { CRITICAL: 1, MAJOR: 0, MINOR: 0, WARNING: 1, INFO: 0 } }, [alarm('x', { severity: 'CRITICAL', status: 'ACKNOWLEDGED' }), alarm('y', { severity: 'WARNING' })])).toBe('WARNING');
    expect(worstOpen({ open: 0, acknowledged: 1, bySeverity: { CRITICAL: 1, MAJOR: 0, MINOR: 0, WARNING: 0, INFO: 0 } }, [])).toBeNull();
    const adapter = adapterWith({
      counts: vi.fn().mockResolvedValue({ open: 1, acknowledged: 1, bySeverity: { CRITICAL: 1, MAJOR: 0, MINOR: 0, WARNING: 1, INFO: 0 }, openBySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, WARNING: 1, INFO: 0 } }),
    });
    wrap(<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => id }} now={NOW} />, { adapter });
    const bell = await screen.findByRole('button', { name: 'Alarms: Open (1), most severe open: Warning' });
    const badge = bell.querySelector('[aria-hidden="true"].absolute')!;
    expect(badge.className).toContain('text-warning-fg');
    expect(badge.className).not.toContain('text-text-inverse');
  });

  it('a count whose severity is not known gets a neutral badge, never CRITICAL\'s colour', async () => {
    expect(countClassOf(null)).toBe(NEUTRAL_COUNT_CLASS);
    expect(countClassOf('CRITICAL')).toContain('bg-error');
    // open alarms counted, no openBySeverity, and none of the listed ones OPEN
    const adapter = adapterWith({
      counts: vi.fn().mockResolvedValue({ open: 2, acknowledged: 1, bySeverity: { CRITICAL: 1, MAJOR: 0, MINOR: 0, WARNING: 0, INFO: 0 } }),
      list: vi.fn().mockResolvedValue({ items: [alarm('x', { severity: 'CRITICAL', status: 'ACKNOWLEDGED' })], total: 1 }),
    });
    wrap(<AlarmBellMenu hrefs={{ alarms: '/alarms', alarm: (id) => id }} now={NOW} />, { adapter });
    const bell = await screen.findByRole('button', { name: 'Alarms: Open (2)' });
    const badge = bell.querySelector('[aria-hidden="true"].absolute')!;
    expect(badge.className).toContain('bg-surface-sunken');
    expect(badge.className).not.toContain('bg-error');
  });
});

/** The source's words, as a host's notification menu would show them. */
function SourceProbe() {
  const source = useAlarmBellSource({ hrefs: { alarms: '/alarms', alarm: (id) => id } });
  if (!source) return <p>no source</p>;
  return (
    <div>
      <p data-testid="summary">{source.summary}</p>
      <p data-testid="empty">{source.emptyLabel}</p>
      <p data-testid="flags">{`${source.loading ? 'loading' : ''}${source.failed ? 'failed' : ''}`}</p>
      {source.action && <button type="button" onClick={source.action.onClick}>{source.action.label}</button>}
    </div>
  );
}

describe('useAlarmBellSource (1.11, 1.12)', () => {
  it('says loading until the first answer, then the counts and "No open alarms" only once it knows', async () => {
    let answer!: (c: typeof counts) => void;
    const first = new Promise<typeof counts>((r) => { answer = r; });
    const countsFn = vi.fn().mockReturnValueOnce(first).mockRejectedValueOnce(new IotApiError('unavailable', '')).mockResolvedValue(counts);
    wrap(<SourceProbe />, { adapter: adapterWith({ counts: countsFn }) });
    expect(await screen.findByTestId('summary')).toHaveTextContent('Loading…');
    expect(screen.getByTestId('empty')).toHaveTextContent('Loading…');
    expect(screen.getByTestId('flags')).toHaveTextContent('loading');
    await act(async () => { answer(counts); });
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent('Open (1) · Acknowledged (1)'));
    expect(screen.getByTestId('empty')).toHaveTextContent('No open alarms');
  });

  it('a failed first read says so with Retry as the action; the retry reads again', async () => {
    const user = userEvent.setup();
    const countsFn = vi.fn().mockRejectedValueOnce(new IotApiError('unavailable', '')).mockResolvedValue(counts);
    wrap(<SourceProbe />, { adapter: adapterWith({ counts: countsFn }) });
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent('The alarms could not be read.'));
    expect(screen.getByTestId('empty')).toHaveTextContent('The alarms could not be read.');
    expect(screen.getByTestId('flags')).toHaveTextContent('failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent('Open (1) · Acknowledged (1)'));
  });

  it('capabilities that could not be read keep the source, saying so with Retry', async () => {
    const user = userEvent.setup();
    const capabilities = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ canReadAlarms: true });
    render(<IotAdapterProvider adapter={{ ...adapterWith(), capabilities }} live={null} locale="en"><SourceProbe /></IotAdapterProvider>);
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent(/could not be read, so nothing can be changed yet/));
    expect(screen.queryByText('no source')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent('Open (1) · Acknowledged (1)'));
  });
});
