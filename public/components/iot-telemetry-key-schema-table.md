# TelemetryKeySchemaTable

- **id:** `iot-telemetry-key-schema-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/TelemetryKeySchemaTable.tsx`
- **status:** beta
- **since:** 2026-10

A profile’s fallback telemetry keys (key, type, unit, label, range, decimals) for devices without a firmware description; read-only with a "from firmware" badge when profile.json describes them (P-4).

## Variants

### Editable

```tsx
<TelemetryKeySchemaTable value={keys} onChange={setKeys} />
```

### From firmware (read-only)

```tsx
<TelemetryKeySchemaTable value={keys} fromFirmware="roltek-esp32 1.8.2" />
```

## Full source

```tsx
<TelemetryKeySchemaTable value={draft.telemetrySchema} onChange={(v) => set({ telemetrySchema: v })} />
```
