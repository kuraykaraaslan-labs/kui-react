# ConfirmDialog

- **id:** `confirm-dialog`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/ConfirmDialog.tsx`
- **status:** stable
- **since:** 2026-10

The one confirmation of the design system: a question, its consequence and two buttons, plus optional gates in any combination: an input (a reason, a name, a date), a responsibility text to tick, and a phrase to type. Controlled, or imperative through confirmDialog() with one ConfirmHost. Never use window.confirm / window.prompt.

## Depends on

- `modal`
- `button`

## Accessibility

- WCAG: AA
- ARIA patterns: dialog
- Keyboard:
  - `Tab` — Move between the fields, Cancel and the confirm button
  - `Enter` — Confirm from a single-line field once every gate is met
  - `Escape` — Cancel

## Variants

### Plain

```tsx
await confirmDialog({ title: 'Publish the catalogue', message: 'Every node picks up the new plans within a minute.', confirmLabel: 'Publish' });
```

### Danger

```tsx
await confirmDialog({ title: 'Delete user', message: 'Ada Lovelace and all her data are deleted. This cannot be undone.', tone: 'danger', confirmLabel: 'Delete' });
```

### With a reason

```tsx
const r = await confirmDialog({
  title: 'Reject leave request', tone: 'warning', confirmLabel: 'Reject',
  input: { kind: 'textarea', label: 'Reason', required: true, minLength: 3 },
});
if (r) await reject(id, r.value);
```

### With a date

```tsx
await confirmDialog({ title: 'Withdraw consent', confirmLabel: 'Withdraw', input: { kind: 'date', label: 'Effective date', required: true } });
```

### Responsibility text

```tsx
await confirmDialog({
  title: 'Verify payroll parameters', confirmLabel: 'Verify',
  acknowledgement: 'I checked these values against the official gazette and take responsibility for them.',
});
```

### Type to confirm

```tsx
await confirmDialog({ title: 'Reboot gateway', tone: 'danger', confirmLabel: 'Reboot', phrase: 'REBOOT' });
```

### Every gate

```tsx
await confirmDialog({
  title: 'Delete tenant', tone: 'danger', confirmLabel: 'Delete tenant',
  input: { kind: 'textarea', label: 'Reason', required: true },
  acknowledgement: 'I understand this cannot be undone.',
  phrase: tenant.slug,
});
```

### Two ways forward

```tsx
const r = await confirmDialog({ title: 'Someone else saved this page', tone: 'warning', confirmLabel: 'Keep mine', secondaryLabel: 'Load theirs' });
if (r?.choice === 'confirm') await save({ force: true });
else if (r?.choice === 'secondary') await reload();
```

### Action inside the dialog

```tsx
await confirmDialog({
  title: 'Revoke API key', tone: 'danger', confirmLabel: 'Revoke',
  input: { kind: 'text', label: 'Reason', required: true },
  action: ({ value }) => api.revoke(key.id, value), // a throw keeps the dialog open with the error
});
```

## Full source

```tsx
'use client';
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
if (r) await reject(id, r.value);
```
