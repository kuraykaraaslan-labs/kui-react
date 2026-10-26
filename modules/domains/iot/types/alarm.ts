import { z } from 'zod';

/*
 * Alarm entity (docs/concepts/iot-platform/phases/00-api-adapter-layer.md §0.1, 03-alarms.md §3.0).
 *
 * OD-9 (owner, 2026-10-04): the term is Alarm and the ladder has exactly five levels. Field names follow NB `iot_alarm`
 * (`docs/concepts/iot-alarm/phases/00`): status OPEN → ACKNOWLEDGED → RESOLVED, no re-open (a new occurrence is a new row).
 * kui-react's "clear" is NB's "resolve"; the adapter maps the words, the data model does not change.
 *
 * Self-contained on purpose (zod only): the alarm and device components import this file, never the vertical's
 * `types.ts` barrel, so a copy of them carries no rule-editor types.
 */

export const ALARM_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'] as const;
export const AlarmSeverityEnum = z.enum(ALARM_SEVERITIES);
export type AlarmSeverity = z.infer<typeof AlarmSeverityEnum>;

export const ALARM_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export const AlarmStatusEnum = z.enum(ALARM_STATUSES);
export type AlarmStatus = z.infer<typeof AlarmStatusEnum>;

/** Where an alarm came from (OD-79 / OD-88): a profile rule run by the default flow, or an alarm block of a flow. */
export const AlarmOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('profileRule'), profileId: z.string(), ruleId: z.string(), ruleName: z.string().optional() }),
  z.object({ kind: z.literal('flow'), flowId: z.string(), nodeId: z.string(), flowName: z.string().optional(), nodeName: z.string().optional() }),
  z.object({ kind: z.literal('operator') }),
]);
export type AlarmOrigin = z.infer<typeof AlarmOriginSchema>;

export const AlarmSchema = z.object({
  alarmId: z.string().min(1),
  /** The rule's alarm type (`high_temperature`, `device_offline`, …): one open alarm per device and type. */
  type: z.string(),
  severity: AlarmSeverityEnum,
  status: AlarmStatusEnum,
  title: z.string(),
  message: z.string().optional(),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  /** The site (or asset) the device sits in, when the host knows it: the bell shows it after the device. */
  siteName: z.string().nullable().optional(),
  profileId: z.string().nullable().optional(),
  origin: AlarmOriginSchema.optional(),
  /** OD-25 / OD-34: the `metadata.topic` of the triggering message, when it was not a default topic. */
  topic: z.string().nullable().optional(),
  openedAt: z.coerce.date(),
  acknowledgedAt: z.coerce.date().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  /** How many times the condition fired while the alarm was open. */
  occurrences: z.number().int().nonnegative().default(1),
  /** The rule's dampening held a clear back (it flips too often). */
  flapping: z.boolean().default(false),
  /** Runbook text of the rule that raised it, when there is one (plain text). */
  runbook: z.string().nullable().optional(),
});
export type Alarm = z.infer<typeof AlarmSchema>;

/**
 * What a timeline row says happened. `opened` … `note` are the NB `iot_alarm_events` kinds; `automation` is a flow
 * acting on the alarm. Unknown kinds render as a neutral line, so a newer server never breaks the timeline.
 */
export const ALARM_EVENT_KINDS = [
  'opened', 'severity_changed', 'acknowledged', 'resolved', 'reopened_suppressed', 'notified', 'throttled', 'muted',
  'automation', 'note', 'flapping',
] as const;
export type AlarmEventKind = (typeof ALARM_EVENT_KINDS)[number];

export type AlarmEvent = {
  eventId: string;
  kind: AlarmEventKind | (string & {});
  /** Who did it: a user's display name, a flow, or the platform. */
  by: string;
  at: Date | string;
  note?: string;
  /** For `severity_changed`. */
  from?: AlarmSeverity;
  to?: AlarmSeverity;
};

/** Counts of the alarms that are not resolved, by status and severity (`alarms.counts`). */
export type AlarmCounts = {
  open: number;
  acknowledged: number;
  bySeverity: Record<AlarmSeverity, number>;
};

/** One id of a bulk acknowledge / clear and what happened to it (some may have changed meanwhile). */
export type AlarmBulkResult = {
  alarmId: string;
  ok: boolean;
  /** Why nothing changed: `not_active`, `already_acknowledged`, `not_found`, … */
  reason?: string;
};
