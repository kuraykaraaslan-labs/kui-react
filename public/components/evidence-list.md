# EvidenceList

- **id:** `evidence-list`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/Evidence/index.tsx`
- **status:** beta
- **since:** 2026-10

The rows an AI answer cites: a number, a kind icon and label, a title that opens the row, a summary, source and time. Claims dropped for citing nothing openable are listed apart with a text indicator. Pair with CitationChip: a chip click highlights its row.

## Accessibility

- WCAG: AA
- ARIA patterns: list, status

An ordered list. The dropped-claims block is a status region.

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

### With a dropped claim, linked to chips

```tsx
<CitedText text={answer} evidence={evidence} onSelect={setActive} />
<EvidenceList items={evidence} activeId={active} droppedClaims={dropped} />
```

### Empty

```tsx
<EvidenceList items={[]} />
```

## Full source

```tsx
import { EvidenceList } from '@/modules/ui/Evidence';

<EvidenceList items={evidence} droppedClaims={dropped} activeId={active} onOpen={(item) => open(item)} />
```
