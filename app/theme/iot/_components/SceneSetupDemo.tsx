'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { SceneSetupDrawer } from '@/modules/app/WidgetKit/views/SceneSetupDrawer';
import type { BindingDraft, DeviceElement, SceneKey } from '@/modules/app/WidgetKit/views/scene-binding-logic';
import type { SceneSetupDevice, SceneSetupDocument } from '@/modules/app/WidgetKit/views/SceneSetupDrawer';

const DOCUMENTS: SceneSetupDocument[] = [
  { id: 'home', name: 'Home network', updatedAt: '2026-10-20T09:30:00Z', usedBy: 2 },
  { id: 'porch', name: 'Porch camera', updatedAt: '2026-10-02T14:05:00Z', usedBy: 0 },
  { id: 'garage', name: 'Garage door', updatedAt: '2026-09-18T08:00:00Z', usedBy: 5 },
];
const KEYS: Record<string, SceneKey[]> = {
  home: [
    { key: 'router', kind: 'symbol', label: 'Router', catalogue: 'router' },
    { key: 'tv', kind: 'symbol', label: 'Living room TV', catalogue: 'display' },
    { key: 'cam', kind: 'symbol', label: 'Porch camera', catalogue: 'camera' },
    { key: 'plug', kind: 'symbol', label: 'Smart plug', catalogue: 'plug' },
    { key: 'lamp', kind: 'symbol' },
  ],
  porch: [{ key: 'cam', kind: 'symbol', label: 'Porch camera', catalogue: 'camera' }, { key: 'light', kind: 'symbol', catalogue: 'lamp' }],
  garage: [{ key: 'door', kind: 'symbol', label: 'Door' }],
};
const DEVICES: SceneSetupDevice[] = [{ id: 'dev-hub', label: 'Home hub', code: 'HUB-01' }];
const ELEMENTS: DeviceElement[] = [
  { element: 'router', deviceId: 'dev-hub', catalogue: 'router' },
  { element: 'television', label: 'Living room TV', deviceId: 'dev-hub', catalogue: 'display' },
  { element: 'camera1', deviceId: 'dev-hub', catalogue: 'camera' },
  { element: 'plug', deviceId: 'dev-hub', catalogue: 'plug' },
  { element: 'door', deviceId: 'dev-hub' },
  { element: 'energy', label: 'Energy', deviceId: 'dev-hub' },
];

/** The scene setup drawer with sample data: the host here is this component (a real host fetches and saves). */
export function SceneSetupDemo() {
  const [open, setOpen] = useState(true);
  const [documentId, setDocumentId] = useState('home');
  const [picking, setPicking] = useState<string | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [saved, setSaved] = useState<BindingDraft | null>(null);
  const keys = KEYS[documentId] ?? [];

  return (
    <div className="space-y-3 p-6">
      <Button onClick={() => setOpen(true)}>Set up scene…</Button>
      {saved && <pre className="overflow-auto rounded-lg border border-border bg-surface-sunken p-3 text-xs" aria-label="Saved binding">{JSON.stringify(saved, null, 2)}</pre>}
      <SceneSetupDrawer
        open={open}
        onClose={() => setOpen(false)}
        initial={{ slot: 'main', kind: 'diagram', documentId: 'home' }}
        kinds={['diagram', 'design']}
        documents={DOCUMENTS}
        onDocumentChange={setDocumentId}
        onNewFromDevice={() => {}}
        devices={DEVICES}
        sceneKeys={keys}
        elements={ELEMENTS}
        pickedKey={pickedKey}
        onPick={setPicking}
        preview={
          <div className="space-y-2 p-2">
            <p className="text-xs text-text-secondary">{picking ? `Click ${picking} below` : 'Press Pick on a row, then click its symbol.'}</p>
            <div className="flex flex-wrap gap-2">
              {keys.map((k) => (
                <button
                  key={k.key} type="button" onClick={() => setPickedKey(k.key)}
                  className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  {k.key}
                </button>
              ))}
            </div>
          </div>
        }
        askReason
        onSave={(draft) => { setSaved(draft); setOpen(false); }}
      />
    </div>
  );
}
