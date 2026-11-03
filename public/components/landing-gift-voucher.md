# GiftVoucher

- **id:** `landing-gift-voucher`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/gift/GiftVoucher.tsx`
- **status:** stable
- **since:** 2026-11

A gift voucher card in the brand colours, amount buttons and a buy link with the amount filled in.

## Variants

### A spa voucher

```tsx
<GiftVoucher businessName="Serene Spa" currency="€" amounts={[50, 100, 150]} buyHref="/shop/voucher" terms="Valid for 12 months." />
```

## Full source

```tsx
import { GiftVoucher } from '@/modules/domains/landing/gift/GiftVoucher';
<GiftVoucher businessName="Serene Spa" currency="€" amounts={[50, 100, 150]} buyHref="/shop/voucher" />
```
