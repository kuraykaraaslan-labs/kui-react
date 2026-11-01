# TranslatableField

- **id:** `translatable-field`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/TranslatableField/index.tsx`
- **status:** stable
- **since:** 2026-11

One text in several languages: a row per language with its flag, its own name, the input (right to left where the language is, lang set), a state mark in words (filled, missing, suggested) and a clear button. A required language left empty is an error; an empty language with a suggestion shows it in the field with an Accept action; a note can sit under a row; an "Add language" slot follows the rows. The value is a code → text record. React-only (next-boilerplate phase 54, D54-10).

## Depends on

- `button`

## Accessibility

- WCAG: AA
- ARIA patterns: group
- Keyboard:
  - `Tab` — Move between the inputs, Accept and clear buttons

## Variants

### Filled, missing and suggested

```tsx
<TranslatableField id="item-label" label="Menu label" languages={languages}
  value={{ en: 'Flows', ar: 'التدفقات' }} onChange={setLabel} required={['en']}
  suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' } }}
  notes={{ ar: 'Overridden in Translations' }} />
```

### Required English empty, with "Add language"

```tsx
<TranslatableField id="ws-label" label="Menu label" languages={languages}
  value={label} onChange={setLabel} required={['en']}
  addLanguage={<Button size="sm" variant="ghost" onClick={addLanguage}>+ Add language</Button>} />
```

## Full source

```tsx
'use client';
import { TranslatableField } from '@/modules/ui/TranslatableField';

const [label, setLabel] = useState({ en: 'Flows' });

<TranslatableField
  id="item-label"
  label="Label"
  languages={[
    { code: 'en', name: 'English', flag: <Flag code="gb" /> },
    { code: 'tr', name: 'Türkçe', flag: <Flag code="tr" /> },
    { code: 'ar', name: 'العربية', rtl: true },
  ]}
  value={label}
  onChange={setLabel}
  required={['en']}
  suggestions={{ tr: { text: 'Akışlar', source: 'automation.menu.flows' } }}
  notes={{ tr: 'Overridden in Translations' }}
/>
```
