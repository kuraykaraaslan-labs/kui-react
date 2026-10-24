// Explicit named re-exports for every component in the app layer.
// Using explicit names (not `export * from`) lets bundlers tree-shake
// unused components out of downstream consumer bundles.

// Shell + layout
export { AppShell } from './AppShell';
export { AppSidebar } from './AppSidebar';
export type {
  AppSidebarNavItem,
  AppSidebarNavGroup,
  AppSidebarFooterRenderContext,
  AppSidebarSlotRenderContext,
} from './AppSidebar';
export { AppTopBar } from './AppTopBar';
export type { AppTopBarItem, AppTopBarRegion } from './AppTopBar';
export { AppDrawer } from './AppDrawer';
export { AppFooter } from './AppFooter';
export { AppBreadcrumbs } from './AppBreadcrumbs';
export { SectionCard } from './SectionCard';

// Navigation
export { AppNav } from './AppNav';
export type { AppNavItem } from './AppNav';
export { NavDrawer } from './NavDrawer';
export { GlobalSearch } from './GlobalSearch';
export type { SearchResult } from './GlobalSearch';
export {
  AppCommandBar,
  CommandPalette,
  registerCommand,
  registerCommands,
  useRegisterCommand,
  useCommandStore,
  commandGroupOf,
  DEMO_COMMANDS,
} from './AppCommandBar';
export type { CommandItem, CommandPaletteProps, CommandGroup } from './AppCommandBar';

// Theming
export { ThemeSwitcher } from './ThemeSwitcher';

// Overlays
export { ContextMenu } from './ContextMenu';
export type { ContextMenuItem, ContextMenuProps } from './ContextMenu';

// Gallery
export { ImageGallery } from './ImageGallery';
export type { ImageGalleryImage, ImageGalleryProps } from './ImageGallery';

// Forms
export { Form } from './Form';
export { FormField } from './FormField';
export { FilterBar } from './FilterBar';
export type { FilterField, FilterValues } from './FilterBar';
export { StepFlow } from './StepFlow';
export type { StepFlowStep } from './StepFlow';
export { StepShell } from './StepShell';
export { FileUploadSection } from './FileUploadSection';
export type {
  FileItem,
  FileUploadSectionProps,
  FileUploadSectionMessages,
} from './FileUploadSection';

// Content / detail
export { DetailHeader } from './DetailHeader';
export type { DetailTab } from './DetailHeader';
export { InlineAlert } from './InlineAlert';

// States (loading / empty / error / 404 / splash)
export { LoadingState } from './LoadingState';
export { ErrorState, NoAccessState, NotFoundState } from './EmptyErrorState';
export { NotFoundPage } from './NotFoundPage';
export { SplashScreen } from './SplashScreen';

// Cross-cutting providers / utilities
export { NotificationProvider, notify, toast } from './NotificationSystem';
export {
  Announcer,
  AnnouncerOutlet,
  FocusTrap,
  LiveRegion,
  SkipLink,
  Tooltip,
  useAnnounce,
} from './AccessibilityKit';

// Status / chrome
export { MaintenancePage } from './MaintenancePage';
export type { MaintenancePageProps } from './MaintenancePage';

// Collaboration
export { ShareDialog } from './ShareDialog';
export type { ShareDialogProps, ShareInvitee, SharePermission } from './ShareDialog';
export { CommentThread } from './CommentThread';
export type { CommentThreadProps, CommentThreadItem } from './CommentThread';
export { MentionPicker } from './MentionPicker';
export type { MentionPickerProps, MentionPickerUser } from './MentionPicker';

// Onboarding / flows
export { OnboardingWizard } from './OnboardingWizard';
export type { OnboardingWizardProps, OnboardingStep } from './OnboardingWizard';

// Schema-driven forms (FieldSchema vocabulary, OD-16)
export {
  SchemaForm,
  SchemaFormProvider,
  useFieldOverrides,
  FieldControl,
  shouldShow,
  zodFromSchema,
  validateSchemaValues,
  fromJsonSchema,
  fromFormBuilder,
  DEFAULT_SCHEMA_FORM_MESSAGES,
} from './SchemaForm';
export type {
  SchemaFormProps,
  SchemaFieldOverrideProps,
  FieldOverrides,
  FieldSchema,
  FieldOption as SchemaFieldOption,
  FieldType as SchemaFieldType,
  JsonSchemaSubset,
  SchemaFormMessages,
} from './SchemaForm';

// Dashboard widget kit (next-boilerplate dashboard phase 21): card, settings templates, editor, views, board
export {
  WidgetCard,
  PlacementCard,
  WidgetSettingsEditor,
  WidgetBoard,
  WidgetKitProvider,
  useKitMessages,
  DEFAULT_WIDGET_KIT_MESSAGES,
  BUILTIN_KINDS,
  BUILTIN_VIEWS,
} from './WidgetKit';
export type {
  CardSettings,
  WidgetCardProps,
  PlacementCardProps,
  WidgetSettingsEditorProps,
  WidgetBoardProps,
  BoardDocument,
  GridCols,
  SettingsTemplate,
  WidgetKitHost,
  WidgetKitMessages,
  WidgetKitMessagesInput,
} from './WidgetKit';

// Entity aliases (next-boilerplate dashboard phase 36.4, the ThingsBoard model): alias list and dialog, entity filter
// form, filter text, toolbar entity select, a widget's alias picker
export {
  EntityAliasesDialog,
  EntityAliasDialog,
  EntityFilterForm,
  AliasEntitySelect,
  EntityAliasPicker,
  AliasPreviewPanel,
  entityFilterText,
  aliasCompatibility,
  aliasRemovalBlockers,
  normalizeAlias,
  validateAlias,
  validateAliases,
  slugKey,
  MAX_ALIASES,
  DEFAULT_ALIAS_MESSAGES,
} from './EntityAliases';
export type {
  EntityAliasesDialogProps,
  EntityAliasDialogProps,
  EntityFilterFormProps,
  AliasEntitySelectProps,
  EntityAliasPickerProps,
  EntityAlias,
  EntityAliasFilter,
  EntityAliasesAccess,
  EntityAliasesMessages,
  EntityAliasesMessagesInput,
  AliasEntitySelectItem,
  AliasSlot,
  AliasRoot,
  AliasPreview,
  BoardParamInfo,
  EntityRef,
  EntityTypeInfo,
  RelationFilter,
  RelationProviderInfo,
} from './EntityAliases';
