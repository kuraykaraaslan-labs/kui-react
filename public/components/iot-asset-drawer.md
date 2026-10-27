# AssetDrawer

- **id:** `iot-asset-drawer`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetDrawer.tsx`
- **status:** beta
- **since:** 2026-10

One site or asset in a right-side drawer over the table: the actions in the header (add a child, edit; Move to… and delete in the ⋯ menu, labels folding to icons on a phone), then sections one under the other: path, Overview (inherited time zone, location), Attributes, Devices (placed here or below, Place devices), Child assets and Relations.

## Variants

### A site

```tsx
<AssetDrawer assetId="plant" onClose={close} />
```

### A building

```tsx
<AssetDrawer assetId="bldg-a" onClose={close} />
```

## Full source

```tsx
<AssetDrawer assetId={id} onClose={close} onOpenAsset={open} onChanged={reread} hrefs={{ device }} />
```
