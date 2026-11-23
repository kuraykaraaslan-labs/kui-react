# SecuritySummaryView

- **id:** `analytics-security-summary-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/security/SecuritySummaryView.tsx`
- **status:** stable
- **since:** 2026-11

What a site's protections refused, blocked and noticed over a range of days: a status line (open file-integrity and health alerts, icon and words), headline counts against the previous period, and tabs for geo-IP refusals (by action, reason, country), sign-in security, spam the forms caught, the server (fail2ban bans per jail, alerts) and the short recent-refusals list, the only part that holds IP addresses. One measure per chart axis, every number also in a table.

## Variants

### Overview with a health alert open, range buttons

```tsx
<SecuritySummaryView snapshot={snapshot} locale="en-US" rangeOptions={[7, 30, 90]} onRangeChange={setDays} />
```

### Integrity alert open, Server tab

```tsx
<SecuritySummaryView snapshot={snapshot} defaultTab="server" />
```

### Server not reporting yet, quiet site, recent refusals (holds IP addresses)

```tsx
<SecuritySummaryView snapshot={snapshot} defaultTab="recent" />
```

## Full source

```tsx
import { SecuritySummaryView } from '@/modules/domains/analytics';
<SecuritySummaryView snapshot={snapshot} locale="en-US" rangeOptions={[7, 30, 90, 365]} onRangeChange={load} />
```
