# JobCard

- **id:** `jobs-job-card`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/jobs/job/JobCard.tsx`
- **status:** stable
- **since:** 2026-05

Summarises a job posting with company logo, title, badges, tags, and meta.

## Variants

### With link

```tsx
<JobCard job={job} href="/jobs/slug" />
```

### No badges

```tsx
<JobCard job={job} showBadges={false} />
```

### Opens a job board (new tab)

```tsx
<JobCard job={job} href={job.applyLinks[0].url} external />
```

## Full source

```tsx
import { JobCard } from '@/modules/domains/jobs/job/JobCard';
<JobCard job={job} href="/jobs/slug" />
```
