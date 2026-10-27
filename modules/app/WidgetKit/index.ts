// WidgetKit: the dashboard widget card, settings templates and widget views (next-boilerplate phase 21).
// Pure parts (settings/*, templates/*, kind.ts) are safe on a server; components are client-only.
export * from './settings/types';
export * from './settings/style';
export * from './settings/engine';
export * from './settings/packs';
export * from './settings/core';
export * from './kind';
export { BUILTIN_KINDS, builtinKind, builtinTemplate } from './templates';
export { BUILTIN_VIEWS } from './views';
export { WidgetCard, formatUpdated } from './WidgetCard';
export type { CardSettings, CardTimeWindow, WidgetCardProps, WidgetCardState } from './WidgetCard';
export { WidgetKitProvider, useWidgetKit, useKitMessages, SettingIcon } from './WidgetKitContext';
export type { WidgetKitHost } from './WidgetKitContext';
export { DEFAULT_WIDGET_KIT_MESSAGES, mergeKitMessages, CONTROL_TILE_MESSAGE_KEYS, issueText } from './messages';
export type {
  WidgetKitMessages, WidgetKitMessagesInput, WidgetCardMessages, WidgetBoardMessages, WidgetEditorMessages, SchemaFormMessages,
  WidgetControlMessages, TableMessages, FeedMessages, MapViewMessages, ViewerModelMessages, ChartViewMessages,
  ContentViewMessages, StatViewMessages, IssueMessages, CommonMessages, TemplateTextRef, TemplateTextFn, KindTextRef, KindTextFn,
} from './messages';
export { localizeTemplate, localizeKind } from './localize';
export { WidgetSettingsEditor } from './WidgetSettingsEditor';
export { renderWidgetPreview, renderWidgetTypePreview, WIDGET_PREVIEW_IDS, WIDGET_TYPE_PREVIEW_TYPES } from './previews';
export type { WidgetSettingsEditorProps } from './WidgetSettingsEditor';
export { resolvePlacement, capsOf, toCsvText } from './settings/resolve';
export type { ResolvedPlacement } from './settings/resolve';
export { PlacementCard } from './PlacementCard';
export type { PlacementCardProps } from './PlacementCard';
export { exportBoard, importBoard, nextFreeRow, BOARD_DOCUMENT_FORMAT, BOARD_DOCUMENT_VERSION, GRID_COLUMNS } from './settings/board';
export type { BoardDocument, BoardPlacement, ImportResult, ImportRefusal } from './settings/board';
export { GRID_COL_OPTIONS, DEFAULT_GRID_COLS, MAX_GRID_COLS, normalizeGridCols, scaleWidth, scaleLayout, resolveOverlaps, fitRect } from './settings/grid';
export type { GridCols, GridRect } from './settings/grid';
export { WidgetBoard } from './WidgetBoard';
export { cardCellResponsive } from './board-cell';
export type { WidgetBoardProps } from './WidgetBoard';
export { useLocalSetting } from './useLocalSetting';
export { useNow } from './useNow';
export { sampleSources, sampleData, SAMPLE_GALLERY_BOARD } from './sample/sample-data';
export type { SampleSource } from './sample/sample-data';
export { SAMPLE_BOARDS, SAMPLE_PLANT_BOARD, SAMPLE_SALES_BOARD, SAMPLE_ENERGY_BOARD, SAMPLE_INFRA_BOARD, SAMPLE_SITES_BOARD } from './sample/sample-boards';
// The scene setup drawer (next-boilerplate phase 42.2.3): binds a scene document to the devices that feed it. Host-driven (the
// kit fetches nothing); the matching and the binding payload are the pure functions beside it.
export { SceneSetupDrawer } from './views/SceneSetupDrawer';
export type { SceneSetupDrawerProps, SceneSetupDocument, SceneSetupDevice, SceneSetupSave } from './views/SceneSetupDrawer';
export { DEFAULT_SCENE_SETUP_MESSAGES } from './views/scene-setup-messages';
export type { SceneSetupMessages } from './views/scene-setup-messages';
export {
  KEY_GRAMMAR, ROLE_GRAMMAR, SLOT_GRAMMAR, KIND_GRAMMAR, UUID_GRAMMAR, DEFAULT_SLOT, MAX_SLOT_LENGTH, MAX_BINDING_DEVICES, MAX_BINDING_MAP, MAIN_ROLE, isSceneKey, isRoleName, splitKey, elementsForRole,
  autoMatch, roleFromCode, proposeRoles, bindingDraft, draftSignature, sameDraft, devicesFromRoles, validateDraft,
  staleEntries, unresolved as sceneUnresolved,
} from './views/scene-binding-logic';
export type {
  SceneKey, DeviceElement, DeviceRef, AutoMatch, AutoMatchHow, AutoMatchOptions, MatchHow, MatchStep, BindingDraft, DraftInput,
  DraftMatch, BindingIssue, BindingIssueCode, UnresolvedInput, Unresolved, StaleInput, StaleEntries,
} from './views/scene-binding-logic';
