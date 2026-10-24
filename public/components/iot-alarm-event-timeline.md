# AlarmEventTimeline

- **id:** `iot-alarm-event-timeline`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmEventTimeline.tsx`
- **status:** beta
- **since:** 2026-10

An alarm history on the generic Timeline: opened, severity changes, acknowledge and clear with notes, notifications, throttles, mutes, flapping; a note box with onAddNote. Renamed from AlertEventTimeline (OD-9).

## Variants

### With a note box

```tsx
<AlarmEventTimeline events={events} onAddNote={addNote} />
```

### Read only, empty

```tsx
<AlarmEventTimeline events={[]} />
```

## Full source

```tsx
<AlarmEventTimeline events={events} onAddNote={(text) => api.comment(id, text)} />
```
