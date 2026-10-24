# TypedConfirmDialog

- **id:** `typed-confirm-dialog`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/TypedConfirmDialog.tsx`
- **status:** stable
- **since:** 2026-10

A confirmation that needs the user to type an exact phrase (a serial, a command word) before confirming: stronger than Popconfirm for actions that cannot be undone.

## Variants

### A command word

```tsx
<TypedConfirmDialog open title="Reboot?" phrase="REBOOT" label="Type REBOOT" confirmLabel="Reboot" onConfirm={go} onCancel={close} />
```

### A serial number

```tsx
<TypedConfirmDialog open title="Release device?" phrase={device.serial} … />
```

## Full source

```tsx
import { TypedConfirmDialog } from '@/modules/ui/TypedConfirmDialog';
<TypedConfirmDialog open={open} title="Release device?" phrase={serial} label={`Type ${serial} to confirm`} confirmLabel="Release" onConfirm={release} onCancel={close} />
```
