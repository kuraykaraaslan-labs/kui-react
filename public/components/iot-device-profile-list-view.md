# DeviceProfileListView

- **id:** `iot-device-profile-list-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/DeviceProfileListView.tsx`
- **status:** beta
- **since:** 2026-10

The device profiles through the IoT adapter: search, transport and online-rule filters, the default first, device counts refreshed every 30 s, New profile (explicit online rule, OD-63), Make default and delete (the host refuses the default and a profile in use).

## Variants

### Profiles

```tsx
<DeviceProfileListView hrefs={hrefs} />
```

### Read error, read-only

```tsx
<DeviceProfileListView hrefs={hrefs} />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><DeviceProfileListView hrefs={{ profile: (id) => `/profiles/${id}` }} /></IotAdapterProvider>
```
