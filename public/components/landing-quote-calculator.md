# QuoteCalculator

- **id:** `landing-quote-calculator`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/landing/pricing/QuoteCalculator.tsx`
- **status:** stable
- **since:** 2026-11

Sliders and extras that add up to an estimate with the sum written out, and a button to the quote form with the estimate in the address.

## Variants

### A mover

```tsx
<QuoteCalculator currency="€" baseFee={150} roundTo={10} inputs={[…]} extras={[…]} ctaHref="/contact" />
```

## Full source

```tsx
import { QuoteCalculator } from '@/modules/domains/landing/pricing/QuoteCalculator';
<QuoteCalculator currency="€" baseFee={150} inputs={[{ label: 'Home size', unit: 'm²', min: 20, max: 300, rate: 4 }]} ctaHref="/contact" />
```
