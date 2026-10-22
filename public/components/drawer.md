# Drawer

- **id:** `drawer`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Overlays/Drawer/index.tsx`
- **status:** stable
- **since:** 2025-02

Side panel sliding in from the screen edge. Left / right placement with focus management and Escape close. Body scroll is locked while open via the shared Overlays useScrollLock hook (iOS rubber-band safe). closeOnRouteChange closes it when the Next.js pathname changes while open, as the AppShell mobile sidebar does.

## Used by

- `widget-kit`

## Design tokens consumed

- `--border`
- `--border-focus`
- `--primary`
- `--surface-raised`
- `--text-disabled`
- `--text-primary`

## Variants

### Right drawer

```tsx
const [open, setOpen] = useState(false);
<Button variant="outline" onClick={() => setOpen(true)}>Open Drawer</Button>
<Drawer open={open} onClose={() => setOpen(false)} title="Settings" side="right"
  footer={<><Button variant="outline">Cancel</Button><Button variant="primary">Save</Button></>}>
  <p>Drawer content goes here.</p>
</Drawer>
```

### Left drawer

```tsx
<Drawer open={open} onClose={() => setOpen(false)} title="Navigation" side="left">...</Drawer>
```

### Route-aware close

```tsx
// closeOnRouteChange: closes when the Next.js pathname changes while open.
<Drawer
  open={open}
  onClose={() => setOpen(false)}
  title="Route-aware drawer"
  side="right"
  closeOnRouteChange
>
  ...
</Drawer>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef } from 'react';

export function Drawer({ open, onClose, title, side = 'right', children, footer, className }) {
  // focus trap + Escape key handler
  return (
    <div className={cn('fixed inset-0 z-50 flex', !open && 'pointer-events-none')} aria-modal="true" role="dialog" aria-label={title}>
      <div className={cn('absolute inset-0 bg-black/50 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} aria-hidden="true" />
      <div className={cn('relative flex flex-col w-80 max-w-full h-full bg-surface-raised shadow-xl transition-transform duration-200 focus-visible:outline-none', side === 'right' ? 'ml-auto border-l border-border' : 'mr-auto border-r border-border', open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full', className)}>
        <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close drawer" className="text-text-disabled hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="px-4 py-4 border-t border-border shrink-0 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
```
