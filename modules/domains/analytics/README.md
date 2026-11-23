# modules/domains/analytics

Site insights: a site's analytics (Google Analytics 4), search-engine data (Google Search Console, Bing Webmaster,
Yandex Webmaster) and real-user Core Web Vitals (Chrome UX Report) on one screen, each source on its own tab and all
engines combined on the Overview.

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

## Core Web Vitals (`kind: 'vitals'`, id `crux`)

The Chrome UX Report's real Chrome users over a 28-day collection period (`range` of the source), per form factor
(`phone`, `desktop`; `all` when CrUX has no device split for the site): for the origin (`originVitals`) and for each of
the top pages (`urls`, absolute `url` plus its path `key`; a page without any form factor has too few visits, "not
enough data"), each metric's p75 (`lcp`, `inp`, `fcp`, `ttfb` in milliseconds, `cls` unitless) with the share of page
loads rated good, needs improvement and poor (fractions). `history` holds up to 25 weekly collection periods of the
origin's p75s per form factor (oldest first, `null` for a period without data). A metric without data is left out.

`vitals.ts` holds the pure rules: `VITAL_THRESHOLDS` (LCP 2.5 s / 4 s, INP 200 ms / 500 ms, CLS 0.1 / 0.25, FCP
1.8 s / 3 s, TTFB 0.8 s / 1.8 s; good at or below the first, poor above the second), `vitalRating`,
`coreVitalsAssessment` (LCP, INP and CLS all good; without INP data, LCP and CLS decide), `vitalsFormFactors`,
`activeVitals` and `vitalsFormat` ("180 ms", "2.9 s" from a second, CLS "0.04", shares in whole percent).

The Core Web Vitals tab: a device switch, the assessment, an `InsightsVitalTile` per metric (p75, rating as status icon +
words, a thin segmented distribution bar with each share beside its rating icon) with a table view, the origin's p75
history of one metric at a time with the good and poor thresholds as reference lines (and a table view), and the top
pages with each metric's p75 and rating icon (a legend names the icons). The Overview adds one line per device: the
assessment and the three Core Web Vitals. `combineInsights` ignores the source.

Ratings are status colours (`--success`, `--warning`, `--error`), never series colours, and always carry an icon of
their own shape (check, exclamation, triangle) plus words or a legend.

## Charts and colour

One measure per axis: clicks per engine in one chart, page views in another, a metric picker on a source's tab. Each
engine keeps its colour whatever its rank: Google `--chart-1`, Bing `--chart-2`, Yandex `--chart-3`, a set validated for
colour-blind separation in light and dark (dataviz `validate_palette`). Every number is also in a table.

## Parity

NextJS-only, no EJS or KUInative counterpart. The WordPress set mirrors it: kui-wordpress-saas `plugin/kui-insights`
(Dashboard › Insights) produces the same snapshot (the Core Web Vitals source from `Kui\Insights\CruxReport`) and
ports `combineInsights` as `Kui\Insights\Combine` and the vitals thresholds and formats in `assets/insights.js`; keep
the rules in step.

## Conventions

1. `'use client';` at top of every component file.
2. Named exports only; `cn()` for class names; token-only styling.
3. Words come from `DEFAULT_SITE_INSIGHTS_MESSAGES`; a host translates them with `messages`.
