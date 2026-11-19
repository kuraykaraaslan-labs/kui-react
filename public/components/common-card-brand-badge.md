# CardBrandBadge

- **id:** `common-card-brand-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/payment/CardBrandBadge.tsx`
- **status:** stable
- **since:** 2026-11

The small scheme chip of a saved card (VISA, MC, AMEX, TROY, MIR, UnionPay …) in the scheme colour, named for screen readers ("Visa"). Shared by SavedCardSelector and PaymentMethodList; an unknown brand is the grey •• chip.

## Variants

### Every brand

```tsx
{brands.map((b) => <CardBrandBadge key={b} brand={b} />)}
```

### Inline with a card number

```tsx
<CardBrandBadge brand="TROY" /> <span className="font-mono">•••• 9792</span>
```

## Full source

```tsx
<CardBrandBadge brand="VISA" />
```
