/*
 * The effective rate limits of one device (NB iot-gateway 06 §6.4, W8G-6): what the gateway applies to it now. Read-only.
 */

export const DEVICE_LIMIT_FAMILIES = ['telemetry_msgs', 'telemetry_points', 'attr_msgs', 'rpc_msgs', 'attr_requests', 'csr', 'connects'] as const;
export type DeviceLimitFamily = (typeof DEVICE_LIMIT_FAMILIES)[number];

/** `enforced` refuses over the limit; `observed` only counts (the operator has not switched it on); `off` the gateway limits nothing; `unknown` no gateway reported. */
export type DeviceLimitMode = 'enforced' | 'observed' | 'off' | 'unknown';

export type DeviceLimitRow = {
  family: DeviceLimitFamily;
  /** The windows, tightest first as configured: `count` per `seconds`. Empty: none. */
  windows: Array<{ count: number; seconds: number }>;
  /** `default`: the protocol's own value; `profile`: the device profile changed it. */
  source: 'profile' | 'default';
  mode: DeviceLimitMode;
};

export const WORKSPACE_LIMIT_KEYS = ['msgsPerSecond', 'telemetryMsgsPerSecond', 'pointsPerMinute', 'connectedDevices', 'connectsPerMinute'] as const;
export type WorkspaceLimitKey = (typeof WORKSPACE_LIMIT_KEYS)[number];

export interface DeviceRateLimitsView {
  device: DeviceLimitRow[];
  /** The plan's limits for the whole workspace; `value` null = none, 0 = nothing admitted. */
  tenant: Array<{ key: WorkspaceLimitKey; value: number | null }>;
  gateway: { enforcement: 'on' | 'off' | 'unknown'; enforce: string[]; nodes: number };
}

export interface RateLimitsAdapter {
  limits(deviceId: string, signal?: AbortSignal): Promise<DeviceRateLimitsView>;
}
