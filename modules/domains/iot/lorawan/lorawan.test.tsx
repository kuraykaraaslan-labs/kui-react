import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoraDeviceForm, LoraFrameTable, LoraGatewayForm, LoraGatewayTable, LoraJoinStateBadge, LoraStationSetup, isEui, isKey } from '.';

const gw = { gatewayId: 'g1', name: 'Roof', eui: 'AA555A0000000001', protocol: 'BASICS_STATION' as const, status: 'ACTIVE' as const, region: 'EU868', lastSeenAt: null, live: { online: true, rttMs: 950, connectedAt: 1 } };

describe('LoRaWAN components (NB iot_lorawan 13)', () => {
  it('the gateway table shows online state and marks a slow round trip', () => {
    render(<LoraGatewayTable rows={[gw]} />);
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('950 ms').getAttribute('title')).toMatch(/RX2/);
  });
  it('the setup card shows the token only when it was just issued, and says how to get a new one otherwise', () => {
    const setup = { lnsUrl: 'wss://lns.example.com', routerInfoUrl: 'wss://lns.example.com/router-info', trustAvailable: true };
    const { rerender } = render(<LoraStationSetup gateway={gw} setup={setup} issued={{ token: 'lns_x', files: [{ name: 'tc.key', content: 'x' }] }} onDownload={() => undefined} />);
    expect(screen.getByText('Authorization: Bearer lns_x')).toBeTruthy();
    expect(screen.getByText(/shown only now/)).toBeTruthy();
    rerender(<LoraStationSetup gateway={gw} setup={setup} issued={null} />);
    expect(screen.queryByText(/Bearer/)).toBeNull();
    expect(screen.getByText(/Rotate the token/)).toBeTruthy();
    rerender(<LoraStationSetup gateway={{ ...gw, protocol: 'ROLTEK_LINK' }} setup={setup} />);
    expect(screen.getByText(/device certificate/)).toBeTruthy();
  });
  it('the forms refuse bad identifiers and hand normalised values on', () => {
    const onGw = vi.fn();
    render(<LoraGatewayForm onSubmit={onGw} />);
    fireEvent.click(screen.getByText('Add gateway'));
    expect(onGw).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Roof' } });
    fireEvent.change(screen.getByLabelText(/^Gateway EUI/), { target: { value: 'aa-55-5a-00-00-00-00-01' } });
    fireEvent.click(screen.getByText('Add gateway'));
    expect(onGw).toHaveBeenCalledWith({ name: 'Roof', eui: 'AA555A0000000001', region: 'EU868' });
    expect(isEui('0000000000000000')).toBe(false);
    expect(isKey('00112233445566778899aabbccddeeff')).toBe(true);
  });
  it('the device form needs a 32-hex AppKey and lower-cases it', () => {
    const onDev = vi.fn();
    render(<LoraDeviceForm onSubmit={onDev} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Cold room' } });
    fireEvent.change(screen.getByLabelText(/^DevEUI/), { target: { value: 'A840410000000001' } });
    fireEvent.change(screen.getByLabelText(/^AppKey/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onDev).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^AppKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onDev.mock.calls[0][0]).toMatchObject({ appKey: '00112233445566778899aabbccddeeff', joinEui: '0000000000000000', macVersion: '1.0.3', class: 'A' });
  });
  it('join states and frame results read as words, a foreign device without ids', () => {
    render(<LoraJoinStateBadge device={{ lastJoin: { state: 'join_mic_failed', at: 1 }, session: null }} />);
    expect(screen.getByText(/wrong AppKey/)).toBeTruthy();
    render(<LoraFrameTable rows={[{ t: 1, type: 'dropped', result: 'dropped', reason: 'foreign_tenant', gateways: [] }]} />);
    expect(screen.getByText('A device of another network')).toBeTruthy();
  });
});
