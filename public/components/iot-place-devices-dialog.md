# PlaceDevicesDialog

- **id:** `iot-place-devices-dialog`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/PlaceDevicesDialog.tsx`
- **status:** beta
- **since:** 2026-10

Place devices on an asset: search the devices, tick several, place them in one call; a device has one place, so placing it here moves it.

## Variants

### Place devices

```tsx
<PlaceDevicesDialog open asset={asset} />
```

### Failing adapter

```tsx
<PlaceDevicesDialog open={false} … />
```

## Full source

```tsx
<PlaceDevicesDialog open asset={{ assetId, name }} placedIds={here} onClose={close} onPlaced={reload} />
```
