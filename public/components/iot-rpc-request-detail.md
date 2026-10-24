# RpcRequestDetail

- **id:** `iot-rpc-request-detail`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcRequestDetail.tsx`
- **status:** beta
- **since:** 2026-10

One RPC request in a drawer: the request, the answer or the error, the progress timeline, send again and cancel (queued or sent only).

## Variants

### Answered

```tsx
<RpcRequestDetail open request={answered} … />
```

### Queued (cancellable)

```tsx
<RpcRequestDetail open request={queued} onCancel={cancel} />
```

## Full source

```tsx
<RpcRequestDetail open request={r} onClose={close} onCancel={cancel} onRerun={rerun} />
```
