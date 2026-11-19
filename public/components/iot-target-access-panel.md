# TargetAccessPanel

- **id:** `iot-target-access-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/access/TargetAccessPanel.tsx`
- **status:** beta
- **since:** 2026-11

Who can see this (restricted IoT access): the members and groups given one site, asset or device, each with a Member / Group badge and when; a note on who sees it anyway (a role that sees everything, the Full IoT view group) and, for an asset, that access includes everything below it; Give access (a member or group picker) and Remove (asks first) for a viewer who manages access, a read-only list otherwise.

## Variants

### A building, managed

```tsx
<TargetAccessPanel targetType="ASSET" targetId="bldg-a" targetName="Building A" />
```

### A device, read-only

```tsx
<TargetAccessPanel targetType="DEVICE" targetId="d2" targetName="Edge gateway 1" />
```

### Nobody yet

```tsx
<TargetAccessPanel targetType="ASSET" targetId="server-room" targetName="Server room" />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><TargetAccessPanel targetType="ASSET" targetId={asset.assetId} targetName={asset.name} /></IotAdapterProvider>
```
