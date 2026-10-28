# DropdownMenu

- **id:** `dropdown-menu`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/DropdownMenu.tsx`
- **status:** stable
- **since:** 2025-03

Accessible dropdown using role="menu" + role="menuitem". Closes on Escape and outside click. Supports left/right alignment, icons, separators, danger and disabled items, and arrow-key navigation. Items take an optional id, href, group, order, hidden and disabledReason so other modules can contribute entries; `portal` escapes clipping parents; `placement="top"` opens the menu upward from a trigger at the bottom edge (with `portal` it is capped to the space above). Page-menu extras: heading entries (or `groupLabels` per group), `selected` and `trailing` items, a `search` box once the list is long, a `footer`, `menuClassName`, and controlled `open` / `onOpenChange`.

## Design tokens consumed

- `--border`
- `--error`
- `--error-subtle`
- `--primary`
- `--surface-overlay`
- `--surface-raised`
- `--text-primary`

## Variants

### Default

```tsx
<DropdownMenu
  trigger={<Button variant="outline" size="sm">Actions ▾</Button>}
  items={[
    { label: 'Edit', icon: '✏' },
    { label: 'Duplicate', icon: '⧉' },
    { type: 'separator' },
    { label: 'Delete', icon: '🗑', danger: true },
  ]}
/>
```

### Right-aligned

```tsx
<DropdownMenu align="right"
  trigger={<Button variant="ghost" size="sm">⋮</Button>}
  items={[{ label: 'View details' }, { label: 'Remove', danger: true }]}
/>
```

### Contributed items: group, order, hidden, href, disabledReason

```tsx
// Items sort by group (ranked by their lowest order) and order; a separator splits groups.
<DropdownMenu
  trigger={<Button variant="outline" size="sm">Contact ▾</Button>}
  items={[
    { id: 'edit', label: 'Edit', group: 'record', order: 10 },
    { id: 'call', label: 'Call', group: 'contact', order: 20, href: '/calls/new?to=…' },
    { id: 'sign', label: 'Send for signature', group: 'contact', order: 30, disabled: true, disabledReason: 'Add an email address first' },
    { id: 'campaign', label: 'Add to campaign', group: 'contact', order: 40, hidden: !canMarket },
    { id: 'delete', label: 'Delete', group: 'danger', order: 1000, danger: true },
  ]}
/>
// Merge contributed items into a base list (same id replaces in place):
const items = mergeMenuItems(baseItems, contributedItems);
```

### Page menu: group headings, selected, trailing, search, footer

```tsx
// Headings come from groupLabels; the search box shows from 8 entries (search.minItems).
// Arrow keys, Home and End move between items; Enter in the box picks the first match.
const [open, setOpen] = useState(false); // optional: controlled, e.g. for a keyboard shortcut
<DropdownMenu
  open={open}
  onOpenChange={setOpen}
  trigger={<Button variant="outline" size="sm">Pages ▾</Button>}
  menuClassName="w-72"
  groupLabels={{ pages: 'Pages', drill: 'Drill-downs' }}
  search={{ placeholder: 'Find a page', emptyText: 'No page matches' }}
  footer={<a href="/pages">Manage pages</a>}
  items={[
    { id: 'overview', label: 'Overview', group: 'pages', selected: true, trailing: <Badge size="sm">Home</Badge> },
    { id: 'energy', label: 'Energy', group: 'pages' },
    { id: 'line-1', label: 'Line 1', group: 'drill' },
    // … or plain lists with { type: 'heading', label: 'Pages' } entries
  ]}
/>
```

## Full source

```tsx
'use client';
import { cn } from '@/libs/utils/cn';
import { useEffect, useRef, useState } from 'react';

export function DropdownMenu({ trigger, items, align = 'left', className }) {
  const [open, setOpen] = useState(false);
  // outside click + Escape handlers
  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((p) => !p)} aria-haspopup="menu" aria-expanded={open}>{trigger}</div>
      {open && (
        <div role="menu" className={cn('absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-border bg-surface-raised shadow-lg py-1', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((item, i) => item.type === 'separator' ? <div key={i} role="separator" className="my-1 border-t border-border" /> : (
            <button key={i} role="menuitem" type="button" disabled={item.disabled} onClick={() => { item.onClick?.(); setOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:bg-surface-overlay', item.danger ? 'text-error hover:bg-error-subtle' : 'text-text-primary hover:bg-surface-overlay', item.disabled && 'opacity-50 cursor-not-allowed')}>
              {item.icon && <span aria-hidden="true">{item.icon}</span>}{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```
