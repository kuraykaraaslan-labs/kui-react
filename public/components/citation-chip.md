# CitationChip

- **id:** `citation-chip`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Evidence/index.tsx`
- **status:** beta
- **since:** 2026-10

A numbered evidence chip [1] that links to its evidence row (a same-page anchor, so it works without JavaScript). A citation that points at nothing renders as a dashed "dropped" chip with a warning icon and text, never as a dead link. `CitedText` turns [n] markers in an answer into chips.

## Accessibility

- WCAG: AA
- ARIA patterns: link

Each chip is named "Evidence n: title". A dropped chip is text with a name that says the claim was dropped.

## Design tokens consumed

- `--primary`
- `--primary-subtle`
- `--primary-fg`
- `--warning`
- `--warning-subtle`
- `--border-focus`

## Variants

### Cited and dropped

```tsx
<CitationChip index={1} evidenceId="e-log" title="…" />
<CitationChip index={7} evidenceId="7" status="dropped" />
```

### In answer text

```tsx
<CitedText text={answer} evidence={evidence} />
```

## Full source

```tsx
import { CitationChip, CitedText } from '@/modules/ui/Evidence';

<CitationChip index={1} evidenceId="e-log" title="payments: gateway timeout burst" />
<CitedText text="Errors began after the deploy [3]." evidence={evidence} />
```
