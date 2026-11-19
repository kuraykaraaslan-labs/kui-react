# CreditCardVisual

- **id:** `common-credit-card-visual`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/payment/CreditCardVisual.tsx`
- **status:** beta
- **since:** 2025-05

Animated 3-D flip credit card. Front shows number, name, expiry; back shows CVV strip. Supports VISA, Mastercard, AMEX, Discover.

## Variants

### Brands

```tsx
<CreditCardVisual brand="VISA" cardNumber="4111111111111111" cardholderName="JANE DOE" expiryMonth="08" expiryYear="28" />
<CreditCardVisual brand="MASTERCARD" cardNumber="5500005555555559" cardholderName="JOHN SMITH" expiryMonth="12" expiryYear="27" />
```

### Flipped (CVV)

```tsx
<CreditCardVisual brand="AMEX" cardNumber="378282246310005" cardholderName="JANE DOE" expiryMonth="03" expiryYear="26" cvv="1234" flipped />
```

### 19 digits and translated labels

```tsx
<CreditCardVisual brand="UNIONPAY" cardNumber="6200000000000000005" cardholderName="LI WEI" expiryMonth="05" expiryYear="30" />
<CreditCardVisual brand="TROY" cardNumber="9792" messages={{ cardHolder: 'Kart sahibi', expires: 'Son kullanma' }} />
```

## Full source

```tsx
<CreditCardVisual
  brand="VISA"
  cardNumber="4111111111111111"
  cardholderName="JANE DOE"
  expiryMonth="08"
  expiryYear="28"
  flipped={cvvFocused}
/>
```
