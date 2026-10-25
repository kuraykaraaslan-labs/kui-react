'use client';
import { useState } from 'react';
import { ConfirmDialog, confirmDialog, type ConfirmDialogProps, type ConfirmResult } from '@/modules/ui/ConfirmDialog';
import { Button } from '@/modules/ui/Button';
import type { ShowcaseComponent } from '../showcase.types';

type DemoProps = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'> & { trigger: string; triggerVariant?: 'primary' | 'danger' | 'outline' };

function ConfirmDemo({ trigger, triggerVariant = 'outline', ...props }: DemoProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const answer = (r: ConfirmResult) => { setOpen(false); setDone(r.value ? `Confirmed: ${r.value}` : r.choice === 'secondary' ? 'Second action' : 'Confirmed'); };
  return (
    <div className="flex items-center gap-3">
      <Button variant={triggerVariant} size="sm" onClick={() => { setDone(''); setOpen(true); }}>{trigger}</Button>
      <span className="text-xs text-text-secondary" aria-live="polite">{done}</span>
      <ConfirmDialog {...props} open={open} onCancel={() => { setOpen(false); setDone('Cancelled'); }} onConfirm={answer} />
    </div>
  );
}

function ImperativeDemo() {
  const [done, setDone] = useState('');
  let attempts = 0;
  const ask = async () => {
    setDone('');
    const r = await confirmDialog({
      title: 'Revoke API key',
      message: 'Integrations that use "billing-sync" stop working at once.',
      tone: 'danger',
      confirmLabel: 'Revoke',
      input: { kind: 'text', label: 'Reason', required: true },
      // The first try fails, to show the error staying inside the dialog.
      action: async () => { attempts += 1; await new Promise((ok) => setTimeout(ok, 600)); if (attempts === 1) throw new Error('The server is busy. Try again.'); },
    });
    setDone(r ? `Revoked (${r.value})` : 'Cancelled');
  };
  return (
    <div className="flex items-center gap-3">
      <Button variant="danger" size="sm" onClick={() => { void ask(); }}>Revoke key</Button>
      <span className="text-xs text-text-secondary" aria-live="polite">{done}</span>
    </div>
  );
}

export function buildConfirmDialogData(): ShowcaseComponent[] {
  return [
    {
      id: 'confirm-dialog',
      title: 'ConfirmDialog',
      category: 'Molecule',
      abbr: 'Cf',
      description: 'The one confirmation of the design system: a question, its consequence and two buttons, plus optional gates in any combination: an input (a reason, a name, a date), a responsibility text to tick, and a phrase to type. Controlled, or imperative through confirmDialog() with one ConfirmHost. Never use window.confirm / window.prompt.',
      filePath: 'modules/ui/ConfirmDialog.tsx',
      since: '2026-10',
      composes: ['modal', 'button'],
      relatedTo: ['typed-confirm-dialog', 'popconfirm'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['dialog'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Move between the fields, Cancel and the confirm button' },
          { keys: 'Enter', action: 'Confirm from a single-line field once every gate is met' },
          { keys: 'Escape', action: 'Cancel' },
        ],
      },
      sourceCode: `'use client';
import { ConfirmHost, confirmDialog } from '@/modules/ui/ConfirmDialog';

// Once, at the app root:
<ConfirmHost />

// Anywhere on the client:
const ok = await confirmDialog({
  title: 'Delete user',
  message: 'Ada Lovelace and all her data are deleted. This cannot be undone.',
  tone: 'danger',
  confirmLabel: 'Delete',
});
if (!ok) return;

// With a reason the call gets back:
const r = await confirmDialog({ title: 'Reject leave', confirmLabel: 'Reject', input: { kind: 'textarea', label: 'Reason', required: true } });
if (r) await reject(id, r.value);`,
      variants: [
        {
          title: 'Plain',
          layout: 'side',
          preview: <ConfirmDemo trigger="Publish" title="Publish the catalogue" message="Every node picks up the new plans within a minute." confirmLabel="Publish" />,
          code: `await confirmDialog({ title: 'Publish the catalogue', message: 'Every node picks up the new plans within a minute.', confirmLabel: 'Publish' });`,
        },
        {
          title: 'Danger',
          layout: 'side',
          preview: <ConfirmDemo trigger="Delete user" triggerVariant="danger" tone="danger" title="Delete user" message="Ada Lovelace and all her data are deleted. This cannot be undone." confirmLabel="Delete" />,
          code: `await confirmDialog({ title: 'Delete user', message: 'Ada Lovelace and all her data are deleted. This cannot be undone.', tone: 'danger', confirmLabel: 'Delete' });`,
        },
        {
          title: 'With a reason',
          layout: 'side',
          preview: <ConfirmDemo trigger="Reject" tone="warning" title="Reject leave request" message="The employee is told the reason." confirmLabel="Reject" input={{ kind: 'textarea', label: 'Reason', required: true, minLength: 3, placeholder: 'Why is it rejected?' }} />,
          code: `const r = await confirmDialog({
  title: 'Reject leave request', tone: 'warning', confirmLabel: 'Reject',
  input: { kind: 'textarea', label: 'Reason', required: true, minLength: 3 },
});
if (r) await reject(id, r.value);`,
        },
        {
          title: 'With a date',
          layout: 'side',
          preview: <ConfirmDemo trigger="Withdraw" title="Withdraw consent" message="Overtime past the legal limit is no longer allowed from this date." confirmLabel="Withdraw" input={{ kind: 'date', label: 'Effective date', required: true, defaultValue: '2026-10-25' }} />,
          code: `await confirmDialog({ title: 'Withdraw consent', confirmLabel: 'Withdraw', input: { kind: 'date', label: 'Effective date', required: true } });`,
        },
        {
          title: 'Responsibility text',
          layout: 'side',
          preview: <ConfirmDemo trigger="Verify" title="Verify payroll parameters" message="Payroll computes with these values from now on." confirmLabel="Verify" acknowledgement="I checked these values against the official gazette and take responsibility for them." />,
          code: `await confirmDialog({
  title: 'Verify payroll parameters', confirmLabel: 'Verify',
  acknowledgement: 'I checked these values against the official gazette and take responsibility for them.',
});`,
        },
        {
          title: 'Type to confirm',
          layout: 'side',
          preview: <ConfirmDemo trigger="Reboot" triggerVariant="danger" tone="danger" title="Reboot gateway" message="All 42 connected devices go offline for about a minute." confirmLabel="Reboot" phrase="REBOOT" />,
          code: `await confirmDialog({ title: 'Reboot gateway', tone: 'danger', confirmLabel: 'Reboot', phrase: 'REBOOT' });`,
        },
        {
          title: 'Every gate',
          layout: 'side',
          preview: <ConfirmDemo trigger="Delete tenant" triggerVariant="danger" tone="danger" title="Delete tenant" message="Acme Corp, its 18 users and all its data are deleted for good." confirmLabel="Delete tenant" input={{ kind: 'textarea', label: 'Reason', required: true }} acknowledgement="I understand this cannot be undone." phrase="acme-corp" />,
          code: `await confirmDialog({
  title: 'Delete tenant', tone: 'danger', confirmLabel: 'Delete tenant',
  input: { kind: 'textarea', label: 'Reason', required: true },
  acknowledgement: 'I understand this cannot be undone.',
  phrase: tenant.slug,
});`,
        },
        {
          title: 'Two ways forward',
          layout: 'side',
          preview: <ConfirmDemo trigger="Save" tone="warning" title="Someone else saved this page" message="Keep your version and overwrite theirs, or load theirs and drop your edits." confirmLabel="Keep mine" secondaryLabel="Load theirs" />,
          code: `const r = await confirmDialog({ title: 'Someone else saved this page', tone: 'warning', confirmLabel: 'Keep mine', secondaryLabel: 'Load theirs' });
if (r?.choice === 'confirm') await save({ force: true });
else if (r?.choice === 'secondary') await reload();`,
        },
        {
          title: 'Action inside the dialog',
          layout: 'side',
          preview: <ImperativeDemo />,
          code: `await confirmDialog({
  title: 'Revoke API key', tone: 'danger', confirmLabel: 'Revoke',
  input: { kind: 'text', label: 'Reason', required: true },
  action: ({ value }) => api.revoke(key.id, value), // a throw keeps the dialog open with the error
});`,
        },
      ],
    },
  ];
}
