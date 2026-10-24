import { z } from 'zod';
import { IdSchema } from '../common/types';
import { AlarmSeverityEnum, AlarmStatusEnum, AlarmSchema, type Alarm, type AlarmSeverity, type AlarmStatus } from './types/index';

/* The platform entities, one file per entity (phase 00 §0.1): alarm, device record, credentials, attributes. */
export * from './types/index';

/* The rule editor's types live with the editor (modules/app/RulesetEditor), which is not tied to IoT; they stay importable from here. */
export {
  RuleNodeTypeEnum,
  RuleNodeOriginalSchema,
  RuleNodeSchema,
  RuleEdgeSchema,
  RuleGroupSchema,
  RuleChainSchema,
  type RuleNodeType,
  type RuleNode,
  type RuleNodeOriginal,
  type RuleEdge,
  type RuleGroup,
  type RuleChain,
} from '@/modules/app/RulesetEditor/types';

/* =========================================================
   ENUMS
========================================================= */

export const DeviceTypeEnum = z.enum(['INTERNAL', 'INTEGRATION', 'EXTERNAL']);
export const DeviceStatusEnum = z.enum(['ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE']);
export const DeviceRoleEnum = z.enum(['DEVICE', 'GATEWAY']);

export const TelemetryTopicEnum = z.enum([
  'DEVICE_TELEMETRY',
  'DEVICE_ATTRIBUTES',
  'GATEWAY_TELEMETRY',
  'GATEWAY_ATTRIBUTES',
]);

export const CloudStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']);
export const CloudPlanEnum = z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']);
export const CloudRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);


/* =========================================================
   DEVICE
========================================================= */

export const DeviceLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
});

export const DeviceSchema = z.object({
  deviceId: IdSchema,
  name: z.string(),
  slug: z.string(),
  type: DeviceTypeEnum,
  role: DeviceRoleEnum,
  status: DeviceStatusEnum,
  cloudId: IdSchema,
  location: DeviceLocationSchema.optional(),
  firmware: z.string().optional(),
  model: z.string().optional(),
  tags: z.array(z.string()).default([]),
  lastSeenAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().optional(),
  // Aligned with the platform's device API (phase 00 §0.1, NB iot_device), additive: the demo keeps its fields.
  serial: z.string().nullable().optional(),
  deviceProfileId: z.string().optional(),
  online: z.boolean().nullable().optional(),
  lastConnectAt: z.coerce.date().nullable().optional(),
  lastActivityAt: z.coerce.date().nullable().optional(),
  fwVersion: z.string().nullable().optional(),
  protocolMajor: z.number().int().nullable().optional(),
  isGateway: z.boolean().optional(),
  gatewayDeviceId: z.string().nullable().optional(),
});

/* =========================================================
   TELEMETRY
========================================================= */

export const TelemetryReadingSchema = z.object({
  readingId: IdSchema,
  topic: TelemetryTopicEnum,
  deviceId: IdSchema,
  timestamp: z.coerce.date(),
  payload: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

/* =========================================================
   CLOUD WORKSPACE
========================================================= */

export const CloudWorkspaceSchema = z.object({
  cloudId: IdSchema,
  name: z.string(),
  slug: z.string(),
  status: CloudStatusEnum,
  plan: CloudPlanEnum,
  deviceCount: z.number().int().nonnegative(),
  onlineCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  customDomain: z.string().nullable().optional(),
  region: z.string().optional(),
  createdAt: z.coerce.date().optional(),
});


/* =========================================================
   TYPES
========================================================= */

export type DeviceType = z.infer<typeof DeviceTypeEnum>;
export type DeviceStatus = z.infer<typeof DeviceStatusEnum>;
export type DeviceRole = z.infer<typeof DeviceRoleEnum>;
export type TelemetryTopic = z.infer<typeof TelemetryTopicEnum>;
export type CloudStatus = z.infer<typeof CloudStatusEnum>;
export type CloudPlan = z.infer<typeof CloudPlanEnum>;
export type CloudRole = z.infer<typeof CloudRoleEnum>;

export type DeviceLocation = z.infer<typeof DeviceLocationSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;
export type CloudWorkspace = z.infer<typeof CloudWorkspaceSchema>;

/* =========================================================
   ALARM (OD-9: the term is Alarm, five severities)
   The entity files live in ./types/ (phase 00 §0.1); the Alert* names below are
   deprecated aliases for one release (phase 03 §3.0) and are removed in the next minor.
========================================================= */

/** @deprecated use AlarmSeverityEnum (five levels, OD-9); removed in the next minor. */
export const AlertSeverityEnum = AlarmSeverityEnum;
/** @deprecated use AlarmStatusEnum; removed in the next minor. */
export const AlertStatusEnum = AlarmStatusEnum;
/** @deprecated use AlarmSchema (`alarmId` instead of `alertId`); removed in the next minor. */
export const AlertSchema = AlarmSchema;
/** @deprecated use AlarmSeverity; removed in the next minor. */
export type AlertSeverity = AlarmSeverity;
/** @deprecated use AlarmStatus; removed in the next minor. */
export type AlertStatus = AlarmStatus;
/** @deprecated use Alarm; removed in the next minor. */
export type Alert = Alarm;

