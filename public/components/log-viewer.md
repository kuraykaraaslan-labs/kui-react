# LogViewer

- **id:** `log-viewer`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/LogViewer/index.tsx`
- **status:** beta
- **since:** 2026-10

A windowed log list for 10k+ lines: severity as a text label and colour, search with highlight, severity and field facet chips, a wrap toggle, copy line, context lines pulled in around a selected line when the list is filtered, and a follow mode for a live tail (pauses when the user scrolls up, counts new lines, shows a drop counter). `useLogStream` is the producer side: it coalesces pushes, keeps the newest lines and counts drops.

## Accessibility

- WCAG: AA
- ARIA patterns: listbox, option, status
- Keyboard:
  - `ArrowUp / ArrowDown / PageUp / PageDown / Home / End` — Move the selection through the lines
  - `Escape` — Clear the selection
  - `Enter (in the search box)` — Next match in highlight mode

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

### 12 000 lines

```tsx
<LogViewer lines={lines} height={320} />
```

### Highlight mode, wrapped

```tsx
<LogViewer lines={lines} searchMode="highlight" defaultQuery="timeout" defaultWrap />
```

### Live tail with a drop counter

```tsx
const stream = useLogStream({ maxLines: 400 });
<LogViewer lines={stream.lines} dropped={stream.dropped} follow onFollowChange={setFollow} />
```

## Full source

```tsx
import { LogViewer, useLogStream } from '@/modules/ui/LogViewer';

const stream = useLogStream({ maxLines: 10_000 });   // stream.push(lines) from your socket
<LogViewer lines={stream.lines} dropped={stream.dropped} follow onFollowChange={setFollow} />
```
