# DeviceOnlineDot

- **id:** `iot-device-online-dot`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceOnlineDot.tsx`
- **status:** beta
- **since:** 2026-10

A device connection as a dot and a short text: online, offline with last seen, last seen only (OD-57, never a red offline), and stale after a threshold.

## Variants

### States

```tsx
<DeviceOnlineDot state="LAST_SEEN" lastSeenAt={t} />
```

### Stale and compact

```tsx
<DeviceOnlineDot state="ONLINE" staleAfterSeconds={600} />
```

## Full source

```tsx
<DeviceOnlineDot state="ONLINE" lastSeenAt={row.lastSeenAt} staleAfterSeconds={600} />
```
