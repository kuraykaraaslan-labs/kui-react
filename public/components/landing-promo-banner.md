# PromoBanner

- **id:** `landing-promo-banner`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/promo/PromoBanner.tsx`
- **status:** stable
- **since:** 2026-11

A time-boxed campaign in three layouts: `banner` (image beside the text, stacks on phones, image box keeps its aspect ratio so a late banner does not shift the page), `strip` (a one-line top bar, closable through `onDismiss`) and `ribbon` (a badge for pricing cards). Eyebrow, headline, body, a button, a Countdown to `endsAt` and a coupon code with a copy button, in the primary, success, warning, info or neutral tone.

## When to use

Marketing campaigns and limited offers on a public site: above the header, between sections, on a pricing plan.

## When NOT to use

Product or system notices (use AlertBanner or AnnouncementBar), cookie or consent notices.

## Depends on

- `button`
- `badge`
- `countdown`

## Accessibility

- WCAG: AA
- ARIA patterns: Region (banner, strip), Timer (aria-live off), Status (copied)

The banner is a section named by its heading; the strip a region named by its headline. The close and copy buttons have names; a copy is announced through a polite status line.

## Design tokens consumed

- `--primary-subtle`
- `--success-subtle`
- `--warning-subtle`
- `--info-subtle`
- `--surface-raised`
- `--border-strong`
- `--text-primary`
- `--text-secondary`

## Variants

### Banner (image, countdown, coupon)

```tsx
<PromoBanner promo={{
  eyebrow: 'Summer sale',
  headline: '20% off your first year',
  body: 'Every yearly plan, for new workspaces.',
  cta: { label: 'See plans', href: '/pricing' },
  image: { src: '/promo.jpg', mobileSrc: '/promo-phone.jpg' },
  endsAt: '2027-01-01T00:00:00Z',
  couponCode: 'SUMMER20',
}} />
```

### Banner tones (no image)

```tsx
<PromoBanner promo={promo} tone="warning" />
<PromoBanner promo={promo} tone="info" headingLevel={3} />
<PromoBanner promo={promo} tone="neutral" locale="tr" />
```

### Strip (top bar, closable)

```tsx
<PromoBanner promo={campaign} layout="strip" onDismiss={() => localStorage.setItem('promo:' + campaign.id, '1')} />
```

### Ribbon (pricing cards)

```tsx
<PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" tone="warning" />
```

## Full source

```tsx
import { PromoBanner } from '@/modules/domains/landing';

<PromoBanner promo={campaign} />
<PromoBanner promo={campaign} layout="strip" onDismiss={() => remember(campaign.id)} />
<PromoBanner promo={{ headline: 'Summer: −20% first year' }} layout="ribbon" tone="warning" />
```
