# KanbanBoard

- **id:** `kanban-board`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/KanbanBoard/index.tsx`
- **status:** beta
- **since:** 2026-05

Trello / Linear-style kanban board. M1 ships HTML5-native drag and drop between columns with an inline drop-position indicator (thin line between cards) and full optimistic-UI rewind on rejected onCardMove. Use the canMove hook to gate transitions client-side, or throw from onCardMove to revert. Future milestones: column reorder + collapse + WIP limits (M2), swimlanes + filters + search (M3), inline edit + bulk select + card detail panel (M4), keyboard nav + ARIA announcements (M5), virtualization + auto-archive + dependencies (M6). Pixel-identical EJS sibling at modules/app/KanbanBoard/KanbanBoard.ejs.

## Depends on

- `badge`
- `avatar`

## Accessibility

- WCAG: AA
- ARIA patterns: region, list, listitem, application
- Keyboard:
  - `Tab` — Move focus across cards / columns
  - `Drag (mouse)` — Pick up a card and drop on any column slot

M1 uses HTML5 drag-and-drop; each column is role="region" with aria-label, the list is role="list", cards are role="listitem". aria-grabbed (deprecated but still announced by some screen readers) flips on the active card; aria-dropeffect="move" is set on all columns while a drag is in flight. Full keyboard parity ships in M5.

## Design tokens consumed

- `--surface-base`
- `--surface-raised`
- `--surface-overlay`
- `--text-primary`
- `--text-secondary`
- `--text-disabled`
- `--border`
- `--border-strong`
- `--border-focus`
- `--primary`
- `--primary-subtle`
- `--info-subtle`
- `--warning-subtle`
- `--error-subtle`
- `--success-subtle`

## Variants

### Three columns (basic)

```tsx
const columns = [
  { id: 'todo',  title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done',  title: 'Done' },
];
const [cards, setCards] = useState(initialCards);
<KanbanBoard
  columns={columns}
  cards={cards}
  onCardMove={(card, from, to) =>
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
    )
  }
/>
```

### canMove validation (no exit from Done)

```tsx
<KanbanBoard
  columns={columns}
  cards={cards}
  canMove={(card, from, to) => from !== 'done' || to === 'done'}
  onCardMove={persist}
/>
```

### Pipeline: totals, badges, WIP limit, folding, keyboard

```tsx
<KanbanBoard
  columns={[
    { id: 'lead', title: 'Lead', summary: '$18,400 · 3 deals', color: '#2457c5' },
    { id: 'proposal', title: 'Proposal', wipLimit: 2 },
    { id: 'won', title: 'Won', badge: <Badge variant="success">Won</Badge> },
    { id: 'lost', title: 'Lost', collapsed: true },
  ]}
  cards={cards}
  onCardClick={open}        // click or Enter
  onCardMove={persist}      // drag, or Alt + arrow keys
  messages={{ column: 'Sütun {title}', emptyColumn: 'Kart yok' }}
/>
```

### Async onCardMove with rollback

```tsx
<KanbanBoard
  columns={columns}
  cards={cards}
  onCardMove={async (card, from, to) => {
    const res = await fetch('/api/move', { method: 'POST', body: JSON.stringify({ card, to }) });
    // Throw to revert the optimistic update.
    if (!res.ok) throw new Error('Server rejected');
    setCards(next);
  }}
/>
```

## Full source

```tsx
import { useState } from 'react';
import { KanbanBoard, type KanbanCard, type KanbanColumn } from '@/modules/app/KanbanBoard';

const columns: KanbanColumn[] = [
  { id: 'todo',  title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done',  title: 'Done' },
];

const initialCards: KanbanCard[] = [
  { id: 'c1', columnId: 'todo',  title: 'Audit dark-mode tokens', priority: 'medium' },
  { id: 'c2', columnId: 'doing', title: 'Refactor Quill toolbar', assignees: [{ id: 'u1', name: 'Jane Doe' }] },
];

function Board() {
  const [cards, setCards] = useState(initialCards);
  return (
    <KanbanBoard
      columns={columns}
      cards={cards}
      onCardMove={async (card, from, to, index) => {
        // Optimistic: KanbanBoard already moved the card. Persist remotely;
        // throw to revert. `index` is the destination insertion index.
        await fetch('/api/cards/' + card.id, {
          method: 'PATCH',
          body: JSON.stringify({ columnId: to, index }),
        }).then((r) => { if (!r.ok) throw new Error(r.statusText); });
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, columnId: to } : c)),
        );
      }}
      canMove={(card, from, to) => from !== 'done' || to === 'done'}
    />
  );
}
```
