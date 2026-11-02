/**
 * The shapes of a device's settings managed from the cloud (next-boilerplate docs/concepts/iot-device-settings): the device describes
 * itself with a settings manifest (one JSON Schema per section with `x-roltek` annotations), the platform keeps a desired and a reported
 * document per section, and baselines and jobs change many devices at once. The platform's server is the authority on every rule (the
 * class a change needs, what is valid, what a secret is); these types only describe what it sends and takes. A secret value is never
 * read back: a reported or desired secret is `{ set: boolean }`.
 */

/** Who may change a setting (manifest annotation `class`): `dangerous` needs the typed two-step confirmation. */
export type SettingClass = 'read' | 'operate' | 'admin' | 'dangerous';

/** The `x-roltek` annotations of a section or a property (manifest contract 0.1). */
export interface SettingsAnnotations {
  class?: SettingClass;
  /** `false`: the device refuses it from the cloud; shown read-only ("set on the device"). */
  remote?: boolean;
  /** Write-only: never read back. */
  sensitive?: boolean;
  /** A change can cut the device's uplink: the device applies it and reverts on its own unless it reaches the cloud again. */
  connectivity?: boolean;
  /** The confirm window of a `connectivity` change, in seconds (default 120). */
  confirmS?: number;
  /** `none` | `service:<name>` | `network` | `reboot`: shown before saving. */
  restarts?: string;
  apply?: string;
  path?: string;
  [k: string]: unknown;
}

/** The JSON Schema subset a manifest uses (manifest contract 0.1), with the annotations. */
export interface SettingsSchemaNode {
  type?: string;
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  enum?: unknown[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  items?: SettingsSchemaNode;
  properties?: Record<string, SettingsSchemaNode>;
  required?: string[];
  default?: unknown;
  oneOf?: SettingsSchemaNode[];
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean;
  'x-roltek'?: SettingsAnnotations;
}

export interface SettingsManifestSection {
  title?: Record<string, string> | null;
  schema: SettingsSchemaNode;
}

/** A device's own manifest (its model and firmware), or the newest manifest of a model. */
export interface DeviceSettingsSchema {
  hash: string;
  model: string;
  fw: string;
  released: string;
  /** `false`: the manifest came from a development unit, not from a firmware build (D72). */
  verified: boolean;
  sections: Record<string, SettingsManifestSection>;
}

/** Device states and the platform's own: `pending` until the device answers, `expired`, `needs_review` after a firmware change. */
export type SettingsSectionState = 'pending' | 'confirming' | 'applied' | 'reverted' | 'rejected' | 'expired' | 'needs_review';
export const SETTINGS_SECTION_STATES: readonly SettingsSectionState[] = ['pending', 'confirming', 'applied', 'reverted', 'rejected', 'expired', 'needs_review'];

export interface SettingsSection {
  section: string;
  title: Record<string, string> | null;
  class: SettingClass;
  manifestHash: string | null;
  manifestCurrent: boolean;
  state: SettingsSectionState | null;
  /** The `If-Match` of the next write. */
  desiredRev: number;
  desired: Record<string, unknown> | null;
  reportedRev: number;
  reported: Record<string, unknown> | null;
  reportedState: string | null;
  /** `cloud` | `local`: a local change on the device is drift. */
  origin: string | null;
  error: { code: string; field?: string } | null;
  appliedAt: string | null;
  drift: boolean;
  pendingSince: string | null;
  expiresAt: string | null;
}

export type DeviceSettingsUnsupported = 'settings_unsupported' | 'manifest_unknown';

export interface DeviceSettings {
  deviceId: string;
  model: string | null;
  fw: string | null;
  supported: boolean;
  reason?: DeviceSettingsUnsupported;
  manifest?: { hash: string; verified: boolean; released: string };
  /** `false` once the firmware is past its support window: everything stays readable. */
  writable: boolean;
  sections: SettingsSection[];
  /** The classes the viewer may change (none: read only). */
  viewer?: { classes: SettingClass[] };
}

export interface SettingsHistoryEntry {
  id: string;
  section: string;
  at: string;
  /** `desired` | `confirming` | `applied` | `reverted` | `rejected` | `local` | `expired` | `needs_review` */
  kind: string;
  rev: number;
  /** `user:<id>`, `api:<id>`, `baseline:<id>`, or none (the device, the platform). */
  actor: string | null;
  detail: Record<string, unknown>;
}

export interface SettingsChange { path: string; before?: unknown; after?: unknown; sensitive?: true }

/** What a dry run answers: the change judged, nothing stored or sent. */
export interface SettingsDryRun {
  dryRun: true;
  section: string;
  rev: number;
  class: SettingClass;
  paths: SettingsChange[];
  needsConfirm: boolean;
  secrets: number;
  manifestHash: string;
  truncated?: true;
}

export interface SettingsWriteResult {
  section: string;
  rev: number;
  state: SettingsSectionState | null;
  delivered: boolean;
  manifestHash: string;
  manifestVerified: boolean;
  unchanged?: true;
}

export interface SettingsWriteInput {
  values: Record<string, unknown>;
  /** The `desiredRev` the values were read at. */
  ifMatch: number;
  /** The second step of a dangerous change. */
  confirm?: boolean;
  dryRun?: boolean;
}

// ── Many devices at once: baselines and jobs ─────────────────────────────────────────────────────────────────────────────

/** A model the viewer's devices run, with the newest manifest the platform knows for it. */
export interface SettingsModel {
  model: string;
  devices: number;
  firmwares: string[];
  manifest: { hash: string; fw: string; released: string; verified: boolean } | null;
}

/** A named set of partial section values (JSON merge patches, never a secret) for some models. */
export interface SettingsBaseline {
  baselineId: string;
  name: string;
  description: string | null;
  models: string[];
  sections: Record<string, Record<string, unknown>>;
  driftPolicy: 'REPORT' | 'ENFORCE';
  offlineExpiryDays: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SettingsBaselineInput = Pick<SettingsBaseline, 'name' | 'description' | 'models' | 'sections' | 'driftPolicy' | 'offlineExpiryDays'>;

export type SettingsJobState = 'running' | 'paused' | 'cancelled' | 'completed';
export const SETTINGS_JOB_STATES: readonly SettingsJobState[] = ['running', 'paused', 'cancelled', 'completed'];
export type SettingsTargetState = 'queued' | 'sent' | 'applied' | 'reverted' | 'rejected' | 'skipped' | 'offline' | 'superseded';
export const SETTINGS_TARGET_STATES: readonly SettingsTargetState[] = ['queued', 'sent', 'applied', 'reverted', 'rejected', 'skipped', 'offline', 'superseded'];

export type SettingsWaveCounters = Record<SettingsTargetState, number> & { total: number };

export interface SettingsJobSelector { deviceIds?: string[]; profileId?: string; models?: string[] }

export interface SettingsJob {
  jobId: string;
  name: string;
  baselineId: string | null;
  sections: Record<string, Record<string, unknown>>;
  selector: SettingsJobSelector;
  waveSizes: number[];
  gates: { minApplied: number; maxReverted: number };
  onConflict: 'queue' | 'skip';
  offlineExpiryDays: number;
  waveTimeoutMin: number;
  confirmDangerous: boolean;
  state: SettingsJobState;
  /** Cancelled or completed, with devices still answering. */
  settling: boolean;
  pauseReason: 'manual' | 'gate_failed' | 'no_data' | null;
  currentWave: number;
  waveStartedAt: number | null;
  createdBy: string | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface SettingsJobWave {
  wave: number;
  size: number;
  counters: SettingsWaveCounters;
  verdict: 'ok' | 'gate_failed' | 'no_data' | null;
  overridden: boolean;
}

export interface SettingsJobView { job: SettingsJob; waves: SettingsJobWave[]; totals: SettingsWaveCounters }

export interface SettingsTargetSection {
  rev?: number;
  outcome: 'queued' | 'waiting' | 'applied' | 'reverted' | 'rejected' | 'offline' | 'superseded' | 'skipped';
  reason?: string;
  issues?: Array<{ path: string; code: string }>;
}

export interface SettingsJobTarget {
  deviceId: string;
  /** The host's join: the device's name and model (absent when the device is gone). */
  name?: string | null;
  model?: string | null;
  wave: number;
  state: SettingsTargetState;
  detail: Record<string, SettingsTargetSection>;
  sentAt: number | null;
}

export interface SettingsModelCoverage {
  model: string | null;
  fw: string | null;
  devices: number;
  manifestKnown: boolean;
  sections: Record<string, { class: SettingClass; paths: number } | { missing: true }>;
  needsConfirm: boolean;
}

/** A job's dry run: what it would do, nothing stored. */
export interface SettingsJobPlan {
  devices: number;
  excludedByModel: number;
  skipped: number;
  waveSizes: number[];
  coverage: SettingsModelCoverage[];
  needsConfirm: boolean;
}

export interface NewSettingsJob {
  name: string;
  baselineId?: string;
  sections?: Record<string, Record<string, unknown>>;
  selector: SettingsJobSelector;
  waves?: { percent: number[] } | { count: number[] };
  gates?: { minApplied?: number; maxReverted?: number };
  onConflict?: 'queue' | 'skip';
  offlineExpiryDays?: number;
  confirm?: boolean;
}

export interface SettingsPage<T> { data: T[]; total: number }
