# SiteInsightsView

- **id:** `analytics-site-insights-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/insights/SiteInsightsView.tsx`
- **status:** stable
- **since:** 2026-11

A site's analytics and search data in one place: an Overview combining every connected search engine (Google, Bing, Yandex) beside Google Analytics, and a tab per source. KPIs against the previous period, one measure per chart axis, every number also in a table; sources that are not connected or failing say so. The Core Web Vitals tab shows real-user data from the Chrome UX Report per device: a tile per metric (p75, rating, distribution), the weekly p75 history with the good and poor thresholds, and the top pages.

## Variants

### Overview (Google Analytics, Google Search and Bing connected; Yandex not)

```tsx
<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />
```

### One engine failing (its last data kept), all four connected

```tsx
<SiteInsightsView snapshot={snapshot} defaultTab="bing" />
```

### Core Web Vitals tab (Chrome UX Report: phones fail on LCP, desktops pass)

```tsx
<SiteInsightsView snapshot={snapshot} locale="en-US" defaultTab="crux" />
```

## Full source

```tsx
import { SiteInsightsView } from '@/modules/domains/analytics';
<SiteInsightsView snapshot={snapshot} locale="en-US" siteUrl="https://example.com" onRefresh={refresh} />
```
