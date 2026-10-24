# DeviceDetailHeader

- **id:** `iot-device-detail-header`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/device/DeviceDetailHeader.tsx`
- **status:** beta
- **since:** 2026-10

A device page header: name, label, connection badge, gateway tag, serial, profile, firmware and protocol, and an actions slot the host fills. There is no factory-reset action (OD-8).

## Variants

### Online device

```tsx
<DeviceDetailHeader device={device} />
```

### Quarantined, with Activate

```tsx
<DeviceDetailHeader device={quarantined} actions={<Button>Activate</Button>} />
```

## Full source

```tsx
<DeviceDetailHeader device={device} profileHref={profileHref} actions={<Button>Copy ID</Button>} />
```
