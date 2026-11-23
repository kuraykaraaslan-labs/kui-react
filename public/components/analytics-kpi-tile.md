# InsightsKpiTile

- **id:** `analytics-kpi-tile`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/insights/InsightsKpiTile.tsx`
- **status:** stable
- **since:** 2026-11

A headline number with its change against the previous period: arrow for direction, colour for good or bad (flipped for lower-is-better metrics such as average position).

## Variants

### Up, down, lower is better, nothing to compare

```tsx
<InsightsKpiTile label="Avg. position" value="12.4" delta={{ change: -0.06, good: true }} deltaText="-6%" caption="vs previous period" hint="lower is better" />
```

### Unchanged

```tsx
<InsightsKpiTile label="Sessions" value="5,120" delta={{ change: 0, good: null }} deltaText="0%" caption="vs previous period" />
```

## Full source

```tsx
<InsightsKpiTile label="Clicks" value="1,912" delta={{ change: 0.18, good: true }} deltaText="+18%" caption="vs previous period" />
```
