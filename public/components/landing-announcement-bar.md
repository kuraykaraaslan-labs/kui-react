# AnnouncementBar

- **id:** `landing-announcement-bar`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/nav/AnnouncementBar.tsx`
- **status:** stable
- **since:** 2026-05

Dismissible top-of-page banner for promotions and announcements. Supports an optional icon, rich message content, a CTA link, and a dismiss button. Renders null once dismissed.

## Variants

### Default (dismissible)

```tsx
<AnnouncementBar icon={faBullhorn} message={<><span className="font-semibold">Velox 2.0 is here</span> — faster builds, smarter previews.</>} cta={{ label: 'Read the announcement', href: '#' }} />
```

### Dark (black bar)

```tsx
<AnnouncementBar variant="dark" message="New release: faster dashboards and smarter rules." cta={{ label: 'See what is new', href: '#' }} />
```

### Non-dismissible promo

```tsx
<AnnouncementBar message="Black Friday — 40% off all plans." cta={{ label: 'Claim offer', href: '#' }} dismissible={false} />
```

## Full source

```tsx
'use client';
import { AnnouncementBar } from '@/modules/domains/landing/nav/AnnouncementBar';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons';

<AnnouncementBar
  icon={faBullhorn}
  message={<><span className="font-semibold">Velox 2.0 is here</span> — faster builds, smarter branch previews.</>}
  cta={{ label: 'Read the announcement', href: '#' }}
/>

// Non-dismissible promotional bar
<AnnouncementBar
  message="Black Friday — 40% off all plans this week only."
  cta={{ label: 'Claim offer', href: '#' }}
  dismissible={false}
/>
```
