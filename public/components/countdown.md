# Countdown

- **id:** `countdown`
- **layer:** ui
- **category:** Atom
- **filePath:** `modules/ui/Countdown/Countdown.tsx`
- **status:** stable
- **since:** 2026-11

Counts down to an end date: compact ("2d 4h 12m") or one box per unit, sm/md, seconds optional. Ticks once a minute (once a second with seconds), never announces each tick to screen readers (role="timer", aria-live="off") and reads the end date from a <time datetime>. Renders "--" on the server (or the server time when `now` is given) and ticks on the client, so hydration never mismatches. English and Turkish words built in, all overridable.

## When to use

Time-boxed offers and campaigns (top bar, banner, pricing), event starts, deadlines.

## When NOT to use

Elapsed time or durations that do not end (use a plain formatted value or Statistic).

## Used by

- `landing-promo-banner`

## Accessibility

- WCAG: AA
- ARIA patterns: Timer (aria-live off)

The ticking numbers sit in role="timer" with aria-live="off"; a visually hidden "Ends <time datetime>…</time>" gives the end date. No animation, so reduced motion needs no special case.

## Design tokens consumed

- `--border`
- `--surface-raised`
- `--text-primary`
- `--text-secondary`

## Variants

### Compact (sm, md, with seconds)

```tsx
<Countdown endsAt="2027-01-01T00:00:00Z" size="sm" />
<Countdown endsAt="2027-01-01T00:00:00Z" />
<Countdown endsAt="2027-01-01T00:00:00Z" showSeconds />
```

### Boxed (md, sm, Turkish)

```tsx
<Countdown endsAt="2027-01-01T00:00:00Z" variant="boxed" showSeconds />
<Countdown endsAt="2027-01-01T00:00:00Z" variant="boxed" size="sm" locale="tr" />
```

### Ended

```tsx
<Countdown endsAt="2026-01-01T00:00:00Z" />
<Countdown endsAt="2026-01-01T00:00:00Z" endedLabel="This offer has ended" variant="boxed" />
```

## Full source

```tsx
'use client';
import { Countdown } from '@/modules/ui/Countdown';

<Countdown endsAt="2027-01-01T00:00:00Z" />
<Countdown endsAt={campaign.endsAt} now={requestTime} variant="boxed" showSeconds locale="tr" onEnd={hideBanner} />
```
