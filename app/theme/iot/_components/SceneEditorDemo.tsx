'use client';
import { useState } from 'react';
import { WidgetKitProvider } from '@/modules/app/WidgetKit';
import { SceneEditor } from '@/modules/app/WidgetKit/views/SceneEditor';
import { SECTOR_SCENE } from '@/modules/app/WidgetKit/sample/scada-sector-hvac';
import type { SceneSettings } from '@/modules/app/WidgetKit/views/scada-scene-logic';
import { useSearchParams } from 'next/navigation';
import { renderIcon } from './IotDashboard';

const COLUMNS = ['value', 'value2', 'running', 'status', 'warning', 'critical', 'label', 'capacity'].map((key) => ({ key }));
const ACTION_IDS = new Set(['ch', 'ahu']);

/** A blank diagram with example readings for the ids the first symbols will get (`?scene=empty`). */
const EMPTY_SETTINGS: SceneSettings = { width: 1000, height: 560, scale: 0.9, background: 'dots', fit: 'canvas', elements: [], links: [], shapes: [] };
const EMPTY_ROWS = [
  { id: 'tank1', value: 72, running: true }, { id: 'tank2', value: 35, running: true }, { id: 'pump1', running: true }, { id: 'pump2', running: true },
  { id: 'valve1', running: true }, { id: 'meter1', running: true }, { id: 'filter1', running: true }, { id: 'fan1', running: true },
];

/** The process diagram editor on the HVAC sample diagram, with example board parameters and a stand-in actions panel. */
export function SceneEditorDemo() {
  const [applied, setApplied] = useState<SceneSettings | null>(null);
  const empty = useSearchParams().get('scene') === 'empty';
  return (
    <WidgetKitProvider value={{ renderIcon }}>
      <div className="flex h-[calc(100vh-7rem)] min-h-[680px] flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-base">
          <SceneEditor
            title={empty ? 'New diagram' : SECTOR_SCENE.title}
            settings={empty ? EMPTY_SETTINGS : (SECTOR_SCENE.settings as SceneSettings)}
            data={{ points: { shape: 'table', rows: empty ? EMPTY_ROWS : SECTOR_SCENE.rows } }}
            params={{ mode: 'on' }}
            storageKey="kui.showcase.scene-editor"
            host={{
              params: [{ key: 'mode', label: 'Plant mode', values: ['on', 'off'] }],
              columns,
              actionIds: ACTION_IDS,
              renderActions: (id) => <p className="p-3 text-sm text-text-secondary">The host edits the click, double-click and right-click actions of “{id}” here.</p>,
            }}
            onApply={(s) => { setApplied(s); }}
            onClose={() => setApplied(null)}
          />
        </div>
        {applied && <p role="status" className="text-sm text-text-secondary">Applied: {(applied.elements as unknown[] | undefined)?.length ?? 0} symbols, {(applied.links as unknown[] | undefined)?.length ?? 0} connections.</p>}
      </div>
    </WidgetKitProvider>
  );
}
const columns = COLUMNS;
