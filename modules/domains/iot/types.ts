import { z } from 'zod';
import { IdSchema } from '../common/types';

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

export const AlertSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export const AlertStatusEnum = z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);

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
   ALERT
========================================================= */

export const AlertSchema = z.object({
  alertId: IdSchema,
  deviceId: IdSchema,
  deviceName: z.string(),
  cloudId: IdSchema,
  severity: AlertSeverityEnum,
  status: AlertStatusEnum,
  title: z.string(),
  message: z.string(),
  createdAt: z.coerce.date().optional(),
  acknowledgedAt: z.coerce.date().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
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
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;
export type AlertStatus = z.infer<typeof AlertStatusEnum>;

export type DeviceLocation = z.infer<typeof DeviceLocationSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;
export type CloudWorkspace = z.infer<typeof CloudWorkspaceSchema>;
export type Alert = z.infer<typeof AlertSchema>;

