# DevicePlacementPanel

- **id:** `iot-device-placement-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/DevicePlacementPanel.tsx`
- **status:** beta
- **since:** 2026-10

Where a device is and what it is related to: the path of its asset with links, Change placement (DevicePlacementPicker, saying where it is now) and Remove placement (asks first, naming the device and the path), then the device's relations (RelationsSection); the device page Placement & relations tab.

## Variants

### Placed

```tsx
<DevicePlacementPanel deviceId="d1" hrefs={hrefs} />
```

### Not readable

```tsx
<DevicePlacementPanel deviceId="d1" />
```

## Full source

```tsx
<DevicePlacementPanel deviceId={id} hrefs={{ asset }} />
```
