# TranslatedContent

- **id:** `forum-translated-content`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/forum/post/TranslatedContent.tsx`
- **status:** stable
- **since:** 2026-11

Machine-translated post: the translation with "Translated from <Language> by AI · Show original", and a button that toggles to the original (with its lang) and back.

## Variants

### Translated from Turkish

```tsx
<TranslatedContent sourceLanguage="Turkish" sourceLang="tr" translated={<p>…</p>} original={<p>…</p>} />
```

### Other words, opened on the original

```tsx
<TranslatedContent sourceLanguage="German" sourceLang="de" defaultShowOriginal labels={{ showOriginal: 'Original' }} … />
```

## Full source

```tsx
import { TranslatedContent } from '@/modules/domains/forum/post/TranslatedContent';
<TranslatedContent sourceLanguage="Turkish" sourceLang="tr" translated={translation} original={original} />
```
