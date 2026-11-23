# modules/domains/analytics

Site insights: a site's analytics (Google Analytics 4) and search-engine data (Google Search Console, Bing Webmaster,
Yandex Webmaster) on one screen, each source on its own tab and all engines combined on the Overview.

## Subdirectories

```
insights/
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

## Parity

NextJS-only, no EJS or KUInative counterpart. The WordPress set mirrors it: kui-wordpress-saas `plugin/kui-insights`
(Dashboard › Insights) produces the same snapshot and ports `combineInsights` as `Kui\Insights\Combine`; keep the rules
in step.

## Conventions

1. `'use client';` at top of every component file.
2. Named exports only; `cn()` for class names; token-only styling.
3. Words come from `DEFAULT_SITE_INSIGHTS_MESSAGES`; a host translates them with `messages`.
