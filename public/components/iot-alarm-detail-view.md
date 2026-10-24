# AlarmDetailView

- **id:** `iot-alarm-detail-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmDetailView.tsx`
- **status:** beta
- **since:** 2026-10

One alarm through the adapter: header with optimistic acknowledge / clear (rolled back with a toast on refusal), the timeline with a note box, a runbook drawer and a Related panel (device, what raised it, the topic).

## Variants

### Fixture adapter

```tsx
<AlarmDetailView alarmId="a1" />
```

### Not readable

```tsx
<AlarmDetailView alarmId="missing" />
```

## Full source

```tsx
<AlarmDetailView alarmId={id} hrefs={{ device }} />
```
