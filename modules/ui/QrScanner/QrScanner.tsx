'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/libs/utils/cn';
import { Button } from '@/modules/ui/Button';
import { Callout } from '@/modules/ui/Callout';
import {
  cameraBlockedReason, cameraErrorReason, firstText, isInstalledApp, qrBarcodeDetector,
  type QrDetector, type QrFrameDecoder, type QrScannerProblem,
} from './camera';
import { mergeQrScannerMessages, type QrScannerMessagesInput } from './messages';

export type QrScannerProps = {
  /** The text of the first code read. The camera is already off when this is called; "Scan again" opens it once more. */
  onResult: (text: string) => void;
  /**
   * The host's frame decoder for browsers without a `BarcodeDetector` that reads QR codes (Safari, Firefox). Without one, such a browser
   * gets the typed entry only. The scanner adds no decoder library of its own.
   */
  decodeFrame?: QrFrameDecoder;
  /** The typed way in, drawn under the camera and always reachable (a denied or missing camera leaves only this). */
  manual?: ReactNode;
  /** A line above the start button (where the code is, what to do first). */
  hint?: ReactNode;
  /** Milliseconds between two reads of the picture (default 250). */
  interval?: number;
  messages?: QrScannerMessagesInput;
  className?: string;
};

type Phase = 'idle' | 'starting' | 'scanning' | 'problem';

/** Problems a second try may cure (the person allowed the camera, closed the other app). */
const RETRYABLE: ReadonlySet<QrScannerProblem> = new Set(['denied', 'deniedInstalled', 'inUse', 'failed', 'notFound']);
const MAX_FRAME_WIDTH = 640;

/** One frame of the video as pixels, at most 640 px wide; null while the video has no picture yet. */
function frameOf(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_FRAME_WIDTH / w);
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * QrScanner — reads a QR code with the device's camera, entirely in the browser.
 *
 * The camera opens only when the person presses "Scan with the camera" (the browser's permission prompt follows that press, never the
 * page load), shows the rear camera, and closes as soon as a code is read, when the person stops it, when the page goes to the
 * background (an installed app on a phone included) and when the component goes away. Reading uses the browser's own `BarcodeDetector`;
 * where the browser has none, the host may pass `decodeFrame` (its own decoder), else the typed entry is the way in. The typed entry
 * (`manual`) is always shown, so a person without a camera, or who refused it, is never stuck. A refusal says what to do in words,
 * naming the installed app's settings when the page runs as one. Torch toggle when the camera offers one.
 */
export function QrScanner({ onResult, decodeFrame, manual, hint, interval = 250, messages, className }: QrScannerProps) {
  const m = mergeQrScannerMessages(messages);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runRef = useRef(0);
  const resultRef = useRef(onResult);
  useEffect(() => { resultRef.current = onResult; }, [onResult]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [problem, setProblem] = useState<QrScannerProblem | null>(null);
  const [readOnce, setReadOnce] = useState(false);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });

  /** Stops the camera and every pending read; a run started before is void from here. */
  const stop = useCallback(() => {
    runRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorch({ supported: false, on: false });
  }, []);

  const fail = (p: QrScannerProblem) => {
    stop();
    setProblem(p);
    setPhase('problem');
  };

  const start = async () => {
    stop();
    const run = runRef.current;
    setProblem(null);
    const blocked = cameraBlockedReason();
    if (blocked) { fail(blocked); return; }
    const detector: QrDetector | null = await qrBarcodeDetector();
    if (run !== runRef.current) return;
    if (!detector && !decodeFrame) { fail('noDecoder'); return; }
    setPhase('starting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (error) {
      if (run === runRef.current) fail(cameraErrorReason(error, isInstalledApp()));
      return;
    }
    if (run !== runRef.current) { for (const t of stream.getTracks()) t.stop(); return; }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) { stop(); return; }
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', '');
    await video.play().catch(() => undefined);
    if (run !== runRef.current) return;
    const track = stream.getVideoTracks()[0] as (Omit<MediaStreamTrack, 'getCapabilities'> & { getCapabilities?: () => { torch?: boolean } }) | undefined;
    const caps = track?.getCapabilities?.();
    setTorch({ supported: !!caps?.torch, on: false });
    setPhase('scanning');

    const read = async (): Promise<string | null> => {
      if (video.readyState < 2) return null;
      if (detector) return firstText(await detector.detect(video));
      canvasRef.current ??= document.createElement('canvas');
      const frame = frameOf(video, canvasRef.current);
      return frame && decodeFrame ? decodeFrame(frame) : null;
    };
    const tick = async () => {
      if (run !== runRef.current) return;
      let text: string | null = null;
      try {
        text = await read();
      } catch {
        text = null; // a frame the decoder could not take: the next one is read
      }
      if (run !== runRef.current) return;
      if (text) {
        stop();
        setReadOnce(true);
        setPhase('idle');
        resultRef.current(text);
        return;
      }
      timerRef.current = setTimeout(() => void tick(), interval);
    };
    void tick();
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on });
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  // the camera never runs in the background, and never outlives the component
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) { stop(); setPhase('idle'); }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); stop(); };
  }, [stop]);

  const live = phase === 'starting' || phase === 'scanning';
  const problemText = problem === 'insecure'
    ? m.insecure.replace('{origin}', typeof window === 'undefined' ? '' : window.location.origin)
    : problem ? m[problem] : '';

  return (
    <div className={cn('space-y-3', className)} data-qr-scanner={phase}>
      <div className={cn('relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-black', !live && 'hidden')}>
        <video ref={videoRef} aria-label={m.video} className="h-full w-full object-cover" muted playsInline />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-lg border-2 border-white/80" />
      </div>
      {phase === 'starting' && <p role="status" className="text-center text-sm text-text-secondary">{m.starting}</p>}
      {phase === 'scanning' && <p role="status" className="text-center text-sm text-text-secondary">{m.scanning}</p>}
      {phase === 'problem' && problem && (
        <Callout variant="warning" title={null} role="alert">
          <p>{problemText}</p>
        </Callout>
      )}
      {live ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => { stop(); setPhase('idle'); }}>{m.stop}</Button>
          {torch.supported && (
            <Button type="button" variant="ghost" aria-pressed={torch.on} onClick={() => void toggleTorch()}>{torch.on ? m.torchOff : m.torchOn}</Button>
          )}
        </div>
      ) : (phase === 'idle' || (problem && RETRYABLE.has(problem))) && (
        <div className="space-y-2">
          {hint && <div className="text-sm text-text-secondary">{hint}</div>}
          <Button type="button" fullWidth size="lg" onClick={() => void start()}>{readOnce || problem ? m.again : m.start}</Button>
          <p className="text-xs text-text-secondary">{m.consent}</p>
        </div>
      )}
      {manual}
    </div>
  );
}
