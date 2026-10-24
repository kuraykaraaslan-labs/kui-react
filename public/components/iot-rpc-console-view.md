# RpcConsoleView

- **id:** `iot-rpc-console-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcConsoleView.tsx`
- **status:** beta
- **since:** 2026-10

A device command console through the IoT adapter: send panel over the catalog and the live history (a request moves through its states without a reload); without a device, the fleet log.

## Variants

### Device console

```tsx
<RpcConsoleView deviceId="d1" />
```

### Fleet log

```tsx
<RpcConsoleView />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter} live={live}><RpcConsoleView deviceId={id} deviceOnline={device.online} /></IotAdapterProvider>
```
