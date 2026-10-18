# TraceWaterfall

- **id:** `trace-waterfall`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/TraceWaterfall/index.tsx`
- **status:** beta
- **since:** 2026-10

A distributed trace as nested rows with offset and duration bars on a time ruler. Collapse and expand, critical-path highlight, error spans (icon and text, not only colour), a detail slot for the selected span, and a windowed list above 500 rows. Tree semantics (role tree and treeitem, aria-level, aria-expanded, aria-selected) with aria-activedescendant, so the keyboard works the same when rows are windowed.

## Accessibility

- WCAG: AA
- ARIA patterns: tree, treeitem
- Keyboard:
  - `ArrowUp / ArrowDown` — Move between spans
  - `ArrowRight / ArrowLeft` — Expand, collapse, or move to the first child or the parent (mirrored in right-to-left pages)
  - `Home / End / PageUp / PageDown` — Jump
  - `Enter / Space` — Select the span and open its details
  - `*` — Expand all siblings
  - `Escape` — Clear the selection

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

### Default, with the critical path and an error span

```tsx
<TraceWaterfall spans={spans} defaultSelectedId="pay" />
```

### Collapsed start, custom detail slot

```tsx
<TraceWaterfall spans={spans} defaultCollapsedIds={['cart']} renderDetail={(span, info) => <p>{span.name}: {info.selfTime} ms self</p>} />
```

### 1 200 spans (windowed)

```tsx
<TraceWaterfall spans={manySpans} maxHeight={320} />
```

## Full source

```tsx
import { TraceWaterfall } from '@/modules/ui/TraceWaterfall';

<TraceWaterfall
  spans={spans}              // { id, parentId?, name, service?, start, duration, status? }[], times in ms
  onSelect={(span) => open(span)}
  renderDetail={(span, info) => <SpanPanel span={span} info={info} />}
/>
```
