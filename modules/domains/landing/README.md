# modules/domains/landing

Marketing landing page domain — heroes, feature grids, pricing tables, testimonials, FAQs, and other above-the-fold blocks.

## Subdirectories

```
case-study/
faq/
feature/
hero/
how-it-works/
nav/
partner/
pricing/
promo/
stat/
team/
testimonial/
index.ts
types.ts
```

## Parity

NextJS-only, no EJS counterpart.

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. Content blocks accept all copy as props — no hardcoded marketing strings.

See [/AGENTS.md](../../../AGENTS.md).
