# Popover

- **id:** `popover`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Overlays/Popover/index.tsx`
- **status:** stable
- **since:** 2025-03

Anchor-based contextual panel. Closes on outside click (capture-phase pointerdown) and Escape, layered with sibling overlays. Supports top/bottom/left/right placement. Built-in focus trap (focusTrap prop) keeps Tab cycling inside the panel. `shrinkTrigger` caps the trigger wrapper at its container's width, so a `max-w-full` / `truncate` trigger shrinks instead of overflowing.

## Used by

- `entity-aliases`

## Variants

### Bottom (default)

```tsx
<Popover trigger={<Button variant="outline">Open</Button>} placement="bottom">
  <div className="p-4">
    <p className="text-sm font-semibold">Title</p>
    <p className="text-xs text-text-secondary">Content goes here.</p>
  </div>
</Popover>
```

### Placements

```tsx
<Popover placement="top" trigger={<Button>Top</Button>}><div>...</div></Popover>
<Popover placement="right" trigger={<Button>Right</Button>}><div>...</div></Popover>
```

### Focus trap inside Popover

```tsx
<Popover focusTrap placement="bottom" trigger={<Button>Quick edit</Button>}>
  <form onSubmit={(e) => e.preventDefault()} className="p-4 space-y-3 w-64">
    <input type="text" placeholder="Title" />
    <input type="text" placeholder="Tag" />
    <Button type="submit">Save</Button>
  </form>
</Popover>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef, useState } from 'react';

export function Popover({ trigger, children, placement = 'bottom' }) {
  // manages open state, outside-click + Escape close, focus management
}
```
