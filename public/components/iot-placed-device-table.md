# PlacedDeviceTable

- **id:** `iot-placed-device-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/PlacedDeviceTable.tsx`
- **status:** beta
- **since:** 2026-10

The devices placed under an asset: the device link, its online state (DeviceOnlineDot), the address of its newest connect (DeviceAddress) and the node it sits on; optional Remove placement.

## Variants

### Rows

```tsx
<PlacedDeviceTable rows={rows} assetId="bldg-a" onUnplace={unplace} />
```

### Empty

```tsx
<PlacedDeviceTable rows={[]} />
```

## Full source

```tsx
<PlacedDeviceTable rows={placed} assetId={id} deviceHref={href} onUnplace={unplace} />
```
