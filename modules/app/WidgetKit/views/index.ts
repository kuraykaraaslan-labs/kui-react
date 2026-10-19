// Every builtin widget type's view, keyed by type. Templates are in ../templates/index.ts.
import type { WidgetKindView } from '../kind';
import { CHART_LINE_VIEW } from './LineChartView';
import { CHART_BAR_VIEW } from './BarChartView';
import { CHART_AREA_VIEW } from './AreaChartView';
import { CHART_PIE_VIEW } from './PieChartView';
import { CHART_SCATTER_VIEW } from './ScatterChartView';
import { CHART_HISTOGRAM_VIEW } from './HistogramChartView';
import { HEATMAP_VIEW } from './HeatmapView';
import { STAT_VALUE_VIEW } from './StatValueView';
import { STAT_SPARKLINE_VIEW } from './StatSparklineView';
import { STAT_ATTRIBUTES_VIEW } from './StatAttributesView';
import { PROGRESS_VIEW } from './ProgressView';
import { GAUGE_VIEW } from './GaugeView';
import { STATE_VIEW } from './StateView';
import { DATA_TABLE_VIEW } from './DataTableView';
import { DATA_FEED_VIEW } from './DataFeedView';
import { MAP_VIEW } from './MapView';
import { VIEWER_MODEL_VIEW } from './ViewerModelView';
import { CONTENT_MARKDOWN_VIEW } from './ContentMarkdownView';
import { CONTENT_IMAGE_VIEW } from './ContentImageView';
import { CONTENT_LINKS_VIEW } from './ContentLinksView';
import { CONTENT_EMBED_VIEW } from './ContentEmbedView';
import { CONTENT_VIDEO_VIEW } from './ContentVideoView';
import { CONTROL_BUTTON_VIEW } from './ControlButtonView';
import { CONTROL_SWITCH_VIEW } from './ControlSwitchView';
import { CONTROL_SLIDER_VIEW } from './ControlSliderView';
import { CONTROL_SETPOINT_VIEW } from './ControlSetpointView';

export const BUILTIN_VIEWS: Readonly<Record<string, WidgetKindView>> = {
  'chart.line': CHART_LINE_VIEW,
  'chart.bar': CHART_BAR_VIEW,
  'chart.area': CHART_AREA_VIEW,
  'chart.pie': CHART_PIE_VIEW,
  'chart.scatter': CHART_SCATTER_VIEW,
  'chart.histogram': CHART_HISTOGRAM_VIEW,
  'heatmap': HEATMAP_VIEW,
  'stat.value': STAT_VALUE_VIEW,
  'stat.sparkline': STAT_SPARKLINE_VIEW,
  'stat.attributes': STAT_ATTRIBUTES_VIEW,
  'progress': PROGRESS_VIEW,
  'gauge': GAUGE_VIEW,
  'state': STATE_VIEW,
  'data.table': DATA_TABLE_VIEW,
  'data.feed': DATA_FEED_VIEW,
  'map': MAP_VIEW,
  'viewer.model': VIEWER_MODEL_VIEW,
  'content.markdown': CONTENT_MARKDOWN_VIEW,
  'content.image': CONTENT_IMAGE_VIEW,
  'content.links': CONTENT_LINKS_VIEW,
  'content.embed': CONTENT_EMBED_VIEW,
  'content.video': CONTENT_VIDEO_VIEW,
  'control.button': CONTROL_BUTTON_VIEW,
  'control.switch': CONTROL_SWITCH_VIEW,
  'control.slider': CONTROL_SLIDER_VIEW,
  'control.setpoint': CONTROL_SETPOINT_VIEW,
};
