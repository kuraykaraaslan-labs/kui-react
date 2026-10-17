# RulesetEditor

- **id:** `ruleset-editor`
- **layer:** app
- **category:** App
- **filePath:** `modules/app/RulesetEditor/RulesetEditor/index.tsx`
- **status:** beta
- **since:** 2026-10

A visual flow editor for the blocks of any catalog: typed blocks with params (each block gets a form from its schema), connections, groups, subflows, undo, search, a shortcuts sheet, comments and a help tab per block. It is not tied to a domain: this entry uses a business catalog (a schedule, a webhook in, a comparison, a notification, a webhook out); the IoT demos use device blocks.

## When to use

A user builds "when X happens, do Y" flows from a set of blocks your product defines.

## When NOT to use

A fixed form or a linear wizard: use SchemaForm or OnboardingWizard.

## Accessibility

- WCAG: AA
- ARIA patterns: application, tablist, dialog
- Keyboard:
  - `Ctrl+Z / Ctrl+Y` — Undo and redo
  - `Ctrl+F` — Find a block by name, type, description or id
  - `Ctrl+D` — Duplicate the selection
  - `Alt+N` — Add a comment
  - `?` — List the keyboard shortcuts

## Variants

### A business flow (no devices)

```tsx
<RulesetEditor
  catalog={catalog}            // schedule, webhook in, compare, notification, webhook out
  choices={{ teams: [...] }}   // lists for source fields
  initialNodes={nodes}
  initialEdges={edges}
/>
```

### Read only

```tsx
<RulesetEditor readOnly catalog={catalog} initialNodes={nodes} initialEdges={edges} />
```

### In another language

```tsx
<RulesetEditor
  catalog={catalog}
  messages={{ paletteTitle: 'Blocktypen', toolUndo: 'Rückgängig', menuPaste: 'Einfügen' /* … */ }}
/>
// Any part of the bundle can be given; the rest stays English. See EditorMessages.
```

### Version compare

```tsx
import { diffView } from '@/modules/app/RulesetEditor';

// both versions in one graph: what was removed comes back at its old place
const view = diffView(deployedGraph, draftGraph);
<RulesetEditor readOnly catalog={catalog} initialNodes={view.nodes} initialEdges={view.edges} diffTint={view.tint} />
// view.diff is the change list per block and field (diffFlows, the router's flowlib diff)
```

## Full source

```tsx
'use client';
// The blocks come from a catalog (data); a block's form is built from its params. Right-click for the menu,
// Ctrl+F finds a block, ? lists the shortcuts, Alt+N adds a comment.
import { RulesetEditor, catalogFromBlocks } from '@/modules/app/RulesetEditor';

const catalog = catalogFromBlocks([[
  { type: 'trigger.schedule', title: 'Schedule', params: { time: { type: 'time', default: '08:00' } } },
  { type: 'action.notify', title: 'Send a notification', outputs: [], params: { to: { type: 'source', source: 'teams', required: true } } },
]]);

<RulesetEditor
  catalog={catalog}
  choices={{ teams: [{ value: 'finance', label: 'Finance team' }] }}
  initialNodes={nodes}
  initialEdges={edges}
  onChange={(graph) => save(graph)}
  messages={{ /* the words of the editor, to translate it */ }}
/>
```
