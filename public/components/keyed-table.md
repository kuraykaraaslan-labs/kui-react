# KeyedTable

- **id:** `keyed-table`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/KeyedTable.tsx`
- **status:** stable
- **since:** 2026-10

A rows-in, events-out table for data that changes under the viewer: stable row keys, keyboard row focus (Arrow keys, Home/End, Enter), a per-row state (new = highlighted, leaving = fading), optional selection checkboxes, loading / error (retry) / empty states, and columns that hide below a breakpoint.

## Variants

### Live rows and row click

```tsx
<KeyedTable caption="Pumps" rows={rows} getRowKey={(r) => r.id} columns={columns} rowState={(r) => (r.isNew ? 'new' : undefined)} onRowClick={open} />
```

### Selection with a refused row

```tsx
<KeyedTable … selection={{ selected, onChange: setSelected, isSelectable: (r) => r.ok || 'Why not' }} />
```

### Error with retry, and loading

```tsx
<KeyedTable … error="The pumps could not be read." onRetry={reload} />
<KeyedTable … loading />
```

## Full source

```tsx
import { KeyedTable } from '@/modules/ui/KeyedTable';
<KeyedTable caption="Devices" rows={rows} getRowKey={(r) => r.id} columns={columns} onRowClick={open}
  rowState={(r) => (fresh.has(r.id) ? 'new' : undefined)} selection={{ selected, onChange }} loading={loading} error={error} onRetry={reload} />
```
