# RulesetEditor

- **id:** `iot-ruleset-editor`
- **layer:** app
- **category:** Domain
- **filePath:** `modules/app/RulesetEditor/RulesetEditor/index.tsx`
- **status:** stable
- **since:** 2026-05

Drag-and-drop visual rule chain editor. The blocks come from a catalog (typed blocks with params), each block has a form built from its schema, and the editor has undo, multi-select, groups, flows that run each other and validation.

## Variants

### With pre-loaded chain

```tsx
<RulesetEditor
  initialNodes={nodes}
  initialEdges={edges}
/>
```

### Block catalog, param forms, a group and a Run flow block

```tsx
<RulesetEditor
  catalog={catalog}            // blocks with typed params, from data
  choices={{ brokers: [...] }} // lists for source fields
  initialNodes={nodes}
  initialEdges={edges}
  initialGroups={groups}
  active={chain.active}        // a missing required param is then an error
  onChange={(graph) => save(graph)}
/>
```

### Arrange, mini map, box select and snap

```tsx
// The blocks are scattered: press "Arrange the blocks" (bottom right) for a layered layout, one undo step.
// Shift / Ctrl / ⌘ and drag on the empty canvas draws a selection frame; the frame button does it with one finger.
// Drag a block: it snaps to a 12 px grid and to the edges of other blocks (guide lines); hold Alt to move freely.
// The mini map shows above 30 blocks or when blocks leave the view; the binoculars button toggles it.
const ref = useRef<RulesetEditorRef>(null);
<RulesetEditor ref={ref} catalog={catalog} initialNodes={nodes} initialEdges={edges}
  onSelectionChange={(ids) => setSelected(ids)}
  nodeMenuItems={({ nodeIds }) => [{ kind: 'item', label: 'Open live data', onSelect: () => open(nodeIds) }]}
  toolbarExtra={<MyButton />} bannerSlot={<DraftBanner />} />
ref.current?.arrange(); ref.current?.select(['n1']); ref.current?.reveal('n4');
```

### Read only

```tsx
<RulesetEditor readOnly catalog={catalog} initialNodes={nodes} initialEdges={edges} />
```

### Empty canvas (editable)

```tsx
<RulesetEditor />
```

## Full source

```tsx
'use client';
// Drag blocks from the palette onto the canvas, or right-click for "Add a block here…".
// Click an output port (filled) and then an input port (hollow) to wire them.
// Click a connection to select it; Delete removes it. Shift or Ctrl click selects several nodes.
// Ctrl+Z undoes, Ctrl+Y redoes. Right-click a node to group, skip, copy or duplicate it.

export function RulesetEditor({
  initialNodes, initialEdges, initialGroups,
  catalog, choices, active, onChange, readOnly, className,
}) {
  // ...
}
```
