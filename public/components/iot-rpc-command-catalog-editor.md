# RpcCommandCatalogEditor

- **id:** `iot-rpc-command-catalog-editor`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/rpc/RpcCommandCatalogEditor.tsx`
- **status:** beta
- **since:** 2026-10

The command catalog of a device profile through the IoT adapter: tier, high impact with a typed phrase, one-way, long-running, parameters; add, edit, remove, export and import (replaces the catalog after typing REPLACE). Never a factory reset (OD-8).

## Variants

### Catalog

```tsx
<RpcCommandCatalogEditor profileId="p1" />
```

### Read error

```tsx
<RpcCommandCatalogEditor profileId="p1" />
```

## Full source

```tsx
<IotAdapterProvider adapter={adapter}><RpcCommandCatalogEditor profileId={id} /></IotAdapterProvider>
```
