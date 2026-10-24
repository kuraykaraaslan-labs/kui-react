# AlarmTable

- **id:** `iot-alarm-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/alarm/AlarmTable.tsx`
- **status:** beta
- **since:** 2026-10

The body of a dashboard alarm table (iot.alarm-table): the rows a host delivers, viewer-side severity chips (the five levels, no re-query), status pills, relative times, a row cap, keyboard row focus, an optional row action, and rows that fade out once resolved.

## Variants

### Rows with chips and a row action

```tsx
<AlarmTable rows={rows} rowAction={…} />
```

### Loading, error, empty

```tsx
<AlarmTable rows={[]} loading />
```

## Full source

```tsx
<AlarmTable rows={data.rows.rows} maxRows={settings.maxRows} onRowClick={onRowClick} rowAction={{ label: 'Acknowledge', onRun: ack }} />
```
