# InsightsSourceBadge

- **id:** `analytics-source-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/insights/InsightsSourceBadge.tsx`
- **status:** stable
- **since:** 2026-11

A data source and its state (connected, not connected, last fetch failed) with an icon and words, never colour alone.

## Variants

### States

```tsx
<InsightsSourceBadge label="Google Search" state="ok" stateLabel="Connected" />
<InsightsSourceBadge label="Yandex" state="off" stateLabel="Not connected" />
<InsightsSourceBadge label="Bing" state="error" stateLabel="Last fetch failed" detail="The API answered 401" />
```

### Translated state words

```tsx
<InsightsSourceBadge label="Google Analytics" state="ok" stateLabel="Verbunden" />
```

## Full source

```tsx
<InsightsSourceBadge label="Bing" state="error" stateLabel="Last fetch failed" detail="The API answered 401" />
```
