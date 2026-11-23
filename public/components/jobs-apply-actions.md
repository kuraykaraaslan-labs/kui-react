# JobApplyActions

- **id:** `jobs-apply-actions`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/jobs/job/JobApplyActions.tsx`
- **status:** stable

A job's apply buttons: "Apply on <platform>" for each job board or ATS the job is posted on (new tab, named from the address) and/or "Apply now" to the host's form. The first button is primary.

## Variants

### Applications elsewhere only

```tsx
<JobApplyActions job={{ applyLinks: [{ url: 'https://www.linkedin.com/jobs/view/…' }, { url: 'https://boards.greenhouse.io/…' }] }} />
```

### Form and a platform, in a row

```tsx
<JobApplyActions job={{ applyMode: 'BOTH', applyLinks: [{ url: 'https://www.indeed.com/…' }] }} applyHref="#apply" layout="row" />
```

## Full source

```tsx
import { JobApplyActions } from '@/modules/domains/jobs/job/JobApplyActions';
<JobApplyActions job={job} />
```
