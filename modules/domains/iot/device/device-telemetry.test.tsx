import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import { ConfirmHost } from '@/modules/ui/ConfirmDialog';
import type { IotAdapter, IotTelemetryApi, TelemetryLatest, TelemetryPoint } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import { DeviceTelemetryView, fullValue, kindOf, showValue } from './DeviceTelemetryView';

vi.mock('@/modules/ui/Chart/charts/LineChart', () => ({
  LineChart: (p: { series: Array<{ name: string; data: unknown[] }>; xAxis?: string }) => (
    <div data-testid="chart" data-axis={p.xAxis}>{p.series.map((d) => `${d.name}:${d.data.length}`).join(' ')}</div>
  ),
}));

const NOW = new Date('2026-10-25T12:00:00Z').getTime();
const LATEST: TelemetryLatest[] = [
  { key: 'temperature', ts: NOW - 60_000, value: 21.5 },
  { key: 'humidity', ts: NOW - 60_000, value: 48 },
  { key: 'door_open', ts: NOW - 120_000, value: true },
  { key: 'mode', ts: NOW - 120_000, value: 'eco' },
  { key: 'location', ts: NOW - 120_000, value: { lat: 41, lng: 29 } },
];

function telemetryApi(latest = LATEST) {
  const series = vi.fn(async (_id: string, q: { keys: string[]; from: number; to: number }) =>
    Object.fromEntries(q.keys.map((k) => [k, [{ ts: q.from + 1, value: 1 }, { ts: q.from + 2, value: 2 }] as TelemetryPoint[]])));
  const api: IotTelemetryApi = { latest: vi.fn(async () => latest), series };
  return { api, series };
}

function fakeLive() {
  const subs: IotLiveSubscription[] = [];
  const live: IotLive = {
    state: 'live',
    subscribe: (s) => { subs.push(s as IotLiveSubscription); return () => undefined; },
    onState: () => () => undefined,
  };
  return { live, subs };
}

function mount(adapter: IotAdapter, live: IotLive | null = null) {
  return render(
    <IotAdapterProvider adapter={adapter} live={live} capabilities={{ canReadTelemetry: true }}>
      <DeviceTelemetryView deviceId="d1" now={NOW} locale="en" />
    </IotAdapterProvider>,
  );
}

describe('telemetry helpers', () => {
  it('tells numbers, flags, words and JSON apart and shows each the way a person reads it', () => {
    expect(LATEST.map((l) => kindOf(l.value))).toEqual(['number', 'number', 'flag', 'text', 'json']);
    const m = { on: 'On', off: 'Off' };
    expect(showValue(1234.5678, m, 'en')).toBe('1,234.568');
    expect(showValue(false, m)).toBe('Off');
    expect(showValue({ a: 'x'.repeat(200) }, m)).toMatch(/…$/);
  });
});

describe('DeviceTelemetryView', () => {
  it('lists every key with its latest value and age, and charts the first numeric key over the last 6 hours', async () => {
    const { api, series } = telemetryApi();
    mount({ telemetry: api });
    const table = await screen.findByRole('table', { name: 'Latest values' });
    expect(within(table).getByText('temperature')).toBeInTheDocument();
    expect(within(table).getByText('21.5')).toBeInTheDocument();
    expect(within(table).getByText('On')).toBeInTheDocument();
    expect(within(table).getByText('eco')).toBeInTheDocument();
    expect(within(table).getAllByText(/1 min|2 min/).length).toBeGreaterThan(0);
    await waitFor(() => expect(series).toHaveBeenCalled());
    const [, q] = series.mock.calls[0]!;
    expect(q.keys).toEqual(['humidity']);
    expect(q.to - q.from).toBe(6 * 3_600_000);
    const chart = await screen.findByTestId('chart');
    expect(chart).toHaveTextContent('humidity:2');
    expect(chart).toHaveAttribute('data-axis', 'time');
  });

  it('a key the host names shows its name and unit, not its code (e2e round 2: codes without names or units); a nameless key keeps its code', async () => {
    const named: TelemetryLatest[] = [
      { key: 'pool.value', ts: NOW - 60_000, value: 84.2, label: 'Pool level', unit: '%' },
      { key: 'temp', ts: NOW - 60_000, value: 33.9, label: 'Pool temperature', unit: '°C' },
      { key: 'meter_flow.running', ts: NOW - 60_000, value: false },
    ];
    const { api } = telemetryApi(named);
    mount({ telemetry: api });
    const table = await screen.findByRole('table', { name: 'Latest values' });
    expect(within(table).getByText('Pool level')).toBeInTheDocument();
    expect(within(table).getByText('Pool temperature')).toBeInTheDocument();
    expect(within(table).queryByText('pool.value')).toBeNull();
    expect(within(table).getByText('meter_flow.running')).toBeInTheDocument();
    expect(within(table).getByText('%')).toBeInTheDocument();
    expect(within(table).getByText('°C')).toBeInTheDocument();
    // the chart's line is named after the key's name too
    const chart = await screen.findByTestId('chart');
    expect(chart).toHaveTextContent('Pool level:2');
  });

  it('charts the numeric keys ticked in the table; a word or a flag cannot be ticked', async () => {
    const { api, series } = telemetryApi();
    mount({ telemetry: api });
    await screen.findByRole('table', { name: 'Latest values' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chart temperature' }));
    await waitFor(() => expect(series.mock.calls.some(([, q]) => q.keys.join() === 'humidity,temperature')).toBe(true));
    expect(screen.getByRole('checkbox', { name: 'Chart mode' })).toBeDisabled();
  });

  it('changes the window', async () => {
    const { api, series } = telemetryApi();
    mount({ telemetry: api });
    await screen.findByRole('table', { name: 'Latest values' });
    await userEvent.selectOptions(screen.getByLabelText('Window'), '7d');
    await waitFor(() => expect(series.mock.calls.some(([, q]) => q.to - q.from === 7 * 86_400_000)).toBe(true));
  });

  it('changes a value in place when the device sends it live, and adds a key it did not have', async () => {
    const { api } = telemetryApi();
    const { live, subs } = fakeLive();
    mount({ telemetry: api }, live);
    await screen.findByRole('table', { name: 'Latest values' });
    const sub = subs.find((s) => s.kind === 'telemetry')!;
    expect(sub.params).toEqual({ deviceId: 'd1' });
    act(() => sub.onLive({ deviceId: 'd1', key: 'temperature', ts: NOW, value: 23.25 }));
    act(() => sub.onLive({ deviceId: 'd1', key: 'co2', ts: NOW, value: 612 }));
    const table = screen.getByRole('table', { name: 'Latest values' });
    expect(await within(table).findByText('23.25')).toBeInTheDocument();
    expect(within(table).getByText('co2')).toBeInTheDocument();
    // an older point than the one shown changes nothing
    act(() => sub.onLive({ deviceId: 'd1', key: 'temperature', ts: NOW - 3_600_000, value: 1 }));
    expect(within(table).getByText('23.25')).toBeInTheDocument();
  });

  it('says so when the device has sent nothing yet, and when the read fails', async () => {
    const { api } = telemetryApi([]);
    const { unmount } = mount({ telemetry: api });
    expect(await screen.findByRole('heading', { name: 'This device has not sent any telemetry yet.' })).toBeInTheDocument();
    unmount();
    mount({ telemetry: { latest: vi.fn(async () => { throw new Error('boom'); }), series: vi.fn() } });
    expect(await screen.findByText('Could not load the telemetry.')).toBeInTheDocument();
  });

  it('draws nothing for a host without telemetry', () => {
    const { container } = mount({});
    expect(container).toBeEmptyDOMElement();
  });

  it('says so when the host cut the window (the newest points are missing), and only then (NB 41-ui-fixes/22 1.2)', async () => {
    const page = { series: { humidity: [{ ts: NOW - 3_000, value: 1 }] }, truncated: true };
    const series = vi.fn(async () => page);
    const { unmount } = mount({ telemetry: { latest: vi.fn(async () => LATEST), series } });
    expect(await screen.findByText(/the line ends where the read was cut/)).toBeInTheDocument();
    expect(await screen.findByTestId('chart')).toHaveTextContent('humidity:1');
    unmount();
    const { api } = telemetryApi();
    mount({ telemetry: api });
    await screen.findByTestId('chart');
    expect(screen.queryByText(/the line ends where the read was cut/)).toBeNull();
  });

  it('says when more keys are ticked than the trend draws (NB 41-ui-fixes/22 6.5)', async () => {
    const many: TelemetryLatest[] = ['a', 'b', 'c'].map((key) => ({ key, ts: NOW - 60_000, value: 1 }));
    const { api } = telemetryApi(many);
    render(
      <IotAdapterProvider adapter={{ telemetry: api }} live={null} capabilities={{ canReadTelemetry: true }}>
        <DeviceTelemetryView deviceId="d1" now={NOW} locale="en" maxCharted={2} />
      </IotAdapterProvider>,
    );
    await screen.findByRole('table', { name: 'Latest values' });
    expect(screen.queryByText('At most 2 keys at a time.')).toBeNull();
    // the first two are charted (one at first, then a second); a third tick is one too many
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chart b' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chart c' }));
    expect(await screen.findByText('At most 2 keys at a time.')).toBeInTheDocument();
  });
});

describe('DeviceTelemetryView beside live (NB 41-ui-fixes/23 1.18)', () => {
  it('reads every key again slowly while live (a value too large for the live channel), never over a newer live value', async () => {
    const { api } = telemetryApi();
    const { live, subs } = fakeLive();
    render(
      <IotAdapterProvider adapter={{ telemetry: api }} live={live} capabilities={{ canReadTelemetry: true }}>
        <DeviceTelemetryView deviceId="d1" now={NOW} locale="en" liveRereadMs={40} />
      </IotAdapterProvider>,
    );
    await screen.findByText('temperature');
    act(() => subs[0]!.onLive({ key: 'temperature', ts: NOW + 1_000, value: 30 }));
    (api.latest as ReturnType<typeof vi.fn>).mockResolvedValue([
      { key: 'temperature', ts: NOW - 60_000, value: 21.5 },
      { key: 'blob', ts: NOW, value: { big: 'x' } },
    ]);
    await waitFor(() => expect(screen.getByText('blob')).toBeInTheDocument());
    expect(screen.getByText('30')).toBeInTheDocument();
    expect((api.latest as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
  });
});

describe('DeviceTelemetryView and another device (NB 41-ui-fixes/23 C2)', () => {
  it('starts afresh for another device: a late read of the first never lands in it', async () => {
    let lateA!: (v: TelemetryLatest[]) => void;
    const latest = vi.fn((id: string) => (id === 'a' ? new Promise<TelemetryLatest[]>((r) => { lateA = r; }) : Promise.resolve([{ key: 'pressure', ts: NOW, value: 2 }])));
    const api: IotTelemetryApi = { latest, series: vi.fn(async () => ({})) };
    const ui = (deviceId: string) => (
      <IotAdapterProvider adapter={{ telemetry: api }} live={null} capabilities={{ canReadTelemetry: true }}>
        <DeviceTelemetryView deviceId={deviceId} now={NOW} locale="en" />
      </IotAdapterProvider>
    );
    const { rerender } = render(ui('a'));
    rerender(ui('b'));
    expect(await screen.findByText('pressure')).toBeInTheDocument();
    await act(async () => { lateA([{ key: 'temperature', ts: NOW, value: 1 }]); });
    expect(screen.queryByText('temperature')).toBeNull();
  });
});

describe('the View dialog: a value whole (JSON is cut in the table)', () => {
  const BIG = { events: [{ value: [{ measurements: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`${4097 + i}`, i * 1.5])) }] }] };

  it('fullValue indents JSON, keeps a number in full precision and a flag as On / Off', () => {
    const m = { on: 'On', off: 'Off' };
    expect(fullValue(BIG, m)).toBe(JSON.stringify(BIG, null, 2));
    expect(fullValue(1234.56789, m)).toBe('1234.56789');
    expect(fullValue(true, m)).toBe('On');
    expect(fullValue('eco', m)).toBe('eco');
  });

  it('every row has a View button; it opens the key\'s whole value, Copy copies it, Close shuts it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { api } = telemetryApi([...LATEST, { key: 'events', ts: NOW - 30_000, value: BIG }]);
    mount({ telemetry: api });
    await screen.findByText('temperature');
    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(LATEST.length + 1);
    // the table cuts it
    expect(screen.queryByText(JSON.stringify(BIG))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View events' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('telemetry-full-value').textContent).toBe(JSON.stringify(BIG, null, 2));
    expect(within(dialog).getByText('JSON')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(BIG, null, 2));
    expect(within(dialog).getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a number shows with its unit, in full', async () => {
    const user = userEvent.setup();
    const { api } = telemetryApi([{ key: 'pressure', ts: NOW - 1_000, value: 101325.125, unit: 'Pa', label: 'Pressure' }]);
    mount({ telemetry: api });
    await user.click(await screen.findByRole('button', { name: 'View Pressure' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('telemetry-full-value').textContent).toBe('101325.125 Pa');
    // a labelled key names its raw key too
    expect(within(dialog).getByText('pressure')).toBeInTheDocument();
  });
});

describe('deleting a key with its data', () => {
  function mountWith(o: { deleteKeys?: (id: string, keys: string[]) => Promise<{ deleted: string[] }>; canDelete: boolean }) {
    const { api } = telemetryApi();
    const notify = vi.fn();
    const telemetry = o.deleteKeys ? { ...api, deleteKeys: vi.fn(o.deleteKeys) } : api;
    render(
      <IotAdapterProvider adapter={{ telemetry }} capabilities={{ canReadTelemetry: true, canDeleteTelemetry: o.canDelete }} notify={notify}>
        <ConfirmHost />
        <DeviceTelemetryView deviceId="d1" now={NOW} locale="en" />
      </IotAdapterProvider>,
    );
    return { telemetry, notify };
  }

  it('no Delete without the capability, or without the adapter\'s deleteKeys', async () => {
    mountWith({ canDelete: false, deleteKeys: async () => ({ deleted: [] }) });
    await screen.findByText('temperature');
    expect(screen.queryByRole('button', { name: /^Delete (?!data$)/ })).not.toBeInTheDocument();
  });

  it('no Delete when the host has no deleteKeys, even with the capability', async () => {
    mountWith({ canDelete: true });
    await screen.findByText('temperature');
    expect(screen.queryByRole('button', { name: /^Delete (?!data$)/ })).not.toBeInTheDocument();
  });

  it('asks first; Cancel deletes nothing; Delete removes the key and its row and says so', async () => {
    const user = userEvent.setup();
    const { telemetry, notify } = mountWith({ canDelete: true, deleteKeys: async (_id, keys) => ({ deleted: keys }) });
    await screen.findByText('temperature');
    expect(screen.getAllByRole('button', { name: /^Delete (?!data$)/ })).toHaveLength(LATEST.length);
    await user.click(screen.getByRole('button', { name: 'Delete mode' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete "mode" and all its data?')).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(telemetry.deleteKeys).not.toHaveBeenCalled();
    expect(screen.getByText('mode')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete mode' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('mode')).not.toBeInTheDocument());
    expect(telemetry.deleteKeys).toHaveBeenCalledWith('d1', ['mode']);
    expect(notify).toHaveBeenCalledWith({ tone: 'success', message: '"mode" and its data were deleted.' });
    expect(screen.getByText('temperature')).toBeInTheDocument();
  });

  it('a failed delete keeps the dialog open with the error, and the row stays', async () => {
    const user = userEvent.setup();
    mountWith({ canDelete: true, deleteKeys: async () => { throw new Error('boom'); } });
    await screen.findByText('temperature');
    await user.click(screen.getByRole('button', { name: 'Delete mode' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('Could not delete the key.')).toBeInTheDocument();
    expect(screen.getAllByText('mode').length).toBeGreaterThan(0);
  });
});

describe('the data drawers: Export CSV and Delete data (NB iot-telemetry 03 §3.4)', () => {
  function mountDrawers(o: { exportSeries?: IotTelemetryApi['exportSeries']; deleteKeys?: IotTelemetryApi['deleteKeys']; canDelete?: boolean }) {
    const { api } = telemetryApi();
    const notify = vi.fn();
    const telemetry: IotTelemetryApi = {
      ...api,
      ...(o.exportSeries ? { exportSeries: vi.fn(o.exportSeries) } : {}),
      ...(o.deleteKeys ? { deleteKeys: vi.fn(o.deleteKeys) } : {}),
    };
    render(
      <IotAdapterProvider adapter={{ telemetry }} capabilities={{ canReadTelemetry: true, canDeleteTelemetry: !!o.canDelete }} notify={notify}>
        <ConfirmHost />
        <DeviceTelemetryView deviceId="d1" now={NOW} locale="en" />
      </IotAdapterProvider>,
    );
    return { telemetry, notify };
  }
  const file = { blob: new Blob(['time,ts,key,value\r\n']), fileName: 'f.csv', truncated: false };
  // the download: an object URL handed to a link (jsdom has no object URLs of its own)
  const saved: string[] = [];
  beforeEach(() => {
    saved.length = 0;
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { saved.push(this.download); });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('no header button without the adapter\'s function (and, for Delete data, the capability)', async () => {
    mountDrawers({ deleteKeys: async () => ({ deleted: [] }), canDelete: false });
    await screen.findByText('temperature');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete data' })).not.toBeInTheDocument();
  });

  it('Export CSV: the charted key is picked, the last 24 hours by default; Download sends the keys, window, resolution and aggregate', async () => {
    const user = userEvent.setup();
    const { telemetry, notify } = mountDrawers({ exportSeries: async () => file });
    await screen.findByText('temperature');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const drawer = await screen.findByRole('dialog', { name: 'Export telemetry as CSV' });
    expect(within(drawer).getByRole('checkbox', { name: 'humidity' })).toBeChecked();
    await user.click(within(drawer).getByRole('checkbox', { name: 'temperature' }));
    await user.selectOptions(within(drawer).getByLabelText('Resolution'), '1h');
    await user.selectOptions(within(drawer).getByLabelText('Aggregate'), 'max');
    await user.click(within(drawer).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(telemetry.exportSeries).toHaveBeenCalled());
    const [id, q] = (telemetry.exportSeries as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(id).toBe('d1');
    // the table's order (by name)
    expect(q.keys).toEqual(['humidity', 'temperature']);
    expect(q.resolution).toBe('1h');
    expect(q.aggregate).toBe('max');
    // the default window is the last 24 hours, to the minute
    expect(q.to - q.from).toBe(86_400_000);
    expect(Math.abs(q.to - NOW)).toBeLessThan(60_000);
    expect(notify).toHaveBeenCalledWith({ tone: 'success', message: 'The file was downloaded.' });
    expect(saved).toEqual(['f.csv']);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Export telemetry as CSV' })).not.toBeInTheDocument());
  });

  it('Export CSV: nothing picked or a reversed window is refused in the drawer; a cut file says so; a failure stays in the drawer', async () => {
    const user = userEvent.setup();
    let answer: () => Promise<typeof file> = async () => ({ ...file, truncated: true });
    const { telemetry, notify } = mountDrawers({ exportSeries: () => answer() });
    await screen.findByText('temperature');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const drawer = await screen.findByRole('dialog', { name: 'Export telemetry as CSV' });
    await user.click(within(drawer).getByRole('checkbox', { name: 'humidity' }));
    await user.click(within(drawer).getByRole('button', { name: 'Download' }));
    expect(await within(drawer).findByText('Pick at least one key.')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('checkbox', { name: 'humidity' }));
    const to = within(drawer).getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2000-01-01T00:00');
    await user.click(within(drawer).getByRole('button', { name: 'Download' }));
    expect(await within(drawer).findByText('The end must be after the start.')).toBeInTheDocument();
    expect(telemetry.exportSeries).not.toHaveBeenCalled();
    await user.clear(to);
    await user.type(to, '2030-01-01T00:00');
    answer = async () => { throw new Error('boom'); };
    await user.click(within(drawer).getByRole('button', { name: 'Download' }));
    expect(await within(drawer).findByText('Could not export the telemetry.')).toBeInTheDocument();
    answer = async () => ({ ...file, truncated: true });
    await user.click(within(drawer).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'info', message: expect.stringMatching(/first 10 000 values/) })));
  });

  it('Delete data: keys and UTC days, a confirmation naming them, then the range the host takes and a fresh read of the table', async () => {
    const user = userEvent.setup();
    const { telemetry, notify } = mountDrawers({ deleteKeys: async (_id, keys) => ({ deleted: keys }), canDelete: true });
    await screen.findByText('temperature');
    const reads = (telemetry.latest as ReturnType<typeof vi.fn>).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Delete data' }));
    const drawer = await screen.findByRole('dialog', { name: 'Delete telemetry data' });
    // today (UTC) by default
    expect(within(drawer).getByLabelText('First day (UTC)')).toHaveValue('2026-10-25');
    await user.click(within(drawer).getByRole('checkbox', { name: 'mode' }));
    await user.click(within(drawer).getByRole('checkbox', { name: 'temperature' }));
    const first = within(drawer).getByLabelText('First day (UTC)');
    await user.clear(first);
    await user.type(first, '2026-10-20');
    const last = within(drawer).getByLabelText('Last day (UTC)');
    await user.clear(last);
    await user.type(last, '2026-10-21');
    await user.click(within(drawer).getByRole('button', { name: 'Delete…' }));
    const confirm = await screen.findByRole('alertdialog').catch(() => screen.findAllByRole('dialog').then((d) => d[d.length - 1]!));
    expect(within(confirm).getByText('Delete the data of 2 keys from 2026-10-20 to 2026-10-21 (UTC)?')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(telemetry.deleteKeys).toHaveBeenCalledWith('d1', ['mode', 'temperature'], { from: Date.UTC(2026, 9, 20), to: Date.UTC(2026, 9, 22) }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ tone: 'success', message: 'The data of 2 keys from 2026-10-20 to 2026-10-21 was deleted.' }));
    await waitFor(() => expect((telemetry.latest as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(reads));
    // the keys stay in the table (only their values on those days went)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete telemetry data' })).not.toBeInTheDocument());
    expect(within(screen.getByRole('table', { name: 'Latest values' })).getByText('mode')).toBeInTheDocument();
  });

  it('Delete data: a last day before the first is refused before any confirmation', async () => {
    const user = userEvent.setup();
    const { telemetry } = mountDrawers({ deleteKeys: async () => ({ deleted: [] }), canDelete: true });
    await screen.findByText('temperature');
    await user.click(screen.getByRole('button', { name: 'Delete data' }));
    const drawer = await screen.findByRole('dialog', { name: 'Delete telemetry data' });
    await user.click(within(drawer).getByRole('checkbox', { name: 'mode' }));
    const last = within(drawer).getByLabelText('Last day (UTC)');
    await user.clear(last);
    await user.type(last, '2026-10-01');
    await user.click(within(drawer).getByRole('button', { name: 'Delete…' }));
    expect(await within(drawer).findByText('The last day cannot be before the first day.')).toBeInTheDocument();
    expect(telemetry.deleteKeys).not.toHaveBeenCalled();
  });
});

describe('the data drawers\' date helpers', () => {
  it('whole UTC days, the last one included', async () => {
    const { dayRangeOf, fromUtcDay, toUtcDay } = await import('./TelemetryDataDrawers');
    expect(fromUtcDay('2026-10-20')).toBe(Date.UTC(2026, 9, 20));
    expect(toUtcDay(Date.UTC(2026, 9, 20, 23, 59))).toBe('2026-10-20');
    expect(dayRangeOf('2026-10-20', '2026-10-20')).toEqual({ from: Date.UTC(2026, 9, 20), to: Date.UTC(2026, 9, 21) });
    expect(dayRangeOf('2026-10-21', '2026-10-20')).toBeNull();
    expect(dayRangeOf('', '2026-10-20')).toBeNull();
  });
});
