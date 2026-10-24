# DeviceDetailView

- **id:** `iot-device-detail-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceDetailView.tsx`
- **status:** beta
- **since:** 2026-10

One device through the adapter: header with copy id, Activate and delete, tabs Overview, Attributes, Credentials (only with the capability) and Log (connections and audited changes), plus tabs other modules contribute.

## Variants

### Fixture adapter

```tsx
<DeviceDetailView deviceId="d1" />
```

### Not readable

```tsx
<DeviceDetailView deviceId="missing" />
```

## Full source

```tsx
<DeviceDetailView deviceId={id} extraTabs={contributedTabs} tab={tab} onTabChange={setTab} />
```
