// Explicit named re-exports for every component in the ui layer.
// Using explicit names (not `export * from`) lets bundlers tree-shake
// unused components out of downstream consumer bundles.

// Atoms
export { Accordion } from './Accordion';
export type { AccordionItem } from './Accordion';
export { Avatar, AvatarGroup } from './Avatar';
export { Badge } from './Badge';
export { BrandLogo } from './BrandLogo';
export { Button } from './Button';
export { Checkbox } from './Checkbox';
export { DatePicker } from './DatePicker';
export { FileInput } from './FileInput';
export { Input } from './Input';
export { Label } from './Label';
export { Progress } from './Progress';
export { RangeSlider } from './RangeSlider';
export { ScrollArea } from './ScrollArea';
export { Select, DEFAULT_SELECT_MESSAGES } from './Select';
export type { SelectOption, SelectMessages } from './Select';
export { Separator } from './Separator';
export { SkipLink, LiveRegion, Announcer } from './SkipLink';
export { Spinner } from './Spinner';
export { StarRating } from './StarRating';
export { StatCard } from './StatCard';
export { Statistic } from './Statistic';
export { Textarea } from './Textarea';
export { Toggle } from './Toggle';
export { TimeWindowPicker, DEFAULT_TIME_WINDOW_MESSAGES } from './TimeWindowPicker';
export type { TimeWindowValue, TimeWindowMessages } from './TimeWindowPicker';
export {
  ControlTile, ControlButton, ControlSwitch, ControlSlider, ControlSetpoint,
  DEFAULT_CONTROL_MESSAGES, asBoolean, toRange, validateSetpoint, snapToStep,
} from './ControlTile';
export type {
  ControlTileProps, ControlMessages, ControlButtonProps, ControlButtonMessages, ControlConfirmation,
  ControlSwitchProps, ControlSliderProps, ControlSetpointProps, ControlSetpointMessages, NumericRange, SetpointCheck,
} from './ControlTile';

// Molecules
export { AdvancedDataTable } from './AdvancedDataTable';
export { AlertBanner } from './AlertBanner';
export type { AlertAction } from './AlertBanner';
export { Breadcrumb } from './Breadcrumb';
export type { BreadcrumbItem, BreadcrumbTone } from './Breadcrumb';
export { ButtonGroup } from './ButtonGroup';
export { Callout, CALLOUT_VARIANTS } from './Callout';
export type { CalloutVariant } from './Callout';
export type { ButtonGroupItem } from './ButtonGroup';
export { Card } from './Card';
export { CheckboxGroup } from './CheckboxGroup';
export { ComboBox, DEFAULT_COMBOBOX_MESSAGES } from './ComboBox';
export type { ComboBoxOption, ComboBoxMessages } from './ComboBox';
export { ContentScoreBar } from './ContentScoreBar';
export type { ScoreRule } from './ContentScoreBar';
export { DataTable } from './DataTable';
export { DescriptionList } from './DescriptionList';
export type { DescriptionItem, DescriptionListMessages } from './DescriptionList';
export { BarList } from './BarList';
export type { BarListItem } from './BarList';
export { OrgChart, buildOrgTree } from './OrgChart';
export type { OrgTreeNode, OrgChartMessages } from './OrgChart';
export type { DataTableProps } from './DataTable';
export type {
  DataTableRowAction,
  DataTableQuery,
  DataTableFetchArgs,
  DataTableFetchResult,
  DataTableFilterField,
  DataTableFilterValues,
  DataTableRowState,
  DataTableCardContext,
  DataTableMessages,
} from './Table/types';
export { resolveRowActions } from './Table/parts/RowActionsCell';
export { DateRangePicker, TimePicker } from './DateRangePicker';
export type { DateRange } from './DateRangePicker';
export { DocPager } from './DocPager';
export type { DocPagerLink } from './DocPager';
export { Drawer } from './Drawer';
export { DropdownMenu, arrangeMenuItems, mergeMenuItems } from './DropdownMenu';
export type { DropdownItem, DropdownMenuItem, DropdownSeparator, DropdownHeading, DropdownMenuSearch, ArrangeMenuOptions } from './DropdownMenu';
export { EmptyState } from './EmptyState';
export { ContributionBoundary } from './ContributionBoundary';
export type { ContributionBoundaryProps, ContributionBoundaryFallback, ContributionBoundaryFallbackProps } from './ContributionBoundary';
export { UnavailableContribution, UNAVAILABLE_REASONS, UNAVAILABLE_REASON_IDS } from './UnavailableContribution';
export type {
  UnavailableContributionProps,
  UnavailableContributionContent,
  UnavailableContributionAction,
  UnavailableContributionSize,
  UnavailableReason,
  UnavailableReasonMeta,
  UnavailableTone,
} from './UnavailableContribution';
export { MapView, MapCanvas } from './MapView';
export type { MapVariant, MapTooltipField, MapTooltipData, MapMarker, MapZone, MapRoute, MapTiles, MapTilesConfig, MapCanvasProps } from './MapView';
export { Modal } from './Modal';
export { MultiSelect, DEFAULT_MULTI_SELECT_MESSAGES } from './MultiSelect';
export type { MultiSelectOption, MultiSelectMessages } from './MultiSelect';
export { PageHeader } from './PageHeader';
export type { PageHeaderAction } from './PageHeader';
export { Pagination } from './Pagination';
export { Popconfirm } from './Popconfirm';
export { Popover } from './Popover';
export { RadioGroup } from './RadioGroup';
export type { RadioOption } from './RadioGroup';
export { SearchBar } from './SearchBar';
export { ServerDataTable } from './ServerDataTable';
export { SkeletonLine, SkeletonAvatar, SkeletonText, SkeletonCard, SkeletonTableRow } from './Skeleton';
export { Slider } from './Slider';
export { Stepper } from './Stepper';
export type { StepItem } from './Stepper';
export { TabButton } from './TabButton';
export { TabGroup } from './TabGroup';
export type { Tab, TabErrorContext } from './TabGroup';
export { Table } from './Table';
export type { TableColumn } from './Table';
export { TableOfContents } from './TableOfContents';
export type { TocItem } from './TableOfContents';
export { TagInput } from './TagInput';
export { Toast, ToastProvider, ToastRegion } from './Toast';
export type { ToastAction, ToastPosition } from './Toast';
export { Tooltip } from './Tooltip';
export { TreeView } from './TreeView';
export type { TreeNode } from './TreeView';
export { VideoPlayer } from './VideoPlayer';
export type { QualityOption, SubtitleTrack, AudioTrackOption } from './VideoPlayer';
export { ViewToggle } from './ViewToggle';
export type { ViewOrientation } from './ViewToggle';

// Lazy wrappers (next/dynamic, ssr:false) for heavy components
export { LazyDataTable, LazyAdvancedDataTable, LazyServerDataTable, LazyDateRangePicker, LazyMapView, LazyVideoPlayer } from './lazy';

// Zustand toast store — programmatic API
export { useToastStore, toast, getEffectiveDuration } from './Toast.store';
export type { ToastItem, ToastVariant, ToastItemAction } from './Toast.store';
export { BulkActionTable } from './BulkActionTable';
export type { BulkActionTableProps, BulkAction } from './BulkActionTable';
export { Timeline } from './Timeline';
export type { TimelineProps, TimelineItem } from './Timeline';

// Observability components (virtualised lists, trace and service views)
export { TraceWaterfall, DEFAULT_TRACE_WATERFALL_MESSAGES, buildTraceTree, criticalPathIds, rulerTicks } from './TraceWaterfall';
export type { TraceWaterfallProps, TraceWaterfallMessages, TraceSpan, TraceSpanInfo, SpanStatus } from './TraceWaterfall';
export { LogViewer, useLogStream, DEFAULT_LOG_VIEWER_MESSAGES } from './LogViewer';
export type { LogViewerProps, LogViewerMessages, LogLine, LogSeverity, LogFieldValue, LogStream, UseLogStreamOptions } from './LogViewer';
export { ServiceMap, DEFAULT_SERVICE_MAP_MESSAGES, layoutServiceMap } from './ServiceMap';
export type { ServiceMapProps, ServiceMapMessages, ServiceNode, ServiceEdge, ServiceHealth, MapLayout } from './ServiceMap';
export { CitationChip, EvidenceList, CitedText, evidenceDomId, DEFAULT_EVIDENCE_MESSAGES } from './Evidence';
export type { CitationChipProps, EvidenceListProps, CitedTextProps, EvidenceItem, EvidenceKind, DroppedClaim, EvidenceMessages } from './Evidence';
export { DayBarChart, dayStatus, meanAvailability, statusCounts, fillDays, DEFAULT_DAY_THRESHOLDS, DEFAULT_DAY_BAR_CHART_MESSAGES } from './DayBarChart';
export type { DayBarChartProps, DayBarChartMessages, DayBar, DayIncident, DayStatus, DayThresholds, DayIncidentSeverity } from './DayBarChart';
export { AiHumanDraftEditor, DEFAULT_AI_HUMAN_DRAFT_EDITOR_MESSAGES, buildSegments, applySegments } from './AiHumanDraftEditor';
export type { AiHumanDraftEditorProps, AiHumanDraftEditorMessages, Hunk, Segment } from './AiHumanDraftEditor';
export { ConversationTimeline, DEFAULT_CONVERSATION_TIMELINE_MESSAGES, computeTotals, formatCost } from './ConversationTimeline';
export type { ConversationTimelineProps, ConversationTimelineMessages, ConversationStep, StepType, StepStatus, StepTokens, Totals } from './ConversationTimeline';
export { InlineEditList, DEFAULT_INLINE_EDIT_LIST_MESSAGES } from './InlineEditList';
export type { InlineEditListProps, InlineEditListMessages, InlineEditItem, InlineEditChange, InlineEditorContext } from './InlineEditList';
export { LocaleSwitcher, localeDirection, DEFAULT_LOCALE_SWITCHER_MESSAGES } from './LocaleSwitcher';
export type { LocaleSwitcherProps, LocaleSwitcherMessages, LocaleOption } from './LocaleSwitcher';
