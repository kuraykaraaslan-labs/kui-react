# ServiceMap

- **id:** `service-map`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/ServiceMap/index.tsx`
- **status:** beta
- **since:** 2026-10

Services and the calls between them on a deterministic layered layout (no graph library): rate, error and latency badges, pan and zoom, roving-focus keyboard navigation along the call graph, and a selection slot. Errors are never colour alone: a warning icon and percentage, a heavier border and a dashed edge.

## Accessibility

- WCAG: AA
- ARIA patterns: group, button
- Keyboard:
  - `ArrowRight / ArrowLeft` — Follow a call downstream or upstream (mirrored in right-to-left pages)
  - `ArrowUp / ArrowDown` — Siblings in the same layer
  - `Enter / Space` — Select the service
  - `+ / - / 0` — Zoom in, out, fit
  - `Shift + arrows` — Pan
  - `Ctrl + wheel` — Zoom at the cursor

## Design tokens consumed

- `--surface-base`
- `--surface-raised`
- `--surface-overlay`
- `--surface-sunken`
- `--text-primary`
- `--text-secondary`
- `--border`
- `--border-focus`
- `--primary`
- `--primary-subtle`
- `--error`
- `--warning`
- `--success`

## Variants

### Default

```tsx
<ServiceMap nodes={nodes} edges={edges} />
```

### With a selection and a custom panel

```tsx
<ServiceMap nodes={nodes} edges={edges} renderSelection={(node, { incoming, outgoing }) => <Panel node={node} />} />
```

### Right to left

```tsx
<div dir="rtl"><ServiceMap nodes={nodes} edges={edges} /></div>
```

## Full source

```tsx
import { ServiceMap } from '@/modules/ui/ServiceMap';

<ServiceMap
  nodes={[{ id: 'api', name: 'api', rate: 1100, errorRate: 0.031, latencyMs: 240 }]}
  edges={[{ from: 'web', to: 'api', rate: 1100, latencyMs: 130 }]}
  onSelect={(node) => setSelected(node)}
/>
```
