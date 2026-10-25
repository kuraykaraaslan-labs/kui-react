'use client';
// Showcase entries for the observability components: TraceWaterfall, LogViewer, ServiceMap, CitationChip,
// EvidenceList, DayBarChart, AiHumanDraftEditor, ConversationTimeline, InlineEditList, LocaleSwitcher, BurnChart.
// All demo data is deterministic (no Math.random, no Date.now).

import { useEffect, useState } from 'react';
import { TraceWaterfall, type TraceSpan } from '@/modules/ui/TraceWaterfall';
import { LogViewer, useLogStream, type LogLine, type LogSeverity } from '@/modules/ui/LogViewer';
import { ServiceMap, type ServiceEdge, type ServiceNode } from '@/modules/ui/ServiceMap';
import { CitationChip, CitedText, EvidenceList, type EvidenceItem } from '@/modules/ui/Evidence';
import { DayBarChart, type DayBar } from '@/modules/ui/DayBarChart';
import { AiHumanDraftEditor } from '@/modules/ui/AiHumanDraftEditor';
import { ConversationTimeline, type ConversationStep } from '@/modules/ui/ConversationTimeline';
import { InlineEditList, type InlineEditItem } from '@/modules/ui/InlineEditList';
import { LocaleSwitcher, type LocaleOption } from '@/modules/ui/LocaleSwitcher';
import { BurnChart } from '@/modules/ui/Chart';
import type { ShowcaseComponent } from '../showcase.types';

/** One place builds the entry, so the registry's `sourceCode` is a usage snippet written next to the variants. */
function entry(def: Omit<ShowcaseComponent, 'sourceCode' | 'category' | 'since'> & { usage: string; category?: ShowcaseComponent['category'] }): ShowcaseComponent {
  const { usage, category = 'Organism', ...rest } = def;
  const out = { ...rest, category, since: '2026-10', status: 'beta' } as ShowcaseComponent;
  out.sourceCode = usage;
  return out;
}

const TOKENS_BASE = ['--surface-base', '--surface-raised', '--surface-overlay', '--surface-sunken', '--text-primary', '--text-secondary', '--border', '--border-focus', '--primary', '--primary-subtle', '--error', '--warning', '--success'];

// ── Trace data ──────────────────────────────────────────────────────────────────────────────
const TRACE: TraceSpan[] = [
  { id: 'root', name: 'POST /checkout', service: 'web', start: 0, duration: 412, kind: 'server', attributes: { 'http.method': 'POST', 'http.status_code': 200 } },
  { id: 'auth', parentId: 'root', name: 'auth.verify', service: 'auth', start: 4, duration: 38 },
  { id: 'cart', parentId: 'root', name: 'cart.load', service: 'cart', start: 44, duration: 96 },
  { id: 'cart-db', parentId: 'cart', name: 'SELECT cart_items', service: 'cart', start: 52, duration: 80, kind: 'client' },
  { id: 'stock', parentId: 'root', name: 'inventory.reserve', service: 'inventory', start: 142, duration: 120 },
  { id: 'stock-db', parentId: 'stock', name: 'UPDATE stock', service: 'inventory', start: 150, duration: 104, kind: 'client' },
  { id: 'pay', parentId: 'root', name: 'payment.charge', service: 'payment', start: 264, duration: 140, status: 'error', attributes: { 'error.type': 'GatewayTimeout' } },
  { id: 'pay-http', parentId: 'pay', name: 'POST gateway/charge', service: 'payment', start: 270, duration: 130, status: 'error', kind: 'client' },
];
const BIG_TRACE: TraceSpan[] = [
  { id: 'r', name: 'batch.import', service: 'worker', start: 0, duration: 60_000 },
  ...Array.from({ length: 1200 }, (_, i) => ({ id: `s${i}`, parentId: i % 40 === 0 ? 'r' : `s${i - (i % 40)}`, name: `step ${i}`, service: ['worker', 'db', 'cache'][i % 3], start: i * 45, duration: 20 + (i % 9) * 6, status: i % 97 === 0 ? ('error' as const) : ('ok' as const) })),
];

// ── Logs ─────────────────────────────────────────────────────────────────────────────────────
const SEVS: LogSeverity[] = ['trace', 'debug', 'info', 'info', 'info', 'info', 'warn', 'info', 'error', 'info'];
const SERVICES = ['api', 'worker', 'auth'];
const LOG0 = Date.UTC(2026, 9, 18, 8, 0, 0);
function makeLogs(n: number, from = 0): LogLine[] {
  return Array.from({ length: n }, (_, i) => {
    const k = from + i;
    const severity = SEVS[k % SEVS.length];
    return {
      id: `log-${k}`,
      ts: LOG0 + k * 137,
      severity,
      message: severity === 'error' ? `request ${k} failed: upstream timeout after 3000 ms` : severity === 'warn' ? `slow query on request ${k} (1.2 s)` : `handled request ${k} in ${20 + (k % 70)} ms`,
      fields: { service: SERVICES[k % 3], region: k % 4 === 0 ? 'eu' : 'us', status: severity === 'error' ? 504 : 200 },
    };
  });
}
const LOGS_10K = makeLogs(12_000);

function LiveTail() {
  const stream = useLogStream({ maxLines: 400, flushMs: 150, initial: makeLogs(60) });
  const [follow, setFollow] = useState(true);
  const { push } = stream;
  useEffect(() => {
    let k = 60;
    const id = setInterval(() => { push(makeLogs(6, k)); k += 6; }, 400);
    return () => clearInterval(id);
  }, [push]);
  return <LogViewer lines={stream.lines} dropped={stream.dropped} follow={follow} onFollowChange={setFollow} height={300} />;
}

// ── Service map ─────────────────────────────────────────────────────────────────────────────
const MAP_NODES: ServiceNode[] = [
  { id: 'edge', name: 'edge-gateway', kind: 'gateway', rate: 1450, errorRate: 0.004, latencyMs: 62 },
  { id: 'web', name: 'web', kind: 'service', rate: 1200, errorRate: 0.006, latencyMs: 120 },
  { id: 'api', name: 'api', kind: 'service', rate: 1100, errorRate: 0.031, latencyMs: 240 },
  { id: 'auth', name: 'auth', kind: 'service', rate: 1100, errorRate: 0.001, latencyMs: 18 },
  { id: 'pay', name: 'payments', kind: 'service', rate: 90, errorRate: 0.12, latencyMs: 900 },
  { id: 'db', name: 'orders-db', kind: 'database', rate: 2000, latencyMs: 4 },
  { id: 'queue', name: 'events', kind: 'queue', rate: 340, errorRate: 0 },
  { id: 'psp', name: 'card-gateway', kind: 'external', rate: 90, errorRate: 0.12, latencyMs: 820 },
];
const MAP_EDGES: ServiceEdge[] = [
  { from: 'edge', to: 'web', rate: 1450, latencyMs: 40 },
  { from: 'web', to: 'api', rate: 1100, errorRate: 0.02, latencyMs: 130 },
  { from: 'web', to: 'auth', rate: 1100, latencyMs: 14 },
  { from: 'api', to: 'auth', rate: 1100, latencyMs: 12 },
  { from: 'api', to: 'db', rate: 2000, latencyMs: 4 },
  { from: 'api', to: 'pay', rate: 90, errorRate: 0.12, latencyMs: 700 },
  { from: 'api', to: 'queue', rate: 340, errorRate: 0 },
  { from: 'pay', to: 'psp', rate: 90, errorRate: 0.12, latencyMs: 640 },
  { from: 'pay', to: 'api', rate: 20, latencyMs: 30 },
];

// ── Evidence ────────────────────────────────────────────────────────────────────────────────
const EVIDENCE: EvidenceItem[] = [
  { id: 'e-log', kind: 'log', title: 'payments: gateway timeout burst', summary: '412 errors between 08:02 and 08:07.', href: '#', source: 'loki', timestamp: Date.UTC(2026, 9, 18, 8, 2) },
  { id: 'e-trace', kind: 'trace', title: 'POST /checkout (slow, failed)', summary: 'payment.charge spent 140 ms and timed out.', href: '#', source: 'tempo', timestamp: Date.UTC(2026, 9, 18, 8, 4) },
  { id: 'e-deploy', kind: 'deploy', title: 'payments 4.12.0', summary: 'Rolled out at 07:58.', source: 'deploys', timestamp: Date.UTC(2026, 9, 18, 7, 58) },
  { id: 'e-metric', kind: 'metric', title: 'checkout error ratio', summary: 'Rose from 0.4 % to 3.1 %.', source: 'prometheus' },
];
const ANSWER = 'Checkout errors started after payments 4.12.0 was rolled out [3]. The failures are gateway timeouts [1][2], and the error ratio rose above 3 % [4]. The database was the bottleneck [7].';

function CitationDemo() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <CitedText text={ANSWER} evidence={EVIDENCE} onSelect={setActive} />
      <EvidenceList items={EVIDENCE} activeId={active} onOpen={(i) => setActive(i.id)} droppedClaims={[{ id: 'd1', text: 'The database was the bottleneck.', reason: 'cited evidence 7, which does not exist' }]} />
    </div>
  );
}

// ── Uptime days ─────────────────────────────────────────────────────────────────────────────
const DAY_END = Date.UTC(2026, 9, 18);
function makeDays(seed: number, n = 90): DayBar[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(DAY_END - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const k = (i * 7 + seed * 13) % 41;
    const availability = i < 6 && seed === 2 ? null : k === 0 ? 97.2 : k === 9 || k === 23 ? 99.55 : k === 30 ? 98.1 : 100 - ((i + seed) % 5) * 0.01;
    const incidents = k === 0 ? [{ id: `i${i}`, title: 'Database failover', severity: 'critical' as const, href: '#' }] : k === 9 ? [{ id: `i${i}`, title: 'Elevated latency', severity: 'minor' as const, href: '#' }] : undefined;
    return { date, availability, incidents };
  });
}

// ── AI draft ────────────────────────────────────────────────────────────────────────────────
const HUMAN_TEXT = 'We are investigating elevated errors on checkout. The cause is not known yet. Next update in 30 minutes.';
const AI_TEXT = 'We identified elevated errors on checkout caused by a payment gateway timeout. A fix is rolling out. Next update in 15 minutes.';
function DraftDemo({ model }: { model?: string }) {
  const [value, setValue] = useState(HUMAN_TEXT);
  return <AiHumanDraftEditor aiDraft={AI_TEXT} value={value} onChange={setValue} model={model} />;
}

// ── Conversation ────────────────────────────────────────────────────────────────────────────
const STEPS: ConversationStep[] = [
  { id: '1', type: 'model', title: 'Plan the investigation', model: 'model-a', tokens: { input: 1200, output: 340, cached: 800 }, cost: 0.0042, durationMs: 1800 },
  { id: '2', type: 'tool', title: 'search_logs', summary: 'service=payments level=error since 07:55', durationMs: 420, input: '{"service":"payments","level":"error"}', output: '412 rows, first at 08:02:11' },
  { id: '3', type: 'tool', title: 'get_trace', status: 'error', summary: 'timeout after 5 s', durationMs: 5000 },
  { id: '4', type: 'evidence', title: 'payments: gateway timeout burst', summary: 'Evidence [1]' },
  { id: '5', type: 'model', title: 'Write the answer', model: 'model-a', tokens: { input: 2300, output: 610 }, cost: 0.0101, durationMs: 2500 },
  { id: '6', type: 'citation', title: 'Errors began after payments 4.12.0', citation: { kept: true, index: 3 } },
  { id: '7', type: 'citation', title: 'The database was the bottleneck', citation: { kept: false, reason: 'cited evidence 7, which does not exist' } },
];

// ── Inline edit list ────────────────────────────────────────────────────────────────────────
function RegionList({ slow = false }: { slow?: boolean }) {
  const [items, setItems] = useState<InlineEditItem[]>([{ id: 'a', text: 'eu-west' }, { id: 'b', text: 'us-east' }, { id: 'c', text: 'ap-south' }]);
  return (
    <InlineEditList
      items={items}
      messages={{ label: 'Probe regions', add: 'Add region' }}
      validate={(d, { items: all }) => (all.some((i) => i.id !== d.id && i.text.trim().toLowerCase() === d.text.trim().toLowerCase()) ? 'That region is already in the list.' : d.text.trim() ? null : 'Enter a region name.')}
      onChange={async (next) => {
        if (slow) {
          await new Promise((r) => setTimeout(r, 900));
          if (next.some((i) => i.text.toLowerCase() === 'fail')) throw new Error('The server refused this value.');
        }
        setItems(next);
      }}
    />
  );
}

// ── Locale ──────────────────────────────────────────────────────────────────────────────────
const LOCALES: LocaleOption[] = [
  { code: 'en', name: 'English', englishName: 'English', href: '#en' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', href: '#tr', fallback: true },
  { code: 'de', name: 'Deutsch', englishName: 'German', href: '#de' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', href: '#ar' },
];
function LocaleDemo({ variant, buttons, initial = 'en' }: { variant?: 'menu' | 'inline'; buttons?: boolean; initial?: string }) {
  const [current, setCurrent] = useState(initial);
  const options = buttons ? LOCALES.map(({ href: _h, ...o }) => { void _h; return o; }) : LOCALES;
  return <LocaleSwitcher locales={options} current={current} variant={variant} onChange={(code, _o, e) => { e.preventDefault(); setCurrent(code); }} />;
}

// ── Burn chart ──────────────────────────────────────────────────────────────────────────────
const B0 = Date.UTC(2026, 9, 1);
const DAY = 86_400_000;
const BUDGET = Array.from({ length: 14 }, (_, i) => ({ t: B0 + i * DAY, value: 100 - i * 2.2 - (i > 8 ? (i - 8) * 4.5 : 0) }));
const BURN = Array.from({ length: 14 }, (_, i) => ({ t: B0 + i * DAY, value: i === 10 ? 9.5 : i > 8 ? 4.2 + (i % 3) : 1 + (i % 4) * 0.15 }));

export function buildObservabilityData(): ShowcaseComponent[] {
  return [
    entry({
      id: 'trace-waterfall', title: 'TraceWaterfall', abbr: 'Wf',
      description: 'A distributed trace as nested rows with offset and duration bars on a time ruler. Collapse and expand, critical-path highlight, error spans (icon and text, not only colour), a detail slot for the selected span, and a windowed list above 500 rows. Tree semantics (role tree and treeitem, aria-level, aria-expanded, aria-selected) with aria-activedescendant, so the keyboard works the same when rows are windowed.',
      filePath: 'modules/ui/TraceWaterfall/index.tsx',
      relatedTo: ['tree-view', 'timeline'],
      designTokens: TOKENS_BASE,
      dependencies: ['@fortawesome/react-fontawesome'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['tree', 'treeitem'], keyboardInteractions: [
        { keys: 'ArrowUp / ArrowDown', action: 'Move between spans' }, { keys: 'ArrowRight / ArrowLeft', action: 'Expand, collapse, or move to the first child or the parent (mirrored in right-to-left pages)' },
        { keys: 'Home / End / PageUp / PageDown', action: 'Jump' }, { keys: 'Enter / Space', action: 'Select the span and open its details' }, { keys: '*', action: 'Expand all siblings' }, { keys: 'Escape', action: 'Clear the selection' },
      ] },
      usage: `import { TraceWaterfall } from '@/modules/ui/TraceWaterfall';

<TraceWaterfall
  spans={spans}              // { id, parentId?, name, service?, start, duration, status? }[], times in ms
  onSelect={(span) => open(span)}
  renderDetail={(span, info) => <SpanPanel span={span} info={info} />}
/>`,
      variants: [
        { title: 'Default, with the critical path and an error span', layout: 'stack', preview: <TraceWaterfall spans={TRACE} defaultSelectedId="pay" />, code: `<TraceWaterfall spans={spans} defaultSelectedId="pay" />` },
        { title: 'Collapsed start, custom detail slot', layout: 'stack', preview: <TraceWaterfall spans={TRACE} defaultCollapsedIds={['cart', 'stock']} defaultSelectedId="cart" renderDetail={(s, i) => <p className="text-sm">{s.name} ran for {i.duration} ms; {i.selfTime} ms of it was its own work.</p>} />, code: `<TraceWaterfall spans={spans} defaultCollapsedIds={['cart']} renderDetail={(span, info) => <p>{span.name}: {info.selfTime} ms self</p>} />` },
        { title: '1 200 spans (windowed)', layout: 'stack', preview: <TraceWaterfall spans={BIG_TRACE} maxHeight={320} />, code: `<TraceWaterfall spans={manySpans} maxHeight={320} />` },
      ],
    }),
    entry({
      id: 'log-viewer', title: 'LogViewer', abbr: 'Lv',
      description: 'A windowed log list for 10k+ lines: severity as a text label and colour, search with highlight, severity and field facet chips, a wrap toggle, copy line, context lines pulled in around a selected line when the list is filtered, and a follow mode for a live tail (pauses when the user scrolls up, counts new lines, shows a drop counter). `useLogStream` is the producer side: it coalesces pushes, keeps the newest lines and counts drops.',
      filePath: 'modules/ui/LogViewer/index.tsx',
      relatedTo: ['trace-waterfall', 'data-table'],
      designTokens: TOKENS_BASE,
      dependencies: ['@fortawesome/react-fontawesome'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['listbox', 'option', 'status'], keyboardInteractions: [
        { keys: 'ArrowUp / ArrowDown / PageUp / PageDown / Home / End', action: 'Move the selection through the lines' }, { keys: 'Escape', action: 'Clear the selection' }, { keys: 'Enter (in the search box)', action: 'Next match in highlight mode' },
      ] },
      usage: `import { LogViewer, useLogStream } from '@/modules/ui/LogViewer';

const stream = useLogStream({ maxLines: 10_000 });   // stream.push(lines) from your socket
<LogViewer lines={stream.lines} dropped={stream.dropped} follow onFollowChange={setFollow} />`,
      variants: [
        { title: '12 000 lines', layout: 'stack', preview: <LogViewer lines={LOGS_10K} height={320} />, code: `<LogViewer lines={lines} height={320} />` },
        { title: 'Highlight mode, wrapped', layout: 'stack', preview: <LogViewer lines={LOGS_10K.slice(0, 400)} searchMode="highlight" defaultQuery="timeout" defaultWrap height={280} />, code: `<LogViewer lines={lines} searchMode="highlight" defaultQuery="timeout" defaultWrap />` },
        { title: 'Live tail with a drop counter', layout: 'stack', preview: <LiveTail />, code: `const stream = useLogStream({ maxLines: 400 });\n<LogViewer lines={stream.lines} dropped={stream.dropped} follow onFollowChange={setFollow} />` },
      ],
    }),
    entry({
      id: 'service-map', title: 'ServiceMap', abbr: 'Sm',
      description: 'Services and the calls between them on a deterministic layered layout (no graph library): rate, error and latency badges, pan and zoom, roving-focus keyboard navigation along the call graph, and a selection slot. Errors are never colour alone: a warning icon and percentage, a heavier border and a dashed edge.',
      filePath: 'modules/ui/ServiceMap/index.tsx',
      relatedTo: ['trace-waterfall', 'tree-view'],
      designTokens: TOKENS_BASE,
      dependencies: ['@fortawesome/react-fontawesome'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['group', 'button'], keyboardInteractions: [
        { keys: 'ArrowRight / ArrowLeft', action: 'Follow a call downstream or upstream (mirrored in right-to-left pages)' }, { keys: 'ArrowUp / ArrowDown', action: 'Siblings in the same layer' }, { keys: 'Enter / Space', action: 'Select the service' },
        { keys: '+ / - / 0', action: 'Zoom in, out, fit' }, { keys: 'Shift + arrows', action: 'Pan' }, { keys: 'Ctrl + wheel', action: 'Zoom at the cursor' },
      ] },
      usage: `import { ServiceMap } from '@/modules/ui/ServiceMap';

<ServiceMap
  nodes={[{ id: 'api', name: 'api', rate: 1100, errorRate: 0.031, latencyMs: 240 }]}
  edges={[{ from: 'web', to: 'api', rate: 1100, latencyMs: 130 }]}
  onSelect={(node) => setSelected(node)}
/>`,
      variants: [
        { title: 'Default', layout: 'stack', preview: <ServiceMap nodes={MAP_NODES} edges={MAP_EDGES} />, code: `<ServiceMap nodes={nodes} edges={edges} />` },
        { title: 'With a selection and a custom panel', layout: 'stack', preview: <ServiceMap nodes={MAP_NODES} edges={MAP_EDGES} defaultSelectedId="pay" renderSelection={(n, { incoming, outgoing }) => <p className="text-sm">{n.name}: called by {incoming.length}, calls {outgoing.length}.</p>} />, code: `<ServiceMap nodes={nodes} edges={edges} renderSelection={(node, { incoming, outgoing }) => <Panel node={node} />} />` },
        { title: 'Right to left', layout: 'stack', preview: <div dir="rtl" className="w-full"><ServiceMap nodes={MAP_NODES.slice(0, 5)} edges={MAP_EDGES.slice(0, 5)} height={300} /></div>, code: `<div dir="rtl"><ServiceMap nodes={nodes} edges={edges} /></div>` },
      ],
    }),
    entry({
      id: 'citation-chip', title: 'CitationChip', abbr: 'Cc',
      description: 'A numbered evidence chip [1] that links to its evidence row (a same-page anchor, so it works without JavaScript). A citation that points at nothing renders as a dashed "dropped" chip with a warning icon and text, never as a dead link. `CitedText` turns [n] markers in an answer into chips.',
      filePath: 'modules/ui/Evidence/index.tsx',
      relatedTo: ['evidence-list', 'ai-chat-message'],
      designTokens: ['--primary', '--primary-subtle', '--primary-fg', '--warning', '--warning-subtle', '--border-focus'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['link'], notes: 'Each chip is named "Evidence n: title". A dropped chip is text with a name that says the claim was dropped.' },
      usage: `import { CitationChip, CitedText } from '@/modules/ui/Evidence';

<CitationChip index={1} evidenceId="e-log" title="payments: gateway timeout burst" />
<CitedText text="Errors began after the deploy [3]." evidence={evidence} />`,
      variants: [
        { title: 'Cited and dropped', layout: 'stack', preview: <p className="text-sm">Failures are gateway timeouts<CitationChip index={1} evidenceId="e-log" title="payments: gateway timeout burst" /> and the database was slow<CitationChip index={7} evidenceId="7" status="dropped" />.</p>, code: `<CitationChip index={1} evidenceId="e-log" title="…" />\n<CitationChip index={7} evidenceId="7" status="dropped" />` },
        { title: 'In answer text', layout: 'stack', preview: <CitedText text={ANSWER} evidence={EVIDENCE} />, code: `<CitedText text={answer} evidence={evidence} />` },
      ],
    }),
    entry({
      id: 'evidence-list', title: 'EvidenceList', abbr: 'El',
      description: 'The rows an AI answer cites: a number, a kind icon and label, a title that opens the row, a summary, source and time. Claims dropped for citing nothing openable are listed apart with a text indicator. Pair with CitationChip: a chip click highlights its row.',
      filePath: 'modules/ui/Evidence/index.tsx',
      relatedTo: ['citation-chip', 'timeline'],
      designTokens: TOKENS_BASE,
      a11y: { wcagLevel: 'AA', ariaPatterns: ['list', 'status'], notes: 'An ordered list. The dropped-claims block is a status region.' },
      usage: `import { EvidenceList } from '@/modules/ui/Evidence';

<EvidenceList items={evidence} droppedClaims={dropped} activeId={active} onOpen={(item) => open(item)} />`,
      variants: [
        { title: 'With a dropped claim, linked to chips', layout: 'stack', preview: <CitationDemo />, code: `<CitedText text={answer} evidence={evidence} onSelect={setActive} />\n<EvidenceList items={evidence} activeId={active} droppedClaims={dropped} />` },
        { title: 'Empty', layout: 'stack', preview: <EvidenceList items={[]} />, code: `<EvidenceList items={[]} />` },
      ],
    }),
    entry({
      id: 'day-bar-chart', title: 'DayBarChart', abbr: 'Db', category: 'Molecule',
      description: 'One bar per day, the 90-day uptime strip of a status page. Coloured by availability, with height, an incident marker and the day\'s accessible name carrying the same meaning, a tooltip on hover and focus, a pinned details dialog on click, and a legend. Reusable per component and per region: pass a label.',
      filePath: 'modules/ui/DayBarChart/index.tsx',
      relatedTo: ['heatmap-chart', 'gauge-chart'],
      designTokens: ['--success', '--warning', '--error', '--surface-sunken', '--border', '--primary', '--text-primary', '--text-secondary', '--surface-raised', '--border-focus'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['group', 'dialog', 'tooltip'], keyboardInteractions: [
        { keys: 'ArrowLeft / ArrowRight', action: 'Previous or next day (mirrored in right-to-left pages)' }, { keys: 'Home / End', action: 'First or last day' }, { keys: 'Enter / Space', action: 'Pin the day\'s details' }, { keys: 'Escape', action: 'Close the details' },
      ] },
      usage: `import { DayBarChart } from '@/modules/ui/DayBarChart';

<DayBarChart label="API" days={days} />   // { date: 'YYYY-MM-DD', availability: 99.95 | null, incidents? }[]`,
      variants: [
        { title: 'API, 90 days', layout: 'stack', preview: <DayBarChart label="API" days={makeDays(1)} />, code: `<DayBarChart label="API" days={days} />` },
        { title: 'Per region, with a gap and custom thresholds', layout: 'stack', preview: <div className="flex flex-col gap-6"><DayBarChart label="EU region" days={makeDays(2)} thresholds={{ operational: 99.95, degraded: 99.5 }} showLegend={false} /><DayBarChart label="US region" days={makeDays(3)} showLegend={false} /></div>, code: `<DayBarChart label="EU region" days={days} thresholds={{ operational: 99.95, degraded: 99.5 }} />` },
      ],
    }),
    entry({
      id: 'ai-human-draft-editor', title: 'AiHumanDraftEditor', abbr: 'Ae',
      description: 'The AI\'s draft beside the human\'s text, diffed by words, with accept and reject per change and accept all. The text stays the human\'s until they accept; the value is controlled. A badge says the draft is AI-generated. Changes are marked by shape (strike and underline) and a number shown in both panels, and every button names its change.',
      filePath: 'modules/ui/AiHumanDraftEditor/index.tsx',
      relatedTo: ['diff-viewer', 'ai-chat-message'],
      designTokens: ['--secondary', '--error', '--error-subtle', '--success', '--surface-raised', '--surface-sunken', '--border', '--text-primary', '--text-secondary', '--primary', '--primary-fg'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['group', 'status'], notes: 'Each change is a group named "Change n of m"; accept and reject buttons say what they replace. Results are announced in a polite status region.' },
      usage: `import { AiHumanDraftEditor } from '@/modules/ui/AiHumanDraftEditor';

const [text, setText] = useState(humanText);
<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} model="model-a" />`,
      variants: [
        { title: 'Review changes', layout: 'stack', preview: <DraftDemo model="model-a" />, code: `<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} model="model-a" />` },
        { title: 'Read only', layout: 'stack', preview: <AiHumanDraftEditor aiDraft={AI_TEXT} value={HUMAN_TEXT} onChange={() => {}} readOnly />, code: `<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} readOnly />` },
      ],
    }),
    entry({
      id: 'conversation-timeline', title: 'ConversationTimeline', abbr: 'Ln',
      description: 'A vertical timeline of an AI investigation: model calls, tool calls, the evidence read, and whether each citation was kept or dropped, with tokens, cost and time per step and a total. Every step names its type in text; arguments and raw results collapse.',
      filePath: 'modules/ui/ConversationTimeline/index.tsx',
      relatedTo: ['timeline', 'evidence-list'],
      designTokens: ['--secondary', '--info', '--primary', '--success', '--warning', '--error', '--border', '--surface-raised', '--surface-sunken', '--text-primary', '--text-secondary'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['list', 'region'], notes: 'An ordered list; details toggles are buttons with aria-expanded and aria-controls.' },
      usage: `import { ConversationTimeline } from '@/modules/ui/ConversationTimeline';

<ConversationTimeline steps={steps} currency="USD" />`,
      variants: [
        { title: 'With totals', layout: 'stack', preview: <ConversationTimeline steps={STEPS} />, code: `<ConversationTimeline steps={steps} />` },
        { title: 'Details open, totals hidden', layout: 'stack', preview: <ConversationTimeline steps={STEPS} defaultExpandedIds={['2', '7']} hideTotals />, code: `<ConversationTimeline steps={steps} defaultExpandedIds={['2']} hideTotals />` },
      ],
    }),
    entry({
      id: 'inline-edit-list', title: 'InlineEditList', abbr: 'Ie',
      description: 'A list whose rows edit in place: add, edit, remove and reorder, all from the keyboard, with a validation message per row and an async save state per row. Controlled: every change goes through onChange(next, change); return a promise to show saving, reject to show the row\'s error.',
      filePath: 'modules/ui/InlineEditList/index.tsx',
      relatedTo: ['tag-input', 'data-table'],
      designTokens: ['--surface-raised', '--surface-base', '--border', '--border-focus', '--error', '--success', '--primary', '--primary-fg', '--text-primary', '--text-secondary'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['list', 'alert', 'status'], keyboardInteractions: [
        { keys: 'ArrowUp / ArrowDown / Home / End', action: 'Move between rows' }, { keys: 'Enter / F2', action: 'Edit the row' }, { keys: 'Delete', action: 'Remove the row' }, { keys: 'Alt + ArrowUp / ArrowDown', action: 'Move the row' }, { keys: 'Enter / Escape (in the editor)', action: 'Save / cancel' },
      ] },
      usage: `import { InlineEditList } from '@/modules/ui/InlineEditList';

<InlineEditList
  items={items}                       // { id, text }[]
  onChange={async (next, change) => { await save(next); setItems(next); }}
  validate={(draft) => (draft.text.trim() ? null : 'Enter a name.')}
/>`,
      variants: [
        { title: 'Synchronous', layout: 'stack', preview: <RegionList />, code: `<InlineEditList items={items} onChange={(next) => setItems(next)} validate={validate} />` },
        { title: 'Async save (type "fail" to see an error)', layout: 'stack', preview: <RegionList slow />, code: `<InlineEditList items={items} onChange={async (next) => { await save(next); setItems(next); }} />` },
      ],
    }),
    entry({
      id: 'locale-switcher', title: 'LocaleSwitcher', abbr: 'Lc', category: 'Molecule',
      description: 'A language picker for public pages. Options are links when they have an href (a native details menu, so it works without JavaScript) or buttons when they do not. Names are shown in their own language with lang and dir set, the current locale is marked in text, and a locale whose page falls back to another language says so. Not the flag dropdown LanguageSwitcher of the common domain: no flag assets and no i18n dependency.',
      filePath: 'modules/ui/LocaleSwitcher/index.tsx',
      relatedTo: ['common-language-switcher', 'dropdown-menu'],
      designTokens: ['--surface-base', '--surface-raised', '--surface-overlay', '--border', '--border-focus', '--primary', '--warning', '--warning-subtle', '--text-primary', '--text-secondary'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['disclosure', 'link'], keyboardInteractions: [{ keys: 'ArrowUp / ArrowDown / Home / End', action: 'Move between options' }, { keys: 'Escape', action: 'Close and return to the trigger' }] },
      usage: `import { LocaleSwitcher } from '@/modules/ui/LocaleSwitcher';

<LocaleSwitcher current="en" locales={[{ code: 'en', name: 'English', href: '/en' }, { code: 'tr', name: 'Türkçe', href: '/tr', fallback: true }]} />`,
      variants: [
        { title: 'Menu of links', layout: 'stack', previewClassName: 'min-h-64', preview: <LocaleDemo />, code: `<LocaleSwitcher locales={locales} current="en" />` },
        { title: 'Inline buttons', layout: 'stack', preview: <LocaleDemo variant="inline" buttons />, code: `<LocaleSwitcher variant="inline" locales={localesWithoutHref} current="en" onChange={(code) => setLocale(code)} />` },
        { title: 'Right to left', layout: 'stack', previewClassName: 'min-h-64', preview: <div dir="rtl"><LocaleDemo initial="ar" /></div>, code: `<div dir="rtl"><LocaleSwitcher locales={locales} current="ar" /></div>` },
      ],
    }),
    entry({
      id: 'burn-chart', title: 'BurnChart', abbr: 'Bu', category: 'Molecule',
      description: 'An SLO burn view on the Chart primitives: the error budget remaining with a projection that runs to zero at the recent pace, the burn rate with the alerting tiers as labelled thresholds (the SRE workbook\'s 14.4 / 6 / 3 / 1 by default), and annotations such as a deploy or an incident. Colour is not the only signal: tiers and annotations carry text, the projection is dashed, and a text summary states the budget, the active tier and the projected exhaustion.',
      filePath: 'modules/ui/Chart/charts/BurnChart.tsx',
      relatedTo: ['time-series-chart', 'gauge-chart', 'heatmap-chart'],
      composes: ['chart'],
      designTokens: ['--primary', '--info', '--warning', '--error', '--success', '--border', '--border-strong', '--surface-base', '--surface-raised', '--text-secondary', '--border-focus'],
      a11y: { wcagLevel: 'AA', ariaPatterns: ['group', 'img'], keyboardInteractions: [{ keys: 'ArrowLeft / ArrowRight / Home / End', action: 'Step the cursor through the points; the tooltip follows' }, { keys: 'Escape', action: 'Clear the cursor' }] },
      usage: `import { BurnChart } from '@/modules/ui/Chart';

<BurnChart
  budget={[{ t: '2026-10-01', value: 100 }, { t: '2026-10-08', value: 71 }]}   // percent remaining
  burnRate={[{ t: '2026-10-01', value: 1 }, { t: '2026-10-08', value: 4.2 }]}  // multiples of sustainable
  windowEnd="2026-10-31"
  annotations={[{ id: 'd1', t: '2026-10-05', label: 'Deploy 4.12.0' }]}
/>`,
      variants: [
        { title: 'Budget and burn rate, with annotations', layout: 'stack', preview: <BurnChart budget={BUDGET} burnRate={BURN} windowEnd={B0 + 30 * DAY} annotations={[{ id: 'a', t: B0 + 5 * DAY, label: 'Deploy 4.12.0', tone: 'info' }, { id: 'b', t: B0 + 10 * DAY, label: 'Incident 218', tone: 'error' }]} timeZone="UTC" />, code: `<BurnChart budget={budget} burnRate={burnRate} windowEnd="2026-10-31" annotations={annotations} />` },
        { title: 'Budget only, custom tiers', layout: 'stack', preview: <BurnChart budget={BUDGET} timeZone="UTC" projection={{ lookbackMs: 4 * DAY }} />, code: `<BurnChart budget={budget} projection={{ lookbackMs: 4 * 86_400_000 }} />` },
        { title: 'Burn rate only, two tiers', layout: 'stack', preview: <BurnChart burnRate={BURN} tiers={[{ id: 'p', label: 'Page', rate: 6, tone: 'error', window: '1 h' }, { id: 't', label: 'Ticket', rate: 2, tone: 'warning', window: '1 d' }]} height={180} timeZone="UTC" />, code: `<BurnChart burnRate={burnRate} tiers={[{ id: 'p', label: 'Page', rate: 6, tone: 'error' }]} />` },
      ],
    }),
  ];
}
