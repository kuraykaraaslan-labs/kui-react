# Modal

- **id:** `modal`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Overlays/Modal/index.tsx`
- **status:** stable
- **since:** 2025-02

Focus-trapped dialog. Closes on Escape and backdrop click. Requires role="dialog" + aria-modal + aria-labelledby; supports sm/md/lg/xl/full sizes (full = viewport width less the gutter; fullscreen fills the viewport). An Escape an inner control already handled (an open ComboBox / Select list) closes that control, not the dialog. Uses the shared Overlays focus-trap, scroll-lock and presence hooks; nested modals are layer-aware so Escape only dismisses the topmost panel.

## Used by

- `confirm-dialog`
- `entity-aliases`
- `onboarding-wizard`
- `rich-text-editor`
- `share-dialog`
- `widget-kit`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--primary`
- `--surface-raised`
- `--text-disabled`
- `--text-primary`

## Variants

### Confirmation dialog

```tsx
const [open, setOpen] = useState(false);
<Button variant="primary" onClick={() => setOpen(true)}>Open Modal</Button>
<Modal open={open} onClose={() => setOpen(false)} title="Confirm action"
  description="Are you sure you want to proceed?"
  footer={<><Button variant="outline">Cancel</Button><Button variant="danger">Delete</Button></>}>
  <p>This will permanently delete all selected items.</p>
</Modal>
```

### Sizes (sm / md / lg)

```tsx
<Modal open={open} onClose={onClose} title="Small" size="sm">...</Modal>
<Modal open={open} onClose={onClose} title="Medium" size="md">...</Modal>
<Modal open={open} onClose={onClose} title="Large" size="lg">...</Modal>
```

### Scrollable body

```tsx
<Modal open={open} onClose={onClose} title="Long Content" scrollable
  footer={<Button>OK</Button>}>
  {/* long content scrolls inside */}
</Modal>
```

### Fullscreen

```tsx
<Modal open={open} onClose={onClose} title="Fullscreen Dialog" fullscreen>...</Modal>
```

### Nested modals (layer-aware Escape)

```tsx
// Opens a second modal on top — Escape only dismisses the inner one.
const [outer, setOuter] = useState(false);
const [inner, setInner] = useState(false);
<Modal open={outer} onClose={() => setOuter(false)} title="Outer">
  <Button onClick={() => setInner(true)}>Open Nested</Button>
</Modal>
<Modal open={inner} onClose={() => setInner(false)} title="Nested" size="sm">
  ...
</Modal>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef } from 'react';

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const panelRef = useRef(null);
  useEffect(() => { if (!open) return; const prev = document.activeElement; panelRef.current?.focus(); return () => prev?.focus(); }, [open]);
  useEffect(() => { if (!open) return; const onKey = (e) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open, onClose]);
  if (!open) return null;
  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} className={cn('relative z-10 w-full rounded-xl border border-border bg-surface-raised shadow-xl flex flex-col focus-visible:outline-none', sizeClass, className)}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border">
          <h2 id="modal-title" className="text-base font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded">✕</button>
        </div>
        {children && <div className="px-6 py-4 flex-1">{children}</div>}
        {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
```
