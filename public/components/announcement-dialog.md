# AnnouncementDialog

- **id:** `announcement-dialog`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/AnnouncementDialog.tsx`
- **status:** stable
- **since:** 2026-10

A message from the people who run the product to the person using it (a platform notice, planned maintenance), shown over the page until it is acknowledged. One answer, OK, which the host stores. A critical one (or required) has no close button and ignores Escape and the backdrop. Not a confirmation: questions go through ConfirmDialog.

## Depends on

- `button`

## Accessibility

- WCAG: AA
- ARIA patterns: dialog, alertdialog
- Keyboard:
  - `Tab` — Move between the link, the close button and OK
  - `Enter` — Acknowledge from the OK button
  - `Escape` — Close without acknowledging (not while it must be acknowledged)

## Variants

### Info

```tsx
<AnnouncementDialog open title="Boards can be shared by link" body="Open a board and choose Share." meta="Product team · 28 Oct 2026" onAcknowledge={ack} onDismiss={later} />
```

### Planned maintenance

```tsx
<AnnouncementDialog open severity="warning" severityLabel="Planned maintenance" title="Saturday 02:00–04:00" link={{ href: '/status', label: 'Status page' }} position="1 of 2" onAcknowledge={ack} />
```

### Critical (must acknowledge)

```tsx
<AnnouncementDialog open severity="critical" severityLabel="Critical" title="Unplanned maintenance in progress" acknowledgeLabel="I understand" onAcknowledge={ack} />
```

## Full source

```tsx
'use client';
import { AnnouncementDialog } from '@/modules/ui/AnnouncementDialog';

<AnnouncementDialog
  open={!!current}
  title={current.title}
  body={current.body}
  severity={current.severity}          // 'info' | 'warning' | 'critical'
  meta="Platform team · 28 Oct 2026, 14:00"
  link={{ href: '/status', label: 'Status page' }}
  position={queue.length > 1 ? `1 of ${queue.length}` : undefined}
  onAcknowledge={() => acknowledge(current.id)}   // stored: not shown to this person again
  onDismiss={() => hideForNow(current.id)}        // shown again on the next page
/>
```
