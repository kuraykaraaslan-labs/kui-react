import type { Device, CloudWorkspace, Alarm, AlarmEvent, TelemetryReading, RuleChain } from '@/modules/domains/iot/types';
import type { LogLevel } from '@/modules/domains/iot/telemetry/LogStreamRow';
import { blankProfileDraft, type DeviceProfile } from '@/modules/domains/iot/types/profile';

/* ─── Cloud Workspaces ─── */

export const WORKSPACES: CloudWorkspace[] = [
  {
    cloudId: 'cloud-001',
    name: 'Smart Factory Alpha',
    slug: 'smart-factory-alpha',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    deviceCount: 142,
    onlineCount: 138,
    memberCount: 12,
    customDomain: 'iot.acme-factory.com',
    region: 'EU-West',
    createdAt: new Date('2024-03-15'),
  },
  {
    cloudId: 'cloud-002',
    name: 'Logistics Hub Berlin',
    slug: 'logistics-hub-berlin',
    status: 'ACTIVE',
    plan: 'PROFESSIONAL',
    deviceCount: 56,
    onlineCount: 51,
    memberCount: 6,
    region: 'EU-Central',
    createdAt: new Date('2024-08-01'),
  },
  {
    cloudId: 'cloud-003',
    name: 'Dev Sandbox',
    slug: 'dev-sandbox',
    status: 'ACTIVE',
    plan: 'STARTER',
    deviceCount: 8,
    onlineCount: 3,
    memberCount: 3,
    region: 'US-East',
    createdAt: new Date('2025-01-10'),
  },
  {
    cloudId: 'cloud-004',
    name: 'Legacy Pilot',
    slug: 'legacy-pilot',
    status: 'SUSPENDED',
    plan: 'FREE',
    deviceCount: 4,
    onlineCount: 0,
    memberCount: 1,
    region: 'US-West',
    createdAt: new Date('2023-11-20'),
  },
];

/* ─── Devices ─── */

export const DEVICES: Device[] = [
  {
    deviceId: 'dev-001',
    name: 'Press Line Sensor A1',
    slug: 'press-line-sensor-a1',
    type: 'INTERNAL',
    role: 'DEVICE',
    status: 'ONLINE',
    cloudId: 'cloud-001',
    model: 'Nexus S200',
    firmware: 'v2.4.1',
    tags: ['production', 'press-line', 'critical'],
    location: { lat: 52.52, lng: 13.405, label: 'Hall A — Bay 3' },
    lastSeenAt: new Date(Date.now() - 45_000),
    createdAt: new Date('2024-04-01'),
  },
  {
    deviceId: 'dev-002',
    name: 'Assembly Robot Gateway',
    slug: 'assembly-robot-gateway',
    type: 'INTERNAL',
    role: 'GATEWAY',
    status: 'ONLINE',
    cloudId: 'cloud-001',
    model: 'Nexus GW500',
    firmware: 'v3.1.0',
    tags: ['assembly', 'gateway', 'critical'],
    location: { lat: 52.521, lng: 13.406, label: 'Hall B — Control Room' },
    lastSeenAt: new Date(Date.now() - 12_000),
    createdAt: new Date('2024-04-01'),
  },
  {
    deviceId: 'dev-003',
    name: 'Coolant Temp Monitor',
    slug: 'coolant-temp-monitor',
    type: 'INTERNAL',
    role: 'DEVICE',
    status: 'ERROR',
    cloudId: 'cloud-001',
    model: 'Nexus T100',
    firmware: 'v2.3.8',
    tags: ['coolant', 'temperature'],
    location: { lat: 52.519, lng: 13.404, label: 'Hall A — Coolant Station' },
    lastSeenAt: new Date(Date.now() - 720_000),
    createdAt: new Date('2024-05-15'),
  },
  {
    deviceId: 'dev-004',
    name: 'Forklift Tracker #7',
    slug: 'forklift-tracker-7',
    type: 'INTEGRATION',
    role: 'DEVICE',
    status: 'ONLINE',
    cloudId: 'cloud-002',
    model: 'TrackUnit GO+',
    firmware: 'v1.9.3',
    tags: ['logistics', 'vehicle', 'gps'],
    location: { lat: 52.534, lng: 13.381, label: 'Warehouse Zone C' },
    lastSeenAt: new Date(Date.now() - 30_000),
    createdAt: new Date('2024-09-01'),
  },
  {
    deviceId: 'dev-005',
    name: 'Loading Dock Scale',
    slug: 'loading-dock-scale',
    type: 'INTERNAL',
    role: 'DEVICE',
    status: 'MAINTENANCE',
    cloudId: 'cloud-002',
    model: 'Nexus W300',
    firmware: 'v2.0.0',
    tags: ['logistics', 'weight'],
    location: { lat: 52.535, lng: 13.382, label: 'Dock 4' },
    lastSeenAt: new Date(Date.now() - 3_600_000),
    createdAt: new Date('2024-09-15'),
  },
  {
    deviceId: 'dev-006',
    name: 'Weather API Bridge',
    slug: 'weather-api-bridge',
    type: 'EXTERNAL',
    role: 'GATEWAY',
    status: 'ONLINE',
    cloudId: 'cloud-002',
    model: 'Integration Adapter',
    firmware: 'v1.2.0',
    tags: ['external', 'weather', 'integration'],
    lastSeenAt: new Date(Date.now() - 60_000),
    createdAt: new Date('2025-02-10'),
  },
  {
    deviceId: 'dev-007',
    name: 'Dev Prototype X',
    slug: 'dev-prototype-x',
    type: 'INTERNAL',
    role: 'DEVICE',
    status: 'OFFLINE',
    cloudId: 'cloud-003',
    model: 'Custom Board v0.3',
    firmware: 'v0.3.2-beta',
    tags: ['dev', 'prototype'],
    lastSeenAt: new Date(Date.now() - 86_400_000 * 2),
    createdAt: new Date('2025-01-15'),
  },
];

/* ─── Alarms (OD-9: the term is Alarm, five severities; renamed from ALERTS) ─── */

export const ALARMS: Alarm[] = [
  {
    alarmId: 'alarm-001',
    type: 'coolant_high',
    deviceId: 'dev-003',
    deviceName: 'Coolant Temp Monitor',
    severity: 'CRITICAL',
    status: 'OPEN',
    title: 'Temperature threshold exceeded',
    message: 'Coolant temperature reached 94°C — above the critical threshold of 85°C. Immediate inspection required.',
    origin: { kind: 'profileRule', profileId: 'prof-sensor', ruleId: 'rule-coolant', ruleName: 'Coolant > 85 °C' },
    openedAt: new Date(Date.now() - 720_000),
    occurrences: 14,
    flapping: false,
    runbook: '1. Check the coolant pump pressure on the HMI.\n2. If the pressure is normal, compare with the backup probe.\n3. Replace the probe if the two differ by more than 3 °C.\n4. Clear the alarm with a note.',
  },
  {
    alarmId: 'alarm-002',
    type: 'vibration_spike',
    deviceId: 'dev-001',
    deviceName: 'Press Line Sensor A1',
    severity: 'MAJOR',
    status: 'ACKNOWLEDGED',
    title: 'Vibration spike detected',
    message: 'Vibration reading exceeded 8.2 G on axis Z. Sensor A1 may require recalibration.',
    origin: { kind: 'flow', flowId: 'flow-press', nodeId: 'node-vib', flowName: 'Press line', nodeName: 'Vibration alarm' },
    topic: 'sensors/hall-2/vibration',
    openedAt: new Date(Date.now() - 3_600_000),
    acknowledgedAt: new Date(Date.now() - 1_800_000),
    occurrences: 3,
    flapping: false,
  },
  {
    alarmId: 'alarm-003',
    type: 'maintenance',
    deviceId: 'dev-005',
    deviceName: 'Loading Dock Scale',
    severity: 'INFO',
    status: 'RESOLVED',
    title: 'Scheduled maintenance started',
    message: 'Device entered maintenance mode at 06:00 UTC for firmware upgrade to v2.1.0.',
    origin: { kind: 'operator' },
    openedAt: new Date(Date.now() - 3_600_000),
    resolvedAt: new Date(Date.now() - 900_000),
    occurrences: 1,
    flapping: false,
  },
  {
    alarmId: 'alarm-004',
    type: 'queue_depth',
    deviceId: 'dev-002',
    deviceName: 'Assembly Robot Gateway',
    severity: 'MINOR',
    status: 'OPEN',
    title: 'High message queue depth',
    message: 'MQTT queue depth at 4,800 messages. Downstream consumer may be falling behind.',
    origin: { kind: 'profileRule', profileId: 'prof-gateway', ruleId: 'rule-queue', ruleName: 'Queue depth > 4 000' },
    openedAt: new Date(Date.now() - 900_000),
    occurrences: 2,
    flapping: true,
  },
  {
    alarmId: 'alarm-005',
    type: 'device_offline',
    deviceId: 'dev-007',
    deviceName: 'Dev Prototype X',
    severity: 'WARNING',
    status: 'OPEN',
    title: 'Device went offline',
    message: 'Device has not published telemetry for 48 hours. Expected during lab shutdown.',
    origin: { kind: 'profileRule', profileId: 'prof-sensor', ruleId: 'rule-offline', ruleName: 'Inactivity 30 min' },
    openedAt: new Date(Date.now() - 86_400_000 * 2),
    occurrences: 1,
    flapping: false,
  },
  {
    alarmId: 'alarm-006',
    type: 'battery_low',
    deviceId: 'dev-001',
    deviceName: 'Press Line Sensor A1',
    severity: 'INFO',
    status: 'OPEN',
    title: 'Backup battery below 30 %',
    origin: { kind: 'profileRule', profileId: 'prof-sensor', ruleId: 'rule-battery', ruleName: 'Battery < 30 %' },
    openedAt: new Date(Date.now() - 5_400_000),
    occurrences: 1,
    flapping: false,
  },
];

/* ─── Telemetry ─── */

export const TELEMETRY_READINGS: TelemetryReading[] = [
  {
    readingId: 'tel-001',
    topic: 'DEVICE_TELEMETRY',
    deviceId: 'dev-001',
    timestamp: new Date(Date.now() - 45_000),
    payload: { vibration_x: 1.2, vibration_y: 0.8, vibration_z: 2.1, rpm: 1450 },
  },
  {
    readingId: 'tel-002',
    topic: 'DEVICE_TELEMETRY',
    deviceId: 'dev-001',
    timestamp: new Date(Date.now() - 105_000),
    payload: { vibration_x: 1.1, vibration_y: 0.9, vibration_z: 1.9, rpm: 1448 },
  },
  {
    readingId: 'tel-003',
    topic: 'GATEWAY_TELEMETRY',
    deviceId: 'dev-002',
    timestamp: new Date(Date.now() - 12_000),
    payload: { connected_devices: 24, messages_per_sec: 320, uptime_s: 1_234_567 },
  },
  {
    readingId: 'tel-004',
    topic: 'DEVICE_TELEMETRY',
    deviceId: 'dev-004',
    timestamp: new Date(Date.now() - 30_000),
    payload: { speed_kmh: 12.4, lat: 52.534, lng: 13.381, battery_pct: 87 },
  },
];

/* ─── Rule Chains ─── */

export const RULE_CHAINS: RuleChain[] = [
  {
    chainId: 'chain-001',
    name: 'Temperature Alert',
    slug: 'temperature-alert',
    description: 'Triggers critical alerts when coolant temperature exceeds the configured threshold.',
    active: true,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',   label: 'MQTT Ingress',    x: 60,  y: 80  },
      { nodeId: 'n2', type: 'FILTER',    label: 'Temp > 85 °C',    x: 290, y: 80  },
      { nodeId: 'n3', type: 'TRANSFORM', label: 'Format Payload',  x: 520, y: 30  },
      { nodeId: 'n4', type: 'ACTION',    label: 'Send Alert',      x: 750, y: 30  },
      { nodeId: 'n5', type: 'ACTION',    label: 'Log Reading',     x: 520, y: 155 },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',   targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'true',  targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n3', sourcePort: 'out',   targetNodeId: 'n4', targetPort: 'in' },
      { edgeId: 'e4', sourceNodeId: 'n2', sourcePort: 'false', targetNodeId: 'n5', targetPort: 'in' },
    ],
    createdAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-04-22'),
  },
  {
    chainId: 'chain-002',
    name: 'Forklift Zone Monitor',
    slug: 'forklift-zone-monitor',
    description: 'Routes GPS telemetry through geofence zones and raises violations on boundary breaches.',
    active: true,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',   label: 'GPS Telemetry',   x: 60,  y: 110 },
      { nodeId: 'n2', type: 'SWITCH',    label: 'Zone Check',      x: 280, y: 60  },
      { nodeId: 'n3', type: 'ACTION',    label: 'Zone A Handler',  x: 520, y: 20  },
      { nodeId: 'n4', type: 'ACTION',    label: 'Zone B Handler',  x: 520, y: 120 },
      { nodeId: 'n5', type: 'ACTION',    label: 'Violation Alert', x: 520, y: 220 },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out', targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'c1',  targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n2', sourcePort: 'c2',  targetNodeId: 'n4', targetPort: 'in' },
      { edgeId: 'e4', sourceNodeId: 'n2', sourcePort: 'def', targetNodeId: 'n5', targetPort: 'in' },
    ],
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-05-10'),
  },
  {
    chainId: 'chain-003',
    name: 'Telemetry Normalizer',
    slug: 'telemetry-normalizer',
    description: 'Normalizes raw sensor units, enriches with device metadata, then persists to the time-series database.',
    active: false,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',    label: 'Device Telemetry',   x: 60,  y: 100 },
      { nodeId: 'n2', type: 'TRANSFORM',  label: 'Normalize Units',    x: 280, y: 100 },
      { nodeId: 'n3', type: 'ENRICHMENT', label: 'Fetch Device Meta',  x: 500, y: 60  },
      { nodeId: 'n4', type: 'SAVE_TS',    label: 'Persist Reading',    x: 720, y: 20  },
      { nodeId: 'n5', type: 'ACTION',     label: 'Log Enrich Error',   x: 720, y: 160 },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',     targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'out',     targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n3', sourcePort: 'success', targetNodeId: 'n4', targetPort: 'in' },
      { edgeId: 'e4', sourceNodeId: 'n3', sourcePort: 'failure', targetNodeId: 'n5', targetPort: 'in' },
    ],
    createdAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-03-08'),
  },
  {
    chainId: 'chain-004',
    name: 'VPN Auth Gate',
    slug: 'vpn-auth-gate',
    description: 'Validates device certificates on VPN connection and routes to provisioning or rejection.',
    active: true,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',   label: 'VPN Connect',     x: 60,  y: 80  },
      { nodeId: 'n2', type: 'FILTER',    label: 'Cert Valid?',      x: 290, y: 80  },
      { nodeId: 'n3', type: 'ACTION',    label: 'Provision Device', x: 520, y: 30,
        config: { endpoint: 'https://provisioner:Pr0v1sion!@provision.example.com/api/devices' } },
      { nodeId: 'n4', type: 'ACTION',    label: 'Reject + Log',     x: 520, y: 155 },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',   targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'true',  targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n2', sourcePort: 'false', targetNodeId: 'n4', targetPort: 'in' },
    ],
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-02-05'),
  },
  {
    chainId: 'chain-005',
    name: 'Device Health Monitor',
    slug: 'device-health-monitor',
    description: 'Polls device heartbeats, enriches with fleet metadata, and raises or clears health alarms automatically.',
    active: true,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',    label: 'Heartbeat Poll',     x: 60,  y: 130 },
      { nodeId: 'n2', type: 'ENRICHMENT', label: 'Fetch Device Info',  x: 280, y: 130 },
      { nodeId: 'n3', type: 'FILTER',     label: 'Status Healthy?',    x: 500, y: 70  },
      { nodeId: 'n4', type: 'ALARM',      label: 'Clear Health Alarm', x: 720, y: 20  },
      { nodeId: 'n5', type: 'ALARM',      label: 'Raise Health Alarm', x: 720, y: 160 },
      { nodeId: 'n6', type: 'REST_API',   label: 'Notify Webhook',     x: 940, y: 160,
        config: { url: 'https://hooks.example.com/fleet-health', method: 'POST', authToken: 'whk_live_7Fq2x9LmP0aZ' } },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',     targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'success', targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n3', sourcePort: 'true',    targetNodeId: 'n4', targetPort: 'in' },
      { edgeId: 'e4', sourceNodeId: 'n3', sourcePort: 'false',   targetNodeId: 'n5', targetPort: 'in' },
      { edgeId: 'e5', sourceNodeId: 'n5', sourcePort: 'created', targetNodeId: 'n6', targetPort: 'in' },
    ],
    createdAt: new Date('2026-04-15'),
    updatedAt: new Date('2026-05-12'),
  },
  {
    chainId: 'chain-006',
    name: 'Telemetry Archiver',
    slug: 'telemetry-archiver',
    description: 'Buffers incoming telemetry for 10 minutes before batch-writing to the archive, with timeout alerting.',
    active: false,
    nodes: [
      { nodeId: 'n1', type: 'TRIGGER',   label: 'All Telemetry',     x: 60,  y: 100 },
      { nodeId: 'n2', type: 'TRANSFORM', label: 'Compress Payload',  x: 280, y: 100 },
      { nodeId: 'n3', type: 'DELAY',     label: 'Buffer 10 min',     x: 500, y: 100 },
      { nodeId: 'n4', type: 'SAVE_TS',   label: 'Write Archive',     x: 720, y: 40  },
      { nodeId: 'n5', type: 'ACTION',    label: 'Alert on Timeout',  x: 720, y: 190 },
    ],
    edges: [
      { edgeId: 'e1', sourceNodeId: 'n1', sourcePort: 'out',     targetNodeId: 'n2', targetPort: 'in' },
      { edgeId: 'e2', sourceNodeId: 'n2', sourcePort: 'out',     targetNodeId: 'n3', targetPort: 'in' },
      { edgeId: 'e3', sourceNodeId: 'n3', sourcePort: 'out',     targetNodeId: 'n4', targetPort: 'in' },
      { edgeId: 'e4', sourceNodeId: 'n3', sourcePort: 'timeout', targetNodeId: 'n5', targetPort: 'in' },
    ],
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-11'),
  },
];

/* ─── Telemetry metrics & logs (for /devices/[slug]/metrics) ─── */

export type DeviceMetricsBundle = {
  deviceId: string;
  labels: string[];
  vibration: number[];
  temperature: number[];
  rpm: number[];
  sparklines: {
    cpu: number[];
    memory: number[];
    network: number[];
  };
  currentValues: {
    cpuPct: number;
    memoryPct: number;
    networkKbps: number;
    temperatureC: number;
  };
  logs: {
    timestamp: string;
    level: LogLevel;
    source: string;
    message: string;
  }[];
};

export const DEVICE_METRICS: Record<string, DeviceMetricsBundle> = {
  'press-line-sensor-a1': {
    deviceId: 'dev-001',
    labels: ['12:00', '12:05', '12:10', '12:15', '12:20', '12:25', '12:30', '12:35'],
    vibration:   [0.9, 1.1, 1.0, 1.2, 1.4, 1.3, 1.5, 1.2],
    temperature: [62, 63, 64, 66, 68, 67, 69, 66],
    rpm:         [1410, 1430, 1450, 1470, 1490, 1480, 1500, 1460],
    sparklines: {
      cpu:     [28, 30, 33, 31, 36, 38, 35, 34, 37, 36],
      memory:  [58, 60, 61, 62, 60, 63, 64, 62, 61, 63],
      network: [120, 130, 110, 140, 138, 142, 150, 144, 150, 148],
    },
    currentValues: {
      cpuPct: 36,
      memoryPct: 63,
      networkKbps: 148,
      temperatureC: 66,
    },
    logs: [
      { timestamp: new Date(Date.now() - 1000).toISOString(),    level: 'info',  source: 'mqtt.client',    message: 'Published telemetry payload (4 fields, 218 bytes)' },
      { timestamp: new Date(Date.now() - 4500).toISOString(),    level: 'debug', source: 'sensor.driver',  message: 'Read cycle 0x9F2 — within tolerance' },
      { timestamp: new Date(Date.now() - 8200).toISOString(),    level: 'warn',  source: 'rule.engine',    message: 'Vibration trending up — re-check at next sample' },
      { timestamp: new Date(Date.now() - 12500).toISOString(),   level: 'info',  source: 'mqtt.client',    message: 'Published telemetry payload (4 fields, 218 bytes)' },
      { timestamp: new Date(Date.now() - 16000).toISOString(),   level: 'error', source: 'firmware.watch', message: 'Calibration timer reset due to missed tick' },
      { timestamp: new Date(Date.now() - 19500).toISOString(),   level: 'info',  source: 'system',         message: 'Heartbeat sent (uptime 14d 7h)' },
      { timestamp: new Date(Date.now() - 23000).toISOString(),   level: 'debug', source: 'sensor.driver',  message: 'Read cycle 0x9F1 — within tolerance' },
    ],
  },
};

/* ─── Alarm timelines (for /alarms/[id]); every seeded alarm has one ─── */

export const ALARM_EVENTS: Record<string, AlarmEvent[]> = {
  'alarm-001': [
    {
      eventId: 'evt-1',
      kind: 'opened',
      by: 'rule-engine',
      at: new Date(Date.now() - 720_000).toISOString(),
      note: 'Triggered by rule "Coolant > 85°C" (chain: Critical Temp Alarms).',
    },
    {
      eventId: 'evt-2',
      kind: 'automation',
      by: 'paging-bot',
      at: new Date(Date.now() - 700_000).toISOString(),
      note: 'On-call rotation "EU-West / Production" paged via SMS + Slack.',
    },
    {
      eventId: 'evt-3',
      kind: 'note',
      by: 'jane.k',
      at: new Date(Date.now() - 540_000).toISOString(),
      note: 'Investigating — coolant pump pressure looks normal. Possible sensor fault.',
    },
  ],
  'alarm-002': [
    {
      eventId: 'evt-1',
      kind: 'opened',
      by: 'rule-engine',
      at: new Date(Date.now() - 3_600_000).toISOString(),
      note: 'Vibration axis Z > 8.0 G — Press Line Sensor A1.',
    },
    {
      eventId: 'evt-2',
      kind: 'acknowledged',
      by: 'mike.t',
      at: new Date(Date.now() - 1_800_000).toISOString(),
      note: 'Investigating; checking recalibration log.',
    },
  ],
  'alarm-003': [
    { eventId: 'evt-1', kind: 'opened', by: 'operator anna.s', at: new Date(Date.now() - 3_600_000).toISOString(), note: 'Maintenance window opened by hand.' },
    { eventId: 'evt-2', kind: 'resolved', by: 'anna.s', at: new Date(Date.now() - 900_000).toISOString(), note: 'Firmware v2.1.0 installed, scale back in service.' },
  ],
  'alarm-004': [
    { eventId: 'evt-1', kind: 'opened', by: 'default flow', at: new Date(Date.now() - 900_000).toISOString() },
    { eventId: 'evt-2', kind: 'flapping', by: 'default flow', at: new Date(Date.now() - 600_000).toISOString(), note: 'Cleared and re-opened 4 times in 10 minutes; clears are held back.' },
  ],
  'alarm-005': [
    { eventId: 'evt-1', kind: 'opened', by: 'default flow', at: new Date(Date.now() - 86_400_000 * 2).toISOString() },
    { eventId: 'evt-2', kind: 'notified', by: 'platform', at: new Date(Date.now() - 86_400_000 * 2 + 5_000).toISOString() },
  ],
  'alarm-006': [
    { eventId: 'evt-1', kind: 'opened', by: 'default flow', at: new Date(Date.now() - 5_400_000).toISOString() },
    { eventId: 'evt-2', kind: 'severity_changed', from: 'WARNING', to: 'INFO', by: 'default flow', at: new Date(Date.now() - 3_000_000).toISOString() },
  ],
};

/* ─── Device profiles (phase 01 §1.4; NB iot_device_profile 03) ─── */

const profileBase = blankProfileDraft();
const PROFILE_T0 = new Date('2026-09-01T08:00:00Z');

/**
 * The demo's device profiles: the ids the demo devices point at. One of each shape: a default MQTT + HTTP profile on the live
 * connection; a Roltek template copy (X.509 only, schemas from the firmware, OD-63 "from template"); a LoRaWAN profile on "last seen
 * only" (live connection impossible); a ThingsBoard-topics profile with plain MQTT for old meters (OD-160); an HTTP profile on the
 * recent-message rule with tokens in the URL (OD-161).
 */
export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    ...profileBase, profileId: 'prof-sensor', name: 'Sensors (live connection)', description: 'Default profile for the hall sensors.', isDefault: true,
    transportType: 'ANY', allowedAuthModes: ['ACCESS_TOKEN', 'MQTT_BASIC'], onlineRule: 'LIVE_SOCKET', allowedNetworks: ['203.0.113.0/24'],
    telemetrySchema: [
      { key: 'temperature', type: 'number', unit: '°C', label: 'Temperature', min: -40, max: 125, decimals: 1 },
      { key: 'humidity', type: 'number', unit: '%', label: 'Humidity', min: 0, max: 100, decimals: 0 },
    ],
    cfgSchema: [
      { key: 'cfg.report_interval_s', type: 'integer', label: 'Report interval', min: 5, max: 3600 },
      { key: 'cfg.led', type: 'string', label: 'LED', enum: ['on', 'off', 'blink'] },
      { key: 'cfg.wifi.psk', type: 'string', label: 'Wi-Fi password', minLength: 8, maxLength: 63, secret: true },
    ],
    createdAt: PROFILE_T0, updatedAt: new Date('2026-10-20T09:30:00Z'),
  },
  {
    ...profileBase, profileId: 'prof-gateway', name: 'Gateways (live connection)', description: 'Roltek M1 edge gateways.', isDefault: false,
    transportType: 'MQTT', allowedAuthModes: ['X509_CERTIFICATE'], onlineRule: 'LIVE_SOCKET', downlinkMaxBytes: 4096,
    template: { key: 'roltek-m1', version: 3 }, schemaSource: { kind: 'firmware', label: 'roltek-openwrt 24.10.1' },
    telemetrySchema: [
      { key: 'cpu_load', type: 'number', unit: '%', label: 'CPU load', min: 0, max: 100, decimals: 0 },
      { key: 'wan_rx_bps', type: 'integer', unit: 'bit/s', label: 'WAN receive' },
    ],
    cfgSchema: [{ key: 'cfg.lte.apn', type: 'string', label: 'LTE APN', maxLength: 64 }],
    createdAt: PROFILE_T0, updatedAt: new Date('2026-10-01T12:00:00Z'),
  },
  {
    ...profileBase, profileId: 'prof-lorawan', name: 'LoRaWAN meters (last seen only)', description: 'Water meters behind the LoRaWAN network server.', isDefault: false,
    transportType: 'LORAWAN', onlineRule: 'LAST_SEEN_ONLY', inactivityTimeoutSec: 7_200,
    createdAt: PROFILE_T0, updatedAt: new Date('2026-09-12T10:00:00Z'),
  },
  {
    ...profileBase, profileId: 'prof-tb', name: 'Legacy meters (ThingsBoard compatible)', description: 'Third-party meters that speak the ThingsBoard topics.', isDefault: false,
    transportType: 'MQTT', topicSchemes: ['TB'], mqttTransport: 'PLAINTEXT_ALLOWED', onlineRule: 'LIVE_SOCKET', allowedNetworks: ['198.51.100.0/24', '2001:db8::/32'],
    createdAt: PROFILE_T0, updatedAt: new Date('2026-09-20T15:00:00Z'),
  },
  {
    ...profileBase, profileId: 'prof-http', name: 'HTTP sensors (recent message)', description: 'Battery sensors that post every 10 minutes.', isDefault: false,
    transportType: 'HTTP', onlineRule: 'UPLINK_WINDOW', expectedIntervalS: 600, onlineWindowFactor: 3, allowTokenInUrl: true,
    rateLimits: { ...profileBase.rateLimits, telemetry_msgs: '2:1,30:60' },
    createdAt: PROFILE_T0, updatedAt: new Date('2026-10-10T07:45:00Z'),
  },
];
