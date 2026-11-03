/**
 * The firmware update (OTA) shapes the views read through `OtaAdapter` (docs/concepts/iot-platform/phases/06; next-boilerplate
 * `iot_ota`, docs/concepts/iot-ota 00–04). The state names follow NB `iot_ota` (O4): the ThingsBoard OTA states plus what only the
 * platform knows (QUEUED, INITIATED, WAITING, TIMEOUT, ROLLED_BACK, SKIPPED, CANCELLED).
 */

export const OTA_STATES = [
  'QUEUED', 'INITIATED', 'WAITING', 'DOWNLOADING', 'DOWNLOADED', 'VERIFIED', 'UPDATING', 'UPDATED', 'FAILED', 'TIMEOUT', 'ROLLED_BACK',
  'SKIPPED', 'CANCELLED',
] as const;
export type OtaState = (typeof OTA_STATES)[number];

/** States an attempt ends in. */
export const OTA_FINISHED_STATES: ReadonlySet<OtaState> = new Set(['UPDATED', 'FAILED', 'TIMEOUT', 'ROLLED_BACK', 'SKIPPED', 'CANCELLED']);
/** States a person may retry by hand. */
export const OTA_RETRYABLE_STATES: ReadonlySet<OtaState> = new Set(['FAILED', 'TIMEOUT', 'ROLLED_BACK']);

/** Why a device holds a delivered update (OD-7 metered link / data quota, OD-13 the router's own approval). Never an error. */
export const OTA_WAIT_REASONS = ['metered', 'quota_exhausted', 'approval'] as const;
export type OtaWaitReason = (typeof OTA_WAIT_REASONS)[number];

export const OTA_PACKAGE_STATUSES = ['DRAFT', 'REJECTED', 'READY', 'DEPRECATED', 'REVOKED'] as const;
export type OtaPackageStatus = (typeof OTA_PACKAGE_STATUSES)[number];

export const OTA_PACKAGE_TYPES = ['FIRMWARE', 'SOFTWARE'] as const;
export type OtaPackageType = (typeof OTA_PACKAGE_TYPES)[number];

/** How an image is signed: usign (OpenWrt), ESP32 Secure Boot V2, or not at all (only where a profile allows it). */
export const OTA_SIGNATURE_SCHEMES = ['usign-ed25519', 'esp32-secure-boot-v2', 'none'] as const;
export type OtaSignatureScheme = (typeof OTA_SIGNATURE_SCHEMES)[number];
export const OTA_KEY_SCHEMES = ['usign-ed25519', 'esp32-secure-boot-v2'] as const;
export type OtaKeyScheme = (typeof OTA_KEY_SCHEMES)[number];

export interface OtaPackage {
  packageId: string;
  type: OtaPackageType;
  title: string;
  version: string;
  /** The one profile the image is for, or null (any profile). */
  profileId: string | null;
  hardwareModels: string[];
  minFromVersion: string | null;
  size: number;
  checksumAlgorithm: string;
  checksum: string;
  signatureScheme: OtaSignatureScheme;
  /** The registered key the signature verified against (null: unsigned). */
  signingKeyId: string | null;
  status: OtaPackageStatus;
  rejectReason: string | null;
  releaseNotes: string | null;
  createdAt: string;
  readyAt: string | null;
}

/** What the uploader states beside the file. `checksum` is the SHA-256 the browser computed (`sha256Hex`). */
export interface OtaPackageMeta {
  title: string;
  version: string;
  type?: OtaPackageType;
  profileId?: string | null;
  hardwareModels?: string[];
  minFromVersion?: string | null;
  checksum: string;
  signatureScheme: OtaSignatureScheme;
  /** usign: the `.sig` file's text. */
  signature?: string;
  releaseNotes?: string;
}

export interface OtaSigningKey {
  keyId: string;
  scheme: OtaKeyScheme;
  fingerprint: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
}

export type OtaTargetType = 'PROFILE' | 'GROUP' | 'DEVICE';

export interface OtaAssignment {
  assignmentId: string;
  targetType: OtaTargetType;
  targetId: string;
  /** The profile's or device's name, when the host knows it. */
  targetName?: string | null;
  packageId: string;
  /** A group's frozen device count. */
  deviceCount: number | null;
  createdAt: string;
}

/** Assign to a profile (its devices), one device, or a group: a device list or a profile's devices frozen now. */
export type OtaAssignTarget =
  | { targetType: 'PROFILE'; targetId: string }
  | { targetType: 'DEVICE'; targetId: string }
  | { targetType: 'GROUP'; deviceIds: string[] }
  | { targetType: 'GROUP'; selector: { profileId: string } };

/** Why a device would not take the package (it is SKIPPED). */
export const OTA_BLOCK_REASONS = [
  'package_not_ready', 'profile_mismatch', 'hardware_mismatch', 'version_unknown', 'version_too_old', 'ota_disabled', 'unsigned_not_allowed',
] as const;
export type OtaBlockReason = (typeof OTA_BLOCK_REASONS)[number];

/** The counts an assignment's confirmation shows (a dry run; nothing is written). */
export interface OtaAssignPreview {
  devices: number;
  offline: number;
  incompatible: Partial<Record<OtaBlockReason | string, number>>;
  alreadyOnTarget: number;
}

/** One device's current attempt of a package. */
export interface OtaAttempt {
  deviceId: string;
  deviceName?: string | null;
  packageId: string;
  assignmentId: string | null;
  state: OtaState;
  waitReason: OtaWaitReason | null;
  fromVersion: string | null;
  toVersion: string;
  /** The device's error code, or the platform's reason for SKIPPED / CANCELLED. */
  fwError: string | null;
  attempts: number;
  /** 0–100 while downloading, when the device reports it. */
  progress: number | null;
  stateChangedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OtaEvent {
  at: string;
  packageId: string;
  from: OtaState | string;
  to: OtaState | string;
  /** `moved` a transition; `ignored` a report recorded without a move. */
  kind: 'moved' | 'ignored' | string;
  fwError: string | null;
}

/** A device's firmware: what it runs, its current attempt and its recent history. */
export interface OtaDeviceView {
  deviceId: string;
  currentVersion: string | null;
  currentTitle: string | null;
  attempt: OtaAttempt | null;
  events: OtaEvent[];
}

export interface OtaProfileSettings {
  otaEnabled: boolean;
  allowMetered: boolean;
  allowUnsigned: boolean;
  downloadTimeoutMin: number;
  updateTimeoutMin: number;
  maxAttempts: number;
}

/** Stored values (null = the default) and what applies. A device stores `allowMetered` only (OD-7: device value, else its profile's). */
export interface OtaSettingsView {
  targetType: 'profile' | 'device';
  targetId: string;
  stored: Partial<Record<keyof OtaProfileSettings, boolean | number | null>>;
  effective: Partial<OtaProfileSettings>;
}

export type OtaSettingsInput = Partial<Record<keyof OtaProfileSettings, boolean | number | null>>;

export interface OtaOption { id: string; name: string; hint?: string | null }

/** What the viewer may do (the host's permissions). Anything missing is false. */
export interface OtaAbilities {
  /** Upload, deprecate, revoke and delete packages. */
  managePackages?: boolean;
  /** Assign, change OTA settings, retry. */
  assign?: boolean;
  /** Register and revoke signing public keys. */
  manageKeys?: boolean;
}
