/** The LoRaWAN rows the components draw (NB iot_lorawan's API shapes; no key, no token hash). */
export type LoraGatewayRow = {
  gatewayId: string;
  /** The device the gateway is (NB: every gateway is an `iot_device`; a Roltek router's own device for the Roltek link). */
  deviceId?: string;
  name: string;
  eui: string;
  protocol: 'BASICS_STATION' | 'ROLTEK_LINK';
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  region: string;
  /** `CLOUD`: the cloud network server schedules on it; `LOCAL`: informational, a network server on the gateway itself. */
  mode?: 'CLOUD' | 'LOCAL' | string;
  lastSeenAt: string | null;
  live?: { online: boolean; rttMs: number | null; connectedAt: number | null };
  /** Where the gateway stands (the map); null until someone places it. */
  latitude?: number | null;
  longitude?: number | null;
  /** Metres above sea level, when the host knows it. */
  altitude?: number | null;
};

export type LoraJoinState = { state: string; reason?: string; at: number } | null;

/** The Join filter's values (`loraJoinStateOf`): the last join accepted, refused, or none yet. */
export type LoraJoinFilter = 'joined' | 'refused' | 'never';

export type LoraDeviceRow = {
  deviceId: string;
  name: string | null;
  devEui: string;
  joinEui: string;
  class: 'A' | 'C';
  macVersion: string;
  lastJoin: LoraJoinState;
  session?: { devAddr: string; fCntUp: number | null; fCntDown: number; lastUplinkAt: string | null; status: string } | null;
  /** When the device was added (ISO); the list's Added column. */
  createdAt?: string;
};

export type LoraFrameRow = {
  t: number;
  type: 'up' | 'cup' | 'join' | 'join_accept' | 'down' | 'dropped' | string;
  result: 'processed' | 'dropped' | 'retransmission' | 'sent' | string;
  reason?: string;
  deviceId?: string;
  /** The device's name as the host's frames read returns it (NB: one read of the frames' devices), so a device that is not on the page is named too. */
  deviceName?: string;
  devEui?: string;
  devAddr?: string;
  fCnt?: number;
  fPort?: number;
  dr?: number;
  freq?: number;
  gateways: Array<{ gatewayId: string; eui: string; rssi: number; snr: number }>;
  chosenGatewayId?: string;
  window?: string;
  decoded?: Record<string, unknown>;
  bytes?: number;
};

export type LoraSetup = { lnsUrl: string | null; routerInfoUrl: string | null; trustAvailable: boolean };

/** A Station token just issued (shown once) and the files that carry it. */
export type LoraIssuedToken = { token: string; files: Array<{ name: string; content: string }> | null };

export type LoraGatewayInput = { name: string; eui: string; region: 'EU868' };
export type LoraDeviceInput = { name: string; devEui: string; joinEui: string; appKey: string; macVersion: '1.0.2' | '1.0.3' | '1.0.4'; class: 'A' | 'C' };

/** A codec in the list (NB iot_lorawan_codecs `GET /api/iot/lorawan/codec-library`): a library codec (`public`) or the tenant's own (`tenant`, id `t.<slug>`). */
export type LoraCodecRow = {
  id: string;
  title: string;
  vendor: string;
  models: string[];
  fports: number[];
  oui: string[];
  kind: 'tlv' | 'layout' | string;
  origin: string;
  verified: boolean;
  rev: number;
  updatedAt: string;
  scope: 'public' | 'tenant';
  /** `PUBLISHED`, or `WITHDRAWN` for a library codec the platform took out (the root view only). */
  status: string;
};

/** One codec as the codecs API returns it: the current rev's document (the roltek-lns table format) and its output set (key → unit). */
export type LoraCodecDoc = {
  id: string;
  rev: number;
  sha256: string;
  scope: 'public' | 'tenant';
  document: Record<string, unknown>;
  outputSet: Record<string, string | null>;
  status?: string;
  withdrawnReason?: string | null;
};

export type LoraCodecRevisionRow = { rev: number; sha256: string; size: number; publishedAt: string; keys: number };

/** One frame through a codec (the test bench): decoded fields, their units, the flattened keys, warnings and errors. */
export type LoraBenchFrame = {
  fields: Record<string, unknown> | null;
  units: Record<string, string>;
  keys: Record<string, string | null>;
  warnings?: string[];
  errors?: string[];
  rest?: string;
};

/** Why a codec was not published (NB's publish checks): a code and what it names. */
export type LoraCodecRefusal = {
  code: string;
  detail?: {
    issues?: string[];
    tables?: string;
    vectors?: Array<{ index: number; name?: string; problems: string[] }>;
    removed?: string[];
    unitChanged?: string[];
    claims?: Array<{ model: string; codec: string }>;
    max?: number;
  };
};

/** An unsaved document checked (NB `POST /api/iot/lorawan/codecs/test`): the publish verdict, its own vectors, one frame. */
export type LoraCodecCheck = {
  verdict: { ok: true; outputSet: Record<string, string | null> } | { ok: false; refusal: LoraCodecRefusal };
  vectors: Array<{ index: number; name?: string; ok: boolean; problems: string[] }>;
  frame: LoraBenchFrame | null;
};

/** A LoRa device as its detail read returns it (the device tab). */
export type LoraDeviceDetail = LoraDeviceRow & {
  codecId: string;
  activation?: string;
  hasAppKey?: boolean;
  useProfileKey?: boolean;
};

/** The LoRaWAN settings of a device profile (NB iot_lorawan 08 §8.1); `codecId` is the profile's decoder choice. */
export type LoraProfileSettings = {
  region: string;
  macVersion: '1.0.2' | '1.0.3' | '1.0.4';
  class: 'A' | 'C';
  rx1DelayS: number;
  adrEnabled: boolean;
  minDr: number;
  maxDr: number;
  dedupMs: number;
  anyJoinEui: boolean;
  codecId: string;
  storeRadioKeys: boolean;
};

export type LoraProfileView = {
  settings: LoraProfileSettings;
  hasSharedAppKey: boolean;
  /** The profile's generic online rule (OD-57 / OD-63), shown read-only; null until one is chosen. */
  onlineRule: string | null;
  expectedIntervalS: number | null;
};

/** A choice of the codec selects: `auto`, `none`, or a codec id with its label. */
export type LoraCodecOption = { value: string; label: string };
