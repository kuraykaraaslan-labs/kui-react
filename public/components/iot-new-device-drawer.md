# NewDeviceDrawer

- **id:** `iot-new-device-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/NewDeviceDrawer.tsx`
- **status:** beta
- **since:** 2026-10

New device: name, label, profile and gateway flag; on success the access token is shown once with a link to the device, and leaves with the drawer.

## Variants

### Open it

```tsx
<NewDeviceDrawer open … />
```

### Inside DeviceListView

```tsx
<DeviceListView hrefs={hrefs} />
```

## Full source

```tsx
<NewDeviceDrawer open profiles={profiles} deviceHref={href} onClose={close} onCreated={reload} />
```
