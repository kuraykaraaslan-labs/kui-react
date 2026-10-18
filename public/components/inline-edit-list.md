# InlineEditList

- **id:** `inline-edit-list`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/InlineEditList/index.tsx`
- **status:** beta
- **since:** 2026-10

A list whose rows edit in place: add, edit, remove and reorder, all from the keyboard, with a validation message per row and an async save state per row. Controlled: every change goes through onChange(next, change); return a promise to show saving, reject to show the row's error.

## Accessibility

- WCAG: AA
- ARIA patterns: list, alert, status
- Keyboard:
  - `ArrowUp / ArrowDown / Home / End` — Move between rows
  - `Enter / F2` — Edit the row
  - `Delete` — Remove the row
  - `Alt + ArrowUp / ArrowDown` — Move the row
  - `Enter / Escape (in the editor)` — Save / cancel

## Design tokens consumed

- `--surface-raised`
- `--surface-base`
- `--border`
- `--border-focus`
- `--error`
- `--success`
- `--primary`
- `--primary-fg`
- `--text-primary`
- `--text-secondary`

## Variants

### Synchronous

```tsx
<InlineEditList items={items} onChange={(next) => setItems(next)} validate={validate} />
```

### Async save (type "fail" to see an error)

```tsx
<InlineEditList items={items} onChange={async (next) => { await save(next); setItems(next); }} />
```

## Full source

```tsx
import { InlineEditList } from '@/modules/ui/InlineEditList';

<InlineEditList
  items={items}                       // { id, text }[]
  onChange={async (next, change) => { await save(next); setItems(next); }}
  validate={(draft) => (draft.text.trim() ? null : 'Enter a name.')}
/>
```
