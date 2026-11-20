import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaimDeviceWizard, type ClaimDeviceWizardProps } from './ClaimDeviceWizard';
import { ReleaseDeviceDialog } from './ReleaseDeviceDialog';
import type { ClaimAnswer, ClaimCode } from './types';

const SERIAL = 'RT420-2610-000123';
const SECRET = '7KQ2M9XHD4TB6WRA1NZC';
const parseScan = (text: string): ClaimCode | null => {
  const m = /^(?:iot|roltek):\/\/claim\?sn=([A-Z0-9-]+)&k=([A-Z0-9]{20})$/.exec(text);
  return m ? { serial: m[1], secret: m[2] } : null;
};
const checkTyped = (serial: string, secret: string) => {
  const k = secret.replace(/-/g, '').toUpperCase();
  if (serial.length < 6) return { problem: 'The serial is too short.' };
  if (k.length !== 20) return { problem: 'The claim code has 20 characters.' };
  return { serial, secret: k };
};
const READY: ClaimAnswer = { status: 'ready', preview: { serial: SERIAL, model: 'RT420', hw: 'rev B' } };
const DONE: ClaimAnswer = { status: 'done', done: { deviceId: 'd1', notes: ['The device was added.', 'Added as "Pump".'] } };

function setup(over: Partial<ClaimDeviceWizardProps> = {}) {
  const props: ClaimDeviceWizardProps = {
    parseScan, checkTyped, check: vi.fn(async () => READY), claim: vi.fn(async () => DONE),
    describeError: (e) => ({ text: (e as Error).message, retry: (e as Error).message.startsWith('closed') }),
    deviceHref: (d) => `/devices/${d.deviceId}`, onAdded: vi.fn(), ...over,
  };
  render(<ClaimDeviceWizard {...props} />);
  return props;
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).BarcodeDetector;
  vi.restoreAllMocks();
});

describe('ClaimDeviceWizard', () => {
  it('type path: the dry run gets the host\'s normalised code, the claim the name, done shows the host\'s lines and the link', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: 'Type serial and code' }));
    await user.type(screen.getByLabelText('Serial'), SERIAL.toLowerCase());
    await user.type(screen.getByLabelText('Claim code'), '7kq2-m9xh-d4tb-6wra-1nzc');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Ready to add')).toBeInTheDocument();
    expect(p.check).toHaveBeenCalledWith({ serial: SERIAL, secret: SECRET });
    expect(p.onAdded).not.toHaveBeenCalled();
    expect(screen.getByText('RT420 · rev B')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Device name'), 'Pump');
    await user.click(screen.getByRole('button', { name: 'Add device' }));
    expect(await screen.findByRole('link', { name: 'Open the device' })).toHaveAttribute('href', '/devices/d1');
    expect(p.claim).toHaveBeenCalledWith({ serial: SERIAL, secret: SECRET }, { name: 'Pump' });
    expect(screen.getByText('Added as "Pump".')).toBeInTheDocument();
    expect(p.onAdded).toHaveBeenCalledTimes(1);
    expect(screen.queryByDisplayValue(/7KQ2/)).toBeNull();
  });

  it('a typed problem and a pasted text that is no claim code are refused here, nothing sent', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: 'Type serial and code' }));
    await user.type(screen.getByLabelText('Serial'), 'AB');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('The serial is too short.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Scan the code on the device\'s screen' }));
    await user.type(screen.getByLabelText('Scanned code'), 'https://example.com/?sn=x');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/This is not a claim code/)).toBeInTheDocument();
    expect(p.check).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Scanned code'));
    await user.type(screen.getByLabelText('Scanned code'), `iot://claim?sn=${SERIAL}&k=${SECRET}`);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Ready to add')).toBeInTheDocument();
  });

  it('a code read by the camera is checked at once', async () => {
    const track = { stop: vi.fn(), applyConstraints: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] })) }, configurable: true,
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
    (window as unknown as Record<string, unknown>).BarcodeDetector = class { detect = async () => [{ rawValue: `roltek://claim?sn=${SERIAL}&k=${SECRET}` }]; };
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: 'Scan the code on the device\'s screen' }));
    await user.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText('Ready to add')).toBeInTheDocument();
    expect(p.check).toHaveBeenCalledWith({ serial: SERIAL, secret: SECRET });
    expect(track.stop).toHaveBeenCalled();
  });

  it('a retryable refusal offers Try again; Back waits while a request runs', async () => {
    const user = userEvent.setup();
    let release: (a: ClaimAnswer) => void = () => undefined;
    const check = vi.fn()
      .mockRejectedValueOnce(new Error('closed: press Open claim window'))
      .mockResolvedValueOnce(READY)
      .mockImplementationOnce(() => new Promise<ClaimAnswer>((r) => { release = r; }));
    setup({ check });
    await user.click(screen.getByRole('button', { name: 'Type serial and code' }));
    await user.type(screen.getByLabelText('Serial'), SERIAL);
    await user.type(screen.getByLabelText('Claim code'), SECRET);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/closed: press Open claim window/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Ready to add')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Type serial and code' }));
    await user.type(screen.getByLabelText('Serial'), SERIAL);
    await user.type(screen.getByLabelText('Claim code'), SECRET);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(check).toHaveBeenCalledTimes(3);
    release(READY);
    expect(await screen.findByText('Ready to add')).toBeInTheDocument();
  });

  it('a busy answer says so in words', async () => {
    const user = userEvent.setup();
    setup({ check: vi.fn(async () => ({ status: 'busy' }) as ClaimAnswer) });
    await user.click(screen.getByRole('button', { name: 'Type serial and code' }));
    await user.type(screen.getByLabelText('Serial'), SERIAL);
    await user.type(screen.getByLabelText('Claim code'), SECRET);
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText(/being added right now/)).toBeInTheDocument();
  });
});

describe('ReleaseDeviceDialog', () => {
  it('releases only after the exact serial is typed, with the optional reason', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ReleaseDeviceDialog open serial={SERIAL} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: 'Release this device?' });
    expect(dialog).toHaveTextContent('A factory reset of the device does not release it');
    const confirm = screen.getByRole('button', { name: 'Release device' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(`Type the serial ${SERIAL} to confirm`), SERIAL.slice(0, -1));
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(`Type the serial ${SERIAL} to confirm`), SERIAL.slice(-1));
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('carries the reason and the host\'s own effect lines', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ReleaseDeviceDialog open serial={SERIAL} effects={['Placements must be removed first.']} onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(await screen.findByText('Placements must be removed first.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reason (optional)'), ' sold ');
    await user.type(screen.getByLabelText(`Type the serial ${SERIAL} to confirm`), SERIAL);
    await user.click(screen.getByRole('button', { name: 'Release device' }));
    expect(onConfirm).toHaveBeenCalledWith('sold');
  });
});
