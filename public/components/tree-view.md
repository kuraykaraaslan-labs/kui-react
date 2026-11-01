# TreeView

- **id:** `tree-view`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/TreeView/index.tsx`
- **status:** stable
- **since:** 2025-03

Collapsible tree with keyboard navigation, selection, and aria-tree roles. With onMove, nodes move by pointer drag (a long press on touch), with a drop line or a tinted row, auto-scroll near the edges, and by Alt+Arrow keys, each move announced in a polite live region; canDrop refuses targets. The tree stays controlled: apply the move (applyTreeMove) and pass the nodes back. renderLabel draws custom row content.

## Variants

### File tree

```tsx
function Demo() {
  const [sel, setSel] = useState();
  return (
    <TreeView selectedId={sel} onSelect={setSel} label="Files"
      nodes={[
        { id: 'src', label: 'src', children: [
          { id: 'Button', label: 'Button.tsx' },
        ]},
      ]}
    />
  );
}
```

### Navigation menu

```tsx
function Demo() {
  const [sel, setSel] = useState();
  return (
    <TreeView label="Settings navigation" selectedId={sel} onSelect={setSel}
      nodes={[
        { id: 'account', label: 'Account', children: [
          { id: 'profile', label: 'Profile' },
          { id: 'password', label: 'Password' },
        ]},
        { id: 'workspace', label: 'Workspace', children: [
          { id: 'general', label: 'General' },
          { id: 'billing', label: 'Billing' },
        ]},
        { id: 'integrations', label: 'Integrations' },
      ]}
    />
  );
}
```

### Flat list

```tsx
function Demo() {
  const [sel, setSel] = useState('ts');
  return (
    <TreeView label="Language selector" selectedId={sel} onSelect={setSel}
      nodes={[
        { id: 'ts', label: 'TypeScript' },
        { id: 'js', label: 'JavaScript' },
        { id: 'py', label: 'Python' },
        { id: 'go', label: 'Go' },
      ]}
    />
  );
}
```

### Multi-select + type-ahead

```tsx
function Demo() {
  const [ids, setIds] = useState<string[]>(['Card']);
  return (
    <TreeView
      label="Project files"
      selectionMode="multi"
      selectedIds={ids}
      onSelectionChange={setIds}
      nodes={[
        { id: 'docs', label: 'Documents', children: [
          { id: 'spec', label: 'spec.md' },
          { id: 'roadmap', label: 'roadmap.md' },
        ]},
        { id: 'src', label: 'src', children: [
          { id: 'Button', label: 'Button.tsx' },
          { id: 'Card', label: 'Card.tsx' },
          { id: 'Drawer', label: 'Drawer.tsx' },
          { id: 'TreeView', label: 'TreeView.tsx' },
        ]},
      ]}
    />
  );
}

// Try it:
//  - Cmd/Ctrl-click       → toggle individual rows
//  - Shift-click          → range-select between anchor and clicked row
//  - Type "tre"           → focus jumps to "TreeView.tsx"
//  - Cmd/Ctrl+A           → select all visible rows
//  - Arrow keys / Home/End / Space / Enter — full keyboard nav.
```

### Move: drag and Alt+Arrow keys

```tsx
function Demo() {
  const [nodes, setNodes] = useState(INITIAL);
  return (
    <TreeView
      label="Files"
      nodes={nodes}
      onMove={(ids, target) => setNodes((n) => applyTreeMove(n, ids, target))}
    />
  );
}

// Try it:
//  - Drag a row: top quarter = before, bottom quarter = after, middle = inside.
//    After the last child of a group, move left to drop after the group instead.
//  - Touch: long-press a row, then drag.
//  - Alt+ArrowUp / Alt+ArrowDown: move among siblings.
//  - Alt+ArrowLeft: out, after the parent. Alt+ArrowRight: into the previous sibling.
```

### Menu editor: drag handle, canDrop, renderLabel

```tsx
<TreeView
  label="Menu"
  nodes={nodes}
  dragHandle
  // Groups stay at the top level; items stay inside a group.
  canDrop={(ids, target) => ids.every((id) =>
    kindOf(id) === 'group' ? target.parentId === null : kindOf(target.parentId) === 'group')}
  onMove={(ids, target) => setNodes((n) => applyTreeMove(n, ids, target))}
  renderLabel={(node) => (
    <span className="flex items-center gap-2">
      {node.label}
      {node.data.renamed && <Badge size="sm" variant="info">renamed</Badge>}
    </span>
  )}
/>
```

## Full source

```tsx
'use client';
import { useTreeState } from './hooks/useTreeState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { TreeNodeRow } from './parts/Node';

export function TreeView({ nodes, selectedId, selectedIds, onSelect, onSelectionChange, selectionMode = 'single', ... }) {
  // M1: expand all / collapse all, single + multi (Cmd/Shift-click) selection,
  //      arrow keys, Home/End, type-ahead jump, Space toggle, Enter activate.
  // M2: onMove / canDrop: pointer drag, touch long press, Alt+Arrow moves, live-region announcements; renderLabel.
  // M3-M5: lazy load, virtualize, context menu, full ARIA polish.
}
```
