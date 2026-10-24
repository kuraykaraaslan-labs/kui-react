# MoveAssetDialog

- **id:** `iot-move-asset-dialog`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/MoveAssetDialog.tsx`
- **status:** beta
- **since:** 2026-10

Move to…: the new parent picked in a searchable tree that leaves out the asset and everything under it (no cycle), or the top level.

## Variants

### Move a line

```tsx
<MoveAssetDialog open asset={line} nodes={tree} />
```

### Pick a place for a device

```tsx
<DevicePlacementPicker open value={assetId} onPick={place} />
```

## Full source

```tsx
<MoveAssetDialog open asset={asset} nodes={tree} onClose={close} onMoved={reload} />
```
