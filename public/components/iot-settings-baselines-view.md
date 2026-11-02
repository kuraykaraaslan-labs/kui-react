# BaselinesView

- **id:** `iot-settings-baselines-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/BaselinesView.tsx`
- **status:** beta
- **since:** 2026-11

The tenant's settings baselines (named partial settings for some models): a DataTable with search, the editor in a drawer with the sections of the chosen models and an Include switch per setting, delete through the ConfirmDialog.

## Variants

### Manage

```tsx
<BaselinesView adapter={adapter} />
```

### Read only

```tsx
<BaselinesView adapter={adapter} />
```

## Full source

```tsx
<BaselinesView adapter={fleetAdapter} jobsHref="/jobs" />
```
