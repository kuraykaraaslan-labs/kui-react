/*
 * Device profile entity (docs/concepts/iot-platform/phases/01 §1.4; NB `iot_device_profile` 00–03). A profile is how a tenant wants one
 * kind of device to behave: transport and auth modes, the MQTT transport policy (OD-160), tokens in the URL (OD-161), allowed networks,
 * topic schemes and any-topic limits (OD-25, OD-35, OD-43), rate limits, the explicit online rule (OD-57, OD-63), the fallback
 * telemetry and cfg schemas and the provisioning strategy. Field names follow NB's API so a host adapter maps little. Self-contained
 * (no zod), like the other entity files; the pure rules below mirror NB's so the form refuses what the server refuses.
 */

/** LoRaWAN is listed for the hosts that have it (`iot_lorawan`); a host passes the transports it offers. */
export const PROFILE_TRANSPORTS = ['MQTT', 'HTTP', 'ANY', 'LORAWAN'] as const;
export type ProfileTransport = (typeof PROFILE_TRANSPORTS)[number];

/** Protocol 01 §4. MQTT basic is ALWAYS a username and a password: there is no client-ID-only login (OD-163). */
export const PROFILE_AUTH_MODES = ['ACCESS_TOKEN', 'MQTT_BASIC', 'X509_CERTIFICATE'] as const;
export type ProfileAuthMode = (typeof PROFILE_AUTH_MODES)[number];

/** OD-160: plain MQTT (the public 1883 listener) for the profile's devices or not. */
export const MQTT_TRANSPORT_POLICIES = ['TLS_REQUIRED', 'PLAINTEXT_ALLOWED'] as const;
export type MqttTransportPolicy = (typeof MQTT_TRANSPORT_POLICIES)[number];

/** OD-43: `ROLTEK` = the default `v1/` topics; `TB` = the ThingsBoard mapping (telemetry and attributes only, OD-85). */
export const TOPIC_SCHEMES = ['ROLTEK', 'TB'] as const;
export type TopicScheme = (typeof TOPIC_SCHEMES)[number];

/** OD-57: how "online" is decided. OD-63: always an explicit, stored choice; never derived from the transport. */
export const ONLINE_RULES = ['LIVE_SOCKET', 'UPLINK_WINDOW', 'LAST_SEEN_ONLY'] as const;
export type OnlineRule = (typeof ONLINE_RULES)[number];

export const CFG_DRIFT_POLICIES = ['REPORT', 'ENFORCE'] as const;
export type CfgDriftPolicy = (typeof CFG_DRIFT_POLICIES)[number];

/** 02 §2.1 (OD-1). A host lists the strategies it supports; the others render disabled with the reason. */
export const PROVISION_STRATEGIES = ['DISABLED', 'ALLOW_CREATE_NEW_DEVICES', 'CHECK_PRE_PROVISIONED_DEVICES', 'ROLTEK_FACTORY'] as const;
export type ProvisionStrategy = (typeof PROVISION_STRATEGIES)[number];

/** Protocol 09 §2: one limit string per family, `count:seconds[,count:seconds]*`. */
export const RATE_LIMIT_FAMILIES = ['telemetry_msgs', 'telemetry_points', 'attr_msgs', 'attr_requests', 'rpc_msgs', 'csr', 'connects'] as const;
export type RateLimitFamily = (typeof RATE_LIMIT_FAMILIES)[number];
export type ProfileRateLimits = Record<RateLimitFamily, string>;

export const DEFAULT_RATE_LIMITS: Readonly<ProfileRateLimits> = Object.freeze({
  telemetry_msgs: '10:1,300:60',
  telemetry_points: '200:1,6000:60',
  attr_msgs: '5:1,60:60',
  attr_requests: '5:1,60:60',
  rpc_msgs: '5:1,60:60',
  csr: '1:3600',
  connects: '6:60',
});

/** Validation ranges of the numeric settings (NB `PROFILE_RANGES`, 01 §1.1, §1.1b, OD-35). */
export const PROFILE_RANGES = {
  maxTopicDepth: { min: 1, max: 16 },
  maxTopicLength: { min: 16, max: 256 },
  maxDistinctTopicsPerDevice: { min: 1, max: 1000 },
  rawMaxBytes: { min: 256, max: 65536 },
  payloadMaxBytes: { min: 1024, max: 65536 },
  downlinkMaxBytes: { min: 1024, max: 65536 },
  inactivityTimeoutSec: { min: 10, max: 604_800 },
  maxGatewayChildren: { min: 0, max: 10_000 },
  rpcTimeoutDefaultSec: { min: 1, max: 300 },
  replayMsgsPerS: { min: 1, max: 10_000 },
  expectedIntervalS: { min: 60, max: 604_800 },
  onlineWindowFactor: { min: 1.5, max: 10 },
  maxInflightMessages: { min: 1, max: 1000 },
} as const;
export type ProfileRangeKey = keyof typeof PROFILE_RANGES;

/** The most networks one profile may pin (NB `maxAllowedNetworks`). */
export const MAX_ALLOWED_NETWORKS = 64;

/** One fallback telemetry key (01 §1.1; used when the firmware's `profile.json` is unknown, P-4). */
export type TelemetryKeySpec = {
  key: string;
  type?: 'number' | 'integer' | 'boolean' | 'string' | 'json';
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
  decimals?: number;
};

/** One fallback `cfg.*` key (FZ-27): integer, boolean or string, optionally an enum, ranges or lengths; `secret` is write-only. */
export type CfgKeySpec = {
  key: string;
  type: 'integer' | 'boolean' | 'string';
  label?: string;
  min?: number;
  max?: number;
  enum?: Array<string | number | boolean>;
  minLength?: number;
  maxLength?: number;
  secret?: boolean;
};

export type DeviceProfile = {
  profileId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  /**
   * The protocol a module ships this profile for (`isapi`, `lorawan`): it cannot be deleted and its transport cannot change, because
   * devices of that protocol are registered with it. Absent or null for a tenant's own profile.
   */
  builtinKey?: string | null;
  transportType: ProfileTransport;
  allowedAuthModes: ProfileAuthMode[];
  mqttTransport: MqttTransportPolicy;
  allowTokenInUrl: boolean;
  allowedNetworks: string[];
  rateLimits: ProfileRateLimits;
  replayMsgsPerS: number | null;
  downlinkMaxBytes: number;
  inactivityTimeoutSec: number;
  maxGatewayChildren: number;
  rpcTimeoutDefaultSec: number;
  maxInflightMessages: number;
  topicSchemes: TopicScheme[];
  anyTopicEnabled: boolean;
  prefixKeysWithTopic: boolean;
  maxTopicDepth: number;
  maxTopicLength: number;
  maxDistinctTopicsPerDevice: number;
  rawMaxBytes: number;
  payloadMaxBytes: number;
  strictKeys: boolean;
  telemetrySchema: TelemetryKeySpec[];
  cfgSchema: CfgKeySpec[];
  cfgDriftPolicy: CfgDriftPolicy;
  onlineRule: OnlineRule;
  expectedIntervalS: number | null;
  onlineWindowFactor: number;
  provisionStrategy: ProvisionStrategy;
  /** A copy of a platform template: its key and version (`roltek-m1 v3`); the form tags the template's values. */
  template?: { key: string; version: number } | null;
  /** Where the telemetry and cfg schemas come from: a firmware's `profile.json` makes the tables read-only (P-4). */
  schemaSource?: { kind: 'firmware'; label: string } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** The editable part of a profile. `onlineRule` is null on a blank draft (OD-63: nothing preselected). */
export type DeviceProfileDraft = Omit<DeviceProfile, 'profileId' | 'isDefault' | 'builtinKey' | 'onlineRule' | 'template' | 'schemaSource' | 'createdAt' | 'updatedAt'> & {
  onlineRule: OnlineRule | null;
};

/** What a create or an edit sends: a create always carries a name and an explicit online rule. */
export type DeviceProfileInput = Partial<Omit<DeviceProfileDraft, 'onlineRule' | 'rateLimits'>> & {
  onlineRule?: OnlineRule;
  /** The families left out keep what is stored (a create: the protocol default). */
  rateLimits?: Partial<ProfileRateLimits>;
};

/** How much still points at a profile (the reference check: devices, alarm rules, commands, …). */
export type DeviceProfileReference = { moduleId: string; count: number; label: string };
export type DeviceProfileUsage = {
  /** The devices of the profile; null when the host cannot count them. */
  devices: number | null;
  references: DeviceProfileReference[];
  /** Modules that could not be asked (a delete is refused while any is listed). */
  unverifiable?: string[];
};

/**
 * What another module still reads among some telemetry keys of a profile (NB `iot_device_profile:key_usage`: the alarm rules, …):
 * `count` items (rules) of `label` read `keys`; `canRename` when the viewer may rewrite them to new key names.
 */
export type ProfileKeyUsage = {
  moduleId: string;
  label: string;
  count: number;
  keys: string[];
  canRename: boolean;
};

/** The most keys one key-usage question names (NB `KEY_USAGE_MAX_KEYS`): a save that removed more is not asked about. */
export const KEY_USAGE_MAX_KEYS = 100;

/**
 * Where each row of an edited key table came from: the index of its row in the saved table, or -1 for a row added since. `prev` and
 * `next` are the table before and after one change of the key table (it edits a row in place, appends a row or removes one), `origins`
 * the rows' origins before it. A change of any other shape (a table replaced at once) loses every origin: no row is then taken for a
 * saved one.
 */
export function nextKeyOrigins(prev: readonly TelemetryKeySpec[], next: readonly TelemetryKeySpec[], origins: readonly number[]): number[] {
  if (origins.length !== prev.length) return next.map(() => -1);
  if (next.length === prev.length) return [...origins];
  if (next.length === prev.length + 1 && prev.every((k, i) => next[i] === k)) return [...origins, -1];
  if (next.length === prev.length - 1) {
    let gone = prev.findIndex((k, i) => next[i] !== k);
    if (gone < 0) gone = prev.length - 1;
    if (next.every((k, i) => k === prev[i < gone ? i : i + 1])) return origins.filter((_, i) => i !== gone);
  }
  return next.map(() => -1);
}

/**
 * The telemetry keys an edit removed, and the ones it renamed in place: a row of the saved table (`origins[i]`, see `nextKeyOrigins`)
 * whose key changed from a key that is gone to a key that is new (`temp` → `temperature` on the same row). Without the rows' origins
 * nothing is taken for a rename: a removed row shifts the rows after it, and a guess by position would rename the wrong key.
 */
export function telemetryKeyChanges(base: readonly TelemetryKeySpec[], draft: readonly TelemetryKeySpec[], origins?: readonly number[]): { removed: string[]; renames: Record<string, string> } {
  const before = new Set(base.map((k) => k.key).filter(Boolean));
  const after = new Set(draft.map((k) => k.key).filter(Boolean));
  const removed = [...before].filter((k) => !after.has(k));
  const renames: Record<string, string> = {};
  if (!origins || origins.length !== draft.length) return { removed, renames };
  const taken = new Set<string>();
  draft.forEach((row, i) => {
    const from = origins[i] >= 0 ? base[origins[i]]?.key : undefined;
    const to = row.key;
    if (from && to && from !== to && !after.has(from) && !before.has(to) && isTelemetryKey(to) && !taken.has(to)) {
      renames[from] = to;
      taken.add(to);
    }
  });
  return { removed, renames };
}

/** The protocol defaults of a new profile (01 §1.1, OD-35, OD-160, OD-161); the online rule is left empty (OD-63). */
export function blankProfileDraft(name = ''): DeviceProfileDraft {
  return {
    name,
    description: null,
    transportType: 'ANY',
    allowedAuthModes: ['ACCESS_TOKEN'],
    mqttTransport: 'TLS_REQUIRED',
    allowTokenInUrl: false,
    allowedNetworks: [],
    rateLimits: { ...DEFAULT_RATE_LIMITS },
    replayMsgsPerS: null,
    downlinkMaxBytes: 65536,
    inactivityTimeoutSec: 600,
    maxGatewayChildren: 500,
    rpcTimeoutDefaultSec: 10,
    maxInflightMessages: 20,
    topicSchemes: ['ROLTEK'],
    anyTopicEnabled: true,
    prefixKeysWithTopic: false,
    maxTopicDepth: 8,
    maxTopicLength: 128,
    maxDistinctTopicsPerDevice: 50,
    rawMaxBytes: 4096,
    payloadMaxBytes: 65536,
    strictKeys: false,
    telemetrySchema: [],
    cfgSchema: [],
    cfgDriftPolicy: 'REPORT',
    onlineRule: null,
    expectedIntervalS: null,
    onlineWindowFactor: 3,
    provisionStrategy: 'DISABLED',
  };
}

/** The draft of a stored profile (its own values; the stored online rule shown as it is). */
export function draftOf(p: DeviceProfile): DeviceProfileDraft {
  const { profileId: _id, isDefault: _d, builtinKey: _b, template: _t, schemaSource: _s, createdAt: _c, updatedAt: _u, ...rest } = p;
  return {
    ...rest,
    allowedAuthModes: [...p.allowedAuthModes],
    allowedNetworks: [...p.allowedNetworks],
    rateLimits: { ...DEFAULT_RATE_LIMITS, ...p.rateLimits },
    topicSchemes: [...p.topicSchemes],
    telemetrySchema: p.telemetrySchema.map((k) => ({ ...k })),
    cfgSchema: p.cfgSchema.map((k) => ({ ...k, ...(k.enum ? { enum: [...k.enum] } : {}) })),
  };
}

// ── limit strings (protocol 09 §2) ───────────────────────────────────────────────────────────────────────────────────

export type LimitWindow = { count: number; seconds: number };
export const LIMIT_COUNT_MAX = 1_000_000;
export const LIMIT_SECONDS_MAX = 86_400;
export const LIMIT_WINDOWS_MAX = 4;

/** Parses `count:seconds[,count:seconds]*` (windows strictly growing in length), or null; NB's parser, line for line. */
export function parseLimitString(raw: string): LimitWindow[] | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 64) return null;
  const parts = raw.split(',');
  if (parts.length > LIMIT_WINDOWS_MAX) return null;
  const windows: LimitWindow[] = [];
  for (const part of parts) {
    const m = /^(\d{1,7}):(\d{1,5})$/.exec(part);
    if (!m) return null;
    const count = Number(m[1]);
    const seconds = Number(m[2]);
    if (count < 1 || count > LIMIT_COUNT_MAX || seconds < 1 || seconds > LIMIT_SECONDS_MAX) return null;
    windows.push({ count, seconds });
  }
  for (let i = 1; i < windows.length; i++) if (windows[i].seconds <= windows[i - 1].seconds) return null;
  return windows;
}

export function formatLimitString(windows: readonly LimitWindow[]): string {
  return windows.map((w) => `${w.count}:${w.seconds}`).join(',');
}

// ── online rule (OD-57, OD-63) ───────────────────────────────────────────────────────────────────────────────────────

/** Why a transport cannot serve a rule, or null. The transport only FORBIDS a rule; it never picks one (OD-63). */
export function onlineRuleBlock(rule: OnlineRule, transport: ProfileTransport): 'no_socket_http' | 'no_socket_lorawan' | null {
  if (rule !== 'LIVE_SOCKET') return null;
  if (transport === 'HTTP') return 'no_socket_http';
  if (transport === 'LORAWAN') return 'no_socket_lorawan';
  return null;
}

export function allowedOnlineRules(transport: ProfileTransport): OnlineRule[] {
  return ONLINE_RULES.filter((r) => onlineRuleBlock(r, transport) === null);
}

/** Seconds after which a device of a "recent message" profile shows offline (interval × factor), or null. */
export function onlineWindowSeconds(interval: number | null | undefined, factor: number | null | undefined): number | null {
  if (!interval || interval <= 0 || !factor || factor <= 0) return null;
  return Math.round(interval * factor);
}

// ── networks (OD-160) ────────────────────────────────────────────────────────────────────────────────────────────────

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function isIpv6(s: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(s) || s.includes(':::')) return false;
  const halves = s.split('::');
  if (halves.length > 2) return false;
  const groups = halves.flatMap((h) => (h ? h.split(':') : []));
  if (groups.some((g) => g.length < 1 || g.length > 4)) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

/** An IPv4 or IPv6 network in CIDR notation or a single address, in the strict spellings NB accepts (no IPv4 inside IPv6). */
export function isNetwork(raw: string): boolean {
  const s = raw.trim();
  const [addr, prefix, extra] = s.split('/');
  if (extra !== undefined || !addr) return false;
  const v4 = IPV4.test(addr);
  const v6 = !v4 && isIpv6(addr);
  if (!v4 && !v6) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix) || (prefix.length > 1 && prefix.startsWith('0'))) return false;
  return Number(prefix) <= (v4 ? 32 : 128);
}

// ── whole-draft checks ───────────────────────────────────────────────────────────────────────────────────────────────

export type ProfileIssue =
  | 'name_required' | 'online_rule_required' | 'online_rule_not_allowed' | 'expected_interval_required' | 'out_of_range'
  | 'auth_mode_required' | 'topic_scheme_required' | 'raw_exceeds_payload' | 'invalid_limit' | 'invalid_network' | 'too_many_networks'
  | 'duplicate_key' | 'invalid_key';

const TELEMETRY_KEY = /^[A-Za-z0-9_.-]{1,64}$/;
const RESERVED_TELEMETRY_KEY = /^(_|fw_|current_fw_|cfg\.)/;
const CFG_KEY = /^cfg\.[A-Za-z0-9_.-]{1,124}$/;

export function isTelemetryKey(k: string): boolean {
  return TELEMETRY_KEY.test(k) && !RESERVED_TELEMETRY_KEY.test(k);
}
export function isCfgKey(k: string): boolean {
  return CFG_KEY.test(k);
}

const inRange = (v: number | null | undefined, key: ProfileRangeKey) => typeof v === 'number' && Number.isFinite(v) && v >= PROFILE_RANGES[key].min && v <= PROFILE_RANGES[key].max;

/**
 * Everything the server would refuse in a draft, by field (an empty object = valid). The online rule is required and must be one the
 * transport allows (OD-63: the form blocks Save, the server refuses with `online_rule_not_allowed` too).
 */
export function profileDraftIssues(d: DeviceProfileDraft): Partial<Record<string, ProfileIssue>> {
  const out: Partial<Record<string, ProfileIssue>> = {};
  if (!d.name.trim()) out.name = 'name_required';
  if (!d.onlineRule) out.onlineRule = 'online_rule_required';
  else if (onlineRuleBlock(d.onlineRule, d.transportType)) out.onlineRule = 'online_rule_not_allowed';
  if (d.onlineRule === 'UPLINK_WINDOW') {
    if (d.expectedIntervalS === null || d.expectedIntervalS === undefined) out.expectedIntervalS = 'expected_interval_required';
    else if (!inRange(d.expectedIntervalS, 'expectedIntervalS') || !Number.isInteger(d.expectedIntervalS)) out.expectedIntervalS = 'out_of_range';
  }
  if (!inRange(d.onlineWindowFactor, 'onlineWindowFactor') || Math.abs(Math.round(d.onlineWindowFactor * 10) - d.onlineWindowFactor * 10) > 1e-9) out.onlineWindowFactor = 'out_of_range';
  if (!d.allowedAuthModes.length) out.allowedAuthModes = 'auth_mode_required';
  if (!d.topicSchemes.length) out.topicSchemes = 'topic_scheme_required';
  const ints: ProfileRangeKey[] = ['maxTopicDepth', 'maxTopicLength', 'maxDistinctTopicsPerDevice', 'rawMaxBytes', 'payloadMaxBytes', 'downlinkMaxBytes',
    'inactivityTimeoutSec', 'maxGatewayChildren', 'rpcTimeoutDefaultSec', 'maxInflightMessages'];
  for (const k of ints) {
    const v = d[k as keyof DeviceProfileDraft] as number;
    if (!inRange(v, k) || !Number.isInteger(v)) out[k] = 'out_of_range';
  }
  if (d.replayMsgsPerS !== null && (!inRange(d.replayMsgsPerS, 'replayMsgsPerS') || !Number.isInteger(d.replayMsgsPerS))) out.replayMsgsPerS = 'out_of_range';
  if (!out.rawMaxBytes && !out.payloadMaxBytes && d.rawMaxBytes > d.payloadMaxBytes) out.rawMaxBytes = 'raw_exceeds_payload';
  for (const f of RATE_LIMIT_FAMILIES) if (!parseLimitString(d.rateLimits[f] ?? '')) out[`rateLimits.${f}`] = 'invalid_limit';
  if (d.allowedNetworks.length > MAX_ALLOWED_NETWORKS) out.allowedNetworks = 'too_many_networks';
  else if (d.allowedNetworks.some((n) => !isNetwork(n) || (n.includes(':') && n.includes('.')))) out.allowedNetworks = 'invalid_network';
  const tKeys = d.telemetrySchema.map((k) => k.key);
  if (tKeys.some((k) => !isTelemetryKey(k))) out.telemetrySchema = 'invalid_key';
  else if (new Set(tKeys).size !== tKeys.length) out.telemetrySchema = 'duplicate_key';
  const cKeys = d.cfgSchema.map((k) => k.key);
  if (cKeys.some((k) => !isCfgKey(k))) out.cfgSchema = 'invalid_key';
  else if (new Set(cKeys).size !== cKeys.length) out.cfgSchema = 'duplicate_key';
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The fields of `draft` that differ from `base` (what an edit sends; an untouched field is left out). */
export function profilePatch(base: DeviceProfileDraft, draft: DeviceProfileDraft): DeviceProfileInput {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(draft) as Array<keyof DeviceProfileDraft>) {
    if (!same(base[k], draft[k])) out[k] = draft[k];
  }
  if (out.rateLimits) {
    const changed: Record<string, string> = {};
    for (const f of RATE_LIMIT_FAMILIES) if (base.rateLimits[f] !== draft.rateLimits[f]) changed[f] = draft.rateLimits[f];
    out.rateLimits = changed;
  }
  return out as DeviceProfileInput;
}
