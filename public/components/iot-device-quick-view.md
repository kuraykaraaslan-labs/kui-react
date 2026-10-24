# DeviceQuickView

- **id:** `iot-device-quick-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceQuickView.tsx`
- **status:** beta
- **since:** 2026-10

A device seen from its list in a right-side drawer: connection, IP address, profile, firmware, the five newest log lines, copy ID and the full page; ↑ / ↓ and Previous / Next move through the list page, Esc closes. DeviceListView opens it on a row click and keeps it in the URL.

## Variants

### Open it

```tsx
<DeviceQuickView open … />
```

### Inside DeviceListView

```tsx
<DeviceListView hrefs={hrefs} initialQuery={{ device }} onQueryChange={toUrl} />
```

## Full source

```tsx
<DeviceQuickView open deviceId={id} device={row} onClose={close} onPrevious={prev} onNext={next} href={hrefs.device(id)} />
```
