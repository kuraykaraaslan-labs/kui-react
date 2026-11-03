# NewsletterSignup

- **id:** `landing-newsletter`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/newsletter/NewsletterSignup.tsx`
- **status:** stable
- **since:** 2026-11

An e-mail sign-up with a required consent box and a privacy link; the host sends the address on.

## Variants

### Sign-up

```tsx
<NewsletterSignup title="Stay in the loop" privacyHref="/privacy" onSubscribe={async (email) => subscribe(email)} />
```

## Full source

```tsx
import { NewsletterSignup } from '@/modules/domains/landing/newsletter/NewsletterSignup';
<NewsletterSignup onSubscribe={async (email) => subscribe(email)} privacyHref="/privacy" />
```
