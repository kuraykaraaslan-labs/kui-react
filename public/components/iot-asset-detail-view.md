# AssetDetailView

- **id:** `iot-asset-detail-view`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetDetailView.tsx`
- **status:** beta
- **since:** 2026-10

One site or asset through the adapter: path, kind and code, add a child, edit, Move to… (never under itself), delete with the host refusal shown; tabs Overview (inherited time zone, attributes), Devices (placed here or below, online state and IP, Place devices), Child assets and Relations.

## Variants

### A site

```tsx
<AssetDetailView assetId="plant" nodes={tree} />
```

### Devices tab

```tsx
<AssetDetailView assetId="bldg-a" tab="devices" />
```

## Full source

```tsx
<AssetDetailView assetId={id} nodes={tree} hrefs={{ asset, device }} onChanged={reloadTree} />
```
