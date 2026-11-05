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
export { RecordingTimeline } from './camera/RecordingTimeline';
export type { RecordingTimelineProps, RecordingRange, RecordingClipRange, RecordingMarker } from './camera/RecordingTimeline';

// ── Platform screens: adapter, live, texts (phase 00) ─────────────────────────────────────────────────────────────────
export * from './api/adapter';
export * from './api/list-table';
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
export {
  AlarmBellMenu, AlarmBellPanel, AlarmBellSection, AlarmBellSource, useAlarmBell, useAlarmBellSource,
  type AlarmBell, type AlarmBellItem, type AlarmBellMenuProps, type AlarmBellSourceOptions, type AlarmNotificationSource,
} from './alarm/AlarmBellMenu';
export {
  AlarmBellSync, applyAlarmEvent, alarmBellFrom, alarmsRunShort, alarmCountsBehind, compareAlarms, compareMarks, EMPTY_ALARM_BELL,
  ALARM_BELL_REFRESH_MS, ALARM_BELL_POLL_MS, ALARM_BELL_REPAIR_MS, ALARM_BELL_START_WAIT_MS,
  type AlarmBellState, type AlarmBellSyncOptions, type AlarmEventResult, type AlarmMark,
} from './alarm/alarm-bell-state';
export { acknowledgeAllOpen } from './alarm/acknowledgeAll';
export { ALARM_SEVERITY_META, ALARM_STATUS_META, SEVERITY_ORDER, compareSeverity, worstSeverity, isAlarmSeverity } from './alarm/alarm-severity';

// ── Devices (phase 01; NB iot_device 05) ─────────────────────────────────────────────────────────────────────────────
export { DeviceOnlineDot } from './device/DeviceOnlineDot';
export { DeviceAddress } from './device/DeviceAddress';
export type { DeviceAddressProps } from './device/DeviceAddress';
export { DeviceConnectionBadge } from './device/DeviceConnectionBadge';
export { DeviceDetailHeader } from './device/DeviceDetailHeader';
export { DeviceCredentialPanel, IssuedSecretNotice, useLeaveGuard } from './device/DeviceCredentialPanel';
export { DeviceAttributeTable } from './device/DeviceAttributeTable';
export { DeviceTelemetryView, kindOf, showValue, type DeviceTelemetryViewProps } from './device/DeviceTelemetryView';
export { DesiredReportedBadge } from './device/DesiredReportedBadge';
export { DeviceConnectionTimeline } from './device/DeviceConnectionTimeline';
export { DeviceLogTimeline, DEVICE_LOG_ACTIONS, auditSummary } from './device/DeviceLogTimeline';
export type { DeviceLogTimelineProps } from './device/DeviceLogTimeline';
export { useDeviceLog, connectionToLogEntry } from './device/useDeviceLog';
export { DeviceQuickView } from './device/DeviceQuickView';
export type { DeviceQuickViewProps } from './device/DeviceQuickView';
export { DeviceTable } from './device/DeviceTable';
export type { DeviceTableProps, DeviceTableRow, DeviceTableKeyColumn, DeviceTableColumnId } from './device/DeviceTable';
export { DeviceListView } from './device/DeviceListView';
export { DeviceDetailView } from './device/DeviceDetailView';
export { EditDeviceDrawer } from './device/EditDeviceDrawer';
export type { EditDeviceDrawerProps } from './device/EditDeviceDrawer';
export { SetCredentialDrawer } from './device/SetCredentialDrawer';
export type { SetCredentialDrawerProps } from './device/SetCredentialDrawer';
export { NewDeviceDrawer } from './device/NewDeviceDrawer';
export type { DeviceAddChoice, NewDeviceDrawerProps } from './device/NewDeviceDrawer';
export type { DeviceListViewProps } from './device/DeviceListView';

// ── RPC console (phase 04) ───────────────────────────────────────────────────────────────────────────────────────────
export { RpcStatusBadge } from './rpc/RpcStatusBadge';
export { RpcSendPanel } from './rpc/RpcSendPanel';
export type { RpcSendPanelProps } from './rpc/RpcSendPanel';
export { RpcRequestList, rpcDurationMs, rpcDuration } from './rpc/RpcRequestList';
export { RpcRequestDetail, rpcErrorText } from './rpc/RpcRequestDetail';
export { rpcParamProblems, rpcParamsToSend } from './rpc/rpc-params';
export { RpcConsoleView } from './rpc/RpcConsoleView';

// ── Device profiles (phase 01 §1.4; NB iot_device_profile 03) ──────────────────────────────────────────────────────
export { DeviceProfileCard } from './profile/DeviceProfileCard';
export { DeviceProfileListView, usageList } from './profile/DeviceProfileListView';
export type { DeviceProfileListViewProps } from './profile/DeviceProfileListView';
export { DeviceProfileEditorView } from './profile/DeviceProfileEditorView';
export type { DeviceProfileEditorViewProps } from './profile/DeviceProfileEditorView';
export { NewDeviceProfileDrawer } from './profile/NewDeviceProfileDrawer';
export { OnlineRuleField, formatSeconds } from './profile/OnlineRuleField';
export type { OnlineRuleValue, OnlineRuleFieldProps } from './profile/OnlineRuleField';
export { AuthModeSelector } from './profile/AuthModeSelector';
export { TransportPolicyCard } from './profile/TransportPolicyCard';
export { ProtocolMappingCard } from './profile/ProtocolMappingCard';
export { RateLimitEditor } from './profile/RateLimitEditor';
export { TelemetryKeySchemaTable } from './profile/TelemetryKeySchemaTable';
export { CfgSchemaTable, parseCfgEnum } from './profile/CfgSchemaTable';
export { ProvisioningSettingsCard } from './profile/ProvisioningSettingsCard';
export { ProvisioningKeysPanel, IssuedProvisionKeyNotice } from './profile/ProvisioningKeysPanel';
export type { ProvisioningKeysPanelProps } from './profile/ProvisioningKeysPanel';
export { AlarmRuleSetEditor } from './alarm/AlarmRuleSetEditor';
export { AlarmRuleDrawer, parseRuleValue, formatRuleValue, isFormable } from './alarm/AlarmRuleDrawer';
export { RpcCommandCatalogEditor } from './rpc/RpcCommandCatalogEditor';

// ── Sites and assets (phase 08; NB iot_asset 03) ─────────────────────────────────────────────────────────────────────
export { AssetKindBadge } from './asset/AssetKindBadge';
export type { AssetKindBadgeProps } from './asset/AssetKindBadge';
export { ASSET_KIND_ICONS, assetKindIcon, assetKindLabel } from './asset/asset-kind';
export { AssetBreadcrumb } from './asset/AssetBreadcrumb';
export type { AssetBreadcrumbProps } from './asset/AssetBreadcrumb';
export { AssetTree } from './asset/AssetTree';
export type { AssetTreeProps } from './asset/AssetTree';
export { AssetPicker } from './asset/AssetPicker';
export type { AssetPickerProps } from './asset/AssetPicker';
export { AssetFormDrawer } from './asset/AssetFormDrawer';
export type { AssetFormDrawerProps } from './asset/AssetFormDrawer';
export { MoveAssetDialog } from './asset/MoveAssetDialog';
export type { MoveAssetDialogProps } from './asset/MoveAssetDialog';
export { PlacedDeviceTable } from './asset/PlacedDeviceTable';
export type { PlacedDeviceTableProps } from './asset/PlacedDeviceTable';
export { PlaceDevicesDialog } from './asset/PlaceDevicesDialog';
export type { PlaceDevicesDialogProps } from './asset/PlaceDevicesDialog';
export { AssetRelationTable } from './asset/AssetRelationTable';
export type { AssetRelationTableProps } from './asset/AssetRelationTable';
export { AssetDrawer } from './asset/AssetDrawer';
export type { AssetDrawerProps } from './asset/AssetDrawer';
export { AssetsMapDrawer, siteLine } from './asset/AssetsMapDrawer';
export type { AssetsMapDrawerProps } from './asset/AssetsMapDrawer';
export { AssetsView } from './asset/AssetsView';
export type { AssetsViewProps } from './asset/AssetsView';
export { assetQueryFromParams, assetQueryToParams } from './asset/asset-query';
export { DevicePlacementPicker } from './asset/DevicePlacementPicker';
export type { DevicePlacementPickerProps } from './asset/DevicePlacementPicker';
export { DevicePlacementPanel } from './asset/DevicePlacementPanel';
export type { DevicePlacementPanelProps } from './asset/DevicePlacementPanel';

// ── Deprecated (OD-9): the Alert* names, for one release; removed in the next minor ───────────────────────────────────
/** @deprecated use AlarmSeverityBadge; removed in the next minor. */
export { AlarmSeverityBadge as AlertSeverityBadge } from './alarm/AlarmSeverityBadge';
/** @deprecated use AlarmDetailHeader; removed in the next minor. */
export { AlarmDetailHeader as AlertDetailHeader } from './alarm/AlarmDetailHeader';
/** @deprecated use AlarmEventTimeline; removed in the next minor. */
export { AlarmEventTimeline as AlertEventTimeline } from './alarm/AlarmEventTimeline';
/** @deprecated use AlarmEvent; removed in the next minor. */
export type { AlarmEvent as AlertEvent, AlarmEventKind as AlertEventKind } from './types/alarm';

// ── Rules (docs/concepts/iot-rules of the platform: sentences by name, Manual / Auto, the Rules card's pieces) ─────────────────
export { RuleList } from './rules/RuleList';
export type { RuleListProps } from './rules/RuleList';
export { RuleEditor } from './rules/RuleEditor';
export type { RuleEditorProps } from './rules/RuleEditor';
export { RuleHistory } from './rules/RuleHistory';
export type { RuleHistoryProps } from './rules/RuleHistory';
export { ModeSwitch } from './rules/ModeSwitch';
export type { ModeSwitchProps } from './rules/ModeSwitch';
export { PlaceCommands } from './rules/PlaceCommands';
export type { PlaceCommandsProps } from './rules/PlaceCommands';
export { RuleStatusChip } from './rules/RuleStatusChip';
export type { RuleStatusChipProps } from './rules/RuleStatusChip';
export { ruleState, countdown } from './rules/rule-format';
export type { RuleRunState } from './rules/rule-format';
export { actsOnDevices, draftProblems, emptyDefinition } from './rules/rule-draft';
export { READY_KEYS, readyRule } from './rules/rule-ready';
export type { ReadyKey } from './rules/rule-ready';

// ── Device settings (next-boilerplate docs/concepts/iot-device-settings 05: the Settings tab, its editors, baselines and bulk jobs) ─────
export { DeviceSettingsView } from './settings/DeviceSettingsView';
export type { DeviceSettingsViewProps } from './settings/DeviceSettingsView';
export { SectionEditorDrawer } from './settings/SectionEditorDrawer';
export type { SectionEditorDrawerProps } from './settings/SectionEditorDrawer';
export { SettingsForm } from './settings/SettingsForm';
export type { SettingsFormProps } from './settings/SettingsForm';
export { SecretField } from './settings/SecretField';
export type { SecretFieldProps } from './settings/SecretField';
export { SettingsStateBadge } from './settings/SettingsStateBadge';
export { SettingsDiffTable } from './settings/SettingsDiffTable';
export { SettingsHistoryTable } from './settings/SettingsHistoryTable';
export { BaselinesView } from './settings/BaselinesView';
export type { BaselinesViewProps } from './settings/BaselinesView';
export { BaselineEditorDrawer } from './settings/BaselineEditorDrawer';
export { JobsView, JobStateBadge } from './settings/JobsView';
export type { JobsViewProps } from './settings/JobsView';
export { NewJobDrawer, JobPlanSummary } from './settings/NewJobDrawer';
export { JobDetailView } from './settings/JobDetailView';
export type { JobDetailViewProps } from './settings/JobDetailView';
export { SettingsTextProvider, useSettingsText } from './settings/SettingsText';
export { SETTINGS_MESSAGES, mergeSettingsMessages, settingsMessagesFrom, flattenSettingsMessages } from './settings/messages';
export type { SettingsMessages, SettingsMessagesInput } from './settings/messages';
export { SettingsApiError, isSettingsApiError } from './settings/settings-adapter';
export type { DeviceSettingsAdapter, SettingsFleetAdapter, SettingsDeviceOption } from './settings/settings-adapter';

// ── Firmware updates (docs/concepts/iot-platform/phases/06; next-boilerplate iot_ota 04): packages, signing keys, assignment, devices ────
export {
  FirmwareListView, FirmwareDetailView, FirmwareUploadDrawer, OtaAssignDrawer, OtaRolloutView, OtaStateBar, OtaDevicePanel, OtaProfilePanel,
  SigningKeysDrawer, OtaStateBadge, OtaPackageStatusBadge, OtaTextProvider, OtaApiError, isOtaApiError, OTA_MESSAGES, mergeOtaMessages,
  otaMessagesFrom, flattenOtaMessages,
} from './ota';
export type { OtaAdapter, OtaMessages, OtaMessagesInput } from './ota';

// ── eSIM (next-boilerplate iot_esim 01, D468-D475): a router's chip and profiles, the device page's eSIM button and drawer ────────────────
export {
  EsimPanel, EsimDeviceAction, EsimAddProfileForm, EsimAddProfileDrawer, EsimOperationBadge, EsimTextProvider, EsimApiError, isEsimApiError,
  ESIM_MESSAGES, mergeEsimMessages, esimMessagesFrom, flattenEsimMessages,
} from './esim';
export type { EsimAdapter, EsimMessages, EsimMessagesInput } from './esim';
