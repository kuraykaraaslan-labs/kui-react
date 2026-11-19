# PaymentMethodList

- **id:** `common-payment-method-list`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/common/payment/PaymentMethodList.tsx`
- **status:** stable
- **since:** 2026-11

A subscriber's saved payment methods in a DataTable: cards (with the CardBrandBadge), direct-debit mandates, billing agreements, SEPA mandates and bank tokens with last four digits, expiry, status (active, expiring, needs re-authorisation, revoked) and the default marker. Sort, search and filter by status and type. Row actions "Make default" and "Remove" (ConfirmDialog; `inUse` keeps the default until another one is chosen and warns that removing the last method turns renewals into payment requests); "Add payment method" in the header; empty, loading and read-only states. Never shows or takes card numbers: the host's provider page adds a method.

## Variants

### Methods of every kind

```tsx
<PaymentMethodList methods={methods} inUse onAdd={add} onMakeDefault={makeDefault} onRemove={remove} />
```

### Empty, loading and read-only

```tsx
<PaymentMethodList methods={[]} onAdd={add} />
<PaymentMethodList methods={[]} loading />
<PaymentMethodList methods={methods} readOnly />
```

## Full source

```tsx
<PaymentMethodList
  methods={methods}
  inUse
  onAdd={() => startSetupSession()}
  onMakeDefault={(pm) => api.makeDefault(pm.methodId)}
  onRemove={(pm) => api.remove(pm.methodId)}
/>
```
