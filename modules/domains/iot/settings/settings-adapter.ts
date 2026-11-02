import type {
  DeviceSettings, DeviceSettingsSchema, NewSettingsJob, SettingsBaseline, SettingsBaselineInput, SettingsDryRun, SettingsHistoryEntry, SettingsJob,
  SettingsJobPlan, SettingsJobState, SettingsJobTarget, SettingsJobView, SettingsModel, SettingsPage, SettingsTargetState, SettingsWriteInput,
  SettingsWriteResult,
} from '../types/settings';

/**
 * What the settings views read and write through. The host implements it over its API (next-boilerplate: `/api/iot/devices/[id]/settings…`
 * and `/api/iot/device-settings/…`); the kui-react demo implements it in memory. Every method rejects with a `SettingsApiError` carrying the
 * server's `reason`, which the views turn into plain words.
 */
export interface DeviceSettingsAdapter {
  read(deviceId: string, signal?: AbortSignal): Promise<DeviceSettings>;
  schema(deviceId: string, signal?: AbortSignal): Promise<DeviceSettingsSchema>;
  history(deviceId: string, q: { section?: string; page: number; pageSize: number; dir: 'asc' | 'desc' }, signal?: AbortSignal): Promise<SettingsPage<SettingsHistoryEntry>>;
  /** The whole section. `dryRun` answers the change judged (`SettingsDryRun`) and stores nothing. */
  write(deviceId: string, section: string, input: SettingsWriteInput): Promise<SettingsWriteResult | SettingsDryRun>;
  /** Sends the desired document again (after a revert, a rejection, an expiry or a change made on the device). */
  reapply(deviceId: string, section: string, input: { ifMatch: number; confirm?: boolean }): Promise<SettingsWriteResult>;
}

export interface SettingsDeviceOption { deviceId: string; name: string; model: string | null }

/** Baselines and jobs: one tenant's fleet. */
export interface SettingsFleetAdapter {
  models(signal?: AbortSignal): Promise<SettingsModel[]>;
  /** The newest manifest of a model the tenant runs. */
  modelSchema(model: string, signal?: AbortSignal): Promise<DeviceSettingsSchema>;
  profiles(signal?: AbortSignal): Promise<Array<{ id: string; name: string }>>;
  devices(q: { search: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<SettingsPage<SettingsDeviceOption>>;
  baselines: {
    list(q: { page: number; pageSize: number; search?: string; dir: 'asc' | 'desc' }, signal?: AbortSignal): Promise<SettingsPage<SettingsBaseline> & { canManage?: boolean }>;
    get(baselineId: string, signal?: AbortSignal): Promise<SettingsBaseline>;
    create(input: SettingsBaselineInput): Promise<SettingsBaseline>;
    update(baselineId: string, input: SettingsBaselineInput): Promise<SettingsBaseline>;
    remove(baselineId: string): Promise<void>;
  };
  jobs: {
    list(q: { page: number; pageSize: number; state?: SettingsJobState[]; dir: 'asc' | 'desc' }, signal?: AbortSignal): Promise<SettingsPage<SettingsJob> & { canManage?: boolean }>;
    get(jobId: string, signal?: AbortSignal): Promise<SettingsJobView & { canManage?: boolean }>;
    targets(jobId: string, q: { page: number; pageSize: number; state?: SettingsTargetState[]; wave?: number[]; dir: 'asc' | 'desc' }, signal?: AbortSignal): Promise<SettingsPage<SettingsJobTarget>>;
    /** `dryRun`: the plan, nothing stored. `idempotencyKey`: a repeated create answers the job it made. */
    create(input: NewSettingsJob, opts: { dryRun?: boolean; idempotencyKey?: string }): Promise<SettingsJob | { dryRun: true; plan: SettingsJobPlan }>;
    pause(jobId: string): Promise<SettingsJob>;
    resume(jobId: string): Promise<SettingsJob>;
    cancel(jobId: string): Promise<SettingsJob>;
  };
}

/** A refused request: the HTTP status and the server's `details.reason` (and the rest of its details). */
export class SettingsApiError extends Error {
  readonly status: number;
  readonly reason?: string;
  readonly details: Record<string, unknown>;
  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SettingsApiError';
    this.status = status;
    this.details = details;
    this.reason = typeof details.reason === 'string' ? details.reason : undefined;
  }
}

export function isSettingsApiError(e: unknown): e is SettingsApiError {
  return e instanceof SettingsApiError || (typeof e === 'object' && e !== null && (e as { name?: string }).name === 'SettingsApiError');
}
