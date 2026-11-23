# SearchQueryTable

- **id:** `analytics-search-query-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/search/SearchQueryTable.tsx`
- **status:** stable
- **since:** 2026-11

Site search queries in a sortable, searchable table: searches, how often each found nothing, clicks, CTR, language and when last searched. A query that never found anything carries a "nothing found" tag (icon and words); the zero-result list keeps only searches, language and date.

## Variants

### Top searches

```tsx
<SearchQueryTable kind="top" rows={report.topQueries} locale="en-US" />
```

### Searches that found nothing

```tsx
<SearchQueryTable kind="zero" rows={report.zeroResultQueries} locale="en-US" />
```

## Full source

```tsx
<SearchQueryTable kind="top" rows={report.topQueries} locale="en-US" />
```
