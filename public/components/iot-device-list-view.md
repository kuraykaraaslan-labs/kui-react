# DeviceListView

- **id:** `iot-device-list-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceListView.tsx`
- **status:** beta
- **since:** 2026-10

The device list through the IoT adapter: search and filters, server paging, connection badge, the Quarantined (n) quick filter with bulk Activate, New device (token shown once), live connection updates and a 30 s re-read without a live source.

## Variants

### Fixture adapter

```tsx
<DeviceListView hrefs={hrefs} />
```

### Failing adapter

```tsx
<DeviceListView hrefs={hrefs} />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter} live={live}><DeviceListView hrefs={{ device }} onQueryChange={toUrl} /></IotAdapterProvider>
```
