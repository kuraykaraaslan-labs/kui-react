# DeviceAttributeTable

- **id:** `iot-device-attribute-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceAttributeTable.tsx`
- **status:** beta
- **since:** 2026-10

Device attributes in three scope tabs; Server and Shared are edited inline as validated JSON, Shared keys show the desired/reported state, Client is read-only, secret keys are write-only.

## Variants

### Writable, shared tab

```tsx
<DeviceAttributeTable entries={entries} canWrite defaultScope="SHARED" />
```

### Read only, loading client

```tsx
<DeviceAttributeTable entries={entries} />
```

## Full source

```tsx
<DeviceAttributeTable entries={entries} canWrite onSave={save} onDelete={remove} onScopeOpen={load} />
```
