import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QrScanner } from './QrScanner';
import { cameraBlockedReason, cameraErrorReason, firstText, qrBarcodeDetector } from './camera';

type Track = { stop: ReturnType<typeof vi.fn>; getCapabilities?: () => Record<string, unknown>; applyConstraints: ReturnType<typeof vi.fn> };

function fakeStream(caps: Record<string, unknown> = {}) {
  const track: Track = { stop: vi.fn(), getCapabilities: () => caps, applyConstraints: vi.fn(async () => undefined) };
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
}

let getUserMedia: ReturnType<typeof vi.fn>;
const w = window as unknown as Record<string, unknown>;

beforeEach(() => {
  getUserMedia = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
});

afterEach(() => {
  delete w.BarcodeDetector;
  vi.restoreAllMocks();
});

function detectorReturning(...answers: Array<string | null>) {
  const detect = vi.fn(async () => {
    const next = answers.length > 1 ? answers.shift() : answers[0];
    return next ? [{ rawValue: next }] : [];
  });
  class FakeDetector {
    static getSupportedFormats = async () => ['qr_code', 'ean_13'];
    detect = detect;
  }
  w.BarcodeDetector = FakeDetector;
  return detect;
}

describe('QrScanner helpers', () => {
  it('names why the camera cannot be asked for, and what a refusal means, never the raw error', () => {
    expect(cameraBlockedReason({ isSecureContext: false, navigator: {} } as unknown as Window)).toBe('insecure');
    expect(cameraBlockedReason({ isSecureContext: true, navigator: {} } as unknown as Window)).toBe('unsupported');
    expect(cameraBlockedReason({ isSecureContext: true, navigator: { mediaDevices: { getUserMedia: () => null } } } as unknown as Window)).toBeNull();
    expect(cameraErrorReason({ name: 'NotAllowedError' }, false)).toBe('denied');
    expect(cameraErrorReason({ name: 'NotAllowedError' }, true)).toBe('deniedInstalled');
    expect(cameraErrorReason({ name: 'NotFoundError' }, false)).toBe('notFound');
    expect(cameraErrorReason({ name: 'NotReadableError' }, false)).toBe('inUse');
    expect(cameraErrorReason(new Error('boom'), false)).toBe('failed');
    expect(firstText([{ rawValue: '' }, { rawValue: 'abc' }])).toBe('abc');
    expect(firstText([])).toBeNull();
  });

  it('uses the browser detector only when it reads QR codes', async () => {
    class NoQr { static getSupportedFormats = async () => ['ean_13']; detect = vi.fn(); }
    expect(await qrBarcodeDetector({ BarcodeDetector: NoQr } as unknown as Window)).toBeNull();
    expect(await qrBarcodeDetector({} as Window)).toBeNull();
    detectorReturning('x');
    expect(await qrBarcodeDetector(window)).not.toBeNull();
  });
});

describe('QrScanner', () => {
  it('asks for the camera only after the press, reads one code, then turns the camera off', async () => {
    const detect = detectorReturning(null, 'iot://claim?sn=A&k=B');
    const { track, stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const onResult = vi.fn();
    render(<QrScanner onResult={onResult} interval={5} manual={<input aria-label="Code" />} />);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText(/The browser asks whether this page may use the camera/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('iot://claim?sn=A&k=B'));
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    expect(detect).toHaveBeenCalledTimes(2);
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('says what to do when the camera is refused, naming the installed app when it runs as one; typing stays', async () => {
    detectorReturning(null);
    getUserMedia.mockRejectedValue(Object.assign(new Error('Permission denied by user agent'), { name: 'NotAllowedError' }));
    render(<QrScanner onResult={vi.fn()} manual={<input aria-label="Code" />} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText(/blocked for this site/)).toBeInTheDocument();
    expect(screen.queryByText(/Permission denied by user agent/)).toBeNull();
    expect(screen.getByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeInTheDocument();

    w.matchMedia = vi.fn(() => ({ matches: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Scan again' }));
    expect(await screen.findByText(/blocked for this app/)).toBeInTheDocument();
    delete w.matchMedia;
  });

  it('without a detector and without a host decoder offers typing only; with one, it reads frames through it', async () => {
    const { unmount } = render(<QrScanner onResult={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText(/cannot read QR codes from the camera/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Scan/ })).toBeNull();
    unmount();

    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 1280, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 720, configurable: true });
    const pixels = { data: new Uint8ClampedArray(4), width: 640, height: 360 } as unknown as ImageData;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), getImageData: vi.fn(() => pixels) } as never);
    const decodeFrame = vi.fn(() => 'TEXT');
    const onResult = vi.fn();
    render(<QrScanner onResult={onResult} decodeFrame={decodeFrame} interval={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('TEXT'));
    expect(decodeFrame).toHaveBeenCalledWith(pixels);
  });

  it('stops the camera when the page goes to the background, and when it goes away', async () => {
    detectorReturning(null);
    const first = fakeStream({ torch: true });
    getUserMedia.mockResolvedValue(first.stream);
    const { unmount } = render(<QrScanner onResult={vi.fn()} interval={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText('Hold the code inside the frame.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Light on' }));
    await waitFor(() => expect(first.track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] }));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(first.track.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Scan with the camera' })).toBeInTheDocument();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    const second = fakeStream();
    getUserMedia.mockResolvedValue(second.stream);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText('Hold the code inside the frame.')).toBeInTheDocument();
    unmount();
    expect(second.track.stop).toHaveBeenCalled();
  });

  it('refuses over an insecure connection before any prompt', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    render(<QrScanner onResult={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scan with the camera' }));
    expect(await screen.findByText(/only works over a secure connection/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });
});
