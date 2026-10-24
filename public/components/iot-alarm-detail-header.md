# AlarmDetailHeader

- **id:** `iot-alarm-detail-header`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmDetailHeader.tsx`
- **status:** beta
- **since:** 2026-10

An alarm page header with real actions: acknowledge and clear return promises (pending state, every action disabled while one runs, result announced), each optionally with a note. Renamed from AlertDetailHeader (OD-9).

## Variants

### Open, with actions (pending for 1 s)

```tsx
<AlarmDetailHeader … onAcknowledge={ack} onClear={clear} />
```

### Failing action, flapping with topic

```tsx
<AlarmDetailHeader status="ACKNOWLEDGED" flapping topic="sensors/hall-2/inlet" onClear={clear} />
```

## Full source

```tsx
<AlarmDetailHeader title={a.title} severity={a.severity} status={a.status} deviceName={a.deviceName} openedAt={a.openedAt}
  onAcknowledge={(note) => api.acknowledge([id], note)} onClear={(note) => api.clear([id], note)} onOpenRunbook={openRunbook} />
```
