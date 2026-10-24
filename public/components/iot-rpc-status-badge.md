# RpcStatusBadge

- **id:** `iot-rpc-status-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcStatusBadge.tsx`
- **status:** beta
- **since:** 2026-10

An RPC request status (queued, sent, delivered, successful, failed, timed out, expired, cancelled) with its outcome: a timeout reads "outcome unknown", never "did not run".

## Variants

### Statuses

```tsx
<RpcStatusBadge status="DELIVERED" />
```

### With an outcome, medium

```tsx
<RpcStatusBadge status="TIMEOUT" outcome="unknown" />
```

## Full source

```tsx
<RpcStatusBadge status={r.status} outcome={r.outcome} />
```
