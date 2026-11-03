# Certificates

- **id:** `landing-certificates`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/trust/Certificates.tsx`
- **status:** stable
- **since:** 2026-11

Certificates, memberships and awards as badges with issuer, year, number and a verify link.

## Variants

### Licences and awards

```tsx
<Certificates title="Licences and awards" items={items} />
```

## Full source

```tsx
import { Certificates } from '@/modules/domains/landing/trust/Certificates';
<Certificates items={[{ title: 'ISO 9001', issuer: 'Bureau', year: '2025', verifyHref: 'https://…' }]} />
```
