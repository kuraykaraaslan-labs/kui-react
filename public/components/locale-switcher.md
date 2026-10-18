# LocaleSwitcher

- **id:** `locale-switcher`
- **layer:** ui
- **category:** Molecule
- **filePath:** `modules/ui/LocaleSwitcher/index.tsx`
- **status:** beta
- **since:** 2026-10

A language picker for public pages. Options are links when they have an href (a native details menu, so it works without JavaScript) or buttons when they do not. Names are shown in their own language with lang and dir set, the current locale is marked in text, and a locale whose page falls back to another language says so. Not the flag dropdown LanguageSwitcher of the common domain: no flag assets and no i18n dependency.

## Accessibility

- WCAG: AA
- ARIA patterns: disclosure, link
- Keyboard:
  - `ArrowUp / ArrowDown / Home / End` — Move between options
  - `Escape` — Close and return to the trigger

## Design tokens consumed

- `--surface-base`
- `--surface-raised`
- `--surface-overlay`
- `--border`
- `--border-focus`
- `--primary`
- `--warning`
- `--warning-subtle`
- `--text-primary`
- `--text-secondary`

## Variants

### Menu of links

```tsx
<LocaleSwitcher locales={locales} current="en" />
```

### Inline buttons

```tsx
<LocaleSwitcher variant="inline" locales={localesWithoutHref} current="en" onChange={(code) => setLocale(code)} />
```

### Right to left

```tsx
<div dir="rtl"><LocaleSwitcher locales={locales} current="ar" /></div>
```

## Full source

```tsx
import { LocaleSwitcher } from '@/modules/ui/LocaleSwitcher';

<LocaleSwitcher current="en" locales={[{ code: 'en', name: 'English', href: '/en' }, { code: 'tr', name: 'Türkçe', href: '/tr', fallback: true }]} />
```
