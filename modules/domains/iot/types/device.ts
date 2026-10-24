import { z } from 'zod';

/*
 * Device registry shapes for the platform screens (docs/concepts/iot-platform/phases/00 §0.1, 01; NB `iot_device`).
 *
 * The demo's older `Device` (types.ts: ONLINE/OFFLINE/ERROR/MAINTENANCE in one `status`, `cloudId`) stays for the demo cards.
 * `DeviceRecord` is what an adapter returns: the registry status (`ACTIVE` / `QUARANTINED` / `DISABLED`) is kept apart from the
 * live connection (`online`), because "online" is transport state and "quarantined" is an operator state (00 §0.1).
 *
 * Self-contained (zod only), like `alarm.ts`.
 */

/** OD-1: a quarantined device connects but its data is dropped until it is activated. */
export const DEVICE_REGISTRY_STATUSES = ['ACTIVE', 'QUARANTINED', 'DISABLED'] as const;
export const DeviceRegistryStatusEnum = z.enum(DEVICE_REGISTRY_STATUSES);
export type DeviceRegistryStatus = z.infer<typeof DeviceRegistryStatusEnum>;

/**
 * The connection as a screen shows it (OD-57): a live connection or a recent message gives `ONLINE` / `OFFLINE`; a profile
 * whose rule is "last seen only" gives `LAST_SEEN` (a neutral "last seen 3 h ago", never a red "offline").
 */
export const DEVICE_ONLINE_STATES = ['ONLINE', 'OFFLINE', 'LAST_SEEN'] as const;
export type DeviceOnlineState = (typeof DEVICE_ONLINE_STATES)[number];

/** `online` of the API (true / false / null = last seen only) as the state the badges draw. */
export function onlineStateOf(online: boolean | null | undefined): DeviceOnlineState {
  if (online === null || online === undefined) return 'LAST_SEEN';
  return online ? 'ONLINE' : 'OFFLINE';
}

export const DeviceRecordSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string(),
  label: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  deviceProfileId: z.string(),
  profileName: z.string().nullable().optional(),
  status: DeviceRegistryStatusEnum,
  isGateway: z.boolean().default(false),
  gatewayDeviceId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  fwTitle: z.string().nullable().optional(),
  fwVersion: z.string().nullable().optional(),
  protocolMajor: z.number().int().nullable().optional(),
  /** true / false / null (last seen only, OD-57). */
  online: z.boolean().nullable(),
  lastConnectAt: z.coerce.date().nullable().optional(),
  lastDisconnectAt: z.coerce.date().nullable().optional(),
  lastActivityAt: z.coerce.date().nullable().optional(),
  /** The client address of the newest connect and its transport, as the platform's gateway saw them (iot-device 03 §3.6). */
  lastRemoteIp: z.string().nullable().optional(),
  lastTransport: z.string().nullable().optional(),
  /** Why the last session ended (a protocol reason such as `keepalive_timeout`), when known. */
  lastDisconnectReason: z.string().nullable().optional(),
  createdAt: z.coerce.date().optional(),
});
export type DeviceRecord = z.infer<typeof DeviceRecordSchema>;

/** A live change of one device's connection (`topics.deviceState`). Times as dates or epoch ms. */
export type DeviceStatePatch = {
  deviceId: string;
  online: boolean | null;
  lastActivityAt?: Date | number | null;
  lastConnectAt?: Date | number | null;
  lastDisconnectAt?: Date | number | null;
  reason?: string;
  /** The client address and transport of the newest connect, when the change carries them. */
  remoteIp?: string;
  transport?: string;
};

// ── credentials (01 §1.3) ────────────────────────────────────────────────────────────────────────────────────────────

export const CREDENTIAL_TYPES = ['ACCESS_TOKEN', 'MQTT_BASIC', 'X509_CERTIFICATE'] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

/** The credential without any secret: never a token, password, hash or private key. */
export type DeviceCredential = {
  type: CredentialType;
  clientId?: string | null;
  username?: string | null;
  certFingerprint?: string | null;
  certSubject?: string | null;
  certExpiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  rotatedAt?: Date | string | null;
};

/** A secret the server returns once (create, rotate, switch): it cannot be read back. */
export type IssuedSecret = { token: string } | { password: string };

// ── attributes (01 §1.5) ─────────────────────────────────────────────────────────────────────────────────────────────

export const ATTRIBUTE_SCOPES = ['SERVER', 'SHARED', 'CLIENT'] as const;
export type AttributeScope = (typeof ATTRIBUTE_SCOPES)[number];

/** Desired (shared) vs reported (client) of one `cfg.*` key (NB iot_device 04 §4.3). */
export const DESIRED_REPORTED_STATES = ['in_sync', 'pending', 'rejected', 'drifted', 'unknown_key'] as const;
export type DesiredReportedState = (typeof DESIRED_REPORTED_STATES)[number];

export type AttributeEntry = {
  key: string;
  value: unknown;
  updatedAt?: Date | number | null;
  /** A secret key: the value is write-only (shown masked, never read back). */
  secret?: boolean;
  /** Shared keys with a desired/reported view: the sync state and, for `rejected`, the device's reason. */
  sync?: DesiredReportedState;
  syncReason?: string;
};

// ── connection log (NB iot_device 03 §3.4) ───────────────────────────────────────────────────────────────────────────

export type DeviceConnectionEvent = {
  id: string;
  at: Date | string | number;
  /** `connected`, `disconnected`, `taken_over`, `last_seen_only`, or a newer kind (drawn neutral). */
  kind: string;
  reason?: string | null;
  detail?: string | null;
  transport?: string | null;
  remoteIp?: string | null;
};
