# AssetTree

- **id:** `iot-asset-tree`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetTree.tsx`
- **status:** beta
- **since:** 2026-10

The site and asset tree on the generic TreeView, with search that keeps every hit with its ancestors, an empty state with the host action, and keyboard navigation.

## Variants

### Tree

```tsx
<AssetTree nodes={tree} selectedId={id} onSelect={setId} />
```

### Empty

```tsx
<AssetTree nodes={[]} emptyAction={newSite} />
```

## Full source

```tsx
<AssetTree nodes={tree} selectedId={id} onSelect={open} />
```
