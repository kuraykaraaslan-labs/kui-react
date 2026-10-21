'use client';
import { useState } from 'react';
import { WidgetKitProvider } from '@/modules/app/WidgetKit';
import { SceneEditor } from '@/modules/app/WidgetKit/views/SceneEditor';
import { SECTOR_SCENE } from '@/modules/app/WidgetKit/sample/scada-sector-hvac';
import type { SceneSettings } from '@/modules/app/WidgetKit/views/scada-scene-logic';
import { renderIcon } from './IotDashboard';

const COLUMNS = ['value', 'value2', 'running', 'status', 'warning', 'critical', 'label', 'capacity'].map((key) => ({ key }));
const ACTION_IDS = new Set(['ch', 'ahu']);

/** The process diagram editor on the HVAC sample diagram, with example board parameters and a stand-in actions panel. */
export function SceneEditorDemo() {
  const [applied, setApplied] = useState<SceneSettings | null>(null);
  return (
    <WidgetKitProvider value={{ renderIcon }}>
      <div className="flex h-[calc(100vh-7rem)] min-h-[680px] flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface-base">
          <SceneEditor
            title={SECTOR_SCENE.title}
            settings={SECTOR_SCENE.settings as SceneSettings}
            data={{ points: { shape: 'table', rows: SECTOR_SCENE.rows } }}
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
