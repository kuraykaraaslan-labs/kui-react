# SiteInsightsView

- **id:** `analytics-site-insights-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/insights/SiteInsightsView.tsx`
- **status:** stable
- **since:** 2026-11

A site's analytics and search data in one place: an Overview combining every connected search engine (Google, Bing, Yandex) beside Google Analytics, and a tab per source. KPIs against the previous period, one measure per chart axis, every number also in a table; sources that are not connected or failing say so.

## Variants

### Overview (Google Analytics, Google Search and Bing connected; Yandex not)

```tsx
<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />
```

### One engine failing (its last data kept), all four connected

```tsx
<SiteInsightsView snapshot={snapshot} defaultTab="bing" />
```

## Full source

```tsx
import { SiteInsightsView } from '@/modules/domains/analytics';
<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />
```
