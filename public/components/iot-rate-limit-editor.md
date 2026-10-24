# RateLimitEditor

- **id:** `iot-rate-limit-editor`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/profile/RateLimitEditor.tsx`
- **status:** beta
- **since:** 2026-10

Per-device rate limits in the protocol notation: each family is up to four windows count : seconds, each longer than the one before; an invalid family is marked, a changed one can go back to the protocol default.

## Variants

### Protocol defaults

```tsx
<RateLimitEditor value={DEFAULT_RATE_LIMITS} />
```

### A family with an error

```tsx
<RateLimitEditor value={{ …, telemetry_msgs: '300:60,10:1' }} errors={{ telemetry_msgs: '…' }} />
```

## Full source

```tsx
<RateLimitEditor value={draft.rateLimits} onChange={(v) => set({ rateLimits: v })} />
```
