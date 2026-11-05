/*
 * Every text of the eSIM views, in English, grouped by area. A host passes translations as `EsimMessagesInput` (a group may be partial) to
 * `EsimTextProvider` or to a view's `messages` prop, or builds the whole set from its dictionary with `esimMessagesFrom`. `{name}`
 * placeholders are filled by the view (`fill` in ../format).
 */

export const ESIM_MESSAGES = {
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    cancel: 'Cancel',
    none: '—',
    unknownError: 'Something went wrong: {message}',
    viewOnly: 'You can see the eSIM profiles but not change them.',
  },
  action: {
    open: 'eSIM',
    busy: 'eSIM (working…)',
    title: 'eSIM profiles',
  },
  chip: {
    title: 'eSIM chip',
    eid: 'EID',
    eidHint: 'The chip\'s own number. Operators ask for it when they prepare a profile. Do not share it publicly.',
    modem: 'Modem',
    slots: 'Profile slots',
    slotsUsed: '{used} of {slots} in use',
    slotsUnknown: '{used} in use',
    online: 'Online',
    offline: 'Offline',
    uplink: 'Connected over',
    reported: 'Reported {when}',
    neverReported: 'The router has not reported its profiles yet.',
  },
  uplink: {
    ethernet: 'Ethernet',
    wifi: 'Wi-Fi',
    lte: 'Mobile network',
    other: 'Another connection',
    unknown: 'Unknown',
  },
  unsupported: {
    title: 'No eSIM on this router',
    no_capability: 'This router\'s software does not manage eSIM profiles.',
    not_reported: 'The router has not reported its eSIM chip yet. It does so when it connects.',
    unsupported: 'This router\'s modem has no eSIM chip the platform can manage.',
  },
  profiles: {
    title: 'Profiles',
    caption: 'The SIM profiles on the router\'s eSIM chip',
    iccid: 'ICCID',
    operator: 'Operator',
    nickname: 'Name',
    state: 'State',
    class: 'Type',
    enabled: 'In use',
    disabled: 'Off',
    operational: 'Operational',
    test: 'Test',
    provisioning: 'Provisioning',
    empty: 'No profile on the chip yet. Add one with the activation code your operator gave you.',
    add: 'Add profile',
    refresh: 'Read again',
    refreshed: 'The router was asked to report its profiles again.',
    enable: 'Switch to this profile',
    disable: 'Turn off',
    delete: 'Delete',
    rename: 'Rename',
    noSlot: 'The chip is full. Delete a profile first.',
    noDownload: 'This router cannot receive an activation code safely yet. Update its firmware.',
    offline: 'The router is offline.',
    busy: 'Another eSIM operation is still running.',
    inUseDelete: 'Switch to another profile before deleting this one.',
  },
  confirm: {
    enableTitle: 'Switch to {name}?',
    enableMessage: 'The router changes its mobile connection to this profile. If it cannot reach the platform on the new profile within 5 minutes, it switches back to the current one on its own.',
    disableTitle: 'Turn off {name}?',
    disableMessage: 'The router stops using this profile for its mobile connection.',
    secondUplink: 'Another connection (Ethernet or Wi-Fi) is up on this router. Without one, it would be cut off and could not be reached again from here.',
    deleteTitle: 'Delete {name}?',
    deleteMessage: 'The profile is removed from the chip for good. Getting it back needs a new activation code from the operator.',
    phrase: 'Type the last six digits of the ICCID ({digits}) to confirm',
    renameTitle: 'Rename {name}',
    renameLabel: 'Name',
    renameHint: 'Up to 64 characters; shown here and on the router.',
    downloadTitle: 'Download a profile from {host}?',
    downloadMessage: 'The router fetches the profile from the operator\'s server with this code. A code works once.',
    downloadEnable: 'The new profile is switched on right after the download. If the router cannot reach the platform on it within 5 minutes, it switches back.',
    enableLabel: 'Switch',
    disableLabel: 'Turn off',
    deleteLabel: 'Delete profile',
    renameConfirm: 'Rename',
    downloadLabel: 'Download',
  },
  add: {
    title: 'Add an eSIM profile',
    intro: 'Enter the activation code from your operator (the text of its QR code). The code is sent to the router once and is never shown again.',
    code: 'Activation code',
    codeHint: 'Starts with LPA:1$ followed by the operator\'s server address.',
    codeInvalid: 'This is not an activation code.',
    goesTo: 'Profile server: {host}',
    confirmation: 'Confirmation code',
    confirmationHint: 'Only when your operator gave you one with the code.',
    confirmationRequired: 'This code needs the confirmation code your operator gave with it.',
    enable: 'Switch to the new profile after the download',
    enableHint: 'Leave it off to switch later, when you choose.',
    submit: 'Download profile',
    started: 'The router is downloading the profile. This can take a few minutes.',
  },
  op: {
    title: 'Operations',
    caption: 'eSIM operations on this router, newest first',
    when: 'Started',
    kind: 'Operation',
    profile: 'Profile',
    state: 'State',
    reason: 'Why',
    finished: 'Ended',
    empty: 'Nothing done on this chip from here yet.',
    inFlight: '{kind}: {state}',
    switchHint: 'The router keeps the current profile until the new one connects; if it does not within 5 minutes, it switches back.',
  },
  kind: {
    download: 'Download',
    enable: 'Switch',
    disable: 'Turn off',
    delete: 'Delete',
    nickname: 'Rename',
    refresh: 'Read again',
  },
  state: {
    sent: 'Sent',
    running: 'Running',
    switching: 'Switching',
    succeeded: 'Done',
    switched: 'Switched',
    failed: 'Failed',
    reverted: 'Switched back',
    unknown: 'No answer',
  },
  stateHint: {
    sent: 'The router was asked and has not answered yet.',
    running: 'The router is working on it.',
    switching: 'The router switched and is checking that it can reach the platform on the new profile.',
    succeeded: 'The router finished it.',
    switched: 'The router reached the platform on the new profile.',
    failed: 'The router could not do it.',
    reverted: 'The router could not reach the platform on the new profile and went back to the previous one.',
    unknown: 'No answer arrived in time. It may or may not have happened; read the profiles again to see.',
  },
  errors: {
    device_not_found: 'Device not found.',
    esim_unsupported: 'This router has no eSIM chip the platform can manage.',
    device_not_active: 'The device is not active.',
    esim_in_clear: 'The device profile lets eSIM commands travel without encryption. Remove the esim.* methods from its plaintext commands first.',
    offline: 'The router is offline.',
    secret_ref_unsupported: 'This router cannot receive an activation code safely yet. Update its firmware.',
    secret_store_unavailable: 'This installation cannot keep activation codes safely yet (no encryption key is set up).',
    no_free_slot: 'The eSIM chip has no free profile slot. Delete a profile first.',
    no_uplink: 'The router has no working connection to download the profile over.',
    only_uplink: 'This profile carries the router\'s only connection. Confirm that another connection is up.',
    profile_not_found: 'The router does not have this profile.',
    profile_enabled: 'The profile in use cannot be deleted. Switch to another profile first.',
    already_enabled: 'This profile is already in use.',
    already_disabled: 'This profile is already off.',
    confirm_required: 'Confirm the operation first.',
    confirm_text_mismatch: 'The digits do not match the profile\'s ICCID.',
    operation_in_flight: 'Another eSIM operation is still running on this router. Wait for it to finish.',
    invalid_activation_code: 'This is not an eSIM activation code.',
    invalid_confirmation_code: 'The confirmation code is 4 to 32 characters without spaces.',
    confirmation_code_required: 'This activation code needs its confirmation code.',
    download_failed: 'The operator\'s server refused the download.',
    secret_unavailable: 'The router could not fetch the activation code. Enter it again.',
    reverted: 'The router could not reach the platform on the new profile and switched back.',
    busy: 'The router is busy. Try again in a moment.',
    bad_params: 'The router did not accept the request.',
    forbidden: 'The router refused: eSIM changes from the cloud are switched off on it.',
    unsupported_method: 'The router\'s software does not know this eSIM operation.',
    timeout: 'The router did not finish in time.',
    not_delivered: 'The request never reached the router.',
    cancelled: 'The request was cancelled.',
    no_answer: 'The router did not answer.',
    no_result: 'The router did not report how it ended.',
    audit_unavailable: 'The operation could not be recorded, so it was not started.',
    rpc_failed: 'The request could not be sent.',
    device_rate_limited: 'Too many commands to this router. Try again in a minute.',
    internal: 'The router reported an error.',
  },
};

export type EsimMessages = typeof ESIM_MESSAGES;
type Deep<T> = { [K in keyof T]?: T[K] extends string ? string : Deep<T[K]> };
export type EsimMessagesInput = Deep<EsimMessages>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function merge<T>(base: T, over: unknown): T {
  if (!isObj(over)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out as T;
}

export function mergeEsimMessages(...inputs: Array<EsimMessagesInput | undefined>): EsimMessages {
  return inputs.reduce<EsimMessages>((acc, i) => merge(acc, i), ESIM_MESSAGES);
}

/** Every text as `group.key` with its English: a host's dictionary walk. */
export function flattenEsimMessages(m: EsimMessages = ESIM_MESSAGES): Record<string, string> {
  const out: Record<string, string> = {};
  const go = (v: unknown, prefix: string) => {
    if (typeof v === 'string') { out[prefix] = v; return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) go(x, prefix ? `${prefix}.${k}` : k);
  };
  go(m, '');
  return out;
}

/** The whole set from a host's dictionary: `esimMessagesFrom((key, en) => t(\`iot_esim.kit.${key}\`, en))`. */
export function esimMessagesFrom(translate: (key: string, english: string) => string): EsimMessages {
  const go = (v: unknown, prefix: string): unknown => {
    if (typeof v === 'string') return translate(prefix, v);
    if (!isObj(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = go(x, prefix ? `${prefix}.${k}` : k);
    return out;
  };
  return go(ESIM_MESSAGES, '') as EsimMessages;
}
