# RpcSendPanel

- **id:** `iot-rpc-send-panel`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcSendPanel.tsx`
- **status:** beta
- **since:** 2026-10

Send a command of the device profile catalog: declared parameters through SchemaForm, one-way, timeout, persistent delivery; a tier the viewer may not send is greyed; a high-impact command asks for its typed phrase; never a factory reset (OD-8); disabled with the reason for a ThingsBoard-scheme device (OD-85).

## Variants

### Catalog with a typed confirmation

```tsx
<RpcSendPanel commands={commands} onSend={send} />
```

### ThingsBoard-scheme device

```tsx
<RpcSendPanel commands={[]} supported={false} onSend={send} />
```

## Full source

```tsx
<RpcSendPanel commands={catalog.commands} canSendRaw={catalog.canSendRaw} supported={catalog.supported} deviceOnline={device.online} onSend={(i) => api.send(deviceId, i)} />
```
