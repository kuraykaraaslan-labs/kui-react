# DeviceProfileCard

- **id:** `iot-device-profile-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/DeviceProfileCard.tsx`
- **status:** beta
- **since:** 2026-10

One device profile at a glance: name, the default star, the template it was copied from, its transport and online rule, and how many devices use it.

## Variants

### Default profile

```tsx
<DeviceProfileCard profile={p} deviceCount={12} />
```

### Template copy, count unknown

```tsx
<DeviceProfileCard profile={copy} deviceCount={null} />
```

## Full source

```tsx
<DeviceProfileCard profile={p} deviceCount={usage.devices} href={profileHref(p.profileId)} />
```
