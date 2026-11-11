/*
 * Device profile entity (docs/concepts/iot-platform/phases/01 §1.4; NB `iot_device_profile` 00–03). A profile is how a tenant wants one
 * kind of device to behave: transport and auth modes, the MQTT transport policy (OD-160), tokens in the URL (OD-161), allowed networks,
 * topic schemes and any-topic limits (OD-25, OD-35, OD-43), rate limits, the explicit online rule (OD-57, OD-63), the fallback
 * telemetry and cfg schemas and the provisioning strategy. Field names follow NB's API so a host adapter maps little. Self-contained
 * (no zod), like the other entity files; the pure rules below mirror NB's so the form refuses what the server refuses.
 */

/** The built-in transports (devices reach the platform themselves). LoRaWAN is listed for the hosts that have it; a host passes the transports it offers. */
export const PROFILE_TRANSPORTS = ['MQTT', 'HTTP', 'ANY', 'LORAWAN'] as const;
export type BuiltinProfileTransport = (typeof PROFILE_TRANSPORTS)[number];
/**
 * A profile's transport: a built-in, or the id of a protocol the host polls (NB `iot_gateway:protocol`: `snmp`, `isapi`, `rtsp`, lower case,
 * OD-177). The kit names no protocol: the host lists the ones it has (`profiles.transportOptions`) with their labels.
 */
export type ProfileTransport = BuiltinProfileTransport | (string & {});
/**
 * One choice of the transport select: the value, its label in the app language, whether the platform polls its devices, and whether its
 * devices log in to the platform themselves (`deviceCredentials`: an access token, MQTT basic or a certificate; NB iot-device-profile D436).
 * A host sets `deviceCredentials: false` for a transport whose devices reach it another way (NB: LoRaWAN radios and gateways, which a
 * network server brings in); absent means they do, for a built-in.
 */
export type ProfileTransportOption = { value: ProfileTransport; label: string; polled?: boolean; deviceCredentials?: boolean };

export const isBuiltinTransport = (t: string): t is BuiltinProfileTransport => (PROFILE_TRANSPORTS as readonly string[]).includes(t);
/**
 * A polled transport: a lower-case value, the id of a protocol the host polls (NB `iot_gateway:protocol`, OD-177); no socket, no uplink
 * window, the platform asks the device (NB iot-gateway 13.3). Built-ins and a host's other transports are upper case (NB's `LORAWAN_GATEWAY`),
 * so the answer needs no list and holds for a value the host no longer offers (NB iot-device-profile D435).
 */
export const isPolledTransport = (t: string): boolean => /^[a-z]/.test(t);

/**
 * Whether the devices of a transport log in to the platform themselves, so the profile's MQTT, token, network, authentication and topic
 * settings apply. Never for a polled transport; for another one the host's option says (`deviceCredentials`); without an option a kit
 * built-in does and any other value does not (a transport nobody vouches for gets no login settings).
 */
export function transportLogsIn(t: ProfileTransport, known: readonly ProfileTransportOption[] = []): boolean {
  if (isPolledTransport(t)) return false;
  const o = known.find((k) => k.value === t);
  if (o && o.deviceCredentials !== undefined) return o.deviceCredentials;
  return isBuiltinTransport(t);
}

/**
 * The choices of the transport select: the offered ones (built-ins labelled by the kit's texts, a host option with its own label), and the
 * profile's current value even when it is not offered (a protocol whose module is gone, a built-in the host does not offer), labelled by
 * the host's option or the value itself. Never a duplicate.
 */
export function transportChoices(
  offered: readonly (ProfileTransport | ProfileTransportOption)[],
  builtinLabel: (t: BuiltinProfileTransport) => string,
  current?: ProfileTransport | null,
  known: readonly ProfileTransportOption[] = [],
): ProfileTransportOption[] {
  const out: ProfileTransportOption[] = [];
  const label = (t: string) => transportLabel(t, builtinLabel, known);
  for (const o of offered) {
    const opt = typeof o === 'string' ? { value: o, label: label(o), polled: isPolledTransport(o) } : { polled: isPolledTransport(o.value), ...o };
    if (!out.some((x) => x.value === opt.value)) out.push(opt);
  }
  if (current && !out.some((x) => x.value === current)) out.push({ value: current, label: label(current), polled: isPolledTransport(current) });
  return out;
}

/** A transport in words: the host's option label, the kit's text for a built-in, else the protocol id in capitals (`snmp` → SNMP). */
export function transportLabel(t: ProfileTransport, builtinLabel: (t: BuiltinProfileTransport) => string, known: readonly ProfileTransportOption[] = []): string {
  return known.find((k) => k.value === t)?.label ?? (isBuiltinTransport(t) ? builtinLabel(t) : t.toUpperCase());
}

/** Protocol 01 §4. MQTT basic is ALWAYS a username and a password: there is no client-ID-only login (OD-163). */
export const PROFILE_AUTH_MODES = ['ACCESS_TOKEN', 'MQTT_BASIC', 'X509_CERTIFICATE'] as const;
export type ProfileAuthMode = (typeof PROFILE_AUTH_MODES)[number];

/** OD-160: plain MQTT (the public 1883 listener) for the profile's devices or not. */
export const MQTT_TRANSPORT_POLICIES = ['TLS_REQUIRED', 'PLAINTEXT_ALLOWED'] as const;
export type MqttTransportPolicy = (typeof MQTT_TRANSPORT_POLICIES)[number];

/** OD-43: `ROLTEK` = the default `v1/` topics; `TB` = the Legacy mapping (telemetry and attributes only, OD-85). */
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

/**
 * 02 §2.1b / §2.2 (OD-1): a profile's provisioning keys. Rotation makes a new `active` key and turns the previous one `retired` (still
 * accepted until `graceUntil`; a factory key keeps no grace and stays accepted for the units written with it); revocation is immediate
 * and final. States only move forward. The key itself is not secret; its secret is never part of a key row.
 */
export const PROVISION_KEY_STATES = ['active', 'retired', 'revoked'] as const;
export type ProvisionKeyState = (typeof PROVISION_KEY_STATES)[number];

export type ProvisionKey = {
  /** The readable key id (`roltek-m1-k2`, `pk-3f9a01bc`): what a revocation is confirmed with. */
  provisionKeyId: string;
  /** The provisioning key a device sends (`pk_` + 16 hex). Not secret. */
  provisionKey: string;
  state: ProvisionKeyState;
  createdAt: Date | string;
  /** A retired key is accepted until then; null = no end (a factory key: accepted for the units written with it). */
  graceUntil?: Date | string | null;
  retiredAt?: Date | string | null;
  revokedAt?: Date | string | null;
  revocationReason?: string | null;
  /** When a device last used it, when the host records it. */
  lastUsedAt?: Date | string | null;
};

/** What the provisioning keys panel reads: the keys (newest first) and what the host can do for this profile. */
export type ProvisioningInfo = {
  keys: ProvisionKey[];
  /** The strategies the host can serve for this profile (always includes `DISABLED`). */
  availableStrategies: ProvisionStrategy[];
  /** The grace a rotation may give the previous key, in days; null = none (a factory profile: the old key stays for its own units). */
  rotationGrace: { min: number; max: number; default: number } | null;
};

/** A rotation's answer: the new key row and its secret, returned this once and never again. */
export type IssuedProvisionKey = {
  key: ProvisionKey;
  provisionSecret: string;
};

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
/** OD-160 (gateway 12 §10): at most this many methods in `plaintextRpcMethods`, each an exact wire name (the host's pattern). */
export const MAX_PLAINTEXT_RPC_METHODS = 32;
export const PLAINTEXT_RPC_METHOD_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
/** OD-8: never sent at all, so never on the plaintext list. */
export const NEVER_IN_CLEAR_METHODS: readonly string[] = ['sys.factory_reset'];
export const isPlaintextRpcMethod = (m: string): boolean => PLAINTEXT_RPC_METHOD_RE.test(m) && !NEVER_IN_CLEAR_METHODS.includes(m);

/**
 * One fallback telemetry key (01 §1.1; used when the firmware's `profile.json` is unknown, P-4). A host may store more on a key than
 * the table edits (`quantity`, or a field a later host adds): an edit keeps every such field as it is.
 */
export type TelemetryKeySpec = {
  key: string;
  type?: 'number' | 'integer' | 'boolean' | 'string' | 'json';
  unit?: string;
  label?: string;
  min?: number;
  max?: number;
  decimals?: number;
  /** OD-114: a reference into the router-owned quantity vocabulary (`{ id, version }`); kept, never edited here. */
  quantity?: { id: string; version: string };
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
  /**
   * OD-160 (gateway 12 §10): the RPC methods, exact wire names, that may go to a device over plain MQTT or a plain HTTP poll; every
   * other command waits for TLS. Empty = none. `sys.factory_reset` never (OD-8). Shared `fw_*` and `cfg.*` never go in clear (D222).
   */
  plaintextRpcMethods: string[];
  /**
   * NB 63-licensed-devices LD-2 / LD-7: every command may go to a device in clear, except certificate (`cert.*`), remote access
   * (`tunnel.*`) and eSIM (`esim.*`) commands, which still have to be named in `plaintextRpcMethods`. Off by default. A host without
   * the field reads as off.
   */
  plaintextAllCommands: boolean;
  rateLimits: ProfileRateLimits;
  replayMsgsPerS: number | null;
  downlinkMaxBytes: number;
  inactivityTimeoutSec: number;
  maxGatewayChildren: number;
  /**
   * NB OD-119 step 2 (iot_device_profile D417): on a gateway's profile, the profile its new children get when their type names none; null
   * (or absent) = the host's generic child profile. A host without the field leaves it out.
   */
  defaultChildProfileId?: string | null;
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
  /**
   * The profile IS a platform template (`roltek-m1 v3`): it cannot be deleted (it is unmarked first) and only a viewer with
   * `canManageTemplates` edits it. Absent or null for every other profile.
   */
  platformTemplate?: { key: string; version: number } | null;
  /**
   * The stored row's version, when the host keeps one: an edit sends the version it started from (`expectedVersion`) and a host refuses
   * it (code `stale`) when someone saved the profile in between, so two editors never overwrite each other's rows.
   */
  version?: number;
  /** Where the telemetry and cfg schemas come from: a firmware's `profile.json` makes the tables read-only (P-4). */
  schemaSource?: { kind: 'firmware'; label: string } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** The editable part of a profile. `onlineRule` is null on a blank draft (OD-63: nothing preselected). */
export type DeviceProfileDraft = Omit<DeviceProfile, 'profileId' | 'isDefault' | 'builtinKey' | 'onlineRule' | 'template' | 'platformTemplate' | 'version' | 'schemaSource' | 'createdAt' | 'updatedAt'> & {
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
    plaintextRpcMethods: [],
    plaintextAllCommands: false,
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
  const { profileId: _id, isDefault: _d, builtinKey: _b, template: _t, platformTemplate: _pt, version: _v, schemaSource: _s, createdAt: _c, updatedAt: _u, ...rest } = p;
  return {
    ...rest,
    allowedAuthModes: [...p.allowedAuthModes],
    allowedNetworks: [...p.allowedNetworks],
    plaintextRpcMethods: [...(p.plaintextRpcMethods ?? [])],
    plaintextAllCommands: p.plaintextAllCommands === true,
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

/**
 * Why a transport cannot serve a rule, or null. The transport only FORBIDS a rule; it never picks one (OD-63). A polled transport (NB
 * iot-gateway 13.3) has no socket and no uplink window: only "Last seen only" fits.
 */
export function onlineRuleBlock(rule: OnlineRule, transport: ProfileTransport): 'no_socket_http' | 'no_socket_lorawan' | 'polled_last_seen_only' | null {
  if (isPolledTransport(transport)) return rule === 'LAST_SEEN_ONLY' ? null : 'polled_last_seen_only';
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
  | 'duplicate_key' | 'invalid_key' | 'invalid_method' | 'too_many_methods' | 'duplicate_method'
  | 'invalid_value' | 'whole_number' | 'min_exceeds_max' | 'too_long' | 'invalid_enum' | 'too_many_values' | 'too_many_keys';

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
  if (d.plaintextRpcMethods.length > MAX_PLAINTEXT_RPC_METHODS) out.plaintextRpcMethods = 'too_many_methods';
  else if (d.plaintextRpcMethods.some((x) => !isPlaintextRpcMethod(x))) out.plaintextRpcMethods = 'invalid_method';
  else if (new Set(d.plaintextRpcMethods).size !== d.plaintextRpcMethods.length) out.plaintextRpcMethods = 'duplicate_method';
  const tKeys = d.telemetrySchema.map((k) => k.key);
  if (tKeys.length > SCHEMA_MAX_KEYS) out.telemetrySchema = 'too_many_keys';
  else if (tKeys.some((k) => !isTelemetryKey(k))) out.telemetrySchema = 'invalid_key';
  else if (new Set(tKeys).size !== tKeys.length) out.telemetrySchema = 'duplicate_key';
  d.telemetrySchema.forEach((k, i) => telemetryKeyIssues(k, `telemetrySchema.${i}.`, out));
  const cKeys = d.cfgSchema.map((k) => k.key);
  if (cKeys.length > SCHEMA_MAX_KEYS) out.cfgSchema = 'too_many_keys';
  else if (cKeys.some((k) => !isCfgKey(k))) out.cfgSchema = 'invalid_key';
  else if (new Set(cKeys).size !== cKeys.length) out.cfgSchema = 'duplicate_key';
  d.cfgSchema.forEach((k, i) => cfgKeyIssues(k, `cfgSchema.${i}.`, out));
  return out;
}

/** The most keys one schema table holds (NB's DTO). */
export const SCHEMA_MAX_KEYS = 500;
/** The most allowed values one cfg key lists, and the longest text value (NB's DTO). */
export const CFG_ENUM_MAX = 100;
export const CFG_ENUM_TEXT_MAX = 256;
/** The longest unit and label of a key, and the longest cfg string length setting (NB's DTO). */
export const KEY_UNIT_MAX = 32;
export const KEY_LABEL_MAX = 128;
export const CFG_LENGTH_MAX = 4096;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const tooLong = (v: unknown, max: number) => v !== undefined && (typeof v !== 'string' || v.length > max);

/**
 * What the host refuses in one telemetry key row, keyed by its full path (`telemetrySchema.3.decimals`), so the table marks the cell
 * and the form blocks Save: unit and label lengths, finite bounds, decimals a whole number 0-10, min not above max.
 */
export function telemetryKeyIssues(k: TelemetryKeySpec, at: string, out: Partial<Record<string, ProfileIssue>> = {}): Partial<Record<string, ProfileIssue>> {
  if (tooLong(k.unit, KEY_UNIT_MAX)) out[`${at}unit`] = 'too_long';
  if (tooLong(k.label, KEY_LABEL_MAX)) out[`${at}label`] = 'too_long';
  if (k.min !== undefined && !finite(k.min)) out[`${at}min`] = 'invalid_value';
  if (k.max !== undefined && !finite(k.max)) out[`${at}max`] = 'invalid_value';
  if (k.decimals !== undefined) {
    if (!finite(k.decimals) || !Number.isInteger(k.decimals)) out[`${at}decimals`] = 'whole_number';
    else if (k.decimals < 0 || k.decimals > 10) out[`${at}decimals`] = 'out_of_range';
  }
  if (finite(k.min) && finite(k.max) && k.min > k.max && !out[`${at}min`]) out[`${at}min`] = 'min_exceeds_max';
  return out;
}

/** Whether an allowed value fits a cfg key's type (a whole number, true / false, or a text of at most 256 characters). */
export function isCfgEnumValue(v: unknown, type: CfgKeySpec['type']): boolean {
  if (type === 'integer') return typeof v === 'number' && Number.isInteger(v);
  if (type === 'boolean') return typeof v === 'boolean';
  return typeof v === 'string' && v.length <= CFG_ENUM_TEXT_MAX;
}

/**
 * What the host refuses in one cfg key row, by full path (`cfgSchema.2.enum`): the label's length, whole-number bounds and lengths
 * (0-4096) with min not above max, and allowed values that fit the type (a value list that did not parse is kept as typed and
 * refused here, never dropped), at most 100 of them.
 */
export function cfgKeyIssues(k: CfgKeySpec, at: string, out: Partial<Record<string, ProfileIssue>> = {}): Partial<Record<string, ProfileIssue>> {
  if (tooLong(k.label, KEY_LABEL_MAX)) out[`${at}label`] = 'too_long';
  const whole = (f: 'min' | 'max' | 'minLength' | 'maxLength') => {
    const v = k[f];
    if (v === undefined) return;
    if (!finite(v) || !Number.isInteger(v)) out[`${at}${f}`] = 'whole_number';
    else if ((f === 'minLength' || f === 'maxLength') && (v < 0 || v > CFG_LENGTH_MAX)) out[`${at}${f}`] = 'out_of_range';
  };
  (['min', 'max', 'minLength', 'maxLength'] as const).forEach(whole);
  if (finite(k.min) && finite(k.max) && k.min > k.max && !out[`${at}min`]) out[`${at}min`] = 'min_exceeds_max';
  if (finite(k.minLength) && finite(k.maxLength) && k.minLength > k.maxLength && !out[`${at}minLength`]) out[`${at}minLength`] = 'min_exceeds_max';
  if (k.enum !== undefined) {
    if (!Array.isArray(k.enum) || k.enum.some((v) => !isCfgEnumValue(v, k.type))) out[`${at}enum`] = 'invalid_enum';
    else if (k.enum.length > CFG_ENUM_MAX) out[`${at}enum`] = 'too_many_values';
  }
  return out;
}

/**
 * The fields of a profile its devices are admitted by (NB's admission snapshot): transport, plain MQTT, URL tokens, networks, auth
 * modes, topic schemes and custom-topic limits, payload caps and rate limits. Saving a change to any of them ends the live sessions
 * that no longer qualify, so the form asks first when devices use the profile.
 */
export const PROFILE_ADMISSION_FIELDS = [
  'transportType', 'mqttTransport', 'allowTokenInUrl', 'allowedNetworks', 'allowedAuthModes', 'topicSchemes', 'anyTopicEnabled',
  'prefixKeysWithTopic', 'maxTopicDepth', 'maxTopicLength', 'maxDistinctTopicsPerDevice', 'rawMaxBytes', 'payloadMaxBytes',
  'downlinkMaxBytes', 'maxInflightMessages', 'rateLimits', 'plaintextRpcMethods', 'replayMsgsPerS', 'plaintextAllCommands',
] as const satisfies ReadonlyArray<keyof DeviceProfileDraft>;

/** Whether an edit's patch touches what the profile's devices are admitted by. */
export function touchesAdmission(patch: DeviceProfileInput): boolean {
  return PROFILE_ADMISSION_FIELDS.some((f) => patch[f] !== undefined);
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
