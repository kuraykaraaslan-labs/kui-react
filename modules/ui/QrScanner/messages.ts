/*
 * Every text of the QR scanner, in English. A host passes translations as `messages` (any subset). `{origin}` is filled by the scanner.
 */
export const QR_SCANNER_MESSAGES = {
  start: 'Scan with the camera',
  consent: 'The browser asks whether this page may use the camera. The picture stays on this device; only the text of the code is used.',
  starting: 'Opening the camera…',
  scanning: 'Hold the code inside the frame.',
  stop: 'Stop the camera',
  again: 'Scan again',
  torchOn: 'Light on',
  torchOff: 'Light off',
  video: 'Camera picture',
  insecure: 'The camera only works over a secure connection (https); this page is served from {origin}. Enter the code by hand.',
  unsupported: 'This browser cannot open the camera. Enter the code by hand.',
  noDecoder: 'This browser cannot read QR codes from the camera. Enter the code by hand.',
  denied: 'The camera is blocked for this site. Allow it in the browser\'s site settings and try again, or enter the code by hand.',
  deniedInstalled: 'The camera is blocked for this app. Allow it for the installed app in the phone\'s settings and try again, or enter the code by hand.',
  notFound: 'No camera was found on this device. Enter the code by hand.',
  inUse: 'The camera is in use by another app. Close that app and try again, or enter the code by hand.',
  failed: 'The camera could not be opened. Try again, or enter the code by hand.',
};

export type QrScannerMessages = { [K in keyof typeof QR_SCANNER_MESSAGES]: string };
export type QrScannerMessagesInput = Partial<QrScannerMessages>;

export function mergeQrScannerMessages(input?: QrScannerMessagesInput): QrScannerMessages {
  return { ...QR_SCANNER_MESSAGES, ...(input ?? {}) };
}
