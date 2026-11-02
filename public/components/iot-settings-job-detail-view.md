# JobDetailView

- **id:** `iot-settings-job-detail-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/settings/JobDetailView.tsx`
- **status:** beta
- **since:** 2026-11

One bulk settings job: status and why it paused, Pause / Resume (past a failed wave: said and recorded) / Cancel, the waves with their counters and results, and every device with what happened per section.

## Variants

### Running

```tsx
<JobDetailView adapter={adapter} jobId="job-1" />
```

### Read only

```tsx
<JobDetailView adapter={adapter} jobId="job-1" />
```

## Full source

```tsx
<JobDetailView adapter={fleetAdapter} jobId={id} />
```
