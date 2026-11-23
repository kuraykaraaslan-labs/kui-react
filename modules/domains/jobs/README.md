# modules/domains/jobs

Jobs board domain — job postings, company profiles, and application tracking components.

## Subdirectories

```
application/
company/
job/
index.ts
types.ts
```

## Applying elsewhere

A job can take applications on other platforms instead of (or beside) a form: `applyMode` (`LINKS`, `FORM`, `BOTH`)
and `applyLinks` (`{ url, label? }`, up to six). `JobApplyActions` renders the buttons ("Apply on LinkedIn", new tab,
named from the address by `jobPlatformName`, or "Apply now" to the host's form); `JobCard`'s `external` opens a job
board's page in a new tab. `resolveJobApplyMode` decides: no links means the form, no form means the links, no choice
with links means the links.

## Parity

NextJS-only, no EJS or KUInative counterpart. The WordPress set mirrors the apply links: kui-wordpress-saas
`plugin/kui-jobs` (same platform list and apply rules; keep them in step).

## Conventions

1. `'use client';` at top of every component file.
2. `cn()` from `@/libs/utils/cn`.
3. Named exports only.
4. Shared Tailwind tokens from `app/globals.css`.
5. Icons via `<FontAwesomeIcon>`.
6. User/Address/Money types reused from `@/modules/domains/common`.

See [/AGENTS.md](../../../AGENTS.md).
