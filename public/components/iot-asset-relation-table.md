# AssetRelationTable

- **id:** `iot-asset-relation-table`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetRelationTable.tsx`
- **status:** beta
- **since:** 2026-10

Typed relations of an asset or device: from, type and to with entity icons and links; CONTAINS towards a device is its placement.

## Variants

### Relations

```tsx
<AssetRelationTable rows={rows} onRemove={remove} />
```

### Empty

```tsx
<AssetRelationTable rows={[]} />
```

## Full source

```tsx
<AssetRelationTable rows={relations} hrefs={{ asset, device }} onRemove={remove} />
```
