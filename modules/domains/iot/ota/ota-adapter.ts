import type {
  OtaAssignPreview, OtaAssignTarget, OtaAssignment, OtaAttempt, OtaDeviceView, OtaKeyScheme, OtaOption, OtaPackage, OtaPackageMeta,
  OtaSettingsInput, OtaSettingsView, OtaSigningKey, OtaState, OtaTargetType,
} from './types';

/**
 * What the firmware (OTA) views read and write through. The host implements it over its API (next-boilerplate: `/api/iot/ota/…` of
 * `iot_ota`); the kui-react demo implements it in memory (`demo-ota.ts`). Every method rejects with an `OtaApiError` carrying the server's
 * `reason`, which the views put into plain words. The platform never signs firmware and never hands out a download link here: the
 * views see metadata, counts and states only.
 */
export interface OtaAdapter {
  packages: {
    list(signal?: AbortSignal): Promise<OtaPackage[]>;
    /** One package and the per-state counts of its devices' current attempts. */
    get(packageId: string, signal?: AbortSignal): Promise<{ package: OtaPackage; states: Partial<Record<OtaState, number>> }>;
    /** Sends the image and its details in one request; `onProgress` gets 0..1 while the bytes go up. */
    upload(file: File, meta: OtaPackageMeta, onProgress?: (fraction: number) => void): Promise<OtaPackage>;
    /** Release notes, or DEPRECATED / READY again / REVOKED. */
    update(packageId: string, input: { status?: 'READY' | 'DEPRECATED' | 'REVOKED'; releaseNotes?: string | null }): Promise<OtaPackage>;
    /** Only when nothing references it (a `package_referenced` refusal otherwise). */
    remove(packageId: string): Promise<void>;
  };
  keys: {
    list(signal?: AbortSignal): Promise<OtaSigningKey[]>;
    /** A PUBLIC key: usign `.pub` text, or an ESP32 key digest (64 hex). */
    add(input: { scheme: OtaKeyScheme; publicKey: string; label: string }): Promise<OtaSigningKey>;
    /** Revoking a key revokes its packages and cancels their updates that have not started installing. */
    revoke(keyId: string): Promise<{ revokedPackages: number; cancelled: number }>;
  };
  assignments: {
    list(q: { packageId?: string; targetType?: OtaTargetType; targetId?: string }, signal?: AbortSignal): Promise<OtaAssignment[]>;
    /** `dryRun` answers the counts of the confirmation and writes nothing. */
    create(packageId: string, target: OtaAssignTarget, opts?: { dryRun?: boolean }): Promise<{ assignment: OtaAssignment | null; preview: OtaAssignPreview }>;
    remove(assignmentId: string): Promise<void>;
  };
  /** Current attempts, newest change first (a package's devices, or one state). */
  attempts(q: { packageId?: string; state?: OtaState; limit?: number }, signal?: AbortSignal): Promise<OtaAttempt[]>;
  device(deviceId: string, signal?: AbortSignal): Promise<OtaDeviceView>;
  /** Retry a failed, timed-out or rolled-back update. */
  retry(deviceId: string): Promise<OtaAttempt>;
  settings: {
    get(targetType: 'profile' | 'device', targetId: string, signal?: AbortSignal): Promise<OtaSettingsView>;
    put(targetType: 'profile' | 'device', targetId: string, input: OtaSettingsInput): Promise<OtaSettingsView>;
  };
  /** The profiles and devices the assign drawer offers. */
  profiles(signal?: AbortSignal): Promise<OtaOption[]>;
  devices(q: { search: string; profileId?: string; pageSize: number }, signal?: AbortSignal): Promise<OtaOption[]>;
  /** Optional live updates of a package's attempts: call `onChange` when something moved; returns the unsubscribe. Without it the views poll. */
  watch?(packageId: string, onChange: () => void): () => void;
}

/** A refused request: the HTTP status and the server's `details.reason` (and the rest of its details). */
export class OtaApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly details: Record<string, unknown>;
  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'OtaApiError';
    this.status = status;
    this.details = details;
    this.reason = typeof details.reason === 'string' ? details.reason : undefined;
  }
}

export function isOtaApiError(e: unknown): e is OtaApiError {
  return e instanceof OtaApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'OtaApiError');
}

/** The SHA-256 of a file in the browser (WebCrypto), as 64 lower-case hex characters: shown before the upload and checked by the server. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A size in plain units (1 KB = 1024 bytes). */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}
