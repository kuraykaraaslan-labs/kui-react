# modules/domains/analytics

Site insights: a site's analytics (Google Analytics 4) and search-engine data (Google Search Console, Bing Webmaster,
Yandex Webmaster) on one screen, each source on its own tab and all engines combined on the Overview. Security summary:
what a site's protections refused, blocked and noticed over a range of days.

## Subdirectories

```
insights/
security/
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

## Security summary (`security/`)

`SecuritySummaryView` reads one `SecuritySnapshot` (`security/types.ts`, Zod; kept beside the view so the insights
contract stays as it is): the range and the previous range of the same length; geo-IP refusals as totals and a row per
day split by action (surface) and by reason, plus the countries refused most; sign-in security (failed passwords and
second steps, second-step lockouts, recovery codes used, staff sign-ins, two-step set-ups); spam the forms caught by
kind (honeypot, too fast, bot trap, disposable e-mail, rate limit) and by action; the server (fail2ban bans per jail
per day, file-integrity and health alerts with when they opened and resolved; `state: 'off'` until the server has
reported); and the short recent-refusals list. Only that list holds IP addresses, and the view says so on its tab; the
counters never do.

The status line follows the open alerts (integrity open: critical; health open: warning; none: ok; no server report:
off), always an icon and words. Counts are compared with the previous period without a verdict (`neutralDelta`: more
refusals are not good or bad by themselves). The overview chart draws refusals, failed sign-ins and spam in the fixed
slots `--chart-1..3`; every other chart is one series at a time, picked in its card header. Each chart has a "Show the
numbers as a table" disclosure, and every breakdown prints its counts, shares and previous counts. The pure helpers
(`security/summary.ts`) are mirrored by the WordPress port.

## Parity

NextJS-only, no EJS or KUInative counterpart. The WordPress set mirrors it: kui-wordpress-saas `plugin/kui-insights`
(Dashboard › Insights) produces the same snapshot and ports `combineInsights` as `Kui\Insights\Combine`; keep the rules
in step. The security summary is ported by kui-wordpress-saas `plugin/kui-shield` (Dashboard › Security,
`KuiShield\SecurityReport` builds the snapshot, `SecurityView` prints it, `assets/security.js` draws it).

## Conventions

1. `'use client';` at top of every component file.
2. Named exports only; `cn()` for class names; token-only styling.
3. Words come from `DEFAULT_SITE_INSIGHTS_MESSAGES` / `DEFAULT_SECURITY_SUMMARY_MESSAGES`; a host translates them with
   `messages`.
