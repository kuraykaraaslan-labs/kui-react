/*
 * The QR scanner's pure helpers: why the camera cannot be opened, what a `getUserMedia` refusal means, whether the page runs as an
 * installed app, and the browser's own `BarcodeDetector` when it reads QR codes. Free of React so they are tested on their own.
 */

export type QrScannerProblem = 'insecure' | 'unsupported' | 'noDecoder' | 'denied' | 'deniedInstalled' | 'notFound' | 'inUse' | 'failed';

/** What the scanner needs of a detector: the shape of the browser's `BarcodeDetector`. */
export interface QrDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
}

/** Decodes one camera frame where the browser has no `BarcodeDetector` (the host's own decoder); null when no code is in view. */
export type QrFrameDecoder = (frame: ImageData) => string | null | Promise<string | null>;

type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): QrDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** Why the camera cannot be opened at all, checked before any permission prompt; null when it can be asked for. */
export function cameraBlockedReason(win: Window | undefined = typeof window === 'undefined' ? undefined : window): 'insecure' | 'unsupported' | null {
  if (!win) return 'unsupported';
  if (win.isSecureContext === false) return 'insecure';
  if (!win.navigator?.mediaDevices?.getUserMedia) return 'unsupported';
  return null;
}

/** The page runs as an installed app (a PWA in standalone mode, or iOS's home-screen app): the "denied" help names the app's settings. */
export function isInstalledApp(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false;
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch {
    /* no matchMedia */
  }
  return (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** A `getUserMedia` rejection as the problem to show; never the browser's raw text. */
export function cameraErrorReason(error: unknown, installed: boolean): QrScannerProblem {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return installed ? 'deniedInstalled' : 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'notFound';
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'inUse';
  return 'failed';
}

/** The browser's `BarcodeDetector` for QR codes, or null when it has none or it does not read QR codes. */
export async function qrBarcodeDetector(win: Window | undefined = typeof window === 'undefined' ? undefined : window): Promise<QrDetector | null> {
  const Ctor = (win as (Window & { BarcodeDetector?: BarcodeDetectorCtor }) | undefined)?.BarcodeDetector;
  if (typeof Ctor !== 'function') return null;
  try {
    if (typeof Ctor.getSupportedFormats === 'function') {
      const formats = await Ctor.getSupportedFormats();
      if (!formats.includes('qr_code')) return null;
    }
    return new Ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

/** The first non-empty text a detector found. */
export function firstText(found: ReadonlyArray<{ rawValue?: string }> | null | undefined): string | null {
  for (const f of found ?? []) if (typeof f?.rawValue === 'string' && f.rawValue !== '') return f.rawValue;
  return null;
}
