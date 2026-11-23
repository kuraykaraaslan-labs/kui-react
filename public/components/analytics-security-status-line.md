# SecurityStatusLine

- **id:** `analytics-security-status-line`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/analytics/security/SecurityStatusLine.tsx`
- **status:** stable
- **since:** 2026-11

The one-line verdict of the security summary: an icon and words for the state (no alerts, a health alert, an integrity alert, the server not reporting), never colour alone; a live region.

## Variants

### Tones

```tsx
<SecurityStatusLine tone="warning" text="1 health alert open" label="Status" />
```

### Translated words

```tsx
<SecurityStatusLine tone="ok" text="Keine offenen Warnungen" label="Status" />
```

## Full source

```tsx
<SecurityStatusLine tone="critical" text="1 integrity alert open" label="Status" />
```
