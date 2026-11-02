# SettingsDiffTable

- **id:** `iot-settings-diff-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/SettingsDiffTable.tsx`
- **status:** beta
- **since:** 2026-11

Where a device runs something else than was asked: one row per setting, what was asked and what the device has, in words; a secret only says whether each side holds one.

## Variants

### Changed on the device

```tsx
<SettingsDiffTable … />
```

### The same

```tsx
<SettingsDiffTable … />
```

## Full source

```tsx
<SettingsDiffTable section="wifi" schema={schema} desired={section.desired} reported={section.reported} />
```
