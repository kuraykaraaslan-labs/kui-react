# AssetKindBadge

- **id:** `iot-asset-kind-badge`
- **layer:** domain
- **category:** Domain
- **filePath:** `modules/domains/iot/asset/AssetKindBadge.tsx`
- **status:** beta
- **since:** 2026-10

The icon and label of an asset kind: site, building, floor, room, area, line, machine. Kinds are free: any other kind gets a neutral icon and its own name.

## Variants

### Suggested kinds

```tsx
<AssetKindBadge kind="SITE" />
```

### Free kind and icon only

```tsx
<AssetKindBadge kind="COLD_STORE" />
```

## Full source

```tsx
<AssetKindBadge kind="BUILDING" />
```
