# SearchReportView

- **id:** `analytics-search-report-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/search/SearchReportView.tsx`
- **status:** stable
- **since:** 2026-11

What visitors search for on the site itself: searches, searchers, the share that found nothing and the click-through against the previous period, searches per day (all and those that found nothing, one axis), the top searches, the searches that found nothing (content gaps), the results opened most and the search languages. Every number is also in a table; queries arrive masked.

## Variants

### 28 days with the period picker (English, German, Turkish and French searches)

```tsx
<SearchReportView report={report} locale="en-US" siteUrl="https://example.com" onRangeChange={(days) => load(days)} />
```

### Nobody searched yet

```tsx
<SearchReportView report={emptyReport} />
```

### Translated (German words and formats), 7 days

```tsx
<SearchReportView report={report} locale="de-DE" messages={{ title: 'Website-Suche', searches: 'Suchen' }} />
```

## Full source

```tsx
import { SearchReportView } from '@/modules/domains/analytics';
<SearchReportView report={report} locale="en-US" siteUrl="https://example.com" onRangeChange={(days) => load(days)} />
```
