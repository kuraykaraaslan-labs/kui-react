/*
 * Every text of the rate-limits drawer, in English. A host passes translations as `RateLimitsMessagesInput` (a group may be partial) or
 * builds the whole set from its dictionary with `rateLimitsMessagesFrom`. `{name}` placeholders are filled by the view.
 */

export const RATE_LIMITS_MESSAGES = {
  action: { open: 'Rate limits', title: 'Rate limits' },
  common: { loading: 'Loading…', retry: 'Try again', close: 'Close', none: 'None', unknownError: 'The limits could not be read: {message}' },
  device: {
    title: 'This device',
    intro: 'How much this device may send. Over a limit, the gateway drops the message and the device page counts it.',
    family: 'Kind',
    limit: 'Limit',
    source: 'Set by',
    mode: 'Applied',
    search: 'Search kinds',
    empty: 'No limits.',
  },
  family: {
    telemetry_msgs: 'Telemetry messages',
    telemetry_points: 'Telemetry values',
    attr_msgs: 'Attribute messages',
    rpc_msgs: 'Command messages',
    attr_requests: 'Attribute requests',
    csr: 'Certificate renewals',
    connects: 'Connections',
  },
  window: { perSecond: '{count} a second', perMinute: '{count} a minute', perHour: '{count} an hour', perSeconds: '{count} per {seconds} s', join: ', ' },
  source: { profile: 'Device profile', default: 'Default' },
  mode: {
    enforced: 'Refused over the limit',
    observed: 'Counted only',
    off: 'Off on the gateway',
    unknown: 'Not known',
    observedHint: '"Counted only" kinds are measured but nothing is refused until the platform operator turns them on.',
  },
  tenant: {
    title: 'The whole workspace',
    intro: 'What your plan allows all devices together. None means the plan sets no limit.',
    key: 'Limit',
    value: 'Plan',
    msgsPerSecond: 'Messages a second',
    telemetryMsgsPerSecond: 'Telemetry messages a second',
    pointsPerMinute: 'Telemetry values a minute',
    connectedDevices: 'Devices connected at once',
    connectsPerMinute: 'Connections a minute',
    zero: 'None allowed',
  },
  gateway: {
    on: 'The gateway applies these limits now.',
    off: 'Rate limiting is switched off on the gateway: nothing is refused.',
    unknown: 'No gateway reported its settings, so "Applied" is not known.',
  },
};

export type RateLimitsMessages = typeof RATE_LIMITS_MESSAGES;
type Deep<T> = { [K in keyof T]?: T[K] extends string ? string : Deep<T[K]> };
export type RateLimitsMessagesInput = Deep<RateLimitsMessages>;

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

export function mergeRateLimitsMessages(...inputs: Array<RateLimitsMessagesInput | undefined>): RateLimitsMessages {
  return inputs.reduce<RateLimitsMessages>((acc, i) => merge(acc, i), RATE_LIMITS_MESSAGES);
}

/** Every text as `group.key` with its English: a host's dictionary walk. */
export function flattenRateLimitsMessages(m: RateLimitsMessages = RATE_LIMITS_MESSAGES): Record<string, string> {
  const out: Record<string, string> = {};
  const go = (v: unknown, prefix: string) => {
    if (typeof v === 'string') { out[prefix] = v; return; }
    if (isObj(v)) for (const [k, x] of Object.entries(v)) go(x, prefix ? `${prefix}.${k}` : k);
  };
  go(m, '');
  return out;
}

/** The whole set from a host's dictionary: `rateLimitsMessagesFrom((key, en) => t(\`iot_gateway.kit.limits.${key}\`, en))`. */
export function rateLimitsMessagesFrom(translate: (key: string, english: string) => string): RateLimitsMessages {
  const go = (v: unknown, prefix: string): unknown => {
    if (typeof v === 'string') return translate(prefix, v);
    if (!isObj(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = go(x, prefix ? `${prefix}.${k}` : k);
    return out;
  };
  return go(RATE_LIMITS_MESSAGES, '') as RateLimitsMessages;
}
