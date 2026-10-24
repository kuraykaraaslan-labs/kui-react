'use client';
import type { ShowcaseComponent } from '../showcase.types';
import { DeviceStatusBadge } from '@/modules/domains/iot/device/DeviceStatusBadge';
import { DeviceTypeBadge } from '@/modules/domains/iot/device/DeviceTypeBadge';
import { DeviceCard } from '@/modules/domains/iot/device/DeviceCard';
import { CloudWorkspaceCard } from '@/modules/domains/iot/workspace/CloudWorkspaceCard';
import { RulesetEditor } from '@/modules/app/RulesetEditor/RulesetEditor';
import { MetricSparklineCard } from '@/modules/domains/iot/telemetry/MetricSparklineCard';
import { TelemetryTimeSeriesChart } from '@/modules/domains/iot/telemetry/TelemetryTimeSeriesChart';
import { LogStreamRow } from '@/modules/domains/iot/telemetry/LogStreamRow';
import { buildIoTPlatformEntries } from './domain-iot-platform.showcase';
import { DEMO_CATALOG, DEMO_CHOICES, DEMO_FLOW } from '@/modules/app/RulesetEditor/demo';
import type { Device, CloudWorkspace, RuleNode, RuleEdge } from '@/modules/domains/iot/types';

/** the demo flow with its blocks thrown about, to try "Arrange the blocks" */
const SCRAMBLED_NODES: RuleNode[] = DEMO_FLOW.nodes.map((n, i) => ({ ...n, x: 30 + ((i * 3) % 5) * 150, y: 30 + ((i * 5) % 4) * 90 + (i % 2) * 20 }));

/* ─── demo data ─── */

// Fixed anchor rather than Date.now(): every "lastSeenAt"/"at"/"timestamp"
// below is an offset from this instant, so the demo keeps its relative
// ordering (e.g. "5 minutes before resolved") without the absolute times it
// displays drifting on every render — which showed up as a real visual
// regression flake (tests/visual/showcase.spec.ts screenshotting a
// different wall-clock time on each run).
const DEMO_NOW = new Date('2026-05-03T19:20:00Z').getTime();

const DEMO_DEVICE_ONLINE: Device = {
  deviceId: 'dev-demo-001',
  name: 'Press Line Sensor A1',
  slug: 'press-line-sensor-a1',
  type: 'INTERNAL',
  role: 'DEVICE',
  status: 'ONLINE',
  cloudId: 'cloud-demo',
  model: 'Nexus S200',
  firmware: 'v2.4.1',
  tags: ['production', 'critical'],
  location: { lat: 52.52, lng: 13.405, label: 'Hall A — Bay 3' },
  lastSeenAt: new Date(DEMO_NOW - 45_000),
};

const DEMO_DEVICE_ERROR: Device = {
  deviceId: 'dev-demo-002',
  name: 'Coolant Temp Monitor',
  slug: 'coolant-temp-monitor',
  type: 'INTERNAL',
  role: 'DEVICE',
  status: 'ERROR',
  cloudId: 'cloud-demo',
  model: 'Nexus T100',
  firmware: 'v2.3.8',
  tags: ['coolant', 'temperature'],
  location: { lat: 52.519, lng: 13.404, label: 'Hall A — Coolant Station' },
  lastSeenAt: new Date(DEMO_NOW - 720_000),
};

const DEMO_GATEWAY: Device = {
  deviceId: 'dev-demo-003',
  name: 'Assembly Robot Gateway',
  slug: 'assembly-robot-gateway',
  type: 'INTERNAL',
  role: 'GATEWAY',
  status: 'ONLINE',
  cloudId: 'cloud-demo',
  model: 'Nexus GW500',
  firmware: 'v3.1.0',
  tags: ['assembly', 'gateway'],
  lastSeenAt: new Date(DEMO_NOW - 12_000),
};

const DEMO_WORKSPACE_ACTIVE: CloudWorkspace = {
  cloudId: 'cloud-demo-001',
  name: 'Smart Factory Alpha',
  slug: 'smart-factory-alpha',
  status: 'ACTIVE',
  plan: 'ENTERPRISE',
  deviceCount: 142,
  onlineCount: 138,
  memberCount: 12,
  customDomain: 'iot.acme-factory.com',
  region: 'EU-West',
};

const DEMO_WORKSPACE_SUSPENDED: CloudWorkspace = {
  cloudId: 'cloud-demo-002',
  name: 'Legacy Pilot',
  slug: 'legacy-pilot',
  status: 'SUSPENDED',
  plan: 'FREE',
  deviceCount: 4,
  onlineCount: 0,
  memberCount: 1,
  region: 'US-West',
};

/* ─── rule engine demo data ─── */

const DEMO_NODES: RuleNode[] = [
  { nodeId: 'n1', type: 'TRIGGER',   label: 'MQTT Ingress',   x: 30,  y: 60  },
  { nodeId: 'n2', type: 'FILTER',    label: 'Temp > 85 °C',   x: 240, y: 60  },
  { nodeId: 'n3', type: 'ACTION',    label: 'Send Alert',     x: 460, y: 20  },
  { nodeId: 'n4', type: 'ACTION',    label: 'Log Reading',    x: 460, y: 140 },
];

const DEMO_EDGES: RuleEdge[] = [
  { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',   targetNodeId: 'n2', targetPort: 'in' },
  { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'true',  targetNodeId: 'n3', targetPort: 'in' },
  { edgeId: 'e3', sourceNodeId: 'n2', sourcePort: 'false', targetNodeId: 'n4', targetPort: 'in' },
];

/* ─── showcase builder ─── */

export function buildIoTDomainData(): ShowcaseComponent[] {
  return [
    {
      id: 'iot-device-status-badge',
      title: 'DeviceStatusBadge',
      category: 'Domain',
      abbr: 'DS',
      description: 'Displays device connectivity state — Online, Offline, Error, or Maintenance.',
      filePath: 'modules/domains/iot/device/DeviceStatusBadge.tsx',
      sourceCode: `'use client';
import { Badge } from '@/modules/ui/Badge';
import type { DeviceStatus } from '../types';

export function DeviceStatusBadge({ status, size = 'md', className }) {
  // ...
}`,
      variants: [
        {
          title: 'All states',
          layout: 'side',
          preview: (
            <div className="flex flex-wrap gap-2">
              <DeviceStatusBadge status="ONLINE" />
              <DeviceStatusBadge status="OFFLINE" />
              <DeviceStatusBadge status="ERROR" />
              <DeviceStatusBadge status="MAINTENANCE" />
            </div>
          ),
          code: `<DeviceStatusBadge status="ONLINE" />
<DeviceStatusBadge status="OFFLINE" />
<DeviceStatusBadge status="ERROR" />
<DeviceStatusBadge status="MAINTENANCE" />`,
        },
        {
          title: 'Small size',
          layout: 'side',
          preview: (
            <div className="flex flex-wrap gap-2">
              <DeviceStatusBadge status="ONLINE" size="sm" />
              <DeviceStatusBadge status="ERROR" size="sm" />
            </div>
          ),
          code: `<DeviceStatusBadge status="ONLINE" size="sm" />
<DeviceStatusBadge status="ERROR" size="sm" />`,
        },
      ],
    },
    {
      id: 'iot-device-type-badge',
      title: 'DeviceTypeBadge',
      category: 'Domain',
      abbr: 'DT',
      description: 'Indicates device origin — Internal first-party hardware, third-party Integration, or External feed.',
      filePath: 'modules/domains/iot/device/DeviceTypeBadge.tsx',
      sourceCode: `'use client';
import { Badge } from '@/modules/ui/Badge';
import type { DeviceType } from '../types';

export function DeviceTypeBadge({ type, size = 'md', className }) {
  // ...
}`,
      variants: [
        {
          title: 'All types',
          layout: 'side',
          preview: (
            <div className="flex flex-wrap gap-2">
              <DeviceTypeBadge type="INTERNAL" />
              <DeviceTypeBadge type="INTEGRATION" />
              <DeviceTypeBadge type="EXTERNAL" />
            </div>
          ),
          code: `<DeviceTypeBadge type="INTERNAL" />
<DeviceTypeBadge type="INTEGRATION" />
<DeviceTypeBadge type="EXTERNAL" />`,
        },
        {
          title: 'Small size',
          layout: 'side',
          preview: (
            <div className="flex flex-wrap gap-2">
              <DeviceTypeBadge type="INTERNAL" size="sm" />
              <DeviceTypeBadge type="INTEGRATION" size="sm" />
            </div>
          ),
          code: `<DeviceTypeBadge type="INTERNAL" size="sm" />
<DeviceTypeBadge type="INTEGRATION" size="sm" />`,
        },
      ],
    },
    {
      id: 'iot-device-card',
      title: 'DeviceCard',
      category: 'Domain',
      abbr: 'DC',
      description: 'Compact device summary card showing status, type, location, last-seen time and tags.',
      filePath: 'modules/domains/iot/device/DeviceCard.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { DeviceTypeBadge } from './DeviceTypeBadge';
import type { Device } from '../types';

export function DeviceCard({ device, className, onClick }) {
  // ...
}`,
      variants: [
        {
          title: 'Online device',
          layout: 'side',
          preview: (
            <div className="max-w-xs">
              <DeviceCard device={DEMO_DEVICE_ONLINE} />
            </div>
          ),
          code: `<DeviceCard device={device} />`,
        },
        {
          title: 'Error + Gateway',
          layout: 'side',
          preview: (
            <div className="flex flex-col gap-3 max-w-xs">
              <DeviceCard device={DEMO_DEVICE_ERROR} />
              <DeviceCard device={DEMO_GATEWAY} />
            </div>
          ),
          code: `<DeviceCard device={errorDevice} />
<DeviceCard device={gatewayDevice} />`,
        },
      ],
    },
    {
      id: 'iot-cloud-workspace-card',
      title: 'CloudWorkspaceCard',
      category: 'Domain',
      abbr: 'CW',
      description: 'Cloud workspace overview card — status, plan, device counts with online progress bar.',
      filePath: 'modules/domains/iot/workspace/CloudWorkspaceCard.tsx',
      sourceCode: `'use client';
import { cn } from '@/libs/utils/cn';
import { Badge } from '@/modules/ui/Badge';
import type { CloudWorkspace } from '../types';

export function CloudWorkspaceCard({ workspace, className, onClick }) {
  // ...
}`,
      variants: [
        {
          title: 'Active workspace',
          layout: 'side',
          preview: (
            <div className="max-w-sm">
              <CloudWorkspaceCard workspace={DEMO_WORKSPACE_ACTIVE} />
            </div>
          ),
          code: `<CloudWorkspaceCard workspace={workspace} />`,
        },
        {
          title: 'Suspended workspace',
          layout: 'side',
          preview: (
            <div className="max-w-sm">
              <CloudWorkspaceCard workspace={DEMO_WORKSPACE_SUSPENDED} />
            </div>
          ),
          code: `<CloudWorkspaceCard workspace={suspendedWorkspace} />`,
        },
      ],
    },
    {
      id: 'iot-ruleset-editor',
      title: 'RulesetEditor',
      category: 'Domain',
      abbr: 'RE',
      description: 'Drag-and-drop visual rule chain editor. The blocks come from a catalog (typed blocks with params), each block has a form built from its schema, and the editor has undo, multi-select, groups, flows that run each other and validation.',
      filePath: 'modules/app/RulesetEditor/RulesetEditor/index.tsx',
      sourceCode: `'use client';
// Drag blocks from the palette onto the canvas, or right-click for "Add a block here…".
// Click an output port (filled) and then an input port (hollow) to wire them.
// Click a connection to select it; Delete removes it. Shift or Ctrl click selects several nodes.
// Ctrl+Z undoes, Ctrl+Y redoes. Right-click a node to group, skip, copy or duplicate it.

export function RulesetEditor({
  initialNodes, initialEdges, initialGroups,
  catalog, choices, active, onChange, readOnly, className,
}) {
  // ...
}`,
      variants: [
        {
          title: 'With pre-loaded chain',
          layout: 'stack',
          preview: (
            <div className="h-72 w-full rounded-xl overflow-hidden border border-border">
              <RulesetEditor
                initialNodes={DEMO_NODES}
                initialEdges={DEMO_EDGES}
              />
            </div>
          ),
          code: `<RulesetEditor
  initialNodes={nodes}
  initialEdges={edges}
/>`,
        },
        {
          title: 'Block catalog, param forms, a group and a Run flow block',
          layout: 'stack',
          preview: (
            <div className="h-[28rem] w-full rounded-xl overflow-hidden border border-border">
              <RulesetEditor
                catalog={DEMO_CATALOG}
                choices={DEMO_CHOICES}
                initialNodes={DEMO_FLOW.nodes}
                initialEdges={DEMO_FLOW.edges}
                initialGroups={DEMO_FLOW.groups}
                chainName="Boiler demo"
              />
            </div>
          ),
          code: `<RulesetEditor
  catalog={catalog}            // blocks with typed params, from data
  choices={{ brokers: [...] }} // lists for source fields
  initialNodes={nodes}
  initialEdges={edges}
  initialGroups={groups}
  active={chain.active}        // a missing required param is then an error
  onChange={(graph) => save(graph)}
/>`,
        },
        {
          title: 'Arrange, mini map, box select and snap',
          layout: 'stack',
          preview: (
            <div className="h-[28rem] w-full rounded-xl overflow-hidden border border-border">
              <RulesetEditor
                catalog={DEMO_CATALOG}
                choices={DEMO_CHOICES}
                initialNodes={SCRAMBLED_NODES}
                initialEdges={DEMO_FLOW.edges}
                chainName="Scrambled demo"
              />
            </div>
          ),
          code: `// The blocks are scattered: press "Arrange the blocks" (bottom right) for a layered layout, one undo step.
// Shift / Ctrl / ⌘ and drag on the empty canvas draws a selection frame; the frame button does it with one finger.
// Drag a block: it snaps to a 12 px grid and to the edges of other blocks (guide lines); hold Alt to move freely.
// The mini map shows above 30 blocks or when blocks leave the view; the binoculars button toggles it.
const ref = useRef<RulesetEditorRef>(null);
<RulesetEditor ref={ref} catalog={catalog} initialNodes={nodes} initialEdges={edges}
  onSelectionChange={(ids) => setSelected(ids)}
  nodeMenuItems={({ nodeIds }) => [{ kind: 'item', label: 'Open live data', onSelect: () => open(nodeIds) }]}
  toolbarExtra={<MyButton />} bannerSlot={<DraftBanner />} />
ref.current?.arrange(); ref.current?.select(['n1']); ref.current?.reveal('n4');`,
        },
        {
          title: 'Read only',
          layout: 'stack',
          preview: (
            <div className="h-64 w-full rounded-xl overflow-hidden border border-border">
              <RulesetEditor
                readOnly
                catalog={DEMO_CATALOG}
                choices={DEMO_CHOICES}
                initialNodes={DEMO_FLOW.nodes}
                initialEdges={DEMO_FLOW.edges}
                initialGroups={DEMO_FLOW.groups}
              />
            </div>
          ),
          code: `<RulesetEditor readOnly catalog={catalog} initialNodes={nodes} initialEdges={edges} />`,
        },
        {
          title: 'Empty canvas (editable)',
          layout: 'stack',
          preview: (
            <div className="h-64 w-full rounded-xl overflow-hidden border border-border">
              <RulesetEditor />
            </div>
          ),
          code: `<RulesetEditor />`,
        },
      ],
    },
    {
      id: 'iot-metric-sparkline-card',
      title: 'MetricSparklineCard',
      category: 'Domain',
      abbr: 'MS',
      description: 'KPI tile with current value, unit, delta-vs-prev, and an inline SVG sparkline. No deps.',
      filePath: 'modules/domains/iot/telemetry/MetricSparklineCard.tsx',
      sourceCode: `import { MetricSparklineCard } from '@/modules/domains/iot/telemetry/MetricSparklineCard';
<MetricSparklineCard label="CPU" value={36} unit="%" series={[28,30,33,...]} deltaPct={5.2} goodWhen="down" />`,
      variants: [
        {
          title: 'Four KPIs',
          layout: 'stack',
          preview: (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricSparklineCard label="CPU"        value={36}  unit="%"   series={[28, 30, 33, 31, 36, 38, 35, 34, 37, 36]} deltaPct={5.2}  goodWhen="down" />
              <MetricSparklineCard label="Memory"     value={63}  unit="%"   series={[58, 60, 61, 62, 60, 63, 64, 62, 61, 63]} deltaPct={1.8}  goodWhen="down" />
              <MetricSparklineCard label="Network"    value={148} unit="kb/s" series={[120, 130, 110, 140, 138, 142, 150, 144, 150, 148]} deltaPct={-3.1} goodWhen="up" />
              <MetricSparklineCard label="Temp"       value={66}  unit="°C"  series={[62, 63, 64, 66, 68, 67, 69, 66]} deltaPct={4.4} goodWhen="down" />
            </div>
          ),
          code: `<MetricSparklineCard label="CPU" value={36} unit="%" series={[...]} deltaPct={5.2} goodWhen="down" />`,
        },
        {
          title: 'No delta',
          layout: 'stack',
          preview: (
            <div className="max-w-xs">
              <MetricSparklineCard label="Idle metric" value="—" series={[1, 1, 1, 1]} />
            </div>
          ),
          code: `<MetricSparklineCard label="Idle metric" value="—" series={[1,1,1,1]} />`,
        },
      ],
    },
    {
      id: 'iot-telemetry-time-series-chart',
      title: 'TelemetryTimeSeriesChart',
      category: 'Domain',
      abbr: 'TS',
      description: 'Multi-line time-series chart built on chart.js. Supports any number of series with custom colors.',
      filePath: 'modules/domains/iot/telemetry/TelemetryTimeSeriesChart.tsx',
      sourceCode: `import { TelemetryTimeSeriesChart } from '@/modules/domains/iot/telemetry/TelemetryTimeSeriesChart';
<TelemetryTimeSeriesChart title="..." labels={['12:00', ...]} series={[{ label, color, data }]} />`,
      variants: [
        {
          title: 'Vibration / Temp / RPM',
          layout: 'stack',
          preview: (
            <TelemetryTimeSeriesChart
              title="Vibration, temperature, RPM"
              subtitle="Last 35 minutes · 5-minute resolution"
              labels={['12:00', '12:05', '12:10', '12:15', '12:20', '12:25', '12:30', '12:35']}
              series={[
                { label: 'Vibration (G)',  color: 'rgba(239, 68, 68, 1)',  data: [0.9, 1.1, 1.0, 1.2, 1.4, 1.3, 1.5, 1.2] },
                { label: 'Temperature (°C × 0.1)', color: 'rgba(245, 158, 11, 1)', data: [6.2, 6.3, 6.4, 6.6, 6.8, 6.7, 6.9, 6.6] },
                { label: 'RPM (× 0.01)',   color: 'rgba(59, 130, 246, 1)', data: [14.1, 14.3, 14.5, 14.7, 14.9, 14.8, 15, 14.6] },
              ]}
            />
          ),
          code: `<TelemetryTimeSeriesChart title="..." labels={[...]} series={[{ label, color, data }, ...]} />`,
        },
      ],
    },
    {
      id: 'iot-log-stream-row',
      title: 'LogStreamRow',
      category: 'Domain',
      abbr: 'LS',
      description: 'Monospace log entry: timestamp, level tag (DBG/INF/WRN/ERR/FTL), source, and message body.',
      filePath: 'modules/domains/iot/telemetry/LogStreamRow.tsx',
      sourceCode: `import { LogStreamRow } from '@/modules/domains/iot/telemetry/LogStreamRow';
<LogStreamRow timestamp={date} level="info" source="mqtt.client" message="..." />`,
      variants: [
        {
          title: 'All five levels',
          layout: 'stack',
          preview: (
            <ol className="rounded-xl border border-border overflow-hidden bg-surface-base max-w-3xl">
              <LogStreamRow timestamp={new Date(DEMO_NOW)} level="debug" source="sensor.driver" message="Read cycle 0x9F1 — within tolerance" />
              <LogStreamRow timestamp={new Date(DEMO_NOW)} level="info"  source="mqtt.client"   message="Published telemetry payload (4 fields, 218 bytes)" />
              <LogStreamRow timestamp={new Date(DEMO_NOW)} level="warn"  source="rule.engine"   message='Vibration trending up — re-check at next sample' />
              <LogStreamRow timestamp={new Date(DEMO_NOW)} level="error" source="firmware.watch" message="Calibration timer reset due to missed tick" />
              <LogStreamRow timestamp={new Date(DEMO_NOW)} level="fatal" source="kernel"        message="Subsystem panic — restarting in 5s" />
            </ol>
          ),
          code: `<LogStreamRow timestamp={date} level="warn" source="..." message="..." />`,
        },
      ],
    },
    ...buildIoTPlatformEntries(),
  ];
}
