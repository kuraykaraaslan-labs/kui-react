# DevicePlacementPanel

- **id:** `iot-device-placement-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/DevicePlacementPanel.tsx`
- **status:** beta
- **since:** 2026-10

Where a device is: the path of its asset with links, Change placement (DevicePlacementPicker) and Remove placement; the device page Placement tab.

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
