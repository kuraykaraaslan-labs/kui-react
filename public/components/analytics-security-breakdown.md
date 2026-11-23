# SecurityBreakdown

- **id:** `analytics-security-breakdown`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/security/SecurityBreakdown.tsx`
- **status:** stable
- **since:** 2026-11

Counts of one period split by a key (action, reason, spam kind, jail, country): words, count, share and the previous period's count, with a bar to scale. Every number printed, so the list is its own table.

## Variants

### Refusals by reason

```tsx
<SecurityBreakdown rows={shareRows(byReason, REFUSAL_REASONS)} label={reasonLabel} fmt={insightsFormat('en-US')} previousLabel="Previous period" emptyText="Nothing recorded in this period." ariaLabel="By reason" />
```

### Empty

```tsx
<SecurityBreakdown rows={[]} label={(k) => k} fmt={fmt} previousLabel="Previous period" emptyText="Nothing recorded in this period." ariaLabel="By kind" />
```

## Full source

```tsx
<SecurityBreakdown rows={shareRows(snapshot.refusals.byReason)} label={reasonLabel} fmt={fmt} previousLabel="Previous period" emptyText="Nothing recorded." ariaLabel="By reason" />
```
