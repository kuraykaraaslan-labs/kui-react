# AlarmSeverityBadge

- **id:** `iot-alarm-severity-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmSeverityBadge.tsx`
- **status:** beta
- **since:** 2026-10

The five alarm severities of OD-9 (Critical, Major, Minor, Warning, Info), each with its own icon and tone from alarm-severity.ts. Renamed from AlertSeverityBadge (OD-9).

## Variants

### All five levels

```tsx
<AlarmSeverityBadge severity="MAJOR" />
```

### Small and icon only

```tsx
<AlarmSeverityBadge severity="CRITICAL" iconOnly />
```

## Full source

```tsx
import { AlarmSeverityBadge } from '@/modules/domains/iot';
<AlarmSeverityBadge severity="CRITICAL" />
```
