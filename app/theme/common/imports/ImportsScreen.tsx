'use client';
import { useState } from 'react';
import { Button } from '@/modules/ui/Button';
import { Drawer } from '@/modules/ui/Drawer';
import { PageHeader } from '@/modules/ui/PageHeader';
import { ImportWizard } from '@/modules/ui/ImportWizard';
import { createDemoImportAdapter } from '@/modules/ui/ImportWizard/demo-import';

const adapter = createDemoImportAdapter();

/** /theme/common/imports — the import wizard in its drawer (NB data_import: the history page's "New import"). */
export function ImportsScreen() {
  const [open, setOpen] = useState(true);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <PageHeader title="Imports" subtitle="Every import is checked first: nothing is written until you have seen what would happen." actions={[{ label: 'New import', onClick: () => setOpen(true), variant: 'primary' }]} />
      <p className="text-sm text-text-secondary">Try a CSV with a header line, for example <span className="font-mono">name,label,profile</span>, with an empty or repeated name to see the row problems.</p>
      <Button variant="outline" onClick={() => setOpen(true)}>Open the wizard</Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="New import" className="w-full max-w-3xl">
        <ImportWizard adapter={adapter} />
      </Drawer>
    </div>
  );
}
