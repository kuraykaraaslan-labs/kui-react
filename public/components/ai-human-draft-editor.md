# AiHumanDraftEditor

- **id:** `ai-human-draft-editor`
- **layer:** ui
- **category:** Organism
- **filePath:** `modules/ui/AiHumanDraftEditor/index.tsx`
- **status:** beta
- **since:** 2026-10

The AI's draft beside the human's text, diffed by words, with accept and reject per change and accept all. The text stays the human's until they accept; the value is controlled. A badge says the draft is AI-generated. Changes are marked by shape (strike and underline) and a number shown in both panels, and every button names its change.

## Accessibility

- WCAG: AA
- ARIA patterns: group, status

Each change is a group named "Change n of m"; accept and reject buttons say what they replace. Results are announced in a polite status region.

## Design tokens consumed

- `--secondary`
- `--error`
- `--error-subtle`
- `--success`
- `--surface-raised`
- `--surface-sunken`
- `--border`
- `--text-primary`
- `--text-secondary`
- `--primary`
- `--primary-fg`

## Variants

### Review changes

```tsx
<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} model="model-a" />
```

### Read only

```tsx
<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} readOnly />
```

## Full source

```tsx
import { AiHumanDraftEditor } from '@/modules/ui/AiHumanDraftEditor';

const [text, setText] = useState(humanText);
<AiHumanDraftEditor aiDraft={draft} value={text} onChange={setText} model="model-a" />
```
