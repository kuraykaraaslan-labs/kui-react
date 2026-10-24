// Barrel exports for the IoT domain vertical.
export * from './types';
export { DeviceCard } from './device/DeviceCard';
export { DeviceStatusBadge } from './device/DeviceStatusBadge';
export { DeviceTypeBadge } from './device/DeviceTypeBadge';
export { RulesetEditor } from '@/modules/app/RulesetEditor/RulesetEditor';
export type { RulesetEditorRef, RulesetEditorProps, RulesetGraph, NodeMenuContext, ContextMenuItem } from '@/modules/app/RulesetEditor/RulesetEditor';
export { CloudWorkspaceCard } from './workspace/CloudWorkspaceCard';
export { MetricSparklineCard } from './telemetry/MetricSparklineCard';
export { TelemetryTimeSeriesChart } from './telemetry/TelemetryTimeSeriesChart';
export type { TelemetrySeries } from './telemetry/TelemetryTimeSeriesChart';
export { LogStreamRow } from './telemetry/LogStreamRow';
export type { LogLevel } from './telemetry/LogStreamRow';

// ── Platform screens: adapter, live, texts (phase 00) ─────────────────────────────────────────────────────────────────
export * from './api/adapter';
export * from './api/live';
export {
  IotAdapterProvider, useIotAdapter, useIotCapabilities, useIotLive, useIotLiveState, useIotNotify, useIotText, useLiveOrPoll,
} from './api/IotAdapterProvider';
export type { IotAdapterProviderProps, IotNotice, IotNotify } from './api/IotAdapterProvider';
export { IOT_MESSAGES, mergeIotMessages } from './messages';
export type { IotMessages, IotMessagesInput } from './messages';
export { formatRelative, formatDateTime } from './format';

// ── Alarms (phase 03; OD-9: the term is Alarm, five severities) ───────────────────────────────────────────────────────
export { AlarmSeverityBadge } from './alarm/AlarmSeverityBadge';
export type { AlarmSeverityBadgeProps } from './alarm/AlarmSeverityBadge';
export { AlarmStatusPill } from './alarm/AlarmStatusPill';
export { AlarmDetailHeader } from './alarm/AlarmDetailHeader';
export type { AlarmDetailHeaderProps } from './alarm/AlarmDetailHeader';
export { AlarmEventTimeline } from './alarm/AlarmEventTimeline';
export { AlarmTable, sortAlarmRows } from './alarm/AlarmTable';
export type { AlarmTableProps, AlarmTableRow, AlarmTableColumnId, AlarmTableRowAction } from './alarm/AlarmTable';
export { AlarmListView } from './alarm/AlarmListView';
export { AlarmDetailView } from './alarm/AlarmDetailView';
export { AlarmBellMenu } from './alarm/AlarmBellMenu';
export { ALARM_SEVERITY_META, ALARM_STATUS_META, SEVERITY_ORDER, compareSeverity, worstSeverity, isAlarmSeverity } from './alarm/alarm-severity';

// ── Devices (phase 01; NB iot_device 05) ─────────────────────────────────────────────────────────────────────────────
export { DeviceOnlineDot } from './device/DeviceOnlineDot';
export { DeviceConnectionBadge } from './device/DeviceConnectionBadge';
export { DeviceDetailHeader } from './device/DeviceDetailHeader';
export { DeviceCredentialPanel, IssuedSecretNotice } from './device/DeviceCredentialPanel';
export { DeviceAttributeTable } from './device/DeviceAttributeTable';
export { DesiredReportedBadge } from './device/DesiredReportedBadge';
export { DeviceConnectionTimeline } from './device/DeviceConnectionTimeline';
export { DeviceTable } from './device/DeviceTable';
export type { DeviceTableProps, DeviceTableRow, DeviceTableKeyColumn, DeviceTableColumnId } from './device/DeviceTable';
export { DeviceListView } from './device/DeviceListView';
export { DeviceDetailView } from './device/DeviceDetailView';
export { NewDeviceDrawer } from './device/NewDeviceDrawer';

// ── Deprecated (OD-9): the Alert* names, for one release; removed in the next minor ───────────────────────────────────
/** @deprecated use AlarmSeverityBadge; removed in the next minor. */
export { AlarmSeverityBadge as AlertSeverityBadge } from './alarm/AlarmSeverityBadge';
/** @deprecated use AlarmDetailHeader; removed in the next minor. */
export { AlarmDetailHeader as AlertDetailHeader } from './alarm/AlarmDetailHeader';
/** @deprecated use AlarmEventTimeline; removed in the next minor. */
export { AlarmEventTimeline as AlertEventTimeline } from './alarm/AlarmEventTimeline';
/** @deprecated use AlarmEvent; removed in the next minor. */
export type { AlarmEvent as AlertEvent, AlarmEventKind as AlertEventKind } from './types/alarm';
