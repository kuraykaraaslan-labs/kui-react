'use client';
import { useState } from 'react';
import {
  WidgetCard, WidgetBoard, WidgetSettingsEditor, PlacementCard,
  BUILTIN_KINDS, BUILTIN_VIEWS, CORE_CARD, CORE_FORMAT, builtinKind,
  type BoardDocument, type CardSettings, type Sparse,
} from '@/modules/app/WidgetKit';
import type { ShowcaseComponent } from '../showcase.types';

const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function CardDemo() {
  const card: CardSettings = { subtitle: 'Hall A', titleIcon: '', buttons: ['fullscreen', 'refresh'], showUpdated: 'relative' };
  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="h-40"><WidgetCard title="Raised (default)" card={card} updatedAt={at(3)} onRefresh={() => {}} onFullscreen={() => {}}><p className="text-sm">Body</p></WidgetCard></div>
      <div className="h-40"><WidgetCard title="Free colours" card={{ ...card, background: 'color', backgroundColor: '#0f172a', textColor: '#e2e8f0', titleColor: '#38bdf8', radius: 4 }}><p className="text-sm">Any CSS colour or a theme token</p></WidgetCard></div>
      <div className="h-40"><WidgetCard title="Old data" card={{ ...card, variant: 'outline', staleAfterSeconds: 60 }} stale><p className="text-sm">Badge on stale data</p></WidgetCard></div>
    </div>
  );
}

function UnavailableCardDemo() {
  const card: CardSettings = { buttons: ['fullscreen', 'refresh'] };
  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="h-48"><WidgetCard title="Open calls" card={card} state="unavailable" unavailable={{ reason: 'disabled', action: { label: 'Enable telephony' } }} /></div>
      <div className="h-48"><WidgetCard title="Revenue forecast" card={card} state="unavailable" unavailable={{ reason: 'unentitled', action: { label: 'Upgrade' } }} /></div>
      <div className="h-48"><WidgetCard title="Device map" card={card} state="unavailable" unavailable={{ reason: 'quarantined', action: { label: 'Retry' } }} /></div>
    </div>
  );
}

function PlacementDemo() {
  const kind = builtinKind('stat.value')!;
  const [settings, setSettings] = useState<Sparse>({ label: 'Rooms booked', $format: { unit: '%' }, ranges: [{ from: 80, color: 'var(--error)' }] });
  const [title, setTitle] = useState('Occupancy');
  return (
    <div className="grid w-full max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="h-44">
        <PlacementCard title={title} template={kind.template} slots={kind.slots} view={BUILTIN_VIEWS['stat.value']} settings={settings}
          data={{ value: { shape: 'scalar', value: 86, fetchedAt: at(1) }, compare: { shape: 'scalar', value: 79, fetchedAt: at(1) } }} />
      </div>
      <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border p-3">
        <WidgetSettingsEditor templates={[kind.template, CORE_CARD, CORE_FORMAT]} settings={settings} onChange={setSettings}
          caps={{ hasData: true, exportable: false, formatsNumbers: true }} boundSlots={['value', 'compare']}
          title={title} onTitleChange={setTitle} />
      </div>
    </div>
  );
}

const BOARD: BoardDocument = {
  format: 'widgetkit.board', version: 1, templates: {},
  board: { title: 'Demo board', settings: {} },
  placements: [
    { id: 'a', type: 'stat.value', title: 'Temperature', x: 0, y: 0, w: 4, h: 3, settings: { $format: { unit: '°C', decimals: 1 } } },
    { id: 'b', type: 'gauge', title: 'Load', x: 4, y: 0, w: 4, h: 5, settings: { $format: { unit: '%' } } },
    { id: 'c', type: 'progress', title: 'Target', x: 8, y: 0, w: 4, h: 3, settings: {} },
  ],
};
const BOARD_DATA = {
  a: { value: { shape: 'scalar' as const, value: 21.4, fetchedAt: at(1) } },
  b: { value: { shape: 'scalar' as const, value: 72, fetchedAt: at(1) } },
  c: { value: { shape: 'scalar' as const, value: 640, fetchedAt: at(1) }, target: { shape: 'scalar' as const, value: 1000, fetchedAt: at(1) } },
};

function BoardDemo() {
  const [doc, setDoc] = useState(BOARD);
  return <div className="w-full"><WidgetBoard doc={doc} onChange={setDoc} data={BOARD_DATA} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} /></div>;
}

export function buildAppWidgetKitData(): ShowcaseComponent[] {
  return [
    {
      id: 'widget-kit',
      title: 'WidgetKit',
      category: 'App',
      abbr: 'WK',
      description:
        'Dashboard widget kit (next-boilerplate dashboard phase 21). WidgetCard frames every widget (title row with icon, subtitle and help, card buttons for full screen, CSV and refresh, loading/empty/unconfigured/error/stale/unavailable states, "Updated" footer; `unavailable` keeps the title and shows an UnavailableContribution). Versioned settings templates (core:card, core:format, core:board and one per widget type) give ThingsBoard-depth editing with free colours (any CSS colour or a theme token); stored settings carry $v and migrate with append-only steps. WidgetSettingsEditor edits a placement in tabs with Basic/Advanced, layout variants picked from thumbnail cards (renderWidgetPreview, or a host renderPreview); WidgetBoard lays out a whole board with edit mode and JSON export/import that carries every card.',
      filePath: 'modules/app/WidgetKit/index.ts',
      sourceCode: `import { WidgetBoard, BUILTIN_KINDS, BUILTIN_VIEWS } from '@/modules/app/WidgetKit';

<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />`,
      since: '2026-10',
      status: 'beta',
      composes: ['schema-form', 'tab-group', 'drawer', 'modal', 'tooltip', 'chart', 'map-view', 'control-tile', 'unavailable-contribution'],
      designTokens: ['--surface-raised', '--surface-base', '--border', '--text-primary', '--text-secondary', '--primary', '--warning-subtle', '--warning-fg', '--canvas-bg'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['region', 'tablist', 'dialog', 'radiogroup'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Reach the card buttons (shown on focus), the editor tabs and every field' },
          { keys: 'Escape', action: 'Close the full-screen view and the settings drawers' },
        ],
        notes: 'Each card is a labelled section; card buttons have aria-labels; loading sets aria-busy; errors use role="alert".',
      },
      variants: [
        { title: 'WidgetCard', layout: 'stack' as const, preview: <CardDemo />, code: `<WidgetCard title="Load" card={card} stale={stale}>{body}</WidgetCard>` },
        { title: 'WidgetCard unavailable (admin view of a widget whose module is off)', layout: 'stack' as const, preview: <UnavailableCardDemo />,
          code: `<WidgetCard title="Open calls" card={card} state="unavailable"\n  unavailable={{ reason: 'disabled', action: { label: 'Enable telephony', onClick: enable } }} />` },
        { title: 'PlacementCard + WidgetSettingsEditor', layout: 'stack' as const, preview: <PlacementDemo />,
          code: `<WidgetSettingsEditor templates={[kind.template, CORE_CARD, CORE_FORMAT]} settings={settings} onChange={setSettings} caps={caps} />` },
        { title: 'WidgetBoard (edit, export, import)', layout: 'stack' as const, preview: <BoardDemo />,
          code: `<WidgetBoard doc={doc} onChange={setDoc} data={data} kinds={BUILTIN_KINDS} views={BUILTIN_VIEWS} />` },
      ],
    },
  ];
}
