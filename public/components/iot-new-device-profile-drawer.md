# NewDeviceProfileDrawer

- **id:** `iot-new-device-profile-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/NewDeviceProfileDrawer.tsx`
- **status:** beta
- **since:** 2026-10

New device profile: name, description, transport and an explicit online rule (nothing preselected for any transport, Create disabled until one is chosen, OD-63); the rest takes the protocol defaults.

## Variants

### Open the drawer

```tsx
<NewDeviceProfileDrawer open onClose={close} />
```

### With LoRaWAN

```tsx
<NewDeviceProfileDrawer open transports={['MQTT', 'HTTP', 'ANY', 'LORAWAN']} onClose={close} />
```

## Full source

```tsx
<NewDeviceProfileDrawer open onClose={close} onCreated={(p) => router.push(href(p.profileId))} />
```
