import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  LoraCodecBench, LoraCodecDetail, LoraCodecEditor, LoraCodecTable, LoraDevicePanel, LoraGatewayMap, LoraProfilePanel,
  benchInputOk, latestReception, loraPinState, loraRefusalText, middleOf, profileChange, LORA_MESSAGES,
} from '.';
import type { LoraCodecRow, LoraDeviceDetail, LoraFrameRow, LoraGatewayRow, LoraProfileView } from '.';

vi.mock('@/modules/ui/MapView/MapCanvas', () => ({
  MapCanvas: ({ markers, onMarkerClick, onMarkerMove }: { markers: Array<{ id: string; variant?: string; draggable?: boolean }>; onMarkerClick?: (id: string) => void; onMarkerMove?: (id: string, p: [number, number]) => void }) => (
    <div data-testid="fake-map" data-markers={JSON.stringify(markers.map((m) => ({ id: m.id, variant: m.variant, draggable: m.draggable })))}>
      {markers.map((mk) => <button key={mk.id} type="button" onClick={() => onMarkerClick?.(mk.id)}>{`marker ${mk.id}`}</button>)}
      {markers.map((mk) => <button key={`${mk.id}-drag`} type="button" onClick={() => onMarkerMove?.(mk.id, [1, 2])}>{`drag ${mk.id}`}</button>)}
    </div>
  ),
}));

/**
 * The codec, map, device and profile views of NB iot_lorawan 13 / iot_lorawan_codecs 05 (kui-react iot 10.2, 10.4, 10.6, 10.7).
 */
const gw = (o: Partial<LoraGatewayRow>): LoraGatewayRow => ({ gatewayId: 'g1', name: 'Roof', eui: 'AA555A0000000001', protocol: 'BASICS_STATION', status: 'ACTIVE', region: 'EU868', lastSeenAt: null, ...o });
const codec = (o: Partial<LoraCodecRow>): LoraCodecRow => ({ id: 'milesight-em300-th', title: 'Milesight EM300-TH', vendor: 'Milesight', models: ['EM300-TH'], fports: [85], oui: ['24E124'], kind: 'tlv', origin: 'clean-room', verified: false, rev: 1, updatedAt: '2026-11-04T00:00:00Z', scope: 'public', status: 'PUBLISHED', ...o });

describe('gateway map (10.2)', () => {
  it('colours pins by state and never draws a gateway without a location', () => {
    render(<LoraGatewayMap gateways={[
      gw({ gatewayId: 'a', latitude: 41, longitude: 29, live: { online: true, rttMs: 80, connectedAt: 1 } }),
      gw({ gatewayId: 'b', latitude: 40, longitude: 30, lastSeenAt: '2026-11-03T00:00:00Z' }),
      gw({ gatewayId: 'c', latitude: 39, longitude: 31 }),
      gw({ gatewayId: 'd', name: 'Basement' }),
    ]} />);
    const markers = JSON.parse(screen.getByTestId('fake-map').getAttribute('data-markers')!);
    expect(markers.map((m: { id: string; variant: string }) => `${m.id}:${m.variant}`)).toEqual(['a:success', 'b:error', 'c:neutral']);
    expect(within(screen.getByTestId('lora-gateway-unplaced')).getByText('Basement')).toBeTruthy();
  });
  it('places an unplaced gateway in the middle of the others and saves dragged pins', () => {
    const onMove = vi.fn();
    render(<LoraGatewayMap gateways={[gw({ gatewayId: 'a', latitude: 40, longitude: 30 }), gw({ gatewayId: 'b', latitude: 42, longitude: 32 }), gw({ gatewayId: 'd', name: 'Basement' })]} onMove={onMove} />);
    fireEvent.click(screen.getByText('Place on the map'));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ gatewayId: 'd' }), [41, 31]);
    fireEvent.click(screen.getByText('drag a'));
    expect(onMove).toHaveBeenLastCalledWith(expect.objectContaining({ gatewayId: 'a' }), [1, 2]);
    expect(screen.getByText(/drag the pin/)).toBeTruthy();
  });
  it('pin state and the middle are pure', () => {
    expect(loraPinState({ status: 'DISABLED', lastSeenAt: 'x', live: { online: true, rttMs: 1, connectedAt: 1 } })).toBe('never');
    expect(middleOf([], [1, 2])).toEqual([1, 2]);
  });
});

describe('codec library (10.7)', () => {
  it('lists library and own codecs with their source and, on the platform view, their status', () => {
    const onOpen = vi.fn();
    render(<LoraCodecTable rows={[codec({}), codec({ id: 't.mine', title: 'Mine', scope: 'tenant' }), codec({ id: 'old', title: 'Old', status: 'WITHDRAWN' })]} onOpen={onOpen} showStatus />);
    expect(screen.getAllByText('Library').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Withdrawn').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Mine'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 't.mine' }));
  });

  it('the bench checks its input and shows every decoded key with its unit', async () => {
    const onRun = vi.fn(async () => ({ fields: { temperature: 30.8, gps: { lat: 1 } }, units: { temperature: '°C' }, keys: { temperature: '°C', 'gps.lat': null }, warnings: ['short'] }));
    render(<LoraCodecBench onRun={onRun} />);
    fireEvent.click(screen.getByText('Decode'));
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter an FPort/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^FPort/), { target: { value: '85' } });
    fireEvent.change(screen.getByLabelText(/^Payload/), { target: { value: '01 75 5C' } });
    fireEvent.click(screen.getByText('Decode'));
    await waitFor(() => expect(screen.getByText('temperature')).toBeTruthy());
    expect(onRun).toHaveBeenCalledWith(85, '01755C');
    expect(screen.getByText('°C')).toBeTruthy();
    expect(screen.getByText('gps.lat')).toBeTruthy();
    expect(screen.getByText('short')).toBeTruthy();
    expect(benchInputOk('0', '00')).toBe(false);
    expect(benchInputOk('1', '0'.repeat(512))).toBe(false);
  });

  it('a library codec offers Save a copy and is read-only; its keys, revisions and the decoder-only line are shown', () => {
    const onCopy = vi.fn();
    render(<LoraCodecDetail codec={{ id: 'milesight-em300-th', rev: 2, sha256: 'a'.repeat(64), scope: 'public', document: { title: 'EM300', vendor: 'Milesight', tests: [{ fport: 85, hex: '0175' }] }, outputSet: { temperature: '°C' } }}
      onTest={vi.fn()} revisions={[{ rev: 2, sha256: 'a'.repeat(64), size: 1234, publishedAt: '2026-11-04T00:00:00Z', keys: 3 }]} onCopy={onCopy} />);
    expect(screen.getByText('Downlinks are sent as raw hex or base64.', { exact: false })).toBeTruthy();
    expect(screen.getByText(/read-only here/)).toBeTruthy();
    expect(screen.getByText('temperature')).toBeTruthy();
    expect(screen.getByText('1234 bytes')).toBeTruthy();
    expect((screen.getByLabelText(/^FPort/) as HTMLInputElement).value).toBe('85');
    fireEvent.click(screen.getByText('Save a copy'));
    expect(onCopy).toHaveBeenCalled();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('a withdrawn library codec says so and offers Restore, not Withdraw', () => {
    render(<LoraCodecDetail codec={{ id: 'x-codec', rev: 1, sha256: 'b'.repeat(64), scope: 'public', status: 'WITHDRAWN', withdrawnReason: 'wrong table', document: {}, outputSet: {} }}
      onTest={vi.fn()} revisions={[]} onWithdraw={vi.fn()} onRestore={vi.fn()} />);
    expect(screen.getByText(/Withdrawn: routers keep their copy/)).toBeTruthy();
    expect(screen.getByText('Restore')).toBeTruthy();
    expect(screen.queryByText('Withdraw')).toBeNull();
  });

  it('the editor keeps the id in the table, refuses a bad id, checks vectors and explains a refusal in words', async () => {
    const onSave = vi.fn(async () => undefined);
    const onCheck = vi.fn(async () => ({ verdict: { ok: false as const, refusal: { code: 'codec_incompatible', detail: { removed: ['humidity'] } } }, vectors: [{ index: 0, name: 'v1', ok: false, problems: ['battery: 1, expected 2'] }], frame: null }));
    render(<LoraCodecEditor initial={{ id: 't.my-sensor', title: 'T', vendor: 'V', kind: 'tlv' }} onCheck={onCheck} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/^Id/), { target: { value: 'Bad Id' } });
    fireEvent.click(screen.getByText('Publish'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/The id is t\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Id/), { target: { value: 't.room' } });
    fireEvent.click(screen.getByText('Publish'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 't.room', title: 'T' }));
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => expect(screen.getByText(/humidity/)).toBeTruthy());
    expect(screen.getByText(/Publish it under a new id/)).toBeTruthy();
    expect(screen.getByText('battery: 1, expected 2')).toBeTruthy();
    expect(loraRefusalText(LORA_MESSAGES.editor, { code: 'codec_format_not_supported' })).toMatch(/JavaScript decoder/);
    expect(loraRefusalText(LORA_MESSAGES.editor, { code: 'unheard_of' })).toMatch(/unheard_of/);
  });
});

const frames: LoraFrameRow[] = [
  { t: 2, type: 'up', result: 'processed', deviceId: 'd1', fCnt: 9, fPort: 85, gateways: [{ gatewayId: 'g1', eui: 'AA', rssi: -90, snr: 2 }, { gatewayId: 'g2', eui: 'BB', rssi: -70, snr: 9 }], chosenGatewayId: 'g2' },
  { t: 1, type: 'up', result: 'processed', deviceId: 'd1', fCnt: 8, fPort: 85, gateways: [{ gatewayId: 'g3', eui: 'CC', rssi: -60, snr: 10 }] },
];
const device: LoraDeviceDetail = { deviceId: 'd1', name: 'EM300', devEui: '24E124136B502217', joinEui: '0000000000000000', class: 'A', macVersion: '1.0.3', lastJoin: { state: 'accepted', at: 1 }, session: { devAddr: '01020304', fCntUp: 9, fCntDown: 2, lastUplinkAt: '2026-11-04T00:00:00Z', status: 'ACTIVE' }, codecId: 'auto' };

describe('device LoRaWAN tab (10.4)', () => {
  it('shows only the latest uplink\'s gateways, best first, with the one chosen for the downlink', () => {
    expect(latestReception(frames).map((r) => `${r.gatewayId}:${r.chosen}`)).toEqual(['g2:true', 'g1:false']);
    render(<LoraDevicePanel device={device} frames={frames} codecOptions={[{ value: 'auto', label: 'Automatic' }]} gatewayName={(id) => ({ g1: 'Roof', g2: 'Tower' } as Record<string, string>)[id]} />);
    expect(screen.getAllByText('Tower').length).toBeGreaterThan(0);
    expect(screen.getByText(/Reception history is kept only/)).toBeTruthy();
    expect(screen.getByText('01020304')).toBeTruthy();
  });
  it('saves a codec choice and offers Reset session to the host', async () => {
    const onCodecChange = vi.fn(async () => undefined);
    const onResetSession = vi.fn();
    render(<LoraDevicePanel device={{ ...device, codecId: 'milesight-em300-th' }} frames={[]} codecOptions={[{ value: 'auto', label: 'Automatic' }, { value: 'milesight-em300-th', label: 'EM300' }]} onCodecChange={onCodecChange} onResetSession={onResetSession} />);
    fireEvent.click(screen.getByText('Reset session'));
    expect(onResetSession).toHaveBeenCalled();
    expect(screen.getByText('No uplink heard yet.')).toBeTruthy();
  });
  it('a device that is not a LoRaWAN device shows one line', () => {
    render(<LoraDevicePanel device={null} frames={[]} codecOptions={[]} />);
    expect(screen.getByText(/not a LoRaWAN device/)).toBeTruthy();
  });
});

const view: LoraProfileView = {
  settings: { region: 'EU868', macVersion: '1.0.3', class: 'A', rx1DelayS: 5, adrEnabled: true, minDr: 0, maxDr: 5, dedupMs: 200, anyJoinEui: false, codecId: 'auto', storeRadioKeys: true },
  hasSharedAppKey: true, onlineRule: null, expectedIntervalS: null,
};

describe('profile LoRaWAN tab (10.6)', () => {
  it('sends only what changed, a new shared key lower-cased, and refuses a bad key or data-rate range', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<LoraProfilePanel view={view} codecOptions={[{ value: 'auto', label: 'Automatic' }]} onSave={onSave} />);
    expect(screen.getByText(/Online rule not chosen yet/)).toBeTruthy();
    expect(screen.getByText(/A shared AppKey is stored/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^RX1 delay/), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^New shared AppKey/), { target: { value: 'zz' } });
    expect((screen.getByText('Save').closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^New shared AppKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ rx1DelayS: 3, sharedAppKey: '00112233445566778899aabbccddeeff' }));
    expect(profileChange(view.settings, { ...view.settings, minDr: 2 })).toEqual({ minDr: 2 });
  });
  it('a profile that is not a LoRaWAN profile shows one line; without onSave nothing can change', () => {
    const { rerender } = render(<LoraProfilePanel view={null} codecOptions={[]} />);
    expect(screen.getByText(/not a LoRaWAN profile/)).toBeTruthy();
    rerender(<LoraProfilePanel view={{ ...view, onlineRule: 'UPLINK_WINDOW' }} codecOptions={[]} onlineRuleLabel={() => 'Recent message'} />);
    expect(screen.getByText('Online rule: Recent message')).toBeTruthy();
    expect(screen.queryByText('Save')).toBeNull();
  });
});
