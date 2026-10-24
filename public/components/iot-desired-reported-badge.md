# DesiredReportedBadge

- **id:** `iot-desired-reported-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DesiredReportedBadge.tsx`
- **status:** beta
- **since:** 2026-10

The sync state of a shared attribute: in sync, pending, rejected (with the device reason), drifted, unknown key.

## Variants

### States

```tsx
<DesiredReportedBadge state="pending" />
```

### Rejected with a reason, medium

```tsx
<DesiredReportedBadge state="rejected" reason="value_out_of_range" />
```

## Full source

```tsx
<DesiredReportedBadge state="rejected" reason="value_out_of_range" />
```
