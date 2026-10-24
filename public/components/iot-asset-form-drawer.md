# AssetFormDrawer

- **id:** `iot-asset-form-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetFormDrawer.tsx`
- **status:** beta
- **since:** 2026-10

Create or edit a site or asset: name, kind (suggested or another), code (derived when empty), description, time zone and coordinates.

## Variants

### Edit

```tsx
<AssetFormDrawer open asset={asset} onClose={close} />
```

### New child

```tsx
<AssetFormDrawer open parent={parent} onClose={close} />
```

## Full source

```tsx
<AssetFormDrawer open parent={{ assetId, name }} onClose={close} onSaved={reload} />
```
