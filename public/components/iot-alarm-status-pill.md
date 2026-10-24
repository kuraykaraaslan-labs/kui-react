# AlarmStatusPill

- **id:** `iot-alarm-status-pill`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmStatusPill.tsx`
- **status:** beta
- **since:** 2026-10

An alarm status (Open, Acknowledged, Resolved) as a pill.

## Variants

### Statuses

```tsx
<AlarmStatusPill status="OPEN" />
```

### Small, translated

```tsx
<AlarmStatusPill status="OPEN" size="sm" labels={{ OPEN: 'Açık' }} />
```

## Full source

```tsx
<AlarmStatusPill status="ACKNOWLEDGED" />
```
