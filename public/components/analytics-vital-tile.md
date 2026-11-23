# InsightsVitalTile

- **id:** `analytics-vital-tile`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/insights/InsightsVitalTile.tsx`
- **status:** stable
- **since:** 2026-11

One Web Vital of real users (Chrome UX Report): the 75th percentile, its rating as a status pill (icon + words) and the share of page loads rated good, needs improvement and poor as a thin status-coloured segmented bar, each share printed beside its rating icon.

## Variants

### Good, needs improvement, poor

```tsx
<InsightsVitalTile abbr="TTFB" name="Time to First Byte" value="2.1 s" rating="poor" shares={{ good: 0.31, needsImprovement: 0.3, poor: 0.39 }} labels={labels} formatShare={pct} />
```

### Not enough data; a unitless metric with no poor loads

```tsx
<InsightsVitalTile abbr="INP" name="Interaction to Next Paint" labels={labels} formatShare={pct} notEnoughData="Not enough data" />
```

## Full source

```tsx
<InsightsVitalTile abbr="LCP" name="Largest Contentful Paint" value="2.9 s" rating="needs-improvement"
  shares={{ good: 0.68, needsImprovement: 0.21, poor: 0.11 }} labels={labels} formatShare={pct} caption="75th percentile" coreLabel="Core Web Vital" />
```
