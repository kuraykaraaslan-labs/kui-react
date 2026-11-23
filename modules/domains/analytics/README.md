# modules/domains/analytics

Site insights: a site's analytics (Google Analytics 4) and search-engine data (Google Search Console, Bing Webmaster,
Yandex Webmaster) on one screen, each source on its own tab and all engines combined on the Overview.

The site search report: what visitors search for on the site itself, which searches find nothing and which results
they open (`search/`).

## Subdirectories

```
insights/
search/
index.ts
types.ts
```

## The snapshot

The host fetches each source on a schedule and caches one `InsightsSnapshot` (`types.ts`, Zod schemas): per source its
state (`ok`, `off`, `error` with its last good data kept), totals and the previous period's totals, a row per day, top
queries and pages (search) or top pages and channels (analytics). The view never calls an API.

`combineInsights` merges the engines: clicks and impressions add up, CTR is recomputed, the average position is
weighted by impressions over the engines that report one, queries merge case-insensitively and pages by path (with the
analytics views beside them), 25 rows per list. `insightsDelta` compares with the previous period (`lowerIsBetter` for
the average position).

## Charts and colour

One measure per axis: clicks per engine in one chart, page views in another, a metric picker on a source's tab. Each
engine keeps its colour whatever its rank: Google `--chart-1`, Bing `--chart-2`, Yandex `--chart-3`, a set validated for
colour-blind separation in light and dark (dataviz `validate_palette`). Every number is also in a table.

## The site search report

`SearchReportView` reads one `SiteSearchReport` (`types.ts`): the range and the previous one, totals (searches,
searchers, zero-result searches, clicks, click-through) and the previous period's, a row per day, the top searches,
the searches that found nothing on every try, the results opened most (with the searches that led there) and the
languages searched in. The host keeps its own search log and aggregates it; the view never calls an API.

- **Privacy:** queries arrive cleaned and masked (`cleanSearchQuery`: e-mail addresses, phone, card, account and long
  reference numbers become a `[label]`, then lower case, 80 characters). A searcher is a session id that lives one day,
  so `searchers` adds up daily counts. The view prints the retention (`retentionDays`) under the report.
- **Rules** (`searchReport.ts`): rows of the same cleaned query merge (counts add, CTR recomputed, latest date, the
  language of the biggest row); lists sort by searches, then clicks; 25 rows each. The no-results rate is
  zero-result searches / searches and lower is better.
- **Charts:** searches per day and the part that found nothing share one axis (the same measure), `--chart-1` and
  `--chart-2`; the languages are one-hue meter bars. Every number is also in a table (the chart's daily numbers sit in
  a disclosure under it).
- Parts: `SearchQueryTable` (top or zero-result list); the KPI tiles are `InsightsKpiTile`.

## Parity

NextJS-only, no EJS or KUInative counterpart. The WordPress set mirrors it: kui-wordpress-saas `plugin/kui-insights`
(Dashboard › Insights) produces the same snapshot and ports `combineInsights` as `Kui\Insights\Combine`; keep the rules
in step. The site search report's port is `plugin/kui-search` (Dashboard › Site search): `Kui\Search\Query` mirrors
`cleanSearchQuery` and `Kui\Search\Report` builds the same `SiteSearchReport`.

## Conventions

1. `'use client';` at top of every component file.
2. Named exports only; `cn()` for class names; token-only styling.
3. Words come from `DEFAULT_SITE_INSIGHTS_MESSAGES` and `DEFAULT_SEARCH_REPORT_MESSAGES`; a host translates them with
   `messages`.
