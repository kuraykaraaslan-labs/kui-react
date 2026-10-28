'use client';
import { useState } from 'react';
import { AnnouncementDialog, type AnnouncementDialogProps } from '@/modules/ui/AnnouncementDialog';
import { Button } from '@/modules/ui/Button';
import type { ShowcaseComponent } from '../showcase.types';

type DemoProps = Omit<AnnouncementDialogProps, 'open' | 'onAcknowledge' | 'onDismiss'> & { trigger: string };

function AnnouncementDemo({ trigger, ...props }: DemoProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => { setDone(''); setOpen(true); }}>{trigger}</Button>
      <span className="text-xs text-text-secondary" aria-live="polite">{done}</span>
      <AnnouncementDialog
        {...props}
        open={open}
        onAcknowledge={() => { setOpen(false); setDone('Acknowledged'); }}
        onDismiss={() => { setOpen(false); setDone('Closed: shown again later'); }}
      />
    </div>
  );
}

export function buildAnnouncementDialogData(): ShowcaseComponent[] {
  return [
    {
      id: 'announcement-dialog',
      title: 'AnnouncementDialog',
      category: 'Molecule',
      abbr: 'Ao',
      description: 'A message from the people who run the product to the person using it (a platform notice, planned maintenance), shown over the page until it is acknowledged. One answer, OK, which the host stores. A critical one (or required) has no close button and ignores Escape and the backdrop. Not a confirmation: questions go through ConfirmDialog.',
      filePath: 'modules/ui/AnnouncementDialog.tsx',
      since: '2026-10',
      composes: ['button'],
      relatedTo: ['modal', 'confirm-dialog', 'alert-banner', 'toast'],
      a11y: {
        wcagLevel: 'AA',
        ariaPatterns: ['dialog', 'alertdialog'],
        keyboardInteractions: [
          { keys: 'Tab', action: 'Move between the link, the close button and OK' },
          { keys: 'Enter', action: 'Acknowledge from the OK button' },
          { keys: 'Escape', action: 'Close without acknowledging (not while it must be acknowledged)' },
        ],
      },
      sourceCode: `'use client';
import { AnnouncementDialog } from '@/modules/ui/AnnouncementDialog';

<AnnouncementDialog
  open={!!current}
  title={current.title}
  body={current.body}
  severity={current.severity}          // 'info' | 'warning' | 'critical'
  meta="Platform team · 28 Oct 2026, 14:00"
  link={{ href: '/status', label: 'Status page' }}
  position={queue.length > 1 ? \`1 of \${queue.length}\` : undefined}
  onAcknowledge={() => acknowledge(current.id)}   // stored: not shown to this person again
  onDismiss={() => hideForNow(current.id)}        // shown again on the next page
/>`,
      variants: [
        {
          title: 'Info',
          layout: 'side',
          preview: (
            <AnnouncementDemo
              trigger="New feature"
              title="Boards can be shared by link"
              body={'Open a board and choose Share.\nLinks expire after 30 days.'}
              meta="Product team · 28 Oct 2026"
            />
          ),
          code: `<AnnouncementDialog open title="Boards can be shared by link" body="Open a board and choose Share." meta="Product team · 28 Oct 2026" onAcknowledge={ack} onDismiss={later} />`,
        },
        {
          title: 'Planned maintenance',
          layout: 'side',
          preview: (
            <AnnouncementDemo
              trigger="Maintenance"
              severity="warning"
              severityLabel="Planned maintenance"
              title="Saturday 02:00–04:00"
              body="Saving is paused during the window; reading works."
              link={{ href: '#status', label: 'Status page' }}
              position="1 of 2"
            />
          ),
          code: `<AnnouncementDialog open severity="warning" severityLabel="Planned maintenance" title="Saturday 02:00–04:00" link={{ href: '/status', label: 'Status page' }} position="1 of 2" onAcknowledge={ack} />`,
        },
        {
          title: 'Critical (must acknowledge)',
          layout: 'side',
          preview: (
            <AnnouncementDemo
              trigger="Outage"
              severity="critical"
              severityLabel="Critical"
              title="Unplanned maintenance in progress"
              body="Devices keep sending; dashboards catch up when it ends. Expected back by 15:30."
              acknowledgeLabel="I understand"
            />
          ),
          code: `<AnnouncementDialog open severity="critical" severityLabel="Critical" title="Unplanned maintenance in progress" acknowledgeLabel="I understand" onAcknowledge={ack} />`,
        },
      ],
    },
  ];
}
