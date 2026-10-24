# DeviceTable

- **id:** `iot-device-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceTable.tsx`
- **status:** beta
- **since:** 2026-10

The body of a dashboard device table (iot.device-table): rows a host delivers, online dot with last seen and a stale threshold, telemetry key columns with unit and decimals, keyboard row focus and a row click.

## Variants

### With key columns

```tsx
<DeviceTable rows={rows} keyColumns={keys} />
```

### Empty and failing

```tsx
<DeviceTable rows={[]} error="…" onRetry={retry} />
```

## Full source

```tsx
<DeviceTable rows={data.rows.rows} keyColumns={[{ key: 'temperature', unit: '°C', decimals: 1 }]} staleAfterSeconds={600} onRowClick={onRowClick} />
```
