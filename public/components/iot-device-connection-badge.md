# DeviceConnectionBadge

- **id:** `iot-device-connection-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceConnectionBadge.tsx`
- **status:** beta
- **since:** 2026-10

Online / offline with a relative last seen and the last disconnect reason in a tooltip; follows the online rule (null = last seen only) and shows Quarantined (OD-1, counts toward the limit) or Disabled first.

## Variants

### Connection

```tsx
<DeviceConnectionBadge online={false} lastDisconnectReason="keepalive_timeout" />
```

### Quarantined and disabled

```tsx
<DeviceConnectionBadge online status="QUARANTINED" />
```

## Full source

```tsx
<DeviceConnectionBadge online={d.online} status={d.status} lastActivityAt={d.lastActivityAt} lastDisconnectReason={d.lastDisconnectReason} />
```
