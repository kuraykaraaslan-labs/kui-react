'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { SceneSetupDrawer } from '@/modules/app/WidgetKit/views/SceneSetupDrawer';
import type { BindingDraft, DeviceElement, SceneKey } from '@/modules/app/WidgetKit/views/scene-binding-logic';
import type { SceneSetupDevice, SceneSetupDocument } from '@/modules/app/WidgetKit/views/SceneSetupDrawer';

// The server wants uuids for documents and devices; the demo's are made up.
const HOME = '0a000000-0000-4000-8000-000000000001';
const PORCH = '0a000000-0000-4000-8000-000000000002';
const GARAGE = '0a000000-0000-4000-8000-000000000003';
const HUB = '0b000000-0000-4000-8000-000000000001';
const GONE_DEVICE = '0b000000-0000-4000-8000-0000000000ff';

const DOCUMENTS: SceneSetupDocument[] = [
  { id: HOME, name: 'Home network', updatedAt: '2026-10-20T09:30:00Z', usedBy: 2 },
  { id: PORCH, name: 'Porch camera', updatedAt: '2026-10-02T14:05:00Z', usedBy: 0 },
  { id: GARAGE, name: 'Garage door', updatedAt: '2026-09-18T08:00:00Z', usedBy: 5 },
];
const KEYS: Record<string, SceneKey[]> = {
  [HOME]: [
    { key: 'router', kind: 'symbol', label: 'Router', catalogue: 'router' },
    { key: 'tv', kind: 'symbol', label: 'Living room TV', catalogue: 'display' },
    { key: 'cam', kind: 'symbol', label: 'Porch camera', catalogue: 'camera' },
    { key: 'plug', kind: 'symbol', label: 'Smart plug', catalogue: 'plug' },
    { key: 'lamp', kind: 'symbol' },
  ],
  [PORCH]: [{ key: 'cam', kind: 'symbol', label: 'Porch camera', catalogue: 'camera' }, { key: 'light', kind: 'symbol', catalogue: 'lamp' }],
  [GARAGE]: [{ key: 'door', kind: 'symbol', label: 'Door' }],
};
const DEVICES: SceneSetupDevice[] = [{ id: HUB, label: 'Home hub', code: 'HUB-01' }];
const ELEMENTS: DeviceElement[] = [
  { element: 'router', deviceId: HUB, catalogue: 'router' },
  { element: 'television', label: 'Living room TV', deviceId: HUB, catalogue: 'display' },
  { element: 'camera1', deviceId: HUB, catalogue: 'camera' },
  { element: 'plug', deviceId: HUB, catalogue: 'plug' },
  { element: 'door', deviceId: HUB },
  { element: 'energy', label: 'Energy', deviceId: HUB },
];

/** The scene setup drawer with sample data: the host here is this component (a real host fetches and saves). */
export function SceneSetupDemo() {
  const [open, setOpen] = useState(true);
  const [documentId, setDocumentId] = useState(HOME);
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
        // A saved binding with things the scene no longer has (the drawer lists them as stale entries), and a view that travels through.
        initial={{
          slot: 'main', kind: 'diagram', documentId: HOME, devices: { '': HUB, oven: GONE_DEVICE },
          map: { oldlamp: { deviceId: HUB, element: 'lamp1' } }, hidden: ['tv'], view: { level: 'ground' },
        }}
        kinds={['diagram', 'design']}
        documents={DOCUMENTS}
        onDocumentChange={setDocumentId}
        sceneKeysDocumentId={documentId}
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
