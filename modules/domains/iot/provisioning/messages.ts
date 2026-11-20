/**
 * The texts of the claim and release components (NB `iot_provisioning` 04; docs/concepts/iot-platform/phases/05-provisioning-and-claim.md),
 * English by default. A host passes its translations as `messages` (any subset of a group); `{name}` placeholders are filled by the
 * component. The scanner's own texts are `QrScanner`'s (`scanner`).
 */
export const PROVISIONING_MESSAGES = {
  claim: {
    steps: 'Steps',
    stepSource: 'Source',
    stepCapture: 'Code',
    stepConfirm: 'Confirm',
    stepDone: 'Done',
    sourceScan: 'Scan the code on the device\'s screen',
    sourceType: 'Type serial and code',
    sourceHelp: 'Log in to the device\'s local panel and open its Cloud page: it shows the claim QR and the code. Press Open claim window there first; it stays open for 15 minutes.',
    scanHint: 'Log in to the device\'s panel, open its Cloud page and press Open claim window, then hold the camera to the QR on the screen.',
    typeHint: 'Press Open claim window on the device\'s Cloud page, then type the serial and the code shown there.',
    scanned: 'Scanned code',
    scannedHint: 'No camera? Copy the QR\'s text from the phone\'s camera app and paste it here.',
    serial: 'Serial',
    code: 'Claim code',
    notACode: 'This is not a claim code. Scan the QR on the device\'s Cloud page, or type the serial and code.',
    back: 'Back',
    switchType: 'Type it instead',
    check: 'Check',
    ready: 'Ready to add',
    name: 'Device name',
    nameHint: 'Leave it empty to use the serial.',
    add: 'Add device',
    startOver: 'Start over',
    inProgress: 'This device is being added right now. Wait a moment and check the device list.',
    retry: 'Try again',
    added: 'The device was added. It connects within a few seconds when it is online.',
    open: 'Open the device',
    another: 'Add another',
  },
  release: {
    title: 'Release this device?',
    typeSerial: 'Type the serial {serial} to confirm',
    confirm: 'Release device',
    cancel: 'Cancel',
    reason: 'Reason (optional)',
    effectLeaves: 'The device leaves this account and its connection is closed.',
    effectPool: 'It returns to the factory pool; its data stays in this account\'s history.',
    effectNext: 'The next owner needs physical access to the device to add it.',
    effectReset: 'A factory reset of the device does not release it: only this action does.',
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type ProvisioningMessages = Widen<typeof PROVISIONING_MESSAGES>;
export type ProvisioningMessagesInput = { [K in keyof ProvisioningMessages]?: Partial<ProvisioningMessages[K]> };

export function mergeProvisioningMessages(input?: ProvisioningMessagesInput): ProvisioningMessages {
  const out = { ...PROVISIONING_MESSAGES } as ProvisioningMessages;
  for (const k of Object.keys(input ?? {}) as Array<keyof ProvisioningMessages>) out[k] = { ...PROVISIONING_MESSAGES[k], ...(input?.[k] ?? {}) } as never;
  return out;
}

export const fillText = (t: string, v: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (_, k: string) => (k in v ? String(v[k]) : `{${k}}`));
