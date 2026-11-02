# DeviceSettingsView

- **id:** `iot-device-settings-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/DeviceSettingsView.tsx`
- **status:** beta
- **since:** 2026-11

The device page's Settings tab: the sections of the device's own settings manifest with where each stands; a section opens its editor in a drawer (generic, or the firewall, Wi-Fi and LTE hints), with a dry run, the one ConfirmDialog (the section name typed for a change that can cut the device off), drift and history.

## Variants

### A Roltek router (Wi-Fi, LTE, firewall, port forwards; firewall rules changed on the device)

```tsx
<DeviceSettingsView adapter={adapter} deviceId="r1" />
```

### A device that takes no settings from the cloud

```tsx
<DeviceSettingsView adapter={adapter} deviceId="s1" />
```

### A model not described yet

```tsx
<DeviceSettingsView adapter={adapter} deviceId="u1" />
```

## Full source

```tsx
import { DeviceSettingsView } from '@/modules/domains/iot';
<DeviceSettingsView adapter={settingsAdapter} deviceId={id} />
```
