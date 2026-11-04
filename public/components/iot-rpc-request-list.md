# RpcRequestList

- **id:** `iot-rpc-request-list`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcRequestList.tsx`
- **status:** beta
- **since:** 2026-10

RPC requests newest first: method, status with outcome, who sent it (console, a flow, a dashboard control), created and duration; a row opens the detail.

## Variants

### Fleet log

```tsx
<RpcRequestList requests={items} showDevice />
```

### Empty

```tsx
<RpcRequestList requests={[]} />
```

## Full source

```tsx
<RpcRequestList requests={items} onOpen={open} total={total} onQueryChange={setQuery} />
```
