# JobsView

- **id:** `iot-settings-jobs-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/JobsView.tsx`
- **status:** beta
- **since:** 2026-11

The bulk settings jobs: a DataTable with status filters and how far each job's waves have gone; "New job" opens a drawer (baseline, devices by models, profile or picked, waves and their checks) with a dry-run plan and the confirmation.

## Variants

### Manage

```tsx
<JobsView adapter={adapter} jobHref={href} />
```

### Read only

```tsx
<JobsView adapter={adapter} jobHref={href} />
```

## Full source

```tsx
<JobsView adapter={fleetAdapter} jobHref={(id) => `/jobs/${id}`} baselinesHref="/baselines" />
```
