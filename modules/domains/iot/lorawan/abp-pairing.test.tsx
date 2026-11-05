import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoraDeviceForm, LoraDevicePanel, LoraFrameTable, LoraJoinStateBadge, LoraPairingPanel, LoraProfilePanel, isDevAddr, pairingLeft } from '.';
import type { LoraDeviceDetail, LoraPairingView, LoraProfileView } from '.';

/** NB iot_lorawan D508-D525: ABP devices, Class C and pairing mode in the LoRaWAN components. */
const otaa: LoraDeviceDetail = {
  deviceId: 'd1', name: 'EM300', devEui: '24E124136B502217', joinEui: '0000000000000000', class: 'A', macVersion: '1.0.3', lastJoin: null,
  session: { devAddr: '01020304', fCntUp: 9, fCntDown: 2, lastUplinkAt: null, status: 'ACTIVE' }, codecId: 'auto', activation: 'OTAA', hasAppKey: true,
};
const abp: LoraDeviceDetail = {
  ...otaa, deviceId: 'd2', activation: 'ABP', hasAppKey: false, hasSessionKeys: true, abp: { devAddr: '00ABCDEF', countersResetAt: null },
  session: { devAddr: '00ABCDEF', fCntUp: 41, fCntDown: 3, lastUplinkAt: null, status: 'ACTIVE' },
};

describe('ABP in the add form (D508)', () => {
  it('asks for the DevAddr and both session keys instead of the AppKey, and hands normalised values on', () => {
    const onSubmit = vi.fn();
    render(<LoraDeviceForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^Activation/), { target: { value: 'ABP' } });
    expect(screen.queryByLabelText(/^AppKey/)).toBeNull();
    expect(screen.getByText(/does not join/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Meter' } });
    fireEvent.change(screen.getByLabelText(/^DevEUI/), { target: { value: '70-b3-d5-7e-d0-00-00-01' } });
    fireEvent.change(screen.getByLabelText(/^DevAddr/), { target: { value: 'zz' } });
    fireEvent.change(screen.getByLabelText(/^NwkSKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.change(screen.getByLabelText(/^AppSKey/), { target: { value: 'ffeeddccbbaa99887766554433221100' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('8 hexadecimal digits.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^DevAddr/), { target: { value: '00:ab:cd:ef' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Meter', devEui: '70B3D57ED0000001', joinEui: '0000000000000000', macVersion: '1.0.3', class: 'A', activation: 'ABP',
      devAddr: '00ABCDEF', nwkSKey: '00112233445566778899aabbccddeeff', appSKey: 'ffeeddccbbaa99887766554433221100',
    });
    expect(isDevAddr('00ABCDEF')).toBe(true);
    expect(isDevAddr('00ABCDE')).toBe(false);
  });
  it('an OTAA device is sent without the ABP fields', () => {
    const onSubmit = vi.fn();
    render(<LoraDeviceForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'S' } });
    fireEvent.change(screen.getByLabelText(/^DevEUI/), { target: { value: '70B3D57ED0000002' } });
    fireEvent.change(screen.getByLabelText(/^AppKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.click(screen.getByText('Add device'));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('activation');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('devAddr');
  });
});

describe('the LoRaWAN tab (D511-D523)', () => {
  it('an ABP device offers Reset counters, never Reset session, and never shows a key', () => {
    const onResetSession = vi.fn();
    const onResetCounters = vi.fn();
    render(<LoraDevicePanel device={abp} frames={[]} codecOptions={[]} onResetSession={onResetSession} onResetCounters={onResetCounters} />);
    expect(screen.queryByText('Reset session')).toBeNull();
    fireEvent.click(screen.getByText('Reset counters'));
    expect(onResetCounters).toHaveBeenCalled();
    expect(onResetSession).not.toHaveBeenCalled();
    expect(screen.getByText('ABP')).toBeTruthy();
    expect(screen.getByText('Session keys')).toBeTruthy();
  });
  it('an OTAA device keeps Reset session', () => {
    const onResetSession = vi.fn();
    render(<LoraDevicePanel device={otaa} frames={[]} codecOptions={[]} onResetSession={onResetSession} onResetCounters={vi.fn()} />);
    fireEvent.click(screen.getByText('Reset session'));
    expect(onResetSession).toHaveBeenCalled();
  });
  it('saves the class only on its own button', async () => {
    const onClassChange = vi.fn(async () => undefined);
    render(<LoraDevicePanel device={otaa} frames={[]} codecOptions={[]} onClassChange={onClassChange} />);
    const save = screen.getByText('Save class').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Class/), { target: { value: 'C' } });
    expect(onClassChange).not.toHaveBeenCalled();
    fireEvent.click(save);
    await waitFor(() => expect(onClassChange).toHaveBeenCalledWith('C'));
  });
  it('new ABP keys are checked, sent with the DevAddr and cleared after the host saved them', async () => {
    const onKeysChange = vi.fn(async () => undefined);
    render(<LoraDevicePanel device={abp} frames={[]} codecOptions={[]} onKeysChange={onKeysChange} />);
    expect((screen.getByLabelText(/^DevAddr/) as HTMLInputElement).value).toBe('00ABCDEF');
    fireEvent.change(screen.getByLabelText(/^New NwkSKey/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Replace keys'));
    expect(onKeysChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^New NwkSKey/), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    fireEvent.change(screen.getByLabelText(/^New AppSKey/), { target: { value: '00112233445566778899aabbccddeeff' } });
    fireEvent.click(screen.getByText('Replace keys'));
    await waitFor(() => expect(onKeysChange).toHaveBeenCalledWith({ devAddr: '00ABCDEF', nwkSKey: '00112233445566778899aabbccddeeff', appSKey: '00112233445566778899aabbccddeeff' }));
    await waitFor(() => expect((screen.getByLabelText(/^New NwkSKey/) as HTMLInputElement).value).toBe(''));
  });
  it('a device pairing mode added says it waits for approval, with Approve', () => {
    const onApprove = vi.fn();
    render(<LoraDevicePanel device={{ ...otaa, held: true, useProfileKey: true }} frames={[]} codecOptions={[]} onApprove={onApprove} />);
    expect(screen.getByText(/not answered until someone approves it/)).toBeTruthy();
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalled();
  });
  it('names the new join states and drop reasons', () => {
    render(<LoraJoinStateBadge device={{ lastJoin: { state: 'pending_approval', at: 1 }, session: null }} />);
    expect(screen.getByText('Waiting for approval')).toBeTruthy();
    render(<LoraFrameTable rows={[{ t: 1, type: 'join', result: 'dropped', reason: 'pairing_pending', gateways: [] }]} />);
    expect(screen.getByText('Being added by pairing mode')).toBeTruthy();
  });
});

describe('pairing mode (D517-D521)', () => {
  const base: LoraPairingView = { active: false, until: null, startedAt: null, hasSharedAppKey: true, found: [] };
  it('counts down and stops', async () => {
    vi.useFakeTimers();
    try {
      let t = Date.parse('2026-11-05T10:00:00Z');
      const onExpired = vi.fn();
      const onStop = vi.fn();
      render(<LoraPairingPanel view={{ ...base, active: true, startedAt: '2026-11-05T09:59:00Z', until: '2026-11-05T10:00:03Z' }} now={() => t} onStop={onStop} onExpired={onExpired} />);
      expect(screen.getByText('On: 0:03 left')).toBeTruthy();
      t += 1000;
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(screen.getByText('On: 0:02 left')).toBeTruthy();
      fireEvent.click(screen.getByText('Stop'));
      await act(async () => { await Promise.resolve(); });
      expect(onStop).toHaveBeenCalled();
      t += 3000;
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(onExpired).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('starts for the chosen minutes, and without a shared key offers nothing', async () => {
    const onStart = vi.fn(async () => undefined);
    const { rerender } = render(<LoraPairingPanel view={base} onStart={onStart} />);
    expect(screen.getByText('Off')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^For how long/), { target: { value: '60' } });
    fireEvent.click(screen.getByText('Start pairing'));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith(60));
    rerender(<LoraPairingPanel view={{ ...base, hasSharedAppKey: false }} onStart={onStart} />);
    expect(screen.getByText(/needs a shared AppKey/)).toBeTruthy();
    expect(screen.queryByText('Start pairing')).toBeNull();
  });
  it('lists the devices it added; one waiting for approval has Approve', () => {
    const onApprove = vi.fn();
    render(<LoraPairingPanel view={{ ...base, found: [{ deviceId: 'p1', devEui: '70B3D57ED0000009', name: 'LoRa 70B3D57ED0000009', held: true, pairedAt: '2026-11-05T10:00:00Z' }, { deviceId: 'p2', devEui: '70B3D57ED000000A', name: null, held: false, pairedAt: '2026-11-05T10:01:00Z' }] }} onApprove={onApprove} />);
    expect(screen.getByText('Ready')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith('p1');
  });
  it('pairingLeft formats minutes and hours', () => {
    expect(pairingLeft('2026-11-05T10:01:05Z', Date.parse('2026-11-05T10:00:00Z')).text).toBe('1:05');
    expect(pairingLeft('2026-11-05T12:00:00Z', Date.parse('2026-11-05T10:00:00Z')).text).toBe('2:00:00');
    expect(pairingLeft(null, 0).ms).toBe(0);
  });
});

describe('the profile tab (D516, D521)', () => {
  const view: LoraProfileView = {
    settings: { region: 'EU868', macVersion: '1.0.3', class: 'A', rx1DelayS: 5, adrEnabled: true, minDr: 0, maxDr: 5, dedupMs: 200, anyJoinEui: false, codecId: 'auto', storeRadioKeys: true, classCConfirmTimeoutS: 60, pairingAutoActivate: false },
    hasSharedAppKey: true, onlineRule: null, expectedIntervalS: null,
  };
  it('sends the Class C wait and the pairing approval choice when changed', async () => {
    const onSave = vi.fn(async () => undefined);
    render(<LoraProfilePanel view={view} codecOptions={[]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/^Confirmed downlink/), { target: { value: '2' } });
    expect(screen.getByText(/from 5 to 3600/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Confirmed downlink/), { target: { value: '120' } });
    fireEvent.click(screen.getByLabelText(/ready at once/));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ classCConfirmTimeoutS: 120, pairingAutoActivate: true }));
  });
});
