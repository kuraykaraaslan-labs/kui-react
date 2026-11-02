# SettingsForm

- **id:** `iot-settings-form`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/SettingsForm.tsx`
- **status:** beta
- **since:** 2026-11

The generic editor of one settings section from its JSON Schema and annotations: plain fields through SchemaForm, write-only secrets, values only the device can change shown read-only, "Automatic or a number" choices, lists of objects as a DataTable with a drawer per row. Baseline mode: an Include switch per setting, no secrets.

## Variants

### A device's Wi-Fi

```tsx
<SettingsForm section="wifi" schema={schema} values={values} onChange={setValues} />
```

### Part of a baseline

```tsx
<SettingsForm mode="baseline" include={{ keys, onToggle }} … />
```

## Full source

```tsx
<SettingsForm section="wifi" schema={manifest.sections.wifi.schema} values={values} onChange={setValues} reported={section.reported} />
```
