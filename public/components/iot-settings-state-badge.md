# SettingsStateBadge

- **id:** `iot-settings-state-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/SettingsStateBadge.tsx`
- **status:** beta
- **since:** 2026-11

Where a settings section stands in words: applied, on its way, the device trying it, undone or refused by the device, withdrawn while offline, to check after an update; "Changed on the device" beside it for drift.

## Variants

### Every state

```tsx
<SettingsStateBadge state="pending" />
```

### Drift

```tsx
<SettingsStateBadge state="applied" drift />
```

## Full source

```tsx
<SettingsStateBadge state="applied" drift />
```
