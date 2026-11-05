import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IotAdapterProvider } from '../api/IotAdapterProvider';
import type { IotAdapter, IotTelemetryApi, TelemetryLatest, TelemetryPoint } from '../api/adapter';
import type { IotLive, IotLiveSubscription } from '../api/live';
import { DeviceTelemetryView, kindOf, showValue } from './DeviceTelemetryView';

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
